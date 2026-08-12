#!/usr/bin/env node
/**
 * A stand-in for the production Ingress: one origin, `/v1` to the API and
 * everything else to the web server.
 *
 * The end-to-end suite runs behind this rather than against the web server
 * directly, and that is the whole point. Production serves the API from the
 * app's own origin so the Content-Security-Policy can say `connect-src 'self'`.
 * Testing against a cross-origin dev setup would exercise a configuration
 * nobody deploys — and it was exactly that gap between "works in dev" and "what
 * the manifests describe" that shipped an app in which the browser refused
 * every API call.
 *
 * Deliberately dependency-free: this runs in CI before anything is installed
 * beyond the workspace, and a proxy with its own supply chain is a strange
 * thing to put in front of a security test.
 */
import http from 'node:http';

const LISTEN = Number(process.env.E2E_ORIGIN_PORT ?? 3100);
const WEB = Number(process.env.E2E_WEB_UPSTREAM ?? 3101);
const API = Number(process.env.E2E_API_UPSTREAM ?? 8081);

const server = http.createServer((request, response) => {
  const port = request.url?.startsWith('/v1') ? API : WEB;
  const upstream = http.request(
    {
      host: '127.0.0.1',
      port,
      path: request.url,
      method: request.method,
      headers: { ...request.headers, host: `127.0.0.1:${port}` },
    },
    (upstreamResponse) => {
      response.writeHead(upstreamResponse.statusCode ?? 502, upstreamResponse.headers);
      upstreamResponse.pipe(response);
    },
  );
  upstream.on('error', (error) => {
    if (!response.headersSent) response.writeHead(502, { 'content-type': 'text/plain' });
    response.end(`upstream ${port}: ${error.message}`);
  });
  request.pipe(upstream);
});

server.listen(LISTEN, '127.0.0.1', () => {
  process.stdout.write(`e2e origin on http://127.0.0.1:${LISTEN} (web ${WEB}, api ${API})\n`);
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => server.close(() => process.exit(0)));
}
