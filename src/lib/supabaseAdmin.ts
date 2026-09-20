import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const getEnv = (key: string, fallbackKey: string = ''): string => {
  return (
    (typeof process !== 'undefined' && process.env && (process.env[key] || (fallbackKey && process.env[fallbackKey]))) ||
    ''
  );
};

let client: SupabaseClient | null = null;

function getClient(): SupabaseClient {
  if (!client) {
    const supabaseUrl = getEnv('SUPABASE_URL', 'VITE_SUPABASE_URL');
    const supabaseServiceRoleKey = getEnv('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      console.warn('[Supabase Admin] Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment');
    }
    client = createClient(supabaseUrl || 'https://placeholder.supabase.co', supabaseServiceRoleKey || 'placeholder-service-key', {
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