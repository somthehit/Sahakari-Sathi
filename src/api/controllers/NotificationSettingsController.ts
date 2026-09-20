/**
 * Notification Settings Controller
 * API endpoints for managing notification settings, templates, and reminder rules
 */
import { Request, Response } from 'express';
import { NotificationSettingsService, ReminderRulesService, NotificationTemplateService } from '../services/NotificationSettingsService';
import { SmsService } from '../services/SmsService';
import { WhatsAppService } from '../services/WhatsAppService';
import { EmailService } from '../../lib/emailService';

const notificationSettingsService = new NotificationSettingsService();
const reminderRulesService = new ReminderRulesService();
const notificationTemplateService = new NotificationTemplateService();
const smsService = new SmsService();
const whatsappService = new WhatsAppService();
const emailService = new EmailService();

// =============================================
// ORGANIZATION NOTIFICATION SETTINGS
// =============================================

/**
 * GET /api/v1/notification-settings/:organizationId
 * Get notification settings for an organization
 */
export const getNotificationSettings = async (req: Request, res: Response) => {
  try {
    const { organizationId } = req.params;
    const settings = await notificationSettingsService.getOrgSettings(organizationId);
    res.json({ success: true, data: settings });
  } catch (error: any) {
    res.status(error.statusCode || 500).json({ success: false, error: error.message });
  }
};

/**
 * PUT /api/v1/notification-settings/:organizationId
 * Update notification settings for an organization
 */
export const updateNotificationSettings = async (req: Request, res: Response) => {
  try {
    const { organizationId } = req.params;
    const settings = req.body;
    const updatedBy = (req as any).user?.id;
    
    const result = await notificationSettingsService.upsertOrgSettings(organizationId, settings, updatedBy);
    res.json({ success: true, data: result });
  } catch (error: any) {
    res.status(error.statusCode || 500).json({ success: false, error: error.message });
  }
};

/**
 * GET /api/v1/notification-settings/:organizationId/sms-credentials
 * Get effective SMS credentials (org or platform)
 */
export const getSmsCredentials = async (req: Request, res: Response) => {
  try {
    const { organizationId } = req.params;
    const credentials = await notificationSettingsService.getEffectiveSmsCredentials(organizationId);
    res.json({ success: true, data: credentials });
  } catch (error: any) {
    res.status(error.statusCode || 500).json({ success: false, error: error.message });
  }
};

/**
 * GET /api/v1/notification-settings/:organizationId/email-credentials
 * Get effective Email credentials (org or platform)
 */
export const getEmailCredentials = async (req: Request, res: Response) => {
  try {
    const { organizationId } = req.params;
    const credentials = await notificationSettingsService.getEffectiveEmailCredentials(organizationId);
    res.json({ success: true, data: credentials });
  } catch (error: any) {
    res.status(error.statusCode || 500).json({ success: false, error: error.message });
  }
};

/**
 * POST /api/v1/notification-settings/:organizationId/test-sms
 * Test SMS configuration
 */
export const testSmsConfiguration = async (req: Request, res: Response) => {
  try {
    const { organizationId } = req.params;
    const { phoneNumber } = req.body;
    
    if (!phoneNumber) {
      return res.status(400).json({ success: false, error: 'Phone number is required' });
    }
    
    const result = await notificationSettingsService.testSmsConfiguration(organizationId, phoneNumber);
    res.json({ success: true, data: result });
  } catch (error: any) {
    res.status(error.statusCode || 500).json({ success: false, error: error.message });
  }
};

/**
 * POST /api/v1/notification-settings/:organizationId/test-email
 * Test Email configuration
 */
export const testEmailConfiguration = async (req: Request, res: Response) => {
  try {
    const { organizationId } = req.params;
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({ success: false, error: 'Email address is required' });
    }
    
    const result = await emailService.testConfiguration(organizationId, email);
    res.json({ success: true, data: result });
  } catch (error: any) {
    res.status(error.statusCode || 500).json({ success: false, error: error.message });
  }
};

/**
 * POST /api/v1/notification-settings/:organizationId/check-sms-balance
 * Check SMS credit balance
 */
export const checkSmsBalance = async (req: Request, res: Response) => {
  try {
    const { organizationId } = req.params;
    const result = await smsService.checkBalance(organizationId);
    res.json({ success: true, data: result });
  } catch (error: any) {
    res.status(error.statusCode || 500).json({ success: false, error: error.message });
  }
};

