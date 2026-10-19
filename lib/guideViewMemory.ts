/** Remembers City Guide / Vibe Route camera, filter, card, and scroll across Back. */

export type GuideCamera = {
  latitude: number;
  longitude: number;
  zoom: number;
};

export type GuideViewMemory = {
  scrollY: number;
  genre: string;
  selectedEventId: string | null;
  cardIndex: number;
  camera: GuideCamera | null;
};

type GuideKind = 'city' | 'vibe';

const memory = new Map<string, GuideViewMemory>();

function storageKey(kind: GuideKind, banditId: string) {
  return `bandit.guide.${kind}.${banditId}`;
}

function readStorage(key: string): GuideViewMemory | null {
  if (typeof sessionStorage === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as GuideViewMemory;
    if (!parsed || typeof parsed !== 'object') return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeStorage(key: string, next: GuideViewMemory) {
  if (typeof sessionStorage === 'undefined') return;
  try {
    sessionStorage.setItem(key, JSON.stringify(next));
  } catch {
    /* private mode */
  }
}

export function readGuideView(kind: GuideKind, banditId: string): GuideViewMemory | null {
  const id = String(banditId || '').trim();
  if (!id) return null;
  const key = storageKey(kind, id);
  return memory.get(key) ?? readStorage(key);
}

export function writeGuideView(kind: GuideKind, banditId: string, partial: Partial<GuideViewMemory>) {
  const id = String(banditId || '').trim();
  if (!id) return;
  const key = storageKey(kind, id);
  const prev = readGuideView(kind, id);
  const next: GuideViewMemory = {
    scrollY: partial.scrollY ?? prev?.scrollY ?? 0,
    genre: partial.genre ?? prev?.genre ?? '',
    selectedEventId:
      partial.selectedEventId === undefined ? prev?.selectedEventId ?? null : partial.selectedEventId,
    cardIndex: partial.cardIndex ?? prev?.cardIndex ?? 0,
    camera: partial.camera === undefined ? prev?.camera ?? null : partial.camera,
  };
  memory.set(key, next);
  writeStorage(key, next);
}

const RETURN_KEY = 'bandit.guide.return';

/** Remember which guide opened a place, so Back returns there. */
export function markGuideReturn(href: string) {
  const next = String(href || '').trim();
  if (!next || typeof sessionStorage === 'undefined') return;
  try {
    sessionStorage.setItem(RETURN_KEY, next);
  } catch {
    /* private mode */
  }
}

export function consumeGuideReturn(): string | null {
  if (typeof sessionStorage === 'undefined') return null;
  try {
    const href = sessionStorage.getItem(RETURN_KEY);
    sessionStorage.removeItem(RETURN_KEY);
    return href && href.startsWith('/') ? href : null;
  } catch {
    return null;
  }
}
