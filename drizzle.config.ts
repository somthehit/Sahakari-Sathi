import { defineConfig } from 'drizzle-kit';

/**
 * Drizzle Kit Configuration
 *
 * Two URLs are used:
 *  - DATABASE_URL          → Transaction Pooler (port 6543) — used by the app at runtime
 *  - DATABASE_DIRECT_URL   → Direct connection  (port 5432) — used by drizzle-kit for migrations/introspection
 *
 * Set DATABASE_DIRECT_URL in .env:
 *   DATABASE_DIRECT_URL=postgresql://postgres:<PASSWORD>@db.<PROJECT_REF>.supabase.co:5432/postgres
 *
 * drizzle-kit generate / migrate / push all go through the direct connection.
 * The app server continues to use DATABASE_URL (pooler).
 */
export default defineConfig({
  dialect: 'postgresql',
  schema: './src/db/schema/index.ts',
  out: './supabase/migrations',
  dbCredentials: {
    // Prefer direct connection for kit commands; fall back to pooler if not set
    url: process.env.DATABASE_DIRECT_URL ?? process.env.DATABASE_URL!,
  },
});
