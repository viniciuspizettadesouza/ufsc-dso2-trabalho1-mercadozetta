import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios';

import { defaultBrand, getBrandByTenantId } from '@/brands';
import { apiRoutes } from '@/routes';

declare module 'axios' {
  export interface AxiosRequestConfig {
    skipAuthRefresh?: boolean;
    authRetryAttempted?: boolean;
  }
}

const activeBrand = getBrandByTenantId(import.meta.env.VITE_TENANT_ID);
const unsafeMethods = new Set(['post', 'put', 'patch', 'delete']);
const refreshDelayMs = 150;

let authenticationFailureHandler: (() => void) | null = null;
let refreshPromise: Promise<void> | null = null;
let externalRefresh: Promise<boolean> | null = null;
let resolveExternalRefresh: ((successful: boolean) => void) | null = null;

const refreshChannel =
  typeof BroadcastChannel === 'undefined'
    ? null
    : new BroadcastChannel('mercadozetta-auth');

refreshChannel?.addEventListener('message', ({ data }) => {
  if (data?.type === 'refresh-start' && !externalRefresh) {
    externalRefresh = new Promise<boolean>((resolve) => {
      resolveExternalRefresh = resolve;
      window.setTimeout(() => resolve(false), 5_500);
    }).finally(() => {
      externalRefresh = null;
      resolveExternalRefresh = null;
    });
  }

  if (data?.type === 'refresh-complete') {
    resolveExternalRefresh?.(data.successful === true);
  }
});

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3333',
  withCredentials: true,
});

function readCookie(name: string) {
  const prefix = `${name}=`;
  const value = document.cookie
    .split(';')
    .map((entry) => entry.trim())
    .find((entry) => entry.startsWith(prefix))
    ?.slice(prefix.length);

  return value ? decodeURIComponent(value) : undefined;
}

function readCsrfProof() {
  return readCookie('__Host-mz_csrf') ?? readCookie('mz_csrf');
}

api.interceptors.request.use((config) => {
  config.headers['X-Tenant-Id'] = activeBrand.tenantId || defaultBrand.tenantId;

  if (unsafeMethods.has(config.method?.toLowerCase() ?? '')) {
    const csrfProof = readCsrfProof();
    if (csrfProof) config.headers['X-CSRF-Token'] = csrfProof;
  }

  return config;
});

function delay(duration: number) {
  return new Promise((resolve) => window.setTimeout(resolve, duration));
}

async function requestRefresh() {
  try {
    await api.post(apiRoutes.refresh, undefined, { skipAuthRefresh: true });
  } catch (error) {
    if (!(error instanceof AxiosError) || error.response?.status !== 409) {
      throw error;
    }

    await delay(refreshDelayMs);
    await api.post(apiRoutes.refresh, undefined, { skipAuthRefresh: true });
  }
}

async function refreshAuthentication() {
  if (externalRefresh && (await externalRefresh)) return;

  refreshChannel?.postMessage({ type: 'refresh-start' });
  try {
    await requestRefresh();
    refreshChannel?.postMessage({
      type: 'refresh-complete',
      successful: true,
    });
  } catch (error) {
    refreshChannel?.postMessage({
      type: 'refresh-complete',
      successful: false,
    });
    throw error;
  }
}

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const config = error.config as InternalAxiosRequestConfig | undefined;

    if (
      error.response?.status !== 401 ||
      !config ||
      config.skipAuthRefresh ||
      config.authRetryAttempted ||
      config.url === apiRoutes.login ||
      config.url === apiRoutes.refresh
    ) {
      throw error;
    }

    config.authRetryAttempted = true;
    refreshPromise ??= refreshAuthentication().finally(() => {
      refreshPromise = null;
    });

    try {
      await refreshPromise;
      return api.request(config);
    } catch {
      authenticationFailureHandler?.();
      throw error;
    }
  },
);

export function setAuthenticationFailureHandler(handler: (() => void) | null) {
  authenticationFailureHandler = handler;
}

export default api;
