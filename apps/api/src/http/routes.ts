import { randomUUID } from 'node:crypto';
import Fastify, { type FastifyInstance } from 'fastify';
import {
  API_ERROR_CODES,
  API_PREFIX,
  TEACHER_SORTS,
  type ApiFailure,
  type TeacherSort,
} from '@soclear/contracts';
import {
  courses,
  currentTerm,
  DATA_VERSION,
  departments,
  departmentsById,
  teachersById,
  terms,
} from '../data/seed.js';
import { ApiError } from '../domain/errors.js';
import { hashFilter } from '../domain/cursor.js';
import {
  isValidTerm,
  paginateRanked,
  searchReviews,
  searchSections,
  searchTeachers,
} from '../domain/catalog.js';
import { toOverviewDTO, toTeacherDTO, toTeacherSummaryDTO } from '../http/dto.js';

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

function metaBase() {
  return {
    generatedAt: new Date().toISOString(),
    dataVersion: DATA_VERSION,
    synthetic: true as const,
  };
}

function requireTeacher(teacherId: string) {
  const teacher = teachersById.get(teacherId);
  if (!teacher) {
    throw new ApiError(404, API_ERROR_CODES.notFound, '未找到该教师。');
  }
  return teacher;
}

export function registerPublicRoutes(app: FastifyInstance, cursorSecret: string): void {
  app.get('/health/live', async () => ({ status: 'ok', synthetic: true, dataVersion: DATA_VERSION }));

  app.get(`${API_PREFIX}/public/overview`, async () => ({
    data: toOverviewDTO(),
    meta: metaBase(),
    error: null,
  }));

  app.get(`${API_PREFIX}/public/departments`, async () => ({
    data: departments.map((department) => ({ ...department })),
    meta: metaBase(),
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
      const query = normalizeText(request.query.q).toLowerCase();
      const data = courses
        .filter((course) => !query || course.name.toLowerCase().includes(query))
        .map((course) => ({ ...course }));
      return { data, meta: metaBase(), error: null };
    },
  );

  app.get(`${API_PREFIX}/public/terms`, async () => ({
    data: terms.map((term) => ({ ...term })),
    meta: metaBase(),
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
      if (departmentId && !departmentsById.has(departmentId)) {
        throw new ApiError(422, API_ERROR_CODES.validation, '学院筛选值无效。', [
          { path: 'departmentId', code: 'UNKNOWN_DEPARTMENT' },
        ]);
      }

      const termRequest = request.query.term?.trim();
      let termId: string | null = null;
      if (termRequest) {
        termId = termRequest === 'current' ? currentTerm.id : termRequest;
        if (!isValidTerm(termId)) {
          throw new ApiError(422, API_ERROR_CODES.validation, '学期筛选值无效。', [
            { path: 'term', code: 'UNKNOWN_TERM' },
          ]);
        }
      }

      const sort = request.query.sort ?? 'overall';
      const limit = request.query.limit ?? 20;
      const filterHash = hashFilter({ kind: 'teachers', q, departmentId, termId, sort });
      const entries = searchTeachers({ q, departmentId, termId, sort });
      const page = paginateRanked(entries, limit, request.query.cursor ?? null, filterHash, cursorSecret);

      return {
        data: page.items,
        meta: {
          ...metaBase(),
          page: { total: page.total, hasMore: page.hasMore, nextCursor: page.nextCursor },
        },
        error: null,
      };
    },
  );

  app.get<{ Params: { teacherId: string } }>(
    `${API_PREFIX}/public/teachers/:teacherId`,
    async (request) => {
      const seedTeacher = requireTeacher(request.params.teacherId);
      return { data: toTeacherDTO(seedTeacher), meta: metaBase(), error: null };
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
      requireTeacher(request.params.teacherId);
      const limit = request.query.limit ?? 20;
      const filterHash = hashFilter({ kind: 'reviews', teacherId: request.params.teacherId });
      const entries = searchReviews(request.params.teacherId);
      const page = paginateRanked(entries, limit, request.query.cursor ?? null, filterHash, cursorSecret);

      return {
        data: page.items,
        meta: {
          ...metaBase(),
          page: { total: page.total, hasMore: page.hasMore, nextCursor: page.nextCursor },
        },
        error: null,
      };
    },
  );

  app.get<{ Params: { teacherId: string } }>(
    `${API_PREFIX}/public/teachers/:teacherId/ai-summary`,
    async (request) => {
      requireTeacher(request.params.teacherId);
      return {
        data: toTeacherSummaryDTO(request.params.teacherId),
        meta: metaBase(),
        error: null,
      };
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
      if (departmentId && !departmentsById.has(departmentId)) {
        throw new ApiError(422, API_ERROR_CODES.validation, '学院筛选值无效。', [
          { path: 'departmentId', code: 'UNKNOWN_DEPARTMENT' },
        ]);
      }
      const termId = request.query.termId?.trim() || currentTerm.id;
      if (!isValidTerm(termId)) {
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
      const entries = searchSections({ q, departmentId, teacherId, termId, campus, weekday });
      const page = paginateRanked(entries, limit, request.query.cursor ?? null, filterHash, cursorSecret);

      return {
        data: page.items,
        meta: {
          ...metaBase(),
          page: { total: page.total, hasMore: page.hasMore, nextCursor: page.nextCursor },
        },
        error: null,
      };
    },
  );
}

export function buildApp(options: { cursorSecret?: string; logger?: boolean } = {}): FastifyInstance {
  const app = Fastify({
    logger: options.logger ?? false,
    genReqId: () => randomUUID(),
    ajv: {
      customOptions: {
        removeAdditional: false,
      },
    },
  });
  const cursorSecret =
    options.cursorSecret ?? process.env.CURSOR_SECRET ?? 'local-development-only-change-me';

  app.addHook('onSend', async (request, reply, payload) => {
    if (request.url.startsWith('/api/')) {
      reply.header('Cache-Control', 'no-store, max-age=0');
      reply.header('X-Content-Type-Options', 'nosniff');
    }
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

  registerPublicRoutes(app, cursorSecret);
  return app;
}
