/**
 * Central pull-to-refresh styling for ScrollView / FlatList.
 *
 * **Project rule:** Main app surfaces (Home, Local Friend, Chat, Alerts, Inbox, Menu,
 * Profile, Pilot Desk, Explore, etc.) must keep pull-to-refresh active. Do not remove
 * or gate it off when fixing auth, routing, reports, or notifications — see
 * `.cursor/rules/pull-to-refresh.mdc`.
 */
import { createElement, useMemo } from 'react';
import { Platform, RefreshControl, useWindowDimensions, type ScrollViewProps } from 'react-native';

const TINT = 'rgba(10, 126, 164, 0.95)' as const;
const ANDROID_COLORS = ['#0a7ea4', '#0a5c7a'] as const;

/**
 * iOS, Android, and web.
 */
export function useEnableMobilePullToRefresh(): boolean {
  useWindowDimensions();
  if (Platform.OS === 'ios' || Platform.OS === 'android') return true;
  if (Platform.OS === 'web') return true;
  return false;
}

type RefreshFn = (() => void) | (() => Promise<void>);

export type PremiumRefreshOptions = {
  /** `false` hides the control entirely (e.g. parent has no onRefresh). Default true. */
  active?: boolean;
};

/**
 * Premium-tinted refresh control, or `undefined` when off (wide desktop web, or `active: false`).
 * Pass the same `onRefresh` you use with `useCallback` to avoid spurious re-subscribes.
 */
export function usePremiumRefreshControl(
  refreshing: boolean,
  onRefresh: RefreshFn,
  options: PremiumRefreshOptions = {}
): ScrollViewProps['refreshControl'] {
  const { active: optIn = true } = options;
  const canShow = useEnableMobilePullToRefresh() && optIn;
  return useMemo(
    () =>
      canShow
        ? createElement(RefreshControl, {
            refreshing,
            onRefresh: () => {
              void Promise.resolve(onRefresh());
            },
            tintColor: TINT,
            colors: [...ANDROID_COLORS],
            progressBackgroundColor: 'rgba(252, 251, 248, 0.98)',
          })
        : undefined,
    [canShow, onRefresh, refreshing]
  );
}
