import { useEffect, useState } from 'react';
import { Platform } from 'react-native';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export type InstallState =
  | 'not-installable'  // Not on web or already installed
  | 'installable'      // Can show prompt (Chrome/Edge desktop/Android)
  | 'ios-safari'       // iOS Safari - needs manual instructions
  | 'installed';       // App is already installed

export function usePWAInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installState, setInstallState] = useState<InstallState>('not-installable');
  const [debugInfo, setDebugInfo] = useState<Record<string, any>>({});

  useEffect(() => {
    if (Platform.OS !== 'web') {
      setInstallState('not-installable');
      return;
    }

    // Check if running in standalone mode (app is installed and opened from home screen)
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
    const isInWebAppiOS = (window.navigator as any).standalone === true;

    // Check for PWA launch via start_url parameter (more reliable on Android)
    const urlParams = new URLSearchParams(window.location.search);
    const isFromPWA = urlParams.get('source') === 'pwa';

    // Collect debug info
    setDebugInfo({
      isStandalone,
      isInWebAppiOS,
      isFromPWA,
      urlParams: window.location.search,
      userAgent: navigator.userAgent,
      platform: Platform.OS,
      displayMode: window.matchMedia('(display-mode: standalone)').matches ? 'standalone' : 'browser',
    });

    if (isStandalone || isInWebAppiOS || isFromPWA) {
      setInstallState('installed');
      return;
    }

    // If not in standalone mode, app is not currently installed
    // (either never installed or was removed)

    // Detect iOS Safari
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
                  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1); // iPad on iOS 13+
    const isSafari = /Safari/.test(navigator.userAgent) && !/Chrome|CriOS|FxiOS|EdgiOS/.test(navigator.userAgent);

    if (isIOS) {
      setInstallState('ios-safari');
      return;
    }

    // Detect Android
    const isAndroid = /android/i.test(navigator.userAgent);

    // Listen for install prompt (Chrome/Edge on Android/Desktop)
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setInstallState('installable');
    };

    // Listen for app installed event
    const handleAppInstalled = () => {
      setInstallState('installed');
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    // For Android Chrome, show install button even if no prompt yet
    // The prompt may come later after user engagement
    if (isAndroid) {
      const timer = setTimeout(() => {
        setInstallState((current) => {
          // Only set to installable if still not-installable
          return current === 'not-installable' ? 'installable' : current;
        });
      }, 1000);

      return () => {
        clearTimeout(timer);
        window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
        window.removeEventListener('appinstalled', handleAppInstalled);
      };
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const promptInstall = async () => {
    if (!deferredPrompt) return false;

    try {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;

      if (outcome === 'accepted') {
        setDeferredPrompt(null);
        setInstallState('installed');
        return true;
      }
      return false;
    } catch (error) {
      console.error('Install prompt error:', error);
      return false;
    }
  };

  return {
    installState,
    canPrompt: !!deferredPrompt,
    promptInstall,
    debugInfo
  };
}