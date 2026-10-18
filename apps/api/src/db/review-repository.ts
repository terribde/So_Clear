import type { PGlite } from '@electric-sql/pglite';
import { randomUUID } from 'node:crypto';
import {
  API_ERROR_CODES,
  type AdminReviewDTO,
  type AdminReviewRevisionDTO,
  type AttendanceFrequency,
  type AuditAction,
  type AuditEventDTO,
  type ModerationDecisionInput,
  type OwnReviewDTO,
  type OwnReviewStatus,
  type ReviewSubmissionInput,
  type ReviewUpdateInput,
} from '@soclear/contracts';
import { ApiError } from '../domain/errors.js';
import { toIso } from './auth-repository.js';

interface OwnReviewRow {
  id: string;
  status: OwnReviewStatus;
  version: number;
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

interface ModerationRow {
  id: string;
  status: OwnReviewStatus;
  version: number;
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
}

interface DecisionRow {
  status: OwnReviewStatus;
  version: number;
  current_revision: number;
  teacher_id: string;
  author_id: string;
}

interface AuditRow {
  id: number;
  action: string;
  reason_code: string | null;
  from_status: OwnReviewStatus | null;
  to_status: OwnReviewStatus;
  revision_no: number;
  created_at: string | Date;
}

interface RevisionRow {
  revision_no: number;
  current_revision: number;
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
}

const OWN_REVIEW_SELECT = `
  select r.id, r.status, r.version, r.current_revision,
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
           where ma.review_id = r.id and ma.action = 'reject'
           order by ma.created_at desc
           limit 1
         ) as moderation_reason
  from core.reviews r
  join core.review_revisions rv
    on rv.review_id = r.id and rv.revision_no = r.current_revision
  join core.teachers t on t.id = r.teacher_id
  join core.courses c on c.id = r.course_id
  join core.terms term on term.id = r.term_id
`;

const MODERATION_SELECT = `
  select r.id, r.status, r.version, r.current_revision,
         t.id as teacher_id, t.name as teacher_name,
         c.id as course_id, c.name as course_name,
         term.id as term_id, term.label as term_label, term.is_current as term_is_current,
         rv.clarity::int as clarity, rv.organization::int as organization,
         rv.feedback::int as feedback, rv.assessment_transparency::int as assessment_transparency,
         rv.difficulty::int as difficulty, rv.workload::int as workload,
         rv.attendance, rv.comment, rv.submitted_at, rv.published_at, r.updated_at
  from core.reviews r
  join core.review_revisions rv
    on rv.review_id = r.id and rv.revision_no = r.current_revision
  join core.teachers t on t.id = r.teacher_id
  join core.courses c on c.id = r.course_id
  join core.terms term on term.id = r.term_id
`;

export class ReviewRepository {
  constructor(private readonly database: PGlite) {}

  async validateTargets(
    teacherId: string,
    courseId: string,
    termId: string,
  ): Promise<void> {
    const result = await this.database.query<{
      teacher_exists: boolean;
      course_exists: boolean;
      term_exists: boolean;
      course_taught: boolean;
    }>(
      `select
         exists(select 1 from core.teachers where id = $1 and is_active) as teacher_exists,
         exists(select 1 from core.courses where id = $2) as course_exists,
         exists(select 1 from core.terms where id = $3) as term_exists,
         exists(
           select 1 from core.teacher_courses where teacher_id = $1 and course_id = $2
         ) as course_taught`,
      [teacherId, courseId, termId],
    );
    const row = result.rows[0]!;
    const fields: Array<{ path: string; code: string }> = [];
    if (!row.teacher_exists) fields.push({ path: 'teacherId', code: 'UNKNOWN_TEACHER' });
    if (!row.course_exists) fields.push({ path: 'courseId', code: 'UNKNOWN_COURSE' });
    if (!row.term_exists) fields.push({ path: 'termId', code: 'UNKNOWN_TERM' });
    if (row.teacher_exists && row.course_exists && !row.course_taught) {
      fields.push({ path: 'courseId', code: 'COURSE_NOT_TAUGHT' });
    }
    if (fields.length > 0) {
      throw new ApiError(422, API_ERROR_CODES.validation, '评价关联的教师、课程或学期无效。', fields);
    }
  }

