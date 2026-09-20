import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// Backend-only Supabase Client (bypasses RLS using Service Role Key)
const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

let client: SupabaseClient | null = null;

function getClient(): SupabaseClient {
  if (!client) {
    if (!supabaseUrl || !supabaseServiceRoleKey) {
      console.warn('[Supabase Admin] Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment');
    }
    client = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });
  }
  return client;
}

/**
 * Lazily-initialized admin client. `createClient` runs only on first real
 * property access, so importing this module never throws in environments
 * without credentials (e.g. unit tests). Server calls get the full client.
 */
export const supabaseAdmin = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    if (typeof prop === 'symbol') return undefined;
    const value = getClient() as any;
    const member = value[prop];
    return typeof member === 'function' ? member.bind(value) : member;
  },
});