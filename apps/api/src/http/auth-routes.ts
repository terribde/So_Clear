import type { FastifyInstance } from 'fastify';
import {
  API_ERROR_CODES,
  AUTH_PATHS,
  type DemoAccountsDTO,
} from '@soclear/contracts';
import type { AuthService } from '../auth/auth-service.js';
import type { CatalogRepository } from '../db/catalog-repository.js';
import { DEMO_ACCOUNTS } from '../db/demo-accounts.js';
import { ApiError } from '../domain/errors.js';
import type { FixedWindowRateLimiter } from './rate-limit.js';
import { metaBase } from './meta.js';

interface LoginBody {
  handle: string;
  password: string;
}

const loginBodySchema = {
  type: 'object',
  additionalProperties: false,
  required: ['handle', 'password'],
  properties: {
    handle: { type: 'string', minLength: 1, maxLength: 64 },
    password: { type: 'string', minLength: 8, maxLength: 200 },
  },
} as const;

export function registerAuthRoutes(
  app: FastifyInstance,
  auth: AuthService,
  repository: CatalogRepository,
  options: { demoAuth: boolean; loginLimiter: FixedWindowRateLimiter },
): void {
  app.get(AUTH_PATHS.session, async (request) => {
    const session = await auth.resolve(request);
    return {
      data: auth.toDTO(session),
      meta: metaBase(repository),
      error: null,
    };
  });

  app.post<{ Body: LoginBody }>(
    AUTH_PATHS.login,
    { schema: { body: loginBodySchema } },
    async (request, reply) => {
      if (!options.demoAuth) {
        throw new ApiError(
          503,
          API_ERROR_CODES.authUnavailable,
          '当前版本未开放账号登录。',
        );
      }

      const decision = options.loginLimiter.consume(`login:${request.ip}`);
      if (!decision.allowed) {
        const retryAfter = Math.max(1, Math.ceil((decision.resetAt - Date.now()) / 1000));
        reply.header('Retry-After', String(retryAfter));
        throw new ApiError(429, API_ERROR_CODES.rateLimited, '登录尝试过于频繁，请稍后再试。');
      }

      const result = await auth.login(request.body.handle, request.body.password);
      if (!result) {
        throw new ApiError(
          401,
          API_ERROR_CODES.invalidCredentials,
          '账号或密码不正确。',
        );
      }

      auth.setCookie(reply, result.token);
      return {
        data: auth.toDTO(result.session),
        meta: metaBase(repository),
        error: null,
      };
    },
  );

  app.post(AUTH_PATHS.logout, async (request, reply) => {
    const session = await auth.resolve(request);
    if (session) {
      auth.requireCsrf(session, request);
      await auth.logout(session);
    }
    auth.clearCookie(reply);
    return reply.status(204).send();
  });

  app.get(AUTH_PATHS.demoAccounts, async () => {
    if (!options.demoAuth) {
      throw new ApiError(503, API_ERROR_CODES.authUnavailable, '当前版本未开放演示账号。');
    }
    const data: DemoAccountsDTO = {
      enabled: true,
      accounts: DEMO_ACCOUNTS.map((account) => ({
        handle: account.handle,
        password: account.password,
        role: account.role,
        student: account.student,
        label: account.label,
      })),
    };
    return { data, meta: metaBase(repository), error: null };
  });
}
