import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * The enquiry form is opt-in, and this file exists to keep it that way.
 *
 * The public deployment on Vercel serves the pages and nothing else: there is
 * no API behind it, and `/v1/contact/organisation` returns Next's 404 page —
 * checked against the live site, not assumed. A clinic that filled the form in
 * there typed its unit's details into an error message.
 *
 * The two failure modes are not symmetric, which is why the default is off.
 * Forgetting to switch it on costs a sentence of honest copy on a pricing
 * page. Forgetting to switch it off costs a customer who believes they got in
 * touch and never hears back — and who has no way of finding out.
 */
const root = join(import.meta.dirname, '../..');
const read = (path: string): string => readFileSync(join(root, path), 'utf8');

describe('the organisation form is opt-in', () => {
  it('reads an explicit "on", so an unset environment hides it', () => {
    const source = read('src/lib/enquiries.ts');
    expect(source).toContain("process.env.NEXT_PUBLIC_ENQUIRY_FORM === 'on'");
    // Anything of the shape `!== 'off'` would default to showing a form the
    // marketing deployment cannot honour.
    expect(source).not.toMatch(/!==\s*'off'/);
  });

  it('is switched on by the end-to-end run, which does have an API', () => {
    expect(read('../../scripts/e2e.sh')).toContain('NEXT_PUBLIC_ENQUIRY_FORM=on');
  });

  it('gates the component rather than the page, so no route can forget', () => {
    const component = read('src/components/OrganisationEnquiry.tsx');
    expect(component).toContain('ENQUIRY_FORM_ENABLED');
    // The guard must come before any hook-free early return of the form.
    expect(component.indexOf('if (!ENQUIRY_FORM_ENABLED)')).toBeLessThan(
      component.indexOf('<form'),
    );
  });
});
