import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const KEY = '@bandits_guest_profile_v1';

export type GuestProfileLocal = {
  name: string;
  email: string;
  vibe: string;
  /** optional cached avatar public URL */
  avatarUrl: string;
};

const EMPTY: GuestProfileLocal = { name: '', email: '', vibe: '', avatarUrl: '' };

async function getStorage(): Promise<string> {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    try {
      return window.localStorage.getItem(KEY) || '';
    } catch {
      return '';
    }
  }
  try {
    return (await AsyncStorage.getItem(KEY)) || '';
  } catch {
    return '';
  }
}

async function setStorage(raw: string): Promise<void> {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(KEY, raw);
    } catch {
      /* ignore */
    }
    return;
  }
  try {
    await AsyncStorage.setItem(KEY, raw);
  } catch {
    /* ignore */
  }
}

export async function readGuestProfileLocal(): Promise<GuestProfileLocal> {
  const raw = await getStorage();
  if (!raw.trim()) return { ...EMPTY };
  try {
    const p = JSON.parse(raw) as unknown;
    if (!p || typeof p !== 'object') return { ...EMPTY };
    const o = p as Record<string, unknown>;
    return {
      name: typeof o.name === 'string' ? o.name : '',
      email: typeof o.email === 'string' ? o.email : '',
      vibe: typeof o.vibe === 'string' ? o.vibe : '',
      avatarUrl: typeof o.avatarUrl === 'string' ? o.avatarUrl : '',
    };
  } catch {
    return { ...EMPTY };
  }
}

export async function writeGuestProfileLocal(patch: Partial<GuestProfileLocal>): Promise<void> {
  const cur = await readGuestProfileLocal();
  const next: GuestProfileLocal = {
    name: patch.name !== undefined ? patch.name : cur.name,
    email: patch.email !== undefined ? patch.email : cur.email,
    vibe: patch.vibe !== undefined ? patch.vibe : cur.vibe,
    avatarUrl: patch.avatarUrl !== undefined ? patch.avatarUrl : cur.avatarUrl,
  };
  await setStorage(JSON.stringify(next));
}
