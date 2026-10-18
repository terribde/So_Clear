import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  PUBLIC_PATHS,
  SCORE_DIMENSIONS,
  type PublicReviewDTO,
  type SectionDTO,
  type TeacherPublicDTO,
  type TeacherSummaryDTO,
} from '@soclear/contracts';
import {
  AlertCircle,
  ArrowLeft,
  ArrowLeftRight,
  ArrowUpRight,
  BadgeCheck,
  BookOpenText,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Fingerprint,
  Flag,
  Info,
  LoaderCircle,
  MapPin,
  MessageSquareText,
  PenLine,
  Quote,
  ShieldCheck,
  Sparkles,
  Star,
} from 'lucide-react';
import { RadarChart } from '../components/RadarChart';
import { RatingBadge } from '../components/RatingBadge';
import { ReportModal } from '../components/ReportModal';
import { ReviewEntryModal } from '../components/ReviewEntryModal';
import {
  DetailSkeleton,
  EmptyState,
  ErrorState,
  InlineError,
  LoadingBlock,
} from '../components/States';
import { useToast } from '../components/Toast';
import { useApiResource, usePaginatedApi } from '../features/api/hooks';
import {
  formatDate,
  formatMeeting,
  formatScore,
  initials,
  pageTitle,
} from '../lib/format';

