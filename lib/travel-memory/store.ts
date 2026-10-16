import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";

import { supabase } from "@/lib/supabase";
import { deleteTravelMediaFromStorage, persistTravelMedia } from "@/lib/travel-memory/media";
import type { TravelMemory, TravelMemoryMedia } from "@/lib/travel-memory/types";

const KEY = "@bandits_travel_memories_v1";

async function readRaw(): Promise<string | null> {
  try {
    if (Platform.OS === "web" && typeof window !== "undefined") {
      return window.localStorage.getItem(KEY);
    }
    return await AsyncStorage.getItem(KEY);
  } catch {
    return null;
  }
}

async function writeRaw(value: string): Promise<void> {
  try {
    if (Platform.OS === "web" && typeof window !== "undefined") {
      window.localStorage.setItem(KEY, value);
      return;
    }
    await AsyncStorage.setItem(KEY, value);
  } catch {
    /* best-effort */
  }
}

function newId(): string {
  return `pm_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
}

function normalize(m: TravelMemory): TravelMemory {
  return {
    ...m,
    title: String(m.title || "").trim(),
    story: String(m.story || "").trim(),
    city: String(m.city || "").trim() || "Athens",
    placeLabel: m.placeLabel ? String(m.placeLabel).trim() : null,
    visibility: m.visibility === "shared" ? "shared" : "private",
    bottleShareOptIn: m.bottleShareOptIn === true,
    media: Array.isArray(m.media) ? m.media : [],
  };
}

export async function listTravelMemories(userId?: string | null): Promise<TravelMemory[]> {
  const raw = await readRaw();
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw) as TravelMemory[];
    if (!Array.isArray(arr)) return [];
    const uid = String(userId || "").trim();
    const list = arr.map(normalize).filter((m) => m.id && m.title);
    const owned = uid ? list.filter((m) => !m.userId || m.userId === uid || m.userId === "self") : list;
    return owned.sort(
      (a, b) => new Date(b.occurredAt || b.updatedAt).getTime() - new Date(a.occurredAt || a.updatedAt).getTime(),
    );
  } catch {
    return [];
  }
}

async function writeAll(list: TravelMemory[]): Promise<void> {
  await writeRaw(JSON.stringify(list.map(normalize)));
}

export async function getTravelMemory(id: string, userId?: string | null): Promise<TravelMemory | null> {
  const list = await listTravelMemories(userId);
  return list.find((m) => m.id === id) || null;
}

export type SaveTravelMemoryInput = {
  id?: string;
  userId: string;
  title: string;
  story: string;
  city: string;
  placeLabel?: string | null;
  occurredAt: string;
  media: TravelMemoryMedia[];
  /** Always private unless explicitly shared (future). */
  visibility?: "private" | "shared";
  bottleShareOptIn?: boolean;
  onMediaProgress?: (done: number, total: number) => void;
};

export async function saveTravelMemory(input: SaveTravelMemoryInput): Promise<TravelMemory> {
  const title = String(input.title || "").trim();
  if (!title) throw new Error("Give your Moment a title.");
  const userId = String(input.userId || "self").trim() || "self";
  const list = await listTravelMemories();
  const existing = input.id ? list.find((m) => m.id === input.id) : null;
  if (existing && existing.userId && existing.userId !== userId && existing.userId !== "self") {
    throw new Error("You can only edit your own Moments.");
  }

  const persistedMedia: TravelMemoryMedia[] = [];
  const total = Math.max(1, input.media.length);
  let done = 0;
  for (const m of input.media) {
    const next = await persistTravelMedia(userId, m, () => {
      input.onMediaProgress?.(done, total);
    });
    persistedMedia.push(next);
    done += 1;
    input.onMediaProgress?.(done, total);
  }

  /** Drop removed remote files from previous version. */
  if (existing) {
    const keep = new Set(persistedMedia.map((m) => m.id));
    for (const old of existing.media) {
      if (!keep.has(old.id)) await deleteTravelMediaFromStorage(old);
    }
  }

  const now = new Date().toISOString();
  const row: TravelMemory = normalize({
    id: existing?.id || input.id || newId(),
    userId,
    title,
    story: String(input.story || "").trim(),
    city: String(input.city || "Athens").trim() || "Athens",
    placeLabel: input.placeLabel ? String(input.placeLabel).trim() : null,
    occurredAt: input.occurredAt || now,
    media: persistedMedia,
    visibility: "private",
    bottleShareOptIn: false,
    createdAt: existing?.createdAt || now,
    updatedAt: now,
  });

  const nextList = [row, ...list.filter((m) => m.id !== row.id)];
  await writeAll(nextList);
  void syncTravelMemoryRow(row).catch(() => undefined);
  return row;
}

export async function deleteTravelMemory(id: string, userId?: string | null): Promise<void> {
  const list = await listTravelMemories();
  const row = list.find((m) => m.id === id);
  if (!row) return;
  const uid = String(userId || "").trim();
  if (uid && row.userId && row.userId !== uid && row.userId !== "self") {
    throw new Error("You can only delete your own Moments.");
  }
  for (const m of row.media) await deleteTravelMediaFromStorage(m);
  await writeAll(list.filter((m) => m.id !== id));
  void deleteTravelMemoryRemote(id).catch(() => undefined);
}

async function syncTravelMemoryRow(row: TravelMemory): Promise<void> {
  if (!row.userId || row.userId === "self") return;
  try {
    await supabase.from("guest_personal_moments" as never).upsert(
      {
        id: row.id,
        user_id: row.userId,
        title: row.title,
        story: row.story,
        city: row.city,
        place_label: row.placeLabel,
        occurred_at: row.occurredAt,
        media: row.media,
        visibility: row.visibility,
        bottle_share_opt_in: false,
        updated_at: row.updatedAt,
        created_at: row.createdAt,
      } as never,
      { onConflict: "id" },
    );
  } catch {
    /* table may not be applied yet — local persist still holds */
  }
}

async function deleteTravelMemoryRemote(id: string): Promise<void> {
  try {
    await supabase.from("guest_personal_moments" as never).delete().eq("id", id);
  } catch {
    /* ignore */
  }
}

/** Cover URI for rails — first image, else null (never invent stock). */
export function travelMemoryCoverUri(m: TravelMemory): string | null {
  const img = m.media.find((x) => x.kind === "image" && x.uri);
  return img?.uri || null;
}
