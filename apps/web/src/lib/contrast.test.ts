import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * WCAG contrast, checked rather than eyeballed.
 *
 * A dark interface with low-contrast detail is the standard way this product's
 * design direction goes wrong, and "it looks fine on my screen" is how it stays
 * wrong. Two tokens were already failing when this was first measured:
 * `--text-faint` at 4.07:1, used for labels and secondary lines, and the input
 * border at 1.37:1 — on a form, the border is how somebody sees where to type.
 *
 * Anyone darkening a token has to come through here.
 */
const CSS = readFileSync(
  fileURLToPath(new URL('../app/globals.css', import.meta.url)),
  'utf8',
);

function tokens(): Record<string, string> {
  const found: Record<string, string> = {};
  for (const match of CSS.matchAll(/--([a-z-]+):\s*(#[0-9a-fA-F]{6})/g)) {
    const [, name, value] = match;
    if (name && value) found[name] = value;
  }
  return found;
}

function channel(value: number): number {
  const c = value / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function luminance(hex: string): number {
  const r = Number.parseInt(hex.slice(1, 3), 16);
  const g = Number.parseInt(hex.slice(3, 5), 16);
  const b = Number.parseInt(hex.slice(5, 7), 16);
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

function ratio(a: string, b: string): number {
  const first = luminance(a);
  const second = luminance(b);
  const [high, low] = first > second ? [first, second] : [second, first];
  return (high + 0.05) / (low + 0.05);
}

/** [foreground, background, minimum, what it is] */
const PAIRS: [string, string, number, string][] = [
  ['text', 'bg', 4.5, 'body text'],
  ['text', 'surface', 4.5, 'text on a card'],
  ['text-dim', 'bg', 4.5, 'secondary text'],
  ['text-dim', 'surface', 4.5, 'secondary text on a card'],
  ['text-faint', 'bg', 4.5, 'labels'],
  ['text-faint', 'surface', 4.5, 'labels on a card'],
  ['accent', 'bg', 4.5, 'accent text'],
  ['accent-strong', 'surface', 4.5, 'links on a card'],
  ['danger', 'bg', 4.5, 'danger text'],
  ['amber', 'surface', 4.5, 'warning text on a card'],
  ['teal', 'surface', 4.5, 'positive text on a card'],
  // Disabled controls are exempt from 1.4.3, and the exemption is declined:
  // somebody has to be able to read what a button says to work out what would
  // enable it. `--text-faint` was tried here and measured 4.43:1.
  ['text-disabled', 'surface-raised', 4.5, 'a disabled button label'],
  // Non-text: WCAG 1.4.11 wants 3:1 for the boundary of a control.
  ['border-input', 'bg', 3, 'input border'],
  ['border-input', 'surface', 3, 'input border on a card'],
];

describe('colour contrast meets WCAG AA', () => {
  const palette = tokens();

  for (const [foreground, background, minimum, label] of PAIRS) {
    it(`${label} (--${foreground} on --${background})`, () => {
      const fg = palette[foreground];
      const bg = palette[background];
      expect(fg, `--${foreground} is not defined`).toBeDefined();
      expect(bg, `--${background} is not defined`).toBeDefined();

      const measured = ratio(fg!, bg!);
      expect(
        measured,
        `${label}: ${fg} on ${bg} is ${measured.toFixed(2)}:1, needs ${minimum}:1`,
      ).toBeGreaterThanOrEqual(minimum);
    });
  }
});
