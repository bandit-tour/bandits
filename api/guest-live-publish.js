/**
 * Workspace publish → guest_live_events (Guest App subscribes via Realtime).
 * POST { event_type, workspace, title, detail?, entity_id?, property_slug?, destination?, payload? }
 */

import { createClient } from '@supabase/supabase-js';

const TYPES = new Set([
  'hotelier.rooftop_event.published',
  'hotelier.campaign.published',
  'hotelier.message.published',
  'hotelier.upsell.published',
  'bandit.premium_insight.published',
  'bandit.profile.updated',
  'bandit.story.published',
  'bandit.guide.published',
  'experience.listed',
  'experience.availability.changed',
  'experience.booked',
  'commerce.booking.confirmed',
  'commerce.payment.confirmed',
  'admin.destination_alert.published',
  'impact.action.completed',
  'creative.campaign.published',
  'connection.campaign.live',
  'intelligence.nba.ready',
]);

function serviceClient() {
  const url = process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL || '';
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'POST only' });
    return;
  }

  const secret = process.env.GUEST_LIVE_PUBLISH_SECRET || '';
  const auth = String(req.headers.authorization || '');
  if (secret && auth !== `Bearer ${secret}`) {
    res.status(401).json({ ok: false, error: 'unauthorized' });
    return;
  }

  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
  const event_type = String(body.event_type || '').trim();
  const workspace = String(body.workspace || '').trim();
  const title = String(body.title || '').trim();

  if (!TYPES.has(event_type) || !workspace || !title) {
    res.status(400).json({
      ok: false,
      error: 'event_type (known), workspace, title required',
    });
    return;
  }

  const sb = serviceClient();
  if (!sb) {
    res.status(503).json({ ok: false, error: 'supabase service not configured' });
    return;
  }

  const row = {
    event_type,
    workspace,
    title,
    detail: body.detail ? String(body.detail) : null,
    entity_id: body.entity_id ? String(body.entity_id) : null,
    property_slug: body.property_slug ? String(body.property_slug) : null,
    destination: body.destination ? String(body.destination) : null,
    payload: body.payload && typeof body.payload === 'object' ? body.payload : {},
  };

  const projection = await projectApprovedBandit(sb, event_type, row);
  if (projection && projection.ok === false) {
    res.status(projection.status || 400).json({ ok: false, error: projection.error });
    return;
  }

  const { data, error } = await sb.from('guest_live_events').insert(row).select('*').single();
  if (error) {
    if (projection) {
      res.status(200).json({
        ok: true,
        event: null,
        guestBanditId: projection.guestBanditId || null,
        guestEventId: projection.guestEventId || null,
        guides: projection.guides || null,
        guide: projection.guide || null,
        previous: projection.previous || null,
        notice: 'The Local banDits list was updated. The activity log was not.',
      });
      return;
    }
    const missingRelation =
      error.code === '42P01' ||
      /guest_live_events/i.test(String(error.message || '')) ||
      /does not exist/i.test(String(error.message || ''));
    res.status(missingRelation ? 503 : 500).json({
      ok: false,
      error: missingRelation ? 'guest_live_events_missing' : error.message,
      code: error.code || null,
      dependency: missingRelation
        ? 'Apply supabase/migrations/065_guest_live_events.sql on production Supabase, then retry'
        : 'guest_live_events insert',
    });
    return;
  }

  res.status(200).json({
    ok: true,
    event: data,
    guestBanditId: projection?.guestBanditId || null,
    guestEventId: projection?.guestEventId || null,
    guides: projection?.guides || null,
    guide: projection?.guide || null,
    previous: projection?.previous || null,
  });
}

const NEO_GUEST_BANDIT_ID = 'd76cb120-018d-4a2e-8b5f-0578a71fd8f9';

