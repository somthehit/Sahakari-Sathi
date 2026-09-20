import { eq, sql } from 'drizzle-orm';
import { getDb } from '../../db/client';
import { systemSettings } from '../../db/schema/platformControl';

export class ApiError extends Error {
  statusCode: number;
  constructor(statusCode: number, message: string) {
    super(message);
    this.statusCode = statusCode;
  }
}

const DEFAULT_SETTINGS: Array<{
  category: string;
  key: string;
  value: string;
  valueType: string;
  label: string;
  description: string;
  isSecret: boolean;
}> = [
  { category: 'general', key: 'platform_name', value: 'Sahakari Sathi', valueType: 'string', label: 'Platform Name', description: 'The display name of the platform', isSecret: false },
  { category: 'general', key: 'platform_version', value: '1.0.0', valueType: 'string', label: 'Platform Version', description: 'Current platform version', isSecret: false },
  { category: 'general', key: 'support_email', value: 'support@sahakarisathi.com', valueType: 'string', label: 'Support Email', description: 'Primary support contact', isSecret: false },
  { category: 'general', key: 'maintenance_mode', value: 'false', valueType: 'boolean', label: 'Maintenance Mode', description: 'Put the platform in maintenance mode', isSecret: false },
  { category: 'database', key: 'db_host', value: '', valueType: 'string', label: 'Database Host', description: 'PostgreSQL host', isSecret: false },
  { category: 'database', key: 'db_port', value: '5432', valueType: 'number', label: 'Database Port', description: 'PostgreSQL port', isSecret: false },
  { category: 'database', key: 'db_name', value: 'postgres', valueType: 'string', label: 'Database Name', description: 'PostgreSQL database name', isSecret: false },
  { category: 'database', key: 'db_pool_size', value: '10', valueType: 'number', label: 'Connection Pool Size', description: 'Max connections per process', isSecret: false },
  { category: 'email', key: 'smtp_host', value: '', valueType: 'string', label: 'SMTP Host', description: 'Outgoing mail server', isSecret: false },
  { category: 'email', key: 'smtp_port', value: '587', valueType: 'number', label: 'SMTP Port', description: 'SMTP port', isSecret: false },
  { category: 'email', key: 'smtp_user', value: '', valueType: 'string', label: 'SMTP Username', description: 'Mail server username', isSecret: false },
  { category: 'email', key: 'smtp_pass', value: '', valueType: 'password', label: 'SMTP Password', description: 'Mail server password', isSecret: true },
  { category: 'email', key: 'smtp_from_name', value: 'Sahakari Sathi', valueType: 'string', label: 'From Name', description: 'Default sender name', isSecret: false },
  { category: 'email', key: 'smtp_from_email', value: 'noreply@sahakarisathi.com', valueType: 'string', label: 'From Email', description: 'Default sender address', isSecret: false },
  { category: 'sms', key: 'sms_provider', value: '', valueType: 'string', label: 'SMS Provider', description: 'SMS gateway provider', isSecret: false },
  { category: 'sms', key: 'sms_api_key', value: '', valueType: 'password', label: 'SMS API Key', description: 'Provider API key', isSecret: true },
  { category: 'sms', key: 'sms_sender_id', value: '', valueType: 'string', label: 'SMS Sender ID', description: 'Registered sender ID', isSecret: false },
  { category: 'branding', key: 'primary_color', value: '#047857', valueType: 'string', label: 'Primary Color', description: 'Platform primary theme color', isSecret: false },
  { category: 'branding', key: 'secondary_color', value: '#059669', valueType: 'string', label: 'Secondary Color', description: 'Complementary accent color for alerts, charts, and secondary buttons', isSecret: false },
  { category: 'branding', key: 'text_color', value: '#1E293B', valueType: 'string', label: 'Text / Dark Color', description: 'Primary text color for headers and body text', isSecret: false },
  { category: 'branding', key: 'logo_url', value: '', valueType: 'string', label: 'App Logo', description: 'Logo used in the app header and navigation (PNG with transparent background)', isSecret: false },
  { category: 'branding', key: 'print_logo_url', value: '', valueType: 'string', label: 'Print / Document Logo', description: 'High-resolution logo for receipts, vouchers, certificates, and PDF exports', isSecret: false },
  { category: 'branding', key: 'favicon_url', value: '', valueType: 'string', label: 'Favicon', description: 'Browser tab icon (ICO or PNG, 32x32 or 64x64)', isSecret: false },
  { category: 'branding', key: 'app_display_name', value: 'Sahakari Sathi', valueType: 'string', label: 'App Display Name', description: 'Platform name shown in the UI header, browser title, and login page', isSecret: false },
  { category: 'branding', key: 'footer_text', value: 'Powered by Sahakari Sathi', valueType: 'string', label: 'Footer Text', description: 'Default footer text shown at the bottom of pages', isSecret: false },
  { category: 'branding', key: 'support_email', value: 'support@sahakarisathi.com', valueType: 'string', label: 'Support Email', description: 'Support contact shown in footer and help pages', isSecret: false },
  { category: 'branding', key: 'support_phone', value: '', valueType: 'string', label: 'Support Phone', description: 'Phone number shown in footer and help pages', isSecret: false },
  { category: 'branding', key: 'login_background_url', value: '', valueType: 'string', label: 'Login Background', description: 'Background image or gradient for the login page', isSecret: false },
  { category: 'security', key: 'session_timeout_minutes', value: '480', valueType: 'number', label: 'Session Timeout', description: 'Minutes before session expires', isSecret: false },
  { category: 'security', key: 'max_login_attempts', value: '5', valueType: 'number', label: 'Max Login Attempts', description: 'Lock account after N failures', isSecret: false },
  { category: 'security', key: 'require_2fa', value: 'false', valueType: 'boolean', label: 'Require 2FA', description: 'Enforce two-factor auth', isSecret: false },
  { category: 'security', key: 'password_min_length', value: '8', valueType: 'number', label: 'Min Password Length', description: 'Minimum password characters', isSecret: false },
];

