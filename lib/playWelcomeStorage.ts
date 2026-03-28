import AsyncStorage from '@react-native-async-storage/async-storage';

/** One-time PLAY Theatrou Athens guest welcome gate. */
export const PLAY_WELCOME_SEEN_KEY = 'play_theatrou_welcome_seen_v2';

export async function hasSeenPlayWelcome(): Promise<boolean> {
  try {
    const v = await AsyncStorage.getItem(PLAY_WELCOME_SEEN_KEY);
    return v === '1';
  } catch {
    return false;
  }
}

export async function markPlayWelcomeSeen(): Promise<void> {
  try {
    await AsyncStorage.setItem(PLAY_WELCOME_SEEN_KEY, '1');
  } catch {
    /* ignore */
  }
}
