import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  PUBLIC_PATHS,
  SCORE_DIMENSIONS,
  type ScoreKey,
  type TeacherPublicDTO,
} from '@soclear/contracts';
import {
  ArrowLeftRight,
  ArrowUpRight,
  CheckCircle2,
  ChevronDown,
  Info,
  LoaderCircle,
  UsersRound,
  X,
} from 'lucide-react';
import { PageHeader } from '../components/PageHeader';
import { EmptyState, ErrorState, InlineError } from '../components/States';
import { ApiRequestError, apiRequest, errorMessage } from '../features/api/client';
import { usePaginatedApi } from '../features/api/hooks';
import { formatDate, formatSample, formatScore, initials, pageTitle } from '../lib/format';

const MAX_COMPARE = 3;

function parseCompareIds(raw: string | null): string[] {
  if (!raw) return [];
  const seen = new Set<string>();
  const ids: string[] = [];
  for (const value of raw.split(',')) {
    const id = value.trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    ids.push(id);
    if (ids.length === MAX_COMPARE) break;
  }
  return ids;
}

function bestValue(
  teachers: TeacherPublicDTO[],
  read: (teacher: TeacherPublicDTO) => number | null,
): number | null {
  const eligible = teachers.filter((teacher) => teacher.ratingSummary.eligible);
  if (eligible.length < 2) return null;
  const values = eligible
    .map(read)
    .filter((value): value is number => value !== null);
  if (values.length < 2) return null;
  return Math.max(...values);
}

