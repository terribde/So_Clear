import { buildApp } from './http/routes.js';

const host = process.env.API_HOST ?? '127.0.0.1';
const port = Number(process.env.API_PORT ?? 8787);
const isProduction = process.env.NODE_ENV === 'production';
const cursorSecret = process.env.CURSOR_SECRET?.trim();
const sessionSecret = process.env.SESSION_SECRET?.trim();
const demoAuth = !isProduction && process.env.DEMO_AUTH !== 'false';

if (isProduction && (!cursorSecret || cursorSecret === 'local-development-only-change-me')) {
  console.error('CURSOR_SECRET must be set to a unique value in production.');
  process.exit(1);
}

if (isProduction && (!sessionSecret || sessionSecret === 'local-development-session-secret')) {
  console.error('SESSION_SECRET must be set to a unique value in production.');
  process.exit(1);
}

if (isProduction && process.env.DEMO_AUTH === 'true') {
  console.error('DEMO_AUTH cannot be enabled in production.');
  process.exit(1);
}

const positiveInteger = (value: string | undefined, fallback: number) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
};

const app = await buildApp({
  logger: true,
  cursorSecret: cursorSecret || undefined,
  sessionSecret: sessionSecret || undefined,
  demoAuth,
  secureCookies: isProduction,
  trustProxy: process.env.TRUST_PROXY === 'true',
  databasePath: process.env.DATABASE_PATH?.trim() || '.data/pglite',
  rateLimit: {
    limit: positiveInteger(process.env.RATE_LIMIT_MAX, 180),
    windowMs: positiveInteger(process.env.RATE_LIMIT_WINDOW_MS, 60_000),
  },
  loginRateLimit: {
    limit: positiveInteger(process.env.LOGIN_RATE_LIMIT_MAX, 10),
    windowMs: positiveInteger(process.env.LOGIN_RATE_LIMIT_WINDOW_MS, 60_000),
  },
});

const shutdown = async (signal: string) => {
  app.log.info({ signal }, 'shutting down');
  await app.close();
  process.exit(0);
};

process.once('SIGINT', () => void shutdown('SIGINT'));
process.once('SIGTERM', () => void shutdown('SIGTERM'));

try {
  await app.listen({ host, port });
  app.log.info(`SoClear synthetic public API listening on http://${host}:${port}`);
} catch (error) {
  app.log.error(error);
  process.exit(1);
}
