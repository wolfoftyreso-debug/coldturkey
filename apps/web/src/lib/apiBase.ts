/**
 * Where the browser sends API calls.
 *
 * The default is the empty string, which means "same origin": requests go to
 * `/v1/...` on whatever host served the page. That is deliberate, and it is
 * what production runs.
 *
 * Two things follow from it, and both are why it is the default.
 *
 * First, `NEXT_PUBLIC_*` values are inlined into the client bundle at build
 * time, so an absolute URL here is burned into the image. A self-hosted
 * operator pulling our image would get a bundle that calls *our* hostname and
 * would have to rebuild from source just to point it at their own. Same-origin
 * means one image serves any domain.
 *
 * Second, the Content-Security-Policy has to permit whatever this resolves to.
 * That header is produced by the *running server* from the *runtime*
 * environment, while this value is frozen at *build* time — so if the two
 * disagree, the browser blocks every API call and the app is dead with nothing
 * to show for it server-side. That is not hypothetical: it is how the
 * Kubernetes manifests were shipped, and `csp.test.ts` now pins the two
 * together.
 *
 * Set NEXT_PUBLIC_API_URL only when the API really is on another origin —
 * local development, where the API is on 8080 and the web app on 3000. Then it
 * has to be set for the build *and* for the server process.
 */
export const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? '';
