import { RATING_MIN_SAMPLES, type TeacherSummaryState } from '@soclear/contracts';

export function deriveTeacherSummaryState(
  sampleCount: number,
  configured: TeacherSummaryState | null,
): TeacherSummaryState {
  if (sampleCount < RATING_MIN_SAMPLES) return 'insufficient';
  if (configured === 'generating') return 'generating';
  if (configured === 'ready') return 'ready';
  return 'unavailable';
}

export const TEACHER_SUMMARY_LIMITATIONS =
  '总结只依据当前公开评价中的共同表述，反映样本观点，不代表对教师能力或人格的事实判断；公开来源变化后需要重新生成。当前页面为合成演示数据。';

export const LOCAL_SUMMARY_LIMITATIONS =
  '本总结由本地确定性规则基于当前公开评价生成，不是平台 AI 生成；只反映样本中的共同表述，不代表对教师能力或人格的事实判断；公开来源变化后需要重新生成。当前页面为合成演示数据。';