export function ComparePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const idsParam = searchParams.get('ids');
  const ids = useMemo(() => parseCompareIds(idsParam), [idsParam]);
  const idsKey = ids.join(',');
  const options = usePaginatedApi<TeacherPublicDTO>(
    PUBLIC_PATHS.teachers,
    { sort: 'overall' },
    true,
    50,
  );
  const [teachers, setTeachers] = useState<TeacherPublicDTO[]>([]);
  const [invalidIds, setInvalidIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    document.title = pageTitle('教师对比');
  }, []);

  useEffect(() => {
    if (!idsKey) {
      setTeachers([]);
      setInvalidIds([]);
      setLoading(false);
      setError(null);
      return;
    }

    const controller = new AbortController();
    const currentIds = idsKey.split(',');
    setLoading(true);
    setError(null);

    Promise.allSettled(
      currentIds.map((id) =>
        apiRequest<TeacherPublicDTO>(PUBLIC_PATHS.teacher(id), {
          signal: controller.signal,
        }),
      ),
    ).then((results) => {
      if (controller.signal.aborted) return;
      const loaded: TeacherPublicDTO[] = [];
      const missing: string[] = [];
      let failure: string | null = null;
      results.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          loaded.push(result.value.data);
          return;
        }
        missing.push(currentIds[index]!);
        if (!(result.reason instanceof ApiRequestError) || result.reason.status !== 404) {
          failure = errorMessage(result.reason);
        }
      });
      setTeachers(loaded);
      setInvalidIds(missing);
      setError(failure);
      setLoading(false);
    });

    return () => controller.abort();
  }, [idsKey, version]);

  const updateSelection = (nextIds: string[]) => {
    const next = new URLSearchParams(searchParams);
    if (nextIds.length > 0) next.set('ids', nextIds.join(','));
    else next.delete('ids');
    setSearchParams(next, { replace: true });
  };

  const updateSlot = (index: number, teacherId: string) => {
    const next = [...ids];
    if (!teacherId) {
      next.splice(index, 1);
    } else if (index < next.length) {
      next[index] = teacherId;
    } else {
      next.push(teacherId);
    }
    updateSelection([...new Set(next)].slice(0, MAX_COMPARE));
  };

  const scored = teachers.filter(
    (teacher) => teacher.ratingSummary.eligible && teacher.ratingSummary.scores,
  );
  const bestOverall = bestValue(teachers, (teacher) => teacher.ratingSummary.overall);
  const bestDimensions = Object.fromEntries(
    SCORE_DIMENSIONS.map((dimension) => [
      dimension.key,
      bestValue(teachers, (teacher) => teacher.ratingSummary.scores?.[dimension.key] ?? null),
    ]),
  ) as Record<ScoreKey, number | null>;

  return (
    <div className="mx-auto max-w-6xl px-4 pb-14 pt-8 sm:px-6 sm:pt-10">
      <PageHeader
        eyebrow="COMPARE / 教师对比"
        title="把候选教师放在一起看"
        description="最多选择 3 位教师，对比公开的四维评分、样本量、课程与开课状态。低于样本门槛的教师不会被强行打分，也不参与“最高分”比较。"
        action={
          <Link to="/teachers" className="btn-secondary h-9 px-3.5 text-[11px]">
            <UsersRound className="size-3.5 text-jade-600" />
            返回教师库
          </Link>
        }
      />

      <section className="surface mt-6 p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-xs font-semibold text-ink-900">选择对比教师</p>
            <p className="mt-0.5 text-[10px] leading-relaxed text-ink-400">
              最多 3 位；至少选择 2 位才会标记各项最高分。选择结果会写入当前链接，可直接分享。
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-paper px-2.5 py-1 text-[10px] text-ink-500">
              已选 {ids.length} / {MAX_COMPARE}
            </span>
            {ids.length > 0 ? (
              <button
                type="button"
                onClick={() => updateSelection([])}
                className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] text-ink-400 transition hover:bg-rose-50 hover:text-rose-600"
              >
                <X className="size-3" />
                清空
              </button>
            ) : null}
          </div>
        </div>

        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          {Array.from({ length: MAX_COMPARE }, (_, index) => {
            const current = ids[index] ?? '';
            const disabled = options.loading || index > ids.length;
            return (
              <label key={index} className="relative flex items-center">
                <span className="sr-only">第 {index + 1} 位对比教师</span>
                <select
                  value={current}
                  onChange={(event) => updateSlot(index, event.target.value)}
                  disabled={disabled}
                  className="select-field h-10 w-full py-0 pl-3 pr-8 text-[11px] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <option value="">
                    {index === 0 ? '选择第一位教师' : `可选第 ${index + 1} 位教师`}
                  </option>
                  {options.items
                    .filter((teacher) => !ids.includes(teacher.id) || teacher.id === current)
                    .map((teacher) => (
                      <option key={teacher.id} value={teacher.id}>
                        {teacher.name} · {teacher.department.name.replace('学院', '')}
                      </option>
                    ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 size-3.5 text-ink-400" />
              </label>
            );
          })}
        </div>

        {options.loading ? (
          <p className="mt-2 flex items-center gap-1.5 text-[10px] text-ink-400">
            <LoaderCircle className="size-3 animate-spin" />
            正在加载教师列表
          </p>
        ) : options.error ? (
          <div className="mt-2">
            <InlineError message={options.error} onRetry={options.reload} />
          </div>
        ) : null}

        {invalidIds.length > 0 ? (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-sun-100 bg-sun-50/70 px-3 py-2 text-[10px] leading-relaxed text-sun-800">
            <span>
              有 {invalidIds.length} 位教师无法加载，可能已不存在；当前对比已忽略这些条目。
            </span>
            <button
              type="button"
              onClick={() => updateSelection(teachers.map((teacher) => teacher.id))}
              className="font-semibold underline-offset-2 transition hover:underline"
            >
              移除无效项
            </button>
          </div>
        ) : null}
      </section>

      {error ? (
        <div className="mt-4">
          <ErrorState message={error} onRetry={() => setVersion((value) => value + 1)} />
        </div>
      ) : loading ? (
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((item) => (
            <div key={item} className="surface p-5">
              <div className="h-4 w-28 animate-pulse rounded bg-line/70" />
              <div className="mt-3 h-3 w-40 animate-pulse rounded bg-line/50" />
              <div className="mt-5 h-24 animate-pulse rounded-2xl bg-line/40" />
            </div>
          ))}
        </div>
      ) : ids.length === 0 ? (
        <div className="mt-4">
          <EmptyState
            title="还没有选择对比教师"
            description="从上方选择教师开始；也可以先在教师库按学院、课程或标签筛选，再回来对比。"
            icon={<ArrowLeftRight className="size-5" />}
            action={
              <Link to="/teachers" className="btn-secondary h-9 px-4 text-xs">
                去教师库挑选
              </Link>
            }
          />
        </div>
      ) : teachers.length === 0 ? (
        <div className="mt-4">
          <EmptyState
            title="所选教师无法访问"
            description="这些教师可能已从公开教师库移除。清空选择后重新挑选即可。"
            icon={<ArrowLeftRight className="size-5" />}
            action={
              <button
                type="button"
                onClick={() => updateSelection([])}
                className="btn-secondary h-9 px-4 text-xs"
              >
                清空选择
              </button>
            }
          />
        </div>
      ) : (
        <>
          <div className="mt-4 flex flex-wrap items-center gap-2 px-1 text-[10px] text-ink-400">
            <Info className="size-3 text-jade-600" />
            <span>
              分数只来自当前公开评价；样本不足的教师不参与最高分标记。
              {teachers.length < 2 ? ' 再选择 1 位教师即可横向比较。' : ''}
            </span>
          </div>

          <div className="surface mt-3 overflow-x-auto">
            <table className="w-full min-w-[680px] border-collapse text-left">
              <thead>
                <tr className="border-b border-line">
                  <th
                    scope="col"
                    className="sticky left-0 z-10 w-28 bg-white px-4 py-4 text-[10px] font-medium text-ink-400 sm:w-32"
                  >
                    对比项
                  </th>
                  {teachers.map((teacher) => (
                    <th
                      key={teacher.id}
                      scope="col"
                      className="min-w-44 border-l border-line/60 px-4 py-4 align-top"
                    >
                      <div className="flex items-center gap-2.5">
                        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-jade-50 text-sm font-bold text-jade-700 ring-1 ring-inset ring-jade-100">
                          {initials(teacher.name)}
                        </span>
                        <div className="min-w-0">
                          <Link
                            to={`/teachers/${teacher.id}`}
                            className="inline-flex items-center gap-1 text-sm font-bold text-ink-950 transition hover:text-jade-700"
                          >
                            {teacher.name}
                            <ArrowUpRight className="size-3" />
                          </Link>
                          <p className="mt-0.5 text-[10px] text-ink-400">
                            {teacher.title} · {teacher.department.name}
                          </p>
                        </div>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-1">
                        {teacher.isTeachingThisTerm ? (
                          <span className="inline-flex items-center gap-0.5 rounded-full bg-jade-50 px-1.5 py-0.5 text-[9px] font-medium text-jade-700 ring-1 ring-inset ring-jade-100">
                            <CheckCircle2 className="size-2.5" />
                            本学期 {teacher.currentSectionCount} 个教学班
                          </span>
                        ) : (
                          <span className="rounded-full bg-paper px-1.5 py-0.5 text-[9px] text-ink-400">
                            本学期未开课
                          </span>
                        )}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-line/60">
                  <th
                    scope="row"
                    className="sticky left-0 z-10 bg-white px-4 py-3 text-left text-[11px] font-medium text-ink-500"
                  >
                    综合分
                  </th>
                  {teachers.map((teacher) => {
                    const summary = teacher.ratingSummary;
                    const isBest =
                      bestOverall !== null &&
                      summary.eligible &&
                      summary.overall === bestOverall;
                    return (
                      <td
                        key={teacher.id}
                        className={`border-l border-line/60 px-4 py-3 align-top ${isBest ? 'bg-jade-50/50' : ''}`}
                      >
                        {summary.eligible ? (
                          <div className="flex flex-wrap items-baseline gap-1.5">
                            <span className="text-2xl font-bold tracking-tight text-ink-950">
                              {formatScore(summary.overall)}
                            </span>
                            <span className="text-[10px] text-ink-400">/ 5</span>
                            {isBest ? (
                              <span className="rounded-full bg-jade-100 px-1.5 py-0.5 text-[8px] font-semibold text-jade-700">
                                最高
                              </span>
                            ) : null}
                          </div>
                        ) : (
                          <span className="rounded-full border border-line bg-paper px-2 py-0.5 text-[10px] font-medium text-ink-400">
                            样本不足，暂不计算
                          </span>
                        )}
                      </td>
                    );
                  })}
                </tr>

                {SCORE_DIMENSIONS.map((dimension) => {
                  const best = bestDimensions[dimension.key];
                  return (
                    <tr key={dimension.key} className="border-b border-line/60">
                      <th
                        scope="row"
                        className="sticky left-0 z-10 bg-white px-4 py-3 text-left"
                      >
                        <span className="block text-[11px] font-medium text-ink-600">
                          {dimension.label}
                        </span>
                        <span className="mt-0.5 block text-[9px] leading-relaxed text-ink-400">
                          {dimension.description}
                        </span>
                      </th>
                      {teachers.map((teacher) => {
                        const value = teacher.ratingSummary.scores?.[dimension.key] ?? null;
                        const isBest =
                          value !== null && best !== null && value === best && scored.length > 1;
                        return (
                          <td
                            key={teacher.id}
                            className={`border-l border-line/60 px-4 py-3 align-top ${isBest ? 'bg-jade-50/50' : ''}`}
                          >
                            {value === null ? (
                              <span className="text-[10px] text-ink-400">暂无</span>
                            ) : (
                              <div className="flex items-center gap-2">
                                <span className="w-7 text-xs font-semibold text-ink-900">
                                  {formatScore(value)}
                                </span>
                                <span className="h-1.5 w-20 overflow-hidden rounded-full bg-paper-deep">
                                  <span
                                    className="block h-full rounded-full bg-jade-500"
                                    style={{ width: `${(value / 5) * 100}%` }}
                                  />
                                </span>
                                {isBest ? (
                                  <span className="rounded-full bg-jade-100 px-1.5 py-0.5 text-[8px] font-semibold text-jade-700">
                                    最高
                                  </span>
                                ) : null}
                              </div>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}

                <tr className="border-b border-line/60">
                  <th
                    scope="row"
                    className="sticky left-0 z-10 bg-white px-4 py-3 text-left text-[11px] font-medium text-ink-500"
                  >
                    公开样本
                  </th>
                  {teachers.map((teacher) => (
                    <td
                      key={teacher.id}
                      className="border-l border-line/60 px-4 py-3 text-[10px] leading-relaxed text-ink-500"
                    >
                      <p>
                        {formatSample(
                          teacher.ratingSummary.publishedCount,
                          teacher.ratingSummary.minSamples,
                        )}
                      </p>
                      <p className="mt-0.5 text-[9px] text-ink-400">
                        统计更新于 {formatDate(teacher.ratingSummary.statsUpdatedAt)}
                      </p>
                    </td>
                  ))}
                </tr>

                <tr className="border-b border-line/60">
                  <th
                    scope="row"
                    className="sticky left-0 z-10 bg-white px-4 py-3 text-left text-[11px] font-medium text-ink-500"
                  >
                    主讲课程
                  </th>
                  {teachers.map((teacher) => (
                    <td
                      key={teacher.id}
                      className="border-l border-line/60 px-4 py-3 align-top"
                    >
                      <div className="flex flex-wrap gap-1">
                        {teacher.courses.map((course) => (
                          <span
                            key={course.id}
                            className="rounded-lg border border-line/80 bg-paper/60 px-2 py-1 text-[10px] text-ink-600"
                          >
                            {course.name}
                          </span>
                        ))}
                        {teacher.courses.length === 0 ? (
                          <span className="text-[10px] text-ink-400">暂无公开课程</span>
                        ) : null}
                      </div>
                    </td>
                  ))}
                </tr>

                <tr className="border-b border-line/60">
                  <th
                    scope="row"
                    className="sticky left-0 z-10 bg-white px-4 py-3 text-left text-[11px] font-medium text-ink-500"
                  >
                    公开标签
                  </th>
                  {teachers.map((teacher) => (
                    <td
                      key={teacher.id}
                      className="border-l border-line/60 px-4 py-3 align-top"
                    >
                      {teacher.tags.length > 0 ? (
                        <div className="flex flex-wrap gap-x-2 gap-y-1">
                          {teacher.tags.map((tag) => (
                            <span key={tag} className="text-[10px] text-jade-700">
                              #{tag}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-[10px] text-ink-400">—</span>
                      )}
                    </td>
                  ))}
                </tr>

                <tr>
                  <th
                    scope="row"
                    className="sticky left-0 z-10 bg-white px-4 py-3 text-left text-[11px] font-medium text-ink-500"
                  >
                    校区
                  </th>
                  {teachers.map((teacher) => (
                    <td
                      key={teacher.id}
                      className="border-l border-line/60 px-4 py-3 text-[10px] leading-relaxed text-ink-500"
                    >
                      {teacher.campuses.length > 0
                        ? teacher.campuses.join(' / ')
                        : '校区待定'}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>

          <p className="mt-3 flex items-start gap-1.5 px-1 text-[10px] leading-relaxed text-ink-400">
            <Info className="mt-0.5 size-3 shrink-0" />
            对比只读取公开教师资料、评分汇总与课程字段，不包含待审评价、作者信息或管理员数据。分数不是对教师能力的事实判断，选课还请结合课程安排与个人目标。
          </p>
        </>
      )}
    </div>
  );
}
