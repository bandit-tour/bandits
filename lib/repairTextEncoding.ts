/**
 * Fixes mojibake from UTF-8 text that was misinterpreted as Latin-1 / Windows-1252.
 * Example: bytes E2 80 99 (UTF-8 for ') shown as â + € + ™ — the ™ looks like a "TM" bug.
 */
export function repairDisplayText(text: string | null | undefined): string {
  if (text == null) return '';
  if (text === '') return '';

  let s = text;

  // Literal mojibake sequences sometimes stored as UTF-8 characters that *look* like â€¦ in UI
  // (UTF-8 punctuation bytes mis-decoded then re-encoded). Order: longer sequences first.
  s = s.replace(/\u00E2\u20AC\u00A6/g, '\u2026'); // â€¦ → …
  s = s.replace(/\u00E2\u20AC\u2122/g, '\u2019'); // â€™ (€+™ style) → '
  // UTF-8 hyphen / em dash mis-decoded to € + a curly quote (common in “plant‑based”, “x — y”).
  s = s.replace(/\u00E2\u20AC\u2018/g, '\u002D');
  s = s.replace(/\u00E2\u20AC\u201D/g, '\u2014');
  // Common “looks like â€¦ in the UI” mojibake when UTF-8 punctuation was mis-handled (file is UTF-8).
  s = s.replace(/â€¦/g, '\u2026');
  s = s.replace(/â€"/g, '\u2014'); // em dash (UTF-8 E2 80 94 mis-decoded)
  s = s.replace(/â€œ/g, '\u201C');
  s = s.replace(/â€/g, '\u201D');
  s = s.replace(/â€“/g, '\u2013');
  s = s.replace(/â€™/g, '\u2019');
  s = s.replace(/\u00E2\u20AC\u007E/g, '\u2019'); // â + € + ASCII ~ → ’
  s = s.replace(/\u00E2\u20AC\u02DC/g, '\u2018'); // â + € + ˜ → ‘

  // UTF-8 read as ISO-8859-1 (bytes as U+00E2 U+0080 U+0099 etc.)
  s = s.replace(/\u00E2\u0080\u0099/g, '\u2019');
  s = s.replace(/\u00E2\u0080\u009C/g, '\u201C');
  s = s.replace(/\u00E2\u0080\u009D/g, '\u201D');
  s = s.replace(/\u00E2\u0080\u0094/g, '\u2014');
  s = s.replace(/\u00E2\u0080\u0093/g, '\u2013');
  s = s.replace(/\u00E2\u0080\u0098/g, '\u2018');
  s = s.replace(/\u00E2\u0080\u00A6/g, '\u2026');

  // Latin-1 mojibake: UTF-8 two-byte sequences (Ã + something) mis-rendered as Windows-1252.
  // Applied as explicit pairs so mixed strings (some clean Unicode + some Ã-mojibake) still repair.
  const LATIN1_PAIRS: ReadonlyArray<readonly [string, string]> = [
    ['\u00C3\u00A0', '\u00E0'], // Ã  → à
    ['\u00C3\u00A1', '\u00E1'], // Ã¡ → á
    ['\u00C3\u00A2', '\u00E2'], // Ã¢ → â
    ['\u00C3\u00A3', '\u00E3'], // Ã£ → ã
    ['\u00C3\u00A4', '\u00E4'], // Ã¤ → ä
    ['\u00C3\u00A5', '\u00E5'], // Ã¥ → å
    ['\u00C3\u00A6', '\u00E6'], // Ã¦ → æ
    ['\u00C3\u00A7', '\u00E7'], // Ã§ → ç
    ['\u00C3\u00A8', '\u00E8'], // Ã¨ → è
    ['\u00C3\u00A9', '\u00E9'], // Ã© → é
    ['\u00C3\u00AA', '\u00EA'], // Ãª → ê
    ['\u00C3\u00AB', '\u00EB'], // Ã« → ë
    ['\u00C3\u00AC', '\u00EC'], // Ã¬ → ì
    ['\u00C3\u00AD', '\u00ED'], // Ã­ → í
    ['\u00C3\u00AE', '\u00EE'], // Ã® → î
    ['\u00C3\u00AF', '\u00EF'], // Ã¯ → ï
    ['\u00C3\u00B1', '\u00F1'], // Ã± → ñ
    ['\u00C3\u00B2', '\u00F2'], // Ã² → ò
    ['\u00C3\u00B3', '\u00F3'], // Ã³ → ó
    ['\u00C3\u00B4', '\u00F4'], // Ã´ → ô
    ['\u00C3\u00B5', '\u00F5'], // Ãµ → õ
    ['\u00C3\u00B6', '\u00F6'], // Ã¶ → ö
    ['\u00C3\u00B8', '\u00F8'], // Ã¸ → ø
    ['\u00C3\u00B9', '\u00F9'], // Ã¹ → ù
    ['\u00C3\u00BA', '\u00FA'], // Ãº → ú
    ['\u00C3\u00BB', '\u00FB'], // Ã» → û
    ['\u00C3\u00BC', '\u00FC'], // Ã¼ → ü
    ['\u00C3\u00BD', '\u00FD'], // Ã½ → ý
    ['\u00C3\u00BF', '\u00FF'], // Ã¿ → ÿ
    ['\u00C3\u0080', '\u00C0'], // ÃÀ → À
    ['\u00C3\u0081', '\u00C1'], // Ã  → Á
    ['\u00C3\u0082', '\u00C2'], // Â variant uppercase
    ['\u00C3\u0089', '\u00C9'], // Ã‰ → É
    ['\u00C3\u008D', '\u00CD'], // ÃŒ → Í
    ['\u00C3\u0093', '\u00D3'], // Ã" → Ó
    ['\u00C3\u0096', '\u00D6'], // Ã– → Ö
    ['\u00C3\u009C', '\u00DC'], // Ãœ → Ü
    ['\u00C3\u0091', '\u00D1'], // Ã' → Ñ
    ['\u00C2\u00A0', '\u00A0'], // Â  → NBSP
    ['\u00C2\u00A9', '\u00A9'], // Â© → ©
    ['\u00C2\u00AE', '\u00AE'], // Â® → ®
    ['\u00C2\u00B0', '\u00B0'], // Â° → °
    ['\u00C2\u00B4', '\u00B4'], // Â´ → ´
    ['\u00C2\u00B7', '\u00B7'], // Â· → ·
  ];
  for (const [from, to] of LATIN1_PAIRS) {
    if (s.includes(from)) s = s.split(from).join(to);
  }

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