function clean(value, max) {
  return String(value || '')
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '')
    .replace(/\+\d[\d\s().-]{8,}\d/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

function isNeo(id) {
  return String(id || '').trim().toLowerCase() === NEO_GUEST_BANDIT_ID;
}

/**
 * Editorial approval projects into the tables the existing Local banDits
 * template already reads: bandit, event, bandit_event.
 * One guest card per workspace recommendation (link = ws-spot:id). No Places.
 */
async function projectApprovedBandit(sb, eventType, row) {
  const payload = row.payload || {};
  if (payload.editorialApproved !== true) return null;

  if (payload.kind === 'list-guides' || payload.kind === 'read-guide') {
    return readCanonicalGuides(sb, payload);
  }

  if (payload.kind === 'update-existing') {
    return updateExistingRecommendation(sb, payload);
  }

  if (isNeo(payload.guestBanditId) || isNeo(row.entity_id)) {
    return { ok: false, status: 403, error: 'Refusing to write an existing contributor profile.' };
  }

  if (payload.kind === 'remove-identity') {
    const id = String(payload.guestBanditId || '');
    if (!id || isNeo(id)) return { ok: false, status: 403, error: 'Refusing that profile.' };
    const { data: existing } = await sb.from('bandit').select('id,name').eq('id', id).limit(1);
    const found = Array.isArray(existing) ? existing[0] : null;
    if (!found) return { guestBanditId: null };
    if (clean(found.name, 80) !== clean(payload.displayName, 80)) {
      return { ok: false, status: 403, error: 'Name does not match the isolated profile.' };
    }
    const { data: links } = await sb.from('bandit_event').select('event_id').eq('bandit_id', id);
    const eventIds = (Array.isArray(links) ? links : []).map((link) => link.event_id).filter(Boolean);
    if (eventIds.length) {
      const { data: owned } = await sb.from('event').select('id,link').in('id', eventIds);
      const ours = (Array.isArray(owned) ? owned : [])
        .filter((event) => String(event.link || '').startsWith('ws-spot:'))
        .map((event) => event.id);
      if (ours.length) {
        await sb.from('bandit_event').delete().in('event_id', ours).eq('bandit_id', id);
        await sb.from('event').delete().in('id', ours);
      }
    }
    await sb.from('bandit').delete().eq('id', id);
    return { guestBanditId: null };
  }

  if (payload.kind === 'identity' || payload.kind === 'story') {
    const displayName = clean(payload.displayName || row.title, 80);
    if (!displayName || /neo/i.test(displayName)) {
      return { ok: false, status: 400, error: 'A new Local banDit needs their own name.' };
    }
    const parts = displayName.split(' ');
    const story = clean(payload.story, 600);
    const fields = {
      name: displayName,
      family_name: parts.slice(1).join(' ') || 'Local',
      age: 0,
      city: clean(payload.city, 80) || 'Athens',
      occupation: 'Local banDit',
      image_url: '',
      rating: 0,
      description: story || null,
      why_follow: story || null,
    };
    const existingId = String(payload.guestBanditId || '').trim();
    if (existingId) {
      const { error } = await sb.from('bandit').update({
        description: fields.description,
        why_follow: fields.why_follow,
        city: fields.city,
      }).eq('id', existingId);
      if (error) return { ok: false, status: 500, error: error.message };
      return { guestBanditId: existingId };
    }
    const { data, error } = await sb.from('bandit').insert(fields).select('id').single();
    if (error) return { ok: false, status: 500, error: error.message };
    return { guestBanditId: data.id };
  }

  if (payload.kind === 'recommendation' || payload.kind === 'unpublish-recommendation') {
    const banditId = String(payload.guestBanditId || '').trim();
    const spotId = String(row.entity_id || payload.spotId || '').trim();
    if (!banditId || !spotId || isNeo(banditId)) {
      return { ok: false, status: 400, error: 'Approved recommendation needs its Local banDit and place.' };
    }
    const link = `ws-spot:${spotId}`;
    const { data: prior } = await sb.from('event').select('id').eq('link', link).limit(1);
    const priorId = Array.isArray(prior) && prior[0] ? prior[0].id : null;
    if (payload.kind === 'unpublish-recommendation') {
      if (priorId) {
        await sb.from('bandit_event').delete().eq('event_id', priorId).eq('bandit_id', banditId);
        await sb.from('event').delete().eq('id', priorId).eq('link', link);
      }
      return { guestBanditId: banditId, guestEventId: null };
    }
    const now = new Date();
    const eventFields = {
      name: clean(row.title, 140),
      genre: 'Culture',
      start_time: now.toISOString(),
      end_time: now.toISOString(),
      timing_info: 'A place recommendation',
      location_lat: Number.isFinite(Number(payload.lat)) ? Number(payload.lat) : 37.97945,
      location_lng: Number.isFinite(Number(payload.lng)) ? Number(payload.lng) : 23.71622,
      address: clean(payload.neighborhood, 160) || 'Athens',
      city: clean(payload.city, 80) || 'Athens',
      neighborhood: clean(payload.neighborhood, 80) || 'Athens',
      description: clean(payload.body || row.detail, 2000),
      rating: 0,
      image_url: '',
      link,
      google_place_id: null,
    };
    let eventId = priorId;
    if (priorId) {
      const { error } = await sb.from('event').update(eventFields).eq('id', priorId);
      if (error) return { ok: false, status: 500, error: error.message };
    } else {
      const { data, error } = await sb.from('event').insert(eventFields).select('id').single();
      if (error) return { ok: false, status: 500, error: error.message };
      eventId = data.id;
      const { error: linkError } = await sb.from('bandit_event').insert({
        bandit_id: banditId,
        event_id: eventId,
        personal_tip: clean(payload.body || row.detail, 280) || null,
      });
      if (linkError) return { ok: false, status: 500, error: linkError.message };
    }
    return { guestBanditId: banditId, guestEventId: eventId };
  }

  return null;
}

function authorName(row) {
  const first = String(row.name || '').trim();
  const family = String(row.family_name || '').trim();
  if (!family || first.toLowerCase().includes(family.toLowerCase())) return first;
  return `${first} ${family}`.trim();
}

function publicGuide(row, events) {
  return {
    id: row.id,
    name: clean(authorName(row), 80),
    city: row.city || '',
    story: clean(row.description || row.why_follow || '', 600),
    places: (events || []).map((event) => ({
      id: event.id,
      name: event.name || '',
      description: event.description || '',
      neighborhood: event.neighborhood || '',
      city: event.city || '',
      genre: event.genre || '',
      hasImage: Boolean(event.image_url),
    })),
  };
}

async function eventsForBandit(sb, banditId) {
  const { data: links, error } = await sb.from('bandit_event').select('event_id').eq('bandit_id', banditId);
  if (error) return { error };
  const ids = (Array.isArray(links) ? links : []).map((link) => link.event_id).filter(Boolean);
  if (!ids.length) return { events: [] };
  const { data, error: eventError } = await sb
    .from('event')
    .select('id,name,description,neighborhood,city,genre,image_url')
    .in('id', ids);
  if (eventError) return { error: eventError };
  return { events: data || [] };
}

/** Read the city guides the Guest App template already shows. Does not write. */
async function readCanonicalGuides(sb, payload) {
  if (payload.kind === 'read-guide') {
    const id = String(payload.guestBanditId || '').trim();
    if (!id) return { ok: false, status: 400, error: 'Which Local banDit?' };
    const { data, error } = await sb
      .from('bandit')
      .select('id,name,family_name,city,description,why_follow')
      .eq('id', id)
      .limit(1);
    if (error) return { ok: false, status: 500, error: error.message };
    const row = Array.isArray(data) ? data[0] : null;
    if (!row) return { ok: false, status: 404, error: 'That Local banDit is not on the guest list.' };
    const loaded = await eventsForBandit(sb, id);
    if (loaded.error) return { ok: false, status: 500, error: loaded.error.message };
    return { guestBanditId: id, guide: publicGuide(row, loaded.events) };
  }

  const { data, error } = await sb
    .from('bandit')
    .select('id,name,family_name,city,description,why_follow')
    .order('created_at', { ascending: false })
    .limit(30);
  if (error) return { ok: false, status: 500, error: error.message };
  const guides = [];
  for (const row of data || []) {
    const loaded = await eventsForBandit(sb, row.id);
    if (loaded.error) return { ok: false, status: 500, error: loaded.error.message };
    guides.push(publicGuide(row, loaded.events));
  }
  return { guides };
}

/**
 * Edit one place that is already on this author's city guide.
 * The author stays the same. Photographs and place links stay the same.
 */
async function updateExistingRecommendation(sb, payload) {
  const banditId = String(payload.guestBanditId || '').trim();
  const eventId = String(payload.eventId || '').trim();
  if (!banditId || !eventId) {
    return { ok: false, status: 400, error: 'Choose the Local banDit and the place.' };
  }
  const { data: links, error: linkError } = await sb
    .from('bandit_event')
    .select('id,bandit_id,event_id')
    .eq('bandit_id', banditId)
    .eq('event_id', eventId)
    .limit(1);
  if (linkError) return { ok: false, status: 500, error: linkError.message };
  const link = Array.isArray(links) ? links[0] : null;
  if (!link || link.bandit_id !== banditId) {
    return { ok: false, status: 403, error: 'That place belongs to a different Local banDit.' };
  }
  const { data: events, error } = await sb.from('event').select('id,name,description').eq('id', eventId).limit(1);
  if (error) return { ok: false, status: 500, error: error.message };
  const current = Array.isArray(events) ? events[0] : null;
  if (!current) return { ok: false, status: 404, error: 'That place is not on the city guide.' };
  const previous = { name: current.name || '', description: current.description || '' };
  const patch = {};
  if (typeof payload.name === 'string' && payload.name.trim()) patch.name = clean(payload.name, 140);
  if (typeof payload.description === 'string') patch.description = clean(payload.description, 2000);
  if (!Object.keys(patch).length) return { ok: false, status: 400, error: 'Nothing to update.' };
  const { error: updateError } = await sb.from('event').update(patch).eq('id', eventId);
  if (updateError) return { ok: false, status: 500, error: updateError.message };
  return { guestBanditId: banditId, guestEventId: eventId, previous };
}
