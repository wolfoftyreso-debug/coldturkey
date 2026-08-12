import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * The bug that produced this file was not in any source file. Both halves of it
 * were correct: the client called the API URL it was built with, and the server
 * emitted a Content-Security-Policy from the environment it was started with.
 * The defect was that the Kubernetes manifests started the server without that
 * environment, so the two disagreed and the browser refused every API call —
 * with the pods healthy, the probes green and nothing in any log.
 *
 * `csp.test.ts` proves the header logic. This file proves the deployment
 * actually satisfies its precondition, because that is the half that shipped
 * broken. It reads the manifests as text rather than parsing YAML: the point is
 * to fail when somebody changes them, and a dependency-free check that runs in
 * the ordinary unit suite is one that will still be running in a year.
 */

const repoRoot = join(import.meta.dirname, '../../../..');
const read = (path: string): string => readFileSync(join(repoRoot, path), 'utf8');

const webDeployment = read('deploy/k8s/base/web.yaml');
const ingress = read('deploy/k8s/base/ingress.yaml');

/**
 * The block of the Ingress that serves the browser-facing host — everything
 * from `- host: app.…` up to the next rule. Anchored on the rule itself rather
 * than searched for by substring, because `app.cleat.example` also appears in
 * the TLS host list further up.
 */
function appRule(): string | undefined {
  const rules = ingress.split(/^\s*- host:/m).slice(1);
  return rules.find((rule) => rule.trimStart().startsWith('app.'));
}

describe('the deployed web app can actually reach the API', () => {
  it('either serves the API same-origin or tells the web server its URL', () => {
    const setsApiUrl = /NEXT_PUBLIC_API_URL/.test(webDeployment);

    // Same-origin: the Ingress must route /v1 on the app's host to the API, or
    // the client's relative calls hit the Next server and 404.
    const appHostRule = appRule();
    expect(appHostRule, 'no app host rule in the Ingress').toBeDefined();
    const routesApiSameOrigin =
      /path:\s*\/v1\b/.test(appHostRule!) && /name:\s*cleat-api/.test(appHostRule!);

    expect(
      setsApiUrl || routesApiSameOrigin,
      'The web Deployment sets no NEXT_PUBLIC_API_URL, so the browser calls the ' +
        "app's own origin — but the Ingress does not route /v1 there to cleat-api. " +
        'Every API call will 404, or be refused outright by connect-src.',
    ).toBe(true);
  });

  it('routes /v1 to the API before the catch-all, on the app host', () => {
    const appHostRule = appRule()!;
    const apiPath = appHostRule.indexOf('path: /v1');
    const catchAll = appHostRule.indexOf('path: /\n');
    expect(apiPath, '/v1 is not routed on the app host').toBeGreaterThan(-1);
    expect(catchAll, 'no catch-all on the app host').toBeGreaterThan(-1);
    // nginx matches the longest prefix regardless, but not every controller
    // does, and the order is free to get right.
    expect(apiPath).toBeLessThan(catchAll);
  });

  it('still exposes the API on its own hostname for non-browser clients', () => {
    // Mobile and any outside integration use this; folding it away would break
    // them silently.
    expect(ingress).toMatch(/host:\s*api\./);
  });
});
