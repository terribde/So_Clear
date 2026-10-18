import { randomUUID } from 'node:crypto';
import type { PGlite } from '@electric-sql/pglite';
import {
  API_ERROR_CODES,
  type OwnReviewStatus,
  type ReportDTO,
  type ReportDecisionInput,
  type ReportReasonCode,
  type ReportResolution,
  type ReportStatus,
  type ReportSubmissionInput,
} from '@soclear/contracts';
import { ApiError } from '../domain/errors.js';
import { toIso } from './auth-repository.js';

interface ReportRow {
  id: string;
  status: ReportStatus;
  reason_code: ReportReasonCode;
  note: string | null;
  resolution_code: 'hide' | 'dismiss' | null;
  created_at: string | Date;
  resolved_at: string | Date | null;
  version: number;
  review_id: string;
  review_status: OwnReviewStatus;
  review_version: number;
  current_revision: number;
  teacher_id: string;
  teacher_name: string;
  course_id: string;
  course_name: string;
  term_id: string;
  term_label: string;
  term_is_current: boolean;
  comment: string | null;
  published_at: string | Date | null;
}

const REPORT_SELECT = `
  select rp.id, rp.status, rp.reason_code, rp.note, rp.resolution_code,
         rp.created_at, rp.resolved_at, rp.version,
         r.id as review_id, r.status as review_status, r.version as review_version,
         r.current_revision,
         t.id as teacher_id, t.name as teacher_name,
         c.id as course_id, c.name as course_name,
         term.id as term_id, term.label as term_label, term.is_current as term_is_current,
         rv.comment, rv.published_at
  from core.reports rp
  join core.reviews r on r.id = rp.review_id
  join core.review_revisions rv
    on rv.review_id = r.id and rv.revision_no = r.current_revision
  join core.teachers t on t.id = r.teacher_id
  join core.courses c on c.id = r.course_id
  join core.terms term on term.id = r.term_id
`;

function toResolution(code: 'hide' | 'dismiss' | null): ReportResolution | null {
  if (code === 'hide') return 'hidden';
  if (code === 'dismiss') return 'dismissed';
  return null;
}

function toReportDTO(row: ReportRow): ReportDTO {
  return {
    id: row.id,
    status: row.status,
    reasonCode: row.reason_code,
    note: row.note,
    resolution: toResolution(row.resolution_code),
    createdAt: toIso(row.created_at),
    resolvedAt: row.resolved_at ? toIso(row.resolved_at) : null,
    version: row.version,
    review: {
      id: row.review_id,
      status: row.review_status,
      teacher: { id: row.teacher_id, name: row.teacher_name },
      course: { id: row.course_id, name: row.course_name },
      term: {
        id: row.term_id,
        label: row.term_label,
        isCurrent: row.term_is_current,
      },
      comment: row.comment,
      publishedAt: row.published_at ? toIso(row.published_at) : null,
      revision: row.current_revision,
      version: row.review_version,
    },
  };
}

export class ReportRepository {
  constructor(private readonly database: PGlite) {}

  async submit(accountId: string, input: ReportSubmissionInput): Promise<ReportDTO> {
    const note = input.note?.trim() || null;
    const reportId = randomUUID();

    try {
      await this.database.transaction(async (tx) => {
        const target = await tx.query<{
          status: OwnReviewStatus;
          author_id: string | null;
        }>(
          `select r.status, own.account_id as author_id
           from core.reviews r
           left join private.review_authorship own on own.review_id = r.id
           where r.id = $1
           for update of r`,
          [input.reviewId],
        );
        const row = target.rows[0];
        if (!row) {
          throw new ApiError(404, API_ERROR_CODES.notFound, '未找到该公开评价。');
        }
        if (row.author_id === accountId) {
          throw new ApiError(403, API_ERROR_CODES.reportSelfForbidden, '不能举报自己提交的评价。');
        }
        if (row.status !== 'published') {
          throw new ApiError(
            409,
            API_ERROR_CODES.reportNotActionable,
            '只有当前公开评价可以被举报。',
          );
        }

        await tx.query(
          `insert into core.reports
            (id, review_id, reporter_account_id, reason_code, note)
           values ($1, $2, $3, $4, $5)`,
          [reportId, input.reviewId, accountId, input.reasonCode, note],
        );
      });
    } catch (error) {
      if ((error as { code?: string }).code === '23505') {
        throw new ApiError(
          409,
          API_ERROR_CODES.reportAlreadyExists,
          '你已经举报过这条评价，请等待管理员处理。',
        );
      }
      throw error;
    }

    const report = await this.readReport(reportId);
    if (!report) throw new Error('Created report could not be read back.');
    return toReportDTO(report);
  }