export class SystemSettingsService {
  async listSettings(category?: string) {
    const db = getDb();
    if (!db) throw new ApiError(500, 'Database not connected');

    const rows = category
      ? await db.select().from(systemSettings).where(eq(systemSettings.category, category))
      : await db.select().from(systemSettings);
    return rows;
  }

  async getSetting(key: string) {
    const db = getDb();
    if (!db) throw new ApiError(500, 'Database not connected');

    const rows = await db.select().from(systemSettings).where(eq(systemSettings.key, key));
    if (rows.length === 0) throw new ApiError(404, `Setting "${key}" not found`);
    return rows[0];
  }

  async getSettingsByCategory(category: string) {
    const db = getDb();
    if (!db) throw new ApiError(500, 'Database not connected');

    return db.select().from(systemSettings).where(eq(systemSettings.category, category));
  }

  async updateSetting(key: string, value: string, updatedBy?: string) {
    const db = getDb();
    if (!db) throw new ApiError(500, 'Database not connected');

    const existing = await db.select().from(systemSettings).where(eq(systemSettings.key, key));
    if (existing.length === 0) throw new ApiError(404, `Setting "${key}" not found`);

    await db.update(systemSettings)
      .set({ value, updatedAt: new Date(), updatedBy: updatedBy ?? null })
      .where(eq(systemSettings.key, key));

    const updated = await db.select().from(systemSettings).where(eq(systemSettings.key, key));
    return updated[0];
  }

  async updateSettings(settings: Array<{ key: string; value: string }>, updatedBy?: string) {
    const db = getDb();
    if (!db) throw new ApiError(500, 'Database not connected');

    const results: Array<{ key: string; success: boolean; error?: string }> = [];

    for (const { key, value } of settings) {
      try {
        const existing = await db.select().from(systemSettings).where(eq(systemSettings.key, key));
        if (existing.length === 0) {
          results.push({ key, success: false, error: `Setting "${key}" not found` });
          continue;
        }
        await db.update(systemSettings)
          .set({ value, updatedAt: new Date(), updatedBy: updatedBy ?? null })
          .where(eq(systemSettings.key, key));
        results.push({ key, success: true });
      } catch (err: any) {
        results.push({ key, success: false, error: err.message });
      }
    }

    return results;
  }

  async getSettingsGrouped() {
    const db = getDb();
    if (!db) throw new ApiError(500, 'Database not connected');

    const rows = await db.select().from(systemSettings).orderBy(systemSettings.category, systemSettings.label);

    const grouped = new Map<string, typeof rows>();
    for (const row of rows) {
      const existing = grouped.get(row.category) || [];
      existing.push(row);
      grouped.set(row.category, existing);
    }

    const categories = ['general', 'database', 'email', 'sms', 'branding', 'security'];
    const result: Array<{ category: string; settings: typeof rows }> = [];

    for (const cat of categories) {
      if (grouped.has(cat)) {
        result.push({ category: cat, settings: grouped.get(cat)! });
      }
    }

    for (const [cat, settings] of grouped) {
      if (!categories.includes(cat)) {
        result.push({ category: cat, settings });
      }
    }

    return result;
  }

  async resetSettings(category?: string) {
    const db = getDb();
    if (!db) throw new ApiError(500, 'Database not connected');

    const toReset = category
      ? DEFAULT_SETTINGS.filter(s => s.category === category)
      : DEFAULT_SETTINGS;

    if (category) {
      await db.delete(systemSettings).where(eq(systemSettings.category, category));
    } else {
      await db.delete(systemSettings);
    }

    for (const setting of toReset) {
      await db.insert(systemSettings).values({
        category: setting.category,
        key: setting.key,
        value: setting.value,
        valueType: setting.valueType,
        label: setting.label,
        description: setting.description,
        isSecret: setting.isSecret,
      });
    }

    return { success: true, count: toReset.length };
  }
}
