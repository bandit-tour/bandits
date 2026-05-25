import { createClient } from '@supabase/supabase-js';
import { config as loadEnv } from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
loadEnv({ path: path.join(root, '.env') });

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const svc = createClient(url, key, { auth: { persistSession: false } });
const { error } = await svc.from('user_push_tokens').select('id').limit(1);
if (error) {
  console.log('MISSING', error.message);
  process.exit(1);
}
console.log('OK user_push_tokens exists');
const { count } = await svc.from('user_push_tokens').select('id', { count: 'exact', head: true });
console.log('rows', count ?? 0);
