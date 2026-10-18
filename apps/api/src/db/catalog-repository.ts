import type { PGlite } from '@electric-sql/pglite';
import {
  RATING_MIN_SAMPLES,
  type CourseDTO,
  type DepartmentDTO,
  type OverviewDTO,
  type PublicReviewDTO,
  type RatingSummaryDTO,
  type ScoreSet,
  type SectionDTO,
  type SectionTeacherDTO,
  type TeacherPublicDTO,
  type TeacherSummaryDTO,
  type TermDTO,
} from '@soclear/contracts';
import { DATA_UPDATED_AT, DATA_VERSION } from '../data/seed.js';
import { summarizeReviews, type RatingReviewInput } from '../domain/ratings.js';
import { TEACHER_SUMMARY_LIMITATIONS } from '../domain/summary.js';

type DbTimestamp = string | Date;

const toIso = (value: DbTimestamp): string =>
  value instanceof Date ? value.toISOString() : new Date(value).toISOString();

const toNullableInt = (value: number | string | null): number | null =>
  value === null ? null : Number(value);

interface DepartmentRow {
  id: string;
  name: string;
}

interface CourseRow {
  id: string;
  name: string;
  department_id: string;
  department_name: string;
}

interface TermRow {
  id: string;
  label: string;
  is_current: boolean;
}

interface TeacherRow {
  id: string;
  name: string;
  title: string;
  department_id: string;
  department_name: string;
  tags: string[];
  data_version: number;
  updated_at: DbTimestamp;
}

interface TeacherCourseRow {
  teacher_id: string;
  course_id: string;
  course_name: string;
}

interface TeacherSectionRow {
  teacher_id: string;
  campus: string;
}

interface RatingRow {
  teacher_id: string;
  clarity: number;
  organization: number;
  feedback: number;
  assessment_transparency: number;
  published_at: DbTimestamp;
}

interface SummaryRow {
  state: 'ready' | 'generating' | 'unavailable';
  sentences: Array<{ text: string; citationIndexes: number[] }>;
  limitations: string;
  generated_at: DbTimestamp | null;
  teacher_summary_epoch: number;
}

interface ReviewRow {
  id: string;
  teacher_id: string;
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
  attendance: PublicReviewDTO['descriptive']['attendance'];
  comment: string | null;
  published_at: DbTimestamp;
  current_revision: number;
}

interface SectionRow {
  id: string;
  section_code: string;
  course_id: string;
  course_name: string;
  term_id: string;
  term_label: string;
  term_is_current: boolean;
  campus: string;
  capacity: number | string | null;
  note: string | null;
  source_updated_at: DbTimestamp;
  data_version: number;
}

interface SectionTeacherRow {
  section_id: string;
  teacher_id: string;
  name: string;
  title: string;
  department_name: string;
}

interface MeetingRow {
  section_id: string;
  weekday: number | null;
  start_period: number | null;
  end_period: number | null;
  weeks: string | null;
  location: string | null;
  time_unknown: boolean;
}

export class CatalogRepository {
  readonly dataVersion = DATA_VERSION;
  readonly updatedAt = DATA_UPDATED_AT;

  constructor(private readonly database: PGlite) {}

  async ping(): Promise<void> {
    await this.database.query('select 1');
  }

  async hasDepartment(departmentId: string): Promise<boolean> {
    const result = await this.database.query(
      'select 1 from core.departments where id = $1',
      [departmentId],
    );
    return result.rows.length > 0;
  }

  async hasTerm(termId: string): Promise<boolean> {
    const result = await this.database.query('select 1 from core.terms where id = $1', [termId]);
    return result.rows.length > 0;
  }

  async listTeacherIdsTeachingTerm(termId: string): Promise<Set<string>> {
    const result = await this.database.query<{ teacher_id: string }>(
      `select distinct st.teacher_id
       from core.section_teachers st
       join core.sections s on s.id = st.section_id
       where s.term_id = $1`,
      [termId],
    );
    return new Set(result.rows.map((row) => row.teacher_id));
  }

  async listDepartments(): Promise<DepartmentDTO[]> {
    const result = await this.database.query<DepartmentRow>(
      'select id, name from core.departments order by sort_order, id',
    );
    return result.rows.map((row) => ({ id: row.id, name: row.name }));
  }

