/**
 * After the original full-screen intro, seed a Chat-visible mystery welcome
 * so the teaser is not Notifications-only.
 * Prefer hotel QR path (`ensureQrWelcomeChat`) when the guest enters via QR —
 * that delivers the exact line shown under the bottle into Chat.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

import { insertGuestEchoViaApi } from '@/lib/guestNotificationEchoApi';
import { deterministicUuidFromSeed } from '@/lib/qrWelcomeChat';
import { resolveTravelerSession } from '@/lib/pilotSession';

const SEEDED_KEY = '@bandits_intro_mystery_chat_v1';

export async function ensureIntroMysteryChatSeed(): Promise<{ ok: boolean; detail: string }> {
  try {
    const already = await AsyncStorage.getItem(SEEDED_KEY);
    if (already === '1') return { ok: true, detail: 'already_seeded' };

    const traveler = await resolveTravelerSession();
    const userId = String(traveler?.user?.id || '').trim();
    if (!userId) return { ok: false, detail: 'no_session' };

    const threadRootId = deterministicUuidFromSeed(`intro_mystery_${userId}`);
    await insertGuestEchoViaApi({
      kind: 'hotel_qr_welcome',
      threadRootId,
      title: 'Message in a bottle',
      message:
        'A traveler left you a welcome message. Open this chat to discover who — when they allow it.',
    });
    await AsyncStorage.setItem(SEEDED_KEY, '1');
    return { ok: true, detail: 'seeded' };
  } catch (e) {
    const detail = e instanceof Error ? e.message : 'seed_failed';
    return { ok: false, detail };
  }
}
