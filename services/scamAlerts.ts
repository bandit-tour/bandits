import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';

import { getPilotApiBaseUrl } from '@/lib/pilotApiBase';
import { ensureAnonymousSession } from '@/lib/pilotSession';
import { requestNotificationsRefresh } from '@/lib/notificationEvents';
import { renderSafeText } from '@/lib/renderSafeText';
import { supabase } from '@/lib/supabase';
import { trackEvent } from '@/lib/analytics';

/** Shown on the public scam-alerts feed */
export const SCAM_ALERT_CATEGORIES = [
  'Taxi / transport',
  'Tourist trap',
  'Street scam',
  'Venue / nightlife',
  'Pickpocket / theft',
  'Other',
] as const;

export type ScamAlertRow = {
  id: string;
  city: string;
  location: string;
  title: string;
  description: string;
  reported_by: string | null;
  created_at: string;
  image_url?: string | null;
  category: string;
  severity: number;
  /** Present when DB columns exist and values are finite */
  location_lat?: number | null;
  location_lng?: number | null;
  /** When `admin_verified` column exists on `scam_alerts` and is true */
  admin_verified?: boolean;
  /** `published` | `hidden` | `rejected` — RLS hides non-published from public feed */
  moderation_status?: string;
};

const SELECT_FULL =
  'id,city,location,title,description,reported_by,created_at,image_url,category,severity,admin_verified,moderation_status';
const SELECT_FULL_COORDS = `${SELECT_FULL},location_lat,location_lng`;
const SELECT_LEGACY = 'id,city,location,title,description,reported_by,created_at,image_url';

function isMissingScamColumnError(message: string): boolean {
  const m = message.toLowerCase();
  return (
    m.includes('does not exist') ||
    (m.includes('column') &&
      (m.includes('category') ||
        m.includes('severity') ||
        m.includes('location_lat') ||
        m.includes('admin_verified') ||
        m.includes('moderation_status')))
  );
}

type NormalizeOpts = { hasCategorySeverity: boolean; hasCoords: boolean };

function normalizeRows(data: unknown, opts: NormalizeOpts): ScamAlertRow[] {
  const rows = (data as Record<string, unknown>[]) ?? [];
  return rows.map((r) => {
    let location_lat: number | null = null;
    let location_lng: number | null = null;
    if (opts.hasCoords) {
      const la = Number(r.location_lat);
      const lo = Number(r.location_lng);
      location_lat = Number.isFinite(la) ? la : null;
      location_lng = Number.isFinite(lo) ? lo : null;
    }
    const modRaw = r.moderation_status;
    const moderation_status =
      renderSafeText(modRaw, '').trim() || 'published';
    const admin_verified = r.admin_verified === true ? true : undefined;
    const reportedByRaw = r.reported_by;
    const reported_by =
      reportedByRaw == null || reportedByRaw === ''
        ? null
        : renderSafeText(reportedByRaw, '') || null;
    const imgRaw = r.image_url;
    const image_url =
      imgRaw == null || imgRaw === '' ? null : renderSafeText(imgRaw, '') || null;
    const out: ScamAlertRow = {
      id: renderSafeText(r.id, ''),
      city: renderSafeText(r.city, ''),
      location: renderSafeText(r.location, ''),
      title: renderSafeText(r.title, ''),
      description: renderSafeText(r.description, ''),
      reported_by,
      created_at: renderSafeText(r.created_at, ''),
      image_url,
      category: opts.hasCategorySeverity ? renderSafeText(r.category, 'Other') || 'Other' : 'Other',
      severity: opts.hasCategorySeverity
        ? Math.min(3, Math.max(1, Number(r.severity ?? 2) || 2))
        : 2,
      location_lat,
      location_lng,
      moderation_status,
    };
    if (admin_verified) out.admin_verified = true;
    return out;
  });
}

export type SubmitScamAlertInput = {
  city: string;
  location: string;
  title: string;
  description: string;
  category?: string;
  /** 1–3, default 2 */
  severity?: number;
  /** Local file URI from ImagePicker — uploaded to storage, URL stored on row */
  imageUri?: string | null;
};