  async listTerms(): Promise<TermDTO[]> {
    const result = await this.database.query<TermRow>(
      'select id, label, is_current from core.terms order by sort_order, id',
    );
    return result.rows.map((row) => ({
      id: row.id,
      label: row.label,
      isCurrent: row.is_current,
    }));
  }

  async getCurrentTerm(): Promise<TermDTO> {
    const result = await this.database.query<TermRow>(
      'select id, label, is_current from core.terms where is_current order by sort_order, id limit 1',
    );
    const row = result.rows[0];
    if (!row) throw new Error('No current term configured.');
    return { id: row.id, label: row.label, isCurrent: row.is_current };
  }

  async listCourses(q: string): Promise<CourseDTO[]> {
    const result = await this.database.query<CourseRow>(
      `select c.id, c.name, c.department_id, d.name as department_name
       from core.courses c
       join core.departments d on d.id = c.department_id
       where $1 = '' or strpos(lower(c.name), lower($1)) > 0
       order by c.sort_order, c.id`,
      [q],
    );
    return result.rows.map((row) => ({
      id: row.id,
      name: row.name,
      departmentId: row.department_id,
      departmentName: row.department_name,
    }));
  }

  async overview(): Promise<OverviewDTO> {
    const currentTerm = await this.getCurrentTerm();
    const result = await this.database.query<{
      teacher_count: number;
      course_count: number;
      section_count: number;
      published_review_count: number;
      department_count: number;
    }>(
      `select
         (select count(*)::int from core.teachers where is_active) as teacher_count,
         (select count(*)::int from core.courses) as course_count,
         (select count(*)::int from core.sections where term_id = $1) as section_count,
         (select count(*)::int from core.reviews where status = 'published') as published_review_count,
         (select count(*)::int from core.departments) as department_count`,
      [currentTerm.id],
    );
    const counts = result.rows[0]!;

    return {
      teacherCount: counts.teacher_count,
      courseCount: counts.course_count,
      sectionCount: counts.section_count,
      publishedReviewCount: counts.published_review_count,
      departmentCount: counts.department_count,
      currentTerm,
      dataVersion: DATA_VERSION,
      updatedAt: DATA_UPDATED_AT,
      synthetic: true,
    };
  }

  async listTeachers(): Promise<TeacherPublicDTO[]> {
    const currentTerm = await this.getCurrentTerm();
    const teacherRows = await this.database.query<TeacherRow>(
      `select t.id, t.name, t.title, t.department_id, d.name as department_name,
              t.tags, t.data_version, t.updated_at
       from core.teachers t
       join core.departments d on d.id = t.department_id
       where t.is_active
       order by t.id`,
    );
    const courseRows = await this.database.query<TeacherCourseRow>(
      `select tc.teacher_id, c.id as course_id, c.name as course_name
       from core.teacher_courses tc
       join core.courses c on c.id = tc.course_id
       order by tc.teacher_id, tc.sort_order`,
    );
    const sectionRows = await this.database.query<TeacherSectionRow>(
      `select st.teacher_id, s.campus
       from core.sections s
       join core.section_teachers st on st.section_id = s.id
       where s.term_id = $1`,
      [currentTerm.id],
    );
    const ratings = await this.loadRatingSummaries();

    const coursesByTeacher = new Map<string, Array<{ id: string; name: string }>>();
    for (const row of courseRows.rows) {
      const list = coursesByTeacher.get(row.teacher_id) ?? [];
      list.push({ id: row.course_id, name: row.course_name });
      coursesByTeacher.set(row.teacher_id, list);
    }

    const sectionsByTeacher = new Map<string, TeacherSectionRow[]>();
    for (const row of sectionRows.rows) {
      const list = sectionsByTeacher.get(row.teacher_id) ?? [];
      list.push(row);
      sectionsByTeacher.set(row.teacher_id, list);
    }

    return teacherRows.rows.map((row) => {
      const teacherSections = sectionsByTeacher.get(row.id) ?? [];
      return {
        id: row.id,
        name: row.name,
        title: row.title,
        department: { id: row.department_id, name: row.department_name },
        campuses: [...new Set(teacherSections.map((section) => section.campus))],
        courses: coursesByTeacher.get(row.id) ?? [],
        tags: Array.isArray(row.tags) ? row.tags : [],
        isTeachingThisTerm: teacherSections.length > 0,
        currentSectionCount: teacherSections.length,
        ratingSummary: ratings.get(row.id) ?? summarizeReviews([], DATA_UPDATED_AT),
        dataVersion: row.data_version,
        updatedAt: toIso(row.updated_at),
      };
    });
  }

