import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
if (existsSync(join(root, '.env'))) {
  for (const line of readFileSync(join(root, '.env'), 'utf8').split('\n')) {
    const m = line.match(/^EXPO_PUBLIC_SUPABASE_(\w+)=/);
    if (m) {
      const v = line.split('=').slice(1).join('=').trim();
      process.env[`EXPO_PUBLIC_SUPABASE_${m[1]}`] = v;
    }
  }
}
const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
if (!url || !key) {
  console.error('Missing supabase env');
  process.exit(1);
}
const s = createClient(url, key);
const ab = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82, 0, 0, 0, 1, 0, 0, 0, 1, 8, 2, 0, 0, 0, 90, 119, 83, 222, 0, 0, 0, 12, 73, 68, 65, 84, 8, 215, 99, 248, 15, 4, 0, 9, 252, 3, 189, 169, 231, 221, 0, 0, 0, 0, 73, 69, 78, 68, 174, 66, 96, 130]);
const { data: a, error: aerr } = await s.auth.signInAnonymously();
if (aerr) {
  console.log('anon signIn', aerr);
  process.exit(1);
}
const uid = a.user?.id;
if (!uid) {
  console.log('no user');
  process.exit(1);
}
const objectPath = `${uid}/${Date.now()}.png`;
const { data, error } = await s.storage
  .from('profile_avatars')
  .upload(objectPath, ab, { contentType: 'image/png', upsert: true });
console.log(JSON.stringify({ objectPath, data, error, uid }, null, 2));
if (error) process.exit(1);
const { data: pub } = s.storage.from('profile_avatars').getPublicUrl(objectPath);
console.log('publicUrl', pub.publicUrl);
