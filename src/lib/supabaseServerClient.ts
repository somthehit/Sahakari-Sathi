/**
 * Supabase Server Client (Backend only)
 * Uses the Anon Key to call signInWithPassword (regular auth flows).
 * This is different from supabaseAdmin which uses the Service Role Key.
 */
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('[Supabase Server Client] Missing SUPABASE_URL or SUPABASE_ANON_KEY');
}

/**
 * Regular Supabase client using the Anon Key.
 * Used for: signInWithPassword (password verification)
 */
export const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  }
});
