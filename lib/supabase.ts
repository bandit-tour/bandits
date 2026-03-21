import { createClient } from '@supabase/supabase-js';
import Constants from 'expo-constants';

import { Database } from './database.types';

/**
 * Read Supabase URL/key from:
 * 1) process.env (Expo inlines EXPO_PUBLIC_* from .env at bundle time)
 * 2) app.json / app.config extra (useful for EAS if you mirror keys there)
 */
function readEnv(key: string): string | undefined {
  const fromProcess = process.env[key];
  if (typeof fromProcess === 'string' && fromProcess.trim().length > 0) {
    return fromProcess.trim();
  }
  const extra = Constants.expoConfig?.extra as Record<string, string> | undefined;
  const fromExtra = extra?.[key];
  if (typeof fromExtra === 'string' && fromExtra.trim().length > 0) {
    return fromExtra.trim();
  }
  return undefined;
}

const supabaseUrl = readEnv('EXPO_PUBLIC_SUPABASE_URL');
const supabaseAnonKey = readEnv('EXPO_PUBLIC_SUPABASE_ANON_KEY');

/** True when both URL and anon key are present (login can work). */
export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

if (__DEV__) {
  let urlHost = '(missing)';
  if (supabaseUrl) {
    try {
      urlHost = new URL(supabaseUrl).host;
    } catch {
      urlHost = '(invalid URL)';
    }
  }
  console.log('[supabase] configured:', isSupabaseConfigured, {
    urlHost,
    hasAnonKey: !!supabaseAnonKey,
  });
}

if (!isSupabaseConfigured) {
  console.error(
    '[supabase] Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY. Add them to .env or expo.extra.',
  );
}

/**
 * Real Supabase client. If env is missing, client still exists but auth/network calls will fail
 * with clear errors instead of crashing on undefined methods (see previous stub).
 */
export const supabase = createClient<Database>(
  supabaseUrl ?? 'https://placeholder.invalid',
  supabaseAnonKey ?? 'placeholder-anon-key',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
    },
  },
);
