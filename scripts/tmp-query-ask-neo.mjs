import { createClient } from '@supabase/supabase-js';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();
for (const name of ['.env', '.env.local', '.env.production.local']) {
  const p = path.join(root, name);
  if (!existsSync(p)) continue;
  for (const line of readFileSync(p, 'utf8').split('\n')) {
    if (!line.trim() || line.trim().startsWith('#')) continue;
    const i = line.indexOf('=');
    if (i <= 0) continue;
    const k = line.slice(0, i).trim();
    const v = line.slice(i + 1).trim().replace(/^['"]|['"]$/g, '');
    if (/^[A-Z0-9_]+$/.test(k) && !process.env[k]) process.env[k] = v;
  }
}

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const email = process.env.PLAY_OPERATOR_EMAIL || process.env.E2E_ADMIN_EMAIL || 'blonje@gmail.com';
const password = process.env.PLAY_OPERATOR_PASSWORD || process.env.E2E_ADMIN_PASSWORD || '121275';

const s = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});
const { error: signErr } = await s.auth.signInWithPassword({ email, password });
if (signErr) throw signErr;

const operatorUserId = process.env.EXPO_PUBLIC_OPERATOR_USER_ID || 'e6d8cb02-6f1a-40c0-96c4-b96961878407';
const { data, error } = await s
  .from('notifications')
  .select('id,created_at,user_id,type,title,message,reference_id,reference_type,ask_target_bandit_id')
  .eq('user_id', operatorUserId)
  .eq('type', 'bandit_question')
  .eq('reference_type', 'bandit_question_request')
  .order('created_at', { ascending: false })
  .limit(120);
if (error) throw error;
const rows = data || [];
const withNeoTitle = rows.filter((r) => String(r.title || '').trim().toLowerCase() === 'neo');
console.log(
  JSON.stringify(
    {
      total: rows.length,
      neoTitleCount: withNeoTitle.length,
      latest: rows.slice(0, 20),
      latestNeoTitle: withNeoTitle.slice(0, 20),
    },
    null,
    2,
  ),
);
