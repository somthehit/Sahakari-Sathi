-- Migration: Add expanded branding settings
-- Seeds new branding keys if they don't already exist

INSERT INTO system_settings (category, key, value, value_type, label, description, is_secret)
VALUES
  ('branding', 'secondary_color', '#059669', 'string', 'Secondary Color', 'Complementary accent color for alerts, charts, and secondary buttons', false),
  ('branding', 'text_color', '#1E293B', 'string', 'Text / Dark Color', 'Primary text color for headers and body text', false),
  ('branding', 'print_logo_url', '', 'string', 'Print / Document Logo', 'High-resolution logo for receipts, vouchers, certificates, and PDF exports', false),
  ('branding', 'app_display_name', 'Sahakari Sathi', 'string', 'App Display Name', 'Platform name shown in the UI header, browser title, and login page', false),
  ('branding', 'support_email', 'support@sahakarisathi.com', 'string', 'Support Email', 'Support contact shown in footer and help pages', false),
  ('branding', 'support_phone', '', 'string', 'Support Phone', 'Phone number shown in footer and help pages', false),
  ('branding', 'login_background_url', '', 'string', 'Login Background', 'Background image or gradient for the login page', false)
ON CONFLICT (key) DO NOTHING;

-- Rename existing logo_url to app_display_name label for clarity
UPDATE system_settings SET label = 'App Logo', description = 'Logo used in the app header and navigation (PNG with transparent background)' WHERE key = 'logo_url';
UPDATE system_settings SET label = 'Favicon', description = 'Browser tab icon (ICO or PNG, 32x32 or 64x64)' WHERE key = 'favicon_url';
