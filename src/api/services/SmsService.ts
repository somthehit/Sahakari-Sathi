/**
 * SMS Service
 * Supports Aakash SMS and Sparrow SMS providers
 * Uses per-organization credentials with platform fallback
 */
import { eq } from 'drizzle-orm';
import { getDb } from '../../db/client';
import { smsLogs } from '../../db/schema/notifications';
import { NotificationSettingsService } from './NotificationSettingsService';

export class SmsError extends Error {
  statusCode: number;
  provider: string;
  constructor(statusCode: number, message: string, provider: string) {
    super(message);
    this.statusCode = statusCode;
    this.provider = provider;
  }
}

// =============================================
// SMS PROVIDER INTERFACES
// =============================================

interface SmsProvider {
  name: string;
  send(to: string, message: string, senderId: string, apiKey: string): Promise<SmsResult>;
  checkBalance(apiKey: string): Promise<number>;
}

interface SmsResult {
  success: boolean;
  messageId?: string;
  error?: string;
  balance?: number;
}

// =============================================
// AAKASH SMS PROVIDER
// =============================================

class AakashSmsProvider implements SmsProvider {
  name = 'aakash';
  
  private baseUrl = 'https://api.aakashsms.com/smsapi/v1';
  
  async send(to: string, message: string, senderId: string, apiKey: string): Promise<SmsResult> {
    try {
      const url = `${this.baseUrl}/send`;
      const params = new URLSearchParams({
        token: apiKey,
        recipient: to,
        sender: senderId,
        message: message,
      });

      const response = await fetch(`${url}?${params.toString()}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();
      
      if (response.ok && data.status === 'ok') {
        return {
          success: true,
          messageId: data.id || undefined,
          balance: data.balance,
        };
      } else {
        return {
          success: false,
          error: data.message || 'Aakash SMS send failed',
        };
      }
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Aakash SMS connection error',
      };
    }
  }

  async checkBalance(apiKey: string): Promise<number> {
    try {
      const url = `${this.baseUrl}/balance`;
      const params = new URLSearchParams({ token: apiKey });

      const response = await fetch(`${url}?${params.toString()}`, {
        method: 'GET',
      });

      const data = await response.json();
      
      if (response.ok && data.status === 'ok') {
        return parseInt(data.balance || '0');
      }
      
      return 0;
    } catch (error) {
      return 0;
    }
  }
}

// =============================================
// SPARROW SMS PROVIDER
// =============================================

class SparrowSmsProvider implements SmsProvider {
  name = 'sparrow';
  
  private baseUrl = 'https://sms.sparrowsms.com/v2/sms/send';
  
  async send(to: string, message: string, senderId: string, apiKey: string): Promise<SmsResult> {
    try {
      const response = await fetch(this.baseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          token: apiKey,
          to: to,
          from: senderId,
          sms: message,
        }),
      });

      const data = await response.json();
      
      if (response.ok && data.status === 200) {
        return {
          success: true,
          messageId: data.message_id || undefined,
          balance: data.balance,
        };
      } else {
        return {
          success: false,
          error: data.message || 'Sparrow SMS send failed',
        };
      }
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Sparrow SMS connection error',
      };
    }
  }

  async checkBalance(apiKey: string): Promise<number> {
    try {
      const response = await fetch('https://sms.sparrowsms.com/v2/balance', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({ token: apiKey }),
      });

      const data = await response.json();
      
      if (response.ok && data.status === 200) {
        return data.balance || 0;
      }
      
      return 0;
    } catch (error) {
      return 0;
    }
  }
}


// =============================================
// SMS SERVICE
// =============================================

export class SmsService {
  private providers: Map<string, SmsProvider>;
  private settingsService: NotificationSettingsService;

  constructor() {
    this.providers = new Map();
    this.providers.set('aakash', new AakashSmsProvider());
    this.providers.set('sparrow', new SparrowSmsProvider());
    this.settingsService = new NotificationSettingsService();
  }

  /**
   * Send SMS to a recipient
   */
  async sendSms(
    organizationId: string,
    to: string,
    message: string,
    templateCode?: string
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    const db = getDb();
    if (!db) throw new SmsError(500, 'Database not connected', 'system');

    // Get effective credentials for this organization
    const credentials = await this.settingsService.getEffectiveSmsCredentials(organizationId);
    
    if (!credentials.apiKey) {
      // Log failed attempt
      await this.logSms(organizationId, {
        toPhone: to,
        body: message,
        templateCode,
        status: 'Failed',
        provider: credentials.provider,
        errorMessage: 'SMS API key not configured',
      });
      
      return {
        success: false,
        error: 'SMS API key not configured. Please configure SMS settings or enable platform credentials.',
      };
    }

    // Get the provider
    const provider = this.providers.get(credentials.provider);
    if (!provider) {
      await this.logSms(organizationId, {
        toPhone: to,
        body: message,
        templateCode,
        status: 'Failed',
        provider: credentials.provider,
        errorMessage: `Unsupported SMS provider: ${credentials.provider}`,
      });
      
      return {
        success: false,
        error: `Unsupported SMS provider: ${credentials.provider}`,
      };
    }

    // Send SMS
    const result = await provider.send(to, message, credentials.senderId, credentials.apiKey);

    // Log the SMS
    await this.logSms(organizationId, {
      toPhone: to,
      body: message,
      templateCode,
      status: result.success ? 'Sent' : 'Failed',
      provider: credentials.provider,
      providerMessageId: result.messageId,
      errorMessage: result.error,
    });

    // Update credit balance if provided
    if (result.balance !== undefined) {
      await this.settingsService.updateSmsCreditBalance(organizationId, result.balance);
    }

    return {
      success: result.success,
      messageId: result.messageId,
      error: result.error,
    };
  }

  /**
   * Send OTP SMS for verification
   */
  async sendOtpSms(
    organizationId: string,
    to: string,
    otpCode: string,
    purpose: string = 'verification'
  ): Promise<{ success: boolean; error?: string }> {
    const message = `Your Sahakari Sathi security OTP for ${purpose} is ${otpCode}. Valid for 5 minutes. Do not share this code with anyone.`;
    
    return this.sendSms(organizationId, to, message, 'OTP_VERIFICATION');
  }

  /**
   * Send transaction alert SMS
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
    const message = `Dear ${memberName}, NPR ${amount.toLocaleString()} ${transactionType} on account ${accountNo}. Balance: NPR ${balance.toLocaleString()}. - SAHAKARI SATHI`;
    
    return this.sendSms(organizationId, to, message, 'TRANSACTION_ALERT');
  }

  /**
   * Send loan EMI reminder SMS
   */
  async sendEmiReminder(
    organizationId: string,
    to: string,
    memberName: string,
    emiAmount: number,
    dueDate: string
  ): Promise<{ success: boolean; error?: string }> {
    const message = `Dear ${memberName}, loan EMI of NPR ${emiAmount.toLocaleString()} is due on ${dueDate}. Please deposit in time to avoid penalty.`;
    
    return this.sendSms(organizationId, to, message, 'EMI_REMINDER');
  }

  /**
   * Check SMS balance for an organization
   */
  async checkBalance(organizationId: string): Promise<{ balance: number; provider: string }> {
    const credentials = await this.settingsService.getEffectiveSmsCredentials(organizationId);
    
    if (!credentials.apiKey) {
      return { balance: 0, provider: credentials.provider };
    }

    const provider = this.providers.get(credentials.provider);
    if (!provider) {
      return { balance: 0, provider: credentials.provider };
    }

    const balance = await provider.checkBalance(credentials.apiKey);
    
    // Update balance in database
    await this.settingsService.updateSmsCreditBalance(organizationId, balance);
    
    return { balance, provider: credentials.provider };
  }

  /**
   * Log SMS to database
   */
  private async logSms(organizationId: string, data: {
    toPhone: string;
    body: string;
    templateCode?: string;
    status: 'Pending' | 'Sent' | 'Failed' | 'Delivered';
    provider: string;
    providerMessageId?: string;
    errorMessage?: string;
  }) {
    const db = getDb();
    if (!db) return;

    try {
      await db.insert(smsLogs).values({
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
      console.error('Failed to log SMS:', error);
    }
  }

  /**
   * Get SMS logs for an organization
   */
  async getSmsLogs(organizationId: string, limit: number = 50, offset: number = 0) {
    const db = getDb();
    if (!db) throw new SmsError(500, 'Database not connected', 'system');

    return db.select()
      .from(smsLogs)
      .where(eq(smsLogs.organizationId, organizationId))
      .limit(limit)
      .offset(offset);
  }
}