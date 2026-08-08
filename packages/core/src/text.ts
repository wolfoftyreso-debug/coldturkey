/**
 * Text normalisation used by every pattern matcher in this package.
 *
 * Two things matter here and both are easy to get wrong:
 *
 * 1. **Diacritics are folded.** People in distress type fast and often without
 *    å/ä/ö, so "vill dö" and "vill do" must both match. Folding via NFD lets us
 *    write every pattern once, in ASCII, instead of maintaining two spellings.
 *
 * 2. **Word boundaries are spaces, not `\b`.** JavaScript's `\b` is defined
 *    against `[A-Za-z0-9_]`, so `/\bdö\b/u` never matches " dö " — the position
 *    after "ö" is not a boundary by that definition. Collapsing all non
 *    alphanumerics to spaces and padding the string means every token is space
 *    delimited, and `(?<=\s)…(?=\s)` is a boundary that actually works for
 *    Swedish.
 */
export function normalizeForMatching(text: string): string {
  const folded = text
    .normalize('NFD')
    .replace(/\p{M}+/gu, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
  return ` ${folded} `;
}

/**
 * Build a space-delimited alternation matcher from ASCII patterns.
 * Intended to be used against the output of `normalizeForMatching`.
 */
export function phraseMatcher(alternatives: string[]): RegExp {
  return new RegExp(`(?<=\\s)(?:${alternatives.join('|')})(?=\\s)`, 'u');
}
