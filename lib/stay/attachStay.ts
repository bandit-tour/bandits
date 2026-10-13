import AsyncStorage from '@react-native-async-storage/async-storage';

import { persistHotelEntry } from '@/lib/pilotSession';
import type { AttachedStay, StayLifecyclePhase } from '@/lib/stay/lifecycle';
import { suggestPhaseFromDates } from '@/lib/stay/lifecycle';

const STAY_KEY = '@bandits_attached_stay_v1';

export async function persistAttachedStay(stay: AttachedStay): Promise<void> {
  const phase = suggestPhaseFromDates(stay.checkInDate, stay.checkOutDate);
  const payload: AttachedStay = {
    ...stay,
    lifecyclePhase: stay.lifecyclePhase === 'NONE' ? 'PRE_TRIP' : stay.lifecyclePhase || phase,
  };
  await AsyncStorage.setItem(STAY_KEY, JSON.stringify(payload));
  await persistHotelEntry(stay.hotelSlug, 'hotel_link', {
    hotelId: stay.hotelId,
    displayName: stay.hotelName,
  });
}

export async function getAttachedStay(): Promise<AttachedStay | null> {
  try {
    const raw = await AsyncStorage.getItem(STAY_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as AttachedStay;
    if (!p?.hotelSlug || !p?.reservationNumber) return null;
    const phase = suggestPhaseFromDates(p.checkInDate, p.checkOutDate);
    if (phase !== p.lifecyclePhase && p.lifecyclePhase !== 'AFTER_TRIP') {
      const updated = { ...p, lifecyclePhase: phase };
      await AsyncStorage.setItem(STAY_KEY, JSON.stringify(updated));
      return updated;
    }
    return p;
  } catch {
    return null;
  }
}

export async function clearAttachedStay(): Promise<void> {
  try {
    await AsyncStorage.removeItem(STAY_KEY);
  } catch {
    /* ignore */
  }
}

export async function setStayLifecyclePhase(phase: StayLifecyclePhase): Promise<AttachedStay | null> {
  const stay = await getAttachedStay();
  if (!stay) return null;
  const updated = { ...stay, lifecyclePhase: phase };
  await AsyncStorage.setItem(STAY_KEY, JSON.stringify(updated));
  return updated;
}
