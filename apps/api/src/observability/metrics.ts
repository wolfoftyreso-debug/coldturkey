/**
 * Metrics, in the Prometheus text format.
 *
 * Hand-rolled rather than `prom-client` for the same reason the SMTP client
 * is: the surface actually used here is a handful of counters and one
 * histogram, and a dependency in this process is a dependency trusted with
 * recovery data.
 *
 * The rule that shapes every label below: **no metric may carry anything
 * about a person.** No user id, no tenant id, no email, no free text, no
 * craving intensity. Cardinality is the usual reason people say that; here
 * the reason is disclosure. A metrics endpoint is scraped, stored for months,
 * and rendered on dashboards that are shared far more casually than a
 * database — and "requests by tenant" on a recovery product tells a reader
 * which clinics have patients and how many.
 *
 * Route labels are the registered path template (`/v1/cravings/:id`), never
 * the resolved URL, for the same reason.
 */

const LATENCY_BUCKETS_MS = [5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10_000];

interface Histogram {
  buckets: number[];
  counts: number[];
  sum: number;
  count: number;
}

function emptyHistogram(): Histogram {
  return {
    buckets: LATENCY_BUCKETS_MS,
    counts: new Array<number>(LATENCY_BUCKETS_MS.length + 1).fill(0),
    sum: 0,
    count: 0,
  };
}

function observe(histogram: Histogram, valueMs: number): void {
  let index = histogram.buckets.findIndex((bound) => valueMs <= bound);
  if (index === -1) index = histogram.buckets.length;
  const current = histogram.counts[index];
  if (current !== undefined) histogram.counts[index] = current + 1;
  histogram.sum += valueMs;
  histogram.count += 1;
}

/** key = `${method} ${route} ${statusClass}` */
const requestTotals = new Map<string, number>();
const requestLatency = new Map<string, Histogram>();

export const metrics = {
  requests: 0,
  errors: 0,
  coachModelCalls: 0,
  coachLocalFallbacks: 0,
  safetyEmergencies: 0,
  /** Emergencies that the deterministic triage caught before the model ran. */
  safetyBypasses: 0,
  mailSent: 0,
  mailFailed: 0,
  loginFailures: 0,
  loginLockouts: 0,
};

export function recordRequest(
  method: string,
  route: string,
  statusCode: number,
  durationMs: number,
): void {
  metrics.requests += 1;
  if (statusCode >= 500) metrics.errors += 1;

  // Status class rather than exact code: 404 and 422 on the same route are the
  // same operational fact, and the exact code is in the logs.
  const key = `${method} ${route} ${Math.floor(statusCode / 100)}xx`;
  requestTotals.set(key, (requestTotals.get(key) ?? 0) + 1);

  const latencyKey = `${method} ${route}`;
  let histogram = requestLatency.get(latencyKey);
  if (!histogram) {
    histogram = emptyHistogram();
    requestLatency.set(latencyKey, histogram);
  }
  observe(histogram, durationMs);
}

function escapeLabel(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n');
}

export function render(): string {
  const memory = process.memoryUsage();
  const lines: string[] = [];

  const counter = (name: string, help: string, value: number) => {
    lines.push(`# HELP ${name} ${help}`, `# TYPE ${name} counter`, `${name} ${value}`);
  };
  const gauge = (name: string, help: string, value: number) => {
    lines.push(`# HELP ${name} ${help}`, `# TYPE ${name} gauge`, `${name} ${value}`);
  };

  counter('cleat_requests_total', 'Total HTTP requests handled.', metrics.requests);
  counter('cleat_errors_total', 'Total HTTP responses with status >= 500.', metrics.errors);

  lines.push(
    '# HELP cleat_http_requests_total HTTP requests by method, route template and status class.',
    '# TYPE cleat_http_requests_total counter',
  );
  for (const [key, value] of requestTotals) {
    const [method, route, status] = key.split(' ');
    lines.push(
      `cleat_http_requests_total{method="${escapeLabel(method ?? '')}",route="${escapeLabel(
        route ?? '',
      )}",status="${escapeLabel(status ?? '')}"} ${value}`,
    );
  }

  lines.push(
    '# HELP cleat_http_request_duration_ms Request duration in milliseconds.',
    '# TYPE cleat_http_request_duration_ms histogram',
  );
  for (const [key, histogram] of requestLatency) {
    const [method, route] = key.split(' ');
    const labels = `method="${escapeLabel(method ?? '')}",route="${escapeLabel(route ?? '')}"`;
    let cumulative = 0;
    histogram.buckets.forEach((bound, index) => {
      cumulative += histogram.counts[index] ?? 0;
      lines.push(`cleat_http_request_duration_ms_bucket{${labels},le="${bound}"} ${cumulative}`);
    });
    cumulative += histogram.counts[histogram.buckets.length] ?? 0;
    lines.push(
      `cleat_http_request_duration_ms_bucket{${labels},le="+Inf"} ${cumulative}`,
      `cleat_http_request_duration_ms_sum{${labels}} ${histogram.sum}`,
      `cleat_http_request_duration_ms_count{${labels}} ${histogram.count}`,
    );
  }

  counter(
    'cleat_coach_model_calls_total',
    'Coach replies produced by the language model.',
    metrics.coachModelCalls,
  );
  counter(
    'cleat_coach_local_total',
    'Coach replies produced by the built-in local coach.',
    metrics.coachLocalFallbacks,
  );
  counter(
    'cleat_safety_emergencies_total',
    'Messages triaged as an emergency.',
    metrics.safetyEmergencies,
  );
  counter(
    'cleat_safety_bypass_total',
    'Emergencies stopped before the language model was contacted.',
    metrics.safetyBypasses,
  );
  counter('cleat_mail_sent_total', 'Messages handed to the relay.', metrics.mailSent);
  counter('cleat_mail_failed_total', 'Messages the relay refused.', metrics.mailFailed);
  counter('cleat_login_failures_total', 'Failed login attempts.', metrics.loginFailures);
  counter('cleat_login_lockouts_total', 'Login attempts refused by the lockout.', metrics.loginLockouts);

  gauge('cleat_process_resident_memory_bytes', 'Resident memory size in bytes.', memory.rss);
  gauge('cleat_process_heap_used_bytes', 'Heap in use in bytes.', memory.heapUsed);
  gauge('cleat_process_uptime_seconds', 'Process uptime in seconds.', Math.round(process.uptime()));

  return `${lines.join('\n')}\n`;
}

/** Test seam — the counters are module state. */
export function resetMetrics(): void {
  requestTotals.clear();
  requestLatency.clear();
  for (const key of Object.keys(metrics) as (keyof typeof metrics)[]) metrics[key] = 0;
}
