import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { API_ERROR_CODES } from '@soclear/contracts';
import { ApiError } from './errors.js';

const CURSOR_VERSION = 1;
const CURSOR_TTL_SECONDS = 60 * 60;

interface CursorPayload {
  v: 1;
  f: string;
  r: string;
  i: string;
  e: number;
}

export interface CursorPosition {
  rank: string;
  id: string;
}

export function hashFilter(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('base64url').slice(0, 32);
}

function signature(encoded: string, secret: string): string {
  return createHmac('sha256', secret).update(encoded).digest('base64url');
}

export function encodeCursor(position: CursorPosition, filterHash: string, secret: string): string {
  const payload: CursorPayload = {
    v: CURSOR_VERSION,
    f: filterHash,
    r: position.rank,
    i: position.id,
    e: Math.floor(Date.now() / 1000) + CURSOR_TTL_SECONDS,
  };
  const encoded = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  return `${encoded}.${signature(encoded, secret)}`;
}

export function decodeCursor(token: string, filterHash: string, secret: string): CursorPosition | null {
  if (!token) return null;

  const parts = token.split('.');
  if (parts.length !== 2) {
    throw new ApiError(422, API_ERROR_CODES.cursorInvalid, '分页游标格式无效，请重新加载列表。');
  }
  const [encoded, providedSignature] = parts;
  if (!encoded || !providedSignature) {
    throw new ApiError(422, API_ERROR_CODES.cursorInvalid, '分页游标格式无效，请重新加载列表。');
  }

  const expectedSignature = signature(encoded, secret);
  const expectedBuffer = Buffer.from(expectedSignature);
  const providedBuffer = Buffer.from(providedSignature);
  const validSignature =
    expectedBuffer.length === providedBuffer.length && timingSafeEqual(expectedBuffer, providedBuffer);

  if (!validSignature) {
    throw new ApiError(422, API_ERROR_CODES.cursorInvalid, '分页游标校验失败，请重新加载列表。');
  }

  let payload: CursorPayload;
  try {
    payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as CursorPayload;
  } catch {
    throw new ApiError(422, API_ERROR_CODES.cursorInvalid, '分页游标无法解析，请重新加载列表。');
  }

  if (
    payload.v !== CURSOR_VERSION ||
    payload.f !== filterHash ||
    typeof payload.r !== 'string' ||
    typeof payload.i !== 'string' ||
    typeof payload.e !== 'number'
  ) {
    throw new ApiError(422, API_ERROR_CODES.cursorInvalid, '分页游标与当前筛选条件不匹配。');
  }

  if (payload.e < Math.floor(Date.now() / 1000)) {
    throw new ApiError(422, API_ERROR_CODES.cursorInvalid, '分页游标已过期，请重新加载列表。');
  }

  return { rank: payload.r, id: payload.i };
}
