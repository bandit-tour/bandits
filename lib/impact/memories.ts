/**
 * Personal volunteering photos on the Impact Passport.
 * Private to the guest. A photo is never attendance evidence and never awards Drops.
 * Signed-in owners upload into the existing private `guest_travel_memory` bucket
 * (the same library as City Memory). Workspace has no photo bucket.
 * If that upload is not available, the photo stays in the guest's private device
 * vault so a refresh still shows it. Share text never includes these files.
 */
import { Platform } from "react-native";

import { deleteTravelMediaFromStorage, persistTravelMedia } from "@/lib/travel-memory/media";

const KEY = "@bandits_impact_memories_v1";
const MAX_PHOTOS = 8;

export type ImpactMemoryVisibility = "shown" | "hidden";

export type ImpactMemory = {
  id: string;
  userId: string;
  uri: string;
  storagePath: string | null;
  mimeType: string;
  createdAt: string;
  visibility: ImpactMemoryVisibility;
};

async function readRaw(): Promise<string | null> {
  try {
    if (Platform.OS === "web" && typeof window !== "undefined") {
      return window.localStorage.getItem(KEY);
    }
    const AsyncStorage = (await import("@react-native-async-storage/async-storage")).default;
    return AsyncStorage.getItem(KEY);
  } catch {
    return null;
  }
}

async function writeRaw(value: string): Promise<void> {
  if (Platform.OS === "web" && typeof window !== "undefined") {
    window.localStorage.setItem(KEY, value);
    return;
  }
  const AsyncStorage = (await import("@react-native-async-storage/async-storage")).default;
  await AsyncStorage.setItem(KEY, value);
}

async function readAll(): Promise<ImpactMemory[]> {
  const raw = await readRaw();
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as ImpactMemory[];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((row) => row && typeof row.id === "string" && typeof row.uri === "string");
  } catch {
    return [];
  }
}

async function writeAll(rows: ImpactMemory[]): Promise<void> {
  await writeRaw(JSON.stringify(rows));
}

export async function listImpactMemories(userId: string): Promise<ImpactMemory[]> {
  const uid = String(userId || "guest").trim() || "guest";
  const rows = await readAll();
  return rows
    .filter((row) => row.userId === uid)
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

/** Shrink a picked image to a durable JPEG before it is stored. Web only. */
export async function blobToJpegDataUrl(blob: Blob): Promise<string> {
  if (Platform.OS !== "web" || typeof document === "undefined") {
    throw new Error("Photo upload is available in the browser.");
  }
  const url = URL.createObjectURL(blob);
  try {
    const img = await loadImage(url);
    const max = 960;
    const scale = Math.min(1, max / Math.max(img.width, img.height));
    const w = Math.max(1, Math.round(img.width * scale));
    const h = Math.max(1, Math.round(img.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Could not read that photo.");
    ctx.drawImage(img, 0, 0, w, h);
    const uri = canvas.toDataURL("image/jpeg", 0.68);
    if (uri.length > 1_400_000) throw new Error("That photo is too large. Try a smaller one.");
    return uri;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not read that photo."));
    img.src = url;
  });
}

export async function addImpactMemory(input: {
  userId: string;
  uri: string;
  mimeType?: string | null;
}): Promise<ImpactMemory> {
  const userId = String(input.userId || "guest").trim() || "guest";
  const existing = await listImpactMemories(userId);
  if (existing.length >= MAX_PHOTOS) {
    throw new Error("You can keep up to 8 private photos.");
  }
  const id = `im_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  const signedIn = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId);
  let uri = input.uri;
  let storagePath: string | null = null;
  let mimeType = input.mimeType || "image/jpeg";
  try {
    const persisted = await persistTravelMedia(signedIn ? userId : "local_guest", {
      id,
      kind: "image",
      uri: input.uri,
      mimeType,
      storagePath: null,
    });
    uri = persisted.uri;
    storagePath = persisted.storagePath || null;
    mimeType = persisted.mimeType || mimeType;
  } catch (err) {
    if (!input.uri.startsWith("data:") && !input.uri.startsWith("file:")) {
      throw err instanceof Error ? err : new Error("Could not save that photo.");
    }
  }
  const row: ImpactMemory = {
    id,
    userId,
    uri,
    storagePath,
    mimeType,
    createdAt: new Date().toISOString(),
    visibility: "shown",
  };
  const all = await readAll();
  await writeAll([row, ...all.filter((item) => item.id !== row.id)].slice(0, 40));
  return row;
}

export async function setImpactMemoryVisibility(
  userId: string,
  id: string,
  visibility: ImpactMemoryVisibility,
): Promise<void> {
  const uid = String(userId || "guest").trim() || "guest";
  const all = await readAll();
  const next = all.map((row) => (row.id === id && row.userId === uid ? { ...row, visibility } : row));
  await writeAll(next);
}

export async function deleteImpactMemory(userId: string, id: string): Promise<void> {
  const uid = String(userId || "guest").trim() || "guest";
  const all = await readAll();
  const row = all.find((item) => item.id === id && item.userId === uid);
  if (!row) return;
  if (row.storagePath) {
    await deleteTravelMediaFromStorage({
      id: row.id,
      kind: "image",
      uri: row.uri,
      storagePath: row.storagePath,
      mimeType: row.mimeType,
    });
  }
  await writeAll(all.filter((item) => item.id !== id));
}
