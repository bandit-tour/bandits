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

  const { data, error } = await sb.from('guest_live_events').insert(row).select('*').single();
  if (error) {
    res.status(500).json({ ok: false, error: error.message });
    return;
  }

  res.status(200).json({ ok: true, event: data });
}
