import { Redirect } from 'expo-router';
import type { Href } from 'expo-router';
import React from 'react';

/** Legacy route: same entry as root (opening intro when not yet seen, then Home). */
export default function PlayIntroScreen() {
  return <Redirect href={'/' as Href} />;
}
