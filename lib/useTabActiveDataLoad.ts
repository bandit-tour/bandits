import { useEffect, type MutableRefObject } from 'react';

/** Load tab data when the screen is focused. No InteractionManager defer — that can block nav on Android. */
export function useTabActiveDataLoad(
  tabActive: boolean,
  initialDoneRef: MutableRefObject<boolean>,
  runLoad: (asRefresh: boolean) => { cancel: () => void },
): void {
  useEffect(() => {
    if (!tabActive) return;
    const handle = runLoad(initialDoneRef.current);
    initialDoneRef.current = true;
    return () => handle.cancel();
  }, [tabActive, runLoad, initialDoneRef]);
}
