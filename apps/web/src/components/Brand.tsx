import { Link } from 'react-router-dom';
import { SITE_NAME, SITE_NAME_EN } from '@soclear/contracts';

export function BrandMark({ className = 'size-10' }: { className?: string }) {
  return (
    <span
      className={`relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-[13px] bg-gradient-to-br from-jade-600 to-jade-900 text-white shadow-[0_8px_18px_-12px_rgba(18,70,56,0.9)] ${className}`}
      aria-hidden="true"
    >
      <svg viewBox="0 0 64 64" className="size-[72%]" fill="none">
        <path
          d="M32 12.5c7.8 9.2 13.1 15 13.1 22.2C45.1 42.1 39.2 48 32 48s-13.1-5.9-13.1-13.3C18.9 27.5 24.2 21.7 32 12.5Z"
          stroke="currentColor"
          strokeOpacity="0.92"
          strokeWidth="2.6"
          strokeLinejoin="round"
        />
        <path
          d="M23.8 36.8c2.4 2.2 5.3 3.3 8.6 3.3 3.4 0 6.4-1.1 8.8-3.3"
          stroke="currentColor"
          strokeOpacity="0.55"
          strokeWidth="2.3"
          strokeLinecap="round"
        />
        <path
          d="M26.5 29.6c1.6-1.8 3.6-2.7 5.9-2.7 2.2 0 4.2.9 5.8 2.7"
          stroke="currentColor"
          strokeOpacity="0.82"
          strokeWidth="2.1"
          strokeLinecap="round"
        />
      </svg>
    </span>
  );
}

export function BrandLockup({
  compact = false,
  markClassName = 'size-10',
  titleClassName = 'text-[20px]',
}: {
  compact?: boolean;
  markClassName?: string;
  titleClassName?: string;
}) {
  return (
    <span className="flex items-center gap-2.5">
      <BrandMark className={markClassName} />
      <span className="flex flex-col leading-none">
        <span className="flex items-baseline gap-2">
          <span className={`brand-serif font-bold text-ink-950 ${titleClassName}`}>{SITE_NAME}</span>
          {compact ? null : (
            <span className="text-[9px] font-semibold tracking-[0.24em] text-ink-300">
              {SITE_NAME_EN.toUpperCase()}
            </span>
          )}
        </span>
        {compact ? null : (
          <span className="mt-1 text-[10px] tracking-[0.14em] text-ink-400">教师评价 · 课程查询</span>
        )}
      </span>
    </span>
  );
}

export function BrandLink({ compact = false }: { compact?: boolean }) {
  return (
    <Link
      to="/"
      className="group inline-flex items-center rounded-2xl py-1 focus-visible:outline-offset-4"
      aria-label={`${SITE_NAME}首页`}
    >
      <BrandLockup compact={compact} />
    </Link>
  );
}
