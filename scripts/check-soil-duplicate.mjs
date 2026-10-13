/**
 * Determine which Soil Restaurant row is "active" (referenced by bandit_event)
 * so we can safely deduplicate the duplicate row.
 */

import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

function loadEnvFile(envPath) {
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!value) continue;
    if (String(process.env[key] ?? '').trim() === '') process.env[key] = value;
  }
}

const IDS = [
  'bf0b6377-462a-4e71-8913-b8ebf45bac91',
  '4fb7df90-8dd5-4d87-be65-39ef86f16c3c',
];

async function main() {
  loadEnvFile(path.resolve(process.cwd(), '.env'));
  loadEnvFile(path.resolve(process.cwd(), '.env.local'));
  const url = String(process.env.EXPO_PUBLIC_SUPABASE_URL ?? '').trim();
  const key = String(process.env.SUPABASE_SERVICE_ROLE_KEY ?? '').trim();
  const supabase = createClient(url, key, { auth: { persistSession: false } });

  for (const id of IDS) {
    const { data: be } = await supabase
      .from('bandit_event')
      .select('id, bandit_id')
      .eq('event_id', id);
    const { data: ul } = await supabase
      .from('event_user_likes')
      .select('user_id')
      .eq('event_id', id);
    console.log(
      `event ${id} → bandit_event=${be?.length ?? 0}, event_user_likes=${ul?.length ?? 0}`,
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
