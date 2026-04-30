import { Redirect } from 'expo-router';
import type { Href } from 'expo-router';
import React from 'react';

/** Legacy route: same entry as root. */
export default function PlayWelcomeScreen() {
  return <Redirect href={'/' as Href} />;
}
