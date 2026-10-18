import { randomUUID } from 'node:crypto';
import cookie from '@fastify/cookie';
import Fastify, { type FastifyInstance } from 'fastify';
import {
  API_ERROR_CODES,
  API_PREFIX,
  TEACHER_SORTS,
  type ApiFailure,
  type TeacherSort,
} from '@soclear/contracts';
import { AuthService } from '../auth/auth-service.js';
import { AdminOverviewRepository } from '../db/admin-overview-repository.js';
import { AuthRepository } from '../db/auth-repository.js';
import { AppealRepository } from '../db/appeal-repository.js';
import { CatalogRepository } from '../db/catalog-repository.js';
import { createDatabase } from '../db/database.js';
import { seedDemoAccounts } from '../db/demo-accounts.js';
import { ReportRepository } from '../db/report-repository.js';
import { ReviewRepository } from '../db/review-repository.js';
import { SummaryRepository } from '../db/summary-repository.js';
import { ApiError } from '../domain/errors.js';
import { hashFilter } from '../domain/cursor.js';
import {
  paginateRanked,
  searchReviews,
  searchSections,
  searchTeachers,
} from '../domain/catalog.js';
import { registerAdminRoutes } from './admin-routes.js';
import { registerAuthRoutes } from './auth-routes.js';
import { registerMeRoutes } from './me-routes.js';
import { metaBase } from './meta.js';
import { FixedWindowRateLimiter, type RateLimitOptions } from './rate-limit.js';

const sortValues = TEACHER_SORTS.map((sort) => sort.value);

interface TeacherQuerystring {
  q?: string;
  departmentId?: string;
  term?: string;
  sort?: TeacherSort;
  limit?: number;
  cursor?: string;
}

interface SectionQuerystring {
  q?: string;
  departmentId?: string;
  teacherId?: string;
  termId?: string;
  campus?: string;
  weekday?: number;
  limit?: number;
  cursor?: string;
}

interface ReviewQuerystring {
  limit?: number;
  cursor?: string;
}

const baseQuerystringProperties = {
  limit: { type: 'integer', minimum: 1, maximum: 50, default: 20 },
  cursor: { type: 'string', maxLength: 512 },
} as const;

const normalizeText = (value: string | undefined) => (value ?? '').trim().replace(/\s+/g, ' ');

