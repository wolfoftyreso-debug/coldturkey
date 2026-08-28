/**
 * Whether this deployment can actually receive an organisation enquiry.
 *
 * The form posts to `/v1/contact/organisation`, which lives in the API. The
 * public site on Vercel is a marketing deployment with no API behind it —
 * verified, not assumed: that path returns Next's 404 page there — so a clinic
 * filling the form in on the live site gets an error for doing nothing wrong.
 *
 * A form that cannot work should not be on the page. So it is opt-in: a
 * deployment that runs the whole stack turns it on, and one that serves only
 * the public pages says plainly that enquiries are not open yet rather than
 * pretending to collect them.
 *
 * Opt-in rather than opt-out because the failure modes are not symmetric.
 * Forgetting to turn it on costs a sentence of honest copy; forgetting to turn
 * it off costs a customer who thinks they got in touch and never hears back.
 */
export const ENQUIRY_FORM_ENABLED = process.env.NEXT_PUBLIC_ENQUIRY_FORM === 'on';