function base64ToBlob(base64: string, mime: string): Blob {
  const clean = base64.includes(',') ? base64.split(',').pop() ?? base64 : base64;
  const binary = globalThis.atob(clean);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

/**
 * Android `content://` URIs often fail with `fetch(uri)` (“Network request failed”);
 * read bytes via expo-file-system instead.
 */
async function uploadReportImage(userId: string, localUri: string): Promise<string | null> {
  const path = `scam_reports/${userId}/${Date.now()}.jpg`;
  try {
    let blob: Blob;
    if (Platform.OS === 'web') {
      const res = await fetch(localUri);
      blob = await res.blob();
    } else {
      const base64 = await FileSystem.readAsStringAsync(localUri, {
        encoding: 'base64',
      });
      blob = base64ToBlob(base64, 'image/jpeg');
    }
    const { data, error } = await supabase.storage.from('profile_avatars').upload(path, blob, {
      contentType: 'image/jpeg',
      upsert: false,
    });
    if (error) {
      throw new Error(error.message || 'Image upload failed.');
    }
    const {
      data: { publicUrl },
    } = supabase.storage.from('profile_avatars').getPublicUrl(data.path);
    return publicUrl;
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : '';
    throw new Error(msg || 'Image upload failed.');
  }
}

async function submitScamAlertViaServerApi(
  accessToken: string,
  input: SubmitScamAlertInput,
  imageUrl: string | null,
  category: string,
  severity: number,
): Promise<void> {
  const base = getPilotApiBaseUrl();
  if (!base) throw new Error('Report server route unavailable.');
  const res = await fetch(`${base}/api/scam-report`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      city: input.city.trim(),
      location: input.location.trim(),
      title: input.title.trim(),
      description: input.description.trim(),
      category,
      severity,
      imageUrl: imageUrl || undefined,
    }),
  });
  const j = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) throw new Error((j && j.error) || 'Could not save report.');
}

/**
 * Persists a bandiTEAM scam alert to `public.scam_alerts`.
 * Guest (anonymous) sessions are supported; production uses a server route when RLS would block the client.
 */
export async function submitScamAlert(input: SubmitScamAlertInput): Promise<void> {
  await ensureAnonymousSession();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  let user = session?.user ?? null;
  let accessToken = session?.access_token ?? '';
  if (!user) {
    const {
      data: { user: fetchedUser },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError) throw new Error(authError.message || 'Could not verify your session.');
    user = fetchedUser;
    const s2 = await supabase.auth.getSession();
    accessToken = s2.data.session?.access_token ?? accessToken;
  }
  if (!user) throw new Error('Could not start a session. Try again in a moment.');

  let imageUrl: string | null = null;
  if (input.imageUri?.trim()) {
    try {
      imageUrl = await uploadReportImage(user.id, input.imageUri.trim());
    } catch (uploadErr) {
      const m = uploadErr instanceof Error ? uploadErr.message : String(uploadErr);
      console.warn('[submitScamAlert] image upload failed, saving report without image:', m);
    }
  }

  const rawCat = input.category?.trim() ?? '';
  const category = (SCAM_ALERT_CATEGORIES as readonly string[]).includes(rawCat) ? rawCat : 'Other';
  let sev = Math.round(Number(input.severity ?? 2));
  if (!Number.isFinite(sev)) sev = 2;
  const severity = Math.min(3, Math.max(1, sev));

  const rowFull = {
    city: input.city.trim(),
    location: input.location.trim(),
    title: input.title.trim(),
    description: input.description.trim(),
    reported_by: user.id,
    category,
    severity,
    image_url: imageUrl ?? undefined,
    moderation_status: 'published' as const,
    admin_verified: false,
  };

  async function insertDirect(): Promise<{ ok: boolean; lastError: { message?: string } | null }> {
    let { error } = await supabase.from('scam_alerts').insert(rowFull as any);
    if (error && isMissingScamColumnError(error.message ?? '')) {
      const rowLegacy = {
        city: rowFull.city,
        location: rowFull.location,
        title: rowFull.title,
        description: rowFull.description,
        reported_by: rowFull.reported_by,
        ...(imageUrl ? { image_url: imageUrl } : {}),
      };
      const second = await supabase.from('scam_alerts').insert(rowLegacy as any);
      error = second.error;
    }
    return { ok: !error, lastError: error };
  }

  /**
   * Prefer direct insert so production works without Vercel `SUPABASE_SERVICE_ROLE_KEY`.
   * `/api/scam-report` is only a fallback when the client insert fails (e.g. unusual RLS).
   */
  const direct = await insertDirect();
  if (direct.ok) {
    void trackEvent({
      eventName: 'bandiTEAM_report_created',
      referenceType: 'report',
      referenceId: String(rowFull.title),
    });
    void trackEvent({
      eventName: 'banditeam_report_submit_success',
      referenceType: 'city',
      referenceId: rowFull.city,
    });
    requestNotificationsRefresh();
    return;
  }

  const apiBase = getPilotApiBaseUrl();
  if (apiBase && accessToken) {
    try {
      await submitScamAlertViaServerApi(accessToken, input, imageUrl, category, severity);
      void trackEvent({
        eventName: 'bandiTEAM_report_created',
        referenceType: 'report',
        referenceId: String(rowFull.title),
      });
      void trackEvent({
        eventName: 'banditeam_report_submit_success',
        referenceType: 'city',
        referenceId: rowFull.city,
      });
      requestNotificationsRefresh();
      return;
    } catch (e) {
      const apiMsg = e instanceof Error ? e.message : String(e);
      const dbMsg = direct.lastError?.message?.trim();
      console.warn('[submitScamAlert] direct insert failed; API fallback failed:', apiMsg, dbMsg);
      throw new Error(dbMsg || apiMsg || 'Could not save report.');
    }
  }

  throw new Error(direct.lastError?.message || 'Could not save report.');
}