export function registerPublicRoutes(
  app: FastifyInstance,
  cursorSecret: string,
  repository: CatalogRepository,
): void {
  app.get('/health/live', async () => ({
    status: 'ok',
    synthetic: true,
    dataVersion: repository.dataVersion,
  }));

  app.get('/health/ready', async (_request, reply) => {
    try {
      await repository.ping();
      return { status: 'ready', synthetic: true, dataVersion: repository.dataVersion };
    } catch {
      return reply.status(503).send({ status: 'not_ready', synthetic: true });
    }
  });

  app.get(`${API_PREFIX}/public/overview`, async () => ({
    data: await repository.overview(),
    meta: metaBase(repository),
    error: null,
  }));

  app.get(`${API_PREFIX}/public/departments`, async () => ({
    data: await repository.listDepartments(),
    meta: metaBase(repository),
    error: null,
  }));

  app.get<{ Querystring: { q?: string } }>(
    `${API_PREFIX}/public/courses`,
    {
      schema: {
        querystring: {
          type: 'object',
          additionalProperties: false,
          properties: { q: { type: 'string', maxLength: 80 } },
        },
      },
    },
    async (request) => {
      const query = normalizeText(request.query.q);
      return {
        data: await repository.listCourses(query),
        meta: metaBase(repository),
        error: null,
      };
    },
  );

  app.get(`${API_PREFIX}/public/terms`, async () => ({
    data: await repository.listTerms(),
    meta: metaBase(repository),
    error: null,
  }));

  app.get<{ Querystring: TeacherQuerystring }>(
    `${API_PREFIX}/public/teachers`,
    {
      schema: {
        querystring: {
          type: 'object',
          additionalProperties: false,
          properties: {
            q: { type: 'string', maxLength: 80 },
            departmentId: { type: 'string', maxLength: 64 },
            term: { type: 'string', maxLength: 64 },
            sort: { type: 'string', enum: sortValues, default: 'overall' },
            ...baseQuerystringProperties,
          },
        },
      },
    },
    async (request) => {
      const q = normalizeText(request.query.q);
      const departmentId = request.query.departmentId?.trim() || null;
      if (departmentId && !(await repository.hasDepartment(departmentId))) {
        throw new ApiError(422, API_ERROR_CODES.validation, '学院筛选值无效。', [
          { path: 'departmentId', code: 'UNKNOWN_DEPARTMENT' },
        ]);
      }

      const termRequest = request.query.term?.trim();
      let termId: string | null = null;
      if (termRequest) {
        termId =
          termRequest === 'current' ? (await repository.getCurrentTerm()).id : termRequest;
        if (!(await repository.hasTerm(termId))) {
          throw new ApiError(422, API_ERROR_CODES.validation, '学期筛选值无效。', [
            { path: 'term', code: 'UNKNOWN_TERM' },
          ]);
        }
      }

      const sort = request.query.sort ?? 'overall';
      const limit = request.query.limit ?? 20;
      const filterHash = hashFilter({ kind: 'teachers', q, departmentId, termId, sort });
      const teachers = await repository.listTeachers();
      const termTeacherIds = termId
        ? await repository.listTeacherIdsTeachingTerm(termId)
        : null;
      const entries = searchTeachers(
        teachers,
        { q, departmentId, termId, sort },
        termTeacherIds,
      );
      const page = paginateRanked(entries, limit, request.query.cursor ?? null, filterHash, cursorSecret);

      return {
        data: page.items,
        meta: {
          ...metaBase(repository),
          page: { total: page.total, hasMore: page.hasMore, nextCursor: page.nextCursor },
        },
        error: null,
      };
    },
  );

  app.get<{ Params: { reviewId: string } }>(
    `${API_PREFIX}/public/reviews/:reviewId`,
    async (request) => {
      const review = await repository.getReview(request.params.reviewId);
      if (!review) {
        throw new ApiError(404, API_ERROR_CODES.notFound, '未找到该公开评价。');
      }
      return { data: review, meta: metaBase(repository), error: null };
    },
  );

  app.get<{ Params: { teacherId: string } }>(
    `${API_PREFIX}/public/teachers/:teacherId`,
    async (request) => {
      const teacher = await repository.getTeacher(request.params.teacherId);
      if (!teacher) {
        throw new ApiError(404, API_ERROR_CODES.notFound, '未找到该教师。');
      }
      return { data: teacher, meta: metaBase(repository), error: null };
    },
  );

  app.get<{ Params: { teacherId: string }; Querystring: ReviewQuerystring }>(
    `${API_PREFIX}/public/teachers/:teacherId/reviews`,
    {
      schema: {
        querystring: {
          type: 'object',
          additionalProperties: false,
          properties: baseQuerystringProperties,
        },
      },
    },
    async (request) => {
      const teacher = await repository.getTeacher(request.params.teacherId);
      if (!teacher) {
        throw new ApiError(404, API_ERROR_CODES.notFound, '未找到该教师。');
      }
      const limit = request.query.limit ?? 20;
      const filterHash = hashFilter({ kind: 'reviews', teacherId: request.params.teacherId });
      const reviews = await repository.listReviews(request.params.teacherId);
      const entries = searchReviews(reviews);
      const page = paginateRanked(entries, limit, request.query.cursor ?? null, filterHash, cursorSecret);

      return {
        data: page.items,
        meta: {
          ...metaBase(repository),
          page: { total: page.total, hasMore: page.hasMore, nextCursor: page.nextCursor },
        },
        error: null,
      };
    },
  );

  app.get<{ Params: { teacherId: string } }>(
    `${API_PREFIX}/public/teachers/:teacherId/ai-summary`,
    async (request) => {
      const summary = await repository.getTeacherSummary(request.params.teacherId);
      if (!summary) {
        throw new ApiError(404, API_ERROR_CODES.notFound, '未找到该教师。');
      }
      return { data: summary, meta: metaBase(repository), error: null };
    },
  );

  app.get<{ Querystring: SectionQuerystring }>(
    `${API_PREFIX}/public/sections`,
    {
      schema: {
        querystring: {
          type: 'object',
          additionalProperties: false,
          properties: {
            q: { type: 'string', maxLength: 80 },
            departmentId: { type: 'string', maxLength: 64 },
            teacherId: { type: 'string', maxLength: 64 },
            termId: { type: 'string', maxLength: 64 },
            campus: { type: 'string', maxLength: 20 },
            weekday: { type: 'integer', minimum: 1, maximum: 7 },
            ...baseQuerystringProperties,
          },
        },
      },
    },
    async (request) => {
      const q = normalizeText(request.query.q);
      const departmentId = request.query.departmentId?.trim() || null;
      if (departmentId && !(await repository.hasDepartment(departmentId))) {
        throw new ApiError(422, API_ERROR_CODES.validation, '学院筛选值无效。', [
          { path: 'departmentId', code: 'UNKNOWN_DEPARTMENT' },
        ]);
      }
      const termId = request.query.termId?.trim() || (await repository.getCurrentTerm()).id;
      if (!(await repository.hasTerm(termId))) {
        throw new ApiError(422, API_ERROR_CODES.validation, '学期筛选值无效。', [
          { path: 'termId', code: 'UNKNOWN_TERM' },
        ]);
      }
      const campus = request.query.campus?.trim() || null;
      const weekday = request.query.weekday ?? null;
      const teacherId = request.query.teacherId?.trim() || null;
      const limit = request.query.limit ?? 20;
      const filterHash = hashFilter({
        kind: 'sections',
        q,
        departmentId,
        teacherId,
        termId,
        campus,
        weekday,
      });
      const sections = await repository.listSections(termId, departmentId);
      const entries = searchSections(sections, {
        q,
        teacherId,
        termId,
        campus,
        weekday,
      });
      const page = paginateRanked(entries, limit, request.query.cursor ?? null, filterHash, cursorSecret);

      return {
        data: page.items,
        meta: {
          ...metaBase(repository),
          page: { total: page.total, hasMore: page.hasMore, nextCursor: page.nextCursor },
        },
        error: null,
      };
    },
  );

  app.get<{ Params: { sectionId: string } }>(
    `${API_PREFIX}/public/sections/:sectionId`,
    async (request) => {
      const section = await repository.getSection(request.params.sectionId);
      if (!section) {
        throw new ApiError(404, API_ERROR_CODES.notFound, '未找到该开课。');
      }
      return { data: section, meta: metaBase(repository), error: null };
    },
  );
}

