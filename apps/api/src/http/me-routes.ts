import type { FastifyInstance } from 'fastify';
import {
  API_ERROR_CODES,
  API_PREFIX,
  ATTENDANCE_OPTIONS,
  ME_PATHS,
  REPORT_REASONS,
  type AppealSubmissionInput,
  type ReportSubmissionInput,
  type ReviewSubmissionInput,
  type ReviewUpdateInput,
} from '@soclear/contracts';
import type { AuthService } from '../auth/auth-service.js';
import type { AppealRepository } from '../db/appeal-repository.js';
import type { CatalogRepository } from '../db/catalog-repository.js';
import type { ReportRepository } from '../db/report-repository.js';
import type { ReviewRepository } from '../db/review-repository.js';
import { ApiError } from '../domain/errors.js';
import type { FixedWindowRateLimiter } from './rate-limit.js';
import { metaBase } from './meta.js';

interface WithdrawBody {
  expectedVersion: number;
}

const reportReasonValues = REPORT_REASONS.map((reason) => reason.value);

const appealSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['reviewId', 'reason'],
  properties: {
    reviewId: { type: 'string', minLength: 1, maxLength: 64 },
    reason: { type: 'string', minLength: 10, maxLength: 1000 },
  },
} as const;

const reportSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['reviewId', 'reasonCode'],
  properties: {
    reviewId: { type: 'string', minLength: 1, maxLength: 64 },
    reasonCode: { type: 'string', enum: reportReasonValues },
    note: { type: ['string', 'null'], maxLength: 1000 },
  },
} as const;

const scoreSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['clarity', 'organization', 'feedback', 'assessmentTransparency'],
  properties: {
    clarity: { type: 'integer', minimum: 1, maximum: 5 },
    organization: { type: 'integer', minimum: 1, maximum: 5 },
    feedback: { type: 'integer', minimum: 1, maximum: 5 },
    assessmentTransparency: { type: 'integer', minimum: 1, maximum: 5 },
  },
} as const;

const submissionSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['teacherId', 'courseId', 'termId', 'scores'],
  properties: {
    teacherId: { type: 'string', minLength: 1, maxLength: 64 },
    courseId: { type: 'string', minLength: 1, maxLength: 64 },
    termId: { type: 'string', minLength: 1, maxLength: 64 },
    scores: scoreSchema,
    difficulty: { type: ['integer', 'null'], minimum: 1, maximum: 5 },
    workload: { type: ['integer', 'null'], minimum: 1, maximum: 5 },
    attendance: { type: ['string', 'null'], enum: [...ATTENDANCE_OPTIONS, null] },
    comment: { type: ['string', 'null'], maxLength: 1000 },
  },
} as const;

const updateSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['expectedVersion', 'scores'],
  properties: {
    expectedVersion: { type: 'integer', minimum: 1 },
    scores: scoreSchema,
    difficulty: { type: ['integer', 'null'], minimum: 1, maximum: 5 },
    workload: { type: ['integer', 'null'], minimum: 1, maximum: 5 },
    attendance: { type: ['string', 'null'], enum: [...ATTENDANCE_OPTIONS, null] },
    comment: { type: ['string', 'null'], maxLength: 1000 },
  },
} as const;

