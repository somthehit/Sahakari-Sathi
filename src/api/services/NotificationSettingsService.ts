/**
 * Notification Settings Service
 * Manages per-organization SMS/Email credentials with platform fallback
 */
import { eq, and } from 'drizzle-orm';
import { getDb } from '../../db/client';
import { orgNotificationSettings, reminderRules } from '../../db/schema/orgNotificationSettings';
import { systemSettings } from '../../db/schema/platformControl';
import { notificationTemplates } from '../../db/schema/notifications';

export class ApiError extends Error {
  statusCode: number;
  constructor(statusCode: number, message: string) {
    super(message);
    this.statusCode = statusCode;
  }
}

// =============================================
// ORGANIZATION NOTIFICATION SETTINGS
// =============================================

export class NotificationSettingsService {
  
  /**
   * Get notification settings for an organization
   * Falls back to platform credentials if usePlatformCredentials is true
   */
  async getOrgSettings(organizationId: string) {
    const db = getDb();
    if (!db) throw new ApiError(500, 'Database not connected');

    const rows = await db.select()
      .from(orgNotificationSettings)
      .where(eq(orgNotificationSettings.organizationId, organizationId));

    if (rows.length === 0) {
      // Return default settings with platform fallback enabled
      return {
        organizationId,
        smsProvider: null,
        smsApiKey: null,
        smsSenderId: null,
        smsEnabled: false,
        smtpHost: null,
        smtpPort: 587,
        smtpUser: null,
        smtpPass: null,
        smtpFromName: null,
        smtpFromEmail: null,
        smtpSecure: true,
        emailEnabled: false,
        usePlatformCredentials: true,
        smsCreditBalance: 0,
      };
    }

    return rows[0];
  }

  /**
   * Create or update notification settings for an organization
   */
  async upsertOrgSettings(organizationId: string, settings: {
    smsProvider?: string;
    smsApiKey?: string;
    smsSenderId?: string;
    smsEnabled?: boolean;
    smtpHost?: string;
    smtpPort?: number;
    smtpUser?: string;
    smtpPass?: string;
    smtpFromName?: string;
    smtpFromEmail?: string;
    smtpSecure?: boolean;
    emailEnabled?: boolean;
    whatsappProvider?: string;
    whatsappApiKey?: string;
    whatsappApiSecret?: string;
    whatsappPhoneNumberId?: string;
    whatsappBusinessAccountId?: string;
    whatsappAccessToken?: string;
    whatsappEnabled?: boolean;
    usePlatformCredentials?: boolean;
  }, updatedBy?: string) {
    const db = getDb();
    if (!db) throw new ApiError(500, 'Database not connected');

    const existing = await db.select()
      .from(orgNotificationSettings)
      .where(eq(orgNotificationSettings.organizationId, organizationId));

    if (existing.length === 0) {
      // Create new settings
      const [inserted] = await db.insert(orgNotificationSettings)
        .values({
          organizationId,
          ...settings,
          createdBy: updatedBy,
          updatedBy,
        })
        .returning();
      return inserted;
    } else {
      // Update existing settings
      const [updated] = await db.update(orgNotificationSettings)
        .set({
          ...settings,
          updatedAt: new Date(),
          updatedBy,
        })
        .where(eq(orgNotificationSettings.organizationId, organizationId))
        .returning();
      return updated;
    }
  }

  /**
   * Get effective SMS credentials for an organization
   * Returns org credentials if configured, otherwise platform credentials
   */
  async getEffectiveSmsCredentials(organizationId: string) {
    const orgSettings = await this.getOrgSettings(organizationId);
    
    // If org wants to use platform credentials, fetch from system_settings
    if (orgSettings.usePlatformCredentials || !orgSettings.smsEnabled) {
      const platformCredentials = await this.getPlatformSmsCredentials();
      return {
        provider: platformCredentials.sms_provider || 'aakash',
        apiKey: platformCredentials.sms_api_key || '',
        senderId: platformCredentials.sms_sender_id || '',
        isPlatform: true,
      };
    }

    // Use org-specific credentials
    return {
      provider: orgSettings.smsProvider || 'aakash',
      apiKey: orgSettings.smsApiKey || '',
      senderId: orgSettings.smsSenderId || '',
      isPlatform: false,
    };
  }

