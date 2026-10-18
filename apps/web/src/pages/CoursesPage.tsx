import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  PUBLIC_PATHS,
  SCORE_DIMENSIONS,
  type CourseDTO,
  type DepartmentDTO,
  type OverviewDTO,
  type ScoreSet,
  type SectionDTO,
  type SectionTeacherDTO,
} from '@soclear/contracts';
import {
  CalendarDays,
  ChevronDown,
  Info,
  LoaderCircle,
  RotateCcw,
  Search,
  SlidersHorizontal,
  Sparkles,
  X,
} from 'lucide-react';
import { PageHeader } from '../components/PageHeader';
import { SectionCard } from '../components/SectionCard';
import {
  EmptyState,
  ErrorState,
  InlineError,
  LoadingBlock,
} from '../components/States';
import { useApiResource, usePaginatedApi } from '../features/api/hooks';
import { useDebouncedValue } from '../lib/useDebouncedValue';
import { pageTitle, weightedMatch } from '../lib/format';

const defaultWeights: ScoreSet = {
  clarity: 80,
  organization: 60,
  feedback: 50,
  assessmentTransparency: 70,
};

const campusOptions = ['犀浦校区', '九里校区', '峨眉校区'];
const weekdayOptions = [1, 2, 3, 4, 5];

export function CoursesPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const q = searchParams.get('q') ?? '';
  const departmentId = searchParams.get('dept') ?? '';
  const campus = searchParams.get('campus') ?? '';
  const weekdayParam = Number(searchParams.get('weekday') ?? 0);
  const weekday = weekdayOptions.includes(weekdayParam) ? weekdayParam : null;

  const [searchInput, setSearchInput] = useState(q);
  const debouncedSearch = useDebouncedValue(searchInput, 280);
  const [preferencesOn, setPreferencesOn] = useState(true);
  const [weights, setWeights] = useState<ScoreSet>(defaultWeights);

  const overview = useApiResource<OverviewDTO>(PUBLIC_PATHS.overview);
  const departments = useApiResource<DepartmentDTO[]>(PUBLIC_PATHS.departments);
  const courses = useApiResource<CourseDTO[]>(PUBLIC_PATHS.courses);
  const sections = usePaginatedApi<SectionDTO>(
    PUBLIC_PATHS.sections,
    {
      q,
      departmentId: departmentId || undefined,
      campus: campus || undefined,
      weekday: weekday ?? undefined,
    },
    true,
    50,
  );

  useEffect(() => {
    document.title = pageTitle('课程与开课');
  }, []);

  useEffect(() => {
    setSearchInput(q);
  }, [q]);

  useEffect(() => {
    const nextQuery = debouncedSearch.trim();
    if (nextQuery === q) return;
    setSearchParams(
      (previous) => {
        const next = new URLSearchParams(previous);
        if (nextQuery) next.set('q', nextQuery);
        else next.delete('q');
        return next;
      },
      { replace: true },
    );
  }, [debouncedSearch, q, setSearchParams]);

  const updateParam = (key: string, value: string | null) => {
    setSearchParams(
      (previous) => {
        const next = new URLSearchParams(previous);
        if (value) next.set(key, value);
        else next.delete(key);
        return next;
      },
      { replace: true },
    );
  };

  const totalWeight = SCORE_DIMENSIONS.reduce((sum, dimension) => sum + weights[dimension.key], 0);
  const canRank = Boolean(q.trim()) && preferencesOn && totalWeight > 0;

  const rankedSections = useMemo(() => {
    const scored = sections.items.map((section) => {
      const candidates: Array<{ teacher: SectionTeacherDTO; percent: number }> = [];
      for (const teacher of section.teachers) {
        if (!teacher.ratingSummary.eligible || !teacher.ratingSummary.scores) continue;
        const percent = weightedMatch(teacher.ratingSummary.scores, weights);
        if (percent !== null) candidates.push({ teacher, percent });
      }
      candidates.sort((a, b) => b.percent - a.percent);
      return { section, percent: candidates[0]?.percent ?? null };
    });

    if (!canRank) return scored;

    return [...scored].sort((a, b) => {
      if (a.percent === null && b.percent === null) {
        return a.section.sectionCode.localeCompare(b.section.sectionCode);
      }
      if (a.percent === null) return 1;
      if (b.percent === null) return -1;
      if (b.percent !== a.percent) return b.percent - a.percent;
      return a.section.sectionCode.localeCompare(b.section.sectionCode);
    });
  }, [canRank, sections.items, weights]);

  const hasFilters = Boolean(q || departmentId || campus || weekday);
  const resetFilters = () => {
    setSearchParams({}, { replace: true });
    setSearchInput('');
  };
  const resetWeights = () => setWeights(defaultWeights);

  return (
    <div className="mx-auto max-w-5xl px-4 pb-14 pt-8 sm:px-6 sm:pt-10">
      <PageHeader
        eyebrow="COURSES / 课程与开课"
        title="先看清开课，再比较课堂"
        description="按课程、学院、校区与上课日期查询本学期教学班。偏好排序是确定性的四维加权计算，不调用模型，也不会补齐缺失评分。"
        action={
          <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-white px-3 py-1.5 text-[10px] font-medium text-ink-500">
            <CalendarDays className="size-3.5 text-jade-600" />
            {overview.data?.currentTerm.label ?? '当前学期'}
          </span>
        }
      />

      <div className="surface mt-6 p-3.5 sm:p-4">
        <div className="relative flex items-center">
          <Search className="pointer-events-none absolute left-3.5 size-4 text-ink-300" />
          <input
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder="搜索课程或教师"
            aria-label="搜索课程或教师"
            className="field h-11 pl-10 pr-10 text-[13px]"
          />
          {searchInput ? (
            <button
              type="button"
              onClick={() => setSearchInput('')}
              className="absolute right-3 flex size-6 items-center justify-center rounded-full text-ink-400 transition hover:bg-paper-deep hover:text-ink-700"
              aria-label="清空课程搜索"
            >
              <X className="size-3.5" />
            </button>
          ) : null}
        </div>

        <div className="no-scrollbar mt-2.5 flex gap-1.5 overflow-x-auto pb-0.5">
          {courses.data?.map((course) => (
            <button
              key={course.id}
              type="button"
              onClick={() => {
                const next = q === course.name ? '' : course.name;
                setSearchInput(next);
                updateParam('q', next || null);
              }}
              className={`chip shrink-0 py-1 text-[10px] ${q === course.name ? 'chip-selected' : ''}`}
            >
              {course.name}
            </button>
          ))}
          {courses.loading ? (
            <>
              <div className="h-6 w-16 shrink-0 animate-pulse rounded-full bg-line/60" />
              <div className="h-6 w-20 shrink-0 animate-pulse rounded-full bg-line/50" />
            </>
          ) : null}
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-line/70 pt-3">
          <label className="relative flex items-center">
            <span className="sr-only">学院筛选</span>
            <select
              value={departmentId}
              onChange={(event) => updateParam('dept', event.target.value || null)}
              className="select-field h-9 min-w-32 py-0 pl-3 pr-8 text-[11px]"
            >
              <option value="">全部学院</option>
              {departments.data?.map((department) => (
                <option key={department.id} value={department.id}>
                  {department.name}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2.5 size-3.5 text-ink-400" />
          </label>

          <label className="relative flex items-center">
            <span className="sr-only">校区筛选</span>
            <select
              value={campus}
              onChange={(event) => updateParam('campus', event.target.value || null)}
              className="select-field h-9 min-w-28 py-0 pl-3 pr-8 text-[11px]"
            >
              <option value="">全部校区</option>
              {campusOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2.5 size-3.5 text-ink-400" />
          </label>

          <div className="flex flex-wrap items-center gap-1">
            <button
              type="button"
              onClick={() => updateParam('weekday', null)}
              className={`chip h-8 px-2.5 text-[10px] ${weekday === null ? 'chip-selected' : ''}`}
            >
              全部日期
            </button>
            {weekdayOptions.map((day) => (
              <button
                key={day}
                type="button"
                onClick={() => updateParam('weekday', String(day))}
                className={`chip h-8 px-2 text-[10px] ${weekday === day ? 'chip-selected' : ''}`}
              >
                周{['一', '二', '三', '四', '五'][day - 1]}
              </button>
            ))}
          </div>

          {hasFilters ? (
            <button type="button" onClick={resetFilters} className="btn-ghost ml-auto h-8 px-2 text-[10px]">
              <RotateCcw className="size-3" />
              重置筛选
            </button>
          ) : null}
        </div>
      </div>

      <section className="surface mt-4 p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex size-8 items-center justify-center rounded-xl bg-sun-50 text-sun-700">
                <SlidersHorizontal className="size-4" />
              </span>
              <div>
                <h2 className="text-sm font-semibold text-ink-900">偏好排序</h2>
                <p className="mt-0.5 text-[10px] text-ink-400">
                  {q.trim()
                    ? '对检索结果中的教学班按教师四维公开均分加权排序'
                    : '先搜索或选择一门课程，再按你的偏好比较同课程的教学班'}
                </p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPreferencesOn((value) => !value)}
              aria-pressed={preferencesOn}
              className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-[10px] font-semibold transition ${
                preferencesOn
                  ? 'border-jade-200 bg-jade-50 text-jade-700'
                  : 'border-line bg-paper text-ink-400'
              }`}
            >
              <span className={`size-1.5 rounded-full ${preferencesOn ? 'bg-jade-500' : 'bg-ink-300'}`} />
              {preferencesOn ? '已开启' : '已关闭'}
            </button>
            <button
              type="button"
              onClick={resetWeights}
              className="btn-ghost h-8 px-2 text-[10px]"
            >
              <RotateCcw className="size-3" />
              重置权重
            </button>
          </div>
        </div>

        <div className="mt-3.5 grid gap-3 sm:grid-cols-2">
          {SCORE_DIMENSIONS.map((dimension, index) => {
            const accent = ['accent-jade-600', 'accent-water-500', 'accent-sun-600', 'accent-jade-500'][index]!;
            return (
              <label key={dimension.key} className="rounded-xl border border-line/70 bg-paper/45 px-3 py-2.5">
                <span className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-medium text-ink-700">{dimension.label}</span>
                  <span className="text-[10px] font-semibold text-jade-700">{weights[dimension.key]}%</span>
                </span>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={5}
                  value={weights[dimension.key]}
                  onChange={(event) =>
                    setWeights((previous) => ({
                      ...previous,
                      [dimension.key]: Number(event.target.value),
                    }))
                  }
                  className={`mt-2 h-1.5 w-full cursor-pointer ${accent}`}
                  aria-label={`${dimension.label}偏好权重`}
                />
                <span className="mt-1 flex justify-between text-[9px] text-ink-400">
                  <span>{dimension.low}</span>
                  <span>{dimension.high}</span>
                </span>
              </label>
            );
          })}
        </div>

        <div className="mt-3 flex items-start gap-1.5 rounded-xl bg-paper/60 px-3 py-2 text-[9px] leading-relaxed text-ink-400">
          <Info className="mt-0.5 size-3 shrink-0" />
          <span>
            偏好排序不调用 AI，不改变原始评分，也不把缺失维度补成 0 分。样本不足的教师不参与加权排序，会排在有分数据之后。
          </span>
        </div>
      </section>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-2 px-1">
        <div className="flex items-center gap-2 text-[11px] text-ink-500">
          <Sparkles className="size-3.5 text-jade-600" />
          <strong className="font-semibold text-ink-800">
            {sections.loading ? '正在查询教学班…' : `找到 ${sections.total} 个教学班`}
          </strong>
          {canRank ? (
            <span className="rounded-full bg-jade-50 px-2 py-0.5 text-[10px] text-jade-700">按偏好排序</span>
          ) : (
            <span className="rounded-full bg-paper px-2 py-0.5 text-[10px] text-ink-400">默认顺序</span>
          )}
        </div>
        <span className="text-[10px] text-ink-400">开课数据为来源快照 · 不代表实时余量</span>
      </div>

      <div className="mt-3">
        {sections.loading ? (
          <div className="space-y-3">
            <LoadingBlock className="h-44" />
            <LoadingBlock className="h-44" />
            <LoadingBlock className="h-44" />
          </div>
        ) : sections.error && sections.items.length === 0 ? (
          <ErrorState message={sections.error} onRetry={sections.reload} />
        ) : rankedSections.length === 0 ? (
          <EmptyState
            title="没有找到匹配的教学班"
            description={
              q
                ? `本学期没有课程或教师在当前筛选条件下匹配“${q}”。可以尝试热门课程标签，或清空学院、校区与日期筛选。`
                : '当前筛选条件下没有教学班，试试清空筛选。'
            }
            icon={<CalendarDays className="size-5" />}
            action={
              hasFilters ? (
                <button type="button" onClick={resetFilters} className="btn-secondary h-9 px-4 text-xs">
                  清空全部筛选
                </button>
              ) : null
            }
          />
        ) : (
          <>
            {sections.error ? (
              <div className="mb-3">
                <InlineError message={sections.error} onRetry={sections.reload} />
              </div>
            ) : null}

            <div className="space-y-3">
              {rankedSections.map(({ section, percent }, index) => (
                <SectionCard
                  key={section.id}
                  section={section}
                  matchPercent={canRank ? percent : null}
                  rank={canRank ? index + 1 : undefined}
                />
              ))}
            </div>

            <div className="mt-6 flex flex-col items-center gap-2">
              {sections.hasMore ? (
                <button
                  type="button"
                  onClick={sections.loadMore}
                  disabled={sections.loadingMore}
                  className="btn-secondary h-10 min-w-40 px-5 text-xs"
                >
                  {sections.loadingMore ? (
                    <>
                      <LoaderCircle className="size-3.5 animate-spin" />
                      正在加载
                    </>
                  ) : (
                    '加载更多教学班'
                  )}
                </button>
              ) : (
                <span className="text-[10px] text-ink-400">已显示全部 {sections.total} 个教学班</span>
              )}
            </div>
          </>
        )}
      </div>

      <div className="mt-8 rounded-2xl border border-dashed border-line-strong bg-white/45 p-4 text-[11px] leading-relaxed text-ink-400">
        <p className="font-medium text-ink-600">开课信息的边界</p>
        <ul className="mt-1.5 space-y-1">
          <li>课程、教学班、教师与上课时间是不同实体；同一门课的多段时间不会被算成多门课程。</li>
          <li>时间未知时显示“时间待定”，系统不会据此判定“无冲突”。</li>
          <li>容量是来源快照，页面不承诺实时余量；同名教师与课程映射仍需人工确认。</li>
        </ul>
      </div>
    </div>
  );
}