  async submit(accountId: string, input: ReviewSubmissionInput): Promise<OwnReviewDTO> {
    await this.validateTargets(input.teacherId, input.courseId, input.termId);

    const reviewId = `rv-${randomUUID()}`;
    try {
      await this.database.transaction(async (tx) => {
        await tx.query(
          `insert into core.reviews
            (id, teacher_id, course_id, term_id, status, current_revision,
             publication_generation, version, created_at, updated_at)
           values ($1, $2, $3, $4, 'pending', 1, 0, 1, now(), now())`,
          [reviewId, input.teacherId, input.courseId, input.termId],
        );
        await tx.query(
          `insert into core.review_revisions
            (review_id, revision_no, clarity, organization, feedback, assessment_transparency,
             difficulty, workload, attendance, comment, rating_schema_version, submitted_at, published_at)
           values ($1, 1, $2, $3, $4, $5, $6, $7, $8, $9, 1, now(), null)`,
          [
            reviewId,
            input.scores.clarity,
            input.scores.organization,
            input.scores.feedback,
            input.scores.assessmentTransparency,
            input.difficulty ?? null,
            input.workload ?? null,
            input.attendance ?? null,
            input.comment?.trim() ? input.comment.trim() : null,
          ],
        );
        await tx.query(
          `insert into private.review_authorship (review_id, account_id)
           values ($1, $2)`,
          [reviewId, accountId],
        );

        const slot = await tx.query<{ active_review_id: string | null }>(
          `select active_review_id
           from private.review_slots
           where account_id = $1 and teacher_id = $2 and course_id = $3 and term_id = $4
           for update`,
          [accountId, input.teacherId, input.courseId, input.termId],
        );

        if (slot.rows[0]?.active_review_id) {
          throw new ApiError(
            409,
            API_ERROR_CODES.reviewSlotTaken,
            '你对该教师、课程与学期已有一条未撤回评价。',
          );
        }

        if (slot.rows[0]) {
          await tx.query(
            `update private.review_slots
             set active_review_id = $5, updated_at = now()
             where account_id = $1 and teacher_id = $2 and course_id = $3 and term_id = $4`,
            [accountId, input.teacherId, input.courseId, input.termId, reviewId],
          );
        } else {
          await tx.query(
            `insert into private.review_slots
              (account_id, teacher_id, course_id, term_id, active_review_id)
             values ($1, $2, $3, $4, $5)`,
            [accountId, input.teacherId, input.courseId, input.termId, reviewId],
          );
        }

        await tx.query(
          `insert into core.moderation_actions
            (review_id, revision_no, actor_account_id, action, from_status, to_status)
           values ($1, 1, $2, 'submit', null, 'pending')`,
          [reviewId, accountId],
        );
      });
    } catch (error) {
      if ((error as { code?: string }).code === '23505') {
        throw new ApiError(
          409,
          API_ERROR_CODES.reviewSlotTaken,
          '你对该教师、课程与学期已有一条未撤回评价。',
        );
      }
      throw error;
    }

    const review = await this.getOwnReview(accountId, reviewId);
    if (!review) throw new Error('Submitted review could not be read back.');
    return review;
  }

  async getOwnReview(accountId: string, reviewId: string): Promise<OwnReviewDTO | null> {
    const result = await this.database.query<OwnReviewRow>(
      `${OWN_REVIEW_SELECT}
       join private.review_authorship own on own.review_id = r.id
       where r.id = $1 and own.account_id = $2`,
      [reviewId, accountId],
    );
    const row = result.rows[0];
    return row ? toOwnReviewDTO(row) : null;
  }

  async listOwnReviews(
    accountId: string,
    limit: number,
  ): Promise<{ items: OwnReviewDTO[]; total: number }> {
    const rows = await this.database.query<OwnReviewRow>(
      `${OWN_REVIEW_SELECT}
       join private.review_authorship own on own.review_id = r.id
       where own.account_id = $1
       order by r.updated_at desc, r.id desc
       limit $2`,
      [accountId, limit],
    );
    const count = await this.database.query<{ count: number }>(
      `select count(*)::int as count
       from core.reviews r
       join private.review_authorship own on own.review_id = r.id
       where own.account_id = $1`,
      [accountId],
    );
    return {
      items: rows.rows.map(toOwnReviewDTO),
      total: count.rows[0]?.count ?? 0,
    };
  }

