import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { ArrowRight, BookOpenText, Search, UsersRound } from 'lucide-react';

type SearchMode = 'teachers' | 'courses';

const quickLinks: Array<{ label: string; mode: SearchMode; query: string }> = [
  { label: '高等数学', mode: 'courses', query: '高等数学' },
  { label: '数据结构', mode: 'courses', query: '数据结构' },
  { label: '沈知远', mode: 'teachers', query: '沈知远' },
  { label: '板书清楚', mode: 'teachers', query: '板书清楚' },
];

export function SearchHero() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<SearchMode>('teachers');
  const [query, setQuery] = useState('');

  const go = (targetMode: SearchMode, value: string) => {
    const trimmed = value.trim();
    navigate(`/${targetMode}?q=${encodeURIComponent(trimmed)}`);
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    const trimmed = query.trim();
    if (!trimmed) {
      navigate(`/${mode}`);
      return;
    }
    go(mode, trimmed);
  };

  return (
    <div className="w-full">
      <div className="surface relative overflow-hidden p-2 sm:p-2.5">
        <div className="pointer-events-none absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-jade-200 to-transparent" />
        <form onSubmit={handleSubmit} className="relative rounded-[20px] bg-white">
          <div className="flex items-center gap-2 px-3 pt-3 sm:gap-3 sm:px-4 sm:pt-4">
            <Search className="size-[18px] shrink-0 text-ink-300 sm:size-5" />
            <input
              id="home-search-input"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={
                mode === 'teachers'
                  ? '搜索教师、课程或评价标签'
                  : '搜索课程名称，如高等数学、数据结构'
              }
              aria-label={mode === 'teachers' ? '搜索教师' : '搜索课程'}
              className="min-w-0 flex-1 bg-transparent py-2 text-[14px] text-ink-900 placeholder:text-ink-300 focus:outline-none sm:text-[15px]"
            />
            <button
              type="submit"
              aria-label="开始搜索"
              className="btn-primary h-10 shrink-0 gap-1.5 px-3.5 text-xs sm:h-11 sm:px-5 sm:text-[13px]"
            >
              <Search className="size-3.5 sm:hidden" />
              <span className="hidden sm:inline">开始查询</span>
              <ArrowRight className="hidden size-3.5 sm:block" />
            </button>
          </div>

          <div className="mt-2.5 flex items-center justify-between gap-3 border-t border-line/60 px-3 py-2.5 sm:px-4">
            <div className="flex rounded-xl bg-paper p-0.5">
              <button
                type="button"
                onClick={() => setMode('teachers')}
                className={`relative z-10 flex items-center gap-1.5 rounded-[10px] px-2.5 py-1.5 text-[11px] font-semibold transition sm:px-3 sm:text-xs ${
                  mode === 'teachers' ? 'text-white' : 'text-ink-500 hover:text-ink-800'
                }`}
                aria-pressed={mode === 'teachers'}
              >
                {mode === 'teachers' ? (
                  <motion.span
                    layoutId="home-search-mode"
                    className="absolute inset-0 -z-10 rounded-[10px] bg-jade-700"
                    transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                  />
                ) : null}
                <UsersRound className="size-3.5" />
                找老师
              </button>
              <button
                type="button"
                onClick={() => setMode('courses')}
                className={`relative z-10 flex items-center gap-1.5 rounded-[10px] px-2.5 py-1.5 text-[11px] font-semibold transition sm:px-3 sm:text-xs ${
                  mode === 'courses' ? 'text-white' : 'text-ink-500 hover:text-ink-800'
                }`}
                aria-pressed={mode === 'courses'}
              >
                {mode === 'courses' ? (
                  <motion.span
                    layoutId="home-search-mode"
                    className="absolute inset-0 -z-10 rounded-[10px] bg-jade-700"
                    transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                  />
                ) : null}
                <BookOpenText className="size-3.5" />
                查课程
              </button>
            </div>

            <p className="hidden items-center gap-1.5 text-[10px] text-ink-400 sm:flex">
              公开查询无需登录
              <span className="size-1 rounded-full bg-ink-300" />
              评价正文需审核后展示
            </p>
          </div>
        </form>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-center gap-1.5 sm:justify-start">
        <span className="mr-1 text-[10px] font-medium tracking-wide text-ink-400">试试搜索</span>
        {quickLinks.map((link) => (
          <button
            key={link.label}
            type="button"
            onClick={() => go(link.mode, link.query)}
            className="chip py-1 text-[11px]"
          >
            {link.label}
          </button>
        ))}
      </div>
    </div>
  );
}
