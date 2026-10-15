/**
 * Machine-readable inventory of More + Hotel guest actions → destinations.
 * Source-of-truth parse (not device automation).
 */
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve('.');
const menuPath = path.join(root, 'app/(tabs)/menu.tsx');
const hotelIndex = path.join(root, 'app/(tabs)/hotelier/index.tsx');
const dashPath = path.join(root, 'lib/guest-workspace/hotelierDashboard.ts');

const menuSrc = fs.readFileSync(menuPath, 'utf8');
const hotelSrc = fs.readFileSync(hotelIndex, 'utf8');
const dashSrc = fs.existsSync(dashPath) ? fs.readFileSync(dashPath, 'utf8') : '';

function extractHrefCards(src, label) {
  const out = [];
  const re = /\{\s*key:\s*"([^"]+)"[^}]*?title:\s*"([^"]+)"[^}]*?href:\s*((?:\/[^"\s]+)|(?:"[^"]+")|(?:'[^']+')|(?:`[^`]+`))/gs;
  let m;
  while ((m = re.exec(src))) {
    let href = m[3].replace(/^["'`]/, '').replace(/["'`]$/, '');
    out.push({ surface: label, key: m[1], title: m[2], href });
  }
  // simpler pass for multiline cards
  const simple = /\{\s*key:\s*"([^"]+)"[\s\S]*?title:\s*"([^"]+)"[\s\S]*?href:\s*"([^"]+)"/g;
  while ((m = simple.exec(src))) {
    if (!out.some((x) => x.key === m[1] && x.href === m[3])) {
      out.push({ surface: label, key: m[1], title: m[2], href: m[3] });
    }
  }
  return out;
}

const more = extractHrefCards(menuSrc, 'more');
const cityMemoryOk = more.every((a) => a.key !== 'memory' || a.href.includes('cityMemory'));
const hotelModules = [...dashSrc.matchAll(/^\s{2}([a-zA-Z]+):\s*\{/gm)].map((m) => m[1]);

const hotelCtas = [
  { id: 'root', route: '/hotelier', note: 'Guest stay companion (title Hotel)' },
  { id: 'after_trip_pause', route: '/hotelier', note: 'AFTER_TRIP: Connect stay + City Memory link — not Hotelier OS' },
  ...hotelModules.map((id) => ({
    id: `module:${id}`,
    route: `/hotelier/${id}`,
    note: 'claimHotelOffer or Connect My New Stay gate',
  })),
];

const out = {
  generatedAt: new Date().toISOString(),
  cityMemoryRoutesToTravelerMemory: cityMemoryOk,
  moreActions: more,
  hotelActions: hotelCtas,
  hotelIndexMentionsSimulateCheckout: /Simulate checkout/i.test(hotelSrc),
  upperRailExpected: [
    'Local banDits',
    'Experiences',
    'SmartTraveler',
    'bandiTEAM',
    'banDiShop',
  ],
};

const dir = path.join(root, 'artifacts/runtime-proof/rc-2026-10-15');
fs.mkdirSync(dir, { recursive: true });
const file = path.join(dir, 'more-hotel-route-inventory.json');
fs.writeFileSync(file, JSON.stringify(out, null, 2));
console.log(JSON.stringify({ ok: true, more: more.length, hotel: hotelCtas.length, cityMemoryOk, file }, null, 2));
