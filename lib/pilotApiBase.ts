import { Platform } from 'react-native';

const DEFAULT_PROD = 'https://bandits-two.vercel.app';

/**
 * Base URL for Vercel server routes (`/api/*`) in production. Native uses explicit deploy host.
 */
export function getPilotApiBaseUrl(): string | null {
  const fromEnv = String(process.env.EXPO_PUBLIC_PILOT_API_BASE ?? process.env.EXPO_PUBLIC_AVATAR_API_BASE ?? '').trim();
  if (fromEnv) return fromEnv.replace(/\/$/, '');
  if (__DEV__) return null;
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    const h = window.location.hostname;
    if (h && h !== 'localhost' && h !== '127.0.0.1' && !h.endsWith('.local')) {
      return window.location.origin.replace(/\/$/, '');
    }
  }
  if (Platform.OS !== 'web') {
    return DEFAULT_PROD;
  }
  return DEFAULT_PROD;
}
