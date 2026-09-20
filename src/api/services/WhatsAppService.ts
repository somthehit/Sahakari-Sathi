/**
 * WhatsApp Service
 * Supports Twilio, Meta (WhatsApp Business API), and TextMe providers
 * Uses per-organization credentials with platform fallback
 */
import { eq } from 'drizzle-orm';
import { getDb } from '../../db/client';
import { whatsappLogs } from '../../db/schema/notifications';
import { NotificationSettingsService } from './NotificationSettingsService';

export class WhatsAppError extends Error {
  statusCode: number;
  provider: string;
  constructor(statusCode: number, message: string, provider: string) {
    super(message);
    this.statusCode = statusCode;
    this.provider = provider;
  }
}

// =============================================
// WHATSAPP PROVIDER INTERFACES
// =============================================

interface WhatsAppProvider {
  name: string;
  send(to: string, message: string, config: WhatsAppConfig): Promise<WhatsAppResult>;
  checkBalance(config: WhatsAppConfig): Promise<number>;
}

interface WhatsAppConfig {
  apiKey?: string;
  apiSecret?: string;
  phoneNumberId?: string;
  businessAccountId?: string;
  accessToken?: string;
}

interface WhatsAppResult {
  success: boolean;
  messageId?: string;
  error?: string;
  balance?: number;
}

// =============================================
// TWILIO WHATSAPP PROVIDER
// =============================================

class TwilioWhatsAppProvider implements WhatsAppProvider {
  name = 'twilio';
  
