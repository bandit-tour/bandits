/**
 * Merges docx + xlsx Athens recommendations, dedupes, assigns bandits, emits SQL migration.
 * Run: node scripts/build-athens-enrichment.cjs
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const mammoth = require('mammoth');
const XLSX = require('xlsx');

const BANDIT_NAMES = ['Joanna', 'Sonia', 'Elia', 'Neo'];

const IMAGE_BY_GENRE = {
  Food: 'https://images.pexels.com/photos/1640777/pexels-photo-1640777.jpeg?auto=compress&cs=tinysrgb&w=1200&h=900&fit=crop',
  Coffee: 'https://images.pexels.com/photos/302899/pexels-photo-302899.jpeg?auto=compress&cs=tinysrgb&w=1200&h=900&fit=crop',
  Nightlife: 'https://images.pexels.com/photos/1763075/pexels-photo-1763075.jpeg?auto=compress&cs=tinysrgb&w=1200&h=900&fit=crop',
  Culture: 'https://images.pexels.com/photos/237294/pexels-photo-237294.jpeg?auto=compress&cs=tinysrgb&w=1200&h=900&fit=crop',
  Shopping: 'https://images.pexels.com/photos/264636/pexels-photo-264636.jpeg?auto=compress&cs=tinysrgb&w=1200&h=900&fit=crop',
};

function normalizeKey(name) {
  return String(name || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function mapCategoryToGenre(cat) {
  const c = String(cat || '').toLowerCase();
  if (/coffee|cafe|café|brunch|smoothie|bubble tea|tea bar|juice/.test(c)) return 'Coffee';
  if (/shop|market|boutique|store/.test(c)) return 'Shopping';
  if (/museum|gallery|art|film|festival|exhibition|culture|community|residency|performance|drag|queer arts/.test(c))
    return 'Culture';
  if (/night|club|dj|party|bar(?!\s*restaurant)|beach bar|queer club|after dark/.test(c)) return 'Nightlife';
  if (/restaurant|food|vegan|grill|dessert|gelato|ice cream|loukoum|souvlaki|street food|dining|bbq|kitchen|bakery|sweet/.test(c))
    return 'Food';
  if (/beach|riviera|swim|sunbed/.test(c) && !/club|bar|party/i.test(c)) return 'Food';
  return 'Food';
}

function neighborhoodFromAddress(addr) {
  const a = String(addr || '').toLowerCase();
  const hoods = [
    'exarchia',
    'gazi',
    'kolonaki',
    'koukaki',
    'monastiraki',
    'plaka',
    'psyrri',
    'pangrati',
    'ampelokipoi',
    'syntagma',
    'vouliagmeni',
    'alimos',
    'kavouri',
    'elefsina',
    'thiseio',
    'kypseli',
  ];
  for (const h of hoods) {
    if (a.includes(h)) return h.charAt(0).toUpperCase() + h.slice(1);
  }
  if (/riviera|beach|coast/i.test(addr)) return 'Athens Riviera';
  if (/center|centre|downtown|city center/i.test(addr)) return 'Athens Center';
  return 'Athens';
}

function hashOffset(name) {
  const h = crypto.createHash('sha256').update(normalizeKey(name)).digest();
  const lat = 37.975 + ((h[0] << 8) | h[1]) / 6553500;
  const lng = 23.715 + ((h[2] << 8) | h[3]) / 6553500;
  return { lat: Math.round(lat * 1e6) / 1e6, lng: Math.round(lng * 1e6) / 1e6 };
}

function parseDocxPlaces(text) {
  const chunks = text
    .split(/✨/g)
    .map((s) => s.trim())
    .filter((c) => /Address:\s*/i.test(c));
  const out = [];
  for (const chunk of chunks) {
    const lines = chunk.split('\n').map((l) => l.trim());
    const name = lines[0]?.replace(/^✨\s*/, '').trim();
    if (!name || name.length < 2) continue;
    let address = '';
    let category = '';
    let timing_info = '';
    let desc = '';
    let why = '';
    let mode = null;
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      if (!line) {
        if (mode === 'desc') desc += '\n';
        else if (mode === 'why') why += '\n';
        continue;
      }
      if (/^Address:\s*/i.test(line)) {
        mode = null;
        address = line.replace(/^Address:\s*/i, '').trim();
      } else if (/^Category:\s*/i.test(line)) {
        mode = null;
        category = line.replace(/^Category:\s*/i, '').trim();
      } else if (/^Opening Hours:\s*/i.test(line)) {
        mode = null;
        timing_info = line.replace(/^Opening Hours:\s*/i, '').trim();
      } else if (/^Bandit(?:'|\u2019)s Description:\s*/i.test(line)) {
        mode = 'desc';
        const rest = line.replace(/^Bandit(?:'|\u2019)s Description:\s*/i, '').trim();
        desc = rest ? `${rest}\n` : '';
      } else if (/^Why the Bandit Recommends It:\s*/i.test(line)) {
        mode = 'why';
        const rest = line.replace(/^Why the Bandit Recommends It:\s*/i, '').trim();
        why = rest ? `${rest}\n` : '';
      } else if (mode === 'desc') {
        desc += `${line}\n`;
      } else if (mode === 'why') {
        why += `${line}\n`;
      }
    }
    const description = [desc.trim(), why.trim()].filter(Boolean).join('\n\n').slice(0, 1200);
    if (!description) continue;
    out.push({
      name,
      address: address || 'Athens',
      category,
      city: 'Athens',
      timing_info: timing_info || 'Varies — check venue',
      description,
      source: 'docx',
    });
  }
  return out;
}

function parseXlsx(pathXlsx) {
  const wb = XLSX.readFile(pathXlsx);
  const sh = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sh);
  const out = [];
  for (const row of rows) {
    const name = String(row.Name || row.name || '').trim();
    if (!name || /^name$/i.test(name)) continue;
    const address = String(row.Address || row.address || 'Athens').trim();
    const category = String(row.Category || row.category || '').trim();
    const timing_info = String(row['Opening Hours'] || row['Opening hours'] || '').trim() || 'Varies — check venue';
    const d1 = String(row['Bandit Description'] || row['Bandit description'] || '').trim();
    const d2 = String(row['Why the Bandit Recommends'] || row['Why the bandit recommends'] || '').trim();
    const description = [d1, d2].filter(Boolean).join('\n\n').slice(0, 1200);
    if (!description) continue;
    out.push({
      name,
      address,
      category,
      city: 'Athens',
      timing_info,
      description,
      source: 'xlsx',
    });
  }
  return out;
}