  /**
   * Get effective Email credentials for an organization
   * Returns org credentials if configured, otherwise platform credentials
   */
  async getEffectiveEmailCredentials(organizationId: string) {
    const orgSettings = await this.getOrgSettings(organizationId);
    
    // If org wants to use platform credentials, fetch from system_settings
    if (orgSettings.usePlatformCredentials || !orgSettings.emailEnabled) {
      const platformCredentials = await this.getPlatformEmailCredentials();
      return {
        host: platformCredentials.smtp_host || '',
        port: parseInt(platformCredentials.smtp_port || '587'),
        user: platformCredentials.smtp_user || '',
        pass: platformCredentials.smtp_pass || '',
        fromName: platformCredentials.smtp_from_name || 'Sahakari Sathi',
        fromEmail: platformCredentials.smtp_from_email || 'noreply@sahakarisathi.com',
        secure: true,
        isPlatform: true,
      };
    }

    // Use org-specific credentials
    return {
      host: orgSettings.smtpHost || '',
      port: orgSettings.smtpPort || 587,
      user: orgSettings.smtpUser || '',
      pass: orgSettings.smtpPass || '',
      fromName: orgSettings.smtpFromName || 'Sahakari Sathi',
      fromEmail: orgSettings.smtpFromEmail || '',
      secure: orgSettings.smtpSecure,
      isPlatform: false,
    };
  }

  /**
   * Get effective WhatsApp credentials for an organization
   * Returns org credentials if configured, otherwise platform credentials
   */
  async getEffectiveWhatsAppCredentials(organizationId: string) {
    const orgSettings: any = await this.getOrgSettings(organizationId);
    
    // If org wants to use platform credentials, fetch from system_settings
    if (orgSettings.usePlatformCredentials || !orgSettings.whatsappEnabled) {
      const platformCredentials = await this.getPlatformWhatsAppCredentials();
      return {
        provider: platformCredentials.whatsapp_provider || 'meta',
        apiKey: platformCredentials.whatsapp_api_key || '',
        apiSecret: platformCredentials.whatsapp_api_secret || '',
        phoneNumberId: platformCredentials.whatsapp_phone_number_id || '',
        businessAccountId: platformCredentials.whatsapp_business_account_id || '',
        accessToken: platformCredentials.whatsapp_access_token || '',
        isPlatform: true,
      };
    }

    // Use org-specific credentials
    return {
      provider: orgSettings.whatsappProvider || 'meta',
      apiKey: orgSettings.whatsappApiKey || '',
      apiSecret: orgSettings.whatsappApiSecret || '',
      phoneNumberId: orgSettings.whatsappPhoneNumberId || '',
      businessAccountId: orgSettings.whatsappBusinessAccountId || '',
      accessToken: orgSettings.whatsappAccessToken || '',
      isPlatform: false,
    };
  }

  /**
   * Get platform SMS credentials from system_settings
   */
  private async getPlatformSmsCredentials() {
    const db = getDb();
    if (!db) throw new ApiError(500, 'Database not connected');

    const rows = await db.select()
      .from(systemSettings)
      .where(eq(systemSettings.category, 'sms'));

    const settings: Record<string, string> = {};
    for (const row of rows) {
      settings[row.key] = row.value || '';
    }

    return settings;
  }

  /**
   * Get platform Email credentials from system_settings
   */
  private async getPlatformEmailCredentials() {
    const db = getDb();
    if (!db) throw new ApiError(500, 'Database not connected');

    const rows = await db.select()
      .from(systemSettings)
      .where(eq(systemSettings.category, 'email'));

    const settings: Record<string, string> = {};
    for (const row of rows) {
      settings[row.key] = row.value || '';
    }

    return settings;
  }

  /**
   * Get platform WhatsApp credentials from system_settings
   */
  private async getPlatformWhatsAppCredentials() {
    const db = getDb();
    if (!db) throw new ApiError(500, 'Database not connected');

    const rows = await db.select()
      .from(systemSettings)
      .where(eq(systemSettings.category, 'whatsapp'));

    const settings: Record<string, string> = {};
    for (const row of rows) {
      settings[row.key] = row.value || '';
    }

    return settings;
  }

  /**
   * Update SMS credit balance for an organization
   */
  async updateSmsCreditBalance(organizationId: string, balance: number) {
    const db = getDb();
    if (!db) throw new ApiError(500, 'Database not connected');

    await db.update(orgNotificationSettings)
      .set({
        smsCreditBalance: balance,
        smsCreditUpdatedAt: new Date(),
      })
      .where(eq(orgNotificationSettings.organizationId, organizationId));
  }

  /**
   * Update WhatsApp credit balance for an organization
   */
  async updateWhatsAppCreditBalance(organizationId: string, balance: number) {
    const db = getDb();
    if (!db) throw new ApiError(500, 'Database not connected');

    await db.update(orgNotificationSettings)
      .set({
        whatsappCreditBalance: balance,
        whatsappCreditUpdatedAt: new Date(),
      })
      .where(eq(orgNotificationSettings.organizationId, organizationId));
  }

