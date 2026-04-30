import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

export const ALUMA_ONBOARDING_DONE_KEY = '@bandits_aluma_onboarding_done_v1';

/** Step 1 headline — fixed copy (message body is passed from app state). */
export const ALUMA_BOTTLE_HEADLINE = 'A message in a bottle has arrived for you.';

export type AlumaOnboardingStepDef = {
  id: 'hook' | 'reward';
  showVideo?: boolean;
  kicker?: string;
  eyebrow?: string;
  headline: string;
  subline: string;
  cta: string;
};

export const ALUMA_ONBOARDING_STEPS: readonly AlumaOnboardingStepDef[] = [
  {
    id: 'hook',
    showVideo: true,
    headline: ALUMA_BOTTLE_HEADLINE,
    subline: '',
    cta: 'Flip',
  },
  {
    id: 'reward',
    eyebrow: 'YOUR ARRIVAL GIFT',
    headline: 'Your welcome gift is waiting at reception.',
    subline: 'Show this at reception.',
    cta: 'Explore the City',
  },
] as const;

export async function getAlumaOnboardingComplete(): Promise<boolean> {
  try {
    if (Platform.OS === 'web' && typeof sessionStorage !== 'undefined') {
      return sessionStorage.getItem(ALUMA_ONBOARDING_DONE_KEY) === '1';
    }
    const v = await AsyncStorage.getItem(ALUMA_ONBOARDING_DONE_KEY);
    return v === '1';
  } catch {
    return false;
  }
}

export async function setAlumaOnboardingComplete(done: boolean): Promise<void> {
  try {
    if (Platform.OS === 'web' && typeof sessionStorage !== 'undefined') {
      if (done) sessionStorage.setItem(ALUMA_ONBOARDING_DONE_KEY, '1');
      else sessionStorage.removeItem(ALUMA_ONBOARDING_DONE_KEY);
      return;
    }
    if (done) await AsyncStorage.setItem(ALUMA_ONBOARDING_DONE_KEY, '1');
    else await AsyncStorage.removeItem(ALUMA_ONBOARDING_DONE_KEY);
  } catch {
    /* ignore */
  }
}
