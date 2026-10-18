import type { ApiEnvelope, PublicMeta } from '@soclear/contracts';

export class ApiRequestError extends Error {
  readonly status: number;
  readonly code: string;
  readonly fields?: Array<{ path: string; code: string }>;

  constructor(
    status: number,
    code: string,
    message: string,
    fields?: Array<{ path: string; code: string }>,
  ) {
    super(message);
    this.name = 'ApiRequestError';
    this.status = status;
    this.code = code;
    this.fields = fields;
  }
}

export interface ApiResult<T> {
  data: T;
  meta: PublicMeta;
}

function buildQuery(params: Record<string, string | number | undefined | null>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue;
    search.set(key, String(value));
  }
  const rendered = search.toString();
  return rendered ? `?${rendered}` : '';
}

export function withQuery(
  path: string,
  params: Record<string, string | number | undefined | null>,
): string {
  return `${path}${buildQuery(params)}`;
}

export async function apiGet<T>(path: string, signal?: AbortSignal): Promise<ApiResult<T>> {
  let response: Response;
  try {
    response = await fetch(path, {
      method: 'GET',
      credentials: 'omit',
      cache: 'no-store',
      headers: { Accept: 'application/json' },
      signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error;
    throw new ApiRequestError(0, 'NETWORK_UNAVAILABLE', '无法连接查询服务，请检查网络后重试。');
  }

  let envelope: ApiEnvelope<T>;
  try {
    envelope = (await response.json()) as ApiEnvelope<T>;
  } catch {
    throw new ApiRequestError(response.status, 'INVALID_RESPONSE', '查询服务返回了无法解析的响应。');
  }

  if (!response.ok || envelope.error) {
    const error = envelope.error;
    throw new ApiRequestError(
      response.status,
      error?.code ?? 'REQUEST_FAILED',
      error?.message ?? '查询失败，请稍后重试。',
      error?.fields,
    );
  }

  return { data: envelope.data, meta: envelope.meta };
}

export function errorMessage(error: unknown): string {
  if (error instanceof ApiRequestError) return error.message;
  if (error instanceof Error && error.name !== 'AbortError') return error.message;
  return '加载失败，请稍后重试。';
}
