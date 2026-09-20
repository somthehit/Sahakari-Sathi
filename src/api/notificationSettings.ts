/**
 * Notification Settings API
 * Client-side API calls for notification settings, templates, and reminder rules
 */
import { apiClient } from '../lib/apiClient';

// =============================================
// TYPES
// =============================================

export interface OrgNotificationSettings {
  id?: string;
  organizationId: string;
  smsProvider?: string;
  smsApiKey?: string;
  smsSenderId?: string;
  smsEnabled: boolean;
  smtpHost?: string;
  smtpPort?: number;
  smtpUser?: string;
  smtpPass?: string;
  smtpFromName?: string;
  smtpFromEmail?: string;
  smtpSecure: boolean;
  emailEnabled: boolean;
  whatsappProvider?: string;
  whatsappApiKey?: string;
  whatsappApiSecret?: string;
  whatsappPhoneNumberId?: string;
  whatsappBusinessAccountId?: string;
  whatsappAccessToken?: string;
  whatsappEnabled: boolean;
  usePlatformCredentials: boolean;
  smsCreditBalance?: number;
  whatsappCreditBalance?: number;
}

export interface NotificationTemplate {
  id: string;
  organizationId: string;
  code: string;
  channel: 'Email' | 'SMS' | 'WhatsApp' | 'Push' | 'In_App';
  category?: string;
  subject?: string;
  bodyTemplate: string;
  variables?: any[];
  language?: string;
  isActive: boolean;
  isSystem: boolean;
  usageCount: number;
  lastUsedAt?: string;
  createdBy?: string;
  updatedBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ReminderRule {
  id: string;
  organizationId: string;
  code: string;
  name: string;
  description?: string;
  triggerType: string;
  triggerDays?: number;
  triggerTime?: string;
  eventType: string;
  sendSms: boolean;
  sendEmail: boolean;
  sendInApp: boolean;
  smsTemplateCode?: string;
  emailTemplateCode?: string;
  recipientType: string;
  customRecipientIds?: string;
  isActive: boolean;
  lastRunAt?: string;
  nextRunAt?: string;
  createdBy?: string;
  updatedBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SmsLog {
  id: string;
  organizationId: string;
  templateCode?: string;
  toPhone: string;
  body: string;
  status: 'Pending' | 'Sent' | 'Failed' | 'Delivered';
  provider?: string;
  providerMessageId?: string;
  attemptCount: number;
  sentAt?: string;
  errorMessage?: string;
  createdAt: string;
}

export interface EmailLog {
  id: string;
  organizationId: string;
  templateCode?: string;
  toEmail: string;
  toName?: string;
  subject: string;
  body?: string;
  status: 'Pending' | 'Sent' | 'Failed' | 'Bounced';
  attemptCount: number;
  sentAt?: string;
  errorMessage?: string;
  metadata?: any;
  createdAt: string;
}

export interface WhatsAppLog {
  id: string;
  organizationId: string;
  templateCode?: string;
  toPhone: string;
  body: string;
  status: 'Pending' | 'Sent' | 'Failed' | 'Delivered' | 'Read';
  provider?: string;
  providerMessageId?: string;
  attemptCount: number;
  sentAt?: string;
  deliveredAt?: string;
  readAt?: string;
  errorMessage?: string;
  metadata?: any;
  createdAt: string;
}

export interface SmsCredentials {
  provider: string;
  apiKey: string;
  senderId: string;
  isPlatform: boolean;
}

export interface EmailCredentials {
  host: string;
  port: number;
  user: string;
  pass: string;
  fromName: string;
  fromEmail: string;
  secure: boolean;
  isPlatform: boolean;
}

export interface WhatsAppCredentials {
  provider: string;
  apiKey: string;
  apiSecret: string;
  phoneNumberId: string;
  businessAccountId: string;
  accessToken: string;
  isPlatform: boolean;
}


// =============================================
// ORGANIZATION NOTIFICATION SETTINGS
// =============================================

/**
 * Get notification settings for an organization
 */
export const getNotificationSettings = async (organizationId: string): Promise<OrgNotificationSettings> => {
  const { data } = await apiClient.get(`/notification-settings/${organizationId}`);
  return data?.data || {
    organizationId,
    smsEnabled: false,
    smtpSecure: true,
    emailEnabled: false,
    usePlatformCredentials: true,
  };
};

/**
 * Update notification settings for an organization
 */
export const updateNotificationSettings = async (
  organizationId: string,
  settings: Partial<OrgNotificationSettings>
): Promise<OrgNotificationSettings> => {
  const { data } = await apiClient.put(`/notification-settings/${organizationId}`, settings);
  return data?.data;
};

/**
 * Get effective SMS credentials (org or platform)
 */
export const getSmsCredentials = async (organizationId: string): Promise<SmsCredentials> => {
  const { data } = await apiClient.get(`/notification-settings/${organizationId}/sms-credentials`);
  return data?.data;
};

/**
 * Get effective Email credentials (org or platform)
 */
export const getEmailCredentials = async (organizationId: string): Promise<EmailCredentials> => {
  const { data } = await apiClient.get(`/notification-settings/${organizationId}/email-credentials`);
  return data?.data;
};

/**
 * Get effective WhatsApp credentials (org or platform)
 */
export const getWhatsAppCredentials = async (organizationId: string): Promise<WhatsAppCredentials> => {
  const { data } = await apiClient.get(`/notification-settings/${organizationId}/whatsapp-credentials`);
  return data?.data;
};

/**
 * Test SMS configuration
 */
export const testSmsConfiguration = async (
  organizationId: string,
  phoneNumber: string
): Promise<{ success: boolean; message: string }> => {
  const { data } = await apiClient.post(`/notification-settings/${organizationId}/test-sms`, { phoneNumber });
  return data?.data;
};

/**
 * Test Email configuration
 */
export const testEmailConfiguration = async (
  organizationId: string,
  email: string
): Promise<{ success: boolean; message: string }> => {
  const { data } = await apiClient.post(`/notification-settings/${organizationId}/test-email`, { email });
  return data?.data;
};

/**
 * Test WhatsApp configuration
 */
export const testWhatsAppConfiguration = async (
  organizationId: string,
  phoneNumber: string
): Promise<{ success: boolean; message: string }> => {
  const { data } = await apiClient.post(`/notification-settings/${organizationId}/test-whatsapp`, { phoneNumber });
  return data?.data;
};

/**
 * Check SMS credit balance
 */
export const checkSmsBalance = async (
  organizationId: string
): Promise<{ balance: number; provider: string }> => {
  const { data } = await apiClient.post(`/notification-settings/${organizationId}/check-sms-balance`);
  return data?.data;
};

/**
 * Check WhatsApp credit balance
 */
export const checkWhatsAppBalance = async (
  organizationId: string
): Promise<{ balance: number; provider: string }> => {
  const { data } = await apiClient.post(`/notification-settings/${organizationId}/check-whatsapp-balance`);
  return data?.data;
};


// =============================================
// NOTIFICATION TEMPLATES
// =============================================

/**
 * Get all templates for an organization
 */
export const getTemplates = async (
  organizationId: string,
  channel?: string,
  category?: string
): Promise<NotificationTemplate[]> => {
  const params = new URLSearchParams();
  if (channel) params.append('channel', channel);
  if (category) params.append('category', category);
  
  const queryString = params.toString();
  const url = `/notification-templates/${organizationId}${queryString ? `?${queryString}` : ''}`;
  
  const { data } = await apiClient.get(url);
  return data?.data || [];
};

/**
 * Get a single template
 */
export const getTemplate = async (
  organizationId: string,
  templateId: string
): Promise<NotificationTemplate> => {
  const { data } = await apiClient.get(`/notification-templates/${organizationId}/${templateId}`);
  return data?.data;
};

/**
 * Create a new template
 */
export const createTemplate = async (
  organizationId: string,
  template: Omit<NotificationTemplate, 'id' | 'organizationId' | 'usageCount' | 'createdAt' | 'updatedAt'>
): Promise<NotificationTemplate> => {
  const { data } = await apiClient.post(`/notification-templates/${organizationId}`, template);
  return data?.data;
};

/**
 * Update a template
 */
export const updateTemplate = async (
  organizationId: string,
  templateId: string,
  updates: Partial<NotificationTemplate>
): Promise<NotificationTemplate> => {
  const { data } = await apiClient.put(`/notification-templates/${organizationId}/${templateId}`, updates);
  return data?.data;
};

/**
 * Delete a template
 */
export const deleteTemplate = async (
  organizationId: string,
  templateId: string
): Promise<void> => {
  await apiClient.delete(`/notification-templates/${organizationId}/${templateId}`);
};


// =============================================
// REMINDER RULES
// =============================================

/**
 * Get all reminder rules for an organization
 */
export const getReminderRules = async (organizationId: string): Promise<ReminderRule[]> => {
  const { data } = await apiClient.get(`/reminder-rules/${organizationId}`);
  return data?.data || [];
};

/**
 * Get a single reminder rule
 */
export const getReminderRule = async (
  organizationId: string,
  ruleId: string
): Promise<ReminderRule> => {
  const { data } = await apiClient.get(`/reminder-rules/${organizationId}/${ruleId}`);
  return data?.data;
};

/**
 * Create a new reminder rule
 */
export const createReminderRule = async (
  organizationId: string,
  rule: Omit<ReminderRule, 'id' | 'organizationId' | 'createdAt' | 'updatedAt'>
): Promise<ReminderRule> => {
  const { data } = await apiClient.post(`/reminder-rules/${organizationId}`, rule);
  return data?.data;
};

/**
 * Update a reminder rule
 */
export const updateReminderRule = async (
  organizationId: string,
  ruleId: string,
  updates: Partial<ReminderRule>
): Promise<ReminderRule> => {
  const { data } = await apiClient.put(`/reminder-rules/${organizationId}/${ruleId}`, updates);
  return data?.data;
};

/**
 * Delete a reminder rule
 */
export const deleteReminderRule = async (
  organizationId: string,
  ruleId: string
): Promise<void> => {
  await apiClient.delete(`/reminder-rules/${organizationId}/${ruleId}`);
};


// =============================================
// SMS & EMAIL LOGS
// =============================================

/**
 * Get SMS logs for an organization
 */
export const getSmsLogs = async (
  organizationId: string,
  limit: number = 50,
  offset: number = 0
): Promise<SmsLog[]> => {
  const { data } = await apiClient.get(`/sms-logs/${organizationId}?limit=${limit}&offset=${offset}`);
  return data?.data || [];
};

/**
 * Get email logs for an organization
 */
export const getEmailLogs = async (
  organizationId: string,
  limit: number = 50,
  offset: number = 0
): Promise<EmailLog[]> => {
  const { data } = await apiClient.get(`/email-logs/${organizationId}?limit=${limit}&offset=${offset}`);
  return data?.data || [];
};

/**
 * Get WhatsApp logs for an organization
 */
export const getWhatsAppLogs = async (
  organizationId: string,
  limit: number = 50,
  offset: number = 0
): Promise<WhatsAppLog[]> => {
  const { data } = await apiClient.get(`/whatsapp-logs/${organizationId}?limit=${limit}&offset=${offset}`);
  return data?.data || [];
};