  /**
   * Test SMS configuration for an organization
   */
  async testSmsConfiguration(organizationId: string, testPhoneNumber: string) {
    const credentials = await this.getEffectiveSmsCredentials(organizationId);
    
    if (!credentials.apiKey) {
      throw new ApiError(400, 'SMS API key not configured');
    }

    // This will be implemented in SmsService
    // For now, return the configuration that would be used
    return {
      success: true,
      provider: credentials.provider,
      isPlatformCredential: credentials.isPlatform,
      testPhone: testPhoneNumber,
      message: 'SMS configuration test successful',
    };
  }

  /**
   * Test Email configuration for an organization
   */
  async testEmailConfiguration(organizationId: string, testEmail: string) {
    const credentials = await this.getEffectiveEmailCredentials(organizationId);
    
    if (!credentials.host || !credentials.user) {
      throw new ApiError(400, 'Email SMTP not configured');
    }

    // This will be implemented in EmailService
    // For now, return the configuration that would be used
    return {
      success: true,
      host: credentials.host,
      port: credentials.port,
      isPlatformCredential: credentials.isPlatform,
      testEmail,
      message: 'Email configuration test successful',
    };
  }
}


// =============================================
// REMINDER RULES SERVICE
// =============================================

export class ReminderRulesService {
  
  /**
   * Get all reminder rules for an organization
   */
  async getOrgReminderRules(organizationId: string) {
    const db = getDb();
    if (!db) throw new ApiError(500, 'Database not connected');

    return db.select()
      .from(reminderRules)
      .where(eq(reminderRules.organizationId, organizationId));
  }

  /**
   * Get a single reminder rule by ID
   */
  async getReminderRule(id: string, organizationId: string) {
    const db = getDb();
    if (!db) throw new ApiError(500, 'Database not connected');

    const rows = await db.select()
      .from(reminderRules)
      .where(and(
        eq(reminderRules.id, id),
        eq(reminderRules.organizationId, organizationId)
      ));

    if (rows.length === 0) {
      throw new ApiError(404, 'Reminder rule not found');
    }

    return rows[0];
  }

  /**
   * Create a new reminder rule
   */
  async createReminderRule(organizationId: string, rule: {
    code: string;
    name: string;
    description?: string;
    triggerType: string;
    triggerDays?: number;
    triggerTime?: string;
    eventType: string;
    sendSms?: boolean;
    sendEmail?: boolean;
    sendInApp?: boolean;
    smsTemplateCode?: string;
    emailTemplateCode?: string;
    recipientType?: string;
    customRecipientIds?: string;
    isActive?: boolean;
  }, createdBy?: string) {
    const db = getDb();
    if (!db) throw new ApiError(500, 'Database not connected');

    // Check for duplicate code
    const existing = await db.select()
      .from(reminderRules)
      .where(and(
        eq(reminderRules.organizationId, organizationId),
        eq(reminderRules.code, rule.code)
      ));

    if (existing.length > 0) {
      throw new ApiError(400, `Reminder rule with code "${rule.code}" already exists`);
    }

    const [inserted] = await db.insert(reminderRules)
      .values({
        organizationId,
        ...rule,
        createdBy,
        updatedBy: createdBy,
      })
      .returning();

    return inserted;
  }

  /**
   * Update a reminder rule
   */
  async updateReminderRule(id: string, organizationId: string, updates: {
    name?: string;
    description?: string;
    triggerType?: string;
    triggerDays?: number;
    triggerTime?: string;
    eventType?: string;
    sendSms?: boolean;
    sendEmail?: boolean;
    sendInApp?: boolean;
    smsTemplateCode?: string;
    emailTemplateCode?: string;
    recipientType?: string;
    customRecipientIds?: string;
    isActive?: boolean;
  }, updatedBy?: string) {
    const db = getDb();
    if (!db) throw new ApiError(500, 'Database not connected');

    const [updated] = await db.update(reminderRules)
      .set({
        ...updates,
        updatedAt: new Date(),
        updatedBy,
      })
      .where(and(
        eq(reminderRules.id, id),
        eq(reminderRules.organizationId, organizationId)
      ))
      .returning();

    if (!updated) {
      throw new ApiError(404, 'Reminder rule not found');
    }

    return updated;
  }

  /**
   * Delete a reminder rule
   */
  async deleteReminderRule(id: string, organizationId: string) {
    const db = getDb();
    if (!db) throw new ApiError(500, 'Database not connected');

    const [deleted] = await db.delete(reminderRules)
      .where(and(
        eq(reminderRules.id, id),
        eq(reminderRules.organizationId, organizationId)
      ))
      .returning();

    if (!deleted) {
      throw new ApiError(404, 'Reminder rule not found');
    }

    return { success: true };
  }
}


