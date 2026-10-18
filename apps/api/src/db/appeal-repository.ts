import { randomUUID } from 'node:crypto';
import type { PGlite } from '@electric-sql/pglite';
import {
  API_ERROR_CODES,
  type AppealDecisionInput,
  type AppealDTO,
  type AppealResolution,
  type AppealStatus,
  type AppealSubmissionInput,
  type AttendanceFrequency,
  type OwnReviewStatus,
} from '@soclear/contracts';
import { ApiError } from '../domain/errors.js';
import { toIso } from './auth-repository.js';

interface AppealRow {
  id: string;
  status: AppealStatus;
  reason: string;
  decision_note: string | null;
  resolution_code: 'restored' | 'upheld' | null;
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
  clarity: number;
  organization: number;
  feedback: number;
  assessment_transparency: number;
  difficulty: number | null;
  workload: number | null;
  attendance: AttendanceFrequency | null;
  comment: string | null;
  submitted_at: string | Date;
  published_at: string | Date | null;
  updated_at: string | Date;
  moderation_reason: string | null;
}

const APPEAL_SELECT = `
  select a.id, a.status, a.reason, a.decision_note, a.resolution_code,
         a.created_at, a.resolved_at, a.version,
         r.id as review_id, r.status as review_status, r.version as review_version,
         r.current_revision,
         t.id as teacher_id, t.name as teacher_name,
         c.id as course_id, c.name as course_name,
         term.id as term_id, term.label as term_label, term.is_current as term_is_current,
         rv.clarity::int as clarity, rv.organization::int as organization,
         rv.feedback::int as feedback, rv.assessment_transparency::int as assessment_transparency,
         rv.difficulty::int as difficulty, rv.workload::int as workload,
         rv.attendance, rv.comment, rv.submitted_at, rv.published_at, r.updated_at,
         (
           select ma.reason_code
           from core.moderation_actions ma
           where ma.review_id = r.id and ma.reason_code is not null
           order by ma.created_at desc, ma.id desc
           limit 1
         ) as moderation_reason
  from core.review_appeals a
  join core.reviews r on r.id = a.review_id
  join core.review_revisions rv
    on rv.review_id = r.id and rv.revision_no = r.current_revision
  join core.teachers t on t.id = r.teacher_id
  join core.courses c on c.id = r.course_id
  join core.terms term on term.id = r.term_id
`;

function toResolution(code: 'restored' | 'upheld' | null): AppealResolution | null {
  if (code === 'restored') return 'restored';
  if (code === 'upheld') return 'upheld';
  return null;
}

function toAppealDTO(row: AppealRow): AppealDTO {
  return {
    id: row.id,
    status: row.status,
    reason: row.reason,
    decisionNote: row.decision_note,
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
      revision: row.current_revision,
      version: row.review_version,
      scores: {
        clarity: row.clarity,
        organization: row.organization,
        feedback: row.feedback,
        assessmentTransparency: row.assessment_transparency,
      },
      descriptive: {
        difficulty: row.difficulty,
        workload: row.workload,
        attendance: row.attendance,
      },
      comment: row.comment,
      submittedAt: toIso(row.submitted_at),
      publishedAt: row.published_at ? toIso(row.published_at) : null,
      updatedAt: toIso(row.updated_at),
      moderationReason: row.moderation_reason,
    },
  };
}

export class AppealRepository {
  constructor(private readonly database: PGlite) {}

  async submit(accountId: string, input: AppealSubmissionInput): Promise<AppealDTO> {
    const appealId = randomUUID();
    const reason = input.reason.trim();

    try {
      await this.database.transaction(async (tx) => {
        const target = await tx.query<{ status: OwnReviewStatus }>(
          `select r.status
           from core.reviews r
           join private.review_authorship own on own.review_id = r.id
           where r.id = $1 and own.account_id = $2
           for update of r`,
          [input.reviewId, accountId],
        );
        const row = target.rows[0];
        if (!row) {
          throw new ApiError(404, API_ERROR_CODES.notFound, '未找到该评价。');
        }
        if (row.status !== 'rejected' && row.status !== 'hidden') {
          throw new ApiError(
            409,
            API_ERROR_CODES.appealNotActionable,
            '只有被驳回或隐藏的评价可以提交申诉。',
          );
        }

        await tx.query(
          `insert into core.review_appeals
            (id, review_id, appellant_account_id, reason)
           values ($1, $2, $3, $4)`,
          [appealId, input.reviewId, accountId, reason],
        );
      });
    } catch (error) {
      if ((error as { code?: string }).code === '23505') {
        throw new ApiError(
          409,
          API_ERROR_CODES.appealAlreadyExists,
          '该评价已经提交过申诉，不能重复提交。',
        );
      }
      throw error;
    }

    const appeal = await this.readAppeal(appealId);
    if (!appeal) throw new Error('Created appeal could not be read back.');
    return toAppealDTO(appeal);
  }

