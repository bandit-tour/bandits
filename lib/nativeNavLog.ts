import { Platform } from 'react-native';

/** Structured navigation logs (visible in Xcode / Metro when EXPO_PUBLIC_PERF_LOG=1). */
export function logNativeNav(scope: string, meta?: Record<string, unknown>): void {
  if (Platform.OS === 'web') return;
  try {
    console.warn(`[BanditsNav:${scope}]`, meta ?? '');
  } catch {
    /* ignore */
  }
}