export function registerMeRoutes(
  app: FastifyInstance,
  auth: AuthService,
  reviews: ReviewRepository,
  reports: ReportRepository,
  appeals: AppealRepository,
  repository: CatalogRepository,
  options: { reportLimiter: FixedWindowRateLimiter },
): void {
  app.get<{ Querystring: { limit?: number } }>(
    ME_PATHS.reviews,
    {
      schema: {
        querystring: {
          type: 'object',
          additionalProperties: false,
          properties: { limit: { type: 'integer', minimum: 1, maximum: 50, default: 20 } },
        },
      },
    },
    async (request) => {
      const session = await auth.requireSession(request);
      const result = await reviews.listOwnReviews(
        session.account.id,
        request.query.limit ?? 20,
      );
      return {
        data: result.items,
        meta: {
          ...metaBase(repository),
          page: { total: result.total, hasMore: false, nextCursor: null },
        },
        error: null,
      };
    },
  );

  app.post<{ Body: ReviewSubmissionInput }>(
    ME_PATHS.reviews,
    { schema: { body: submissionSchema } },
    async (request, reply) => {
      const session = await auth.requireSession(request);
      auth.requireCsrf(session, request);
      auth.requireActiveGrant(session);

      const review = await reviews.submit(session.account.id, request.body);
      return reply.status(201).send({
        data: review,
        meta: metaBase(repository),
        error: null,
      });
    },
  );

  app.patch<{ Params: { reviewId: string }; Body: ReviewUpdateInput }>(
    `${API_PREFIX}/me/reviews/:reviewId`,
    { schema: { body: updateSchema } },
    async (request) => {
      const session = await auth.requireSession(request);
      auth.requireCsrf(session, request);

      const review = await reviews.updateOwnReview(
        session.account.id,
        request.params.reviewId,
        request.body,
      );
      return {
        data: review,
        meta: metaBase(repository),
        error: null,
      };
    },
  );

  app.post<{ Params: { reviewId: string }; Body: WithdrawBody }>(
    `${API_PREFIX}/me/reviews/:reviewId/withdraw`,
    {
      schema: {
        body: {
          type: 'object',
          additionalProperties: false,
          required: ['expectedVersion'],
          properties: {
            expectedVersion: { type: 'integer', minimum: 1 },
          },
        },
      },
    },
    async (request) => {
      const session = await auth.requireSession(request);
      auth.requireCsrf(session, request);

      const review = await reviews.withdraw(
        session.account.id,
        request.params.reviewId,
        request.body.expectedVersion,
      );
      return {
        data: review,
        meta: metaBase(repository),
        error: null,
      };
    },
  );

  app.get<{ Querystring: { limit?: number } }>(
    ME_PATHS.reports,
    {
      schema: {
        querystring: {
          type: 'object',
          additionalProperties: false,
          properties: { limit: { type: 'integer', minimum: 1, maximum: 50, default: 20 } },
        },
      },
    },
    async (request) => {
      const session = await auth.requireSession(request);
      const result = await reports.listOwnReports(
        session.account.id,
        request.query.limit ?? 20,
      );
      return {
        data: result.items,
        meta: {
          ...metaBase(repository),
          page: { total: result.total, hasMore: false, nextCursor: null },
        },
        error: null,
      };
    },
  );

  app.post<{ Body: ReportSubmissionInput }>(
    ME_PATHS.reports,
    { schema: { body: reportSchema } },
    async (request, reply) => {
      const session = await auth.requireSession(request);
      auth.requireCsrf(session, request);

      const decision = options.reportLimiter.consume(`report:${session.account.id}`);
      if (!decision.allowed) {
        const retryAfter = Math.max(1, Math.ceil((decision.resetAt - Date.now()) / 1000));
        reply.header('Retry-After', String(retryAfter));
        throw new ApiError(429, API_ERROR_CODES.rateLimited, '举报提交过于频繁，请稍后再试。');
      }

      const report = await reports.submit(session.account.id, request.body);
      return reply.status(201).send({
        data: report,
        meta: metaBase(repository),
        error: null,
      });
    },
  );

  app.get<{ Querystring: { limit?: number } }>(
    ME_PATHS.appeals,
    {
      schema: {
        querystring: {
          type: 'object',
          additionalProperties: false,
          properties: { limit: { type: 'integer', minimum: 1, maximum: 50, default: 20 } },
        },
      },
    },
    async (request) => {
      const session = await auth.requireSession(request);
      const result = await appeals.listOwnAppeals(
        session.account.id,
        request.query.limit ?? 20,
      );
      return {
        data: result.items,
        meta: {
          ...metaBase(repository),
          page: { total: result.total, hasMore: false, nextCursor: null },
        },
        error: null,
      };
    },
  );

  app.post<{ Body: AppealSubmissionInput }>(
    ME_PATHS.appeals,
    { schema: { body: appealSchema } },
    async (request, reply) => {
      const session = await auth.requireSession(request);
      auth.requireCsrf(session, request);

      const appeal = await appeals.submit(session.account.id, request.body);
      return reply.status(201).send({
        data: appeal,
        meta: metaBase(repository),
        error: null,
      });
    },
  );
}
