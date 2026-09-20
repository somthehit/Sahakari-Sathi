/**
 * Enhanced Email Service
 * Supports per-organization SMTP credentials with platform fallback
 * Uses Nodemailer for SMTP delivery
 */
import nodemailer from 'nodemailer';
import { eq } from 'drizzle-orm';
import { getDb } from '../db/client';
import { emailLogs } from '../db/schema/notifications';
import { NotificationSettingsService } from '../api/services/NotificationSettingsService';

const APP_URL = process.env.APP_URL || 'https://app.sahakarisathi.com';

// =============================================
// EMAIL SERVICE
// =============================================

export class EmailService {
  private settingsService: NotificationSettingsService;

  constructor() {
    this.settingsService = new NotificationSettingsService();
  }

  /**
   * Create a transporter with organization-specific or platform credentials
   */
  private async createTransporter(organizationId?: string) {
    let config;
    
    if (organizationId) {
      // Get effective credentials for this organization
      config = await this.settingsService.getEffectiveEmailCredentials(organizationId);
    } else {
      // Use environment variables (for platform-level emails like welcome)
      config = {
        host: process.env.SMTP_HOST || '',
        port: parseInt(process.env.SMTP_PORT || '587'),
        user: process.env.SMTP_USER || '',
        pass: process.env.SMTP_PASS || '',
        fromName: process.env.SMTP_FROM_NAME || 'Sahakari Sathi',
        fromEmail: process.env.SMTP_USER || 'noreply@sahakarisathi.com',
        secure: parseInt(process.env.SMTP_PORT || '587') === 465,
        isPlatform: true,
      };
    }

    if (!config.host || !config.user || !config.pass) {
      return null; // No SMTP config available
    }

    return {
      transport: nodemailer.createTransport({
        host: config.host,
        port: config.port,
        secure: config.secure,
        auth: {
          user: config.user,
          pass: config.pass,
        },
      }),
      fromName: config.fromName,
      fromEmail: config.fromEmail,
      isPlatform: config.isPlatform,
    };
  }

  /**
   * Send an email
   */
  async sendEmail(
    organizationId: string,
    to: string | string[],
    subject: string,
    html: string,
    text?: string,
    options?: {
      templateCode?: string;
      cc?: string | string[];
      bcc?: string | string[];
      attachments?: Array<{ filename: string; content: Buffer | string }>;
    }
  ): Promise<{ success: boolean; error?: string; messageId?: string }> {
    const db = getDb();
    
    const transporterConfig = await this.createTransporter(organizationId);
    
    if (!transporterConfig) {
      // Log failed attempt
      await this.logEmail(organizationId, {
        toEmail: Array.isArray(to) ? to.join(', ') : to,
        subject,
        body: html,
        status: 'Failed',
        errorMessage: 'SMTP not configured',
        templateCode: options?.templateCode,
      });
      
      return {
        success: false,
        error: 'SMTP not configured. Please configure email settings or enable platform credentials.',
      };
    }

    try {
      const recipients = Array.isArray(to) ? to.join(', ') : to;
      
      const result = await transporterConfig.transport.sendMail({
        from: `"${transporterConfig.fromName}" <${transporterConfig.fromEmail}>`,
        to: recipients,
        subject,
        html,
        text: text || this.htmlToText(html),
        cc: options?.cc,
        bcc: options?.bcc,
        attachments: options?.attachments,
      });

      // Log successful email
      await this.logEmail(organizationId, {
        toEmail: recipients,
        subject,
        body: html,
        status: 'Sent',
        templateCode: options?.templateCode,
        metadata: {
          messageId: result.messageId,
          isPlatform: transporterConfig.isPlatform,
        },
      });

      return {
        success: true,
        messageId: result.messageId,
      };
    } catch (error: any) {
      // Log failed email
      await this.logEmail(organizationId, {
        toEmail: Array.isArray(to) ? to.join(', ') : to,
        subject,
        body: html,
        status: 'Failed',
        errorMessage: error.message,
        templateCode: options?.templateCode,
      });

      return {
        success: false,
        error: error.message || 'Email delivery failed',
      };
    }
  }

