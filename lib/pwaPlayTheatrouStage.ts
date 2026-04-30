import AsyncStorage from '@react-native-async-storage/async-storage';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';

export type PlayTheatrouStage = 'intro' | 'flip' | 'experience' | 'done';

const STORAGE_KEY = 'pwa_play_theatrou_stage_v1';
const DONE_KEY = 'pwa_play_theatrou_done_v1';
const DONE_ASYNC_KEY = '@bandits_play_onboarding_done_v1';

function hasWindow() {
  return typeof window !== 'undefined';
}

/** PLAY guest flow only — never use generic app onboarding flags here (they are not PLAY-specific). */
function metadataIndicatesPlayGuestFlowDone(meta: Record<string, unknown> | null | undefined): boolean {
  if (!meta || typeof meta !== 'object') return false;
  if (meta.play_guest_flow_completed_v1 === true) return true;
  const at = typeof meta.play_guest_flow_completed_at_v1 === 'string' ? meta.play_guest_flow_completed_at_v1.trim() : '';
  return at.length > 0;
}

async function readAsyncDoneFlag(): Promise<boolean> {
  try {
    const v = await AsyncStorage.getItem(DONE_ASYNC_KEY);
    return v === '1';
  } catch {
    return false;
  }
}

async function writeAsyncDoneFlag(): Promise<void> {
  try {
    await AsyncStorage.setItem(DONE_ASYNC_KEY, '1');
  } catch {
    // ignore
  }
}

function readWebDoneFlag(): boolean {
  if (!hasWindow()) return false;
  try {
    return window.localStorage?.getItem(DONE_KEY) === '1';
  } catch {
    return false;
  }
}

/**
 * Synchronous, web-only. Used to route returning guests to home in `useLayoutEffect`
 * so we never paint a partial "loading" intro. Native uses async `shouldSkipPlayOnboarding` only.
 */
export function isPlayTheatrouDoneWebStorageSync(): boolean {
  return readWebDoneFlag();
}

function writeWebDoneFlag(): void {
  if (!hasWindow()) return;
  try {
    window.localStorage?.setItem(DONE_KEY, '1');
  } catch {
    // ignore
  }
}

export async function markPlayOnboardingCompleted(): Promise<void> {
  if (hasWindow()) {
    try {
      window.sessionStorage?.setItem(STORAGE_KEY, 'done');
    } catch {
      // ignore
    }
    writeWebDoneFlag();
  }
  await writeAsyncDoneFlag();
  if (!isSupabaseConfigured()) return;
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user?.id) return;
    const appMeta = (user.app_metadata ?? {}) as Record<string, unknown>;
    const isAnonymous = appMeta.provider === 'anonymous' || appMeta.is_anonymous === true;
    if (isAnonymous) return;
    const current = (user.user_metadata ?? {}) as Record<string, unknown>;
    if (metadataIndicatesPlayGuestFlowDone(current)) return;
    const now = new Date().toISOString();
    await supabase.auth.updateUser({
      data: {
        play_guest_flow_completed_v1: true,
        play_guest_flow_completed_at_v1: now,
      },
    });
  } catch {
    // ignore
  }
}

export async function shouldSkipPlayOnboarding(): Promise<boolean> {
  const localDone = readWebDoneFlag() || (await readAsyncDoneFlag());
  if (localDone) return true;
  if (!isSupabaseConfigured()) return false;
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user?.id) return false;
    // Do not skip PLAY intro for signed-in (non-anonymous) users: first PLAY entry must see the
    // full flow. Completion is written only in markPlayOnboardingCompleted (final step).
    const doneByMetadata = metadataIndicatesPlayGuestFlowDone((user.user_metadata ?? {}) as Record<string, unknown>);
    if (doneByMetadata) {
      await markPlayOnboardingCompleted();
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

export function getPwaPlayTheatrouStage(): PlayTheatrouStage | null {
  if (!hasWindow()) return null;
  try {
    if (readWebDoneFlag()) return 'done';
    const v = window.sessionStorage?.getItem(STORAGE_KEY);
    if (!v) return null;
    if (v === 'intro' || v === 'flip' || v === 'experience' || v === 'done') return v;
    return null;
  } catch {
    return null;
  }
}

export function setPwaPlayTheatrouStage(stage: PlayTheatrouStage): void {
  if (hasWindow()) {
    try {
      window.sessionStorage?.setItem(STORAGE_KEY, stage);
      if (stage === 'done') {
        writeWebDoneFlag();
      }
    } catch {
      // ignore
    }
  }
  if (stage === 'done') void markPlayOnboardingCompleted();
}

export function clearPwaPlayTheatrouStage(): void {
  if (!hasWindow()) return;
  try {
    window.sessionStorage?.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