  async getTeacher(teacherId: string): Promise<TeacherPublicDTO | null> {
    const teachers = await this.listTeachers();
    return teachers.find((teacher) => teacher.id === teacherId) ?? null;
  }

  async listReviews(teacherId: string): Promise<PublicReviewDTO[]> {
    const result = await this.database.query<ReviewRow>(
      `${REVIEW_SELECT}
       where rp.teacher_id = $1
       order by rp.published_at desc, rp.id desc`,
      [teacherId],
    );
    return result.rows.map(toReviewDTO);
  }

  async getReview(reviewId: string): Promise<PublicReviewDTO | null> {
    const result = await this.database.query<ReviewRow>(
      `${REVIEW_SELECT} where rp.id = $1`,
      [reviewId],
    );
    const row = result.rows[0];
    return row ? toReviewDTO(row) : null;
  }

  async getTeacherSummary(teacherId: string): Promise<TeacherSummaryDTO | null> {
    const teacher = await this.database.query<{ id: string }>(
      'select id from core.teachers where id = $1 and is_active',
      [teacherId],
    );
    if (!teacher.rows[0]) return null;

    const reviews = await this.database.query<{ id: string }>(
      `select id from published.review_public
       where teacher_id = $1
       order by published_at desc, id desc`,
      [teacherId],
    );
    const summary = await this.database.query<SummaryRow>(
      `select state, sentences, limitations, generated_at, teacher_summary_epoch
       from core.teacher_ai_summaries
       where teacher_id = $1`,
      [teacherId],
    );
    const configured = summary.rows[0];
    const sampleCount = reviews.rows.length;

    let state: TeacherSummaryDTO['state'] = 'unavailable';
    if (sampleCount < RATING_MIN_SAMPLES) {
      state = 'insufficient';
    } else if (configured?.state === 'generating') {
      state = 'generating';
    } else if (configured?.state === 'ready') {
      state = 'ready';
    }

    const reviewIds = reviews.rows.map((row) => row.id);
    const sentences =
      state === 'ready' && configured
        ? (Array.isArray(configured.sentences) ? configured.sentences : []).map((sentence) => ({
            text: sentence.text,
            citations: sentence.citationIndexes
              .map((index) => reviewIds[index - 1])
              .filter((id): id is string => Boolean(id)),
          }))
        : [];

    return {
      state,
      teacherId,
      sampleCount,
      scope: {
        termId: null,
        description: '全部学期已发布评价 · 合成演示样本',
      },
      sentences,
      limitations: configured?.limitations ?? TEACHER_SUMMARY_LIMITATIONS,
      generatedAt:
        state === 'ready' && configured?.generated_at ? toIso(configured.generated_at) : null,
      teacherSummaryEpoch:
        state === 'ready' && configured ? configured.teacher_summary_epoch : 0,
    };
  }

  async listSections(termId: string, departmentId: string | null = null): Promise<SectionDTO[]> {
    return this.loadSections({ termId, departmentId });
  }

  async getSection(sectionId: string): Promise<SectionDTO | null> {
    const sections = await this.loadSections({ sectionId });
    return sections[0] ?? null;
  }

  private async loadRatingSummaries(): Promise<Map<string, RatingSummaryDTO>> {
    const result = await this.database.query<RatingRow>(
      `select teacher_id, clarity, organization, feedback, assessment_transparency, published_at
       from published.review_public`,
    );
    const grouped = new Map<string, RatingReviewInput[]>();
    for (const row of result.rows) {
      const scores: ScoreSet = {
        clarity: row.clarity,
        organization: row.organization,
        feedback: row.feedback,
        assessmentTransparency: row.assessment_transparency,
      };
      const list = grouped.get(row.teacher_id) ?? [];
      list.push({ scores, publishedAt: toIso(row.published_at) });
      grouped.set(row.teacher_id, list);
    }

    const summaries = new Map<string, RatingSummaryDTO>();
    for (const [teacherId, reviews] of grouped) {
      summaries.set(teacherId, summarizeReviews(reviews, DATA_UPDATED_AT));
    }
    return summaries;
  }

