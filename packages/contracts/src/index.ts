export const API_PREFIX = '/api/v1';

export const RATING_SCHEMA_VERSION = 1;
export const RATING_MIN_SAMPLES = 5;
export const RATING_SCALE = '1–5 分';

export const SCORE_DIMENSIONS = [
  {
    key: 'clarity',
    label: '讲授清晰度',
    low: '讲解跳跃',
    high: '清晰有条理',
    description: '重点是否明确，推导与例题是否听得懂。',
  },
  {
    key: 'organization',
    label: '课程组织',
    low: '安排松散',
    high: '结构完整',
    description: '进度、资料与作业安排是否稳定可预期。',
  },
  {
    key: 'feedback',
    label: '反馈支持',
    low: '答疑问难',
    high: '反馈具体',
    description: '答疑、作业批改与课后沟通是否有效。',
  },
  {
    key: 'assessmentTransparency',
    label: '考核透明度',
    low: '口径模糊',
    high: '规则清晰',
    description: '考核方式、评分构成与复习范围是否提前说明。',
  },
] as const;

export type ScoreKey = (typeof SCORE_DIMENSIONS)[number]['key'];
export type ScoreSet = Record<ScoreKey, number>;

export const SCORE_KEYS = SCORE_DIMENSIONS.map((dimension) => dimension.key);

export const ATTENDANCE_OPTIONS = ['每节必点', '经常点名', '偶尔点名', '基本不点名', '未说明'] as const;
export type AttendanceFrequency = (typeof ATTENDANCE_OPTIONS)[number];

export type TeacherSort = 'overall' | ScoreKey;

export const TEACHER_SORTS: ReadonlyArray<{ value: TeacherSort; label: string }> = [
  { value: 'overall', label: '综合评分' },
  { value: 'clarity', label: '讲授清晰度' },
  { value: 'organization', label: '课程组织' },
  { value: 'feedback', label: '反馈支持' },
  { value: 'assessmentTransparency', label: '考核透明度' },
];

export interface DepartmentDTO {
  id: string;
  name: string;
}

export interface CourseDTO {
  id: string;
  name: string;
  departmentId: string;
  departmentName: string;
}

export interface TermDTO {
  id: string;
  label: string;
  isCurrent: boolean;
}

export interface CourseRefDTO {
  id: string;
  name: string;
}

export interface RatingSummaryDTO {
  schemaVersion: number;
  minSamples: number;
  publishedCount: number;
  eligible: boolean;
  /** Arithmetic mean of the four dimension averages. Null while the sample is below the publish threshold. */
  overall: number | null;
  scores: ScoreSet | null;
  statsUpdatedAt: string;
}

export interface TeacherPublicDTO {
  id: string;
  name: string;
  title: string;
  department: DepartmentDTO;
  campuses: string[];
  courses: CourseRefDTO[];
  tags: string[];
  isTeachingThisTerm: boolean;
  currentSectionCount: number;
  ratingSummary: RatingSummaryDTO;
  dataVersion: number;
  updatedAt: string;
}

export type TeacherSummaryState = 'ready' | 'insufficient' | 'unavailable' | 'generating';

export interface TeacherSummarySentenceDTO {
  text: string;
  citations: string[];
}

export interface TeacherSummaryDTO {
  state: TeacherSummaryState;
  teacherId: string;
  sampleCount: number;
  scope: { termId: string | null; description: string };
  sentences: TeacherSummarySentenceDTO[];
  limitations: string;
  generatedAt: string | null;
  teacherSummaryEpoch: number;
}

export interface ReviewDescriptiveDTO {
  difficulty: number | null;
  workload: number | null;
  attendance: AttendanceFrequency | null;
}

export interface PublicReviewDTO {
  id: string;
  teacherId: string;
  course: CourseRefDTO;
  term: TermDTO;
  scores: ScoreSet;
  descriptive: ReviewDescriptiveDTO;
  comment: string | null;
  publishedAt: string;
  revision: number;
}

export interface SectionTeacherDTO {
  id: string;
  name: string;
  title: string;
  departmentName: string;
  ratingSummary: RatingSummaryDTO;
}

export interface MeetingDTO {
  weekday: number | null;
  startPeriod: number | null;
  endPeriod: number | null;
  weeks: string | null;
  location: string | null;
  timeUnknown: boolean;
}

export interface SectionDTO {
  id: string;
  sectionCode: string;
  course: CourseRefDTO;
  term: TermDTO;
  campus: string;
  capacity: number | null;
  teachers: SectionTeacherDTO[];
  meetings: MeetingDTO[];
  note: string | null;
  updatedAt: string;
  dataVersion: number;
}

export interface OverviewDTO {
  teacherCount: number;
  courseCount: number;
  sectionCount: number;
  publishedReviewCount: number;
  departmentCount: number;
  currentTerm: TermDTO;
  dataVersion: number;
  updatedAt: string;
  synthetic: boolean;
}

export interface PublicMeta {
  requestId?: string;
  generatedAt: string;
  dataVersion?: number;
  synthetic: true;
  page?: {
    total: number;
    hasMore: boolean;
    nextCursor: string | null;
  };
}

export interface ApiSuccess<T> {
  data: T;
  meta: PublicMeta;
  error: null;
}

export interface ApiErrorDetail {
  code: string;
  message: string;
  fields?: Array<{ path: string; code: string }>;
}

export interface ApiFailure {
  data: null;
  meta: { requestId: string; generatedAt: string; synthetic: true };
  error: ApiErrorDetail;
}

export type ApiEnvelope<T> = ApiSuccess<T> | ApiFailure;

export interface TeacherListQuery {
  q?: string;
  departmentId?: string;
  term?: 'current' | (string & {});
  sort?: TeacherSort;
  limit?: number;
  cursor?: string;
}

export interface ReviewListQuery {
  limit?: number;
  cursor?: string;
}

export interface SectionListQuery {
  q?: string;
  departmentId?: string;
  teacherId?: string;
  termId?: string;
  campus?: string;
  weekday?: number;
  limit?: number;
  cursor?: string;
}

export const PUBLIC_PATHS = {
  overview: `${API_PREFIX}/public/overview`,
  teachers: `${API_PREFIX}/public/teachers`,
  teacher: (teacherId: string) => `${API_PREFIX}/public/teachers/${encodeURIComponent(teacherId)}`,
  teacherReviews: (teacherId: string) => `${API_PREFIX}/public/teachers/${encodeURIComponent(teacherId)}/reviews`,
  teacherSummary: (teacherId: string) => `${API_PREFIX}/public/teachers/${encodeURIComponent(teacherId)}/ai-summary`,
  departments: `${API_PREFIX}/public/departments`,
  courses: `${API_PREFIX}/public/courses`,
  terms: `${API_PREFIX}/public/terms`,
  sections: `${API_PREFIX}/public/sections`,
} as const;

export const API_ERROR_CODES = {
  notFound: 'NOT_FOUND',
  validation: 'VALIDATION_FAILED',
  cursorInvalid: 'CURSOR_INVALID',
  rateLimited: 'RATE_LIMITED',
  internal: 'INTERNAL',
} as const;

export const SITE_NAME = '清如许';
export const SITE_NAME_EN = 'SoClear';
export const SITE_TAGLINE = '看清一门课，再选一位老师';
export const SITE_POETRY = '问渠那得清如许，为有源头活水来';
