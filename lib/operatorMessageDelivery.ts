import { Platform } from 'react-native';

import {
  routeOperatorMessageViaApi,
  type RouteAskMeApiPayload,
  type RouteLocalFriendApiPayload,
} from '@/lib/operatorMessageApi';
import { userFacingMessagingError } from '@/lib/userFacingMessagingError';

export type OperatorMessagePayload = RouteAskMeApiPayload | RouteLocalFriendApiPayload;

/** Installed + release builds must not fall back to client RLS inserts. */
export function shouldRequireOperatorMessageApi(): boolean {
  if (Platform.OS === 'ios' || Platform.OS === 'android') return true;
  return !__DEV__;
}

export async function deliverOperatorMessage(payload: OperatorMessagePayload): Promise<void> {
  try {
    await routeOperatorMessageViaApi(payload);
  } catch (err) {
    throw userFacingMessagingError(err);
  }
}