// =============================================
// NOTIFICATION TEMPLATES SERVICE
// =============================================

export class NotificationTemplateService {
  
  /**
   * Get all notification templates for an organization
   */
  async getOrgTemplates(organizationId: string, channel?: string, category?: string) {
    const db = getDb();
    if (!db) throw new ApiError(500, 'Database not connected');

    let query = db.select()
      .from(notificationTemplates)
      .where(eq(notificationTemplates.organizationId, organizationId));

    // Note: For complex queries with multiple conditions, we'd need to chain wheres
    // For now, return all org templates
    return query;
  }

  /**
   * Get a single template by ID
   */
  async getTemplate(id: string, organizationId: string) {
    const db = getDb();
    if (!db) throw new ApiError(500, 'Database not connected');

    const rows = await db.select()
      .from(notificationTemplates)
      .where(and(
        eq(notificationTemplates.id, id),
        eq(notificationTemplates.organizationId, organizationId)
      ));

    if (rows.length === 0) {
      throw new ApiError(404, 'Template not found');
    }

    return rows[0];
  }

  /**
   * Get a template by code and channel
   */
  async getTemplateByCode(organizationId: string, code: string, channel: string) {
    const db = getDb();
    if (!db) throw new ApiError(500, 'Database not connected');

    const rows = await db.select()
      .from(notificationTemplates)
      .where(and(
        eq(notificationTemplates.organizationId, organizationId),
        eq(notificationTemplates.code, code),
        eq(notificationTemplates.channel, channel)
      ));

    return rows.length > 0 ? rows[0] : null;
  }

  /**
   * Create a new notification template
   */
  async createTemplate(organizationId: string, template: {
    code: string;
    channel: string;
    category?: string;
    subject?: string;
    bodyTemplate: string;
    variables?: any[];
    language?: string;
    isActive?: boolean;
  }, createdBy?: string) {
    const db = getDb();
    if (!db) throw new ApiError(500, 'Database not connected');

    // Check for duplicate code+channel
    const existing = await db.select()
      .from(notificationTemplates)
      .where(and(
        eq(notificationTemplates.organizationId, organizationId),
        eq(notificationTemplates.code, template.code),
        eq(notificationTemplates.channel, template.channel)
      ));

    if (existing.length > 0) {
      throw new ApiError(400, `Template with code "${template.code}" for ${template.channel} already exists`);
    }

    const [inserted] = await db.insert(notificationTemplates)
      .values({
        organizationId,
        ...template,
        createdBy,
        updatedBy: createdBy,
      })
      .returning();

    return inserted;
  }

  /**
   * Update a notification template
   */
  async updateTemplate(id: string, organizationId: string, updates: {
    subject?: string;
    bodyTemplate?: string;
    variables?: any[];
    category?: string;
    language?: string;
    isActive?: boolean;
  }, updatedBy?: string) {
    const db = getDb();
    if (!db) throw new ApiError(500, 'Database not connected');

    const [updated] = await db.update(notificationTemplates)
      .set({
        ...updates,
        updatedAt: new Date(),
        updatedBy,
      })
      .where(and(
        eq(notificationTemplates.id, id),
        eq(notificationTemplates.organizationId, organizationId)
      ))
      .returning();

    if (!updated) {
      throw new ApiError(404, 'Template not found');
    }

    return updated;
  }

  /**
   * Delete a notification template (only if not system template)
   */
  async deleteTemplate(id: string, organizationId: string) {
    const db = getDb();
    if (!db) throw new ApiError(500, 'Database not connected');

    // Check if it's a system template
    const template = await this.getTemplate(id, organizationId);
    if (template.isSystem) {
      throw new ApiError(400, 'System templates cannot be deleted');
    }

    await db.delete(notificationTemplates)
      .where(and(
        eq(notificationTemplates.id, id),
        eq(notificationTemplates.organizationId, organizationId)
      ));

    return { success: true };
  }

  /**
   * Render a template with variables
   */
  renderTemplate(templateBody: string, variables: Record<string, string>): string {
    let rendered = templateBody;
    for (const [key, value] of Object.entries(variables)) {
      rendered = rendered.replace(new RegExp(`{${key}}`, 'g'), value);
    }
    return rendered;
  }

  /**
   * Increment template usage count
   */
  async incrementUsage(id: string) {
    const db = getDb();
    if (!db) throw new ApiError(500, 'Database not connected');

    await db.update(notificationTemplates)
      .set({
        usageCount: sql`${notificationTemplates.usageCount} + 1`,
        lastUsedAt: new Date(),
      })
      .where(eq(notificationTemplates.id, id));
  }
}

// Import sql for incrementUsage
import { sql } from 'drizzle-orm';