export function TeacherDetailPage() {
  const { teacherId } = useParams<{ teacherId: string }>();
  const toast = useToast();
  const [reviewOpen, setReviewOpen] = useState(false);
  const [reportTarget, setReportTarget] = useState<PublicReviewDTO | null>(null);

  const teacher = useApiResource<TeacherPublicDTO>(
    teacherId ? PUBLIC_PATHS.teacher(teacherId) : null,
  );
  const summary = useApiResource<TeacherSummaryDTO>(
    teacherId ? PUBLIC_PATHS.teacherSummary(teacherId) : null,
  );
  const reviews = usePaginatedApi<PublicReviewDTO>(
    PUBLIC_PATHS.teacherReviews(teacherId ?? 'missing'),
    {},
    Boolean(teacherId),
    8,
  );
  const sections = usePaginatedApi<SectionDTO>(
    PUBLIC_PATHS.sections,
    { teacherId: teacherId ?? '' },
    Boolean(teacherId),
    10,
  );

  useEffect(() => {
    if (teacher.data) {
      document.title = pageTitle(`${teacher.data.name} · ${teacher.data.department.name}`);
    } else {
      document.title = pageTitle('教师详情');
    }
  }, [teacher.data]);

  if (teacher.loading) return <DetailSkeleton />;

  if (teacher.error || !teacher.data) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
        <BackLink />
        <div className="mt-6">
          <ErrorState message={teacher.error ?? '没有找到这位教师的公开档案。'} onRetry={teacher.reload} />
        </div>
      </div>
    );
  }

  const data = teacher.data;
  const rating = data.ratingSummary;
  const summaryData = summary.data;

  const scrollToReview = (reviewId: string) => {
    const target = document.getElementById(`review-${reviewId}`);
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    toast('这条来源暂时不在当前分页中，请先加载更多公开评价。', 'info');
  };

  return (
    <div className="mx-auto max-w-6xl px-4 pb-14 pt-6 sm:px-6 sm:pt-8">
      <BackLink />

      <div className="mt-4 grid gap-5 lg:grid-cols-12">
        <div className="space-y-5 lg:col-span-8">
          <section className="surface relative overflow-hidden p-5 sm:p-6">
            <div className="pointer-events-none absolute -right-16 -top-20 size-56 rounded-full bg-jade-50/80" />
            <div className="pointer-events-none absolute -right-4 -top-8 size-32 rounded-full border border-jade-100/80" />
            <div className="relative">
              <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-start">
                <div className="flex min-w-0 items-start gap-4">
                  <span className="flex size-16 shrink-0 items-center justify-center rounded-[22px] bg-gradient-to-br from-jade-600 to-jade-800 text-2xl font-bold text-white shadow-[0_16px_30px_-20px_rgba(18,70,56,0.9)]">
                    {initials(data.name)}
                  </span>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
                      <h1 className="text-2xl font-bold tracking-tight text-ink-950 sm:text-3xl">
                        {data.name}
                      </h1>
                      <span className="rounded-full border border-line bg-white px-2 py-0.5 text-[10px] font-medium text-ink-500">
                        {data.title}
                      </span>
                      {data.isTeachingThisTerm ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-jade-50 px-2 py-0.5 text-[10px] font-medium text-jade-700 ring-1 ring-inset ring-jade-100">
                          <CheckCircle2 className="size-3" />
                          本学期开课
                        </span>
                      ) : (
                        <span className="rounded-full bg-paper px-2 py-0.5 text-[10px] text-ink-400">
                          本学期未开课
                        </span>
                      )}
                    </div>
                    <p className="mt-1.5 text-xs text-ink-500">
                      {data.department.name}
                      {data.campuses.length ? ` · ${data.campuses.join(' / ')}` : ''}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {data.tags.map((tag) => (
                        <span key={tag} className="tag">
                          #{tag}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
                <RatingBadge summary={rating} size="lg" />
              </div>

              <div className="mt-5 grid grid-cols-3 gap-2 rounded-2xl border border-line/70 bg-paper/55 p-3">
                <div>
                  <p className="stat-label">本学期教学班</p>
                  <p className="mt-1 text-sm font-semibold text-ink-900">
                    {data.currentSectionCount} 个
                  </p>
                </div>
                <div className="border-l border-line/70 pl-3">
                  <p className="stat-label">主讲课程</p>
                  <p className="mt-1 text-sm font-semibold text-ink-900">{data.courses.length} 门</p>
                </div>
                <div className="border-l border-line/70 pl-3">
                  <p className="stat-label">档案更新</p>
                  <p className="mt-1 text-sm font-semibold text-ink-900">{formatDate(data.updatedAt)}</p>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setReviewOpen(true)}
                  className="btn-primary h-10 px-4 text-xs"
                >
                  <PenLine className="size-3.5" />
                  写一条评价
                </button>
                <Link
                  to={`/courses?q=${encodeURIComponent(data.courses[0]?.name ?? '')}`}
                  className="btn-secondary h-10 px-4 text-xs"
                >
                  <CalendarDays className="size-3.5 text-jade-600" />
                  查看本学期开课
                </Link>
                <Link
                  to={`/compare?ids=${encodeURIComponent(data.id)}`}
                  className="btn-secondary h-10 px-4 text-xs"
                >
                  <ArrowLeftRight className="size-3.5 text-jade-600" />
                  加入对比
                </Link>
                <span className="text-[10px] text-ink-400">
                  提交后需人工审核，作者不会随评价公开展示
                </span>
              </div>
            </div>
          </section>

          <section className="surface p-5 sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="eyebrow">RATING SUMMARY</p>
                <h2 className="mt-1.5 text-xl font-bold tracking-tight text-ink-950">四维评分</h2>
              </div>
              <div className="text-right text-[10px] leading-relaxed text-ink-400">
                {rating.eligible ? (
                  <>
                    <p>统计 {rating.publishedCount} 条当前公开评价</p>
                    <p>更新于 {formatDate(rating.statsUpdatedAt)}</p>
                  </>
                ) : (
                  <p>样本达到 {rating.minSamples} 条后才展示综合分</p>
                )}
              </div>
            </div>

            {rating.eligible && rating.scores ? (
              <div className="mt-4 grid items-center gap-3 sm:grid-cols-[1.15fr_0.85fr]">
                <RadarChart scores={rating.scores} />
                <div className="space-y-3">
                  {SCORE_DIMENSIONS.map((dimension) => (
                    <div key={dimension.key}>
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-[11px] font-medium text-ink-700">{dimension.label}</span>
                        <span className="text-xs font-semibold text-jade-700">
                          {formatScore(rating.scores?.[dimension.key])}
                        </span>
                      </div>
                      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-paper-deep">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-jade-300 to-jade-600"
                          style={{ width: `${((rating.scores?.[dimension.key] ?? 0) / 5) * 100}%` }}
                        />
                      </div>
                      <p className="mt-1 text-[10px] leading-relaxed text-ink-400">{dimension.description}</p>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="mt-4 rounded-2xl border border-dashed border-line-strong bg-paper/45 p-5 text-center">
                <span className="mx-auto flex size-10 items-center justify-center rounded-2xl bg-white text-ink-400 ring-1 ring-inset ring-line">
                  <ShieldCheck className="size-5" />
                </span>
                <p className="mt-3 text-sm font-semibold text-ink-800">样本不足，暂不显示综合分</p>
                <p className="mx-auto mt-1 max-w-sm text-[11px] leading-relaxed text-ink-500">
                  当前有 {rating.publishedCount} 条公开评价，至少需要 {rating.minSamples} 条。我们不会把未知评分补成
                  0 分，也不会用一两条体验代表整门课。
                </p>
                <div className="mx-auto mt-4 h-1.5 max-w-xs overflow-hidden rounded-full bg-white">
                  <div
                    className="h-full rounded-full bg-jade-500"
                    style={{ width: `${Math.min(100, (rating.publishedCount / rating.minSamples) * 100)}%` }}
                  />
                </div>
                <p className="mt-2 text-[10px] text-ink-400">
                  {rating.publishedCount} / {rating.minSamples} 条公开评价
                </p>
              </div>
            )}

            {rating.eligible ? (
              <p className="mt-4 rounded-xl bg-paper/60 px-3.5 py-2.5 text-[10px] leading-relaxed text-ink-500">
                综合分是四个维度的算术平均值，不是“最佳/最差”排行；难度、作业量与点名情况只作描述性展示，不参与总分。
              </p>
            ) : null}
          </section>

          <section className="surface p-5 sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="eyebrow">SUMMARY · 本地演示</p>
                <h2 className="mt-1.5 flex flex-wrap items-center gap-2 text-xl font-bold tracking-tight text-ink-950">
                  <Sparkles className="size-4 text-jade-600" />
                  评价摘要
                  <span className="rounded-full bg-sun-50 px-2 py-0.5 text-[9px] font-medium text-sun-700">
                    本地演示 · 非平台 AI
                  </span>
                </h2>
              </div>
              <SummaryState state={summaryData?.state} loading={summary.loading} />
            </div>

            {summary.loading ? (
              <div className="mt-4 space-y-2.5">
                <LoadingBlock className="h-3.5 w-full" />
                <LoadingBlock className="h-3.5 w-[92%]" />
                <LoadingBlock className="h-3 w-[72%]" />
              </div>
            ) : summary.error ? (
              <div className="mt-4">
                <InlineError message={summary.error} onRetry={summary.reload} />
              </div>
            ) : summaryData?.state === 'ready' ? (
              <div className="mt-4">
                <div className="flex flex-wrap items-center gap-2 text-[10px] text-ink-400">
                  <span className="rounded-full bg-jade-50 px-2 py-0.5 font-medium text-jade-700">
                    {summaryData.sampleCount} 条来源评价
                  </span>
                  <span>{summaryData.scope.description}</span>
                  {summaryData.generatedAt ? <span>生成于 {formatDate(summaryData.generatedAt)}</span> : null}
                </div>

                <div className="mt-3.5 space-y-3.5">
                  {summaryData.sentences.map((sentence) => (
                    <div key={sentence.text} className="relative rounded-2xl bg-gradient-to-br from-jade-50/70 to-paper/45 px-4 py-3.5">
                      <Quote className="absolute left-3 top-3 size-4 text-jade-200" />
                      <p className="pl-5 text-[12px] leading-relaxed text-ink-700">{sentence.text}</p>
                      <div className="mt-2 flex flex-wrap items-center gap-1.5 pl-5">
                        <span className="text-[9px] text-ink-400">来源</span>
                        {sentence.citations.map((citation, index) => (
                          <button
                            key={citation}
                            type="button"
                            onClick={() => scrollToReview(citation)}
                            className="rounded-md bg-white px-1.5 py-0.5 text-[9px] font-medium text-jade-700 ring-1 ring-inset ring-jade-100 transition hover:bg-jade-50"
                            title={`查看来源评价 ${citation}`}
                          >
                            {index + 1}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                <p className="mt-3.5 flex items-start gap-1.5 text-[10px] leading-relaxed text-ink-400">
                  <Info className="mt-0.5 size-3 shrink-0" />
                  {summaryData.limitations}
                </p>
              </div>
            ) : summaryData?.state === 'generating' ? (
              <div className="mt-4 flex items-start gap-3 rounded-2xl bg-paper/60 p-4">
                <LoaderCircle className="mt-0.5 size-4 shrink-0 animate-spin text-jade-600" />
                <div>
                  <p className="text-xs font-semibold text-ink-800">摘要已失效，等待重新生成</p>
                  <p className="mt-1 text-[11px] leading-relaxed text-ink-500">
                    公开来源变化后，旧摘要立即停止展示。管理员可在管理工作区用当前公开评价重建本地摘要；重建并通过来源校验前，这里不会恢复展示旧句子。
                  </p>
                </div>
              </div>
            ) : summaryData?.state === 'insufficient' ? (
              <div className="mt-4 flex items-start gap-3 rounded-2xl bg-paper/60 p-4">
                <ShieldCheck className="mt-0.5 size-4 shrink-0 text-ink-400" />
                <div>
                  <p className="text-xs font-semibold text-ink-800">暂未生成摘要</p>
                  <p className="mt-1 text-[11px] leading-relaxed text-ink-500">
                    当前只有 {summaryData.sampleCount} 条公开评价，至少需要 5 条且覆盖足够信息后，才可以生成评价摘要。
                  </p>
                </div>
              </div>
            ) : (
              <div className="mt-4 flex items-start gap-3 rounded-2xl bg-paper/60 p-4">
                <AlertCircle className="mt-0.5 size-4 shrink-0 text-ink-400" />
                <div>
                  <p className="text-xs font-semibold text-ink-800">当前没有可展示的摘要</p>
                  <p className="mt-1 text-[11px] leading-relaxed text-ink-500">
                    摘要需要当前公开来源、完整引用和有效版本同时通过校验。任一项不满足时不返回旧内容。
                  </p>
                </div>
              </div>
            )}
          </section>

          <section className="surface p-5 sm:p-6" id="reviews">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="eyebrow">PUBLISHED REVIEWS</p>
                <h2 className="mt-1.5 flex items-center gap-2 text-xl font-bold tracking-tight text-ink-950">
                  <MessageSquareText className="size-4 text-jade-600" />
                  公开评价
                  <span className="rounded-full bg-paper px-2 py-0.5 text-[10px] font-medium text-ink-400">
                    {reviews.total}
                  </span>
                </h2>
                <p className="mt-1.5 text-[11px] text-ink-500">
                  仅包含当前已发布评价，按发布时间倒序展示。作者固定显示为匿名在校生。
                </p>
              </div>
              <div className="flex items-center gap-1 text-[10px] text-ink-400">
                <Fingerprint className="size-3.5 text-jade-600" />
                作者身份与评价内容分离
              </div>
            </div>

            <div className="mt-4">
              {reviews.loading ? (
                <div className="space-y-3">
                  {[0, 1, 2].map((item) => (
                    <div key={item} className="rounded-2xl border border-line/70 p-4">
                      <div className="flex items-center gap-2">
                        <div className="size-8 animate-pulse rounded-full bg-line/70" />
                        <div className="h-3 w-28 animate-pulse rounded bg-line/70" />
                      </div>
                      <div className="mt-3 h-3 w-full animate-pulse rounded bg-line/50" />
                      <div className="mt-2 h-3 w-4/5 animate-pulse rounded bg-line/40" />
                    </div>
                  ))}
                </div>
              ) : reviews.error && reviews.items.length === 0 ? (
                <ErrorState message={reviews.error} onRetry={reviews.reload} />
              ) : reviews.items.length === 0 ? (
                <EmptyState
                  title="暂无公开评价"
                  description="这位教师还没有通过审核并公开发布的评价。样本不足时不会生成综合分或评价摘要。"
                  icon={<MessageSquareText className="size-5" />}
                />
              ) : (
                <div className="space-y-3">
                  {reviews.error ? (
                    <InlineError message={reviews.error} onRetry={reviews.reload} />
                  ) : null}

                  {reviews.items.map((review) => (
                    <ReviewCard
                      key={review.id}
                      review={review}
                      onReport={() => setReportTarget(review)}
                    />
                  ))}

                  <div className="flex flex-col items-center gap-2 pt-2">
                    {reviews.hasMore ? (
                      <button
                        type="button"
                        onClick={reviews.loadMore}
                        disabled={reviews.loadingMore}
                        className="btn-secondary h-9 min-w-36 px-4 text-[11px]"
                      >
                        {reviews.loadingMore ? (
                          <>
                            <LoaderCircle className="size-3.5 animate-spin" />
                            正在加载
                          </>
                        ) : (
                          '加载更多评价'
                        )}
                      </button>
                    ) : (
                      <span className="text-[10px] text-ink-400">
                        已显示全部 {reviews.total} 条公开评价
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          </section>
        </div>

        <aside className="space-y-4 lg:col-span-4">
          <div className="surface p-5">
            <div className="flex items-center gap-2">
              <span className="flex size-7 items-center justify-center rounded-lg bg-jade-50 text-jade-700">
                <BookOpenText className="size-3.5" />
              </span>
              <h2 className="text-sm font-semibold text-ink-900">主讲课程</h2>
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {data.courses.map((course) => (
                <Link
                  key={course.id}
                  to={`/courses?q=${encodeURIComponent(course.name)}`}
                  className="chip py-1 text-[11px]"
                >
                  {course.name}
                </Link>
              ))}
            </div>
            <Link
              to="/teachers"
              className="mt-4 inline-flex items-center gap-1 text-[10px] font-medium text-jade-700"
            >
              在教师库中继续筛选
              <ArrowUpRight className="size-3" />
            </Link>
          </div>

          <div className="surface p-5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="flex size-7 items-center justify-center rounded-lg bg-water-50 text-water-500">
                  <CalendarDays className="size-3.5" />
                </span>
                <h2 className="text-sm font-semibold text-ink-900">本学期开课</h2>
              </div>
              {!sections.loading ? (
                <span className="text-[10px] text-ink-400">{sections.total} 个教学班</span>
              ) : null}
            </div>

            <div className="mt-3">
              {sections.loading ? (
                <div className="space-y-2">
                  <LoadingBlock className="h-20" />
                  <LoadingBlock className="h-20" />
                </div>
              ) : sections.error ? (
                <InlineError message={sections.error} onRetry={sections.reload} />
              ) : sections.items.length === 0 ? (
                <p className="rounded-xl bg-paper/60 px-3 py-3 text-[11px] leading-relaxed text-ink-500">
                  本学期暂无公开开课记录。这不代表教师不授课，也可能是课表来源尚未更新。
                </p>
              ) : (
                <div className="space-y-2">
                  {sections.items.map((section) => (
                    <div key={section.id} className="rounded-xl border border-line/70 bg-paper/45 p-3">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-[11px] font-semibold text-ink-800">{section.course.name}</p>
                        <span className="shrink-0 font-mono text-[9px] text-ink-400">{section.sectionCode}</span>
                      </div>
                      <div className="mt-1.5 space-y-1">
                        {section.meetings.map((meeting, index) => (
                          <div
                            key={`${section.id}-${index}`}
                            className="flex flex-wrap items-center gap-x-2 text-[10px] text-ink-500"
                          >
                            <span className="inline-flex items-center gap-1">
                              <Clock3 className="size-3 text-jade-500" />
                              {formatMeeting(meeting)}
                            </span>
                            <span className="inline-flex items-center gap-1 text-ink-400">
                              <MapPin className="size-3" />
                              {meeting.location ?? '地点待定'}
                            </span>
                          </div>
                        ))}
                      </div>
                      <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[9px] text-ink-400">
                        <span>{section.campus}</span>
                        <span>·</span>
                        <span>{section.capacity === null ? '容量待定' : `容量 ${section.capacity} 人`}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="surface-soft p-4">
            <div className="flex items-center gap-2 text-xs font-semibold text-ink-800">
              <ShieldCheck className="size-4 text-jade-600" />
              这个页面展示什么
            </div>
            <ul className="mt-2.5 space-y-1.5 text-[10px] leading-relaxed text-ink-500">
              <li>姓名、职称、学院与课程来自教学资料；评价是学生观点，不是对教师能力的事实结论。</li>
              <li>公开评价不展示昵称、邮箱、作者账号或审核人。</li>
              <li>当前使用合成演示数据，未连接学校系统；期末或撤稿后内容会从公开汇总中移除。</li>
            </ul>
            <p className="mt-2.5 border-t border-line/70 pt-2 text-[9px] text-ink-400">
              数据版本 v{data.dataVersion} · 档案更新 {formatDate(data.updatedAt)}
            </p>
          </div>

          <div className="rounded-2xl border border-dashed border-line-strong bg-white/40 p-4">
            <div className="flex items-center gap-2 text-[11px] font-semibold text-ink-700">
              <BadgeCheck className="size-3.5 text-jade-600" />
              想补充一条真实体验？
            </div>
            <p className="mt-1.5 text-[10px] leading-relaxed text-ink-400">
              本地演示已开放提交：需要登录并具备演示学生资格，通过人工审核后才会进入本页的公开样本。
            </p>
            <button
              type="button"
              onClick={() => setReviewOpen(true)}
              className="mt-2.5 inline-flex items-center gap-1 text-[10px] font-semibold text-jade-700"
            >
              打开评价表单
              <ArrowUpRight className="size-3" />
            </button>
          </div>
        </aside>
      </div>

      <ReviewEntryModal
        open={reviewOpen}
        onClose={() => setReviewOpen(false)}
        teacher={data}
      />
      <ReportModal
        open={Boolean(reportTarget)}
        onClose={() => setReportTarget(null)}
        review={reportTarget}
        teacherName={data.name}
      />
    </div>
  );
}

function BackLink() {
  return (
    <Link
      to="/teachers"
      className="inline-flex items-center gap-1.5 text-[11px] font-medium text-ink-500 transition hover:text-jade-700"
    >
      <ArrowLeft className="size-3.5" />
      返回教师库
    </Link>
  );
}

function SummaryState({
  state,
  loading,
}: {
  state?: TeacherSummaryDTO['state'];
  loading: boolean;
}) {
  if (loading) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-paper px-2.5 py-1 text-[9px] text-ink-400">
        <LoaderCircle className="size-3 animate-spin" />
        正在检查来源
      </span>
    );
  }
  const labels: Record<TeacherSummaryDTO['state'], string> = {
    ready: '来源有效',
    insufficient: '样本不足',
    generating: '生成中',
    unavailable: '暂不可用',
  };
  if (!state) return null;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[9px] font-medium ${
        state === 'ready'
          ? 'bg-jade-50 text-jade-700'
          : state === 'generating'
            ? 'bg-water-50 text-water-500'
            : 'bg-paper text-ink-400'
      }`}
    >
      <span className="size-1 rounded-full bg-current" />
      {labels[state]}
    </span>
  );
}

function ReviewCard({
  review,
  onReport,
}: {
  review: PublicReviewDTO;
  onReport: () => void;
}) {
  const reviewOverall =
    SCORE_DIMENSIONS.reduce((sum, dimension) => sum + review.scores[dimension.key], 0) /
    SCORE_DIMENSIONS.length;

  return (
    <article
      id={`review-${review.id}`}
      className="scroll-mt-24 rounded-2xl border border-line/80 bg-white p-4 transition hover:border-jade-100"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <span className="flex size-8 items-center justify-center rounded-full bg-jade-50 text-jade-600">
            <Fingerprint className="size-3.5" />
          </span>
          <div>
            <p className="text-[11px] font-semibold text-ink-800">匿名在校生</p>
            <p className="mt-0.5 text-[10px] text-ink-400">
              {review.term.label} · {review.course.name} · {formatDate(review.publishedAt)}
            </p>
          </div>
        </div>
        <span className="inline-flex items-center gap-1 rounded-full bg-sun-50 px-2 py-1 text-[10px] font-semibold text-sun-700">
          <Star className="size-2.5 fill-sun-500 text-sun-600" />
          {reviewOverall.toFixed(1)}
        </span>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-1.5 sm:grid-cols-4">
        {SCORE_DIMENSIONS.map((dimension) => (
          <div
            key={dimension.key}
            className="rounded-lg border border-line/60 bg-paper/50 px-2 py-1"
            title={`${dimension.label} ${formatScore(review.scores[dimension.key])} 分`}
          >
            <span className="block text-[9px] text-ink-400">{dimension.label}</span>
            <span className="mt-0.5 block text-[11px] font-semibold text-jade-700">
              {formatScore(review.scores[dimension.key])}
            </span>
          </div>
        ))}
      </div>

      {review.comment ? (
        <p className="mt-3 text-[12px] leading-relaxed text-ink-700 whitespace-pre-wrap">
          {review.comment}
        </p>
      ) : (
        <p className="mt-3 text-[11px] italic text-ink-400">这条评价只包含维度评分，没有文字说明。</p>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 border-t border-line/60 pt-2.5 text-[9px] text-ink-400">
        <span className="font-medium text-ink-500">描述项（不计入综合分）</span>
        {review.descriptive.difficulty !== null ? (
          <span className="rounded-full bg-paper px-1.5 py-0.5">
            难度 {review.descriptive.difficulty}/5
          </span>
        ) : null}
        {review.descriptive.workload !== null ? (
          <span className="rounded-full bg-paper px-1.5 py-0.5">
            作业量 {review.descriptive.workload}/5
          </span>
        ) : null}
        {review.descriptive.attendance ? (
          <span className="rounded-full bg-paper px-1.5 py-0.5">
            点名 {review.descriptive.attendance}
          </span>
        ) : null}
        <span className="ml-auto">公开修订 v{review.revision}</span>
        <button
          type="button"
          onClick={onReport}
          className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 font-medium text-ink-400 transition hover:bg-rose-50 hover:text-rose-600"
        >
          <Flag className="size-2.5" />
          举报
        </button>
      </div>
    </article>
  );
}
