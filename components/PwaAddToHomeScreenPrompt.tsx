import React, { useEffect, useState } from 'react';
import { Image, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

const LOGO = require('@/assets/icons/logobanditourapp.png');

// iOS: one-time dismiss per browser install attempt.
const STORAGE_KEY_IOS_DISMISSED = 'pwa_a2hs_dismissed_bandiTour_v2';
// Android: one-time dismiss per session.
const STORAGE_KEY_ANDROID_DISMISSED = 'pwa_android_install_dismissed_bandiTour_v2';

function isIOSIPhoneSafari() {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  const isiPhone = /iPhone/i.test(ua);
  const isSafari = /Safari/i.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS/i.test(ua);
  return isiPhone && isSafari;
}

function isStandaloneMode() {
  if (typeof window === 'undefined') return false;

  // iOS: navigator.standalone
  const navStandalone = (window.navigator as any)?.standalone === true;

  // Other browsers: display-mode media query
  const mq = window.matchMedia?.('(display-mode: standalone)');
  const displayModeStandalone = mq?.matches === true;

  return navStandalone || displayModeStandalone;
}

function isAndroidChrome() {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  const isAndroid = /Android/i.test(ua);
  const isChrome = /Chrome/i.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS/i.test(ua);
  return isAndroid && isChrome;
}

/**
 * iOS Safari only: instructs the user to use the Share menu -> "Add to Home Screen".
 *
 * iOS does not support programmatic auto-install prompts like Android's `beforeinstallprompt`.
 * We show a premium, minimal overlay only when:
 * - running on iPhone + Safari (web)
 * - NOT already in standalone mode (not installed)
 * - user hasn't dismissed it before (localStorage)
 */
export function PwaAddToHomeScreenPrompt() {
  const [visible, setVisible] = useState(false);
  const [androidVisible, setAndroidVisible] = useState(false);
  const [androidPrompt, setAndroidPrompt] = useState<any>(null);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    if (!isIOSIPhoneSafari()) return;
    if (isStandaloneMode()) return;

    try {
      const dismissed = window.localStorage?.getItem(STORAGE_KEY_IOS_DISMISSED) === '1';
      if (dismissed) return;
    } catch {
      // Best-effort: if localStorage fails, we still show.
    }

    setVisible(true);
  }, []);

  const dismiss = () => {
    setVisible(false);
    try {
      window.localStorage?.setItem(STORAGE_KEY_IOS_DISMISSED, '1');
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    if (!isAndroidChrome()) return;
    if (isStandaloneMode()) return;

    try {
      if (window.sessionStorage?.getItem(STORAGE_KEY_ANDROID_DISMISSED) === '1') return;
    } catch {
      // ignore
    }

    const onBeforeInstallPrompt = (e: Event) => {
      // Native install prompt can only be triggered from user interaction.
      // We capture the event early and show an immediate in-app CTA.
      e.preventDefault();
      setAndroidPrompt(e as any);
      setAndroidVisible(true);
    };

    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt as any);
    return () => window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt as any);
  }, []);

  const onAndroidInstall = async () => {
    if (!androidPrompt) return;
    try {
      await androidPrompt.prompt();
      if (androidPrompt.userChoice) await androidPrompt.userChoice;
    } catch {
      // ignore
    } finally {
      setAndroidVisible(false);
      setAndroidPrompt(null);
      try {
        window.sessionStorage?.setItem(STORAGE_KEY_ANDROID_DISMISSED, '1');
      } catch {
        // ignore
      }
    }
  };

  const onAndroidContinueBrowser = () => {
    setAndroidVisible(false);
    setAndroidPrompt(null);
    try {
      window.sessionStorage?.setItem(STORAGE_KEY_ANDROID_DISMISSED, '1');
    } catch {
      // ignore
    }
  };

  if (!visible && !androidVisible) return null;

  return (
    <View pointerEvents="box-none" style={styles.overlay}>
      {visible ? (
        <View style={styles.card}>
          <View style={styles.topRow}>
            <Image source={LOGO} style={styles.logo} resizeMode="contain" />
            <Text style={styles.title}>For full experience, add bandiTour to your home screen</Text>
          </View>

          <View style={styles.stepRow}>
            <MaterialIcons name="share" size={20} color="#0a7ea4" />
            <Text style={styles.stepText}>Tap Share icon → Add to Home Screen</Text>
          </View>

          <Pressable
            onPress={dismiss}
            style={({ pressed }) => [styles.dismissBtn, pressed && styles.dismissBtnPressed]}
            accessibilityRole="button"
            accessibilityLabel="Dismiss add to home screen prompt"
          >
            <Text style={styles.dismissText}>Got it</Text>
          </Pressable>
        </View>
      ) : null}

      {androidVisible ? (
        <View style={styles.card}>
          <View style={styles.topRow}>
            <Image source={LOGO} style={styles.logo} resizeMode="contain" />
            <Text style={styles.title}>Install bandiTour for the best experience</Text>
          </View>

          <View style={styles.stepRow}>
            <MaterialIcons name="system-update-alt" size={20} color="#0a7ea4" />
            <Text style={styles.stepText}>Install now or continue in browser</Text>
          </View>

          <View style={styles.androidActionRow}>
            <Pressable
              onPress={onAndroidContinueBrowser}
              style={({ pressed }) => [styles.secondaryBtn, pressed && styles.dismissBtnPressed]}
              accessibilityRole="button"
              accessibilityLabel="Continue in browser"
            >
              <Text style={styles.secondaryBtnText}>Continue in browser</Text>
            </Pressable>
            <Pressable
              onPress={onAndroidInstall}
              style={({ pressed }) => [styles.dismissBtn, pressed && styles.dismissBtnPressed]}
              accessibilityRole="button"
              accessibilityLabel="Install app"
            >
              <Text style={styles.dismissText}>Install</Text>
            </Pressable>
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 18,
    zIndex: 50,
  },
  card: {
    backgroundColor: 'rgba(255,255,255,0.98)',
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(10,126,164,0.18)',
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  logo: {
    width: 34,
    height: 34,
  },
  title: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
    color: '#111',
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 6,
    marginBottom: 12,
  },
  stepText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: '#0a7ea4',
  },
  dismissBtn: {
    alignSelf: 'flex-end',
    backgroundColor: '#0a7ea4',
    borderRadius: 999,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  dismissBtnPressed: {
    opacity: 0.92,
  },
  dismissText: {
    fontSize: 13,
    color: '#fff',
    fontWeight: '700',
  },
  androidActionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  secondaryBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(10,126,164,0.32)',
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  secondaryBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0a7ea4',
  },
});