async function selectScamAlertRowById(
  rid: string,
  selectList: string,
): Promise<{ data: Record<string, unknown> | null; error: { message?: string } | null }> {
  const res = await supabase.from('scam_alerts').select(selectList).eq('id', rid).maybeSingle();
  return { data: (res.data as Record<string, unknown> | null) ?? null, error: res.error };
}

/**
 * Single alert for detail screen (same RLS as list).
 * Tries richer column sets first, then falls back for older schemas.
 */
export async function fetchScamAlertById(id: string): Promise<ScamAlertRow | null> {
  const rid = String(id || '').trim();
  if (!rid) return null;

  const attempts: { select: string; opts: NormalizeOpts }[] = [
    { select: SELECT_FULL_COORDS, opts: { hasCategorySeverity: true, hasCoords: true } },
    { select: SELECT_FULL, opts: { hasCategorySeverity: true, hasCoords: false } },
    { select: SELECT_LEGACY, opts: { hasCategorySeverity: false, hasCoords: false } },
  ];

  for (const a of attempts) {
    const { data, error } = await selectScamAlertRowById(rid, a.select);
    if (!error && data) {
      return normalizeRows([data], a.opts)[0] ?? null;
    }
    if (!error && !data) {
      return null;
    }
    if (error && !isMissingScamColumnError(String(error.message || ''))) {
      return null;
    }
  }
  return null;
}

/**
 * Authenticated read of scam alerts for transparency feed.
 * Pass `city` to scope to destination; omit for global (all cities).
 */
export async function fetchScamAlerts(options: { city?: string | null }): Promise<ScamAlertRow[]> {
  const c = options.city?.trim();

  async function runSelect(selectList: string, opts: NormalizeOpts): Promise<ScamAlertRow[]> {
    let q = supabase
      .from('scam_alerts')
      .select(selectList)
      .order('created_at', { ascending: false })
      .limit(100);
    if (c) {
      q = q.eq('city', c);
    }
    if (selectList.includes('moderation_status')) {
      q = q.or('moderation_status.is.null,moderation_status.eq.published');
    }
    const { data, error } = await q;
    if (error) {
      throw error;
    }
    return normalizeRows(data, opts);
  }

  const attempts: { select: string; opts: NormalizeOpts }[] = [
    { select: SELECT_FULL_COORDS, opts: { hasCategorySeverity: true, hasCoords: true } },
    { select: SELECT_FULL, opts: { hasCategorySeverity: true, hasCoords: false } },
    { select: SELECT_LEGACY, opts: { hasCategorySeverity: false, hasCoords: false } },
  ];

  for (const a of attempts) {
    try {
      return await runSelect(a.select, a.opts);
    } catch (e: unknown) {
      const msg = renderSafeText(e, '') || (e instanceof Error ? renderSafeText(e.message, '') : '');
      if (!isMissingScamColumnError(msg)) {
        throw new Error(msg || 'Could not load alerts.');
      }
    }
  }
  return [];
}

/**
 * Other alerts in the same city, ranked by text-location similarity and recency.
 */
export async function fetchRelatedScamAlerts(args: {
  excludeId: string;
  city: string;
  location: string;
  category?: string;
  limit?: number;
}): Promise<ScamAlertRow[]> {
  const limit = Math.min(Math.max(args.limit ?? 6, 1), 20);
  const city = args.city?.trim();
  if (!city) return [];
  const all = await fetchScamAlerts({ city });
  const needle = args.location.trim().toLowerCase();
  const needleKey = needle.slice(0, 18);
  const cat = (args.category || '').trim();
  const scored = all
    .filter((a) => a.id !== args.excludeId)
    .map((a) => {
      const loc = a.location.trim().toLowerCase();
      let score = 0;
      if (needleKey.length >= 6 && loc.includes(needleKey)) score += 4;
      if (needle.length >= 8 && loc.slice(0, 24) === needle.slice(0, 24)) score += 6;
      if (cat && (a.category || '').trim() === cat) score += 1;
      const t = new Date(a.created_at).getTime();
      return { a, score, t };
    });
  scored.sort((x, y) => (y.score !== x.score ? y.score - x.score : y.t - x.t));
  return scored.slice(0, limit).map((s) => s.a);
}