  async updateOwnReview(
    accountId: string,
    reviewId: string,
    input: ReviewUpdateInput,
  ): Promise<OwnReviewDTO> {
    await this.database.transaction(async (tx) => {
      const result = await tx.query<{
        status: OwnReviewStatus;
        version: number;
        current_revision: number;
        rating_schema_version: number;
        teacher_id: string;
        publication_generation: number;
        pending_appeal: boolean;
      }>(
        `select r.status, r.version, r.current_revision, rv.rating_schema_version,
                r.teacher_id, r.publication_generation,
                exists(
                  select 1 from core.review_appeals a
                  where a.review_id = r.id and a.status = 'pending'
                ) as pending_appeal
         from core.reviews r
         join private.review_authorship own on own.review_id = r.id
         join core.review_revisions rv
           on rv.review_id = r.id and rv.revision_no = r.current_revision
         where r.id = $1 and own.account_id = $2
         for update of r`,
        [reviewId, accountId],
      );
      const row = result.rows[0];
      if (!row) {
        throw new ApiError(404, API_ERROR_CODES.notFound, '未找到该评价。');
      }
      if (row.version !== input.expectedVersion) {
        throw new ApiError(409, API_ERROR_CODES.versionConflict, '评价已被更新，请刷新后重试。');
      }
      if (
        row.status !== 'pending' &&
        row.status !== 'rejected' &&
        row.status !== 'published' &&
        row.status !== 'hidden'
      ) {
        throw new ApiError(
          409,
          API_ERROR_CODES.reviewNotEditable,
          '只有待审核、被驳回、已公开或已隐藏的评价可以修订；已撤回的内容已锁定。',
        );
      }
      if (
        (row.status === 'rejected' || row.status === 'hidden') &&
        row.pending_appeal
      ) {
        throw new ApiError(
          409,
          API_ERROR_CODES.reviewNotEditable,
          '该评价的申诉正在复核中，请等待处理结果后再修订。',
        );
      }

      const isResubmission = row.status !== 'pending';
      const nextRevision = row.current_revision + 1;
      await tx.query(
        `insert into core.review_revisions
          (review_id, revision_no, clarity, organization, feedback, assessment_transparency,
           difficulty, workload, attendance, comment, rating_schema_version,
           submitted_at, published_at)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, now(), null)`,
        [
          reviewId,
          nextRevision,
          input.scores.clarity,
          input.scores.organization,
          input.scores.feedback,
          input.scores.assessmentTransparency,
          input.difficulty ?? null,
          input.workload ?? null,
          input.attendance ?? null,
          input.comment?.trim() ? input.comment.trim() : null,
          row.rating_schema_version,
        ],
      );
      await tx.query(
        `update core.reviews
         set status = 'pending',
             current_revision = $2,
             version = version + 1,
             publication_generation = publication_generation + $3,
             updated_at = now()
         where id = $1`,
        [
          reviewId,
          nextRevision,
          row.status === 'published' ? 1 : 0,
        ],
      );
      await tx.query(
        `insert into core.moderation_actions
          (review_id, revision_no, actor_account_id, action, from_status, to_status)
         values ($1, $2, $3, $4, $5, 'pending')`,
        [
          reviewId,
          nextRevision,
          accountId,
          isResubmission ? 'resubmit' : 'edit',
          row.status,
        ],
      );

      if (row.status === 'published') {
        await invalidateTeacherSummary(tx, row.teacher_id);
      }
    });

    const review = await this.getOwnReview(accountId, reviewId);
    if (!review) throw new Error('Updated review could not be read back.');
    return review;
  }

