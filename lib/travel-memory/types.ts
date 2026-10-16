/**
 * Personal travel Moments — private journal entries with owned media.
 * Distinct from daily bottle GuestMoment and static profile TravelMoment seeds.
 */

export type TravelMemoryMediaKind = "image" | "video";

export type TravelMemoryMedia = {
  id: string;
  kind: TravelMemoryMediaKind;
  /** https URL (Supabase) or data:/blob: URI (local draft / web persist). */
  uri: string;
  /** Storage object path when uploaded to Supabase (for delete). */
  storagePath?: string | null;
  mimeType?: string | null;
  byteSize?: number | null;
};

export type TravelMemoryVisibility = "private" | "shared";

export type TravelMemory = {
  id: string;
  userId: string;
  title: string;
  story: string;
  city: string;
  placeLabel: string | null;
  occurredAt: string;
  media: TravelMemoryMedia[];
  /** Private by default — never bottle-eligible without explicit opt-in elsewhere. */
  visibility: TravelMemoryVisibility;
  /** Separate from visibility: social Bottle discovery pool (default false). */
  bottleShareOptIn: boolean;
  createdAt: string;
  updatedAt: string;
};

export const TRAVEL_MEMORY_MAX_PHOTOS = 8;
export const TRAVEL_MEMORY_MAX_VIDEOS = 2;
/** ~40MB soft cap for a single video (client-side). */
export const TRAVEL_MEMORY_MAX_VIDEO_BYTES = 40 * 1024 * 1024;
export const TRAVEL_MEMORY_MAX_IMAGE_BYTES = 12 * 1024 * 1024;
