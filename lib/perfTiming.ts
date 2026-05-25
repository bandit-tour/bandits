import { AppState, type AppStateStatus, Platform } from 'react-native';

/** Set EXPO_PUBLIC_PERF_LOG=1 in .env to log timings in release/pilot builds. Always on in __DEV__. */
export const PERF_ENABLED =
  __DEV__ || String(process.env.EXPO_PUBLIC_PERF_LOG ?? '').trim() === '1';

export type PerfCategory = 'launch' | 'navigation' | 'network' | 'render' | 'map' | 'js';

const SLOW_MS = 300;
const VERY_SLOW_MS = 800;

type PerfEntry = {
  label: string;
  category: PerfCategory;
  durationMs: number;
  atMs: number;
  meta?: Record<string, unknown>;
};

const activeSpans = new Map<
  string,
  { label: string; category: PerfCategory; startMs: number; meta?: Record<string, unknown> }
>();
const recent: PerfEntry[] = [];
const MAX_RECENT = 80;

export function perfNow(): number {
  return typeof performance !== 'undefined' ? performance.now() : Date.now();
}

/** Milliseconds since JS bundle started (app launch reference). */
export function perfSinceLaunch(): number {
  return Math.round(perfNow());
}

function pushRecent(entry: PerfEntry) {
  recent.push(entry);
  if (recent.length > MAX_RECENT) recent.shift();
}

function logLine(
  kind: 'mark' | 'span' | 'warn',
  label: string,
  category: PerfCategory,
  ms: number,
  meta?: Record<string, unknown>,
) {
  if (!PERF_ENABLED) return;
  const sinceLaunch = perfSinceLaunch();
  const tag = `[PERF:${category}]`;
  const base = `${tag} ${label} +${sinceLaunch}ms`;
  const extra = meta && Object.keys(meta).length > 0 ? ` ${JSON.stringify(meta)}` : '';
  if (kind === 'warn') {
    // eslint-disable-next-line no-console
    console.warn(`${base} (${ms}ms) SLOW${extra}`);
  } else if (kind === 'span') {
    // eslint-disable-next-line no-console
    console.log(`${base} took ${ms}ms${extra}`);
  } else {
    // eslint-disable-next-line no-console
    console.log(`${base}${extra}`);
  }
}

/** Instant checkpoint (navigation press, screen paint, etc.). */
export function perfMark(label: string, category: PerfCategory = 'js', meta?: Record<string, unknown>) {
  if (!PERF_ENABLED) return;
  logLine('mark', label, category, 0, meta);
}

/**
 * Start a timed span. Call the returned function to end it.
 * Duplicate ids are suffixed so spans never collide.
 */
export function perfStart(
  label: string,
  category: PerfCategory,
  meta?: Record<string, unknown>,
): () => void {
  if (!PERF_ENABLED) return () => undefined;
  let id = label;
  let n = 0;
  while (activeSpans.has(id)) {
    n += 1;
    id = `${label}#${n}`;
  }
  activeSpans.set(id, { label, category, startMs: perfNow(), meta });
  perfMark(`${label}:start`, category, meta);
  return (endMeta?: Record<string, unknown>) => {
    const span = activeSpans.get(id);
    if (!span) return;
    activeSpans.delete(id);
    const durationMs = Math.round(perfNow() - span.startMs);
    const merged = { ...span.meta, ...endMeta };
    pushRecent({
      label: span.label,
      category: span.category,
      durationMs,
      atMs: perfSinceLaunch(),
      meta: merged,
    });
    const kind = durationMs >= SLOW_MS ? 'warn' : 'span';
    logLine(kind, `${span.label}:end`, span.category, durationMs, merged);
    if (durationMs >= VERY_SLOW_MS) {
      logLine(
        'warn',
        `${span.label}:very_slow`,
        span.category,
        durationMs,
        { hint: 'Check network, Expo Go dev server, or heavy render on JS thread', ...merged },
      );
    }
  };
}

/** Wrap an async network call with timing logs. */
export async function perfTraceNetwork<T>(
  label: string,
  fn: () => Promise<T>,
  meta?: Record<string, unknown>,
): Promise<T> {
  const end = perfStart(label, 'network', meta);
  try {
    return await fn();
  } finally {
    end();
  }
}

/** Log navigation press → next frame (measures if JS thread blocked before paint). */
export function perfTraceNavigationPress(action: string, run: () => void, meta?: Record<string, unknown>) {
  if (!PERF_ENABLED) {
    run();
    return;
  }
  perfMark(`${action}:press`, 'navigation', meta);
  const endSpan = perfStart(`${action}:to_frame`, 'navigation', meta);
  run();
  requestAnimationFrame(() => {
    perfMark(`${action}:after_frame`, 'navigation', meta);
    endSpan({ phase: 'first_frame' });
  });
  setTimeout(() => {
    perfMark(`${action}:after_50ms`, 'navigation', meta);
  }, 50);
  setTimeout(() => {
    perfMark(`${action}:after_300ms`, 'navigation', meta);
  }, 300);
}

