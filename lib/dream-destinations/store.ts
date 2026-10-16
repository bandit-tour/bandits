/**
 * Dream destinations — personal next-trip intent.
 * Not a booking engine. No fabricated inventory for aspirational places.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";

export const DREAM_DESTINATIONS_KEY = "@bandits_dream_destinations_v1";

export type TravelStyle =
  | "city"
  | "nature"
  | "sea"
  | "culture"
  | "romance"
  | "food"
  | "family"
  | "remote_work";

export type DreamDestination = {
  id: string;
  name: string;
  /** Optional timing hint, e.g. "2027 spring" — never treated as a booking. */
  timing?: string;
  styles: TravelStyle[];
  priority: number;
  createdAt: string;
  updatedAt: string;
};

type LegacyFile = {
  userId: string;
  destinations: DreamDestination[];
};

type StoreFile = {
  byUser: Record<string, DreamDestination[]>;
};

const EMPTY_STORE = (): StoreFile => ({ byUser: {} });

async function readRaw(): Promise<string | null> {
  if (Platform.OS === "web" && typeof window !== "undefined") {
    return window.localStorage.getItem(DREAM_DESTINATIONS_KEY);
  }
  return AsyncStorage.getItem(DREAM_DESTINATIONS_KEY);
}

async function writeRaw(raw: string): Promise<void> {
  if (Platform.OS === "web" && typeof window !== "undefined") {
    window.localStorage.setItem(DREAM_DESTINATIONS_KEY, raw);
    return;
  }
  await AsyncStorage.setItem(DREAM_DESTINATIONS_KEY, raw);
}

function asStore(parsed: unknown): StoreFile {
  if (!parsed || typeof parsed !== "object") return EMPTY_STORE();
  const rec = parsed as Partial<StoreFile> & Partial<LegacyFile>;
  if (rec.byUser && typeof rec.byUser === "object") {
    const byUser: Record<string, DreamDestination[]> = {};
    for (const [key, rows] of Object.entries(rec.byUser)) {
      if (Array.isArray(rows)) byUser[key] = rows;
    }
    return { byUser };
  }
  if (Array.isArray(rec.destinations)) {
    const key = String(rec.userId || "").trim();
    if (!key) return EMPTY_STORE();
    return { byUser: { [key]: rec.destinations } };
  }
  return EMPTY_STORE();
}

async function readStore(): Promise<StoreFile> {
  try {
    const raw = await readRaw();
    if (!raw) return EMPTY_STORE();
    return asStore(JSON.parse(raw));
  } catch {
    return EMPTY_STORE();
  }
}

async function writeStore(file: StoreFile): Promise<void> {
  await writeRaw(JSON.stringify(file));
}

export async function listDreamDestinations(userId: string): Promise<DreamDestination[]> {
  const uid = String(userId || "").trim();
  if (!uid) return [];
  const file = await readStore();
  const rows = file.byUser[uid] || [];
  return [...rows].sort((a, b) => a.priority - b.priority || a.name.localeCompare(b.name));
}

export async function primaryDreamDestination(userId: string): Promise<DreamDestination | null> {
  const list = await listDreamDestinations(userId);
  return list[0] || null;
}

export async function saveDreamDestination(input: {
  userId: string;
  name: string;
  timing?: string;
  styles?: TravelStyle[];
  id?: string;
}): Promise<DreamDestination> {
  const name = String(input.name || "").trim();
  if (name.length < 2) throw new Error("Destination name is required.");
  const uid = String(input.userId || "").trim();
  if (!uid) throw new Error("Sign in before saving a dream destination.");
  const file = await readStore();
  const current = file.byUser[uid] || [];
  const now = new Date().toISOString();
  const existing = input.id ? current.find((d) => d.id === input.id) : undefined;
  const row: DreamDestination = existing
    ? {
        ...existing,
        name,
        timing: input.timing?.trim() || existing.timing,
        styles: input.styles ?? existing.styles,
        updatedAt: now,
      }
    : {
        id: `dream_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
        name,
        timing: input.timing?.trim() || undefined,
        styles: input.styles || [],
        priority: current.length,
        createdAt: now,
        updatedAt: now,
      };
  const others = current.filter((d) => d.id !== row.id);
  /** Newest primary when adding a fresh destination. */
  const destinations = existing
    ? [...others, row]
    : [{ ...row, priority: 0 }, ...others.map((d, i) => ({ ...d, priority: i + 1 }))];
  await writeStore({ ...file, byUser: { ...file.byUser, [uid]: destinations } });
  return row;
}

export async function removeDreamDestination(userId: string, id: string): Promise<void> {
  const uid = String(userId || "").trim();
  if (!uid) return;
  const file = await readStore();
  const current = file.byUser[uid] || [];
  await writeStore({
    ...file,
    byUser: {
      ...file.byUser,
      [uid]: current.filter((d) => d.id !== id).map((d, i) => ({ ...d, priority: i })),
    },
  });
}

export async function setPrimaryDreamDestination(userId: string, id: string): Promise<void> {
  const uid = String(userId || "").trim();
  if (!uid) return;
  const file = await readStore();
  const current = file.byUser[uid] || [];
  const hit = current.find((d) => d.id === id);
  if (!hit) return;
  const rest = current.filter((d) => d.id !== id);
  await writeStore({
    ...file,
    byUser: {
      ...file.byUser,
      [uid]: [{ ...hit, priority: 0, updatedAt: new Date().toISOString() }, ...rest.map((d, i) => ({ ...d, priority: i + 1 }))],
    },
  });
}

/** Curated suggestions — not live inventory. */
export const DREAM_DESTINATION_SUGGESTIONS = [
  "Vietnam",
  "Japan",
  "Portugal",
  "Morocco",
  "Greece islands",
  "Italy",
  "Thailand",
  "Mexico",
] as const;
