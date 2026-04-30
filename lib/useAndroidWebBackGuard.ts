import { useRouter } from 'expo-router';
import { Platform } from 'react-native';
import React from 'react';

function isAndroidChromeWeb() {
  if (Platform.OS !== 'web' || typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  return /Android/i.test(ua) && /Chrome/i.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS/i.test(ua);
}

/**
 * Android Chrome browser back guard for PWA journey pages.
 * Keeps users in-flow instead of jumping out to the referrer page.
 */
export function useAndroidWebBackGuard(targetHref: string) {
  const router = useRouter();

  React.useEffect(() => {
    if (!isAndroidChromeWeb()) return;
    if (typeof window === 'undefined') return;

    // Add a guard history entry; first hardware/browser back stays in the app flow.
    window.history.pushState({ bandiGuard: true }, '', window.location.href);

    const onPopState = () => {
      router.replace(targetHref as any);
      // Re-arm guard so repeated back taps keep user in-flow.
      window.history.pushState({ bandiGuard: true }, '', window.location.href);
    };

    window.addEventListener('popstate', onPopState);
    return () => {
      window.removeEventListener('popstate', onPopState);
    };
  }, [router, targetHref]);
}

