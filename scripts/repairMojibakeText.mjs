/**
 * Keep in sync with `lib/repairTextEncoding.ts` (repairDisplayText).
 * Duplicated so Node scripts can import without a TS loader.
 */
export function repairDisplayText(text) {
  if (text == null) return '';
  if (text === '') return '';

  let s = text;

  s = s.replace(/\u00E2\u20AC\u00A6/g, '\u2026');
  s = s.replace(/\u00E2\u20AC\u2122/g, '\u2019');
  s = s.replace(/\u00E2\u20AC\u2018/g, '\u002D');
  s = s.replace(/\u00E2\u20AC\u201D/g, '\u2014');
  s = s.replace(/â€¦/g, '\u2026');
  s = s.replace(/â€"/g, '\u2014');
  s = s.replace(/â€œ/g, '\u201C');
  s = s.replace(/â€/g, '\u201D');
  s = s.replace(/â€“/g, '\u2013');
  s = s.replace(/â€™/g, '\u2019');
  s = s.replace(/\u00E2\u20AC\u007E/g, '\u2019');
  s = s.replace(/\u00E2\u20AC\u02DC/g, '\u2018');

  s = s.replace(/\u00E2\u0080\u0099/g, '\u2019');
  s = s.replace(/\u00E2\u0080\u009C/g, '\u201C');
  s = s.replace(/\u00E2\u0080\u009D/g, '\u201D');
  s = s.replace(/\u00E2\u0080\u0094/g, '\u2014');
  s = s.replace(/\u00E2\u0080\u0093/g, '\u2013');
  s = s.replace(/\u00E2\u0080\u0098/g, '\u2018');
  s = s.replace(/\u00E2\u0080\u00A6/g, '\u2026');

  const LATIN1_PAIRS = [
    ['\u00C3\u00A0', '\u00E0'],
    ['\u00C3\u00A1', '\u00E1'],
    ['\u00C3\u00A2', '\u00E2'],
    ['\u00C3\u00A3', '\u00E3'],
    ['\u00C3\u00A4', '\u00E4'],
    ['\u00C3\u00A5', '\u00E5'],
    ['\u00C3\u00A6', '\u00E6'],
    ['\u00C3\u00A7', '\u00E7'],
    ['\u00C3\u00A8', '\u00E8'],
    ['\u00C3\u00A9', '\u00E9'],
    ['\u00C3\u00AA', '\u00EA'],
    ['\u00C3\u00AB', '\u00EB'],
    ['\u00C3\u00AC', '\u00EC'],
    ['\u00C3\u00AD', '\u00ED'],
    ['\u00C3\u00AE', '\u00EE'],
    ['\u00C3\u00AF', '\u00EF'],
    ['\u00C3\u00B1', '\u00F1'],
    ['\u00C3\u00B2', '\u00F2'],
    ['\u00C3\u00B3', '\u00F3'],
    ['\u00C3\u00B4', '\u00F4'],
    ['\u00C3\u00B5', '\u00F5'],
    ['\u00C3\u00B6', '\u00F6'],
    ['\u00C3\u00B8', '\u00F8'],
    ['\u00C3\u00B9', '\u00F9'],
    ['\u00C3\u00BA', '\u00FA'],
    ['\u00C3\u00BB', '\u00FB'],
    ['\u00C3\u00BC', '\u00FC'],
    ['\u00C3\u00BD', '\u00FD'],
    ['\u00C3\u00BF', '\u00FF'],
    ['\u00C3\u0080', '\u00C0'],
    ['\u00C3\u0081', '\u00C1'],
    ['\u00C3\u0082', '\u00C2'],
    ['\u00C3\u0089', '\u00C9'],
    ['\u00C3\u008D', '\u00CD'],
    ['\u00C3\u0093', '\u00D3'],
    ['\u00C3\u0096', '\u00D6'],
    ['\u00C3\u009C', '\u00DC'],
    ['\u00C3\u0091', '\u00D1'],
    ['\u00C2\u00A0', '\u00A0'],
    ['\u00C2\u00A9', '\u00A9'],
    ['\u00C2\u00AE', '\u00AE'],
    ['\u00C2\u00B0', '\u00B0'],
    ['\u00C2\u00B4', '\u00B4'],
    ['\u00C2\u00B7', '\u00B7'],
  ];
  for (const [from, to] of LATIN1_PAIRS) {
    if (s.includes(from)) s = s.split(from).join(to);
  }

  const onlyLatin1 = s.length > 0 && [...s].every((ch) => ch.charCodeAt(0) <= 0xff);
  const looksLikeUtf8Mojibake = /\u00E2[\u0080\u20AC]/.test(s) || /\u00C3/.test(s);
  if (onlyLatin1 && looksLikeUtf8Mojibake) {
    try {
      const bytes = Uint8Array.from([...s].map((ch) => ch.charCodeAt(0)));
      const decoded = new TextDecoder('utf-8', { fatal: false }).decode(bytes);
      if (!decoded.includes('\uFFFD')) {
        s = decoded;
      }
    } catch {
      /* keep s */
    }
  }

  return s;
}
