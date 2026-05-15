import { useEffect, type MutableRefObject } from 'react';
import { InteractionManager, Platform } from 'react-native';

/** Load tab data when the persistent upper-tab host marks this screen active (not navigation focus). */
export function useTabActiveDataLoad(
  tabActive: boolean,
  initialDoneRef: MutableRefObject<boolean>,
  runLoad: (asRefresh: boolean) => { cancel: () => void },
): void {
  useEffect(() => {
    if (!tabActive) return;

    let swr: { cancel: () => void } | null = null;
    let cancelled = false;

    const start = () => {
      if (cancelled) return;
      swr = runLoad(initialDoneRef.current);
      initialDoneRef.current = true;
    };

    if (Platform.OS === 'android') {
      const task = InteractionManager.runAfterInteractions(start);
      return () => {
        cancelled = true;
        task.cancel();
        swr?.cancel();
      };
    }

    start();
    return () => {
      cancelled = true;
      swr?.cancel();
    };
  }, [tabActive, runLoad, initialDoneRef]);
}
