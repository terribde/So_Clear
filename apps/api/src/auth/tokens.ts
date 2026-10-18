import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

export function createSessionToken(): string {
  return randomBytes(32).toString('base64url');
}

export function hashSessionToken(token: string): string {
  return createHash('sha256').update(token).digest('base64url');
}

export function deriveCsrfToken(sessionSecret: string, sessionToken: string): string {
  return createHmac('sha256', sessionSecret)
    .update(`csrf:${sessionToken}`)
    .digest('base64url');
}

export function safeEqual(left: string | undefined, right: string): boolean {
  if (!left) return false;
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}
