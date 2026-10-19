import type { ExploreCategoryChip } from '@/lib/exploreCategoryFilter';

export type ExploreMapCamera = { lat: number; lng: number; zoom: number };

export type ExploreViewMemory = {
  chip: ExploreCategoryChip;
  viewMode: 'list' | 'map';
  scrollY: number;
  map: ExploreMapCamera | null;
};

const STORAGE_KEY = 'bandit.explore.view';
const OPENED_SPOT_KEY = 'bandit.explore.openedSpot';

let memory: ExploreViewMemory | null = null;

function readStorage(): ExploreViewMemory | null {
  if (typeof sessionStorage === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ExploreViewMemory;
    if (!parsed || typeof parsed !== 'object') return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeStorage(next: ExploreViewMemory) {
  if (typeof sessionStorage === 'undefined') return;
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* private mode */
  }
}

export function readExploreView(): ExploreViewMemory | null {
  if (memory) return memory;
  memory = readStorage();
  return memory;
}

export function writeExploreView(partial: Partial<ExploreViewMemory>) {
  const prev = readExploreView();
  const next: ExploreViewMemory = {
    chip: partial.chip ?? prev?.chip ?? 'All',
    viewMode: partial.viewMode ?? prev?.viewMode ?? 'list',
    scrollY: partial.scrollY ?? prev?.scrollY ?? 0,
    map: partial.map === undefined ? prev?.map ?? null : partial.map,
  };
  memory = next;
  writeStorage(next);
}

/** Set when Explore itself opens a place, so Back can return instead of leaving the site. */
export function markExploreOpenedSpot() {
  if (typeof sessionStorage === 'undefined') return;
  try {
    sessionStorage.setItem(OPENED_SPOT_KEY, '1');
  } catch {
    /* ignore */
  }
}

export function consumeExploreOpenedSpot(): boolean {
  if (typeof sessionStorage === 'undefined') return false;
  try {
    const fromExplore = sessionStorage.getItem(OPENED_SPOT_KEY) === '1';
    sessionStorage.removeItem(OPENED_SPOT_KEY);
    return fromExplore;
  } catch {
    return false;
  }
}

export function exploreOpenedSpot(): boolean {
  if (typeof sessionStorage === 'undefined') return false;
  try {
    return sessionStorage.getItem(OPENED_SPOT_KEY) === '1';
  } catch {
    return false;
  }
}