  async withdraw(
    accountId: string,
    reviewId: string,
    expectedVersion: number,
  ): Promise<OwnReviewDTO> {
    await this.database.transaction(async (tx) => {
      const result = await tx.query<{
        status: OwnReviewStatus;
        version: number;
        current_revision: number;
        teacher_id: string;
        course_id: string;
        term_id: string;
        publication_generation: number;
      }>(
        `select r.status, r.version, r.current_revision, r.teacher_id, r.course_id,
                r.term_id, r.publication_generation
         from core.reviews r
         join private.review_authorship own on own.review_id = r.id
         where r.id = $1 and own.account_id = $2
         for update of r`,
        [reviewId, accountId],
      );
      const row = result.rows[0];
      if (!row) {
        throw new ApiError(404, API_ERROR_CODES.notFound, '未找到该评价。');
      }
      if (row.version !== expectedVersion) {
        throw new ApiError(409, API_ERROR_CODES.versionConflict, '评价已被更新，请刷新后重试。');
      }
      if (row.status === 'withdrawn') {
        throw new ApiError(409, API_ERROR_CODES.reviewNotEditable, '该评价已经撤回。');
      }

      await tx.query(
        `update core.reviews
         set status = 'withdrawn',
             version = version + 1,
             publication_generation = $2,
             updated_at = now()
         where id = $1`,
        [
          reviewId,
          row.status === 'published'
            ? row.publication_generation + 1
            : row.publication_generation,
        ],
      );
      await tx.query(
        `update private.review_slots
         set active_review_id = null, updated_at = now()
         where account_id = $1 and teacher_id = $2 and course_id = $3 and term_id = $4
           and active_review_id = $5`,
        [accountId, row.teacher_id, row.course_id, row.term_id, reviewId],
      );
      await tx.query(
        `insert into core.moderation_actions
          (review_id, revision_no, actor_account_id, action, from_status, to_status)
         values ($1, $2, $3, 'withdraw', $4, 'withdrawn')`,
        [reviewId, row.current_revision, accountId, row.status],
      );

      if (row.status === 'published') {
        await invalidateTeacherSummary(tx, row.teacher_id);
      }
    });

    const review = await this.getOwnReview(accountId, reviewId);
    if (!review) throw new Error('Withdrawn review could not be read back.');
    return review;
  }

  async listForModeration(
    status: OwnReviewStatus,
    limit: number,
    offset: number,
  ): Promise<{ items: AdminReviewDTO[]; total: number }> {
    const rows = await this.database.query<ModerationRow>(
      `${MODERATION_SELECT}
       where r.status = $1
       order by r.created_at asc, r.id asc
       limit $2 offset $3`,
      [status, limit, offset],
    );
    const count = await this.database.query<{ count: number }>(
      'select count(*)::int as count from core.reviews where status = $1',
      [status],
    );
    return {
      items: rows.rows.map(toAdminReviewDTO),
      total: count.rows[0]?.count ?? 0,
    };
  }

  async listRevisions(reviewId: string): Promise<AdminReviewRevisionDTO[]> {
    const rows = await this.database.query<RevisionRow>(
      `select r.current_revision, rv.revision_no,
              rv.clarity::int as clarity, rv.organization::int as organization,
              rv.feedback::int as feedback,
              rv.assessment_transparency::int as assessment_transparency,
              rv.difficulty::int as difficulty, rv.workload::int as workload,
              rv.attendance, rv.comment, rv.submitted_at, rv.published_at
       from core.reviews r
       join core.review_revisions rv on rv.review_id = r.id
       where r.id = $1
       order by rv.revision_no desc`,
      [reviewId],
    );
    if (rows.rows.length === 0) {
      throw new ApiError(404, API_ERROR_CODES.notFound, '未找到该评价。');
    }
    return rows.rows.map((row) => ({
      revision: row.revision_no,
      isCurrent: row.revision_no === row.current_revision,
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
    }));
  }

  async listAudit(reviewId: string): Promise<AuditEventDTO[]> {
    const exists = await this.database.query(
      'select 1 from core.reviews where id = $1',
      [reviewId],
    );
    if (!exists.rows[0]) {
      throw new ApiError(404, API_ERROR_CODES.notFound, '未找到该评价。');
    }

    const rows = await this.database.query<AuditRow>(
      `select id::int as id, action, reason_code, from_status, to_status,
              revision_no, created_at
       from core.moderation_actions
       where review_id = $1
       order by created_at asc, id asc`,
      [reviewId],
    );

    return rows.rows.map((row) => {
      const action: AuditAction =
        row.action === 'approve' && row.reason_code === 'appeal_restore'
          ? 'appeal_restore'
          : (row.action as AuditAction);
      return {
        id: row.id,
        action,
        actor:
          action === 'submit' ||
          action === 'edit' ||
          action === 'resubmit' ||
          action === 'withdraw'
            ? 'author'
            : 'moderator',
        reasonCode: row.reason_code,
        fromStatus: row.from_status,
        toStatus: row.to_status,
        revision: row.revision_no,
        createdAt: toIso(row.created_at),
      };
    });
  }