  /**
   * Send a transaction alert email
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
    const subject = `Transaction Alert - NPR ${amount.toLocaleString()} ${transactionType}`;
    
    const html = `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="font-family: Arial, sans-serif; background: #f1f5f9; padding: 20px;">
  <div style="max-width: 500px; margin: 0 auto; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
    <div style="background: #047857; padding: 20px; text-align: center;">
      <h1 style="color: white; margin: 0; font-size: 18px;">Transaction Alert</h1>
    </div>
    <div style="padding: 24px;">
      <p style="margin: 0 0 16px; color: #334155;">Dear ${memberName},</p>
      <p style="margin: 0 0 16px; color: #334155;">A ${transactionType.toLowerCase()} has been made on your account.</p>
      
      <table style="width: 100%; background: #f8fafc; border-radius: 8px; padding: 16px; margin-bottom: 16px;">
        <tr>
          <td style="color: #64748b; padding: 4px 0;">Amount</td>
          <td style="color: #047857; font-weight: bold; text-align: right; padding: 4px 0;">NPR ${amount.toLocaleString()}</td>
        </tr>
        <tr>
          <td style="color: #64748b; padding: 4px 0;">Account</td>
          <td style="color: #334155; text-align: right; padding: 4px 0;">${accountNo}</td>
        </tr>
        <tr>
          <td style="color: #64748b; padding: 4px 0;">Balance</td>
          <td style="color: #334155; font-weight: bold; text-align: right; padding: 4px 0;">NPR ${balance.toLocaleString()}</td>
        </tr>
      </table>
      
      <p style="margin: 0; color: #94a3b8; font-size: 12px;">- SAHAKARI SATHI</p>
    </div>
  </div>
</body>
</html>`;

    return this.sendEmail(organizationId, to, subject, html, undefined, {
      templateCode: 'TRANSACTION_ALERT',
    });
  }

  /**
   * Send a loan EMI reminder email
   */
  async sendEmiReminder(
    organizationId: string,
    to: string,
    memberName: string,
    emiAmount: number,
    dueDate: string,
    loanAccountNo: string
  ): Promise<{ success: boolean; error?: string }> {
    const subject = `EMI Due Reminder - NPR ${emiAmount.toLocaleString()} due on ${dueDate}`;
    
    const html = `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="font-family: Arial, sans-serif; background: #f1f5f9; padding: 20px;">
  <div style="max-width: 500px; margin: 0 auto; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
    <div style="background: #f59e0b; padding: 20px; text-align: center;">
      <h1 style="color: white; margin: 0; font-size: 18px;">EMI Due Reminder</h1>
    </div>
    <div style="padding: 24px;">
      <p style="margin: 0 0 16px; color: #334155;">Dear ${memberName},</p>
      <p style="margin: 0 0 16px; color: #334155;">This is a reminder that your loan EMI is due soon.</p>
      
      <table style="width: 100%; background: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; padding: 16px; margin-bottom: 16px;">
        <tr>
          <td style="color: #92400e; padding: 4px 0;">EMI Amount</td>
          <td style="color: #92400e; font-weight: bold; text-align: right; padding: 4px 0;">NPR ${emiAmount.toLocaleString()}</td>
        </tr>
        <tr>
          <td style="color: #92400e; padding: 4px 0;">Due Date</td>
          <td style="color: #92400e; font-weight: bold; text-align: right; padding: 4px 0;">${dueDate}</td>
        </tr>
        <tr>
          <td style="color: #92400e; padding: 4px 0;">Loan Account</td>
          <td style="color: #92400e; text-align: right; padding: 4px 0;">${loanAccountNo}</td>
        </tr>
      </table>
      
      <p style="margin: 0 0 16px; color: #dc2626; font-size: 13px;"><strong>Please deposit in time to avoid late payment penalty.</strong></p>
      
      <p style="margin: 0; color: #94a3b8; font-size: 12px;">- SAHAKARI SATHI</p>
    </div>
  </div>
</body>
</html>`;

    return this.sendEmail(organizationId, to, subject, html, undefined, {
      templateCode: 'EMI_REMINDER',
    });
  }

