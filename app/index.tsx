import { PLAY_THEATROU_GUEST_ENTRY_PATH } from '@/lib/pilotSession';
import { Redirect } from 'expo-router';
import React from 'react';

/** Same path as PLAY_THEATROU_GUEST_ENTRY_URL — hotel context, then welcome → intro → home. */
export default function Index() {
  return <Redirect href={PLAY_THEATROU_GUEST_ENTRY_PATH} />;
}
