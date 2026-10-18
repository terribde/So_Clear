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

export type MainGroup = 'guest' | 'user' | 'verified_student' | 'content_admin' | 'system_admin';

export type AccountRole = 'user' | 'content_admin' | 'system_admin';

export interface AccountRefDTO {
  id: string;
  handle: string;
  displayName: string;
  demo: boolean;
}

export interface StudentGrantStatusDTO {
  state: 'none' | 'active' | 'revoked';
  scope: string | null;
  assurance: 'demo_only' | 'verified_at_claim' | null;
  version: number | null;
}

export interface SessionDTO {
  authenticated: boolean;
  account: AccountRefDTO | null;
  mainGroup: MainGroup;
  studentGrant: StudentGrantStatusDTO;
  isAdmin: boolean;
  csrfToken: string | null;
  authAvailable: boolean;
  demo: boolean;
}

export interface DemoAccountsDTO {
  enabled: true;
  accounts: Array<{ handle: string; password: string; role: AccountRole; student: boolean; label: string }>;
}

export interface ReviewSubmissionInput {
  teacherId: string;
  courseId: string;
  termId: string;
  scores: ScoreSet;
  difficulty?: number | null;
  workload?: number | null;
  attendance?: AttendanceFrequency | null;
  comment?: string | null;
}

export interface ReviewUpdateInput {
  expectedVersion: number;
  scores: ScoreSet;
  difficulty?: number | null;
  workload?: number | null;
  attendance?: AttendanceFrequency | null;
  comment?: string | null;
}

export type OwnReviewStatus = 'pending' | 'published' | 'rejected' | 'hidden' | 'withdrawn';

export interface OwnReviewDTO {
  id: string;
  status: OwnReviewStatus;
  teacher: { id: string; name: string };
  course: CourseRefDTO;
  term: TermDTO;
  revision: number;
  version: number;
  scores: ScoreSet;
  descriptive: ReviewDescriptiveDTO;
  comment: string | null;
  submittedAt: string;
  publishedAt: string | null;
  updatedAt: string;
  moderationReason: string | null;
  actions: { canEdit: boolean; canWithdraw: boolean };
}

export interface ModerationDecisionInput {
  decision: 'approve' | 'reject';
  reasonCode?: string | null;
  expectedVersion: number;
}

export interface AdminReviewDTO {
  id: string;
  status: OwnReviewStatus;
  teacher: { id: string; name: string };
  course: CourseRefDTO;
  term: TermDTO;
  revision: number;
  version: number;
  scores: ScoreSet;
  descriptive: ReviewDescriptiveDTO;
  comment: string | null;
  submittedAt: string;
  publishedAt: string | null;
  updatedAt: string;
}

export interface AdminReviewRevisionDTO {
  revision: number;
  isCurrent: boolean;
  scores: ScoreSet;
  descriptive: ReviewDescriptiveDTO;
  comment: string | null;
  submittedAt: string;
  publishedAt: string | null;
}

export const REPORT_REASONS = [
  { value: 'privacy', label: '包含个人信息或联系方式' },
  { value: 'harassment', label: '人身攻击、威胁或歧视' },
  { value: 'false_info', label: '疑似捏造事实或冒充经历' },
  { value: 'spam', label: '广告、重复或无关内容' },
  { value: 'other', label: '其他需要核查的问题' },
] as const;

export type ReportReasonCode = (typeof REPORT_REASONS)[number]['value'];

export type ReportStatus = 'pending' | 'resolved' | 'dismissed';

export type ReportResolution = 'hidden' | 'dismissed';

export interface ReportSubmissionInput {
  reviewId: string;
  reasonCode: ReportReasonCode;
  note?: string | null;
}

export interface ReportedReviewDTO {
  id: string;
  status: OwnReviewStatus;
  teacher: { id: string; name: string };
  course: CourseRefDTO;
  term: TermDTO;
  comment: string | null;
  publishedAt: string | null;
  revision: number;
  version: number;
}

