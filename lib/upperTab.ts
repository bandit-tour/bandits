export type UpperTabKey = 'bandits' | 'mySpots' | 'explore';

export function upperTabHref(tab: UpperTabKey): '/bandits' | '/mySpots' | '/explore' {
  if (tab === 'mySpots') return '/mySpots';
  if (tab === 'explore') return '/explore';
  return '/bandits';
}
