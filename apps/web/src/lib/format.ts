import type { MeetingDTO, ScoreSet } from '@soclear/contracts';
import { SITE_NAME } from '@soclear/contracts';

const weekdays = ['一', '二', '三', '四', '五', '六', '日'];

export function formatScore(value: number | null | undefined): string {
  return typeof value === 'number' && Number.isFinite(value) ? value.toFixed(1) : '—';
}

export function formatSample(count: number, minSamples: number): string {
  if (count === 0) return '暂无已发布评价';
  if (count < minSamples) return `${count} 条评价 · 样本不足`;
  return `${count} 条已发布评价`;
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

export function formatMeeting(meeting: MeetingDTO): string {
  if (meeting.timeUnknown || meeting.weekday === null) return '时间待定';
  const weekday = weekdays[meeting.weekday - 1] ?? '?';
  const periods =
    meeting.startPeriod !== null && meeting.endPeriod !== null
      ? `${meeting.startPeriod}–${meeting.endPeriod} 节`
      : '';
  return `周${weekday}${periods ? ` ${periods}` : ''}`;
}

export function meetingLocation(meeting: MeetingDTO): string {
  return meeting.location ?? '地点待定';
}

export function weightedMatch(scores: ScoreSet | null, weights: ScoreSet): number | null {
  if (!scores) return null;
  const keys = Object.keys(weights) as Array<keyof ScoreSet>;
  const totalWeight = keys.reduce((sum, key) => sum + weights[key], 0);
  if (totalWeight <= 0) return null;
  const weighted = keys.reduce((sum, key) => sum + ((scores[key] - 1) / 4) * weights[key], 0);
  return Math.min(99, Math.max(1, Math.round((weighted / totalWeight) * 100)));
}

export function pageTitle(title?: string): string {
  return title ? `${title} · ${SITE_NAME}` : `${SITE_NAME} · 教师评价与课程查询`;
}

export function initials(name: string): string {
  return name.trim().slice(0, 1) || '师';
}
