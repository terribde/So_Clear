import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  API_ERROR_CODES,
  ME_PATHS,
  SCORE_DIMENSIONS,
  type AppealDTO,
  type MainGroup,
  type OwnReviewDTO,
  type ReportDTO,
} from '@soclear/contracts';
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Clock3,
  Fingerprint,
  Flag,
  LoaderCircle,
  LockKeyhole,
  LogOut,
  MessageSquareText,
  PenLine,
  RefreshCw,
  Scale,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { AppealModal } from '../components/AppealModal';
import { PageHeader } from '../components/PageHeader';
import { ReviewEditModal } from '../components/ReviewEditModal';
import { EmptyState, ErrorState } from '../components/States';
import { useToast } from '../components/Toast';
import { ApiRequestError, apiRequest, errorMessage, withQuery } from '../features/api/client';
import { useAuth } from '../features/auth/AuthProvider';
import { LoginPanel } from '../features/auth/LoginPanel';
import {
  APPEAL_RESOLUTION_LABELS,
  APPEAL_STATUS_LABELS,
  GROUP_ABILITIES,
  GROUP_LABELS,
  REPORT_RESOLUTION_LABELS,
  REPORT_STATUS_LABELS,
  REVIEW_STATUS_LABELS,
  appealStatusTone,
  moderationReasonLabel,
  reportReasonLabel,
  reportStatusTone,
  reviewStatusTone,
} from '../features/auth/labels';
import { formatDate, formatScore, initials, pageTitle } from '../lib/format';

const groupOrder: MainGroup[] = [
  'guest',
  'user',
  'verified_student',
  'content_admin',
  'system_admin',
];

const roadmap = [
  { status: '已就绪', title: '公开查询', text: '教师、课程、开课与公开评价浏览；四维汇总与样本阈值。', done: true },
  { status: '演示版', title: '账号与会话', text: '独立平台账号、HttpOnly 会话、CSRF 校验与退出；仅本地演示账号。', done: true },
  { status: '演示版', title: '匿名学生资格', text: '资格与账号分离；当前使用合成演示资格，真实校园证明尚未接入。', done: true },
  { status: '演示版', title: '评价与审核', text: '提交、待审编辑、驳回/公开/隐藏状态修订、人工审核、撤回，以及举报、隐藏与作者申诉；真实校园认证仍待接入。', done: true },
  { status: '后续阶段', title: '真实认证与生产管理', text: 'KMS 保护的匿名学生认证、严格 CSP 管理文档与生产 Supabase。', done: false },
];

