import type { FastifyInstance } from 'fastify';
import {
  ADMIN_PATHS,
  API_PREFIX,
  type AdminAuditActionFilter,
  type AdminAuditActorFilter,
  type AdminSummaryFilter,
  type AppealDecisionInput,
  type AppealStatus,
  type ModerationDecisionInput,
  type OwnReviewStatus,
  type ReportDecisionInput,
  type ReportStatus,
} from '@soclear/contracts';
import type { AuthService } from '../auth/auth-service.js';
import type { AdminOverviewRepository } from '../db/admin-overview-repository.js';
import type { AppealRepository } from '../db/appeal-repository.js';
import type { CatalogRepository } from '../db/catalog-repository.js';
import type { ReportRepository } from '../db/report-repository.js';
import type { ReviewRepository } from '../db/review-repository.js';
import type { SummaryRepository } from '../db/summary-repository.js';
import { metaBase } from './meta.js';

const reviewStatuses: OwnReviewStatus[] = [
  'pending',
  'published',
  'rejected',
  'hidden',
  'withdrawn',
];

const reportStatuses: ReportStatus[] = ['pending', 'resolved', 'dismissed'];

const appealStatuses: AppealStatus[] = ['pending', 'accepted', 'rejected'];

const summaryFilters: AdminSummaryFilter[] = [
  'all',
  'ready',
  'generating',
  'insufficient',
  'unavailable',
];

const auditActions: AdminAuditActionFilter[] = [
  'all',
  'submit',
  'edit',
  'resubmit',
  'approve',
  'reject',
  'hide',
  'withdraw',
  'report_dismiss',
  'appeal_uphold',
  'appeal_restore',
];

const auditActors: AdminAuditActorFilter[] = ['all', 'author', 'moderator'];

const reasonCodes = [
  'insufficient_detail',
  'unsafe_content',
  'off_topic',
  'duplicate',
  'other',
] as const;

