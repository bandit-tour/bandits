import React from 'react';
import { Redirect } from 'expo-router';

/** ACCESS: HOME = trip brain. */
export default function Home() {
  return <Redirect href="/home" />;
}
