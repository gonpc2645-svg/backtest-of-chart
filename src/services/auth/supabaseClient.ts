import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL || '').trim();
const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim();

const isValidHttpUrl = (value: string): boolean => {
  if (!value) return false;
  try {
    const parsed = new URL(value);
    return (
      (parsed.protocol === 'https:' || parsed.protocol === 'http:') &&
      !value.includes('your-project-id')
    );
  } catch {
    return false;
  }
};

export const isSupabaseConfigured: boolean =
  isValidHttpUrl(supabaseUrl) &&
  Boolean(supabaseAnonKey) &&
  !supabaseAnonKey.includes('your-supabase-anon-public-key');

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
        flowType: 'pkce',
      },
    })
  : null;