  async decide(
    actorId: string,
    reviewId: string,
    input: ModerationDecisionInput,
  ): Promise<{ id: string; status: OwnReviewStatus; version: number }> {
    if (input.decision === 'reject' && !input.reasonCode) {
      throw new ApiError(422, API_ERROR_CODES.validation, '驳回评价需要选择原因。', [
        { path: 'reasonCode', code: 'REQUIRED' },
      ]);
    }

    return this.database.transaction(async (tx) => {
      const result = await tx.query<DecisionRow>(
        `select r.status, r.version, r.current_revision, r.teacher_id, own.account_id as author_id
         from core.reviews r
         join private.review_authorship own on own.review_id = r.id
         where r.id = $1
         for update of r`,
        [reviewId],
      );
      const row = result.rows[0];
      if (!row) {
        throw new ApiError(404, API_ERROR_CODES.notFound, '未找到该评价。');
      }
      if (row.author_id === actorId) {
        throw new ApiError(403, API_ERROR_CODES.forbidden, '不能审核自己提交的评价。');
      }
      if (row.version !== input.expectedVersion) {
        throw new ApiError(409, API_ERROR_CODES.versionConflict, '评价已被更新，请刷新后重试。');
      }
      if (row.status !== 'pending') {
        throw new ApiError(409, API_ERROR_CODES.reviewNotEditable, '该评价当前不在待审状态。');
      }

      const nextStatus: OwnReviewStatus = input.decision === 'approve' ? 'published' : 'rejected';

      if (input.decision === 'approve') {
        await tx.query(
          `update core.review_revisions
           set published_at = now()
           where review_id = $1 and revision_no = $2 and published_at is null`,
          [reviewId, row.current_revision],
        );
        await tx.query(
          `update core.reviews
           set status = 'published',
               version = version + 1,
               publication_generation = publication_generation + 1,
               updated_at = now()
           where id = $1`,
          [reviewId],
        );
        await invalidateTeacherSummary(tx, row.teacher_id);
      } else {
        await tx.query(
          `update core.reviews
           set status = 'rejected', version = version + 1, updated_at = now()
           where id = $1`,
          [reviewId],
        );
      }

      await tx.query(
        `insert into core.moderation_actions
          (review_id, revision_no, actor_account_id, action, reason_code, from_status, to_status)
         values ($1, $2, $3, $4, $5, 'pending', $6)`,
        [
          reviewId,
          row.current_revision,
          actorId,
          input.decision === 'approve' ? 'approve' : 'reject',
          input.decision === 'reject' ? input.reasonCode : null,
          nextStatus,
        ],
      );

      return { id: reviewId, status: nextStatus, version: row.version + 1 };
    });
  }
}

async function invalidateTeacherSummary(
  tx: {
    query: (
      sql: string,
      params?: unknown[],
    ) => Promise<{ rows: unknown[] }>;
  },
  teacherId: string,
): Promise<void> {
  await tx.query(
    `update core.teacher_ai_summaries
     set state = 'generating', teacher_summary_epoch = teacher_summary_epoch + 1
     where teacher_id = $1`,
    [teacherId],
  );
}

function toOwnReviewDTO(row: OwnReviewRow): OwnReviewDTO {
  return {
    id: row.id,
    status: row.status,
    teacher: { id: row.teacher_id, name: row.teacher_name },
    course: { id: row.course_id, name: row.course_name },
    term: {
      id: row.term_id,
      label: row.term_label,
      isCurrent: row.term_is_current,
    },
    revision: row.current_revision,
    version: row.version,
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
    actions: {
      canEdit:
        row.status === 'pending' ||
        row.status === 'rejected' ||
        row.status === 'published' ||
        row.status === 'hidden',
      canWithdraw: row.status !== 'withdrawn',
    },
  };
}

function toAdminReviewDTO(row: ModerationRow): AdminReviewDTO {
  return {
    id: row.id,
    status: row.status,
    teacher: { id: row.teacher_id, name: row.teacher_name },
    course: { id: row.course_id, name: row.course_name },
    term: {
      id: row.term_id,
      label: row.term_label,
      isCurrent: row.term_is_current,
    },
    revision: row.current_revision,
    version: row.version,
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
  };
}