export function registerAdminRoutes(
  app: FastifyInstance,
  auth: AuthService,
  reviews: ReviewRepository,
  reports: ReportRepository,
  appeals: AppealRepository,
  summaries: SummaryRepository,
  overview: AdminOverviewRepository,
  repository: CatalogRepository,
): void {
  app.get(ADMIN_PATHS.overview, async (request) => {
    const session = await auth.requireSession(request);
    auth.requireAdmin(session);

    return {
      data: await overview.getOverview(),
      meta: metaBase(repository),
      error: null,
    };
  });

  app.get<{
    Querystring: {
      action?: AdminAuditActionFilter;
      actor?: AdminAuditActorFilter;
      limit?: number;
      offset?: number;
    };
  }>(
    ADMIN_PATHS.audit,
    {
      schema: {
        querystring: {
          type: 'object',
          additionalProperties: false,
          properties: {
            action: { type: 'string', enum: auditActions, default: 'all' },
            actor: { type: 'string', enum: auditActors, default: 'all' },
            limit: { type: 'integer', minimum: 1, maximum: 50, default: 20 },
            offset: { type: 'integer', minimum: 0, default: 0 },
          },
        },
      },
    },
    async (request) => {
      const session = await auth.requireSession(request);
      auth.requireAdmin(session);

      const offset = request.query.offset ?? 0;
      const result = await overview.listAudit(
        request.query.action ?? 'all',
        request.query.actor ?? 'all',
        request.query.limit ?? 20,
        offset,
      );
      return {
        data: result.items,
        meta: {
          ...metaBase(repository),
          page: {
            total: result.total,
            hasMore: offset + result.items.length < result.total,
            nextCursor: null,
          },
        },
        error: null,
      };
    },
  );

  app.get<{
    Querystring: { status?: OwnReviewStatus; limit?: number; offset?: number };
  }>(
    ADMIN_PATHS.reviews,
    {
      schema: {
        querystring: {
          type: 'object',
          additionalProperties: false,
          properties: {
            status: { type: 'string', enum: reviewStatuses, default: 'pending' },
            limit: { type: 'integer', minimum: 1, maximum: 50, default: 20 },
            offset: { type: 'integer', minimum: 0, default: 0 },
          },
        },
      },
    },
    async (request) => {
      const session = await auth.requireSession(request);
      auth.requireAdmin(session);

      const status = request.query.status ?? 'pending';
      const offset = request.query.offset ?? 0;
      const result = await reviews.listForModeration(
        status,
        request.query.limit ?? 20,
        offset,
      );
      return {
        data: result.items,
        meta: {
          ...metaBase(repository),
          page: {
            total: result.total,
            hasMore: offset + result.items.length < result.total,
            nextCursor: null,
          },
        },
        error: null,
      };
    },
  );

  app.get<{ Params: { reviewId: string } }>(
    `${API_PREFIX}/admin/reviews/:reviewId/audit`,
    async (request) => {
      const session = await auth.requireSession(request);
      auth.requireAdmin(session);

      const events = await reviews.listAudit(request.params.reviewId);
      return {
        data: events,
        meta: metaBase(repository),
        error: null,
      };
    },
  );

  app.get<{ Params: { reviewId: string } }>(
    `${API_PREFIX}/admin/reviews/:reviewId/revisions`,
    async (request) => {
      const session = await auth.requireSession(request);
      auth.requireAdmin(session);

      const revisions = await reviews.listRevisions(request.params.reviewId);
      return {
        data: revisions,
        meta: metaBase(repository),
        error: null,
      };
    },
  );

  app.post<{ Params: { reviewId: string }; Body: ModerationDecisionInput }>(
    `${API_PREFIX}/admin/reviews/:reviewId/decisions`,
    {
      schema: {
        body: {
          type: 'object',
          additionalProperties: false,
          required: ['decision', 'expectedVersion'],
          properties: {
            decision: { type: 'string', enum: ['approve', 'reject'] },
            reasonCode: { type: ['string', 'null'], enum: [...reasonCodes, null] },
            expectedVersion: { type: 'integer', minimum: 1 },
          },
        },
      },
    },
    async (request) => {
      const session = await auth.requireSession(request);
      auth.requireCsrf(session, request);
      auth.requireAdmin(session);

      const result = await reviews.decide(
        session.account.id,
        request.params.reviewId,
        request.body,
      );
      return {
        data: result,
        meta: metaBase(repository),
        error: null,
      };
    },
  );

  app.get<{
    Querystring: { status?: ReportStatus; limit?: number; offset?: number };
  }>(
    ADMIN_PATHS.reports,
    {
      schema: {
        querystring: {
          type: 'object',
          additionalProperties: false,
          properties: {
            status: { type: 'string', enum: reportStatuses, default: 'pending' },
            limit: { type: 'integer', minimum: 1, maximum: 50, default: 20 },
            offset: { type: 'integer', minimum: 0, default: 0 },
          },
        },
      },
    },
    async (request) => {
      const session = await auth.requireSession(request);
      auth.requireAdmin(session);

      const status = request.query.status ?? 'pending';
      const offset = request.query.offset ?? 0;
      const result = await reports.listForModeration(
        status,
        request.query.limit ?? 20,
        offset,
      );
      return {
        data: result.items,
        meta: {
          ...metaBase(repository),
          page: {
            total: result.total,
            hasMore: offset + result.items.length < result.total,
            nextCursor: null,
          },
        },
        error: null,
      };
    },
  );

  app.post<{ Params: { reportId: string }; Body: ReportDecisionInput }>(
    `${API_PREFIX}/admin/reports/:reportId/decisions`,
    {
      schema: {
        body: {
          type: 'object',
          additionalProperties: false,
          required: ['decision', 'expectedVersion'],
          properties: {
            decision: { type: 'string', enum: ['dismiss', 'hide'] },
            expectedVersion: { type: 'integer', minimum: 1 },
          },
        },
      },
    },
    async (request) => {
      const session = await auth.requireSession(request);
      auth.requireCsrf(session, request);
      auth.requireAdmin(session);

      const result = await reports.decide(
        session.account.id,
        request.params.reportId,
        request.body,
      );
      return {
        data: result,
        meta: metaBase(repository),
        error: null,
      };
    },
  );

  app.get<{
    Querystring: { status?: AppealStatus; limit?: number; offset?: number };
  }>(
    ADMIN_PATHS.appeals,
    {
      schema: {
        querystring: {
          type: 'object',
          additionalProperties: false,
          properties: {
            status: { type: 'string', enum: appealStatuses, default: 'pending' },
            limit: { type: 'integer', minimum: 1, maximum: 50, default: 20 },
            offset: { type: 'integer', minimum: 0, default: 0 },
          },
        },
      },
    },
    async (request) => {
      const session = await auth.requireSession(request);
      auth.requireAdmin(session);

      const status = request.query.status ?? 'pending';
      const offset = request.query.offset ?? 0;
      const result = await appeals.listForModeration(
        status,
        request.query.limit ?? 20,
        offset,
      );
      return {
        data: result.items,
        meta: {
          ...metaBase(repository),
          page: {
            total: result.total,
            hasMore: offset + result.items.length < result.total,
            nextCursor: null,
          },
        },
        error: null,
      };
    },
  );

  app.post<{ Params: { appealId: string }; Body: AppealDecisionInput }>(
    `${API_PREFIX}/admin/appeals/:appealId/decisions`,
    {
      schema: {
        body: {
          type: 'object',
          additionalProperties: false,
          required: ['decision', 'expectedVersion'],
          properties: {
            decision: { type: 'string', enum: ['restore', 'uphold'] },
            note: { type: ['string', 'null'], maxLength: 1000 },
            expectedVersion: { type: 'integer', minimum: 1 },
          },
        },
      },
    },
    async (request) => {
      const session = await auth.requireSession(request);
      auth.requireCsrf(session, request);
      auth.requireAdmin(session);

      const result = await appeals.decide(
        session.account.id,
        request.params.appealId,
        request.body,
      );
      return {
        data: result,
        meta: metaBase(repository),
        error: null,
      };
    },
  );

  app.get<{
    Querystring: { filter?: AdminSummaryFilter; limit?: number; offset?: number };
  }>(
    ADMIN_PATHS.teacherSummaries,
    {
      schema: {
        querystring: {
          type: 'object',
          additionalProperties: false,
          properties: {
            filter: { type: 'string', enum: summaryFilters, default: 'all' },
            limit: { type: 'integer', minimum: 1, maximum: 50, default: 20 },
            offset: { type: 'integer', minimum: 0, default: 0 },
          },
        },
      },
    },
    async (request) => {
      const session = await auth.requireSession(request);
      auth.requireAdmin(session);

      const filter = request.query.filter ?? 'all';
      const offset = request.query.offset ?? 0;
      const result = await summaries.listForModeration(
        filter,
        request.query.limit ?? 20,
        offset,
      );
      return {
        data: result.items,
        meta: {
          ...metaBase(repository),
          page: {
            total: result.total,
            hasMore: offset + result.items.length < result.total,
            nextCursor: null,
          },
        },
        error: null,
      };
    },
  );

  app.post<{ Params: { teacherId: string }; Body: { expectedEpoch: number } }>(
    `${API_PREFIX}/admin/teachers/:teacherId/summary/regenerate`,
    {
      schema: {
        body: {
          type: 'object',
          additionalProperties: false,
          required: ['expectedEpoch'],
          properties: {
            expectedEpoch: { type: 'integer', minimum: 0 },
          },
        },
      },
    },
    async (request) => {
      const session = await auth.requireSession(request);
      auth.requireCsrf(session, request);
      auth.requireAdmin(session);

      const result = await summaries.regenerate(
        request.params.teacherId,
        request.body.expectedEpoch,
      );
      return {
        data: result,
        meta: metaBase(repository),
        error: null,
      };
    },
  );
}
