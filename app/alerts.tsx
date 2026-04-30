import { Redirect } from 'expo-router';
import React from 'react';

/**
 * Public alias for old `/alerts` links.
 * Canonical route is `/scam-alerts`.
 */
export default function AlertsAliasPage() {
  return <Redirect href="/scam-alerts" />;
}
