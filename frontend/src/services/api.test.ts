import { afterEach, describe, expect, it, vi } from 'vitest';

const create = vi.fn();

vi.mock('axios', () => ({
  default: {
    create,
  },
}));

async function loadApi() {
  let interceptor:
    ((config: { headers: Record<string, string> }) => unknown) | undefined;
  const apiClient = {
    interceptors: {
      request: {
        use: vi.fn((callback) => {
          interceptor = callback;
        }),
      },
    },
  };

  create.mockReturnValueOnce(apiClient);
  const module = await import('@/services/api');

  return {
    api: module.default,
    apiClient,
    interceptor,
  };
}

describe('api service', () => {
  afterEach(() => {
    localStorage.clear();
    vi.resetModules();
    create.mockReset();
  });

  it('uses the configured API URL when available', async () => {
    vi.stubEnv('VITE_API_URL', 'https://api.example.test');

    const { api, apiClient } = await loadApi();

    expect(api).toBe(apiClient);
    expect(create).toHaveBeenCalledWith({
      baseURL: 'https://api.example.test',
    });

    vi.unstubAllEnvs();
  });

  it('uses the local API URL by default', async () => {
    vi.stubEnv('VITE_API_URL', '');

    await loadApi();

    expect(create).toHaveBeenCalledWith({ baseURL: 'http://localhost:3333' });

    vi.unstubAllEnvs();
  });

  it('attaches bearer token when token exists', async () => {
    localStorage.setItem('token', 'token-123');

    const { interceptor } = await loadApi();
    const config = interceptor?.({ headers: {} });

    expect(config).toEqual({
      headers: {
        Authorization: 'Bearer token-123',
        'X-Tenant-Id': 'mercadozetta',
      },
    });
  });

  it('does not attach auth header when token is absent and still sends tenant id', async () => {
    const { interceptor } = await loadApi();
    const config = interceptor?.({ headers: {} });

    expect(config).toEqual({ headers: { 'X-Tenant-Id': 'mercadozetta' } });
  });

  it('uses configured tenant id for tenant-aware requests', async () => {
    vi.stubEnv('VITE_TENANT_ID', 'campus-market');

    const { interceptor } = await loadApi();
    const config = interceptor?.({ headers: {} });

    expect(config).toEqual({ headers: { 'X-Tenant-Id': 'campus-market' } });

    vi.unstubAllEnvs();
  });
});
