/**
 * Fixes mojibake from UTF-8 text that was misinterpreted as Latin-1 / Windows-1252.
 * Example: bytes E2 80 99 (UTF-8 for ') shown as â + € + ™ — the ™ looks like a "TM" bug.
 */
export function repairDisplayText(text: string | null | undefined): string {
  if (text == null) return '';
  if (text === '') return '';

  let s = text;

  // Explicit triplets when UTF-8 was read as Windows-1252 (common in DB round-trips)
  s = s.replace(/\u00E2\u20AC\u2122/g, '\u2019'); // â + € + ™ → '
  s = s.replace(/\u00E2\u20AC\u201D/g, '\u2014');
  s = s.replace(/\u00E2\u20AC\u201C/g, '\u2013');
  s = s.replace(/\u00E2\u20AC\u007E/g, '\u2019'); // â + € + ASCII ~ → ’
  s = s.replace(/\u00E2\u20AC\u02DC/g, '\u2018'); // â + € + ˜ → ‘

  // UTF-8 read as ISO-8859-1 (bytes as U+00E2 U+0080 U+0099 etc.)
  s = s.replace(/\u00E2\u0080\u0099/g, '\u2019');
  s = s.replace(/\u00E2\u0080\u009C/g, '\u201C');
  s = s.replace(/\u00E2\u0080\u009D/g, '\u201D');
  s = s.replace(/\u00E2\u0080\u0094/g, '\u2014');
  s = s.replace(/\u00E2\u0080\u0093/g, '\u2013');
  s = s.replace(/\u00E2\u0080\u0098/g, '\u2018');

  // Whole-string recovery when every code unit is Latin-1 and UTF-8 sequences are valid
  const onlyLatin1 =
    s.length > 0 && [...s].every((ch) => ch.charCodeAt(0) <= 0xff);
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
