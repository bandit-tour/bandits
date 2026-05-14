import type { Router } from 'expo-router';

/** Expo Router on native is unreliable with `?query` in string hrefs — always use params. */
export function openStaffEmailLogin(router: Pick<Router, 'push' | 'replace'>, redirect = '/menu'): void {
  router.push({
    pathname: '/login',
    params: { forceAuth: '1', redirect },
  } as never);
}

export function parseLoginForceAuth(raw: unknown): boolean {
  const v = Array.isArray(raw) ? raw[0] : raw;
  if (v === true || v === 1) return true;
  const s = String(v ?? '').trim().toLowerCase();
  return s === '1' || s === 'true' || s === 'yes';
}