export interface BuildAppOptions {
  cursorSecret?: string;
  logger?: boolean;
  rateLimit?: RateLimitOptions | false;
  trustProxy?: boolean;
  databasePath?: string;
  demoAuth?: boolean;
  secureCookies?: boolean;
  sessionSecret?: string;
  loginRateLimit?: RateLimitOptions;
  reportRateLimit?: RateLimitOptions;
}

export async function buildApp(options: BuildAppOptions = {}): Promise<FastifyInstance> {
  const database = await createDatabase({ dataDir: options.databasePath });
  const repository = new CatalogRepository(database);
  const reviews = new ReviewRepository(database);
  const reports = new ReportRepository(database);
  const appeals = new AppealRepository(database);
  const summaries = new SummaryRepository(database);
  const overview = new AdminOverviewRepository(database);
  const demoAuth = options.demoAuth ?? false;
  const secureCookies = options.secureCookies ?? false;

  if (demoAuth) {
    await seedDemoAccounts(database);
  }

  const auth = new AuthService(new AuthRepository(database), {
    cookieName: secureCookies ? '__Host-sc_session' : 'sc_session',
    sessionSecret:
      options.sessionSecret ?? process.env.SESSION_SECRET ?? 'local-development-session-secret',
    demoAuth,
    secureCookie: secureCookies,
  });

  const app = Fastify({
    logger: options.logger ?? false,
    genReqId: () => randomUUID(),
    bodyLimit: 16 * 1024,
    requestTimeout: 10_000,
    trustProxy: options.trustProxy ?? false,
    ajv: {
      customOptions: {
        removeAdditional: false,
      },
    },
  });
  await app.register(cookie);
  const cursorSecret =
    options.cursorSecret ?? process.env.CURSOR_SECRET ?? 'local-development-only-change-me';
  const rateLimiter =
    options.rateLimit === false
      ? null
      : new FixedWindowRateLimiter(options.rateLimit ?? { limit: 180, windowMs: 60_000 });

  app.addHook('onClose', async () => {
    await database.close();
  });

  app.addHook('onRequest', async (request, reply) => {
    if (!rateLimiter || !request.url.startsWith('/api/')) return;

    const decision = rateLimiter.consume(request.ip);
    const resetSeconds = Math.max(1, Math.ceil((decision.resetAt - Date.now()) / 1000));
    reply.header('RateLimit-Limit', String(decision.limit));
    reply.header('RateLimit-Remaining', String(decision.remaining));
    reply.header('RateLimit-Reset', String(resetSeconds));

    if (decision.allowed) return;

    reply.header('Retry-After', String(resetSeconds));
    const body: ApiFailure = {
      data: null,
      meta: { requestId: request.id, generatedAt: new Date().toISOString(), synthetic: true },
      error: {
        code: API_ERROR_CODES.rateLimited,
        message: '请求过于频繁，请稍后再试。',
      },
    };
    return reply.status(429).send(body);
  });

  app.addHook('onSend', async (request, reply, payload) => {
    if (request.url.startsWith('/api/') || request.url.startsWith('/health/')) {
      reply.header('Cache-Control', 'no-store, max-age=0');
    }
    reply.header('X-Content-Type-Options', 'nosniff');
    reply.header('X-Frame-Options', 'DENY');
    reply.header('Referrer-Policy', 'no-referrer');
    reply.header('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=(), usb=()');
    reply.header('Cross-Origin-Opener-Policy', 'same-origin');
    reply.header('Cross-Origin-Resource-Policy', 'same-site');
    reply.header(
      'Content-Security-Policy',
      "default-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
    );
    reply.header('X-Request-ID', request.id);
    return payload;
  });

  app.setErrorHandler((error, request, reply) => {
    let statusCode = 500;
    let code: string = API_ERROR_CODES.internal;
    let message = '服务暂时不可用，请稍后再试。';
    let fields: Array<{ path: string; code: string }> | undefined;

    if (error instanceof ApiError) {
      statusCode = error.statusCode;
      code = error.code;
      message = error.message;
      fields = error.fields;
    } else if (
      typeof error === 'object' &&
      error !== null &&
      'validation' in error &&
      Array.isArray((error as { validation?: unknown }).validation)
    ) {
      statusCode = 422;
      code = API_ERROR_CODES.validation;
      message = '请检查查询参数。';
      fields = (
        error as {
          validation: Array<{
            instancePath?: string;
            keyword?: string;
            params?: Record<string, unknown>;
          }>;
        }
      ).validation.map((issue) => ({
        path:
          issue.instancePath?.replace(/^\//, '') ||
          String(issue.params?.['missingProperty'] ?? 'query'),
        code: (issue.keyword ?? 'invalid').toUpperCase(),
      }));
    } else {
      request.log.error({ err: error }, 'unhandled request failure');
    }

    const body: ApiFailure = {
      data: null,
      meta: { requestId: request.id, generatedAt: new Date().toISOString(), synthetic: true },
      error: { code, message, ...(fields ? { fields } : {}) },
    };

    reply.status(statusCode).send(body);
  });

  app.setNotFoundHandler((request, reply) => {
    reply.status(404).send({
      data: null,
      meta: { requestId: request.id, generatedAt: new Date().toISOString(), synthetic: true },
      error: { code: API_ERROR_CODES.notFound, message: '请求的资源不存在。' },
    } satisfies ApiFailure);
  });

  registerPublicRoutes(app, cursorSecret, repository);
  registerAuthRoutes(app, auth, repository, {
    demoAuth,
    loginLimiter: new FixedWindowRateLimiter(
      options.loginRateLimit ?? { limit: 10, windowMs: 60_000 },
    ),
  });
  registerMeRoutes(app, auth, reviews, reports, appeals, repository, {
    reportLimiter: new FixedWindowRateLimiter(
      options.reportRateLimit ?? { limit: 20, windowMs: 60 * 60 * 1000 },
    ),
  });
  registerAdminRoutes(app, auth, reviews, reports, appeals, summaries, overview, repository);
  return app;
}