export interface ReportDTO {
  id: string;
  status: ReportStatus;
  reasonCode: ReportReasonCode;
  note: string | null;
  resolution: ReportResolution | null;
  createdAt: string;
  resolvedAt: string | null;
  version: number;
  review: ReportedReviewDTO;
}

export interface ReportDecisionInput {
  decision: 'dismiss' | 'hide';
  expectedVersion: number;
}

export type AppealStatus = 'pending' | 'accepted' | 'rejected';

export type AppealResolution = 'restored' | 'upheld';

export interface AppealSubmissionInput {
  reviewId: string;
  reason: string;
}

export interface AppealReviewDTO {
  id: string;
  status: OwnReviewStatus;
  teacher: { id: string; name: string };
  course: CourseRefDTO;
  term: TermDTO;
  revision: number;
  version: number;
  scores: ScoreSet;
  descriptive: ReviewDescriptiveDTO;
  comment: string | null;
  submittedAt: string;
  publishedAt: string | null;
  updatedAt: string;
  moderationReason: string | null;
}

export interface AppealDTO {
  id: string;
  status: AppealStatus;
  reason: string;
  decisionNote: string | null;
  resolution: AppealResolution | null;
  createdAt: string;
  resolvedAt: string | null;
  version: number;
  review: AppealReviewDTO;
}

export interface AppealDecisionInput {
  decision: 'restore' | 'uphold';
  note?: string | null;
  expectedVersion: number;
}

export type AuditAction =
  | 'submit'
  | 'edit'
  | 'resubmit'
  | 'approve'
  | 'reject'
  | 'hide'
  | 'withdraw'
  | 'report_dismiss'
  | 'appeal_uphold'
  | 'appeal_restore';

export interface AuditEventDTO {
  id: number;
  action: AuditAction;
  actor: 'author' | 'moderator';
  reasonCode: string | null;
  fromStatus: OwnReviewStatus | null;
  toStatus: OwnReviewStatus;
  revision: number;
  createdAt: string;
}

export type AdminSummaryFilter = 'all' | TeacherSummaryState;

export interface AdminSummaryDTO {
  teacher: { id: string; name: string; departmentName: string };
  state: TeacherSummaryState;
  sampleCount: number;
  generatedAt: string | null;
  teacherSummaryEpoch: number;
  sentenceCount: number;
  canRegenerate: boolean;
  localDemo: true;
}

export interface AdminOverviewQueuesDTO {
  reviews: Record<OwnReviewStatus, number>;
  reports: Record<ReportStatus, number>;
  appeals: Record<AppealStatus, number>;
  summaries: Record<TeacherSummaryState, number>;
}

export interface AdminRecentActionDTO {
  id: number;
  action: AuditAction;
  actor: AuditEventDTO['actor'];
  reasonCode: string | null;
  fromStatus: OwnReviewStatus | null;
  toStatus: OwnReviewStatus;
  revision: number;
  createdAt: string;
  reviewId: string;
  teacher: { id: string; name: string };
  course: { id: string; name: string };
}

export interface AdminOverviewDTO {
  queues: AdminOverviewQueuesDTO;
  recentActions: AdminRecentActionDTO[];
}

export type AdminAuditActorFilter = 'all' | AuditEventDTO['actor'];
export type AdminAuditActionFilter = 'all' | AuditAction;

export const AUTH_PATHS = {
  session: `${API_PREFIX}/auth/session`,
  login: `${API_PREFIX}/auth/login`,
  logout: `${API_PREFIX}/auth/logout`,
  demoAccounts: `${API_PREFIX}/auth/demo-accounts`,
} as const;

export const ME_PATHS = {
  reviews: `${API_PREFIX}/me/reviews`,
  reviewUpdate: (reviewId: string) =>
    `${API_PREFIX}/me/reviews/${encodeURIComponent(reviewId)}`,
  reviewWithdraw: (reviewId: string) =>
    `${API_PREFIX}/me/reviews/${encodeURIComponent(reviewId)}/withdraw`,
  reports: `${API_PREFIX}/me/reports`,
  appeals: `${API_PREFIX}/me/appeals`,
} as const;

