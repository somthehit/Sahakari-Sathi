import { getDb } from './client';
import { sql } from 'drizzle-orm';

/**
 * Ensures security_questions and user_security_answers tables exist,
 * and seeds default global questions if the table is empty.
 */
export async function initSecurityQuestions(): Promise<void> {
  const db = getDb();
  if (!db) return;

  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS security_questions (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
        question_text text NOT NULL,
        is_active boolean NOT NULL DEFAULT true,
        created_at timestamp NOT NULL DEFAULT now()
      )
    `);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS user_security_answers (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id uuid NOT NULL REFERENCES org_users(id) ON DELETE CASCADE,
        question_id uuid NOT NULL REFERENCES security_questions(id) ON DELETE CASCADE,
        encrypted_answer text NOT NULL,
        created_at timestamp NOT NULL DEFAULT now(),
        updated_at timestamp NOT NULL DEFAULT now()
      )
    `);

    // Ensure org_users has avatar_url column
    await db.execute(sql`
      DO $$ BEGIN
        ALTER TABLE org_users ADD COLUMN IF NOT EXISTS avatar_url text;
      EXCEPTION WHEN duplicate_column THEN null;
      END $$;
    `);

    const [row] = await db.execute(sql`SELECT COUNT(*)::int AS cnt FROM security_questions`);
    const count = Number((row as any)?.cnt ?? 0);
    if (count > 0) return;

    console.log('[DB] Seeding default security questions...');
    await db.execute(sql`
      INSERT INTO security_questions (id, organization_id, question_text, is_active, created_at)
      VALUES
        (gen_random_uuid(), NULL, 'What is your mother''s maiden name?', true, NOW()),
        (gen_random_uuid(), NULL, 'What was the name of your first pet?', true, NOW()),
        (gen_random_uuid(), NULL, 'What city were you born in?', true, NOW()),
        (gen_random_uuid(), NULL, 'What is the name of your first school?', true, NOW()),
        (gen_random_uuid(), NULL, 'What was your childhood nickname?', true, NOW()),
        (gen_random_uuid(), NULL, 'What is your favorite food?', true, NOW()),
        (gen_random_uuid(), NULL, 'What was the make of your first car?', true, NOW()),
        (gen_random_uuid(), NULL, 'What is your father''s middle name?', true, NOW()),
        (gen_random_uuid(), NULL, 'In what year did you graduate from high school?', true, NOW()),
        (gen_random_uuid(), NULL, 'What is the name of the street you grew up on?', true, NOW())
    `);
    console.log('[DB] 10 default security questions seeded.');
  } catch (err: any) {
    console.error('[DB] Security questions init failed (non-fatal):', err?.message || err);
  }
}
