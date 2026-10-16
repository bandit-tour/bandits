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

type FileShape = {
  userId: string;
  destinations: DreamDestination[];
};

const EMPTY = (userId: string): FileShape => ({ userId, destinations: [] });

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

async function readFile(userId: string): Promise<FileShape> {
  try {
    const raw = await readRaw();
    if (!raw) return EMPTY(userId);
    const parsed = JSON.parse(raw) as FileShape;
    if (!parsed || !Array.isArray(parsed.destinations)) return EMPTY(userId);
    if (parsed.userId && parsed.userId !== userId) {
      return { userId, destinations: parsed.destinations.map((d) => ({ ...d })) };
    }
    return { userId, destinations: parsed.destinations };
  } catch {
    return EMPTY(userId);
  }
}

async function writeFile(file: FileShape): Promise<void> {
  await writeRaw(JSON.stringify(file));
}

export async function listDreamDestinations(userId: string): Promise<DreamDestination[]> {
  const file = await readFile(userId);
  return [...file.destinations].sort((a, b) => a.priority - b.priority || a.name.localeCompare(b.name));
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
  const file = await readFile(input.userId);
  const now = new Date().toISOString();
  const existing = input.id ? file.destinations.find((d) => d.id === input.id) : undefined;
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
        priority: file.destinations.length,
        createdAt: now,
        updatedAt: now,
      };
  const others = file.destinations.filter((d) => d.id !== row.id);
  /** Newest primary when adding a fresh destination. */
  const destinations = existing
    ? [...others, row]
    : [{ ...row, priority: 0 }, ...others.map((d, i) => ({ ...d, priority: i + 1 }))];
  await writeFile({ userId: input.userId, destinations });
  return row;
}

export async function removeDreamDestination(userId: string, id: string): Promise<void> {
  const file = await readFile(userId);
  await writeFile({
    userId,
    destinations: file.destinations.filter((d) => d.id !== id).map((d, i) => ({ ...d, priority: i })),
  });
}

export async function setPrimaryDreamDestination(userId: string, id: string): Promise<void> {
  const file = await readFile(userId);
  const hit = file.destinations.find((d) => d.id === id);
  if (!hit) return;
  const rest = file.destinations.filter((d) => d.id !== id);
  await writeFile({
    userId,
    destinations: [{ ...hit, priority: 0, updatedAt: new Date().toISOString() }, ...rest.map((d, i) => ({ ...d, priority: i + 1 }))],
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
