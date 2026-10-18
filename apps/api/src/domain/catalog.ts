import {
  API_ERROR_CODES,
  type PublicReviewDTO,
  type SectionDTO,
  type TeacherPublicDTO,
  type TeacherSort,
} from '@soclear/contracts';
import { coursesById, sections, teachers, termsById } from '../data/seed.js';
import { decodeCursor, encodeCursor } from './cursor.js';
import { ApiError } from './errors.js';
import { toReviewDTO, toSectionDTO, toTeacherDTO } from '../http/dto.js';
import { getPublishedReviews } from './ratings.js';

export interface RankedItem<T> {
  value: T;
  rank: string;
  id: string;
}

export interface PageResult<T> {
  items: T[];
  total: number;
  hasMore: boolean;
  nextCursor: string | null;
}

export function paginateRanked<T>(
  entries: RankedItem<T>[],
  limit: number,
  cursorToken: string | null,
  filterHash: string,
  secret: string,
): PageResult<T> {
  let start = 0;
  if (cursorToken) {
    const boundary = decodeCursor(cursorToken, filterHash, secret);
    if (!boundary) {
      throw new ApiError(422, API_ERROR_CODES.cursorInvalid, '分页游标无效，请重新加载列表。');
    }
    const index = entries.findIndex((entry) => entry.id === boundary.id && entry.rank === boundary.rank);
    if (index < 0) {
      throw new ApiError(
        422,
        API_ERROR_CODES.cursorInvalid,
        '列表数据已更新，原分页位置不存在，请重新加载。',
      );
    }
    start = index + 1;
  }

  const items = entries.slice(start, start + limit);
  const hasMore = start + limit < entries.length;
  const last = items.at(-1);

  return {
    items: items.map((entry) => entry.value),
    total: entries.length,
    hasMore,
    nextCursor:
      hasMore && last ? encodeCursor({ rank: last.rank, id: last.id }, filterHash, secret) : null,
  };
}

export interface TeacherFilters {
  q: string;
  departmentId: string | null;
  termId: string | null;
  sort: TeacherSort;
}

function teacherSortScore(teacher: TeacherPublicDTO, sort: TeacherSort): number | null {
  if (!teacher.ratingSummary.eligible) return null;
  if (sort === 'overall') return teacher.ratingSummary.overall;
  return teacher.ratingSummary.scores?.[sort] ?? null;
}

function teacherRank(teacher: TeacherPublicDTO, sort: TeacherSort): string {
  const score = teacherSortScore(teacher, sort);
  const eligible = score !== null ? 1 : 0;
  return `${eligible}|${(score ?? 0).toFixed(4)}|${String(teacher.ratingSummary.publishedCount).padStart(4, '0')}`;
}

export function searchTeachers(filters: TeacherFilters): RankedItem<TeacherPublicDTO>[] {
  const teacherIdsForTerm = filters.termId
    ? new Set(
        sections
          .filter((section) => section.termId === filters.termId)
          .flatMap((section) => section.teacherIds),
      )
    : null;

  const query = filters.q.toLowerCase();
  const entries: RankedItem<TeacherPublicDTO>[] = [];

  for (const seedTeacher of teachers) {
    const teacher = toTeacherDTO(seedTeacher);
    if (filters.departmentId && teacher.department.id !== filters.departmentId) continue;
    if (teacherIdsForTerm && !teacherIdsForTerm.has(teacher.id)) continue;
    if (query) {
      const haystack = [
        teacher.name,
        teacher.department.name,
        teacher.title,
        ...teacher.courses.map((course) => course.name),
        ...teacher.tags,
      ]
        .join(' ')
        .toLowerCase();
      if (!haystack.includes(query)) continue;
    }
    entries.push({ value: teacher, rank: teacherRank(teacher, filters.sort), id: teacher.id });
  }

  entries.sort((a, b) => b.rank.localeCompare(a.rank) || a.id.localeCompare(b.id));
  return entries;
}

export interface SectionFilters {
  q: string;
  departmentId: string | null;
  teacherId: string | null;
  termId: string;
  campus: string | null;
  weekday: number | null;
}

export function searchSections(filters: SectionFilters): RankedItem<SectionDTO>[] {
  const query = filters.q.toLowerCase();
  const entries: RankedItem<SectionDTO>[] = [];

  for (const raw of sections) {
    if (raw.termId !== filters.termId) continue;
    if (filters.teacherId && !raw.teacherIds.includes(filters.teacherId)) continue;
    if (filters.campus && raw.campus !== filters.campus) continue;
    if (filters.weekday && !raw.meetings.some((meeting) => meeting.weekday === filters.weekday)) {
      continue;
    }

    const course = coursesById.get(raw.courseId)!;
    if (filters.departmentId && course.departmentId !== filters.departmentId) continue;

    const section = toSectionDTO(raw);
    if (query) {
      const haystack = [
        section.course.name,
        section.sectionCode,
        section.campus,
        ...section.teachers.map((teacher) => `${teacher.name} ${teacher.departmentName}`),
        ...section.meetings.flatMap((meeting) => [meeting.weeks, meeting.location]),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      if (!haystack.includes(query)) continue;
    }

    entries.push({
      value: section,
      rank: `${section.course.name}|${section.sectionCode}`,
      id: section.id,
    });
  }

  entries.sort((a, b) => a.rank.localeCompare(b.rank, 'zh-Hans-CN') || a.id.localeCompare(b.id));
  return entries;
}

export function searchReviews(teacherId: string): RankedItem<PublicReviewDTO>[] {
  return getPublishedReviews(teacherId).map((review) => ({
    value: toReviewDTO(review),
    rank: review.publishedAt,
    id: review.id,
  }));
}

export function isValidTerm(termId: string): boolean {
  return termsById.has(termId);
}
