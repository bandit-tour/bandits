import * as ImagePicker from "expo-image-picker";
import { Platform } from "react-native";

import { supabase } from "@/lib/supabase";
import {
  TRAVEL_MEMORY_MAX_IMAGE_BYTES,
  TRAVEL_MEMORY_MAX_VIDEO_BYTES,
  type TravelMemoryMedia,
  type TravelMemoryMediaKind,
} from "@/lib/travel-memory/types";

const BUCKET = "guest_travel_memory";

function newMediaId(): string {
  return `tm_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

async function uriToBytes(uri: string): Promise<{ bytes: ArrayBuffer; mime: string; size: number }> {
  const res = await fetch(uri);
  const blob = await res.blob();
  const mime = blob.type || "application/octet-stream";
  const bytes = await blob.arrayBuffer();
  return { bytes, mime, size: bytes.byteLength };
}

/** Prefer private signed URL; fall back to public URL if bucket is public. */
async function resolveStorageUri(path: string): Promise<string> {
  const { data: signed } = await supabase.storage.from(BUCKET).createSignedUrl(path, 60 * 60 * 24 * 7);
  if (signed?.signedUrl) return signed.signedUrl;
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

export async function pickTravelMemoryImages(): Promise<TravelMemoryMedia[]> {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) throw new Error("Photo library permission is required.");
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    allowsMultipleSelection: true,
    quality: 0.85,
    selectionLimit: 8,
  });
  if (result.canceled) return [];
  const out: TravelMemoryMedia[] = [];
  for (const asset of result.assets) {
    out.push({
      id: newMediaId(),
      kind: "image",
      uri: asset.uri,
      mimeType: asset.mimeType || "image/jpeg",
      byteSize: asset.fileSize ?? null,
    });
  }
  return out;
}

export async function pickTravelMemoryVideo(): Promise<TravelMemoryMedia | null> {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) throw new Error("Photo library permission is required.");
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["videos"],
    allowsMultipleSelection: false,
    quality: 0.8,
    videoMaxDuration: 90,
  });
  if (result.canceled || !result.assets[0]) return null;
  const asset = result.assets[0]!;
  if (asset.fileSize && asset.fileSize > TRAVEL_MEMORY_MAX_VIDEO_BYTES) {
    throw new Error("Video is too large (max about 40 MB). Try a shorter clip.");
  }
  return {
    id: newMediaId(),
    kind: "video",
    uri: asset.uri,
    mimeType: asset.mimeType || "video/mp4",
    byteSize: asset.fileSize ?? null,
  };
}

/**
 * Persist media for an owned Moment.
 * Uploads to Supabase when signed in; otherwise keeps a durable data URI on web / file URI on native.
 */
export async function persistTravelMedia(
  userId: string,
  media: TravelMemoryMedia,
  onProgress?: (pct: number) => void,
): Promise<TravelMemoryMedia> {
  onProgress?.(0.05);
  const uid = String(userId || "").trim();
  const kind: TravelMemoryMediaKind = media.kind;

  /** Already remote */
  if (/^https?:\/\//i.test(media.uri) && media.storagePath) {
    onProgress?.(1);
    return media;
  }

  try {
    const { bytes, mime, size } = await uriToBytes(media.uri);
    if (kind === "image" && size > TRAVEL_MEMORY_MAX_IMAGE_BYTES) {
      throw new Error("Photo is too large (max about 12 MB).");
    }
    if (kind === "video" && size > TRAVEL_MEMORY_MAX_VIDEO_BYTES) {
      throw new Error("Video is too large (max about 40 MB).");
    }
    onProgress?.(0.25);

    if (uid && !uid.startsWith("local_")) {
      const ext =
        kind === "video"
          ? mime.includes("webm")
            ? "webm"
            : "mp4"
          : mime.includes("png")
            ? "png"
            : "jpg";
      const path = `${uid}/${media.id}.${ext}`;
      const { error } = await supabase.storage.from(BUCKET).upload(path, bytes, {
        contentType: mime,
        upsert: true,
      });
      if (!error) {
        onProgress?.(0.85);
        const uri = await resolveStorageUri(path);
        onProgress?.(1);
        return { ...media, uri, storagePath: path, mimeType: mime, byteSize: size };
      }
    }

    /** Local durable fallback (web): data URI survives refresh in AsyncStorage. */
    if (Platform.OS === "web" && typeof btoa === "function") {
      onProgress?.(0.6);
      const b64 = arrayBufferToBase64(bytes);
      const dataUri = `data:${mime};base64,${b64}`;
      onProgress?.(1);
      return { ...media, uri: dataUri, mimeType: mime, byteSize: size, storagePath: null };
    }

    /** Native: keep file:// URI from the picker (AsyncStorage holds the path). */
    onProgress?.(1);
    return { ...media, mimeType: mime, byteSize: size };
  } catch (e) {
    throw e instanceof Error ? e : new Error("Could not save media.");
  }
}

export async function deleteTravelMediaFromStorage(media: TravelMemoryMedia): Promise<void> {
  const path = String(media.storagePath || "").trim();
  if (!path) return;
  try {
    await supabase.storage.from(BUCKET).remove([path]);
  } catch {
    /* best-effort */
  }
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}
