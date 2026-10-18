import type { PGlite } from '@electric-sql/pglite';
import {
  API_ERROR_CODES,
  RATING_MIN_SAMPLES,
  type AdminSummaryDTO,
  type AdminSummaryFilter,
  type AttendanceFrequency,
  type TeacherSummaryState,
} from '@soclear/contracts';
import { ApiError } from '../domain/errors.js';
import { buildLocalTeacherSummary, type LocalSummaryReview } from '../domain/local-summary.js';
import {
  deriveTeacherSummaryState,
  LOCAL_SUMMARY_LIMITATIONS,
} from '../domain/summary.js';
import { toIso } from './auth-repository.js';

interface SummaryListRow {
  id: string;
  name: string;
  department_name: string;
  configured_state: TeacherSummaryState | null;
  generated_at: string | Date | null;
  teacher_summary_epoch: number | null;
  sentence_count: number | null;
  sample_count: number;
}

interface PublishedSummaryRow {
  id: string;
  clarity: number;
  organization: number;
  feedback: number;
  assessment_transparency: number;
  difficulty: number | null;
  workload: number | null;
  attendance: AttendanceFrequency | null;
  comment: string | null;
}

const STATE_PRIORITY: Record<TeacherSummaryState, number> = {
  generating: 0,
  unavailable: 1,
  ready: 2,
  insufficient: 3,
};

export class SummaryRepository {
  constructor(private readonly database: PGlite) {}

  async listForModeration(
    filter: AdminSummaryFilter,
    limit: number,
    offset: number,
  ): Promise<{ items: AdminSummaryDTO[]; total: number }> {
    const result = await this.database.query<SummaryListRow>(
      `select t.id, t.name, d.name as department_name,
              s.state as configured_state,
              s.generated_at,
              s.teacher_summary_epoch,
              coalesce(jsonb_array_length(s.sentences), 0)::int as sentence_count,
              (select count(*)::int from published.review_public p where p.teacher_id = t.id)
                as sample_count
       from core.teachers t
       join core.departments d on d.id = t.department_id
       left join core.teacher_ai_summaries s on s.teacher_id = t.id
       where t.is_active`,
    );

    const items = result.rows
      .map((row) => this.toAdminDTO(row))
      .filter((item) => filter === 'all' || item.state === filter)
      .sort(
        (left, right) =>
          STATE_PRIORITY[left.state] - STATE_PRIORITY[right.state] ||
          left.teacher.name.localeCompare(right.teacher.name, 'zh-CN'),
      );

    return { items: items.slice(offset, offset + limit), total: items.length };
  }

  async regenerate(teacherId: string, expectedEpoch: number): Promise<AdminSummaryDTO> {
    return this.database.transaction(async (tx) => {
      const teacher = await tx.query<{ id: string; name: string; department_name: string }>(
        `select t.id, t.name, d.name as department_name
         from core.teachers t
         join core.departments d on d.id = t.department_id
         where t.id = $1 and t.is_active`,
        [teacherId],
      );
      const teacherRow = teacher.rows[0];
      if (!teacherRow) {
        throw new ApiError(404, API_ERROR_CODES.notFound, '未找到该教师。');
      }

      await tx.query(
        `insert into core.teacher_ai_summaries
          (teacher_id, state, sentences, limitations)
         values ($1, 'unavailable', '[]'::jsonb, $2)
         on conflict (teacher_id) do nothing`,
        [teacherId, LOCAL_SUMMARY_LIMITATIONS],
      );
      const summary = await tx.query<{
        state: TeacherSummaryState;
        teacher_summary_epoch: number;
      }>(
        `select state, teacher_summary_epoch
         from core.teacher_ai_summaries
         where teacher_id = $1
         for update`,
        [teacherId],
      );
      const configured = summary.rows[0]!;

      if (configured.teacher_summary_epoch !== expectedEpoch) {
        throw new ApiError(
          409,
          API_ERROR_CODES.summaryNotActionable,
          '摘要已被其他操作更新，请刷新后重试。',
          [{ path: 'expectedEpoch', code: 'STALE_EPOCH' }],
        );
      }

      const reviews = await tx.query<PublishedSummaryRow>(
        `select id, clarity, organization, feedback, assessment_transparency,
                difficulty, workload, attendance, comment
         from published.review_public
         where teacher_id = $1
         order by published_at desc, id desc`,
        [teacherId],
      );
      if (reviews.rows.length < RATING_MIN_SAMPLES) {
        throw new ApiError(
          409,
          API_ERROR_CODES.summaryNotActionable,
          `公开评价不足 ${RATING_MIN_SAMPLES} 条，暂时无法生成总结。`,
          [{ path: 'teacherId', code: 'INSUFFICIENT_SAMPLES' }],
        );
      }

      const localReviews: LocalSummaryReview[] = reviews.rows.map((row) => ({
        id: row.id,
        scores: {
          clarity: row.clarity,
          organization: row.organization,
          feedback: row.feedback,
          assessmentTransparency: row.assessment_transparency,
        },
        difficulty: row.difficulty,
        workload: row.workload,
        attendance: row.attendance,
        comment: row.comment,
      }));
      const sentences = buildLocalTeacherSummary(localReviews);
      if (sentences.length === 0) {
        throw new ApiError(
          409,
          API_ERROR_CODES.summaryNotActionable,
          '当前公开评价不足以形成可靠的总结。',
        );
      }

      const updated = await tx.query<{ generated_at: string | Date }>(
        `update core.teacher_ai_summaries
         set state = 'ready',
             sentences = $2::jsonb,
             limitations = $3,
             generated_at = now(),
             teacher_summary_epoch = teacher_summary_epoch + 1
         where teacher_id = $1
         returning generated_at`,
        [teacherId, JSON.stringify(sentences), LOCAL_SUMMARY_LIMITATIONS],
      );

      return {
        teacher: {
          id: teacherRow.id,
          name: teacherRow.name,
          departmentName: teacherRow.department_name,
        },
        state: 'ready',
        sampleCount: reviews.rows.length,
        generatedAt: toIso(updated.rows[0]!.generated_at),
        teacherSummaryEpoch: configured.teacher_summary_epoch + 1,
        sentenceCount: sentences.length,
        canRegenerate: true,
        localDemo: true,
      };
    });
  }

  private toAdminDTO(row: SummaryListRow): AdminSummaryDTO {
    const state = deriveTeacherSummaryState(row.sample_count, row.configured_state);
    return {
      teacher: {
        id: row.id,
        name: row.name,
        departmentName: row.department_name,
      },
      state,
      sampleCount: row.sample_count,
      generatedAt:
        state === 'ready' && row.generated_at ? toIso(row.generated_at) : null,
      teacherSummaryEpoch: row.teacher_summary_epoch ?? 0,
      sentenceCount:
        state === 'ready' ? (row.sentence_count ?? 0) : 0,
      canRegenerate: row.sample_count >= RATING_MIN_SAMPLES,
      localDemo: true,
    };
  }
}
