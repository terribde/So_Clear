import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  PUBLIC_PATHS,
  TEACHER_SORTS,
  type DepartmentDTO,
  type TeacherPublicDTO,
  type TeacherSort,
} from '@soclear/contracts';
import {
  ChevronDown,
  Filter,
  LoaderCircle,
  RotateCcw,
  Search,
  Sparkles,
  UsersRound,
  X,
} from 'lucide-react';
import { PageHeader } from '../components/PageHeader';
import { TeacherCard } from '../components/TeacherCard';
import {
  EmptyState,
  ErrorState,
  InlineError,
  TeacherGridSkeleton,
} from '../components/States';
import { useApiResource, usePaginatedApi } from '../features/api/hooks';
import { useDebouncedValue } from '../lib/useDebouncedValue';
import { pageTitle } from '../lib/format';

const sortValues = new Set(TEACHER_SORTS.map((sort) => sort.value));

export function TeachersPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const q = searchParams.get('q') ?? '';
  const departmentId = searchParams.get('dept') ?? '';
  const onlyCurrentTerm = searchParams.get('term') === 'current';
  const requestedSort = searchParams.get('sort');
  const sort: TeacherSort =
    requestedSort && sortValues.has(requestedSort as TeacherSort)
      ? (requestedSort as TeacherSort)
      : 'overall';

  const [searchInput, setSearchInput] = useState(q);
  const debouncedSearch = useDebouncedValue(searchInput, 280);
  const departments = useApiResource<DepartmentDTO[]>(PUBLIC_PATHS.departments);

  const teachers = usePaginatedApi<TeacherPublicDTO>(
    PUBLIC_PATHS.teachers,
    {
      q,
      departmentId: departmentId || undefined,
      term: onlyCurrentTerm ? 'current' : undefined,
      sort,
    },
    true,
    12,
  );

  useEffect(() => {
    document.title = pageTitle('教师库');
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

  const hasFilters = Boolean(q || departmentId || onlyCurrentTerm || requestedSort);
  const selectedDepartment = departments.data?.find((department) => department.id === departmentId);
  const activeSortLabel = TEACHER_SORTS.find((option) => option.value === sort)?.label ?? '综合评分';

  const summaryText = useMemo(() => {
    if (teachers.loading) return '正在检索教师库…';
    if (teachers.error) return '检索未完成';
    return `共找到 ${teachers.total} 位教师`;
  }, [teachers.error, teachers.loading, teachers.total]);

  const resetAll = () => {
    setSearchParams({}, { replace: true });
    setSearchInput('');
  };

  return (
    <div className="mx-auto max-w-6xl px-4 pb-14 pt-8 sm:px-6 sm:pt-10">
      <PageHeader
        eyebrow="TEACHERS / 教师库"
        title="从课程与公开评价认识老师"
        description="按学院、课程与学期检索。只有达到样本门槛才展示四维综合分；评价正文来自人工审核后的公开内容。"
        action={
          <Link to="/guide" className="btn-secondary h-9 px-3.5 text-[11px]">
            <Sparkles className="size-3.5 text-jade-600" />
            评分与审核口径
          </Link>
        }
      />

      <div className="surface mt-6 p-3.5 sm:p-4">
        <div className="relative flex items-center">
          <Search className="pointer-events-none absolute left-3.5 size-4 text-ink-300" />
          <input
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder="搜索教师姓名、课程或标签"
            aria-label="搜索教师"
            className="field h-11 pl-10 pr-10 text-[13px]"
          />
          {searchInput ? (
            <button
              type="button"
              onClick={() => setSearchInput('')}
              className="absolute right-3 flex size-6 items-center justify-center rounded-full text-ink-400 transition hover:bg-paper-deep hover:text-ink-700"
              aria-label="清空搜索"
            >
              <X className="size-3.5" />
            </button>
          ) : null}
        </div>

        <div className="mt-2 flex gap-1.5 overflow-x-auto pb-0.5 md:hidden">
          <button
            type="button"
            onClick={() => updateParam('dept', null)}
            className={`chip shrink-0 py-1 text-[11px] ${!departmentId ? 'chip-selected' : ''}`}
          >
            全部
          </button>
          {departments.data?.map((department) => (
            <button
              key={department.id}
              type="button"
              onClick={() => updateParam('dept', department.id)}
              className={`chip shrink-0 py-1 text-[11px] ${departmentId === department.id ? 'chip-selected' : ''}`}
            >
              {department.name.replace('学院', '')}
            </button>
          ))}
        </div>

        <div className="mt-3 hidden flex-wrap items-center gap-2 border-t border-line/70 pt-3 md:flex">
          <label className="relative flex items-center">
            <span className="sr-only">学院筛选</span>
            <select
              value={departmentId}
              onChange={(event) => updateParam('dept', event.target.value || null)}
              className="select-field h-9 min-w-36 py-0 pl-3.5 pr-9 text-[11px]"
            >
              <option value="">全部学院</option>
              {departments.data?.map((department) => (
                <option key={department.id} value={department.id}>
                  {department.name}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 size-3.5 text-ink-400" />
          </label>

          <button
            type="button"
            onClick={() => updateParam('term', onlyCurrentTerm ? null : 'current')}
            className={`chip h-9 gap-1 px-3 text-[11px] ${onlyCurrentTerm ? 'chip-selected' : ''}`}
            aria-pressed={onlyCurrentTerm}
          >
            仅看本学期
          </button>

          <div className="ml-auto flex items-center gap-2">
            <span className="inline-flex items-center gap-1 text-[10px] text-ink-400">
              <Filter className="size-3" />
              排序
            </span>
            <label className="relative flex items-center">
              <span className="sr-only">排序方式</span>
              <select
                value={sort}
                onChange={(event) => updateParam('sort', event.target.value === 'overall' ? null : event.target.value)}
                className="select-field h-9 min-w-32 py-0 pl-3.5 pr-9 text-[11px]"
              >
                {TEACHER_SORTS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 size-3.5 text-ink-400" />
            </label>

            {hasFilters ? (
              <button
                type="button"
                onClick={resetAll}
                className="btn-ghost h-9 px-2.5 text-[11px]"
              >
                <RotateCcw className="size-3" />
                重置
              </button>
            ) : null}
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-line/60 pt-3 md:hidden">
          <button
            type="button"
            onClick={() => updateParam('term', onlyCurrentTerm ? null : 'current')}
            className={`chip h-8 gap-1 px-2.5 text-[10px] ${onlyCurrentTerm ? 'chip-selected' : ''}`}
            aria-pressed={onlyCurrentTerm}
          >
            仅看本学期
          </button>
          <label className="relative flex items-center">
            <span className="sr-only">排序方式</span>
            <select
              value={sort}
              onChange={(event) => updateParam('sort', event.target.value === 'overall' ? null : event.target.value)}
              className="select-field h-8 min-w-28 py-0 pl-2.5 pr-8 text-[10px]"
            >
              {TEACHER_SORTS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2 size-3 text-ink-400" />
          </label>
          {hasFilters ? (
            <button type="button" onClick={resetAll} className="btn-ghost ml-auto h-8 px-2 text-[10px]">
              <RotateCcw className="size-3" />
              重置
            </button>
          ) : null}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 px-1">
        <div className="flex items-center gap-2 text-[11px] text-ink-500">
          <UsersRound className="size-3.5 text-jade-600" />
          <strong className="font-semibold text-ink-800">{summaryText}</strong>
          {selectedDepartment ? (
            <span className="rounded-full bg-jade-50 px-2 py-0.5 text-[10px] text-jade-700">
              {selectedDepartment.name}
            </span>
          ) : null}
          {onlyCurrentTerm ? (
            <span className="rounded-full bg-jade-50 px-2 py-0.5 text-[10px] text-jade-700">本学期开课</span>
          ) : null}
          {requestedSort ? (
            <span className="hidden rounded-full bg-paper px-2 py-0.5 text-[10px] text-ink-400 sm:inline">
              按{activeSortLabel}
            </span>
          ) : null}
        </div>
        <span className="text-[10px] text-ink-400">合成演示数据 · 公开字段</span>
      </div>

      <div className="mt-3">
        {teachers.loading ? (
          <TeacherGridSkeleton count={6} />
        ) : teachers.error && teachers.items.length === 0 ? (
          <ErrorState message={teachers.error} onRetry={teachers.reload} />
        ) : teachers.items.length === 0 ? (
          <EmptyState
            title="没有找到匹配的教师"
            description={
              q
                ? `没有教师姓名、课程或标签匹配“${q}”。可以缩短关键词、切换到全部学院，或清空筛选后重试。`
                : '当前筛选条件下没有教师，试试清空学院与学期筛选。'
            }
            action={
              hasFilters ? (
                <button type="button" onClick={resetAll} className="btn-secondary h-9 px-4 text-xs">
                  清空全部筛选
                </button>
              ) : null
            }
          />
        ) : (
          <>
            {teachers.error ? (
              <div className="mb-3">
                <InlineError message={teachers.error} onRetry={teachers.reload} />
              </div>
            ) : null}

            <div className="grid gap-3.5 sm:grid-cols-2">
              {teachers.items.map((teacher) => (
                <TeacherCard key={teacher.id} teacher={teacher} />
              ))}
            </div>

            <div className="mt-7 flex flex-col items-center gap-2">
              {teachers.hasMore ? (
                <button
                  type="button"
                  onClick={teachers.loadMore}
                  disabled={teachers.loadingMore}
                  className="btn-secondary h-10 min-w-40 px-5 text-xs"
                >
                  {teachers.loadingMore ? (
                    <>
                      <LoaderCircle className="size-3.5 animate-spin" />
                      正在加载
                    </>
                  ) : (
                    '加载更多教师'
                  )}
                </button>
              ) : (
                <span className="text-[10px] text-ink-400">已显示全部 {teachers.total} 位教师</span>
              )}
              <span className="text-[10px] text-ink-300">
                已显示 {teachers.items.length} / {teachers.total}
              </span>
            </div>
          </>
        )}
      </div>

      <div className="mt-8 rounded-2xl border border-dashed border-line-strong bg-white/45 p-3.5 text-[11px] leading-relaxed text-ink-400">
        <p className="font-medium text-ink-600">关于排序与“暂无数据”</p>
        <p className="mt-1">
          综合分按四个正向维度的算术均值计算。达到 5 条公开评价之前，教师会排在有分数据教师之后，界面不会把未知评分当成 0
          分。学院与课程名称来自教学资料，评分与文字来自学生评价，两者在页面中明确区分。
        </p>
      </div>
    </div>
  );
}
