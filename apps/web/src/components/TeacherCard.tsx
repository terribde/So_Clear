import { Link } from 'react-router-dom';
import type { TeacherPublicDTO } from '@soclear/contracts';
import { ArrowUpRight, CheckCircle2 } from 'lucide-react';
import { RatingBadge } from './RatingBadge';
import { initials } from '../lib/format';

export function TeacherCard({
  teacher,
  compact = false,
}: {
  teacher: TeacherPublicDTO;
  compact?: boolean;
}) {
  return (
    <Link
      to={`/teachers/${teacher.id}`}
      className="surface surface-interactive group flex h-full flex-col justify-between p-4 sm:p-5"
    >
      <div>
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-jade-50 text-base font-bold text-jade-700 ring-1 ring-inset ring-jade-100">
              {initials(teacher.name)}
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <h3 className="truncate text-[15px] font-bold tracking-tight text-ink-950 transition group-hover:text-jade-700">
                  {teacher.name}
                </h3>
                <span className="text-[11px] font-medium text-ink-500">{teacher.title}</span>
                {teacher.isTeachingThisTerm ? (
                  <span className="inline-flex items-center gap-0.5 rounded-full bg-jade-50 px-1.5 py-0.5 text-[9px] font-medium text-jade-700 ring-1 ring-inset ring-jade-100">
                    <CheckCircle2 className="size-2.5" />
                    本学期
                  </span>
                ) : null}
              </div>
              <p className="mt-1 truncate text-[11px] text-ink-400">
                {teacher.department.name}
                {teacher.campuses.length ? ` · ${teacher.campuses.join(' / ')}` : ''}
              </p>
            </div>
          </div>
          <RatingBadge summary={teacher.ratingSummary} size={compact ? 'sm' : 'md'} />
        </div>

        <div className="mt-3.5 flex flex-wrap gap-1.5">
          {teacher.courses.slice(0, compact ? 2 : 3).map((course) => (
            <span
              key={course.id}
              className="inline-flex max-w-full items-center truncate rounded-lg border border-line/80 bg-paper/60 px-2 py-1 text-[11px] text-ink-600"
            >
              {course.name}
            </span>
          ))}
          {teacher.courses.length > (compact ? 2 : 3) ? (
            <span className="inline-flex items-center rounded-lg bg-paper px-2 py-1 text-[11px] text-ink-400">
              +{teacher.courses.length - (compact ? 2 : 3)}
            </span>
          ) : null}
        </div>

        {!compact && teacher.tags.length ? (
          <div className="mt-2 flex flex-wrap gap-x-2 gap-y-1">
            {teacher.tags.slice(0, 3).map((tag) => (
              <span key={tag} className="text-[10px] text-jade-700">
                #{tag}
              </span>
            ))}
          </div>
        ) : null}
      </div>

      <div className="mt-4 flex items-center justify-between border-t border-line/60 pt-3 text-[11px] text-ink-400">
        <span>
          {teacher.ratingSummary.eligible
            ? `四维均分来自 ${teacher.ratingSummary.publishedCount} 条公开评价`
            : '综合分仅在样本达到 5 条后展示'}
        </span>
        <span className="inline-flex items-center gap-0.5 font-medium text-ink-500 transition group-hover:text-jade-700">
          查看详情
          <ArrowUpRight className="size-3.5" />
        </span>
      </div>
    </Link>
  );
}
