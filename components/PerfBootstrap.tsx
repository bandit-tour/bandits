import { useEffect } from 'react';

import { perfInstallAppLifecycle, perfMark, perfNoteExpoDevOverhead } from '@/lib/perfTiming';

/** Root-level perf hooks: launch timing + resume-from-background markers. */
export default function PerfBootstrap() {
  useEffect(() => {
    const uninstall = perfInstallAppLifecycle();
    perfNoteExpoDevOverhead();
    perfMark('perf_bootstrap_mounted', 'launch');
    return uninstall;
  }, []);

  return null;
}