  async listOwnReports(
    accountId: string,
    limit: number,
  ): Promise<{ items: ReportDTO[]; total: number }> {
    const rows = await this.database.query<ReportRow>(
      `${REPORT_SELECT}
       where rp.reporter_account_id = $1
       order by rp.created_at desc, rp.id desc
       limit $2`,
      [accountId, limit],
    );
    const count = await this.database.query<{ count: number }>(
      `select count(*)::int as count
       from core.reports
       where reporter_account_id = $1`,
      [accountId],
    );
    return {
      items: rows.rows.map(toReportDTO),
      total: count.rows[0]?.count ?? 0,
    };
  }

  async listForModeration(
    status: ReportStatus,
    limit: number,
    offset: number,
  ): Promise<{ items: ReportDTO[]; total: number }> {
    const rows = await this.database.query<ReportRow>(
      `${REPORT_SELECT}
       where rp.status = $1
       order by rp.created_at asc, rp.id asc
       limit $2 offset $3`,
      [status, limit, offset],
    );
    const count = await this.database.query<{ count: number }>(
      'select count(*)::int as count from core.reports where status = $1',
      [status],
    );
    return {
      items: rows.rows.map(toReportDTO),
      total: count.rows[0]?.count ?? 0,
    };
  }

  async decide(
    actorId: string,
    reportId: string,
    input: ReportDecisionInput,
  ): Promise<ReportDTO> {
    await this.database.transaction(async (tx) => {
      const result = await tx.query<{
        status: ReportStatus;
        version: number;
        review_id: string;
        review_status: OwnReviewStatus;
        review_version: number;
        current_revision: number;
        teacher_id: string;
      }>(
        `select rp.status, rp.version, rp.review_id,
                r.status as review_status, r.version as review_version,
                r.current_revision, r.teacher_id
         from core.reports rp
         join core.reviews r on r.id = rp.review_id
         where rp.id = $1
         for update of rp, r`,
        [reportId],
      );
      const row = result.rows[0];
      if (!row) {
        throw new ApiError(404, API_ERROR_CODES.notFound, '未找到该举报。');
      }
      if (row.status !== 'pending') {
        throw new ApiError(409, API_ERROR_CODES.reportNotActionable, '该举报已经处理。');
      }
      if (row.version !== input.expectedVersion) {
        throw new ApiError(409, API_ERROR_CODES.versionConflict, '举报已被更新，请刷新后重试。');
      }

      if (input.decision === 'hide') {
        if (row.review_status !== 'published') {
          throw new ApiError(
            409,
            API_ERROR_CODES.reportNotActionable,
            '该评价已不在公开状态，无法执行隐藏。',
          );
        }

        const updated = await tx.query<{ id: string }>(
          `update core.reviews
           set status = 'hidden',
               version = version + 1,
               publication_generation = publication_generation + 1,
               updated_at = now()
           where id = $1 and version = $2
           returning id`,
          [row.review_id, row.review_version],
        );
        if (!updated.rows[0]) {
          throw new ApiError(409, API_ERROR_CODES.versionConflict, '评价已被更新，请刷新后重试。');
        }

        await tx.query(
          `insert into core.moderation_actions
            (review_id, revision_no, actor_account_id, action, reason_code, from_status, to_status)
           values ($1, $2, $3, 'hide', 'report_hide', 'published', 'hidden')`,
          [row.review_id, row.current_revision, actorId],
        );
        await tx.query(
          `update core.reports
           set status = 'resolved',
               resolution_code = 'hide',
               resolver_account_id = $2,
               resolved_at = now(),
               version = version + 1
           where review_id = $1 and status = 'pending'`,
          [row.review_id, actorId],
        );
        await tx.query(
          `update core.teacher_ai_summaries
           set state = 'generating', teacher_summary_epoch = teacher_summary_epoch + 1
           where teacher_id = $1`,
          [row.teacher_id],
        );
      } else {
        await tx.query(
          `insert into core.moderation_actions
            (review_id, revision_no, actor_account_id, action, from_status, to_status)
           values ($1, $2, $3, 'report_dismiss', $4, $4)`,
          [row.review_id, row.current_revision, actorId, row.review_status],
        );
        await tx.query(
          `update core.reports
           set status = 'dismissed',
               resolution_code = 'dismiss',
               resolver_account_id = $2,
               resolved_at = now(),
               version = version + 1
           where id = $1 and version = $3`,
          [reportId, actorId, row.version],
        );
      }
    });

    const report = await this.readReport(reportId);
    if (!report) throw new Error('Updated report could not be read back.');
    return toReportDTO(report);
  }

  private async readReport(reportId: string): Promise<ReportRow | null> {
    const result = await this.database.query<ReportRow>(
      `${REPORT_SELECT} where rp.id = $1`,
      [reportId],
    );
    return result.rows[0] ?? null;
  }
}
