import {
  REPORT_REASONS,
  type AppealResolution,
  type AppealStatus,
  type AuditAction,
  type AuditEventDTO,
  type MainGroup,
  type OwnReviewStatus,
  type ReportReasonCode,
  type ReportResolution,
  type ReportStatus,
  type TeacherSummaryState,
} from '@soclear/contracts';

export const GROUP_LABELS: Record<MainGroup, string> = {
  guest: '游客',
  user: '用户',
  verified_student: '认证学生',
  content_admin: '内容管理员',
  system_admin: '系统管理员',
};

export const GROUP_ABILITIES: Record<MainGroup, string> = {
  guest: '公开教师、课程、开课与公开评价查询',
  user: '独立平台账号、本人的处理记录与补救入口',
  verified_student: '在资格有效时提交评价、使用受控检索',
  content_admin: '按能力审核内容、处理举报与总结例外',
  system_admin: '授权范围内的配置、数据、AI 预算与审计',
};

export const REVIEW_STATUS_LABELS: Record<OwnReviewStatus, string> = {
  pending: '待审核',
  published: '已公开',
  rejected: '已驳回',
  hidden: '已隐藏',
  withdrawn: '已撤回',
};

export function reviewStatusTone(status: OwnReviewStatus): string {
  switch (status) {
    case 'published':
      return 'bg-jade-50 text-jade-700 ring-jade-100';
    case 'pending':
      return 'bg-sun-50 text-sun-700 ring-sun-100';
    case 'rejected':
      return 'bg-rose-50 text-rose-600 ring-rose-100';
    default:
      return 'bg-paper text-ink-500 ring-line';
  }
}

export const MODERATION_REASON_OPTIONS = [
  { value: 'insufficient_detail', label: '信息不足，缺少可核验的课堂描述' },
  { value: 'unsafe_content', label: '包含人身攻击、隐私或不当内容' },
  { value: 'off_topic', label: '与课程或教学无关' },
  { value: 'duplicate', label: '重复提交或同一经历重复评价' },
  { value: 'other', label: '其他需要说明的原因' },
] as const;

export type ModerationReasonCode = (typeof MODERATION_REASON_OPTIONS)[number]['value'];

export const MODERATION_REASON_LABELS: Record<ModerationReasonCode, string> = {
  insufficient_detail: '信息不足',
  unsafe_content: '不当内容',
  off_topic: '与课程无关',
  duplicate: '重复评价',
  other: '其他原因',
};

export const REPORT_STATUS_LABELS: Record<ReportStatus, string> = {
  pending: '待处理',
  resolved: '已处理',
  dismissed: '已驳回',
};

export function reportStatusTone(status: ReportStatus): string {
  switch (status) {
    case 'pending':
      return 'bg-sun-50 text-sun-700 ring-sun-100';
    case 'resolved':
      return 'bg-jade-50 text-jade-700 ring-jade-100';
    default:
      return 'bg-paper text-ink-500 ring-line';
  }
}

export const REPORT_RESOLUTION_LABELS: Record<ReportResolution, string> = {
  hidden: '内容已隐藏',
  dismissed: '未采取隐藏',
};

export function reportReasonLabel(code: ReportReasonCode): string {
  return REPORT_REASONS.find((reason) => reason.value === code)?.label ?? code;
}

export const APPEAL_STATUS_LABELS: Record<AppealStatus, string> = {
  pending: '待处理',
  accepted: '已支持',
  rejected: '维持原判',
};

export function appealStatusTone(status: AppealStatus): string {
  switch (status) {
    case 'pending':
      return 'bg-sun-50 text-sun-700 ring-sun-100';
    case 'accepted':
      return 'bg-jade-50 text-jade-700 ring-jade-100';
    default:
      return 'bg-paper text-ink-500 ring-line';
  }
}

export const APPEAL_RESOLUTION_LABELS: Record<AppealResolution, string> = {
  restored: '已恢复公开',
  upheld: '维持原判',
};

const EXTRA_MODERATION_REASON_LABELS: Record<string, string> = {
  report_hide: '举报核实后隐藏',
  appeal_restore: '申诉恢复公开',
};

export function moderationReasonLabel(code: string): string {
  return (
    MODERATION_REASON_LABELS[code as ModerationReasonCode] ??
    EXTRA_MODERATION_REASON_LABELS[code] ??
    code
  );
}

export const AUDIT_ACTION_LABELS: Record<AuditAction, string> = {
  submit: '提交评价',
  edit: '编辑待审评价',
  resubmit: '修订并重新送审',
  approve: '审核通过',
  reject: '驳回评价',
  hide: '隐藏评价',
  withdraw: '作者撤回',
  report_dismiss: '驳回举报',
  appeal_uphold: '申诉维持原判',
  appeal_restore: '申诉恢复公开',
};

export const AUDIT_ACTOR_LABELS: Record<AuditEventDTO['actor'], string> = {
  author: '作者',
  moderator: '管理员',
};

export const SUMMARY_STATE_LABELS: Record<TeacherSummaryState, string> = {
  ready: '已生成',
  generating: '待重建',
  insufficient: '样本不足',
  unavailable: '尚未生成',
};

export function summaryStateTone(state: TeacherSummaryState): string {
  switch (state) {
    case 'ready':
      return 'bg-jade-50 text-jade-700 ring-jade-100';
    case 'generating':
      return 'bg-sun-50 text-sun-700 ring-sun-100';
    case 'unavailable':
      return 'bg-rose-50 text-rose-600 ring-rose-100';
    default:
      return 'bg-paper text-ink-500 ring-line';
  }
}
