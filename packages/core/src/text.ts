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

/** How many words a single `~` is allowed to span. */
const GAP_WORDS = 3;

/**
 * Build a space-delimited alternation matcher from ASCII patterns.
 * Intended to be used against the output of `normalizeForMatching`.
 *
 * A `~` token stands for up to three intervening words, so a rule can be
 * written the way meaning is actually carried — "orkar inte ~ leva" — instead
 * of enumerating every sentence somebody might build around it. Requiring
 * contiguous phrases is what made an earlier version of the safety rules miss
 * nine out of ten real messages: people write "jag orkar inte riktigt leva
 * längre", not the dictionary form.
 *
 * The gap is bounded on purpose. An unbounded gap would match two words at
 * opposite ends of a paragraph and turn every rule into a false alarm.
 */
export function phraseMatcher(alternatives: string[]): RegExp {
  const compiled = alternatives.map(compileAlternative);
  return new RegExp(`(?<=\\s)(?:${compiled.join('|')})(?=\\s)`, 'u');
}

function compileAlternative(alternative: string): string {
  const tokens = alternative.trim().split(/\s+/).filter(Boolean);
  // A gap at either end would anchor against the padding space rather than a
  // word, so trim them: "~ langre" means the same as "langre".
  while (tokens[0] === '~') tokens.shift();
  while (tokens[tokens.length - 1] === '~') tokens.pop();
  let out = '';
  for (const token of tokens) {
    if (token === '~') {
      out += `(?:\\s[\\p{L}\\p{N}]+){0,${GAP_WORDS}}`;
    } else {
      out += `${out ? '\\s' : ''}${escapeForRegExp(token)}`;
    }
  }
  return out;
}

function escapeForRegExp(token: string): string {
  return token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
