import type { RatingSummaryDTO } from '@soclear/contracts';
import { Star } from 'lucide-react';
import { formatSample, formatScore } from '../lib/format';

export function RatingBadge({
  summary,
  size = 'md',
}: {
  summary: RatingSummaryDTO;
  size?: 'sm' | 'md' | 'lg';
}) {
  if (!summary.eligible) {
    return (
      <div className="flex shrink-0 flex-col items-end gap-0.5 whitespace-nowrap text-right">
        <span className="inline-flex items-center rounded-full border border-line bg-paper px-2 py-0.5 text-[11px] font-medium text-ink-400">
          样本不足
        </span>
        <span className="text-[10px] text-ink-400">{summary.publishedCount} 条公开评价</span>
      </div>
    );
  }

  return (
    <div className="flex shrink-0 flex-col items-end gap-0.5 whitespace-nowrap text-right">
      <span className="flex items-baseline gap-1 font-semibold text-ink-950">
        <Star
          className={`${size === 'lg' ? 'size-5' : size === 'sm' ? 'size-3.5' : 'size-4'} fill-sun-500 text-sun-600`}
          strokeWidth={2.1}
        />
        <span
          className={
            size === 'lg' ? 'text-3xl tracking-tight' : size === 'sm' ? 'text-base' : 'text-xl'
          }
        >
          {formatScore(summary.overall)}
        </span>
        <span className="text-[10px] font-normal text-ink-400">/ 5</span>
      </span>
      <span className="text-[10px] text-ink-400">
        {formatSample(summary.publishedCount, summary.minSamples)}
      </span>
    </div>
  );
}