  /**
   * Send OTP verification email
   */
  async sendOtpEmail(
    organizationId: string,
    to: string,
    memberName: string,
    otpCode: string,
    purpose: string = 'verification'
  ): Promise<{ success: boolean; error?: string }> {
    const subject = `Your Sahakari Sathi Security Code`;
    
    const html = `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="font-family: Arial, sans-serif; background: #f1f5f9; padding: 20px;">
  <div style="max-width: 500px; margin: 0 auto; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
    <div style="background: #047857; padding: 20px; text-align: center;">
      <h1 style="color: white; margin: 0; font-size: 18px;">Security Code</h1>
    </div>
    <div style="padding: 24px; text-align: center;">
      <p style="margin: 0 0 16px; color: #334155;">Dear ${memberName},</p>
      <p style="margin: 0 0 24px; color: #334155;">Your security code for ${purpose} is:</p>
      
      <div style="background: #f8fafc; border: 2px dashed #047857; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
        <span style="font-size: 32px; font-weight: bold; color: #047857; letter-spacing: 4px; font-family: monospace;">${otpCode}</span>
      </div>
      
      <p style="margin: 0 0 16px; color: #dc2626; font-size: 13px;"><strong>This code expires in 5 minutes.</strong></p>
      <p style="margin: 0; color: #94a3b8; font-size: 12px;">Do not share this code with anyone.</p>
    </div>
  </div>
</body>
</html>`;

    return this.sendEmail(organizationId, to, subject, html, undefined, {
      templateCode: 'OTP_VERIFICATION',
    });
  }

  /**
   * Send welcome email to organization admin
   */
  async sendWelcomeEmail(data: {
    organizationName: string;
    organizationCode: string;
    username: string;
    temporaryPassword: string;
    adminEmail: string;
    adminFullName: string;
  }): Promise<{ success: boolean; error?: string }> {
    const transporterConfig = await this.createTransporter();
    
    if (!transporterConfig) {
      // Dev mode - log to console
      console.log('\n📧 [Email Dev Mode] Welcome Email:');
      console.log('  To:', data.adminEmail);
      console.log('  Subject: Welcome to Sahakari Sathi');
      return { success: true };
    }

    const subject = `Welcome to Sahakari Sathi — ${data.organizationName} Admin Credentials`;
    
    const html = `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="font-family: Arial, sans-serif; background: #f1f5f9; padding: 20px;">
  <div style="max-width: 560px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.08);">
    <div style="background: #047857; padding: 32px 40px; text-align: center;">
      <h1 style="color: white; margin: 0; font-size: 22px;">Sahakari Sathi</h1>
      <p style="color: #a7f3d0; margin: 6px 0 0; font-size: 13px;">Cooperative Management Platform</p>
    </div>
    <div style="padding: 36px 40px;">
      <h2 style="margin: 0 0 8px; color: #0f172a; font-size: 18px;">Welcome, ${data.adminFullName}!</h2>
      <p style="margin: 0 0 24px; color: #475569; font-size: 14px; line-height: 1.6;">
        Your administrator account for <strong>${data.organizationName}</strong> has been created.
      </p>
      
      <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 20px; margin-bottom: 24px;">
        <p style="margin: 0 0 14px; font-size: 12px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.8px;">Login Credentials</p>
        <table style="width: 100%;">
          <tr>
            <td style="font-size: 12px; color: #64748b; padding: 4px 0;">Organization</td>
            <td style="font-size: 14px; color: #0f172a; font-weight: 600; text-align: right; padding: 4px 0;">${data.organizationName}</td>
          </tr>
          <tr>
            <td style="font-size: 12px; color: #64748b; padding: 4px 0;">Username</td>
            <td style="font-size: 13px; color: #0f172a; font-weight: 600; text-align: right; padding: 4px 0; font-family: monospace;">${data.username}</td>
          </tr>
          <tr>
            <td style="font-size: 12px; color: #64748b; padding: 4px 0;">Password</td>
            <td style="font-size: 13px; color: #0f172a; font-weight: 600; text-align: right; padding: 4px 0; font-family: monospace;">${data.temporaryPassword}</td>
          </tr>
        </table>
      </div>
      
      <div style="text-align: center; margin-bottom: 24px;">
        <a href="${APP_URL}" style="display: inline-block; background: #047857; color: white; text-decoration: none; font-size: 14px; font-weight: 700; padding: 14px 36px; border-radius: 8px;">
          Login to Dashboard →
        </a>
      </div>
      
      <div style="background: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
        <p style="margin: 0 0 8px; font-size: 12px; font-weight: 700; color: #92400e; text-transform: uppercase;">⚠ Security Instructions</p>
        <ul style="margin: 0; padding-left: 18px; color: #78350f; font-size: 13px; line-height: 1.8;">
          <li>Change this password on first login</li>
          <li>Choose a strong password (8+ chars, uppercase, number, special character)</li>
          <li>Never share your credentials with anyone</li>
          <li>Enable Two-Factor Authentication after first login</li>
        </ul>
      </div>
    </div>
    <div style="background: #f8fafc; border-top: 1px solid #e2e8f0; padding: 20px 40px; text-align: center;">
      <p style="margin: 0; color: #94a3b8; font-size: 12px;">
        This is an automated message from Sahakari Sathi. Please do not reply.
      </p>
    </div>
  </div>
</body>
</html>`;

    try {
      await transporterConfig.transport.sendMail({
        from: `"${transporterConfig.fromName}" <${transporterConfig.fromEmail}>`,
        to: `"${data.adminFullName}" <${data.adminEmail}>`,
        subject,
        html,
      });

      return { success: true };
    } catch (error: any) {
      console.error('[Email] Failed to send welcome email:', error?.message);
      return { success: false, error: error?.message || 'SMTP delivery failed' };
    }
  }

