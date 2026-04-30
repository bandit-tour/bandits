import { Redirect } from 'expo-router';
import React from 'react';

/**
 * Public alias for direct `/following` entry.
 * Canonical screen lives in tabs route group.
 */
export default function FollowingAliasPage() {
  return <Redirect href="/(tabs)/following" />;
}
