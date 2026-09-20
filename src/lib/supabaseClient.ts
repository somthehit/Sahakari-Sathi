import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// Retrieve environment variables with fallbacks
function getEnv(key: string, fallbackKey: string = ''): string {
  return (
    (typeof process !== 'undefined' && process.env && process.env[key]) ||
    (typeof import.meta !== 'undefined' && (import.meta as any).env && (import.meta as any).env[fallbackKey]) ||
    ''
  );
}

let client: SupabaseClient | null = null;

function getClient(): SupabaseClient {
  if (!client) {
    const supabaseUrl = getEnv('SUPABASE_URL', 'VITE_SUPABASE_URL');
    const supabaseAnonKey = getEnv('SUPABASE_ANON_KEY', 'VITE_SUPABASE_ANON_KEY');

    if (!supabaseUrl || !supabaseAnonKey) {
      console.warn('[Supabase Client] Missing SUPABASE_URL or SUPABASE_ANON_KEY');
    }
    client = createClient(supabaseUrl || 'https://placeholder.supabase.co', supabaseAnonKey || 'placeholder-anon-key');
  }
  return client;
}

export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    if (typeof prop === 'symbol') return undefined;
    const value = getClient() as any;
    const member = value[prop];
    return typeof member === 'function' ? member.bind(value) : member;
  },
});
