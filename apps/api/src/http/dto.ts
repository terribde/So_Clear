import {
  RATING_MIN_SAMPLES,
  type OverviewDTO,
  type PublicReviewDTO,
  type SectionDTO,
  type TeacherPublicDTO,
  type TeacherSummaryDTO,
} from '@soclear/contracts';
import {
  coursesById,
  currentTerm,
  DATA_UPDATED_AT,
  DATA_VERSION,
  departmentsById,
  publishedReviewCount,
  sections,
  sectionsByTeacher,
  teachers,
  teachersById,
  termsById,
  departments,
  courses,
} from '../data/seed.js';
import { getPublishedReviews, summarizeTeacherRatings } from '../domain/ratings.js';
import type { SeedReview, SeedSection, SeedTeacher } from '../data/seed.js';

const SUMMARY_LIMITATIONS =
  '总结只依据当前公开评价中的共同表述，反映样本观点，不代表对教师能力或人格的事实判断；公开来源变化后需要重新生成。当前页面为合成演示数据。';

export function toTeacherDTO(teacher: SeedTeacher): TeacherPublicDTO {
  const teacherSections = sectionsByTeacher.get(teacher.id) ?? [];
  const currentSections = teacherSections.filter((section) => section.termId === currentTerm.id);
  const campuses = [...new Set(currentSections.map((section) => section.campus))];
  const department = departmentsById.get(teacher.departmentId)!;

  return {
    id: teacher.id,
    name: teacher.name,
    title: teacher.title,
    department: { id: department.id, name: department.name },
    campuses,
    courses: teacher.courseIds.map((courseId) => {
      const course = coursesById.get(courseId)!;
      return { id: course.id, name: course.name };
    }),
    tags: [...teacher.tags],
    isTeachingThisTerm: currentSections.length > 0,
    currentSectionCount: currentSections.length,
    ratingSummary: summarizeTeacherRatings(teacher.id),
    dataVersion: DATA_VERSION,
    updatedAt: DATA_UPDATED_AT,
  };
}

export function toReviewDTO(review: SeedReview): PublicReviewDTO {
  const course = coursesById.get(review.courseId)!;
  const term = termsById.get(review.termId)!;

  return {
    id: review.id,
    teacherId: review.teacherId,
    course: { id: course.id, name: course.name },
    term: { id: term.id, label: term.label, isCurrent: term.isCurrent },
    scores: { ...review.scores },
    descriptive: {
      difficulty: review.difficulty,
      workload: review.workload,
      attendance: review.attendance,
    },
    comment: review.comment,
    publishedAt: review.publishedAt,
    revision: review.revision,
  };
}

export function toSectionDTO(section: SeedSection): SectionDTO {
  const course = coursesById.get(section.courseId)!;
  const term = termsById.get(section.termId)!;

  return {
    id: section.id,
    sectionCode: section.sectionCode,
    course: { id: course.id, name: course.name },
    term: { id: term.id, label: term.label, isCurrent: term.isCurrent },
    campus: section.campus,
    capacity: section.capacity,
    teachers: section.teacherIds.map((teacherId) => {
      const teacher = teachersById.get(teacherId)!;
      const department = departmentsById.get(teacher.departmentId)!;
      return {
        id: teacher.id,
        name: teacher.name,
        title: teacher.title,
        departmentName: department.name,
        ratingSummary: summarizeTeacherRatings(teacher.id),
      };
    }),
    meetings: section.meetings.map((entry) => ({ ...entry })),
    note: section.note,
    updatedAt: section.updatedAt,
    dataVersion: DATA_VERSION,
  };
}

export function toTeacherSummaryDTO(teacherId: string): TeacherSummaryDTO {
  const teacher = teachersById.get(teacherId);
  const published = getPublishedReviews(teacherId);
  const sampleCount = published.length;
  const configured = teacher?.summary;

  let state: TeacherSummaryDTO['state'] = 'unavailable';
  if (sampleCount < RATING_MIN_SAMPLES) {
    state = 'insufficient';
  } else if (configured?.state === 'generating') {
    state = 'generating';
  } else if (configured?.state === 'ready') {
    state = 'ready';
  }

  const sentences =
    state === 'ready' && configured
      ? configured.sentences.map((sentence) => ({
          text: sentence.text,
          citations: sentence.citationIndexes
            .map((index) => published[index - 1]?.id)
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
    limitations: SUMMARY_LIMITATIONS,
    generatedAt: state === 'ready' ? '2026-10-16T09:30:00.000Z' : null,
    teacherSummaryEpoch: state === 'ready' ? 1 : 0,
  };
}

export function toOverviewDTO(): OverviewDTO {
  return {
    teacherCount: teachers.length,
    courseCount: courses.length,
    sectionCount: sections.filter((section) => section.termId === currentTerm.id).length,
    publishedReviewCount,
    departmentCount: departments.length,
    currentTerm: { ...currentTerm },
    dataVersion: DATA_VERSION,
    updatedAt: DATA_UPDATED_AT,
    synthetic: true,
  };
}
