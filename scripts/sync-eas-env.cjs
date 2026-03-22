/**
 * One-time (or when keys rotate): push EXPO_PUBLIC_* from local .env to EAS
 * for preview + production + development. Requires: npx eas login
 */
const { execFileSync } = require('child_process');
const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const keys = ['EXPO_PUBLIC_SUPABASE_URL', 'EXPO_PUBLIC_SUPABASE_ANON_KEY'];
const envs = ['preview', 'production', 'development'];

for (const name of keys) {
  const value = process.env[name];
  if (!value || !String(value).trim()) {
    console.error(`Missing ${name} in .env`);
    process.exit(1);
  }
  const args = [
    'eas-cli',
    'env:create',
    '--name',
    name,
    '--value',
    String(value).trim(),
    '--visibility',
    'sensitive',
    '--non-interactive',
    '--force',
    ...envs.flatMap((e) => ['--environment', e]),
  ];
  console.log(`Syncing ${name} to EAS (${envs.join(', ')})…`);
  execFileSync('npx', args, { stdio: 'inherit', cwd: path.join(__dirname, '..') });
}
console.log('Done. Rebuild with: eas build --platform ios --profile preview');