  async listOwnAppeals(
    accountId: string,
    limit: number,
  ): Promise<{ items: AppealDTO[]; total: number }> {
    const rows = await this.database.query<AppealRow>(
      `${APPEAL_SELECT}
       where a.appellant_account_id = $1
       order by a.created_at desc, a.id desc
       limit $2`,
      [accountId, limit],
    );
    const count = await this.database.query<{ count: number }>(
      `select count(*)::int as count
       from core.review_appeals
       where appellant_account_id = $1`,
      [accountId],
    );
    return {
      items: rows.rows.map(toAppealDTO),
      total: count.rows[0]?.count ?? 0,
    };
  }

  async listForModeration(
    status: AppealStatus,
    limit: number,
    offset: number,
  ): Promise<{ items: AppealDTO[]; total: number }> {
    const rows = await this.database.query<AppealRow>(
      `${APPEAL_SELECT}
       where a.status = $1
       order by a.created_at asc, a.id asc
       limit $2 offset $3`,
      [status, limit, offset],
    );
    const count = await this.database.query<{ count: number }>(
      'select count(*)::int as count from core.review_appeals where status = $1',
      [status],
    );
    return {
      items: rows.rows.map(toAppealDTO),
      total: count.rows[0]?.count ?? 0,
    };
  }

  async decide(
    actorId: string,
    appealId: string,
    input: AppealDecisionInput,
  ): Promise<AppealDTO> {
    const note = input.note?.trim() || null;

    await this.database.transaction(async (tx) => {
      const result = await tx.query<{
        status: AppealStatus;
        version: number;
        review_id: string;
        appellant_account_id: string;
        review_status: OwnReviewStatus;
        review_version: number;
        current_revision: number;
        teacher_id: string;
        course_id: string;
        term_id: string;
      }>(
        `select a.status, a.version, a.review_id, a.appellant_account_id,
                r.status as review_status, r.version as review_version,
                r.current_revision, r.teacher_id, r.course_id, r.term_id
         from core.review_appeals a
         join core.reviews r on r.id = a.review_id
         where a.id = $1
         for update of a, r`,
        [appealId],
      );
      const row = result.rows[0];
      if (!row) {
        throw new ApiError(404, API_ERROR_CODES.notFound, '未找到该申诉。');
      }
      if (row.appellant_account_id === actorId) {
        throw new ApiError(403, API_ERROR_CODES.forbidden, '不能处理自己提交的申诉。');
      }
      if (row.status !== 'pending') {
        throw new ApiError(409, API_ERROR_CODES.appealNotActionable, '该申诉已经处理。');
      }
      if (row.version !== input.expectedVersion) {
        throw new ApiError(409, API_ERROR_CODES.versionConflict, '申诉已被更新，请刷新后重试。');
      }

      if (input.decision === 'restore') {
        if (row.review_status !== 'rejected' && row.review_status !== 'hidden') {
          throw new ApiError(
            409,
            API_ERROR_CODES.appealNotActionable,
            '该评价当前不在可恢复公开的状态。',
          );
        }

        const slot = await tx.query<{ active_review_id: string | null }>(
          `select active_review_id
           from private.review_slots
           where account_id = $1 and teacher_id = $2 and course_id = $3 and term_id = $4
           for update`,
          [row.appellant_account_id, row.teacher_id, row.course_id, row.term_id],
        );
        if (slot.rows[0]?.active_review_id !== row.review_id) {
          throw new ApiError(
            409,
            API_ERROR_CODES.appealNotActionable,
            '该评价的课程名额已被其他记录占用，无法恢复公开。',
          );
        }

        if (row.review_status === 'rejected') {
          await tx.query(
            `update core.review_revisions
             set published_at = now()
             where review_id = $1 and revision_no = $2 and published_at is null`,
            [row.review_id, row.current_revision],
          );
        }

        const updated = await tx.query<{ id: string }>(
          `update core.reviews
           set status = 'published',
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
            (review_id, revision_no, actor_account_id, action, from_status, to_status)
           values ($1, $2, $3, 'appeal_restore', $4, 'published')`,
          [row.review_id, row.current_revision, actorId, row.review_status],
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
           values ($1, $2, $3, 'appeal_uphold', $4, $4)`,
          [row.review_id, row.current_revision, actorId, row.review_status],
        );
      }

      const nextStatus: AppealStatus = input.decision === 'restore' ? 'accepted' : 'rejected';
      await tx.query(
        `update core.review_appeals
         set status = $2,
             resolution_code = $3,
             decision_note = $4,
             resolver_account_id = $5,
             resolved_at = now(),
             version = version + 1
         where id = $1 and version = $6`,
        [
          appealId,
          nextStatus,
          input.decision === 'restore' ? 'restored' : 'upheld',
          note,
          actorId,
          row.version,
        ],
      );
    });

    const appeal = await this.readAppeal(appealId);
    if (!appeal) throw new Error('Updated appeal could not be read back.');
    return toAppealDTO(appeal);
  }

  private async readAppeal(appealId: string): Promise<AppealRow | null> {
    const result = await this.database.query<AppealRow>(
      `${APPEAL_SELECT} where a.id = $1`,
      [appealId],
    );
    return result.rows[0] ?? null;
  }
}