export function AccountPage() {
  const { session, loading: authLoading, error: authError, logout, refresh } = useAuth();
  const toast = useToast();
  const [reviews, setReviews] = useState<OwnReviewDTO[]>([]);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [reviewsError, setReviewsError] = useState<string | null>(null);
  const [reviewsVersion, setReviewsVersion] = useState(0);
  const [reports, setReports] = useState<ReportDTO[]>([]);
  const [reportsLoading, setReportsLoading] = useState(false);
  const [reportsError, setReportsError] = useState<string | null>(null);
  const [reportsVersion, setReportsVersion] = useState(0);
  const [appeals, setAppeals] = useState<AppealDTO[]>([]);
  const [appealsLoading, setAppealsLoading] = useState(false);
  const [appealsError, setAppealsError] = useState<string | null>(null);
  const [appealsVersion, setAppealsVersion] = useState(0);
  const [appealReview, setAppealReview] = useState<OwnReviewDTO | null>(null);
  const [editingReview, setEditingReview] = useState<OwnReviewDTO | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [withdrawingId, setWithdrawingId] = useState<string | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);

  const authenticated = Boolean(session?.authenticated);

  useEffect(() => {
    document.title = pageTitle('我的');
  }, []);

  useEffect(() => {
    if (!authenticated) {
      setReviews([]);
      setReviewsError(null);
      setReviewsLoading(false);
      return;
    }

    const controller = new AbortController();
    setReviewsLoading(true);
    setReviewsError(null);

    apiRequest<OwnReviewDTO[]>(withQuery(ME_PATHS.reviews, { limit: 50 }), {
      credentials: 'include',
      signal: controller.signal,
    })
      .then((result) => {
        setReviews(result.data);
        setReviewsLoading(false);
      })
      .catch((cause: unknown) => {
        if (controller.signal.aborted) return;
        if (cause instanceof ApiRequestError && cause.code === API_ERROR_CODES.unauthenticated) {
          void refresh().catch(() => undefined);
        }
        setReviewsError(errorMessage(cause));
        setReviewsLoading(false);
      });

    return () => controller.abort();
  }, [authenticated, refresh, reviewsVersion]);

  const reloadReviews = () => setReviewsVersion((value) => value + 1);
  const reloadReports = () => setReportsVersion((value) => value + 1);
  const reloadAppeals = () => setAppealsVersion((value) => value + 1);

  useEffect(() => {
    if (!authenticated) {
      setReports([]);
      setReportsError(null);
      setReportsLoading(false);
      return;
    }

    const controller = new AbortController();
    setReportsLoading(true);
    setReportsError(null);

    apiRequest<ReportDTO[]>(withQuery(ME_PATHS.reports, { limit: 50 }), {
      credentials: 'include',
      signal: controller.signal,
    })
      .then((result) => {
        setReports(result.data);
        setReportsLoading(false);
      })
      .catch((cause: unknown) => {
        if (controller.signal.aborted) return;
        if (cause instanceof ApiRequestError && cause.code === API_ERROR_CODES.unauthenticated) {
          void refresh().catch(() => undefined);
        }
        setReportsError(errorMessage(cause));
        setReportsLoading(false);
      });

    return () => controller.abort();
  }, [authenticated, refresh, reportsVersion]);

  useEffect(() => {
    if (!authenticated) {
      setAppeals([]);
      setAppealsError(null);
      setAppealsLoading(false);
      return;
    }

    const controller = new AbortController();
    setAppealsLoading(true);
    setAppealsError(null);

    apiRequest<AppealDTO[]>(withQuery(ME_PATHS.appeals, { limit: 50 }), {
      credentials: 'include',
      signal: controller.signal,
    })
      .then((result) => {
        setAppeals(result.data);
        setAppealsLoading(false);
      })
      .catch((cause: unknown) => {
        if (controller.signal.aborted) return;
        if (cause instanceof ApiRequestError && cause.code === API_ERROR_CODES.unauthenticated) {
          void refresh().catch(() => undefined);
        }
        setAppealsError(errorMessage(cause));
        setAppealsLoading(false);
      });

    return () => controller.abort();
  }, [appealsVersion, authenticated, refresh]);

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await logout();
      toast('已退出登录。', 'success');
    } catch (cause) {
      toast(errorMessage(cause), 'error');
    } finally {
      setLoggingOut(false);
    }
  };

  const withdraw = async (review: OwnReviewDTO) => {
    if (!session?.csrfToken) return;
    setWithdrawingId(review.id);
    try {
      await apiRequest<OwnReviewDTO>(ME_PATHS.reviewWithdraw(review.id), {
        method: 'POST',
        credentials: 'include',
        csrfToken: session.csrfToken,
        body: { expectedVersion: review.version },
      });
      toast('评价已撤回。公开统计会立即移除这条内容，可以重新提交。', 'success');
      setConfirmId(null);
      reloadReviews();
    } catch (cause) {
      toast(errorMessage(cause), 'error');
      if (cause instanceof ApiRequestError && cause.code === 'VERSION_CONFLICT') {
        reloadReviews();
      }
    } finally {
      setWithdrawingId(null);
    }
  };

  const account = session?.account;
  const grant = session?.studentGrant;
  const grantActive = grant?.state === 'active';
  const appealByReview = new Map(appeals.map((appeal) => [appeal.review.id, appeal]));

  return (
    <div className="mx-auto max-w-6xl px-4 pb-16 pt-8 sm:px-6 sm:pt-10">
      <PageHeader
        eyebrow="ACCOUNT / 我的"
        title="账号、匿名资格与本人记录"
        description="本地演示环境已接入账号会话、匿名学生资格（合成）、评价提交与撤回。公开查询仍无需登录，评价与审核只使用本地合成数据。"
      />

      <div className="mt-4 flex items-start gap-2.5 rounded-2xl border border-sun-100 bg-sun-50/60 px-4 py-3 text-[11px] leading-relaxed text-sun-700">
        <ShieldCheck className="mt-0.5 size-4 shrink-0" />
        <p>
          <span className="font-semibold">演示边界：</span>
          当前登录不使用学校账号，不会收集学号、校园邮箱或学生模型 Key；学生资格仅由本地种子授予，生产环境会关闭演示登录并接入真实匿名认证。
        </p>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-12">
        <div className="space-y-5 lg:col-span-7">
          {authLoading && !session ? (
            <div className="surface space-y-3 p-6">
              <div className="h-5 w-40 animate-pulse rounded bg-line/70" />
              <div className="h-3 w-64 animate-pulse rounded bg-line/50" />
              <div className="h-10 w-full animate-pulse rounded-2xl bg-line/40" />
            </div>
          ) : session?.authenticated ? (
            <section className="surface relative overflow-hidden p-5 sm:p-6">
              <div className="pointer-events-none absolute -right-20 -top-24 size-64 rounded-full bg-jade-50/80" />
              <div className="relative">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex min-w-0 items-center gap-4">
                    <span className="flex size-16 shrink-0 items-center justify-center rounded-[22px] bg-gradient-to-br from-jade-600 to-jade-800 text-2xl font-bold text-white shadow-[0_16px_30px_-20px_rgba(18,70,56,0.9)]">
                      {initials(account?.displayName ?? '')}
                    </span>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="truncate text-xl font-bold tracking-tight text-ink-950">
                          {account?.displayName}
                        </h2>
                        <span className="rounded-full bg-jade-50 px-2 py-0.5 text-[9px] font-medium text-jade-700">
                          {GROUP_LABELS[session.mainGroup]}
                        </span>
                        {account?.demo ? (
                          <span className="rounded-full bg-sun-50 px-2 py-0.5 text-[9px] font-medium text-sun-700">
                            本地演示账号
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-1 font-mono text-[10px] text-ink-400">@{account?.handle}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleLogout}
                    disabled={loggingOut}
                    className="btn-secondary h-9 shrink-0 px-3.5 text-[11px]"
                  >
                    {loggingOut ? (
                      <LoaderCircle className="size-3.5 animate-spin" />
                    ) : (
                      <LogOut className="size-3.5" />
                    )}
                    退出登录
                  </button>
                </div>

                <div className="mt-5 grid gap-2 sm:grid-cols-3">
                  <div className="rounded-xl border border-line/70 bg-paper/55 p-3">
                    <p className="stat-label">学生资格</p>
                    <p
                      className={`mt-1 text-xs font-semibold ${
                        grantActive ? 'text-jade-700' : 'text-ink-600'
                      }`}
                    >
                      {grantActive
                        ? '有效（演示）'
                        : grant?.state === 'revoked'
                          ? '已撤销'
                          : '未认证'}
                    </p>
                    <p className="mt-1 text-[9px] leading-relaxed text-ink-400">
                      {grantActive
                        ? `范围 ${grant?.scope ?? '—'} · 来源 ${grant?.assurance === 'demo_only' ? '本地种子' : '校园证明'}`
                        : '只有有效资格可以提交评价'}
                    </p>
                  </div>
                  <div className="rounded-xl border border-line/70 bg-paper/55 p-3">
                    <p className="stat-label">主权限组</p>
                    <p className="mt-1 font-mono text-xs font-semibold text-ink-800">
                      {session.mainGroup}
                    </p>
                    <p className="mt-1 text-[9px] leading-relaxed text-ink-400">
                      {GROUP_ABILITIES[session.mainGroup]}
                    </p>
                  </div>
                  <div className="rounded-xl border border-line/70 bg-paper/55 p-3">
                    <p className="stat-label">管理能力</p>
                    <p className="mt-1 text-xs font-semibold text-ink-800">
                      {session.isAdmin ? '可进入审核队列' : '无管理权限'}
                    </p>
                    {session.isAdmin ? (
                      <Link
                        to="/admin"
                        className="mt-1 inline-flex items-center gap-0.5 text-[9px] font-semibold text-jade-700"
                      >
                        打开 /admin
                        <ArrowRight className="size-2.5" />
                      </Link>
                    ) : (
                      <p className="mt-1 text-[9px] leading-relaxed text-ink-400">
                        管理权限只由后端当前授权决定
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </section>
          ) : (
            <section className="surface p-5 sm:p-6">
              <LoginPanel onSuccess={reloadReviews} />
            </section>
          )}

          {authError && !session?.authenticated ? (
            <div className="flex items-start gap-2 rounded-2xl border border-rose-100 bg-rose-50/60 px-3.5 py-2.5 text-[11px] leading-relaxed text-rose-700">
              <AlertCircle className="mt-0.5 size-3.5 shrink-0" />
              无法读取会话状态：{authError}。公开查询仍可使用。
            </div>
          ) : null}

          {authenticated ? (
            <section className="surface p-5 sm:p-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="eyebrow">MY REVIEWS</p>
                  <h2 className="mt-1.5 flex items-center gap-2 text-xl font-bold tracking-tight text-ink-950">
                    <PenLine className="size-4 text-jade-600" />
                    我的评价
                    <span className="rounded-full bg-paper px-2 py-0.5 text-[10px] font-medium text-ink-400">
                      {reviews.length}
                    </span>
                  </h2>
                  <p className="mt-1.5 text-[11px] leading-relaxed text-ink-500">
                    这里只对你展示处理状态、修订版本与驳回原因；公开页面不会出现作者信息。
                  </p>
                </div>
                <button
                  type="button"
                  onClick={reloadReviews}
                  disabled={reviewsLoading}
                  className="btn-ghost h-8 px-2.5 text-[10px]"
                >
                  <RefreshCw className={`size-3.5 ${reviewsLoading ? 'animate-spin' : ''}`} />
                  刷新
                </button>
              </div>

              {appealsError ? (
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-sun-100 bg-sun-50/60 px-3 py-2 text-[10px] text-sun-700">
                  <span className="flex items-center gap-1.5">
                    <AlertCircle className="size-3" />
                    无法读取申诉记录：{appealsError}
                  </span>
                  <button
                    type="button"
                    onClick={reloadAppeals}
                    className="font-semibold underline underline-offset-2"
                  >
                    重试
                  </button>
                </div>
              ) : null}

              <div className="mt-4">
                {reviewsLoading ? (
                  <div className="space-y-2.5">
                    {[0, 1].map((item) => (
                      <div key={item} className="rounded-2xl border border-line/70 p-4">
                        <div className="h-3.5 w-32 animate-pulse rounded bg-line/70" />
                        <div className="mt-3 h-2.5 w-56 animate-pulse rounded bg-line/50" />
                        <div className="mt-3 h-16 w-full animate-pulse rounded-xl bg-line/40" />
                      </div>
                    ))}
                  </div>
                ) : reviewsError ? (
                  <ErrorState message={reviewsError} onRetry={reloadReviews} />
                ) : reviews.length === 0 ? (
                  <EmptyState
                    title="还没有提交过评价"
                    description="去教师详情页选择一门课，填写四个维度后在「我的」里跟踪审核状态。"
                    icon={<MessageSquareText className="size-5" />}
                    action={
                      <Link to="/teachers" className="btn-primary h-9 px-4 text-[11px]">
                        去教师库
                        <ArrowRight className="size-3" />
                      </Link>
                    }
                  />
                ) : (
                  <div className="space-y-3">
                    {reviews.map((review) => (
                      <OwnReviewCard
                        key={review.id}
                        review={review}
                        appeal={appealByReview.get(review.id) ?? null}
                        confirming={confirmId === review.id}
                        withdrawing={withdrawingId === review.id}
                        onAskWithdraw={() => setConfirmId(review.id)}
                        onCancelWithdraw={() => setConfirmId(null)}
                        onConfirmWithdraw={() => withdraw(review)}
                        onEdit={() => setEditingReview(review)}
                        onAppeal={() => setAppealReview(review)}
                      />
                    ))}
                  </div>
                )}
              </div>
            </section>
          ) : null}

          {authenticated ? (
            <section className="surface p-5 sm:p-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="eyebrow">MY REPORTS</p>
                  <h2 className="mt-1.5 flex items-center gap-2 text-xl font-bold tracking-tight text-ink-950">
                    <Flag className="size-4 text-jade-600" />
                    我提交的举报
                    <span className="rounded-full bg-paper px-2 py-0.5 text-[10px] font-medium text-ink-400">
                      {reports.length}
                    </span>
                  </h2>
                  <p className="mt-1.5 text-[11px] leading-relaxed text-ink-500">
                    举报人身份不会出现在公开页面或审核队列中。处理结果以管理员核查为准，举报不会自动删除评价。
                  </p>
                </div>
                <button
                  type="button"
                  onClick={reloadReports}
                  disabled={reportsLoading}
                  className="btn-ghost h-8 px-2.5 text-[10px]"
                >
                  <RefreshCw className={`size-3.5 ${reportsLoading ? 'animate-spin' : ''}`} />
                  刷新
                </button>
              </div>

              <div className="mt-4">
                {reportsLoading ? (
                  <div className="space-y-2.5">
                    {[0, 1].map((item) => (
                      <div key={item} className="rounded-2xl border border-line/70 p-4">
                        <div className="h-3.5 w-28 animate-pulse rounded bg-line/70" />
                        <div className="mt-3 h-2.5 w-48 animate-pulse rounded bg-line/50" />
                        <div className="mt-3 h-10 w-full animate-pulse rounded-xl bg-line/40" />
                      </div>
                    ))}
                  </div>
                ) : reportsError ? (
                  <ErrorState message={reportsError} onRetry={reloadReports} />
                ) : reports.length === 0 ? (
                  <EmptyState
                    title="还没有举报记录"
                    description="在教师详情页的公开评价底部可以提交举报。处理状态与结果会出现在这里。"
                    icon={<Flag className="size-5" />}
                  />
                ) : (
                  <div className="space-y-3">
                    {reports.map((report) => (
                      <OwnReportCard key={report.id} report={report} />
                    ))}
                  </div>
                )}
              </div>
            </section>
          ) : null}

          <section className="surface p-5 sm:p-6">
            <div className="flex items-center gap-2.5">
              <span className="flex size-8 items-center justify-center rounded-xl bg-jade-50 text-jade-700">
                <Fingerprint className="size-4" />
              </span>
              <div>
                <h2 className="text-lg font-bold tracking-tight text-ink-950">五类身份，不按等级累加</h2>
                <p className="mt-0.5 text-[10px] text-ink-400">管理员组互斥；学生动作始终另验独立资格。</p>
              </div>
            </div>

            <div className="mt-4 overflow-hidden rounded-2xl border border-line/80">
              {groupOrder.map((group, index) => {
                const current = session?.mainGroup === group;
                return (
                  <div
                    key={group}
                    className={`flex flex-col gap-1.5 px-4 py-3 sm:flex-row sm:items-center sm:justify-between ${
                      index > 0 ? 'border-t border-line/60' : ''
                    } ${current ? 'bg-jade-50/40' : 'bg-white'}`}
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="text-xs font-semibold text-ink-800">{GROUP_LABELS[group]}</span>
                      <span className="rounded bg-paper px-1.5 py-0.5 font-mono text-[9px] text-ink-400">
                        {group}
                      </span>
                      {current ? (
                        <span className="rounded-full bg-jade-100 px-1.5 py-0.5 text-[8px] font-semibold text-jade-700">
                          当前
                        </span>
                      ) : null}
                    </div>
                    <p className="text-[10px] leading-relaxed text-ink-500 sm:max-w-[56%] sm:text-right">
                      {GROUP_ABILITIES[group]}
                    </p>
                  </div>
                );
              })}
            </div>

            <p className="mt-3 text-[10px] leading-relaxed text-ink-400">
              平台账号不等于学生身份；登录也不自动获得评价提交或学生 AI 数据权限。当前演示学生资格由本地种子授予，不能用于生产。
            </p>
          </section>
        </div>

        <aside className="space-y-5 lg:col-span-5">
          <section className="surface p-5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="flex size-7 items-center justify-center rounded-lg bg-jade-50 text-jade-700">
                  <Clock3 className="size-3.5" />
                </span>
                <h2 className="text-sm font-semibold text-ink-900">功能进度</h2>
              </div>
              <span className="text-[9px] text-ink-400">本地演示</span>
            </div>

            <div className="mt-4 space-y-0">
              {roadmap.map((item, index) => (
                <div key={item.title} className="relative flex gap-3 pb-4 last:pb-0">
                  {index < roadmap.length - 1 ? (
                    <span className="absolute left-[7px] top-4 h-full w-px bg-line" aria-hidden="true" />
                  ) : null}
                  <span
                    className={`relative mt-0.5 size-3.5 shrink-0 rounded-full border-2 ${
                      item.done ? 'border-jade-600 bg-jade-600' : 'border-line-strong bg-white'
                    }`}
                  />
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <p className="text-[11px] font-semibold text-ink-800">{item.title}</p>
                      <span
                        className={`rounded-full px-1.5 py-0.5 text-[8px] font-medium ${
                          item.done ? 'bg-jade-50 text-jade-700' : 'bg-paper text-ink-400'
                        }`}
                      >
                        {item.status}
                      </span>
                    </div>
                    <p className="mt-0.5 text-[10px] leading-relaxed text-ink-400">{item.text}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="surface p-5">
            <div className="flex items-center gap-2">
              <ShieldCheck className="size-4 text-jade-600" />
              <h2 className="text-sm font-semibold text-ink-900">这个页面不会做什么</h2>
            </div>
            <ul className="mt-3 space-y-2 text-[10px] leading-relaxed text-ink-500">
              <li className="flex items-start gap-2">
                <span className="mt-1 size-1 shrink-0 rounded-full bg-ink-300" />
                不把校园账号、校园邮箱或 SSO 身份接入平台登录。
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-1 size-1 shrink-0 rounded-full bg-ink-300" />
                不保存评价草稿、学生认证原文或学生模型 Key。
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-1 size-1 shrink-0 rounded-full bg-ink-300" />
                不允许作者审核自己的评价；审核与撤回都校验当前版本。
              </li>
            </ul>
          </section>

          <section className="surface p-5">
            <div className="flex items-center gap-2.5">
              <span className="flex size-8 items-center justify-center rounded-xl bg-sun-50 text-sun-700">
                <Sparkles className="size-4" />
              </span>
              <div>
                <h2 className="text-sm font-bold tracking-tight text-ink-950">没有积分，也没有签到奖励</h2>
                <p className="mt-0.5 text-[10px] text-ink-400">这是产品边界，不是暂时隐藏。</p>
              </div>
            </div>
            <p className="mt-3 text-[11px] leading-relaxed text-ink-500">
              清如许不建设积分账户、签到、评价奖励、充值、流水或 AI 扣分。公开查询不收费；学生自带模型的费用由供应商直接结算。
            </p>
            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              {['不设积分账户', '不做签到奖励', '不向学生扣 AI 分'].map((item) => (
                <div key={item} className="flex items-center gap-1.5 rounded-xl bg-paper/60 px-2.5 py-2 text-[9px] text-ink-500">
                  <CheckCircle2 className="size-3 shrink-0 text-jade-600" />
                  {item}
                </div>
              ))}
            </div>
          </section>

          <div className="rounded-3xl bg-jade-900 p-5 text-white">
            <MessageSquareText className="size-5 text-jade-200" />
            <p className="mt-3 text-sm font-semibold leading-relaxed">评价的价值来自可核验的过程，而不是提交数量。</p>
            <p className="mt-2 text-[10px] leading-relaxed text-jade-100/80">
              当前演示覆盖提交、人工审核、公开、撤回、举报与隐藏处理，以及作者对驳回/隐藏决定的申诉。真实匿名学生认证与生产级管理工作区仍按阶段推进。
            </p>
            <Link
              to="/guide#status"
              className="mt-4 inline-flex h-9 items-center gap-1.5 rounded-full bg-white px-3.5 text-[11px] font-semibold text-jade-800 transition hover:bg-jade-50"
            >
              查看完整交付状态
              <ArrowRight className="size-3.5" />
            </Link>
          </div>
        </aside>
      </div>

      <AppealModal
        open={Boolean(appealReview)}
        onClose={() => setAppealReview(null)}
        review={appealReview}
        onSubmitted={() => {
          reloadAppeals();
          reloadReviews();
        }}
      />

      <ReviewEditModal
        open={Boolean(editingReview)}
        onClose={() => setEditingReview(null)}
        review={editingReview}
        onUpdated={reloadReviews}
      />
    </div>
  );
}

function OwnReportCard({ report }: { report: ReportDTO }) {
  const excerpt =
    report.review.comment && report.review.comment.length > 160
      ? `${report.review.comment.slice(0, 160)}…`
      : report.review.comment;

  return (
    <article className="rounded-2xl border border-line/80 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`rounded-full px-2 py-0.5 text-[9px] font-semibold ring-1 ring-inset ${reportStatusTone(report.status)}`}
            >
              {REPORT_STATUS_LABELS[report.status]}
            </span>
            <span className="text-xs font-semibold text-ink-800">
              {reportReasonLabel(report.reasonCode)}
            </span>
          </div>
          <p className="mt-1 text-[10px] text-ink-400">
            {report.review.teacher.name} · {report.review.course.name} · {report.review.term.label}
          </p>
        </div>
        <span className="shrink-0 text-[9px] text-ink-400">
          提交于 {formatDate(report.createdAt)}
          {report.resolvedAt ? ` · 处理于 ${formatDate(report.resolvedAt)}` : ''}
        </span>
      </div>

      {report.note ? (
        <p className="mt-3 whitespace-pre-wrap rounded-xl bg-paper/50 px-3 py-2 text-[11px] leading-relaxed text-ink-600">
          {report.note}
        </p>
      ) : null}

      {excerpt ? (
        <p className="mt-2 line-clamp-3 rounded-xl border border-line/60 px-3 py-2 text-[10px] leading-relaxed text-ink-400">
          被举报内容：{excerpt}
        </p>
      ) : null}

      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-line/60 pt-2.5 text-[10px]">
        {report.status === 'pending' ? (
          <span className="flex items-center gap-1 text-sun-700">
            <Clock3 className="size-3" />
            等待管理员核查，举报不会自动删除评价。
          </span>
        ) : report.resolution ? (
          <span
            className={`flex items-center gap-1 font-medium ${
              report.resolution === 'hidden' ? 'text-jade-700' : 'text-ink-500'
            }`}
          >
            {report.resolution === 'hidden' ? (
              <CheckCircle2 className="size-3" />
            ) : (
              <ShieldCheck className="size-3" />
            )}
            处理结果：{REPORT_RESOLUTION_LABELS[report.resolution]}
          </span>
        ) : null}
        <span className="ml-auto font-mono text-[9px] text-ink-300">v{report.version}</span>
      </div>
    </article>
  );
}

function OwnReviewCard({
  review,
  appeal,
  confirming,
  withdrawing,
  onAskWithdraw,
  onCancelWithdraw,
  onConfirmWithdraw,
  onEdit,
  onAppeal,
}: {
  review: OwnReviewDTO;
  appeal: AppealDTO | null;
  confirming: boolean;
  withdrawing: boolean;
  onAskWithdraw: () => void;
  onCancelWithdraw: () => void;
  onConfirmWithdraw: () => void;
  onEdit: () => void;
  onAppeal: () => void;
}) {
  const reasonLabel = review.moderationReason
    ? moderationReasonLabel(review.moderationReason)
    : null;
  const canAppeal = !appeal && (review.status === 'rejected' || review.status === 'hidden');
  const canEdit =
    review.actions.canEdit &&
    !(
      (review.status === 'rejected' || review.status === 'hidden') &&
      appeal?.status === 'pending'
    );
  const editLabel =
    review.status === 'pending'
      ? '编辑待审内容'
      : review.status === 'published'
        ? '修订已公开内容'
        : '修改并重新送审';

  return (
    <article className="rounded-2xl border border-line/80 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`rounded-full px-2 py-0.5 text-[9px] font-semibold ring-1 ring-inset ${reviewStatusTone(review.status)}`}
            >
              {REVIEW_STATUS_LABELS[review.status]}
            </span>
            <Link
              to={`/teachers/${review.teacher.id}`}
              className="text-xs font-semibold text-ink-900 transition hover:text-jade-700"
            >
              {review.teacher.name}
            </Link>
            <span className="text-[10px] text-ink-400">{review.course.name}</span>
          </div>
          <p className="mt-1 text-[10px] text-ink-400">
            {review.term.label} · 提交于 {formatDate(review.submittedAt)}
            {review.publishedAt ? ` · 公开于 ${formatDate(review.publishedAt)}` : ''}
          </p>
        </div>
        <span className="shrink-0 rounded-full bg-paper px-2 py-0.5 font-mono text-[9px] text-ink-400">
          v{review.version} · rev {review.revision}
        </span>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-1.5 sm:grid-cols-4">
        {SCORE_DIMENSIONS.map((dimension) => (
          <div key={dimension.key} className="rounded-lg border border-line/60 bg-paper/50 px-2 py-1">
            <span className="block text-[9px] text-ink-400">{dimension.label}</span>
            <span className="mt-0.5 block text-[11px] font-semibold text-jade-700">
              {formatScore(review.scores[dimension.key])}
            </span>
          </div>
        ))}
      </div>

      {review.comment ? (
        <p className="mt-3 whitespace-pre-wrap text-[11px] leading-relaxed text-ink-600">{review.comment}</p>
      ) : (
        <p className="mt-3 text-[10px] italic text-ink-400">这条评价没有文字说明。</p>
      )}

      {review.status === 'rejected' && reasonLabel ? (
        <div className="mt-3 flex items-start gap-2 rounded-xl border border-rose-100 bg-rose-50/60 px-3 py-2 text-[10px] leading-relaxed text-rose-700">
          <AlertCircle className="mt-0.5 size-3.5 shrink-0" />
          <span>
            驳回原因：{reasonLabel}。
            {appeal?.status === 'pending'
              ? '申诉正在复核，暂不能修改内容；处理后可继续修订或申诉。'
              : '你可以保留原记录修改并重新送审，也可以对处理结果提出申诉。'}
          </span>
        </div>
      ) : review.status === 'pending' ? (
        <p className="mt-3 flex items-center gap-1.5 text-[10px] text-ink-400">
          <Clock3 className="size-3" />
          等待内容管理员审核；审核前仍可编辑，作者不能审核自己的评价。
        </p>
      ) : review.status === 'hidden' ? (
        <div className="mt-3 flex items-start gap-2 rounded-xl border border-line/80 bg-paper/50 px-3 py-2 text-[10px] leading-relaxed text-ink-500">
          <ShieldCheck className="mt-0.5 size-3.5 shrink-0" />
          <span>
            {reasonLabel ? `隐藏原因：${reasonLabel}。` : ''}
            {appeal?.status === 'pending'
              ? '申诉正在复核，暂不能修改内容；处理后可修订、继续申诉或撤回。'
              : '你可以对处理结果提出申诉、修改内容重新送审，或撤回后重新提交。审核通过前内容仍不公开。'}
          </span>
        </div>
      ) : review.status === 'published' ? (
        <p className="mt-3 flex items-start gap-1.5 text-[10px] leading-relaxed text-jade-700">
          <CheckCircle2 className="mt-0.5 size-3 shrink-0" />
          已进入公开样本。修订会立即下架当前公开版本并生成新修订，审核通过后恢复公开；撤回会从统计与摘要来源中移除。
        </p>
      ) : null}

      {appeal ? (
        <div className="mt-3 rounded-xl border border-jade-100 bg-jade-50/40 px-3 py-2.5 text-[10px] leading-relaxed text-ink-600">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`rounded-full px-2 py-0.5 text-[9px] font-semibold ring-1 ring-inset ${appealStatusTone(appeal.status)}`}
            >
              {APPEAL_STATUS_LABELS[appeal.status]}
            </span>
            <span className="font-medium text-ink-700">申诉</span>
            {appeal.resolution ? (
              <span className="text-ink-500">· {APPEAL_RESOLUTION_LABELS[appeal.resolution]}</span>
            ) : (
              <span className="text-sun-700">· 等待管理员复核</span>
            )}
            <span className="ml-auto text-[9px] text-ink-300">
              提交于 {formatDate(appeal.createdAt)}
            </span>
          </div>
          <p className="mt-1.5 whitespace-pre-wrap text-ink-600">申诉说明：{appeal.reason}</p>
          {appeal.decisionNote ? (
            <p className="mt-1 whitespace-pre-wrap text-ink-500">
              处理说明：{appeal.decisionNote}
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="mt-3 border-t border-line/60 pt-2.5">
        {confirming ? (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-paper/70 px-3 py-2">
            <span className="text-[10px] leading-relaxed text-ink-500">
              确认撤回这条评价？撤回后不能恢复原记录，但可以用同一课程重新提交。
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onConfirmWithdraw}
                disabled={withdrawing}
                className="inline-flex h-7 items-center gap-1 rounded-full bg-rose-600 px-3 text-[10px] font-semibold text-white transition hover:bg-rose-700 disabled:opacity-60"
              >
                {withdrawing ? <LoaderCircle className="size-3 animate-spin" /> : null}
                确认撤回
              </button>
              <button
                type="button"
                onClick={onCancelWithdraw}
                disabled={withdrawing}
                className="text-[10px] font-medium text-ink-500 transition hover:text-ink-800"
              >
                取消
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-3">
              {canEdit ? (
                <button
                  type="button"
                  onClick={onEdit}
                  className="inline-flex items-center gap-1 text-[10px] font-semibold text-jade-700 transition hover:text-jade-800"
                >
                  <PenLine className="size-3" />
                  {editLabel}
                </button>
              ) : null}
              {review.actions.canWithdraw ? (
                <button
                  type="button"
                  onClick={onAskWithdraw}
                  className="text-[10px] font-semibold text-ink-400 transition hover:text-rose-600"
                >
                  撤回评价
                </button>
              ) : (
                <span className="flex items-center gap-1 text-[10px] text-ink-400">
                  <LockKeyhole className="size-3" />
                  已撤回，不可再次操作
                </span>
              )}
            </div>
            {canAppeal ? (
              <button
                type="button"
                onClick={onAppeal}
                className="inline-flex items-center gap-1 text-[10px] font-semibold text-jade-700 transition hover:text-jade-800"
              >
                <Scale className="size-3" />
                对处理结果提出申诉
              </button>
            ) : null}
          </div>
        )}
      </div>
    </article>
  );
}
