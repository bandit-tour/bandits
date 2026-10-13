#!/usr/bin/env node
/**
 * Regression freeze checklist — requires physical iPhone + Android with the app installed.
 *
 * Usage:
 *   node scripts/proof-regression-freeze-checklist.mjs --platform iphone --udid <UDID>
 *   node scripts/proof-regression-freeze-checklist.mjs --platform android --serial <DEVICE>
 *
 * Without --platform + device id, writes RESULT.json with BLOCKED status (no device attached).
 */
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const outDir = path.join(root, 'artifacts', 'runtime-proof', `regression-freeze-${stamp}`);

const CHECKLIST = [
  'local_bandits_first_open',
  'explore_instant_load',
  'hero_images_immediate',
  'card_matches_venue_detail',
  'my_spots_images',
  'city_guide_images',
  'ask_me_sends',
  'bottle_out_sends',
  'ask_me_creates_chat',
  'bottle_creates_chat',
  'notification_opens_chat',
  'chat_delete_select',
  'notifications_delete_select',
  'explore_single_tap',
  'no_placeholders',
  'no_duplicate_heroes',
];

function parseArgs() {
  const args = process.argv.slice(2);
  const out = { platform: null, device: null };
  for (let i = 0; i < args.length; i += 1) {
    if (args[i] === '--platform') out.platform = args[++i];
    if (args[i] === '--udid' || args[i] === '--serial') out.device = args[++i];
  }
  return out;
}

function listAdbDevices() {
  try {
    const raw = execSync('adb devices', { encoding: 'utf8' });
    return raw
      .split('\n')
      .slice(1)
      .map((l) => l.trim().split('\t')[0])
      .filter((id) => id && id !== 'List of devices attached');
  } catch {
    return [];
  }
}

function blankResults(platform, reason) {
  const items = {};
  for (const key of CHECKLIST) {
    items[key] = { iphone: null, android: null };
  }
  if (platform === 'iphone') {
    for (const key of CHECKLIST) items[key].iphone = { status: 'BLOCKED', reason, screenshot: null };
  } else if (platform === 'android') {
    for (const key of CHECKLIST) items[key].android = { status: 'BLOCKED', reason, screenshot: null };
  } else {
    for (const key of CHECKLIST) {
      items[key].iphone = { status: 'BLOCKED', reason: 'No iPhone connected — connect device and re-run with --platform iphone --udid <UDID>', screenshot: null };
      items[key].android = { status: 'BLOCKED', reason: 'No Android connected — connect device/emulator and re-run with --platform android --serial <ID>', screenshot: null };
    }
  }
  return items;
}

const { platform, device } = parseArgs();
const adbDevices = listAdbDevices();

let blockReason = 'Manual native checklist — automated capture not run.';
if (!platform) {
  blockReason = `No --platform specified. adb devices: ${adbDevices.length ? adbDevices.join(', ') : 'none'}. Connect iPhone (macOS + idb/xcrun) or Android and re-run.`;
} else if (platform === 'android' && !device && adbDevices.length === 0) {
  blockReason = 'No Android device/emulator attached (adb devices empty).';
} else if (platform === 'iphone') {
  blockReason = 'iPhone native capture requires macOS + connected device. Run on Mac with idb/xcrun or capture screenshots manually into this folder.';
}

const result = {
  generatedAt: new Date().toISOString(),
  regressionFreezeActive: true,
  overall: 'BLOCKED',
  manualHeroApprovalRequired: true,
  instructions: {
    perItem: 'Record PASS ✅ or FAIL ❌ with screenshot or screen recording in this folder.',
    naming: 'Use {checklist-key}-{iphone|android}.png or .mp4',
    freezeRule: 'If ANY item is FAIL on either platform, do not ship a build.',
  },
  checklist: blankResults(platform, blockReason),
  artifactsDir: outDir,
};

await mkdir(outDir, { recursive: true });
await writeFile(path.join(outDir, 'RESULT.json'), JSON.stringify(result, null, 2));
await writeFile(
  path.join(outDir, 'CHECKLIST.md'),
  `# Regression freeze checklist

Connect **iPhone** and **Android** with the regression-fix build installed.

For each row: **PASS ✅** or **FAIL ❌** + screenshot (\`.png\`) or screen recording (\`.mp4\`).

| # | Check | iPhone | Android |
|---|-------|--------|---------|
${CHECKLIST.map((k, i) => `| ${i + 1} | ${k.replace(/_/g, ' ')} | ☐ | ☐ |`).join('\n')}

**Regression freeze remains active until every cell is PASS ✅ on both platforms.**
`,
);

console.log(JSON.stringify({ outDir, overall: result.overall, blockReason }, null, 2));
