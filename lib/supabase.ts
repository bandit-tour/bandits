import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
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

/** True when both URL and anon key are present (login can work). */
export function isSupabaseConfigured(): boolean {
  const supabaseUrl = readEnv('EXPO_PUBLIC_SUPABASE_URL');
  const supabaseAnonKey = readEnv('EXPO_PUBLIC_SUPABASE_ANON_KEY');
  return Boolean(supabaseUrl && supabaseAnonKey);
}

function createSupabaseClient(): ReturnType<typeof createClient<Database>> {
  const supabaseUrl = readEnv('EXPO_PUBLIC_SUPABASE_URL');
  const supabaseAnonKey = readEnv('EXPO_PUBLIC_SUPABASE_ANON_KEY');

  if (__DEV__) {
    let urlHost = '(missing)';
    if (supabaseUrl) {
      try {
        urlHost = new URL(supabaseUrl).host;
      } catch {
        urlHost = '(invalid URL)';
      }
    }
    console.log('[supabase] configured:', isSupabaseConfigured(), {
      urlHost,
      hasAnonKey: !!supabaseAnonKey,
    });
  }

  if (!isSupabaseConfigured()) {
    console.error(
      '[supabase] Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY. Add them to .env or expo.extra.',
    );
  }

  return createClient<Database>(
    supabaseUrl ?? 'https://placeholder.invalid',
    supabaseAnonKey ?? 'placeholder-anon-key',
    {
      auth: {
        storage: AsyncStorage,
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
      },
    },
  );
}

let supabaseSingleton: ReturnType<typeof createClient<Database>> | null = null;

function getSupabaseClient(): ReturnType<typeof createClient<Database>> {
  if (!supabaseSingleton) {
    supabaseSingleton = createSupabaseClient();
  }
  return supabaseSingleton;
}

/**
 * Lazy client so `createClient` + AsyncStorage are not touched during initial module load.
 */
export const supabase = new Proxy({} as ReturnType<typeof createClient<Database>>, {
  get(_target, prop, receiver) {
    const client = getSupabaseClient();
    const value = Reflect.get(client, prop, receiver);
    if (typeof value === 'function') {
      return value.bind(client);
    }
    return value;
  },
});