  private async loadSections(filter: {
    termId?: string;
    sectionId?: string;
    departmentId?: string | null;
  }): Promise<SectionDTO[]> {
    const clauses: string[] = [];
    const params: string[] = [];

    if (filter.termId) {
      params.push(filter.termId);
      clauses.push(`s.term_id = $${params.length}`);
    }
    if (filter.sectionId) {
      params.push(filter.sectionId);
      clauses.push(`s.id = $${params.length}`);
    }
    if (filter.departmentId) {
      params.push(filter.departmentId);
      clauses.push(`c.department_id = $${params.length}`);
    }
    const where = clauses.join(' and ');

    const sectionRows = await this.database.query<SectionRow>(
      `select s.id, s.section_code, c.id as course_id, c.name as course_name,
              t.id as term_id, t.label as term_label, t.is_current as term_is_current,
              s.campus, s.capacity::int as capacity, s.note,
              s.source_updated_at, s.data_version
       from core.sections s
       join core.courses c on c.id = s.course_id
       join core.terms t on t.id = s.term_id
       where ${where}
       order by c.name, s.section_code, s.id`,
      params,
    );
    if (sectionRows.rows.length === 0) return [];

    const sectionIds = sectionRows.rows.map((row) => row.id);
    const teacherRows = await this.database.query<SectionTeacherRow>(
      `select st.section_id, st.teacher_id, t.name, t.title, d.name as department_name
       from core.section_teachers st
       join core.teachers t on t.id = st.teacher_id
       join core.departments d on d.id = t.department_id
       where st.section_id = any($1::text[])
       order by st.section_id, st.position`,
      [sectionIds],
    );
    const meetingRows = await this.database.query<MeetingRow>(
      `select m.section_id, m.weekday::int as weekday, m.start_period::int as start_period,
              m.end_period::int as end_period, m.weeks, m.location, m.time_unknown
       from core.meetings m
       where m.section_id = any($1::text[])
       order by m.section_id, m.sort_order`,
      [sectionIds],
    );
    const ratings = await this.loadRatingSummaries();

    const teachersBySection = new Map<string, SectionTeacherDTO[]>();
    for (const row of teacherRows.rows) {
      const list = teachersBySection.get(row.section_id) ?? [];
      list.push({
        id: row.teacher_id,
        name: row.name,
        title: row.title,
        departmentName: row.department_name,
        ratingSummary: ratings.get(row.teacher_id) ?? summarizeReviews([], DATA_UPDATED_AT),
      });
      teachersBySection.set(row.section_id, list);
    }

    const meetingsBySection = new Map<string, MeetingRow[]>();
    for (const row of meetingRows.rows) {
      const list = meetingsBySection.get(row.section_id) ?? [];
      list.push(row);
      meetingsBySection.set(row.section_id, list);
    }

    return sectionRows.rows.map((row) => ({
      id: row.id,
      sectionCode: row.section_code,
      course: { id: row.course_id, name: row.course_name },
      term: {
        id: row.term_id,
        label: row.term_label,
        isCurrent: row.term_is_current,
      },
      campus: row.campus,
      capacity: toNullableInt(row.capacity),
      teachers: teachersBySection.get(row.id) ?? [],
      meetings: (meetingsBySection.get(row.id) ?? []).map((meeting) => ({
        weekday: meeting.weekday,
        startPeriod: meeting.start_period,
        endPeriod: meeting.end_period,
        weeks: meeting.weeks,
        location: meeting.location,
        timeUnknown: meeting.time_unknown,
      })),
      note: row.note,
      updatedAt: toIso(row.source_updated_at),
      dataVersion: row.data_version,
    }));
  }
}

const REVIEW_SELECT = `
  select rp.id, rp.teacher_id, rp.course_id, c.name as course_name,
         rp.term_id, t.label as term_label, t.is_current as term_is_current,
         rp.clarity, rp.organization, rp.feedback, rp.assessment_transparency,
         rp.difficulty, rp.workload, rp.attendance, rp.comment,
         rp.published_at, rp.current_revision
  from published.review_public rp
  join core.courses c on c.id = rp.course_id
  join core.terms t on t.id = rp.term_id
`;

function toReviewDTO(row: ReviewRow): PublicReviewDTO {
  return {
    id: row.id,
    teacherId: row.teacher_id,
    course: { id: row.course_id, name: row.course_name },
    term: {
      id: row.term_id,
      label: row.term_label,
      isCurrent: row.term_is_current,
    },
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
    publishedAt: toIso(row.published_at),
    revision: row.current_revision,
  };
}
