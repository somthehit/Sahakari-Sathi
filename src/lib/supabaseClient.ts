import { createClient } from '@supabase/supabase-js';

// Retrieve environment variables with fallbacks
function getEnv(key: string, fallbackKey: string = ''): string {
  return (
    (typeof process !== 'undefined' && process.env && process.env[key]) ||
    (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env[fallbackKey]) ||
    ''
  );
}

const supabaseUrl = getEnv('SUPABASE_URL', 'VITE_SUPABASE_URL');
const supabaseAnonKey = getEnv('SUPABASE_ANON_KEY', 'VITE_SUPABASE_ANON_KEY');

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('[Supabase Client] Missing SUPABASE_URL or SUPABASE_ANON_KEY');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
