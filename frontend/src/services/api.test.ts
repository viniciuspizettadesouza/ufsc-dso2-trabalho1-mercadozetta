import { AxiosError } from 'axios';
import { afterEach, describe, expect, it, vi } from 'vitest';

const { create } = vi.hoisted(() => ({ create: vi.fn() }));

vi.mock('axios', async (importOriginal) => {
  const actual = await importOriginal<typeof import('axios')>();
  return {
    ...actual,
    default: { create },
  };
});

async function loadApi() {
  let requestInterceptor:
    | ((config: {
        method?: string;
        headers: Record<string, string>;
      }) => unknown)
    | undefined;
  let responseErrorInterceptor: ((error: AxiosError) => unknown) | undefined;
  const apiClient = {
    post: vi.fn(),
    request: vi.fn(),
    interceptors: {
      request: {
        use: vi.fn((callback) => {
          requestInterceptor = callback;
        }),
      },
      response: {
        use: vi.fn((_success, error) => {
          responseErrorInterceptor = error;
        }),
      },
    },
  };

  create.mockReturnValueOnce(apiClient);
  const module = await import('@/services/api');

  return {
    ...module,
    apiClient,
    requestInterceptor,
    responseErrorInterceptor,
  };
}

function responseError(status: number, config?: Record<string, unknown>) {
  const error = new AxiosError('Unauthorized');
  error.config = config as never;
  error.response = { status } as never;
  return error;
}

function unauthorizedError(config: Record<string, unknown>) {
  return responseError(401, config);
}

describe('api service', () => {
  afterEach(() => {
    document.cookie = 'mz_csrf=; Max-Age=0; Path=/';
    vi.resetModules();
    create.mockReset();
    vi.unstubAllEnvs();
  });

  it('uses credentialed transport with the configured API URL', async () => {
    vi.stubEnv('VITE_API_URL', 'https://api.example.test');

    const { default: api, apiClient } = await loadApi();

    expect(api).toBe(apiClient);
    expect(create).toHaveBeenCalledWith({
      baseURL: 'https://api.example.test',
      withCredentials: true,
    });
  });

  it('uses the local API URL by default', async () => {
    vi.stubEnv('VITE_API_URL', '');

    await loadApi();

    expect(create).toHaveBeenCalledWith({
      baseURL: 'http://localhost:3333',
      withCredentials: true,
    });
  });

  it('sends tenant and CSRF proof without constructing authorization headers', async () => {
    document.cookie = 'mz_csrf=signed%3Aproof; Path=/';
    const { requestInterceptor } = await loadApi();
    const config = requestInterceptor?.({ method: 'post', headers: {} });

    expect(config).toEqual({
      method: 'post',
      headers: {
        'X-CSRF-Token': 'signed:proof',
        'X-Tenant-Id': 'mercadozetta',
      },
    });
  });

  it('does not send a CSRF header on safe requests', async () => {
    document.cookie = 'mz_csrf=proof; Path=/';
    const { requestInterceptor } = await loadApi();
    const config = requestInterceptor?.({ method: 'get', headers: {} });

    expect(config).toEqual({
      method: 'get',
      headers: { 'X-Tenant-Id': 'mercadozetta' },
    });
  });

  it('omits the CSRF header when an unsafe request has no proof cookie', async () => {
    const { requestInterceptor } = await loadApi();
    const config = requestInterceptor?.({ method: 'delete', headers: {} });

    expect(config).toEqual({
      method: 'delete',
      headers: { 'X-Tenant-Id': 'mercadozetta' },
    });
  });

  it('uses configured tenant id for tenant-aware requests', async () => {
    vi.stubEnv('VITE_TENANT_ID', 'campus-market');

    const { requestInterceptor } = await loadApi();
    const config = requestInterceptor?.({ method: 'get', headers: {} });

    expect(config).toEqual({
      method: 'get',
      headers: { 'X-Tenant-Id': 'campus-market' },
    });
  });

  it('refreshes once and retries a request after an access-cookie failure', async () => {
    const { apiClient, responseErrorInterceptor } = await loadApi();
    apiClient.post.mockResolvedValue({});
    apiClient.request.mockResolvedValue({ data: 'retried' });
    const config = { headers: {}, method: 'get', url: '/orders' };

    const response = await responseErrorInterceptor?.(
      unauthorizedError(config),
    );

    expect(apiClient.post).toHaveBeenCalledWith('/auth/refresh', undefined, {
      skipAuthRefresh: true,
    });
    expect(apiClient.request).toHaveBeenCalledWith({
      ...config,
      authRetryAttempted: true,
    });
    expect(response).toEqual({ data: 'retried' });
  });

  it('clears in-memory authentication when renewal fails', async () => {
    const {
      apiClient,
      responseErrorInterceptor,
      setAuthenticationFailureHandler,
    } = await loadApi();
    const clearSession = vi.fn();
    setAuthenticationFailureHandler(clearSession);
    apiClient.post.mockRejectedValue(new Error('refresh failed'));

    await expect(
      responseErrorInterceptor?.(
        unauthorizedError({ headers: {}, method: 'get', url: '/orders' }),
      ),
    ).rejects.toThrow('Unauthorized');
    expect(clearSession).toHaveBeenCalledOnce();
  });

  it('retries once after the server reports a concurrent refresh winner', async () => {
    const { apiClient, responseErrorInterceptor } = await loadApi();
    const rotated = new AxiosError('Already rotated');
    rotated.response = { status: 409 } as never;
    apiClient.post
      .mockRejectedValueOnce(rotated)
      .mockResolvedValueOnce({ data: undefined });
    apiClient.request.mockResolvedValue({ data: 'retried' });

    await responseErrorInterceptor?.(
      unauthorizedError({ headers: {}, method: 'get', url: '/orders' }),
    );

    expect(apiClient.post).toHaveBeenCalledTimes(2);
  });

  it('shares one in-flight refresh between parallel failed requests', async () => {
    const { apiClient, responseErrorInterceptor } = await loadApi();
    let finishRefresh!: () => void;
    apiClient.post.mockReturnValue(
      new Promise<void>((resolve) => {
        finishRefresh = resolve;
      }),
    );
    apiClient.request.mockResolvedValue({ data: 'retried' });

    const first = responseErrorInterceptor?.(
      unauthorizedError({ headers: {}, method: 'get', url: '/orders' }),
    );
    const second = responseErrorInterceptor?.(
      unauthorizedError({ headers: {}, method: 'get', url: '/cart' }),
    );
    await Promise.resolve();

    expect(apiClient.post).toHaveBeenCalledOnce();
    finishRefresh();
    await Promise.all([first, second]);
    expect(apiClient.request).toHaveBeenCalledTimes(2);
  });

  it.each([
    ['a non-authentication error', responseError(500, { url: '/orders' })],
    ['a missing request config', responseError(401)],
    [
      'an explicitly skipped request',
      unauthorizedError({ skipAuthRefresh: true }),
    ],
    [
      'an already retried request',
      unauthorizedError({ authRetryAttempted: true }),
    ],
    ['the login request', unauthorizedError({ url: '/auth/login' })],
    ['the refresh request', unauthorizedError({ url: '/auth/refresh' })],
  ])('does not refresh %s', async (_description, error) => {
    const { apiClient, responseErrorInterceptor } = await loadApi();

    await expect(responseErrorInterceptor?.(error)).rejects.toBe(error);
    expect(apiClient.post).not.toHaveBeenCalled();
  });
});
