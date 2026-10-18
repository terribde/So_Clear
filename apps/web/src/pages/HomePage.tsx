import { useEffect, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import {
  PUBLIC_PATHS,
  SCORE_DIMENSIONS,
  SITE_POETRY,
  SITE_TAGLINE,
  type OverviewDTO,
  type TeacherPublicDTO,
  type TeacherSummaryDTO,
} from '@soclear/contracts';
import {
  ArrowRight,
  BadgeCheck,
  BookOpenText,
  CalendarDays,
  CheckCircle2,
  Fingerprint,
  Layers3,
  MessageSquareQuote,
  PenLine,
  Quote,
  Scale,
  ShieldCheck,
  Sparkles,
  UsersRound,
} from 'lucide-react';
import { SearchHero } from '../components/SearchHero';
import { TeacherCard } from '../components/TeacherCard';
import { SectionHeading } from '../components/PageHeader';
import { ErrorState, LoadingBlock, TeacherGridSkeleton } from '../components/States';
import { useApiResource, usePaginatedApi } from '../features/api/hooks';
import { formatDate, pageTitle } from '../lib/format';

export function HomePage() {
  const overview = useApiResource<OverviewDTO>(PUBLIC_PATHS.overview);
  const featured = usePaginatedApi<TeacherPublicDTO>(PUBLIC_PATHS.teachers, { sort: 'overall' }, true, 4);
  const topTeacher = featured.items[0];
  const summary = useApiResource<TeacherSummaryDTO>(
    topTeacher ? PUBLIC_PATHS.teacherSummary(topTeacher.id) : null,
  );

  useEffect(() => {
    document.title = pageTitle();
  }, []);

  const data = overview.data;

  return (
    <>
      <section className="relative overflow-hidden">
        <div className="hero-wash pointer-events-none absolute inset-0" />
        <div className="grid-paper pointer-events-none absolute inset-x-0 top-0 h-[30rem] opacity-60" />
        <div className="pointer-events-none absolute -right-28 top-10 hidden size-[26rem] rounded-full border border-jade-200/40 lg:block" />
        <div className="pointer-events-none absolute -right-10 top-28 hidden size-[18rem] rounded-full border border-jade-200/35 lg:block" />
        <div className="pointer-events-none absolute -left-24 top-64 hidden size-[20rem] rounded-full border border-water-100 lg:block" />

        <div className="relative mx-auto max-w-6xl px-4 pb-10 pt-11 sm:px-6 sm:pt-16 lg:pb-14">
          <div className="animate-rise mx-auto max-w-3xl text-center">
            <div className="flex justify-center">
              <span className="inline-flex items-center gap-2 rounded-full border border-line/80 bg-white/65 px-3 py-1.5 text-[10px] font-medium tracking-[0.08em] text-ink-500 shadow-[0_1px_2px_rgba(11,23,19,0.03)] backdrop-blur">
                <span className="size-1.5 rounded-full bg-jade-500" />
                西南交通大学 · 教师评价与课程查询
                <span className="rounded-full bg-paper px-1.5 py-0.5 text-[9px] text-ink-400">合成演示</span>
              </span>
            </div>

            <h1 className="brand-serif mt-6 text-[52px] font-bold leading-none tracking-[0.1em] text-ink-950 sm:text-[76px] lg:text-[86px]">
              清如许
            </h1>
            <p className="mt-4 text-sm font-medium tracking-wide text-ink-600 sm:text-base">
              {SITE_TAGLINE}
            </p>
            <p className="brand-serif mt-2 text-[11px] tracking-[0.14em] text-ink-400 sm:text-xs">
              {SITE_POETRY}
            </p>

            <div className="mt-8 text-left sm:mt-10">
              <SearchHero />
            </div>

            <div className="mt-5 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-[10px] text-ink-400 sm:text-[11px]">
              <span className="inline-flex items-center gap-1.5">
                <ShieldCheck className="size-3.5 text-jade-600" />
                公开评价达到 5 条才显示综合分
              </span>
              <span className="hidden size-1 rounded-full bg-ink-300 sm:block" />
              <span className="inline-flex items-center gap-1.5">
                <Layers3 className="size-3.5 text-jade-600" />
                教学资料与主观评价分开呈现
              </span>
              <span className="hidden size-1 rounded-full bg-ink-300 sm:block" />
              <span className="inline-flex items-center gap-1.5">
                <Fingerprint className="size-3.5 text-jade-600" />
                评价匿名展示，治理可追溯
              </span>
            </div>
          </div>

          <div className="animate-rise-delay mt-10 grid grid-cols-2 gap-2.5 sm:gap-3.5 lg:grid-cols-4">
            <EntryCard
              to="/teachers"
              icon={<UsersRound className="size-5" />}
              title="教师库"
              description="按学院与课程筛选"
              tone="jade"
            />
            <EntryCard
              to="/courses"
              icon={<CalendarDays className="size-5" />}
              title="课程与开课"
              description="时间、校区与容量"
              tone="sky"
            />
            <EntryCard
              to="/guide"
              icon={<Scale className="size-5" />}
              title="评价方法"
              description="四维口径与审核流程"
              tone="sand"
            />
            <EntryCard
              to="/assistant"
              icon={<Sparkles className="size-5" />}
              title="学生 AI"
              description="自带模型 · Key 不出浏览器"
              tone="violet"
              badge="规划中"
            />
          </div>

          <div className="mt-5 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-[10px] text-ink-400 sm:text-[11px]">
            {data ? (
              <>
                <span>{data.teacherCount} 位教师</span>
                <span>{data.courseCount} 门课程</span>
                <span>{data.sectionCount} 个教学班</span>
                <span>{data.publishedReviewCount} 条公开评价</span>
                <span>数据更新 {formatDate(data.updatedAt)}</span>
              </>
            ) : (
              <span>正在加载当前学期统计…</span>
            )}
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
        <div className="grid gap-7 lg:grid-cols-12">
          <section className="lg:col-span-8">
            <SectionHeading
              title="口碑教师"
              description="按四维综合均分排序；样本不足的教师不会用 0 分或猜测值补位。"
              action={
                <Link
                  to="/teachers"
                  className="inline-flex items-center gap-1 font-medium text-ink-500 transition hover:text-jade-700"
                >
                  完整教师库
                  <ArrowRight className="size-3.5" />
                </Link>
              }
            />

            <div className="mt-4">
              {featured.loading ? (
                <TeacherGridSkeleton count={4} />
              ) : featured.error ? (
                <ErrorState message={featured.error} onRetry={featured.reload} />
              ) : featured.items.length === 0 ? (
                <ErrorState message="当前没有可展示的教师，请稍后重试。" onRetry={featured.reload} />
              ) : (
                <div className="grid gap-3.5 sm:grid-cols-2">
                  {featured.items.map((teacher) => (
                    <TeacherCard key={teacher.id} teacher={teacher} compact />
                  ))}
                </div>
              )}
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              {[
                {
                  icon: <MessageSquareQuote className="size-4" />,
                  title: '先看样本',
                  text: '每条评价都标注学期、课程与样本量，不用一条评价代表整门课。',
                },
                {
                  icon: <CheckCircle2 className="size-4" />,
                  title: '再看口径',
                  text: '综合分是四个正向维度的算术均值，难度与作业量不混入总分。',
                },
                {
                  icon: <BadgeCheck className="size-4" />,
                  title: '来源可核对',
                  text: '平台总结只引用当前公开评价，来源变化后需要重新生成。',
                },
              ].map((item) => (
                <div key={item.title} className="surface-soft p-3.5">
                  <span className="flex size-8 items-center justify-center rounded-xl bg-white text-jade-700 ring-1 ring-inset ring-line/80">
                    {item.icon}
                  </span>
                  <p className="mt-2.5 text-xs font-semibold text-ink-900">{item.title}</p>
                  <p className="mt-1 text-[11px] leading-relaxed text-ink-500">{item.text}</p>
                </div>
              ))}
            </div>
          </section>

          <aside className="space-y-4 lg:col-span-4">
            <div className="surface p-5">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-xs font-semibold text-ink-900">
                  <span className="flex size-7 items-center justify-center rounded-lg bg-jade-50 text-jade-700">
                    <Scale className="size-3.5" />
                  </span>
                  评分怎么算
                </span>
                <Link to="/guide" className="text-[10px] font-medium text-jade-700 hover:underline">
                  完整说明
                </Link>
              </div>
              <div className="mt-4 space-y-2.5">
                {SCORE_DIMENSIONS.map((dimension, index) => (
                  <div key={dimension.key} className="flex items-start gap-2.5">
                    <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-paper text-[9px] font-semibold text-ink-400">
                      {index + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[11px] font-medium text-ink-700">{dimension.label}</span>
                        <span className="text-[9px] text-ink-400">1–5 分</span>
                      </div>
                      <p className="mt-0.5 text-[9px] leading-relaxed text-ink-400">{dimension.description}</p>
                    </div>
                  </div>
                ))}
              </div>
              <p className="mt-4 rounded-xl bg-paper/70 px-3 py-2.5 text-[10px] leading-relaxed text-ink-500">
                综合分 = 四个维度均值的算术平均。少于 5 条公开评价时只显示样本量，不提供可排序分数。
              </p>
            </div>

            <div className="surface overflow-hidden">
              <div className="border-b border-line/70 bg-gradient-to-br from-jade-50/80 to-white px-5 pb-4 pt-5">
                <div className="flex items-center justify-between gap-3">
                  <span className="flex items-center gap-2 text-xs font-semibold text-ink-900">
                    <span className="flex size-7 items-center justify-center rounded-lg bg-white text-jade-700 ring-1 ring-inset ring-jade-100">
                      <Sparkles className="size-3.5" />
                    </span>
                    评价摘要 · 本地演示
                  </span>
                  <span className="rounded-full bg-white/80 px-2 py-0.5 text-[9px] font-medium text-ink-400 ring-1 ring-inset ring-line/70">
                    非平台 AI
                  </span>
                </div>
                <p className="mt-2 text-[10px] leading-relaxed text-ink-500">
                  只依据当前公开评价的共同表述整理，不替代原始评价。
                </p>
              </div>

              <div className="px-5 py-4">
                {summary.loading && topTeacher ? (
                  <div className="space-y-2.5">
                    <LoadingBlock className="h-3.5 w-full" />
                    <LoadingBlock className="h-3.5 w-[88%]" />
                    <LoadingBlock className="h-3 w-[64%]" />
                  </div>
                ) : summary.data?.state === 'ready' && topTeacher ? (
                  <>
                    <div className="mb-3 flex flex-wrap items-center gap-1.5 text-[10px] text-ink-400">
                      <Quote className="size-3.5 text-jade-400" />
                      <span>基于 {summary.data.sampleCount} 条公开评价</span>
                      <span>·</span>
                      <Link to={`/teachers/${topTeacher.id}`} className="font-medium text-jade-700 hover:underline">
                        来源教师：{topTeacher.name}
                      </Link>
                    </div>
                    <div className="space-y-2.5">
                      {summary.data.sentences.slice(0, 2).map((sentence) => (
                        <p key={sentence.text} className="text-[11px] leading-relaxed text-ink-600">
                          “{sentence.text}”
                        </p>
                      ))}
                    </div>
                    <Link
                      to={`/teachers/${topTeacher.id}`}
                      className="mt-3.5 inline-flex items-center gap-1 text-[10px] font-semibold text-jade-700"
                    >
                      查看来源与教师档案
                      <ArrowRight className="size-3" />
                    </Link>
                  </>
                ) : summary.data?.state === 'insufficient' ? (
                  <p className="text-[11px] leading-relaxed text-ink-500">
                    该教师只有 {summary.data.sampleCount} 条公开评价，未达到 5 条总结与综合分的展示门槛。
                  </p>
                ) : (
                  <p className="text-[11px] leading-relaxed text-ink-500">
                    当前没有可展示的平台总结。总结只在公开样本达到门槛并通过来源校验后出现，不会用旧版本内容补位。
                  </p>
                )}
              </div>
            </div>

            <div className="relative overflow-hidden rounded-3xl bg-jade-900 p-5 text-white shadow-[0_22px_50px_-32px_rgba(14,56,45,0.9)]">
              <div className="pointer-events-none absolute -right-8 -top-10 size-32 rounded-full border border-white/10" />
              <div className="pointer-events-none absolute -bottom-12 -left-8 size-32 rounded-full border border-white/10" />
              <div className="relative">
                <p className="text-[10px] font-medium tracking-[0.16em] text-jade-200">REAL CLASSROOM</p>
                <h3 className="mt-2 text-base font-semibold leading-snug">下一条有用的评价，<br />可能来自你刚上完的课。</h3>
                <p className="mt-2 text-[10px] leading-relaxed text-jade-100/80">
                  本地演示已开放登录、提交、人工审核与撤回。评分与文字分开审核，不收集无法核验或无法撤回的材料。
                </p>
                <Link
                  to="/teachers"
                  className="mt-4 inline-flex h-9 items-center gap-1.5 rounded-full bg-white px-3.5 text-[11px] font-semibold text-jade-800 transition hover:bg-jade-50"
                >
                  <PenLine className="size-3.5" />
                  去写一条评价
                </Link>
              </div>
            </div>
          </aside>
        </div>

        <section className="mt-12 rounded-[28px] border border-line/80 bg-white/60 px-5 py-7 sm:px-8">
          <SectionHeading
            title="一份分数，三步形成"
            description="把可核验的教学资料、经过审核的学生评价和可解释的汇总口径分开处理。"
          />
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            {[
              {
                step: '01',
                title: '学生提交真实体验',
                text: '只邀请完成匿名学生认证的账号提交，同一课程、学期与教师保留一份未撤回评价。',
              },
              {
                step: '02',
                title: '非作者人工审核',
                text: '内容管理员按修订版本处理，平台模型只提供证据强度辅助，不自动发布或改写原始分。',
              },
              {
                step: '03',
                title: '样本达标后汇总',
                text: '至少 5 条当前公开评价才出现综合分；摘要绑定来源与版本，撤稿后立即失效。',
              },
            ].map((item) => (
              <div key={item.step} className="rounded-2xl border border-line/70 bg-white/80 p-4">
                <span className="brand-serif text-2xl font-bold text-jade-300">{item.step}</span>
                <p className="mt-2 text-xs font-semibold text-ink-900">{item.title}</p>
                <p className="mt-1 text-[11px] leading-relaxed text-ink-500">{item.text}</p>
              </div>
            ))}
          </div>
        </section>

        <div className="mt-10 flex flex-col items-start justify-between gap-4 rounded-2xl border border-dashed border-line-strong bg-white/40 px-4 py-3.5 text-[11px] text-ink-400 sm:flex-row sm:items-center">
          <span className="inline-flex items-center gap-2">
            <BookOpenText className="size-4 text-jade-600" />
            当前为本地演示：公开查询与评价提交/审核/撤回已接通；真实学生认证、学生 AI 与生产管理工作区尚未启用。
          </span>
          <Link to="/guide" className="inline-flex shrink-0 items-center gap-1 font-medium text-jade-700">
            查看当前交付边界
            <ArrowRight className="size-3" />
          </Link>
        </div>
      </div>
    </>
  );
}

function EntryCard({
  to,
  icon,
  title,
  description,
  tone,
  badge,
}: {
  to: string;
  icon: ReactNode;
  title: string;
  description: string;
  tone: 'jade' | 'sky' | 'sand' | 'violet';
  badge?: string;
}) {
  const tones = {
    jade: 'bg-jade-50 text-jade-700 ring-jade-100',
    sky: 'bg-water-50 text-water-500 ring-water-100',
    sand: 'bg-sun-50 text-sun-700 ring-sun-100',
    violet: 'bg-[#f3eff9] text-[#70548f] ring-[#e9e0f3]',
  } as const;

  return (
    <Link
      to={to}
      className="surface surface-interactive group flex items-start gap-3 p-3.5 sm:items-center sm:p-4"
    >
      <span className={`flex size-10 shrink-0 items-center justify-center rounded-2xl ring-1 ring-inset ${tones[tone]}`}>
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <span className="text-[13px] font-semibold text-ink-900 transition group-hover:text-jade-700">
            {title}
          </span>
          {badge ? (
            <span className="rounded-full bg-paper px-1.5 py-0.5 text-[8px] font-medium text-ink-400">{badge}</span>
          ) : null}
        </span>
        <span className="mt-0.5 block text-[10px] leading-relaxed text-ink-400 sm:text-[11px]">{description}</span>
      </span>
      <ArrowRight className="mt-1 hidden size-3.5 shrink-0 text-ink-300 transition group-hover:translate-x-0.5 group-hover:text-jade-600 sm:mt-0 sm:block" />
    </Link>
  );
}
