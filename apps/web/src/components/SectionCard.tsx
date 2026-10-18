import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { SectionDTO } from '@soclear/contracts';
import {
  AlertTriangle,
  ArrowUpRight,
  Building2,
  Check,
  Clock3,
  Copy,
  MapPin,
  Star,
  Users,
} from 'lucide-react';
import { useToast } from './Toast';
import { formatMeeting, formatScore, meetingLocation } from '../lib/format';

export function SectionCard({
  section,
  matchPercent,
  rank,
}: {
  section: SectionDTO;
  matchPercent?: number | null;
  rank?: number;
}) {
  const toast = useToast();
  const [copied, setCopied] = useState(false);

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(section.sectionCode);
      setCopied(true);
      toast(`已复制选课号 ${section.sectionCode}`, 'success');
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      toast('浏览器未允许复制，请手动选择选课号。', 'error');
    }
  };

  const hasUnknownTime = section.meetings.some((meeting) => meeting.timeUnknown);

  return (
    <article className="surface p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          {typeof rank === 'number' ? (
            <span
              className={`flex size-8 shrink-0 items-center justify-center rounded-xl text-xs font-bold ${
                rank === 1
                  ? 'bg-sun-100 text-sun-700'
                  : rank <= 3
                    ? 'bg-jade-50 text-jade-700'
                    : 'bg-paper text-ink-400'
              }`}
            >
              {rank}
            </span>
          ) : null}
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-[15px] font-bold tracking-tight text-ink-950">{section.course.name}</h3>
              {section.term.isCurrent ? (
                <span className="rounded-full bg-jade-50 px-2 py-0.5 text-[9px] font-semibold text-jade-700 ring-1 ring-inset ring-jade-100">
                  本学期
                </span>
              ) : (
                <span className="rounded-full bg-paper px-2 py-0.5 text-[9px] text-ink-400">
                  {section.term.label}
                </span>
              )}
            </div>
            <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-ink-400">
              <button
                type="button"
                onClick={copyCode}
                className="inline-flex items-center gap-1 rounded-md bg-paper px-1.5 py-0.5 font-mono text-[10px] text-ink-600 transition hover:bg-jade-50 hover:text-jade-700"
                title="复制选课号"
              >
                {copied ? <Check className="size-3 text-jade-600" /> : <Copy className="size-3" />}
                {section.sectionCode}
              </button>
              <span className="inline-flex items-center gap-1">
                <Building2 className="size-3" />
                {section.campus}
              </span>
              <span className="inline-flex items-center gap-1">
                <Users className="size-3" />
                {section.capacity === null ? '容量待定' : `容量 ${section.capacity} 人`}
              </span>
            </div>
          </div>
        </div>

        {typeof matchPercent === 'number' ? (
          <span className="shrink-0 rounded-full border border-jade-200 bg-jade-50 px-2.5 py-1 text-[10px] font-semibold text-jade-700">
            偏好匹配 {matchPercent}%
          </span>
        ) : null}
      </div>

      <div className="mt-3.5 border-t border-line/60 pt-3">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <span className="text-[10px] font-medium tracking-wide text-ink-400">授课教师</span>
          {section.teachers.map((teacher) => (
            <Link
              key={teacher.id}
              to={`/teachers/${teacher.id}`}
              className="group inline-flex items-center gap-1.5 rounded-lg py-0.5 text-xs font-semibold text-ink-800 transition hover:text-jade-700"
            >
              {teacher.name}
              <span className="text-[10px] font-normal text-ink-400">{teacher.title}</span>
              {teacher.ratingSummary.eligible ? (
                <span className="inline-flex items-center gap-0.5 rounded bg-paper px-1.5 py-0.5 text-[10px] font-medium text-sun-700">
                  <Star className="size-2.5 fill-sun-500 text-sun-600" />
                  {formatScore(teacher.ratingSummary.overall)}
                </span>
              ) : (
                <span className="rounded bg-paper px-1.5 py-0.5 text-[9px] font-normal text-ink-400">
                  样本不足
                </span>
              )}
            </Link>
          ))}
        </div>

        <div className="mt-2.5 grid gap-1.5 sm:grid-cols-2">
          {section.meetings.map((meeting, index) => (
            <div
              key={`${section.id}-meeting-${index}`}
              className={`flex flex-wrap items-center gap-x-3 gap-y-0.5 rounded-xl px-2.5 py-1.5 text-[11px] ${
                meeting.timeUnknown
                  ? 'border border-dashed border-sun-100 bg-sun-50/50 text-sun-700'
                  : 'bg-paper/60 text-ink-600'
              }`}
            >
              <span className="inline-flex items-center gap-1 font-medium">
                <Clock3 className="size-3 text-jade-600" />
                {formatMeeting(meeting)}
                {meeting.weeks ? <span className="font-normal text-ink-400">· {meeting.weeks}</span> : null}
              </span>
              <span className="inline-flex items-center gap-1 text-ink-500">
                <MapPin className="size-3 text-ink-300" />
                {meetingLocation(meeting)}
              </span>
            </div>
          ))}
        </div>

        {hasUnknownTime && section.note ? (
          <div className="mt-2.5 flex items-start gap-2 rounded-xl bg-sun-50/70 px-3 py-2 text-[11px] leading-relaxed text-sun-700">
            <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
            <span>{section.note}</span>
          </div>
        ) : null}

        {!hasUnknownTime && section.note ? (
          <p className="mt-2.5 text-[10px] text-ink-400">{section.note}</p>
        ) : null}
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-line/50 pt-2.5 text-[10px] text-ink-400">
        <span>容量与时间为来源快照，不承诺实时余量。</span>
        <Link
          to={`/sections/${section.id}`}
          className="inline-flex items-center gap-0.5 font-medium text-ink-500 transition hover:text-jade-700"
        >
          查看开课详情
          <ArrowUpRight className="size-3" />
        </Link>
      </div>
    </article>
  );
}