/**
 * GET /api/v1/notification-settings/:organizationId/whatsapp-credentials
 * Get effective WhatsApp credentials (org or platform)
 */
export const getWhatsAppCredentials = async (req: Request, res: Response) => {
  try {
    const { organizationId } = req.params;
    const credentials = await notificationSettingsService.getEffectiveWhatsAppCredentials(organizationId);
    res.json({ success: true, data: credentials });
  } catch (error: any) {
    res.status(error.statusCode || 500).json({ success: false, error: error.message });
  }
};

/**
 * POST /api/v1/notification-settings/:organizationId/test-whatsapp
 * Test WhatsApp configuration
 */
export const testWhatsAppConfiguration = async (req: Request, res: Response) => {
  try {
    const { organizationId } = req.params;
    const { phoneNumber } = req.body;
    
    if (!phoneNumber) {
      return res.status(400).json({ success: false, error: 'Phone number is required' });
    }
    
    const result = await whatsappService.sendWhatsApp(
      organizationId,
      phoneNumber,
      'This is a test message from Sahakari Sathi. WhatsApp integration is working correctly!',
      'TEST_WHATSAPP'
    );
    
    res.json({ success: true, data: result });
  } catch (error: any) {
    res.status(error.statusCode || 500).json({ success: false, error: error.message });
  }
};

/**
 * POST /api/v1/notification-settings/:organizationId/check-whatsapp-balance
 * Check WhatsApp credit balance
 */
export const checkWhatsAppBalance = async (req: Request, res: Response) => {
  try {
    const { organizationId } = req.params;
    const result = await whatsappService.checkBalance(organizationId);
    res.json({ success: true, data: result });
  } catch (error: any) {
    res.status(error.statusCode || 500).json({ success: false, error: error.message });
  }
};


// =============================================
// NOTIFICATION TEMPLATES
// =============================================

/**
 * GET /api/v1/notification-templates/:organizationId
 * Get all templates for an organization
 */
export const getTemplates = async (req: Request, res: Response) => {
  try {
    const { organizationId } = req.params;
    const { channel, category } = req.query;
    
    const templates = await notificationTemplateService.getOrgTemplates(
      organizationId,
      channel as string,
      category as string
    );
    
    res.json({ success: true, data: templates });
  } catch (error: any) {
    res.status(error.statusCode || 500).json({ success: false, error: error.message });
  }
};

/**
 * GET /api/v1/notification-templates/:organizationId/:templateId
 * Get a single template
 */
export const getTemplate = async (req: Request, res: Response) => {
  try {
    const { organizationId, templateId } = req.params;
    const template = await notificationTemplateService.getTemplate(templateId, organizationId);
    res.json({ success: true, data: template });
  } catch (error: any) {
    res.status(error.statusCode || 500).json({ success: false, error: error.message });
  }
};

/**
 * POST /api/v1/notification-templates/:organizationId
 * Create a new template
 */
export const createTemplate = async (req: Request, res: Response) => {
  try {
    const { organizationId } = req.params;
    const templateData = req.body;
    const createdBy = (req as any).user?.id;
    
    const template = await notificationTemplateService.createTemplate(organizationId, templateData, createdBy);
    res.status(201).json({ success: true, data: template });
  } catch (error: any) {
    res.status(error.statusCode || 500).json({ success: false, error: error.message });
  }
};

/**
 * PUT /api/v1/notification-templates/:organizationId/:templateId
 * Update a template
 */
export const updateTemplate = async (req: Request, res: Response) => {
  try {
    const { organizationId, templateId } = req.params;
    const updates = req.body;
    const updatedBy = (req as any).user?.id;
    
    const template = await notificationTemplateService.updateTemplate(templateId, organizationId, updates, updatedBy);
    res.json({ success: true, data: template });
  } catch (error: any) {
    res.status(error.statusCode || 500).json({ success: false, error: error.message });
  }
};

/**
 * DELETE /api/v1/notification-templates/:organizationId/:templateId
 * Delete a template
 */
export const deleteTemplate = async (req: Request, res: Response) => {
  try {
    const { organizationId, templateId } = req.params;
    await notificationTemplateService.deleteTemplate(templateId, organizationId);
    res.json({ success: true, message: 'Template deleted successfully' });
  } catch (error: any) {
    res.status(error.statusCode || 500).json({ success: false, error: error.message });
  }
};


