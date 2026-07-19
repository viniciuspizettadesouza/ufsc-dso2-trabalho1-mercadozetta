#!/usr/bin/env node

const baseUrl = process.env.LOAD_BASE_URL || 'http://127.0.0.1:8088';
const tenantId = process.env.LOAD_TENANT_ID || 'mercadozetta';
const requestCount = readPositiveInteger('LOAD_REQUESTS', 100);
const concurrency = readPositiveInteger('LOAD_CONCURRENCY', 10);
const maximumP95Ms = readPositiveInteger('LOAD_MAX_P95_MS', 2000);
const target = new URL('/api/products?limit=20', baseUrl);
const durations = [];
const failures = [];
let cursor = 0;

function readPositiveInteger(name, fallback) {
  const raw = process.env[name];
  if (raw === undefined) return fallback;

  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error(`${name} must be a positive integer`);
  }
  return value;
}

function percentile(values, ratio) {
  const index = Math.min(
    values.length - 1,
    Math.max(0, Math.ceil(values.length * ratio) - 1),
  );
  return values[index];
}

async function worker() {
  while (cursor < requestCount) {
    const requestNumber = cursor;
    cursor += 1;
    const startedAt = performance.now();

    try {
      const response = await fetch(target, {
        headers: { 'X-Tenant-Id': tenantId },
        signal: AbortSignal.timeout(10_000),
      });
      await response.arrayBuffer();
      durations.push(performance.now() - startedAt);
      if (!response.ok) {
        failures.push({ requestNumber, status: response.status });
      }
    } catch (error) {
      durations.push(performance.now() - startedAt);
      failures.push({
        requestNumber,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}

const startedAt = performance.now();
await Promise.all(
  Array.from({ length: Math.min(concurrency, requestCount) }, () => worker()),
);
const elapsedMs = performance.now() - startedAt;
durations.sort((left, right) => left - right);

const summary = {
  target: target.toString(),
  tenantId,
  requests: requestCount,
  concurrency,
  failures: failures.length,
  elapsedMs: Math.round(elapsedMs),
  requestsPerSecond: Number((requestCount / (elapsedMs / 1000)).toFixed(2)),
  p50Ms: Math.round(percentile(durations, 0.5)),
  p95Ms: Math.round(percentile(durations, 0.95)),
  p99Ms: Math.round(percentile(durations, 0.99)),
  maximumP95Ms,
};

console.log(JSON.stringify(summary, null, 2));

if (failures.length > 0) {
  console.error(JSON.stringify(failures.slice(0, 10), null, 2));
  process.exitCode = 1;
} else if (summary.p95Ms > maximumP95Ms) {
  console.error(`Load smoke p95 ${summary.p95Ms}ms exceeded ${maximumP95Ms}ms`);
  process.exitCode = 1;
}
