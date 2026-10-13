/**
 * Verify deleted scam_alerts no longer appear in public fetch (same query as mobile).
 */
import { createClient } from '@supabase/supabase-js';
import fs from 'node:fs';

const env = Object.fromEntries(
  fs
    .readFileSync('.env', 'utf8')
    .split(/\r?\n/)
    .filter((l) => l.includes('='))
    .map((l) => {
      const i = l.indexOf('=');
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    }),
);

const anon = createClient(env.EXPO_PUBLIC_SUPABASE_URL, env.EXPO_PUBLIC_SUPABASE_ANON_KEY);
const svc = createClient(env.EXPO_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

const probeId = crypto.randomUUID();
const { error: insErr } = await svc.from('scam_alerts').insert({
  id: probeId,
  city: 'Athens',
  location: 'Probe delete sync',
  title: 'Probe delete sync',
  description: 'Temporary row for delete sync probe',
  category: 'Other',
  severity: 2,
  moderation_status: 'published',
});
console.log('insert:', insErr?.message ?? 'OK');

const { data: before } = await anon
  .from('scam_alerts')
  .select('id')
  .eq('id', probeId)
  .maybeSingle();
console.log('anon sees before delete:', !!before);

const { error: delErr } = await svc.from('scam_alerts').delete().eq('id', probeId);
console.log('delete:', delErr?.message ?? 'OK');

const { data: after } = await anon
  .from('scam_alerts')
  .select('id')
  .eq('id', probeId)
  .maybeSingle();
console.log('anon sees after delete:', !!after);
process.exit(after ? 1 : 0);
