import type { PGlite } from '@electric-sql/pglite';
import type {
  AdminOverviewDTO,
  AdminOverviewQueuesDTO,
  AdminRecentActionDTO,
  AppealStatus,
  AuditAction,
  OwnReviewStatus,
  ReportStatus,
  TeacherSummaryState,
} from '@soclear/contracts';
import { deriveTeacherSummaryState } from '../domain/summary.js';
import { toIso } from './auth-repository.js';

const reviewStatuses: OwnReviewStatus[] = [
  'pending',
  'published',
  'rejected',
  'hidden',
  'withdrawn',
];
const reportStatuses: ReportStatus[] = ['pending', 'resolved', 'dismissed'];
const appealStatuses: AppealStatus[] = ['pending', 'accepted', 'rejected'];
const summaryStates: TeacherSummaryState[] = [
  'ready',
  'generating',
  'insufficient',
  'unavailable',
];

interface CountRow<T extends string> {
  status: T;
  count: number;
}

interface SummaryCountRow {
  configured_state: TeacherSummaryState | null;
  sample_count: number;
}

interface RecentActionRow {
  id: number;
  review_id: string;
  action: string;
  reason_code: string | null;
  from_status: string | null;
  to_status: string;
  revision_no: number;
  created_at: string | Date;
  teacher_id: string;
  teacher_name: string;
  course_id: string;
  course_name: string;
}

function fillCounts<T extends string>(
  statuses: readonly T[],
  rows: Array<CountRow<T>>,
): Record<T, number> {
  const counts = Object.fromEntries(statuses.map((status) => [status, 0])) as Record<T, number>;
  rows.forEach((row) => {
    if (row.status in counts) counts[row.status] = row.count;
  });
  return counts;
}

function toRecentAction(row: RecentActionRow): AdminRecentActionDTO {
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
    fromStatus: row.from_status as OwnReviewStatus | null,
    toStatus: row.to_status as OwnReviewStatus,
    revision: row.revision_no,
    createdAt: toIso(row.created_at),
    reviewId: row.review_id,
    teacher: { id: row.teacher_id, name: row.teacher_name },
    course: { id: row.course_id, name: row.course_name },
  };
}

export class AdminOverviewRepository {
  constructor(private readonly database: PGlite) {}

  async getOverview(limit = 10): Promise<AdminOverviewDTO> {
    const reviewRows = await this.database.query<CountRow<OwnReviewStatus>>(
      'select status, count(*)::int as count from core.reviews group by status',
    );
    const reportRows = await this.database.query<CountRow<ReportStatus>>(
      'select status, count(*)::int as count from core.reports group by status',
    );
    const appealRows = await this.database.query<CountRow<AppealStatus>>(
      'select status, count(*)::int as count from core.review_appeals group by status',
    );

    const summaryRows = await this.database.query<SummaryCountRow>(
      `select s.state as configured_state,
              (select count(*)::int from published.review_public p where p.teacher_id = t.id)
                as sample_count
       from core.teachers t
       left join core.teacher_ai_summaries s on s.teacher_id = t.id
       where t.is_active`,
    );
    const summaryCounts = Object.fromEntries(
      summaryStates.map((state) => [state, 0]),
    ) as Record<TeacherSummaryState, number>;
    summaryRows.rows.forEach((row) => {
      const state = deriveTeacherSummaryState(row.sample_count, row.configured_state);
      summaryCounts[state] += 1;
    });

    const queues: AdminOverviewQueuesDTO = {
      reviews: fillCounts(reviewStatuses, reviewRows.rows),
      reports: fillCounts(reportStatuses, reportRows.rows),
      appeals: fillCounts(appealStatuses, appealRows.rows),
      summaries: summaryCounts,
    };

    const recent = await this.database.query<RecentActionRow>(
      `select ma.id::int as id, ma.review_id, ma.action, ma.reason_code,
              ma.from_status, ma.to_status, ma.revision_no, ma.created_at,
              t.id as teacher_id, t.name as teacher_name,
              c.id as course_id, c.name as course_name
       from core.moderation_actions ma
       join core.reviews r on r.id = ma.review_id
       join core.teachers t on t.id = r.teacher_id
       join core.courses c on c.id = r.course_id
       order by ma.created_at desc, ma.id desc
       limit $1`,
      [limit],
    );

    return {
      queues,
      recentActions: recent.rows.map(toRecentAction),
    };
  }

  async listAudit(
    action: AuditAction | 'all',
    actor: 'all' | 'author' | 'moderator',
    limit: number,
    offset: number,
  ): Promise<{ items: AdminRecentActionDTO[]; total: number }> {
    const conditions: string[] = [];
    const params: unknown[] = [];
    if (action === 'appeal_restore') {
      conditions.push(
        `(ma.action = 'appeal_restore' or (ma.action = 'approve' and ma.reason_code = 'appeal_restore'))`,
      );
    } else if (action === 'approve') {
      conditions.push(
        `ma.action = 'approve' and (ma.reason_code is null or ma.reason_code <> 'appeal_restore')`,
      );
    } else if (action !== 'all') {
      params.push(action);
      conditions.push(`ma.action = $${params.length}`);
    }
    if (actor === 'author') {
      conditions.push(`ma.action in ('submit', 'edit', 'resubmit', 'withdraw')`);
    } else if (actor === 'moderator') {
      conditions.push(`ma.action not in ('submit', 'edit', 'resubmit', 'withdraw')`);
    }
    const where = conditions.length > 0 ? `where ${conditions.join(' and ')}` : '';
    const from = `from core.moderation_actions ma
       join core.reviews r on r.id = ma.review_id
       join core.teachers t on t.id = r.teacher_id
       join core.courses c on c.id = r.course_id`;

    const count = await this.database.query<{ count: number }>(
      `select count(*)::int as count ${from} ${where}`,
      params,
    );
    const rows = await this.database.query<RecentActionRow>(
      `select ma.id::int as id, ma.review_id, ma.action, ma.reason_code,
              ma.from_status, ma.to_status, ma.revision_no, ma.created_at,
              t.id as teacher_id, t.name as teacher_name,
              c.id as course_id, c.name as course_name
       ${from}
       ${where}
       order by ma.created_at desc, ma.id desc
       limit $${params.length + 1} offset $${params.length + 2}`,
      [...params, limit, offset],
    );

    return {
      items: rows.rows.map(toRecentAction),
      total: count.rows[0]!.count,
    };
  }
}
