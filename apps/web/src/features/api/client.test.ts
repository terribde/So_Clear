import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiRequestError, apiRequest, withQuery } from './client';

const meta = { generatedAt: '2026-10-18T00:00:00.000Z', synthetic: true };

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('withQuery', () => {
  it('encodes values and skips empty parameters', () => {
    expect(
      withQuery('/api/v1/example', {
        keyword: '线性 代数',
        page: 2,
        empty: '',
        absent: null,
        missing: undefined,
      }),
    ).toBe('/api/v1/example?keyword=%E7%BA%BF%E6%80%A7+%E4%BB%A3%E6%95%B0&page=2');
  });
});

describe('apiRequest', () => {
  it('sends JSON, credentials and CSRF and returns the envelope data', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ data: { ok: true }, meta, error: null }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const result = await apiRequest<{ ok: boolean }>('/api/v1/example', {
      method: 'PATCH',
      credentials: 'include',
      csrfToken: 'csrf-test',
      body: { expectedVersion: 3 },
    });

    expect(result.data).toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/example',
      expect.objectContaining({
        method: 'PATCH',
        credentials: 'include',
        cache: 'no-store',
        body: '{"expectedVersion":3}',
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
          'X-CSRF-Token': 'csrf-test',
        }),
      }),
    );
  });

  it('throws a typed error with server code and fields', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            data: null,
            meta,
            error: {
              code: 'VERSION_CONFLICT',
              message: '评价已被更新。',
              fields: [{ path: 'expectedVersion', code: 'STALE' }],
            },
          }),
          { status: 409, headers: { 'content-type': 'application/json' } },
        ),
      ),
    );

    await expect(apiRequest('/api/v1/example')).rejects.toMatchObject({
      name: 'ApiRequestError',
      status: 409,
      code: 'VERSION_CONFLICT',
      message: '评价已被更新。',
      fields: [{ path: 'expectedVersion', code: 'STALE' }],
    });
  });

  it('returns null data for 204 responses', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 204 })));

    const result = await apiRequest<null>('/api/v1/logout', { method: 'POST' });

    expect(result.data).toBeNull();
    expect(result.meta.synthetic).toBe(true);
  });
});

describe('ApiRequestError', () => {
  it('preserves status and code for callers', () => {
    const error = new ApiRequestError(403, 'CSRF_FAILED', '校验失败');
    expect(error).toBeInstanceOf(Error);
    expect(error.status).toBe(403);
    expect(error.code).toBe('CSRF_FAILED');
  });
});