  async send(to: string, message: string, config: WhatsAppConfig): Promise<WhatsAppResult> {
    try {
      const accountSid = config.apiKey;
      const authToken = config.apiSecret;
      const fromNumber = config.phoneNumberId;
      
      if (!accountSid || !authToken || !fromNumber) {
        return { success: false, error: 'Twilio credentials not configured' };
      }

      const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
      
      const credentials = Buffer.from(`${accountSid}:${authToken}`).toString('base64');
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${credentials}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          To: `whatsapp:${to}`,
          From: `whatsapp:${fromNumber}`,
          Body: message,
        }),
      });

      const data = await response.json();
      
      if (response.ok) {
        return {
          success: true,
          messageId: data.sid,
        };
      } else {
        return {
          success: false,
          error: data.message || 'Twilio WhatsApp send failed',
        };
      }
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Twilio connection error',
      };
    }
  }

  async checkBalance(config: WhatsAppConfig): Promise<number> {
    try {
      const accountSid = config.apiKey;
      const authToken = config.apiSecret;
      
      if (!accountSid || !authToken) return 0;

      const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Balance.json`;
      const credentials = Buffer.from(`${accountSid}:${authToken}`).toString('base64');
      
      const response = await fetch(url, {
        headers: { 'Authorization': `Basic ${credentials}` },
      });

      const data = await response.json();
      
      if (response.ok) {
        return parseFloat(data.balance || '0');
      }
      
      return 0;
    } catch (error) {
      return 0;
    }
  }
}

// =============================================
// META (WHATSAPP BUSINESS API) PROVIDER
// =============================================

class MetaWhatsAppProvider implements WhatsAppProvider {
  name = 'meta';
  
  private baseUrl = 'https://graph.facebook.com/v18.0';
  
  async send(to: string, message: string, config: WhatsAppConfig): Promise<WhatsAppResult> {
    try {
      const phoneNumberId = config.phoneNumberId;
      const accessToken = config.accessToken;
      
      if (!phoneNumberId || !accessToken) {
        return { success: false, error: 'Meta WhatsApp credentials not configured' };
      }

      const url = `${this.baseUrl}/${phoneNumberId}/messages`;
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: to,
          type: 'text',
          text: { body: message },
        }),
      });

      const data = await response.json();
      
      if (response.ok && data.messages) {
        return {
          success: true,
          messageId: data.messages[0]?.id,
        };
      } else {
        return {
          success: false,
          error: data.error?.message || 'Meta WhatsApp send failed',
        };
      }
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Meta WhatsApp connection error',
      };
    }
  }

  async checkBalance(config: WhatsAppConfig): Promise<number> {
    // Meta doesn't provide a direct balance API
    // Return -1 to indicate unlimited/prepaid
    return -1;
  }
}

// =============================================
// TEXTME WHATSAPP PROVIDER
// =============================================

class TextMeWhatsAppProvider implements WhatsAppProvider {
  name = 'textme';
  
  private baseUrl = 'https://api.textme.bot/v1';
  
  async send(to: string, message: string, config: WhatsAppConfig): Promise<WhatsAppResult> {
    try {
      const apiKey = config.apiKey;
      
      if (!apiKey) {
        return { success: false, error: 'TextMe API key not configured' };
      }

      const url = `${this.baseUrl}/send`;
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          to: to,
          message: message,
        }),
      });

      const data = await response.json();
      
      if (response.ok) {
        return {
          success: true,
          messageId: data.message_id,
          balance: data.balance,
        };
      } else {
        return {
          success: false,
          error: data.message || 'TextMe WhatsApp send failed',
        };
      }
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'TextMe connection error',
      };
    }
  }

  async checkBalance(config: WhatsAppConfig): Promise<number> {
    try {
      const apiKey = config.apiKey;
      if (!apiKey) return 0;

      const url = `${this.baseUrl}/balance`;
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
        },
      });

      const data = await response.json();
      
      if (response.ok) {
        return data.balance || 0;
      }
      
      return 0;
    } catch (error) {
      return 0;
    }
  }
}


// =============================================
// WHATSAPP SERVICE
// =============================================

export class WhatsAppService {
  private providers: Map<string, WhatsAppProvider>;
  private settingsService: NotificationSettingsService;

  constructor() {
    this.providers = new Map();
    this.providers.set('twilio', new TwilioWhatsAppProvider());
    this.providers.set('meta', new MetaWhatsAppProvider());
    this.providers.set('textme', new TextMeWhatsAppProvider());
    this.settingsService = new NotificationSettingsService();
  }

  /**
   * Get effective WhatsApp credentials for an organization
   */
  private async getEffectiveCredentials(organizationId: string) {
    const orgSettings = await this.settingsService.getOrgSettings(organizationId);
    
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
   * Get platform WhatsApp credentials from system_settings
   */
  private async getPlatformWhatsAppCredentials() {
    const db = getDb();
    if (!db) throw new WhatsAppError(500, 'Database not connected', 'system');

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
   * Send WhatsApp message
   */
  async sendWhatsApp(
    organizationId: string,
    to: string,
    message: string,
    templateCode?: string
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    const db = getDb();
    if (!db) throw new WhatsAppError(500, 'Database not connected', 'system');

    // Get effective credentials for this organization
    const credentials = await this.getEffectiveCredentials(organizationId);
    
    if (!credentials.accessToken && !credentials.apiKey) {
      // Log failed attempt
      await this.logWhatsApp(organizationId, {
        toPhone: to,
        body: message,
        templateCode,
        status: 'Failed',
        provider: credentials.provider,
        errorMessage: 'WhatsApp credentials not configured',
      });
      
      return {
        success: false,
        error: 'WhatsApp not configured. Please configure WhatsApp settings or enable platform credentials.',
      };
    }

    // Get the provider
    const provider = this.providers.get(credentials.provider);
    if (!provider) {
      await this.logWhatsApp(organizationId, {
        toPhone: to,
        body: message,
        templateCode,
        status: 'Failed',
        provider: credentials.provider,
        errorMessage: `Unsupported WhatsApp provider: ${credentials.provider}`,
      });
      
      return {
        success: false,
        error: `Unsupported WhatsApp provider: ${credentials.provider}`,
      };
    }

    // Send WhatsApp message
    const result = await provider.send(to, message, credentials);

    // Log the WhatsApp message
    await this.logWhatsApp(organizationId, {
      toPhone: to,
      body: message,
      templateCode,
      status: result.success ? 'Sent' : 'Failed',
      provider: credentials.provider,
      providerMessageId: result.messageId,
      errorMessage: result.error,
    });

    return {
      success: result.success,
      messageId: result.messageId,
      error: result.error,
    };
  }

  /**
   * Send OTP via WhatsApp
   */
  async sendOtpWhatsApp(
    organizationId: string,
    to: string,
    otpCode: string,
    purpose: string = 'verification'
  ): Promise<{ success: boolean; error?: string }> {
    const message = `Your Sahakari Sathi security OTP for ${purpose} is *${otpCode}*. Valid for 5 minutes. Do not share this code with anyone.`;
    
    return this.sendWhatsApp(organizationId, to, message, 'OTP_WHATSAPP');
  }

  /**
   * Send transaction alert via WhatsApp
   */
  async sendTransactionAlert(
    organizationId: string,
    to: string,
    memberName: string,
    transactionType: string,
    amount: number,
    accountNo: string,
    balance: number
  ): Promise<{ success: boolean; error?: string }> {
    const message = `Dear ${memberName},\n\n*NPR ${amount.toLocaleString()}* ${transactionType} on account *${accountNo}*.\n\nBalance: *NPR ${balance.toLocaleString()}*\n\n- SAHAKARI SATHI`;
    
    return this.sendWhatsApp(organizationId, to, message, 'TRANSACTION_WHATSAPP');
  }

  /**
   * Send loan EMI reminder via WhatsApp
   */
  async sendEmiReminder(
    organizationId: string,
    to: string,
    memberName: string,
    emiAmount: number,
    dueDate: string
  ): Promise<{ success: boolean; error?: string }> {
    const message = `Dear ${memberName},\n\nYour loan EMI of *NPR ${emiAmount.toLocaleString()}* is due on *${dueDate}*.\n\nPlease deposit in time to avoid penalty.\n\n- SAHAKARI SATHI`;
    
    return this.sendWhatsApp(organizationId, to, message, 'EMI_WHATSAPP');
  }

  /**
   * Check WhatsApp balance for an organization
   */
  async checkBalance(organizationId: string): Promise<{ balance: number; provider: string }> {
    const credentials = await this.getEffectiveCredentials(organizationId);
    
    if (!credentials.accessToken && !credentials.apiKey) {
      return { balance: 0, provider: credentials.provider };
    }

    const provider = this.providers.get(credentials.provider);
    if (!provider) {
      return { balance: 0, provider: credentials.provider };
    }

    const balance = await provider.checkBalance(credentials);
    
    // Update balance in database if positive
    if (balance >= 0) {
      await this.settingsService.updateWhatsAppCreditBalance(organizationId, balance);
    }
    
    return { balance, provider: credentials.provider };
  }

  /**
   * Log WhatsApp message to database
   */
  private async logWhatsApp(organizationId: string, data: {
    toPhone: string;
    body: string;
    templateCode?: string;
    status: 'Pending' | 'Sent' | 'Failed' | 'Delivered' | 'Read';
    provider: string;
    providerMessageId?: string;
    errorMessage?: string;
  }) {
    const db = getDb();
    if (!db) return;

    try {
      await db.insert(whatsappLogs).values({
        organizationId,
        toPhone: data.toPhone,
        body: data.body,
        templateCode: data.templateCode,
        status: data.status,
        provider: data.provider,
        providerMessageId: data.providerMessageId,
        errorMessage: data.errorMessage,
        sentAt: data.status === 'Sent' ? new Date() : null,
      });
    } catch (error) {
      console.error('Failed to log WhatsApp message:', error);
    }
  }

  /**
   * Get WhatsApp logs for an organization
   */
  async getWhatsAppLogs(organizationId: string, limit: number = 50, offset: number = 0) {
    const db = getDb();
    if (!db) throw new WhatsAppError(500, 'Database not connected', 'system');

    return db.select()
      .from(whatsappLogs)
      .where(eq(whatsappLogs.organizationId, organizationId))
      .limit(limit)
      .offset(offset);
  }
}

// Import systemSettings
import { systemSettings } from '../../db/schema/platformControl';