import type { Href, Router } from 'expo-router';

/** Main PLAY tab home (Local banDits). */
export const APP_HOME_HREF = '/bandits' as Href;

/** Guest / staff PLAY menu tab. */
export const PLAY_MENU_HREF = '/menu' as Href;

export type AppNavigationRouter = Pick<Router, 'replace' | 'push' | 'back' | 'canGoBack'>;

type NavigationLike = {
  canGoBack?: () => boolean;
  goBack?: () => void;
};

/**
 * Reliable back: expo-router history first, React Navigation stack second, then replace fallback.
 * Never no-ops when the user taps Back.
 */
export function navigateAppBack(
  router: AppNavigationRouter,
  fallback: Href,
  navigation?: NavigationLike | null,
): void {
  if (router.canGoBack()) {
    router.back();
    return;
  }
  if (navigation?.canGoBack?.()) {
    navigation.goBack?.();
    return;
  }
  router.replace(fallback);
}

export function goToPlayMenu(router: AppNavigationRouter): void {
  router.replace(PLAY_MENU_HREF);
}

export function goToAppHome(router: AppNavigationRouter): void {
  router.replace(APP_HOME_HREF);
}