// =============================================
// REMINDER RULES
// =============================================

/**
 * GET /api/v1/reminder-rules/:organizationId
 * Get all reminder rules for an organization
 */
export const getReminderRules = async (req: Request, res: Response) => {
  try {
    const { organizationId } = req.params;
    const rules = await reminderRulesService.getOrgReminderRules(organizationId);
    res.json({ success: true, data: rules });
  } catch (error: any) {
    res.status(error.statusCode || 500).json({ success: false, error: error.message });
  }
};

/**
 * GET /api/v1/reminder-rules/:organizationId/:ruleId
 * Get a single reminder rule
 */
export const getReminderRule = async (req: Request, res: Response) => {
  try {
    const { organizationId, ruleId } = req.params;
    const rule = await reminderRulesService.getReminderRule(ruleId, organizationId);
    res.json({ success: true, data: rule });
  } catch (error: any) {
    res.status(error.statusCode || 500).json({ success: false, error: error.message });
  }
};

/**
 * POST /api/v1/reminder-rules/:organizationId
 * Create a new reminder rule
 */
export const createReminderRule = async (req: Request, res: Response) => {
  try {
    const { organizationId } = req.params;
    const ruleData = req.body;
    const createdBy = (req as any).user?.id;
    
    const rule = await reminderRulesService.createReminderRule(organizationId, ruleData, createdBy);
    res.status(201).json({ success: true, data: rule });
  } catch (error: any) {
    res.status(error.statusCode || 500).json({ success: false, error: error.message });
  }
};

/**
 * PUT /api/v1/reminder-rules/:organizationId/:ruleId
 * Update a reminder rule
 */
export const updateReminderRule = async (req: Request, res: Response) => {
  try {
    const { organizationId, ruleId } = req.params;
    const updates = req.body;
    const updatedBy = (req as any).user?.id;
    
    const rule = await reminderRulesService.updateReminderRule(ruleId, organizationId, updates, updatedBy);
    res.json({ success: true, data: rule });
  } catch (error: any) {
    res.status(error.statusCode || 500).json({ success: false, error: error.message });
  }
};

/**
 * DELETE /api/v1/reminder-rules/:organizationId/:ruleId
 * Delete a reminder rule
 */
export const deleteReminderRule = async (req: Request, res: Response) => {
  try {
    const { organizationId, ruleId } = req.params;
    await reminderRulesService.deleteReminderRule(ruleId, organizationId);
    res.json({ success: true, message: 'Reminder rule deleted successfully' });
  } catch (error: any) {
    res.status(error.statusCode || 500).json({ success: false, error: error.message });
  }
};


// =============================================
// SMS, EMAIL & WHATSAPP LOGS
// =============================================

/**
 * GET /api/v1/sms-logs/:organizationId
 * Get SMS logs for an organization
 */
export const getSmsLogs = async (req: Request, res: Response) => {
  try {
    const { organizationId } = req.params;
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;
    
    const logs = await smsService.getSmsLogs(organizationId, limit, offset);
    res.json({ success: true, data: logs });
  } catch (error: any) {
    res.status(error.statusCode || 500).json({ success: false, error: error.message });
  }
};

/**
 * GET /api/v1/whatsapp-logs/:organizationId
 * Get WhatsApp logs for an organization
 */
export const getWhatsAppLogs = async (req: Request, res: Response) => {
  try {
    const { organizationId } = req.params;
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;
    
    const logs = await whatsappService.getWhatsAppLogs(organizationId, limit, offset);
    res.json({ success: true, data: logs });
  } catch (error: any) {
    res.status(error.statusCode || 500).json({ success: false, error: error.message });
  }
};


// =============================================
// EMAIL LOGS
// =============================================

/**
 * GET /api/v1/email-logs/:organizationId
 * Get email logs for an organization
 */
export const getEmailLogs = async (req: Request, res: Response) => {
  try {
    const { organizationId } = req.params;
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;
    
    const logs = await emailService.getEmailLogs(organizationId, limit, offset);
    res.json({ success: true, data: logs });
  } catch (error: any) {
    res.status(error.statusCode || 500).json({ success: false, error: error.message });
  }
};