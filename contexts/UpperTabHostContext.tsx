import React, { createContext, useContext, useMemo } from 'react';

import type { UpperTabKey } from '@/lib/upperTab';

type Ctx = {
  /** Home upper-tab overlay is showing; stack routes for bandits/mySpots/explore render nothing. */
  enabled: boolean;
  active: UpperTabKey;
};

const UpperTabHostContext = createContext<Ctx>({ enabled: false, active: 'bandits' });

export function UpperTabHostProvider({
  enabled,
  active,
  children,
}: {
  enabled: boolean;
  active: UpperTabKey;
  children: React.ReactNode;
}) {
  const value = useMemo(() => ({ enabled, active }), [enabled, active]);
  return <UpperTabHostContext.Provider value={value}>{children}</UpperTabHostContext.Provider>;
}

export function useUpperTabHost(): Ctx {
  return useContext(UpperTabHostContext);
}