export function perfGetRecentEntries(): readonly PerfEntry[] {
  return recent;
}

export type PerfBottleneckVerdict = {
  primary: PerfCategory | 'none';
  secondary: PerfCategory[];
  slowSpans: PerfEntry[];
  navigationSluggish: boolean;
  mapSluggish: boolean;
  networkSluggish: boolean;
  renderSluggish: boolean;
};

/** Classify recent spans into likely bottleneck areas for pilot tuning. */
export function perfAnalyzeBottlenecks(): PerfBottleneckVerdict {
  const slow = recent.filter((e) => e.durationMs >= SLOW_MS);
  const totals: Record<PerfCategory, number> = {
    launch: 0,
    navigation: 0,
    network: 0,
    render: 0,
    map: 0,
    js: 0,
  };
  for (const e of slow) totals[e.category] += e.durationMs;

  const ranked = (Object.entries(totals) as [PerfCategory, number][])
    .filter(([, ms]) => ms > 0)
    .sort((a, b) => b[1] - a[1]);

  const navToFrame = slow.filter((e) => e.label.includes(':to_frame'));
  const navigationSluggish = navToFrame.some((e) => e.durationMs >= 120);

  return {
    primary: ranked[0]?.[0] ?? 'none',
    secondary: ranked.slice(1, 3).map(([c]) => c),
    slowSpans: slow.slice(-20),
    navigationSluggish,
    mapSluggish: slow.some((e) => e.category === 'map' && e.durationMs >= VERY_SLOW_MS),
    networkSluggish: totals.network >= 500,
    renderSluggish: totals.render >= 400,
  };
}

export function perfDumpSummary(): void {
  if (!PERF_ENABLED) return;
  const slow = recent.filter((e) => e.durationMs >= SLOW_MS);
  const verdict = perfAnalyzeBottlenecks();
  // eslint-disable-next-line no-console
  console.log(
    `[PERF:summary] ${recent.length} spans, ${slow.length} slow (>=${SLOW_MS}ms), platform=${Platform.OS}, dev=${__DEV__}, perfLog=${process.env.EXPO_PUBLIC_PERF_LOG ?? '0'}`,
  );
  // eslint-disable-next-line no-console
  console.log(
    `[PERF:verdict] primary=${verdict.primary} secondary=${verdict.secondary.join(',') || 'none'} navSlow=${verdict.navigationSluggish} mapSlow=${verdict.mapSluggish} networkSlow=${verdict.networkSluggish} renderSlow=${verdict.renderSluggish}`,
  );
  if (verdict.navigationSluggish) {
    // eslint-disable-next-line no-console
    console.log('[PERF:hint] navigation — JS thread blocked before first frame; check heavy mounts/WebView');
  }
  if (verdict.mapSluggish) {
    // eslint-disable-next-line no-console
    console.log('[PERF:hint] map — WebView/Leaflet; bundled offline Leaflet should help vs CDN');
  }
  if (verdict.networkSluggish) {
    // eslint-disable-next-line no-console
    console.log('[PERF:hint] network — Supabase/API; cache hits should show cacheHit:true in fetchSWR spans');
  }
  if (verdict.renderSluggish) {
    // eslint-disable-next-line no-console
    console.log('[PERF:hint] render — FlatList/images; reduce initialNumToRender or defer image fetches');
  }
  slow.slice(-12).forEach((e) => {
    // eslint-disable-next-line no-console
    console.log(`  - ${e.label} ${e.durationMs}ms [${e.category}] @+${e.atMs}ms`, e.meta ?? '');
  });
}

let appStateSub: { remove: () => void } | null = null;

/** Call once from root layout — logs cold start and resume-from-background. */
export function perfInstallAppLifecycle(): () => void {
  if (!PERF_ENABLED) return () => undefined;
  perfMark('app_js_start', 'launch', {
    platform: Platform.OS,
    dev: __DEV__,
    perfLogEnv: process.env.EXPO_PUBLIC_PERF_LOG ?? '0',
    buildType: __DEV__ ? 'development' : 'release',
    note: __DEV__
      ? 'Expo Go/dev adds overhead vs EAS preview/production'
      : 'EAS preview/production — use [PERF:verdict] after each flow',
  });

  let lastState: AppStateStatus = AppState.currentState;
  const sub = AppState.addEventListener('change', (next) => {
    if (lastState.match(/inactive|background/) && next === 'active') {
      perfMark('app_resume_foreground', 'launch');
      perfDumpSummary();
    }
    if (next.match(/inactive|background/)) {
      perfMark('app_background', 'launch');
      perfDumpSummary();
    }
    lastState = next;
  });
  appStateSub = sub;
  return () => {
    sub.remove();
    appStateSub = null;
  };
}

export function perfNoteExpoDevOverhead(): void {
  if (!PERF_ENABLED) return;
  if (__DEV__) {
    perfMark('expo_dev_mode_active', 'launch', {
      warning:
        'Expo Go dev builds are slower than TestFlight/production. Compare pilot timing on a release build.',
    });
  }
}