export const ADMIN_PATHS = {
  overview: `${API_PREFIX}/admin/overview`,
  audit: `${API_PREFIX}/admin/audit`,
  reviews: `${API_PREFIX}/admin/reviews`,
  reviewDecision: (reviewId: string) =>
    `${API_PREFIX}/admin/reviews/${encodeURIComponent(reviewId)}/decisions`,
  reports: `${API_PREFIX}/admin/reports`,
  reportDecision: (reportId: string) =>
    `${API_PREFIX}/admin/reports/${encodeURIComponent(reportId)}/decisions`,
  appeals: `${API_PREFIX}/admin/appeals`,
  appealDecision: (appealId: string) =>
    `${API_PREFIX}/admin/appeals/${encodeURIComponent(appealId)}/decisions`,
  reviewAudit: (reviewId: string) =>
    `${API_PREFIX}/admin/reviews/${encodeURIComponent(reviewId)}/audit`,
  reviewRevisions: (reviewId: string) =>
    `${API_PREFIX}/admin/reviews/${encodeURIComponent(reviewId)}/revisions`,
  teacherSummaries: `${API_PREFIX}/admin/teacher-summaries`,
  summaryRegenerate: (teacherId: string) =>
    `${API_PREFIX}/admin/teachers/${encodeURIComponent(teacherId)}/summary/regenerate`,
} as const;

export const PUBLIC_PATHS = {
  overview: `${API_PREFIX}/public/overview`,
  teachers: `${API_PREFIX}/public/teachers`,
  teacher: (teacherId: string) => `${API_PREFIX}/public/teachers/${encodeURIComponent(teacherId)}`,
  teacherReviews: (teacherId: string) => `${API_PREFIX}/public/teachers/${encodeURIComponent(teacherId)}/reviews`,
  teacherSummary: (teacherId: string) => `${API_PREFIX}/public/teachers/${encodeURIComponent(teacherId)}/ai-summary`,
  reviews: `${API_PREFIX}/public/reviews`,
  review: (reviewId: string) => `${API_PREFIX}/public/reviews/${encodeURIComponent(reviewId)}`,
  departments: `${API_PREFIX}/public/departments`,
  courses: `${API_PREFIX}/public/courses`,
  terms: `${API_PREFIX}/public/terms`,
  sections: `${API_PREFIX}/public/sections`,
  section: (sectionId: string) => `${API_PREFIX}/public/sections/${encodeURIComponent(sectionId)}`,
} as const;

export const API_ERROR_CODES = {
  notFound: 'NOT_FOUND',
  validation: 'VALIDATION_FAILED',
  cursorInvalid: 'CURSOR_INVALID',
  rateLimited: 'RATE_LIMITED',
  internal: 'INTERNAL',
  unauthenticated: 'UNAUTHENTICATED',
  forbidden: 'FORBIDDEN',
  csrfFailed: 'CSRF_FAILED',
  invalidCredentials: 'AUTH_INVALID_CREDENTIALS',
  verificationRequired: 'STUDENT_VERIFICATION_REQUIRED',
  versionConflict: 'VERSION_CONFLICT',
  reviewSlotTaken: 'REVIEW_SLOT_TAKEN',
  reviewNotEditable: 'REVIEW_NOT_EDITABLE',
  reportAlreadyExists: 'REPORT_ALREADY_EXISTS',
  reportSelfForbidden: 'REPORT_SELF_FORBIDDEN',
  reportNotActionable: 'REPORT_NOT_ACTIONABLE',
  appealAlreadyExists: 'APPEAL_ALREADY_EXISTS',
  appealNotActionable: 'APPEAL_NOT_ACTIONABLE',
  summaryNotActionable: 'SUMMARY_NOT_ACTIONABLE',
  authUnavailable: 'AUTH_UNAVAILABLE',
} as const;

export const SITE_NAME = '清如许';
export const SITE_NAME_EN = 'SoClear';
export const SITE_TAGLINE = '看清一门课，再选一位老师';
export const SITE_POETRY = '问渠那得清如许，为有源头活水来';
