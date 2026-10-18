import type { PGlite } from '@electric-sql/pglite';
import { RATING_SCHEMA_VERSION } from '@soclear/contracts';
import {
  courses,
  DATA_UPDATED_AT,
  DATA_VERSION,
  departments,
  reviews,
  sections,
  teachers,
  terms,
} from '../data/seed.js';
import { TEACHER_SUMMARY_LIMITATIONS } from '../domain/summary.js';

const INSTITUTION_ID = 'inst-main';
const INSTITUTION_NAME = '西南交通大学';
const SUMMARY_GENERATED_AT = '2026-10-16T09:30:00.000Z';

export async function seedDatabase(database: PGlite): Promise<void> {
  const existing = await database.query<{ count: number }>(
    'select count(*)::int as count from core.institutions',
  );
  if ((existing.rows[0]?.count ?? 0) > 0) return;

  await database.transaction(async (tx) => {
    await tx.query('insert into core.institutions (id, name) values ($1, $2)', [
      INSTITUTION_ID,
      INSTITUTION_NAME,
    ]);

    for (const [index, department] of departments.entries()) {
      await tx.query(
        'insert into core.departments (id, institution_id, name, sort_order) values ($1, $2, $3, $4)',
        [department.id, INSTITUTION_ID, department.name, index],
      );
    }

    for (const [index, term] of terms.entries()) {
      await tx.query(
        'insert into core.terms (id, institution_id, label, is_current, sort_order) values ($1, $2, $3, $4, $5)',
        [term.id, INSTITUTION_ID, term.label, term.isCurrent, index],
      );
    }

    for (const [index, course] of courses.entries()) {
      await tx.query(
        'insert into core.courses (id, institution_id, department_id, name, sort_order) values ($1, $2, $3, $4, $5)',
        [course.id, INSTITUTION_ID, course.departmentId, course.name, index],
      );
    }

    for (const teacher of teachers) {
      await tx.query(
        `insert into core.teachers
          (id, institution_id, department_id, name, title, tags, is_active, data_version, updated_at)
         values ($1, $2, $3, $4, $5, $6, true, $7, $8)`,
        [
          teacher.id,
          INSTITUTION_ID,
          teacher.departmentId,
          teacher.name,
          teacher.title,
          teacher.tags,
          DATA_VERSION,
          DATA_UPDATED_AT,
        ],
      );

      for (const [index, courseId] of teacher.courseIds.entries()) {
        await tx.query(
          'insert into core.teacher_courses (teacher_id, course_id, sort_order) values ($1, $2, $3)',
          [teacher.id, courseId, index],
        );
      }

      const summary = teacher.summary;
      if (!summary || summary.state === 'missing') continue;
      const state = summary.state === 'ready' ? 'ready' : 'generating';
      await tx.query(
        `insert into core.teacher_ai_summaries
          (teacher_id, state, sentences, limitations, generated_at, teacher_summary_epoch)
         values ($1, $2, $3::jsonb, $4, $5, $6)`,
        [
          teacher.id,
          state,
          JSON.stringify(summary.sentences),
          TEACHER_SUMMARY_LIMITATIONS,
          state === 'ready' ? SUMMARY_GENERATED_AT : null,
          state === 'ready' ? 1 : 0,
        ],
      );
    }

    for (const section of sections) {
      await tx.query(
        `insert into core.sections
          (id, term_id, course_id, section_code, campus, capacity, note, data_version, source_updated_at)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          section.id,
          section.termId,
          section.courseId,
          section.sectionCode,
          section.campus,
          section.capacity,
          section.note,
          DATA_VERSION,
          section.updatedAt,
        ],
      );

      for (const [index, teacherId] of section.teacherIds.entries()) {
        await tx.query(
          'insert into core.section_teachers (section_id, teacher_id, position) values ($1, $2, $3)',
          [section.id, teacherId, index],
        );
      }

      for (const [index, meeting] of section.meetings.entries()) {
        await tx.query(
          `insert into core.meetings
            (section_id, sort_order, weekday, start_period, end_period, weeks, location, time_unknown)
           values ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [
            section.id,
            index,
            meeting.weekday,
            meeting.startPeriod,
            meeting.endPeriod,
            meeting.weeks,
            meeting.location,
            meeting.timeUnknown,
          ],
        );
      }
    }

    for (const review of reviews) {
      const published = review.status === 'published';
      await tx.query(
        `insert into core.reviews
          (id, teacher_id, course_id, term_id, status, current_revision, publication_generation, created_at, updated_at)
         values ($1, $2, $3, $4, $5, 1, $6, $7, $8)`,
        [
          review.id,
          review.teacherId,
          review.courseId,
          review.termId,
          review.status,
          published ? 1 : 0,
          review.publishedAt,
          review.publishedAt,
        ],
      );
      await tx.query(
        `insert into core.review_revisions
          (review_id, revision_no, clarity, organization, feedback, assessment_transparency,
           difficulty, workload, attendance, comment, rating_schema_version, submitted_at, published_at)
         values ($1, 1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
        [
          review.id,
          review.scores.clarity,
          review.scores.organization,
          review.scores.feedback,
          review.scores.assessmentTransparency,
          review.difficulty,
          review.workload,
          review.attendance,
          review.comment,
          RATING_SCHEMA_VERSION,
          review.publishedAt,
          published ? review.publishedAt : null,
        ],
      );
    }
  });
}
