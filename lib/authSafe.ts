import { supabase } from '@/lib/supabase';

/** Messages Supabase may surface when the session is already cleared — never surface these to users. */
export function isBenignAuthStateMessage(message: string | undefined | null): boolean {
  const m = String(message || '').toLowerCase();
  if (!m) return false;
  if (m.includes('session') && m.includes('missing')) return true;
  if (m.includes('auth session missing')) return true;
  if (m.includes('invalid refresh token')) return true;
  if (m.includes('refresh token not found')) return true;
  if (m.includes('jwt expired')) return true;
  if (m.includes('already signed out')) return true;
  if (m.includes('session expired')) return true;
  if (m.includes('invalid jwt')) return true;
  if (m.includes('no authorization')) return true;
  return false;
}

/**
 * Sign out without throwing. Clears local session first (works when refresh token is already invalid),
 * then attempts default sign-out to revoke server-side when possible.
 */
export async function safeSignOut(): Promise<void> {
  const run = async (fn: () => ReturnType<typeof supabase.auth.signOut>) => {
    try {
      const { error } = await fn();
      if (error && !isBenignAuthStateMessage(error.message)) {
        console.warn('[authSafe] signOut:', error.message);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (!isBenignAuthStateMessage(msg)) {
        console.warn('[authSafe] signOut threw:', msg);
      }
    }
  };

  await run(() => supabase.auth.signOut({ scope: 'local' }));
  await run(() => supabase.auth.signOut());
}