  /**
   * Test email configuration for an organization
   */
  async testConfiguration(organizationId: string, testEmail: string): Promise<{ success: boolean; error?: string }> {
    const subject = 'Sahakari Sathi - Email Configuration Test';
    const html = `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="font-family: Arial, sans-serif; background: #f1f5f9; padding: 20px;">
  <div style="max-width: 500px; margin: 0 auto; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
    <div style="background: #047857; padding: 20px; text-align: center;">
      <h1 style="color: white; margin: 0; font-size: 18px;">Email Configuration Test</h1>
    </div>
    <div style="padding: 24px; text-align: center;">
      <p style="margin: 0 0 16px; color: #334155;">✅ Your email configuration is working correctly!</p>
      <p style="margin: 0; color: #94a3b8; font-size: 12px;">This is a test email from Sahakari Sathi.</p>
    </div>
  </div>
</body>
</html>`;

    return this.sendEmail(organizationId, testEmail, subject, html, undefined, {
      templateCode: 'CONFIG_TEST',
    });
  }

  /**
   * Log email to database
   */
  private async logEmail(organizationId: string, data: {
    toEmail: string;
    subject: string;
    body: string;
    status: 'Pending' | 'Sent' | 'Failed' | 'Bounced';
    errorMessage?: string;
    templateCode?: string;
    metadata?: any;
  }) {
    const db = getDb();
    if (!db) return;

    try {
      await db.insert(emailLogs).values({
        organizationId,
        toEmail: data.toEmail,
        subject: data.subject,
        body: data.body,
        status: data.status,
        errorMessage: data.errorMessage,
        templateCode: data.templateCode,
        metadata: data.metadata,
        sentAt: data.status === 'Sent' ? new Date() : null,
      });
    } catch (error) {
      console.error('Failed to log email:', error);
    }
  }

  /**
   * Get email logs for an organization
   */
  async getEmailLogs(organizationId: string, limit: number = 50, offset: number = 0) {
    const db = getDb();
    if (!db) throw new Error('Database not connected');

    return db.select()
      .from(emailLogs)
      .where(eq(emailLogs.organizationId, organizationId))
      .limit(limit)
      .offset(offset);
  }

  /**
   * Simple HTML to text conversion
   */
  private htmlToText(html: string): string {
    return html
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }
}

// Export singleton instance
export const emailService = new EmailService();

// Keep the original function for backward compatibility
export async function sendWelcomeEmail(data: WelcomeEmailData): Promise<{ ok: boolean; error?: string }> {
  const service = new EmailService();
  const result = await service.sendWelcomeEmail(data);
  return { ok: result.success, error: result.error };
}

export interface WelcomeEmailData {
  organizationName: string;
  organizationCode: string;
  username: string;
  temporaryPassword: string;
  adminEmail: string;
  adminFullName: string;
}