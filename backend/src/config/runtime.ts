import { getAllowedCorsOrigins, isLocalEnv } from '@/config/security';

const DEFAULT_PORT = 3333;

function parsePort() {
  const configured = process.env.PORT?.trim();
  if (!configured) {
    if (isLocalEnv()) return DEFAULT_PORT;
    throw new Error('PORT is required outside development and test');
  }

  const port = Number(configured);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('PORT must be an integer between 1 and 65535');
  }

  return port;
}

export function getTrustProxyHops() {
  const configured = process.env.TRUST_PROXY_HOPS?.trim();
  if (!configured) return 0;

  const hops = Number(configured);
  if (!Number.isInteger(hops) || hops < 0 || hops > 10) {
    throw new Error('TRUST_PROXY_HOPS must be an integer between 0 and 10');
  }

  return hops;
}

function validateCorsOrigins() {
  const origins = getAllowedCorsOrigins();
  if (!origins.length && !isLocalEnv()) {
    throw new Error('CORS_ORIGIN is required outside development and test');
  }

  for (const origin of origins) {
    let url: URL;
    try {
      url = new URL(origin);
    } catch {
      throw new Error(`CORS_ORIGIN contains an invalid origin: ${origin}`);
    }

    if (!['http:', 'https:'].includes(url.protocol) || url.origin !== origin) {
      throw new Error(`CORS_ORIGIN contains an invalid origin: ${origin}`);
    }
  }
}

export function getRuntimeConfig() {
  const mongoUri = process.env.MONGODB_URI?.trim();
  if (!mongoUri)
    throw new Error('MONGODB_URI environment variable is required');

  if (!isLocalEnv() && !process.env.TRUST_PROXY_HOPS?.trim()) {
    throw new Error(
      'TRUST_PROXY_HOPS is required outside development and test',
    );
  }

  validateCorsOrigins();

  return {
    mongoUri,
    port: parsePort(),
    trustProxyHops: getTrustProxyHops(),
  };
}