function mergeDedupe(rows) {
  const map = new Map();
  for (const r of rows) {
    const k = normalizeKey(r.name);
    if (!k) continue;
    const prev = map.get(k);
    if (!prev) {
      map.set(k, { ...r, name: r.name.trim() });
      continue;
    }
    const merged = { ...prev };
    if ((r.description || '').length > (prev.description || '').length) merged.description = r.description;
    if ((r.address || '').length > (prev.address || '').length) merged.address = r.address;
    if ((r.category || '').length > (prev.category || '').length) merged.category = r.category;
    merged.source = `${prev.source}+${r.source}`;
    map.set(k, merged);
  }
  return [...map.values()];
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function escSql(s) {
  return String(s ?? '').replace(/'/g, "''");
}

async function main() {
  const docxPath = path.join(__dirname, '..', 'lib', 'bandit_athens_recommendations_today.docx');
  const xlsxPath = path.join(process.env.USERPROFILE || '', 'Desktop', 'athens_bandit_today_from_scape.xlsx');

  const { value: docText } = await mammoth.extractRawText({ path: docxPath });
  const fromDoc = parseDocxPlaces(docText);
  const fromXlsx = parseXlsx(xlsxPath);
  const merged = mergeDedupe([...fromDoc, ...fromXlsx]);
  const duplicateRowsMerged = fromDoc.length + fromXlsx.length - merged.length;

  const withGenre = merged.map((p) => ({
    ...p,
    genre: mapCategoryToGenre(p.category),
    neighborhood: neighborhoodFromAddress(p.address),
  }));

  const shuffled = shuffle(withGenre);
  const assigned = shuffled.map((p, i) => ({
    ...p,
    bandit_name: BANDIT_NAMES[i % BANDIT_NAMES.length],
  }));

  const placesPerBandit = {};
  for (const n of BANDIT_NAMES) placesPerBandit[n] = 0;
  for (const p of assigned) placesPerBandit[p.bandit_name] += 1;

  const lines = [];
  lines.push('-- Athens city guide enrichment (generated). Idempotent: skips existing event names.');
  lines.push('begin;');
  lines.push('');

  let insertCount = 0;
  const banditsTouched = new Set();

  for (const p of assigned) {
    const { lat, lng } = hashOffset(p.name);
    const image_url = IMAGE_BY_GENRE[p.genre] || IMAGE_BY_GENRE.Food;
    const link = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${p.name} ${p.address}`)}`;
    const personal_tip = (p.description || '').split('\n')[0].slice(0, 280);

    const nameSql = escSql(p.name);
    const descSql = escSql(p.description);
    const addrSql = escSql(p.address);
    const neighSql = escSql(p.neighborhood);
    const timingSql = escSql(p.timing_info);
    const banditSql = escSql(p.bandit_name);

    lines.push(`-- ${p.name} → ${p.bandit_name} (${p.genre})`);
    lines.push(`with ins as (`);
    lines.push(`  insert into public.event (`);
    lines.push(
      `    name, genre, start_time, end_time, timing_info, location_lat, location_lng, address, city, neighborhood, description, rating, image_url, link`,
    );
    lines.push(`  )`);
    lines.push(`  select`);
    lines.push(`    '${nameSql}',`);
    lines.push(`    '${p.genre}',`);
    lines.push(`    '2025-06-01T18:00:00+03:00',`);
    lines.push(`    '2025-06-01T23:59:00+03:00',`);
    lines.push(`    '${timingSql}',`);
    lines.push(`    ${lat},`);
    lines.push(`    ${lng},`);
    lines.push(`    '${addrSql}',`);
    lines.push(`    'Athens',`);
    lines.push(`    '${neighSql}',`);
    lines.push(`    '${descSql}',`);
    lines.push(`    4,`);
    lines.push(`    '${escSql(image_url)}',`);
    lines.push(`    '${escSql(link)}'`);
    lines.push(`  where not exists (`);
    lines.push(`    select 1 from public.event e where lower(trim(e.name)) = lower(trim('${nameSql}'))`);
    lines.push(`  )`);
    lines.push(`  returning id`);
    lines.push(`)`);
    lines.push(
      `insert into public.bandit_event (bandit_id, event_id, personal_tip)`,
    );
    lines.push(`select`);
    lines.push(`  (select id from public.bandit where name ilike '${banditSql}' limit 1),`);
    lines.push(`  ins.id,`);
    lines.push(`  '${escSql(personal_tip)}'`);
    lines.push(`from ins`);
    lines.push(`where not exists (`);
    lines.push(
      `  select 1 from public.bandit_event be join public.event ev on ev.id = be.event_id where ev.name = '${nameSql}'`,
    );
    lines.push(`);`);
    lines.push('');

    insertCount += 1;
    banditsTouched.add(p.bandit_name);
  }

  lines.push('commit;');

  const outSql = path.join(__dirname, '..', 'supabase', 'migrations', '012_athens_guide_enrichment.sql');
  fs.writeFileSync(outSql, lines.join('\n'), 'utf8');

  const report = {
    generatedAt: new Date().toISOString(),
    sourceRows: { docx: fromDoc.length, xlsx: fromXlsx.length },
    duplicateRowsMerged,
    mergedUniquePlaces: merged.length,
    sqlStatements: insertCount,
    banditsEnriched: banditsTouched.size,
    banditNames: [...banditsTouched],
    placesPerBandit,
    note:
      'Apply with supabase db push / SQL editor. Inserts skip when lower(trim(name)) already exists on public.event.',
  };
  fs.writeFileSync(
    path.join(__dirname, '..', 'scripts', 'athens-enrichment-report.json'),
    JSON.stringify(report, null, 2),
    'utf8',
  );

  console.log(JSON.stringify(report, null, 2));
  console.log('\nWrote', outSql);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
