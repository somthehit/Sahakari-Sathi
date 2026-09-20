-- ============================================================
-- SEED DATA
-- Run AFTER migration completes: npm run db:migrate
-- These are auth.users entries (Supabase Auth schema)
-- Safe to re-run — uses ON CONFLICT DO NOTHING
-- ============================================================

-- Auth users (Supabase manages auth.users schema)
INSERT INTO "auth"."users" (
  "instance_id", "id", "aud", "role", "email", "encrypted_password",
  "email_confirmed_at", "invited_at", "confirmation_token", "confirmation_sent_at",
  "recovery_token", "recovery_sent_at", "email_change_token_new", "email_change",
  "email_change_sent_at", "last_sign_in_at", "raw_app_meta_data", "raw_user_meta_data",
  "is_super_admin", "created_at", "updated_at", "phone", "phone_confirmed_at",
  "phone_change", "phone_change_token", "phone_change_sent_at", "confirmed_at",
  "email_change_token_current", "email_change_confirm_status", "banned_until",
  "reauthentication_token", "reauthentication_sent_at", "is_sso_user", "deleted_at", "is_anonymous"
) VALUES
  (
    '00000000-0000-0000-0000-000000000000',
    '62b806dc-16c9-4ca1-92a6-4217d4f161a4',
    'authenticated', 'authenticated',
    'admin@softlab.sahakarisathi.internal',
    '$2a$10$B../9.FUyYXBRfwoE6tPSO2clynKKgmDC1PLPCA4ExDedwYJv/k3i',
    '2026-08-01 04:24:48.646359+00', null, '', null, '', null, '', '', null,
    '2026-08-01 23:49:43.850891+00',
    '{"provider": "email", "providers": ["email"]}',
    '{"email_verified": true}',
    null,
    '2026-08-01 04:24:48.626798+00',
    '2026-08-01 23:49:43.87017+00',
    null, null, '', '', null,
    '2026-08-01 04:24:48.646359+00',
    '', 0, null, '', null, false, null, false
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '6bfd38a3-3b15-49c3-94e8-e4d7bdedeb83',
    'authenticated', 'authenticated',
    'superadmin@system.sahakarisathi.internal',
    '$2a$10$3fyz2idiPbQ4oA9i506l1OU06hPT9uFMgv8/bxL6/bNSGfT67cUp2',
    '2026-08-01 05:40:24.609629+00', null, '', null, '', null, '', '', null,
    '2026-08-02 01:25:34.669069+00',
    '{"provider": "email", "providers": ["email"]}',
    '{"email_verified": true}',
    null,
    '2026-08-01 05:40:24.594584+00',
    '2026-08-02 01:25:34.729371+00',
    null, null, '', '', null,
    '2026-08-01 05:40:24.609629+00',
    '', 0, null, '', null, false, null, false
  )
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- After migration, also seed:
-- 1. super_admins table entry for superadmin@system...
-- 2. organizations → SOFTLAB
-- 3. org_users → admin for SOFTLAB
-- ============================================================

-- Super Admin (platform level)
INSERT INTO "public"."super_admins" (
  "id", "auth_user_id", "username", "email", "full_name", "status", "created_at", "updated_at"
) VALUES (
  gen_random_uuid(),
  '6bfd38a3-3b15-49c3-94e8-e4d7bdedeb83',
  'superadmin',
  'superadmin@system.sahakarisathi.internal',
  'Super Administrator',
  'Active',
  now(), now()
) ON CONFLICT (auth_user_id) DO NOTHING;
