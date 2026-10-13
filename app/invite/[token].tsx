import { Redirect, useLocalSearchParams } from 'expo-router';
import type { Href } from 'expo-router';

/**
 * Alias for email / QR deep links: /invite/{opaqueToken} → /hotel/unlock?t=
 * Never puts reservation numbers in the path.
 */
export default function InviteTokenRedirect() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const t = String(token || '').trim();
  if (!t) {
    return <Redirect href={'/hotel/unlock' as Href} />;
  }
  return <Redirect href={`/hotel/unlock?t=${encodeURIComponent(t)}` as Href} />;
}
