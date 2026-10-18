import { useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import {
  ADMIN_PATHS,
  API_ERROR_CODES,
  RATING_MIN_SAMPLES,
  SCORE_DIMENSIONS,
  type AdminAuditActionFilter,
  type AdminAuditActorFilter,
  type AdminOverviewDTO,
  type AdminRecentActionDTO,
  type AdminReviewDTO,
  type AdminReviewRevisionDTO,
  type AdminSummaryDTO,
  type AdminSummaryFilter,
  type AppealDTO,
  type AppealStatus,
  type AuditEventDTO,
  type OwnReviewStatus,
  type ReportDTO,
  type ReportStatus,
  type TeacherSummaryState,
} from '@soclear/contracts';
import {
  Activity,
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ClipboardCheck,
  Clock3,
  EyeOff,
  Flag,
  History,
  Layers,
  LoaderCircle,
  LogOut,
  RefreshCw,
  RotateCcw,
  Scale,
  ShieldCheck,
  ShieldX,
  Sparkles,
  XCircle,
} from 'lucide-react';
import { BrandLockup } from '../components/Brand';
import { EmptyState, ErrorState } from '../components/States';
import { useToast } from '../components/Toast';
import { ApiRequestError, apiRequest, errorMessage, withQuery } from '../features/api/client';
import { useAuth } from '../features/auth/AuthProvider';
import { LoginPanel } from '../features/auth/LoginPanel';
import {
  APPEAL_RESOLUTION_LABELS,
  APPEAL_STATUS_LABELS,
  AUDIT_ACTION_LABELS,
  AUDIT_ACTOR_LABELS,
  GROUP_LABELS,
  MODERATION_REASON_OPTIONS,
  REPORT_RESOLUTION_LABELS,
  REPORT_STATUS_LABELS,
  REVIEW_STATUS_LABELS,
  SUMMARY_STATE_LABELS,
  appealStatusTone,
  moderationReasonLabel,
  reportReasonLabel,
  reportStatusTone,
  reviewStatusTone,
  summaryStateTone,
  type ModerationReasonCode,
} from '../features/auth/labels';
import { formatDate, formatDateTime, formatScore, pageTitle } from '../lib/format';

const statusTabs: OwnReviewStatus[] = ['pending', 'published', 'rejected', 'hidden', 'withdrawn'];
const reportStatusTabs: ReportStatus[] = ['pending', 'resolved', 'dismissed'];
const appealStatusTabs: AppealStatus[] = ['pending', 'accepted', 'rejected'];
const summaryFilterTabs: AdminSummaryFilter[] = [
  'all',
  'generating',
  'ready',
  'unavailable',
  'insufficient',
];
const summaryStateOrder: TeacherSummaryState[] = [
  'ready',
  'generating',
  'insufficient',
  'unavailable',
];
const auditActionOptions: AdminAuditActionFilter[] = [
  'all',
  'submit',
  'edit',
  'resubmit',
  'approve',
  'reject',
  'hide',
  'withdraw',
  'report_dismiss',
  'appeal_uphold',
  'appeal_restore',
];
const auditActorOptions: Array<{ value: AdminAuditActorFilter; label: string }> = [
  { value: 'all', label: '全部操作者' },
  { value: 'author', label: '作者动作' },
  { value: 'moderator', label: '管理员动作' },
];
const ADMIN_PAGE_SIZE = 20;

export function AdminPage() {
  const { session, loading: authLoading, logout, refresh } = useAuth();
  const toast = useToast();
  const [mode, setMode] = useState<
    'overview' | 'reviews' | 'reports' | 'appeals' | 'summaries' | 'audit'
  >('overview');
  const [status, setStatus] = useState<OwnReviewStatus>('pending');
  const [reviews, setReviews] = useState<AdminReviewDTO[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [reasons, setReasons] = useState<Record<string, ModerationReasonCode>>({});
  const [reportStatus, setReportStatus] = useState<ReportStatus>('pending');
  const [reports, setReports] = useState<ReportDTO[]>([]);
  const [reportsTotal, setReportsTotal] = useState(0);
  const [reportsLoading, setReportsLoading] = useState(false);
  const [reportsLoadingMore, setReportsLoadingMore] = useState(false);
  const [reportsHasMore, setReportsHasMore] = useState(false);
  const [reportsError, setReportsError] = useState<string | null>(null);
  const [reportsVersion, setReportsVersion] = useState(0);
  const [reportBusyId, setReportBusyId] = useState<string | null>(null);
  const [hidingReportId, setHidingReportId] = useState<string | null>(null);
  const [appealStatus, setAppealStatus] = useState<AppealStatus>('pending');
  const [appeals, setAppeals] = useState<AppealDTO[]>([]);
  const [appealsTotal, setAppealsTotal] = useState(0);
  const [appealsLoading, setAppealsLoading] = useState(false);
  const [appealsLoadingMore, setAppealsLoadingMore] = useState(false);
  const [appealsHasMore, setAppealsHasMore] = useState(false);
  const [appealsError, setAppealsError] = useState<string | null>(null);
  const [appealsVersion, setAppealsVersion] = useState(0);
  const [appealBusyId, setAppealBusyId] = useState<string | null>(null);
  const [restoringAppealId, setRestoringAppealId] = useState<string | null>(null);
  const [appealNotes, setAppealNotes] = useState<Record<string, string>>({});
  const [auditOpenId, setAuditOpenId] = useState<string | null>(null);
  const [auditEvents, setAuditEvents] = useState<Record<string, AuditEventDTO[]>>({});
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditError, setAuditError] = useState<string | null>(null);
  const [revisionsOpenId, setRevisionsOpenId] = useState<string | null>(null);
  const [revisions, setRevisions] = useState<Record<string, AdminReviewRevisionDTO[]>>({});
  const [revisionsLoading, setRevisionsLoading] = useState(false);
  const [revisionsError, setRevisionsError] = useState<string | null>(null);
  const [summaryFilter, setSummaryFilter] = useState<AdminSummaryFilter>('all');
  const [summaries, setSummaries] = useState<AdminSummaryDTO[]>([]);
  const [summariesTotal, setSummariesTotal] = useState(0);
  const [summariesLoading, setSummariesLoading] = useState(false);
  const [summariesLoadingMore, setSummariesLoadingMore] = useState(false);
  const [summariesHasMore, setSummariesHasMore] = useState(false);
  const [summariesError, setSummariesError] = useState<string | null>(null);
  const [summariesVersion, setSummariesVersion] = useState(0);
  const [summaryBusyId, setSummaryBusyId] = useState<string | null>(null);
  const [overview, setOverview] = useState<AdminOverviewDTO | null>(null);
  const [overviewLoading, setOverviewLoading] = useState(false);
  const [overviewError, setOverviewError] = useState<string | null>(null);
  const [overviewVersion, setOverviewVersion] = useState(0);
  const [historyAction, setHistoryAction] = useState<AdminAuditActionFilter>('all');
  const [historyActor, setHistoryActor] = useState<AdminAuditActorFilter>('all');
  const [history, setHistory] = useState<AdminRecentActionDTO[]>([]);
  const [historyTotal, setHistoryTotal] = useState(0);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyLoadingMore, setHistoryLoadingMore] = useState(false);
  const [historyHasMore, setHistoryHasMore] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [historyVersion, setHistoryVersion] = useState(0);

  useEffect(() => {
    document.title = pageTitle('管理工作区');
  }, []);

  useEffect(() => {
    if (!session?.isAdmin || mode !== 'overview') {
      setOverviewLoading(false);
      return;
    }

    const controller = new AbortController();
    setOverviewLoading(true);
    setOverviewError(null);

    apiRequest<AdminOverviewDTO>(ADMIN_PATHS.overview, {
      credentials: 'include',
      signal: controller.signal,
    })
      .then((result) => {
        setOverview(result.data);
        setOverviewLoading(false);
      })
      .catch((cause: unknown) => {
        if (controller.signal.aborted) return;
        if (
          cause instanceof ApiRequestError &&
          (cause.code === API_ERROR_CODES.unauthenticated || cause.code === API_ERROR_CODES.forbidden)
        ) {
          void refresh().catch(() => undefined);
        }
        setOverviewError(errorMessage(cause));
        setOverviewLoading(false);
      });

    return () => controller.abort();
  }, [mode, overviewVersion, refresh, session?.isAdmin]);

  useEffect(() => {
    if (!session?.isAdmin || mode !== 'audit') {
      setHistory([]);
      setHistoryTotal(0);
      setHistoryLoading(false);
      setHistoryLoadingMore(false);
      setHistoryHasMore(false);
      return;
    }

    const controller = new AbortController();
    setHistoryLoading(true);
    setHistoryLoadingMore(false);
    setHistoryError(null);

    apiRequest<AdminRecentActionDTO[]>(
      withQuery(ADMIN_PATHS.audit, {
        action: historyAction,
        actor: historyActor,
        limit: ADMIN_PAGE_SIZE,
        offset: 0,
      }),
      {
        credentials: 'include',
        signal: controller.signal,
      },
    )
      .then((result) => {
        setHistory(result.data);
        setHistoryTotal(result.meta.page?.total ?? result.data.length);
        setHistoryHasMore(result.meta.page?.hasMore ?? false);
        setHistoryLoading(false);
      })
      .catch((cause: unknown) => {
        if (controller.signal.aborted) return;
        if (
          cause instanceof ApiRequestError &&
          (cause.code === API_ERROR_CODES.unauthenticated || cause.code === API_ERROR_CODES.forbidden)
        ) {
          void refresh().catch(() => undefined);
        }
        setHistoryError(errorMessage(cause));
        setHistoryLoading(false);
      });

    return () => controller.abort();
  }, [historyAction, historyActor, historyVersion, mode, refresh, session?.isAdmin]);

  useEffect(() => {
    if (!session?.isAdmin || mode !== 'reviews') {
      setReviews([]);
      setTotal(0);
      setLoading(false);
      setLoadingMore(false);
      setHasMore(false);
      return;
    }

    const controller = new AbortController();
    setLoading(true);
    setLoadingMore(false);
    setError(null);

    apiRequest<AdminReviewDTO[]>(
      withQuery(ADMIN_PATHS.reviews, { status, limit: ADMIN_PAGE_SIZE, offset: 0 }),
      {
        credentials: 'include',
        signal: controller.signal,
      },
    )
      .then((result) => {
        setReviews(result.data);
        setTotal(result.meta.page?.total ?? result.data.length);
        setHasMore(result.meta.page?.hasMore ?? false);
        setLoading(false);
      })
      .catch((cause: unknown) => {
        if (controller.signal.aborted) return;
        if (
          cause instanceof ApiRequestError &&
          (cause.code === API_ERROR_CODES.unauthenticated || cause.code === API_ERROR_CODES.forbidden)
        ) {
          void refresh().catch(() => undefined);
        }
        setError(errorMessage(cause));
        setLoading(false);
      });

    return () => controller.abort();
  }, [mode, refresh, session?.isAdmin, status, version]);

  useEffect(() => {
    if (!session?.isAdmin || mode !== 'reports') {
      setReports([]);
      setReportsTotal(0);
      setReportsLoading(false);
      setReportsLoadingMore(false);
      setReportsHasMore(false);
      return;
    }

    const controller = new AbortController();
    setReportsLoading(true);
    setReportsLoadingMore(false);
    setReportsError(null);

    apiRequest<ReportDTO[]>(
      withQuery(ADMIN_PATHS.reports, {
        status: reportStatus,
        limit: ADMIN_PAGE_SIZE,
        offset: 0,
      }),
      {
        credentials: 'include',
        signal: controller.signal,
      },
    )
      .then((result) => {
        setReports(result.data);
        setReportsTotal(result.meta.page?.total ?? result.data.length);
        setReportsHasMore(result.meta.page?.hasMore ?? false);
        setReportsLoading(false);
      })
      .catch((cause: unknown) => {
        if (controller.signal.aborted) return;
        if (
          cause instanceof ApiRequestError &&
          (cause.code === API_ERROR_CODES.unauthenticated || cause.code === API_ERROR_CODES.forbidden)
        ) {
          void refresh().catch(() => undefined);
        }
        setReportsError(errorMessage(cause));
        setReportsLoading(false);
      });

    return () => controller.abort();
  }, [mode, refresh, reportStatus, reportsVersion, session?.isAdmin]);

  useEffect(() => {
    if (!session?.isAdmin || mode !== 'appeals') {
      setAppeals([]);
      setAppealsTotal(0);
      setAppealsLoading(false);
      setAppealsLoadingMore(false);
      setAppealsHasMore(false);
      return;
    }

    const controller = new AbortController();
    setAppealsLoading(true);
    setAppealsLoadingMore(false);
    setAppealsError(null);

    apiRequest<AppealDTO[]>(
      withQuery(ADMIN_PATHS.appeals, {
        status: appealStatus,
        limit: ADMIN_PAGE_SIZE,
        offset: 0,
      }),
      {
        credentials: 'include',
        signal: controller.signal,
      },
    )
      .then((result) => {
        setAppeals(result.data);
        setAppealsTotal(result.meta.page?.total ?? result.data.length);
        setAppealsHasMore(result.meta.page?.hasMore ?? false);
        setAppealsLoading(false);
      })
      .catch((cause: unknown) => {
        if (controller.signal.aborted) return;
        if (
          cause instanceof ApiRequestError &&
          (cause.code === API_ERROR_CODES.unauthenticated || cause.code === API_ERROR_CODES.forbidden)
        ) {
          void refresh().catch(() => undefined);
        }
        setAppealsError(errorMessage(cause));
        setAppealsLoading(false);
      });

    return () => controller.abort();
  }, [appealStatus, appealsVersion, mode, refresh, session?.isAdmin]);

  useEffect(() => {
    if (!session?.isAdmin || mode !== 'summaries') {
      setSummaries([]);
      setSummariesTotal(0);
      setSummariesLoading(false);
      setSummariesLoadingMore(false);
      setSummariesHasMore(false);
      return;
    }

    const controller = new AbortController();
    setSummariesLoading(true);
    setSummariesLoadingMore(false);
    setSummariesError(null);

    apiRequest<AdminSummaryDTO[]>(
      withQuery(ADMIN_PATHS.teacherSummaries, {
        filter: summaryFilter,
        limit: ADMIN_PAGE_SIZE,
        offset: 0,
      }),
      {
        credentials: 'include',
        signal: controller.signal,
      },
    )
      .then((result) => {
        setSummaries(result.data);
        setSummariesTotal(result.meta.page?.total ?? result.data.length);
        setSummariesHasMore(result.meta.page?.hasMore ?? false);
        setSummariesLoading(false);
      })
      .catch((cause: unknown) => {
        if (controller.signal.aborted) return;
        if (
          cause instanceof ApiRequestError &&
          (cause.code === API_ERROR_CODES.unauthenticated || cause.code === API_ERROR_CODES.forbidden)
        ) {
          void refresh().catch(() => undefined);
        }
        setSummariesError(errorMessage(cause));
        setSummariesLoading(false);
      });

    return () => controller.abort();
  }, [mode, refresh, session?.isAdmin, summaryFilter, summariesVersion]);

  const reload = () => setVersion((value) => value + 1);
  const reloadReports = () => setReportsVersion((value) => value + 1);
  const reloadAppeals = () => setAppealsVersion((value) => value + 1);
  const reloadSummaries = () => setSummariesVersion((value) => value + 1);
  const reloadOverview = () => setOverviewVersion((value) => value + 1);
  const reloadHistory = () => setHistoryVersion((value) => value + 1);

  const loadMoreReviews = async () => {
    if (loading || loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const result = await apiRequest<AdminReviewDTO[]>(
        withQuery(ADMIN_PATHS.reviews, {
          status,
          limit: ADMIN_PAGE_SIZE,
          offset: reviews.length,
        }),
        { credentials: 'include' },
      );
      setReviews((previous) => {
        const known = new Set(previous.map((entry) => entry.id));
        return [...previous, ...result.data.filter((entry) => !known.has(entry.id))];
      });
      setTotal(result.meta.page?.total ?? total);
      setHasMore(result.meta.page?.hasMore ?? false);
    } catch (cause) {
      toast(errorMessage(cause), 'error');
    } finally {
      setLoadingMore(false);
    }
  };

  const loadMoreReports = async () => {
    if (reportsLoading || reportsLoadingMore || !reportsHasMore) return;
    setReportsLoadingMore(true);
    try {
      const result = await apiRequest<ReportDTO[]>(
        withQuery(ADMIN_PATHS.reports, {
          status: reportStatus,
          limit: ADMIN_PAGE_SIZE,
          offset: reports.length,
        }),
        { credentials: 'include' },
      );
      setReports((previous) => {
        const known = new Set(previous.map((entry) => entry.id));
        return [...previous, ...result.data.filter((entry) => !known.has(entry.id))];
      });
      setReportsTotal(result.meta.page?.total ?? reportsTotal);
      setReportsHasMore(result.meta.page?.hasMore ?? false);
    } catch (cause) {
      toast(errorMessage(cause), 'error');
    } finally {
      setReportsLoadingMore(false);
    }
  };

  const loadMoreAppeals = async () => {
    if (appealsLoading || appealsLoadingMore || !appealsHasMore) return;
    setAppealsLoadingMore(true);
    try {
      const result = await apiRequest<AppealDTO[]>(
        withQuery(ADMIN_PATHS.appeals, {
          status: appealStatus,
          limit: ADMIN_PAGE_SIZE,
          offset: appeals.length,
        }),
        { credentials: 'include' },
      );
      setAppeals((previous) => {
        const known = new Set(previous.map((entry) => entry.id));
        return [...previous, ...result.data.filter((entry) => !known.has(entry.id))];
      });
      setAppealsTotal(result.meta.page?.total ?? appealsTotal);
      setAppealsHasMore(result.meta.page?.hasMore ?? false);
    } catch (cause) {
      toast(errorMessage(cause), 'error');
    } finally {
      setAppealsLoadingMore(false);
    }
  };

  const loadMoreSummaries = async () => {
    if (summariesLoading || summariesLoadingMore || !summariesHasMore) return;
    setSummariesLoadingMore(true);
    try {
      const result = await apiRequest<AdminSummaryDTO[]>(
        withQuery(ADMIN_PATHS.teacherSummaries, {
          filter: summaryFilter,
          limit: ADMIN_PAGE_SIZE,
          offset: summaries.length,
        }),
        { credentials: 'include' },
      );
      setSummaries((previous) => {
        const known = new Set(previous.map((entry) => entry.teacher.id));
        return [
          ...previous,
          ...result.data.filter((entry) => !known.has(entry.teacher.id)),
        ];
      });
      setSummariesTotal(result.meta.page?.total ?? summariesTotal);
      setSummariesHasMore(result.meta.page?.hasMore ?? false);
    } catch (cause) {
      toast(errorMessage(cause), 'error');
    } finally {
      setSummariesLoadingMore(false);
    }
  };

  const loadMoreHistory = async () => {
    if (historyLoading || historyLoadingMore || !historyHasMore) return;
    setHistoryLoadingMore(true);
    try {
      const result = await apiRequest<AdminRecentActionDTO[]>(
        withQuery(ADMIN_PATHS.audit, {
          action: historyAction,
          actor: historyActor,
          limit: ADMIN_PAGE_SIZE,
          offset: history.length,
        }),
        { credentials: 'include' },
      );
      setHistory((previous) => {
        const known = new Set(previous.map((entry) => entry.id));
        return [...previous, ...result.data.filter((entry) => !known.has(entry.id))];
      });
      setHistoryTotal(result.meta.page?.total ?? historyTotal);
      setHistoryHasMore(result.meta.page?.hasMore ?? false);
    } catch (cause) {
      toast(errorMessage(cause), 'error');
    } finally {
      setHistoryLoadingMore(false);
    }
  };

  const regenerateSummary = async (summary: AdminSummaryDTO) => {
    if (!session?.csrfToken) return;
    setSummaryBusyId(summary.teacher.id);
    try {
      const result = await apiRequest<AdminSummaryDTO>(
        ADMIN_PATHS.summaryRegenerate(summary.teacher.id),
        {
          method: 'POST',
          credentials: 'include',
          csrfToken: session.csrfToken,
          body: { expectedEpoch: summary.teacherSummaryEpoch },
        },
      );
      toast(
        `已基于 ${result.data.sampleCount} 条公开评价重建「${summary.teacher.name}」的本地摘要。`,
        'success',
      );
      reloadSummaries();
    } catch (cause) {
      toast(errorMessage(cause), 'error');
      if (cause instanceof ApiRequestError) {
        if (
          cause.code === API_ERROR_CODES.summaryNotActionable ||
          cause.code === API_ERROR_CODES.versionConflict
        ) {
          reloadSummaries();
        }
        if (
          cause.code === API_ERROR_CODES.unauthenticated ||
          cause.code === API_ERROR_CODES.csrfFailed
        ) {
          await refresh().catch(() => undefined);
        }
      }
    } finally {
      setSummaryBusyId(null);
    }
  };

  const clearReviewDetailCache = () => {
    setAuditOpenId(null);
    setAuditEvents({});
    setAuditError(null);
    setAuditLoading(false);
    setRevisionsOpenId(null);
    setRevisions({});
    setRevisionsError(null);
    setRevisionsLoading(false);
  };

  const toggleAudit = async (review: AdminReviewDTO) => {
    if (auditOpenId === review.id) {
      setAuditOpenId(null);
      return;
    }

    setAuditOpenId(review.id);
    setAuditError(null);
    if (auditEvents[review.id]) return;

    setAuditLoading(true);
    try {
      const result = await apiRequest<AuditEventDTO[]>(ADMIN_PATHS.reviewAudit(review.id), {
        credentials: 'include',
      });
      setAuditEvents((previous) => ({ ...previous, [review.id]: result.data }));
    } catch (cause) {
      setAuditError(errorMessage(cause));
    } finally {
      setAuditLoading(false);
    }
  };

  const toggleRevisions = async (review: AdminReviewDTO) => {
    if (revisionsOpenId === review.id) {
      setRevisionsOpenId(null);
      return;
    }

    setRevisionsOpenId(review.id);
    setRevisionsError(null);
    if (revisions[review.id]) return;

    setRevisionsLoading(true);
    try {
      const result = await apiRequest<AdminReviewRevisionDTO[]>(
        ADMIN_PATHS.reviewRevisions(review.id),
        { credentials: 'include' },
      );
      setRevisions((previous) => ({ ...previous, [review.id]: result.data }));
    } catch (cause) {
      setRevisionsError(errorMessage(cause));
    } finally {
      setRevisionsLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      toast('已退出管理账号。', 'success');
    } catch (cause) {
      toast(errorMessage(cause), 'error');
    }
  };

  const decide = async (review: AdminReviewDTO, decision: 'approve' | 'reject') => {
    if (!session?.csrfToken) return;
    setBusyId(review.id);
    try {
      await apiRequest(ADMIN_PATHS.reviewDecision(review.id), {
        method: 'POST',
        credentials: 'include',
        csrfToken: session.csrfToken,
        body: {
          decision,
          reasonCode: decision === 'reject' ? reasons[review.id] ?? 'insufficient_detail' : null,
          expectedVersion: review.version,
        },
      });
      toast(
        decision === 'approve'
          ? '已通过：评价进入公开统计，教师摘要来源已更新。'
          : '已驳回：原因只对作者与管理员可见。',
        'success',
      );
      setRejectingId(null);
      clearReviewDetailCache();
      reload();
    } catch (cause) {
      toast(errorMessage(cause), 'error');
      if (cause instanceof ApiRequestError) {
        if (cause.code === API_ERROR_CODES.versionConflict) reload();
        if (cause.code === API_ERROR_CODES.unauthenticated || cause.code === API_ERROR_CODES.csrfFailed) {
          await refresh().catch(() => undefined);
        }
      }
    } finally {
      setBusyId(null);
    }
  };

  const decideReport = async (report: ReportDTO, decision: 'dismiss' | 'hide') => {
    if (!session?.csrfToken) return;
    setReportBusyId(report.id);
    try {
      await apiRequest(ADMIN_PATHS.reportDecision(report.id), {
        method: 'POST',
        credentials: 'include',
        csrfToken: session.csrfToken,
        body: { decision, expectedVersion: report.version },
      });
      toast(
        decision === 'hide'
          ? '已隐藏被举报评价，公开统计与摘要来源已更新。'
          : '已驳回举报，评价保持公开。',
        'success',
      );
      setHidingReportId(null);
      clearReviewDetailCache();
      reloadReports();
    } catch (cause) {
      toast(errorMessage(cause), 'error');
      if (cause instanceof ApiRequestError) {
        if (cause.code === API_ERROR_CODES.versionConflict) reloadReports();
        if (
          cause.code === API_ERROR_CODES.unauthenticated ||
          cause.code === API_ERROR_CODES.csrfFailed
        ) {
          await refresh().catch(() => undefined);
        }
      }
    } finally {
      setReportBusyId(null);
    }
  };

  const decideAppeal = async (appeal: AppealDTO, decision: 'restore' | 'uphold') => {
    if (!session?.csrfToken) return;
    setAppealBusyId(appeal.id);
    try {
      await apiRequest(ADMIN_PATHS.appealDecision(appeal.id), {
        method: 'POST',
        credentials: 'include',
        csrfToken: session.csrfToken,
        body: {
          decision,
          note: appealNotes[appeal.id]?.trim() || null,
          expectedVersion: appeal.version,
        },
      });
      toast(
        decision === 'restore'
          ? '已恢复公开：评价重新进入公开统计，摘要来源已更新。'
          : '已维持原判：申诉记录保留，评价状态不变。',
        'success',
      );
      setRestoringAppealId(null);
      clearReviewDetailCache();
      reloadAppeals();
      reload();
    } catch (cause) {
      toast(errorMessage(cause), 'error');
      if (cause instanceof ApiRequestError) {
        if (cause.code === API_ERROR_CODES.versionConflict) reloadAppeals();
        if (
          cause.code === API_ERROR_CODES.unauthenticated ||
          cause.code === API_ERROR_CODES.csrfFailed
        ) {
          await refresh().catch(() => undefined);
        }
      }
    } finally {
      setAppealBusyId(null);
    }
  };

  const overviewPending =
    (overview?.queues.reviews.pending ?? 0) +
    (overview?.queues.reports.pending ?? 0) +
    (overview?.queues.appeals.pending ?? 0) +
    (overview?.queues.summaries.generating ?? 0);
  const modeTitle =
    mode === 'overview'
      ? '治理总览'
      : mode === 'reviews'
        ? '评价审核队列'
        : mode === 'reports'
          ? '举报处理队列'
          : mode === 'appeals'
            ? '申诉复核队列'
            : mode === 'summaries'
              ? '教师摘要管理'
              : '治理动态';
  const modeDescription =
    mode === 'overview'
      ? '汇总待审核评价、举报、申诉与待重建摘要，并展示最近的隐私安全治理动态。计数来自当前本地演示数据库，点击卡片可直接进入对应队列。'
      : mode === 'reviews'
        ? '审核只能看到评价内容与目标课程，不返回作者账号。通过后立即进入公开统计；驳回必须选择原因，原因只展示给作者与管理员。'
        : mode === 'reports'
          ? '举报队列不返回举报人身份。管理员可以驳回举报，或在核实后隐藏被举报评价；隐藏会立即影响公开统计与摘要来源。'
          : mode === 'appeals'
            ? '申诉队列不返回申诉人身份。管理员可以维持原判，或在核实后恢复公开；恢复会重新进入公开统计并让摘要失效。'
            : mode === 'summaries'
              ? '摘要由本地确定性规则基于当前公开评价生成，并明确标注为本地演示，不冒充平台 AI。公开来源变化或治理动作会让摘要失效为「待重建」，可在这里用当前来源重建。'
              : '按操作者与动作筛选全部治理记录。只展示动作、原因、状态变化与目标教师/课程，不返回作者、举报人、申诉人或管理员账号身份。';
  const modeTotal =
    mode === 'overview'
      ? overviewPending
      : mode === 'reviews'
        ? total
        : mode === 'reports'
          ? reportsTotal
          : mode === 'appeals'
            ? appealsTotal
            : mode === 'summaries'
              ? summariesTotal
              : historyTotal;
  const modeLoading =
    mode === 'overview'
      ? overviewLoading
      : mode === 'reviews'
        ? loading
        : mode === 'reports'
          ? reportsLoading
          : mode === 'appeals'
            ? appealsLoading
            : mode === 'summaries'
              ? summariesLoading
              : historyLoading;
  const modeReload =
    mode === 'overview'
      ? reloadOverview
      : mode === 'reviews'
        ? reload
        : mode === 'reports'
          ? reloadReports
          : mode === 'appeals'
            ? reloadAppeals
            : mode === 'summaries'
              ? reloadSummaries
              : reloadHistory;

  return (
    <div className="min-h-dvh">
      <header className="border-b border-line/75 bg-white/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <BrandLockup compact />
            <span className="rounded-full bg-sun-50 px-2 py-0.5 text-[9px] font-semibold tracking-wide text-sun-700">
              ADMIN · 本地演示
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Link
              to="/"
              className="hidden h-9 items-center gap-1.5 rounded-full border border-line bg-white px-3 text-[11px] font-semibold text-ink-600 transition hover:border-jade-300 hover:text-jade-700 sm:inline-flex"
            >
              <ArrowLeft className="size-3.5" />
              返回公开站点
            </Link>
            {session?.account ? (
              <>
                <span className="hidden max-w-40 items-center gap-2 truncate rounded-full bg-paper px-3 py-1.5 text-[10px] text-ink-600 md:inline-flex">
                  <ShieldCheck className="size-3.5 shrink-0 text-jade-600" />
                  <span className="truncate">{session.account.displayName}</span>
                </span>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="btn-secondary h-9 px-3 text-[11px]"
                >
                  <LogOut className="size-3.5" />
                  退出
                </button>
              </>
            ) : null}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        {authLoading && !session ? (
          <div className="surface flex min-h-72 items-center justify-center">
            <LoaderCircle className="size-5 animate-spin text-jade-600" />
            <span className="sr-only">正在检查管理权限</span>
          </div>
        ) : !session?.authenticated ? (
          <div className="mx-auto max-w-2xl">
            <div className="text-center">
              <span className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-paper text-ink-400 ring-1 ring-inset ring-line">
                <ShieldCheck className="size-6" />
              </span>
              <p className="eyebrow mt-5">ADMIN / RESTRICTED</p>
              <h1 className="mt-2 text-2xl font-bold tracking-tight text-ink-950">管理工作区</h1>
              <p className="mx-auto mt-2 max-w-md text-[11px] leading-relaxed text-ink-500">
                审核队列只对当前具备审核权限的账号开放。登录不会自动获得管理能力；权限始终由后端会话决定。
              </p>
            </div>

            <div className="surface mt-6 p-5 sm:p-6">
              <LoginPanel
                title="登录内容管理员账号"
                description="本地演示可使用「内容管理员（演示）」账号审核合成评价；普通学生账号登录后会看到无权限提示。"
              />
            </div>

            <div className="mt-4 flex items-start gap-2 rounded-2xl border border-jade-100 bg-jade-50/60 px-4 py-3 text-[10px] leading-relaxed text-jade-800">
              <ShieldCheck className="mt-0.5 size-3.5 shrink-0" />
              <p>
                隐藏按钮或直接访问 /admin 不会获得任何权限。当前页面只展示本地合成数据；生产环境会使用独立管理文档、短时强认证与逐动作能力校验。
              </p>
            </div>
          </div>
        ) : !session.isAdmin ? (
          <div className="mx-auto max-w-lg">
            <div className="surface overflow-hidden">
              <div className="border-b border-line/70 bg-gradient-to-br from-jade-50/70 to-white px-6 py-5">
                <BrandLockup compact />
              </div>
              <div className="px-6 py-8 text-center">
                <span className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-rose-50 text-rose-500 ring-1 ring-inset ring-rose-100">
                  <ShieldX className="size-6" />
                </span>
                <p className="eyebrow mt-5">ADMIN / DENIED</p>
                <h1 className="mt-2 text-xl font-bold tracking-tight text-ink-950">当前账号没有管理权限</h1>
                <p className="mx-auto mt-2 max-w-sm text-[11px] leading-relaxed text-ink-500">
                  你以「{GROUP_LABELS[session.mainGroup]}」身份登录。审核队列只允许内容管理员或系统管理员访问，
                  前端不会因为隐藏菜单而放宽后端授权。
                </p>
                <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-center">
                  <button type="button" onClick={handleLogout} className="btn-secondary h-10 px-4 text-xs">
                    <LogOut className="size-3.5" />
                    切换账号
                  </button>
                  <Link to="/" className="btn-primary h-10 px-4 text-xs">
                    <ArrowLeft className="size-3.5" />
                    返回公开站点
                  </Link>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-5">
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
              <div>
                <p className="eyebrow">MODERATION WORKSPACE</p>
                <h1 className="mt-2 flex items-center gap-2 text-2xl font-bold tracking-tight text-ink-950 sm:text-3xl">
                  <ClipboardCheck className="size-6 text-jade-600" />
                  {modeTitle}
                </h1>
                <p className="mt-2 max-w-2xl text-[11px] leading-relaxed text-ink-500">
                  {modeDescription}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <div className="inline-flex flex-wrap gap-0.5 rounded-2xl border border-line bg-white p-1">
                  <button
                    type="button"
                    onClick={() => {
                      setMode('overview');
                      setRejectingId(null);
                      setHidingReportId(null);
                      setRestoringAppealId(null);
                    }}
                    className={`rounded-full px-3 py-1 text-[10px] font-semibold transition ${
                      mode === 'overview'
                        ? 'bg-jade-700 text-white'
                        : 'text-ink-500 hover:text-jade-700'
                    }`}
                  >
                    总览
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setMode('reviews');
                      setHidingReportId(null);
                      setRestoringAppealId(null);
                    }}
                    className={`rounded-full px-3 py-1 text-[10px] font-semibold transition ${
                      mode === 'reviews'
                        ? 'bg-jade-700 text-white'
                        : 'text-ink-500 hover:text-jade-700'
                    }`}
                  >
                    评价审核
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setMode('reports');
                      setRejectingId(null);
                      setRestoringAppealId(null);
                    }}
                    className={`rounded-full px-3 py-1 text-[10px] font-semibold transition ${
                      mode === 'reports'
                        ? 'bg-jade-700 text-white'
                        : 'text-ink-500 hover:text-jade-700'
                    }`}
                  >
                    举报队列
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setMode('appeals');
                      setRejectingId(null);
                      setHidingReportId(null);
                    }}
                    className={`rounded-full px-3 py-1 text-[10px] font-semibold transition ${
                      mode === 'appeals'
                        ? 'bg-jade-700 text-white'
                        : 'text-ink-500 hover:text-jade-700'
                    }`}
                  >
                    申诉队列
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setMode('summaries');
                      setRejectingId(null);
                      setHidingReportId(null);
                      setRestoringAppealId(null);
                    }}
                    className={`rounded-full px-3 py-1 text-[10px] font-semibold transition ${
                      mode === 'summaries'
                        ? 'bg-jade-700 text-white'
                        : 'text-ink-500 hover:text-jade-700'
                    }`}
                  >
                    摘要管理
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setMode('audit');
                      setRejectingId(null);
                      setHidingReportId(null);
                      setRestoringAppealId(null);
                    }}
                    className={`rounded-full px-3 py-1 text-[10px] font-semibold transition ${
                      mode === 'audit'
                        ? 'bg-jade-700 text-white'
                        : 'text-ink-500 hover:text-jade-700'
                    }`}
                  >
                    治理动态
                  </button>
                </div>
                <span className="rounded-full bg-paper px-3 py-1.5 text-[10px] text-ink-500">
                  {mode === 'overview' ? '当前待办' : '当前列表'} {modeTotal} 条
                </span>
                <button
                  type="button"
                  onClick={modeReload}
                  disabled={modeLoading}
                  className="btn-secondary h-9 px-3 text-[11px]"
                >
                  <RefreshCw className={`size-3.5 ${modeLoading ? 'animate-spin' : ''}`} />
                  刷新
                </button>
              </div>
            </div>

            {mode === 'overview' ? (
              <>
                {overviewError ? (
                  <ErrorState message={overviewError} onRetry={reloadOverview} />
                ) : overviewLoading && !overview ? (
                  <div className="space-y-5">
                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                      {[0, 1, 2, 3].map((item) => (
                        <div key={item} className="surface p-4">
                          <div className="h-8 w-8 animate-pulse rounded-xl bg-line/60" />
                          <div className="mt-3 h-6 w-16 animate-pulse rounded bg-line/70" />
                          <div className="mt-2 h-3 w-28 animate-pulse rounded bg-line/50" />
                        </div>
                      ))}
                    </div>
                    <div className="grid gap-4 lg:grid-cols-5">
                      <div className="surface h-56 animate-pulse bg-line/30 lg:col-span-2" />
                      <div className="surface h-56 animate-pulse bg-line/30 lg:col-span-3" />
                    </div>
                  </div>
                ) : overview ? (
                  <div className="space-y-5">
                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                      <AdminOverviewCard
                        icon={<ClipboardCheck className="size-4" />}
                        label="待审核评价"
                        count={overview.queues.reviews.pending}
                        hint={`已公开 ${overview.queues.reviews.published} · 已驳回 ${overview.queues.reviews.rejected} · 已隐藏 ${overview.queues.reviews.hidden}`}
                        onClick={() => {
                          setMode('reviews');
                          setStatus('pending');
                        }}
                      />
                      <AdminOverviewCard
                        icon={<Flag className="size-4" />}
                        label="待处理举报"
                        count={overview.queues.reports.pending}
                        hint={`已处理 ${overview.queues.reports.resolved} · 已驳回 ${overview.queues.reports.dismissed}`}
                        onClick={() => {
                          setMode('reports');
                          setReportStatus('pending');
                        }}
                      />
                      <AdminOverviewCard
                        icon={<Scale className="size-4" />}
                        label="待复核申诉"
                        count={overview.queues.appeals.pending}
                        hint={`已支持 ${overview.queues.appeals.accepted} · 维持原判 ${overview.queues.appeals.rejected}`}
                        onClick={() => {
                          setMode('appeals');
                          setAppealStatus('pending');
                        }}
                      />
                      <AdminOverviewCard
                        icon={<Sparkles className="size-4" />}
                        label="待重建摘要"
                        count={overview.queues.summaries.generating}
                        hint={`已生成 ${overview.queues.summaries.ready} · 尚未生成 ${overview.queues.summaries.unavailable}`}
                        onClick={() => {
                          setMode('summaries');
                          setSummaryFilter('generating');
                        }}
                      />
                    </div>

                    <div className="grid gap-4 lg:grid-cols-5">
                      <section className="surface p-5 lg:col-span-2">
                        <div className="flex items-center justify-between gap-2">
                          <h2 className="flex items-center gap-2 text-sm font-semibold text-ink-900">
                            <Sparkles className="size-4 text-jade-600" />
                            摘要状态
                          </h2>
                          <span className="text-[10px] text-ink-400">
                            共 {summaryStateOrder.reduce(
                              (sum, state) => sum + overview.queues.summaries[state],
                              0,
                            )}{' '}
                            位教师
                          </span>
                        </div>
                        <div className="mt-3 space-y-1.5">
                          {summaryStateOrder.map((state) => (
                            <button
                              key={state}
                              type="button"
                              onClick={() => {
                                setMode('summaries');
                                setSummaryFilter(state);
                              }}
                              className="flex w-full items-center justify-between gap-2 rounded-xl border border-line/70 bg-white px-3 py-2 text-left transition hover:border-jade-300"
                            >
                              <span
                                className={`rounded-full px-2 py-0.5 text-[9px] font-semibold ring-1 ring-inset ${summaryStateTone(state)}`}
                              >
                                {SUMMARY_STATE_LABELS[state]}
                              </span>
                              <span className="text-xs font-semibold text-ink-800">
                                {overview.queues.summaries[state]}
                              </span>
                            </button>
                          ))}
                        </div>
                      </section>

                      <section className="surface p-5 lg:col-span-3">
                        <div className="flex items-center justify-between gap-2">
                          <h2 className="flex items-center gap-2 text-sm font-semibold text-ink-900">
                            <Activity className="size-4 text-jade-600" />
                            最近治理动作
                          </h2>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] text-ink-400">
                              最近 {overview.recentActions.length} 条
                            </span>
                            <button
                              type="button"
                              onClick={() => setMode('audit')}
                              className="text-[10px] font-semibold text-jade-700 transition hover:text-jade-800"
                            >
                              查看全部
                            </button>
                          </div>
                        </div>
                        {overview.recentActions.length === 0 ? (
                          <p className="mt-4 rounded-xl bg-paper/55 px-3 py-4 text-center text-[10px] text-ink-400">
                            还没有治理动作。评价提交、审核、举报处理与申诉复核都会记录在这里。
                          </p>
                        ) : (
                          <ul className="mt-2 divide-y divide-line/60">
                            {overview.recentActions.map((event) => (
                              <AdminRecentActionRow key={event.id} event={event} />
                            ))}
                          </ul>
                        )}
                      </section>
                    </div>

                    <div className="flex items-start gap-2.5 rounded-2xl border border-line bg-white/70 px-4 py-3 text-[10px] leading-relaxed text-ink-500">
                      <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-jade-600" />
                      <p>
                        总览只聚合队列计数、摘要状态与动作类型，不返回作者、举报人、申诉人或管理员账号身份。
                        所有计数来自当前本地演示数据库。
                      </p>
                    </div>
                  </div>
                ) : null}
              </>
            ) : mode === 'reviews' ? (
              <>
                <div className="flex flex-wrap gap-1.5">
                  {statusTabs.map((tab) => (
                    <button
                      key={tab}
                      type="button"
                      onClick={() => {
                        setStatus(tab);
                        setRejectingId(null);
                      }}
                      className={`rounded-full border px-3 py-1.5 text-[11px] font-medium transition ${
                        status === tab
                          ? 'border-jade-700 bg-jade-700 text-white'
                          : 'border-line bg-white text-ink-600 hover:border-jade-300 hover:text-jade-700'
                      }`}
                    >
                      {REVIEW_STATUS_LABELS[tab]}
                    </button>
                  ))}
                </div>

                {error ? (
                  <ErrorState message={error} onRetry={reload} />
                ) : loading ? (
                  <div className="space-y-3">
                    {[0, 1, 2].map((item) => (
                      <div key={item} className="surface p-5">
                        <div className="h-4 w-40 animate-pulse rounded bg-line/70" />
                        <div className="mt-3 h-3 w-64 animate-pulse rounded bg-line/50" />
                        <div className="mt-4 h-20 w-full animate-pulse rounded-2xl bg-line/40" />
                      </div>
                    ))}
                  </div>
                ) : reviews.length === 0 ? (
                  <EmptyState
                    title={`没有${REVIEW_STATUS_LABELS[status]}的评价`}
                    description="切换上方状态查看其他队列，或等待新的评价提交。"
                    icon={<ClipboardCheck className="size-5" />}
                  />
                ) : (
                  <div className="space-y-3">
                    {reviews.map((review) => (
                      <AdminReviewCard
                        key={review.id}
                        review={review}
                        busy={busyId === review.id}
                        rejecting={rejectingId === review.id}
                        reason={reasons[review.id] ?? 'insufficient_detail'}
                        auditOpen={auditOpenId === review.id}
                        auditEvents={auditEvents[review.id] ?? []}
                        auditLoading={auditLoading && auditOpenId === review.id}
                        auditError={auditOpenId === review.id ? auditError : null}
                        revisionsOpen={revisionsOpenId === review.id}
                        revisions={revisions[review.id] ?? []}
                        revisionsLoading={revisionsLoading && revisionsOpenId === review.id}
                        revisionsError={revisionsOpenId === review.id ? revisionsError : null}
                        onToggleAudit={() => toggleAudit(review)}
                        onToggleRevisions={() => toggleRevisions(review)}
                        onReasonChange={(value) =>
                          setReasons((previous) => ({ ...previous, [review.id]: value }))
                        }
                        onAskReject={() => setRejectingId(review.id)}
                        onCancelReject={() => setRejectingId(null)}
                        onApprove={() => decide(review, 'approve')}
                        onReject={() => decide(review, 'reject')}
                      />
                    ))}
                    {hasMore ? (
                      <AdminLoadMore
                        loaded={reviews.length}
                        total={total}
                        loading={loadingMore}
                        onLoad={loadMoreReviews}
                      />
                    ) : null}
                  </div>
                )}
              </>
            ) : mode === 'reports' ? (
              <>
                <div className="flex flex-wrap gap-1.5">
                  {reportStatusTabs.map((tab) => (
                    <button
                      key={tab}
                      type="button"
                      onClick={() => {
                        setReportStatus(tab);
                        setHidingReportId(null);
                      }}
                      className={`rounded-full border px-3 py-1.5 text-[11px] font-medium transition ${
                        reportStatus === tab
                          ? 'border-jade-700 bg-jade-700 text-white'
                          : 'border-line bg-white text-ink-600 hover:border-jade-300 hover:text-jade-700'
                      }`}
                    >
                      {REPORT_STATUS_LABELS[tab]}
                    </button>
                  ))}
                </div>

                {reportsError ? (
                  <ErrorState message={reportsError} onRetry={reloadReports} />
                ) : reportsLoading ? (
                  <div className="space-y-3">
                    {[0, 1, 2].map((item) => (
                      <div key={item} className="surface p-5">
                        <div className="h-4 w-44 animate-pulse rounded bg-line/70" />
                        <div className="mt-3 h-3 w-64 animate-pulse rounded bg-line/50" />
                        <div className="mt-4 h-16 w-full animate-pulse rounded-2xl bg-line/40" />
                      </div>
                    ))}
                  </div>
                ) : reports.length === 0 ? (
                  <EmptyState
                    title={`没有${REPORT_STATUS_LABELS[reportStatus]}的举报`}
                    description="切换上方状态查看其他队列，或等待新的举报提交。"
                    icon={<Flag className="size-5" />}
                  />
                ) : (
                  <div className="space-y-3">
                    {reports.map((report) => (
                      <AdminReportCard
                        key={report.id}
                        report={report}
                        busy={reportBusyId === report.id}
                        hiding={hidingReportId === report.id}
                        onAskHide={() => setHidingReportId(report.id)}
                        onCancelHide={() => setHidingReportId(null)}
                        onDismiss={() => decideReport(report, 'dismiss')}
                        onHide={() => decideReport(report, 'hide')}
                      />
                    ))}
                    {reportsHasMore ? (
                      <AdminLoadMore
                        loaded={reports.length}
                        total={reportsTotal}
                        loading={reportsLoadingMore}
                        onLoad={loadMoreReports}
                      />
                    ) : null}
                  </div>
                )}
              </>
            ) : mode === 'appeals' ? (
              <>
                <div className="flex flex-wrap gap-1.5">
                  {appealStatusTabs.map((tab) => (
                    <button
                      key={tab}
                      type="button"
                      onClick={() => {
                        setAppealStatus(tab);
                        setRestoringAppealId(null);
                      }}
                      className={`rounded-full border px-3 py-1.5 text-[11px] font-medium transition ${
                        appealStatus === tab
                          ? 'border-jade-700 bg-jade-700 text-white'
                          : 'border-line bg-white text-ink-600 hover:border-jade-300 hover:text-jade-700'
                      }`}
                    >
                      {APPEAL_STATUS_LABELS[tab]}
                    </button>
                  ))}
                </div>

                {appealsError ? (
                  <ErrorState message={appealsError} onRetry={reloadAppeals} />
                ) : appealsLoading ? (
                  <div className="space-y-3">
                    {[0, 1, 2].map((item) => (
                      <div key={item} className="surface p-5">
                        <div className="h-4 w-44 animate-pulse rounded bg-line/70" />
                        <div className="mt-3 h-3 w-64 animate-pulse rounded bg-line/50" />
                        <div className="mt-4 h-16 w-full animate-pulse rounded-2xl bg-line/40" />
                      </div>
                    ))}
                  </div>
                ) : appeals.length === 0 ? (
                  <EmptyState
                    title={`没有${APPEAL_STATUS_LABELS[appealStatus]}的申诉`}
                    description="切换上方状态查看其他队列，或等待作者提交新的申诉。"
                    icon={<Scale className="size-5" />}
                  />
                ) : (
                  <div className="space-y-3">
                    {appeals.map((appeal) => (
                      <AdminAppealCard
                        key={appeal.id}
                        appeal={appeal}
                        busy={appealBusyId === appeal.id}
                        restoring={restoringAppealId === appeal.id}
                        note={appealNotes[appeal.id] ?? ''}
                        onNoteChange={(value) =>
                          setAppealNotes((previous) => ({ ...previous, [appeal.id]: value }))
                        }
                        onAskRestore={() => setRestoringAppealId(appeal.id)}
                        onCancelRestore={() => setRestoringAppealId(null)}
                        onUphold={() => decideAppeal(appeal, 'uphold')}
                        onRestore={() => decideAppeal(appeal, 'restore')}
                      />
                    ))}
                    {appealsHasMore ? (
                      <AdminLoadMore
                        loaded={appeals.length}
                        total={appealsTotal}
                        loading={appealsLoadingMore}
                        onLoad={loadMoreAppeals}
                      />
                    ) : null}
                  </div>
                )}
              </>
            ) : mode === 'summaries' ? (
              <>
                <div className="flex flex-wrap gap-1.5">
                  {summaryFilterTabs.map((tab) => (
                    <button
                      key={tab}
                      type="button"
                      onClick={() => setSummaryFilter(tab)}
                      className={`rounded-full border px-3 py-1.5 text-[11px] font-medium transition ${
                        summaryFilter === tab
                          ? 'border-jade-700 bg-jade-700 text-white'
                          : 'border-line bg-white text-ink-600 hover:border-jade-300 hover:text-jade-700'
                      }`}
                    >
                      {tab === 'all' ? '全部' : SUMMARY_STATE_LABELS[tab]}
                    </button>
                  ))}
                </div>

                {summariesError ? (
                  <ErrorState message={summariesError} onRetry={reloadSummaries} />
                ) : summariesLoading ? (
                  <div className="space-y-3">
                    {[0, 1, 2].map((item) => (
                      <div key={item} className="surface p-5">
                        <div className="h-4 w-48 animate-pulse rounded bg-line/70" />
                        <div className="mt-3 h-3 w-72 animate-pulse rounded bg-line/50" />
                        <div className="mt-4 h-14 w-full animate-pulse rounded-2xl bg-line/40" />
                      </div>
                    ))}
                  </div>
                ) : summaries.length === 0 ? (
                  <EmptyState
                    title={
                      summaryFilter === 'all'
                        ? '当前没有教师摘要记录'
                        : `没有${SUMMARY_STATE_LABELS[summaryFilter]}的摘要`
                    }
                    description="切换上方状态查看其他摘要，或等待公开评价达到样本门槛后生成。"
                    icon={<Sparkles className="size-5" />}
                  />
                ) : (
                  <div className="space-y-3">
                    {summaries.map((summary) => (
                      <AdminSummaryCard
                        key={summary.teacher.id}
                        summary={summary}
                        busy={summaryBusyId === summary.teacher.id}
                        onRegenerate={() => regenerateSummary(summary)}
                      />
                    ))}
                    {summariesHasMore ? (
                      <AdminLoadMore
                        loaded={summaries.length}
                        total={summariesTotal}
                        loading={summariesLoadingMore}
                        onLoad={loadMoreSummaries}
                      />
                    ) : null}
                  </div>
                )}
              </>
            ) : (
              <>
                <div className="flex flex-wrap items-center gap-1.5">
                  {auditActorOptions.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setHistoryActor(option.value)}
                      className={`rounded-full border px-3 py-1.5 text-[11px] font-medium transition ${
                        historyActor === option.value
                          ? 'border-jade-700 bg-jade-700 text-white'
                          : 'border-line bg-white text-ink-600 hover:border-jade-300 hover:text-jade-700'
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                  <label className="relative ml-auto flex items-center">
                    <span className="sr-only">动作筛选</span>
                    <select
                      value={historyAction}
                      onChange={(event) =>
                        setHistoryAction(event.target.value as AdminAuditActionFilter)
                      }
                      className="select-field h-9 min-w-36 py-0 pl-3 pr-8 text-[11px]"
                    >
                      {auditActionOptions.map((action) => (
                        <option key={action} value={action}>
                          {action === 'all' ? '全部动作' : AUDIT_ACTION_LABELS[action]}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-2.5 size-3.5 text-ink-400" />
                  </label>
                </div>

                {historyError ? (
                  <ErrorState message={historyError} onRetry={reloadHistory} />
                ) : historyLoading ? (
                  <div className="surface space-y-3 p-5">
                    {[0, 1, 2, 3].map((item) => (
                      <div key={item}>
                        <div className="h-3.5 w-52 animate-pulse rounded bg-line/70" />
                        <div className="mt-2 h-3 w-32 animate-pulse rounded bg-line/50" />
                      </div>
                    ))}
                  </div>
                ) : history.length === 0 ? (
                  <EmptyState
                    title="没有匹配的治理动作"
                    description="调整操作者或动作筛选后重试；新的提交、审核、举报与申诉处理会自动记录。"
                    icon={<Activity className="size-5" />}
                  />
                ) : (
                  <div className="space-y-3">
                    <div className="surface px-5 py-2">
                      <ul className="divide-y divide-line/60">
                        {history.map((event) => (
                          <AdminRecentActionRow key={event.id} event={event} detailed />
                        ))}
                      </ul>
                    </div>
                    {historyHasMore ? (
                      <AdminLoadMore
                        loaded={history.length}
                        total={historyTotal}
                        loading={historyLoadingMore}
                        onLoad={loadMoreHistory}
                      />
                    ) : null}
                  </div>
                )}
              </>
            )}

            <div className="flex items-start gap-2.5 rounded-2xl border border-line bg-white/70 px-4 py-3 text-[10px] leading-relaxed text-ink-500">
              <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-jade-600" />
              <p>
                管理动作使用当前会话的 CSRF 令牌和对象版本号。版本冲突、过期状态或本人操作会被后端拒绝；
                评价通过/驳回/隐藏、举报处理、申诉复核与本人撤回都会写审计记录。摘要重建只读取当前公开评价，
                由本地确定性规则生成并标注为演示内容。此页面不提供 SQL、shell、导出学校身份或平台密钥的能力。
              </p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function AdminOverviewCard({
  icon,
  label,
  count,
  hint,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  count: number;
  hint: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`${label}：${count} 条，进入队列`}
      className="surface flex flex-col items-start p-4 text-left transition hover:border-jade-300 hover:shadow-sm"
    >
      <span className="flex size-8 items-center justify-center rounded-xl bg-paper text-jade-700 ring-1 ring-inset ring-line/70">
        {icon}
      </span>
      <span className="mt-3 text-2xl font-bold tracking-tight text-ink-950">{count}</span>
      <span className="mt-0.5 text-[11px] font-semibold text-ink-700">{label}</span>
      <span className="mt-1 text-[9px] leading-relaxed text-ink-400">{hint}</span>
    </button>
  );
}

function AdminRecentActionRow({
  event,
  detailed = false,
}: {
  event: AdminRecentActionDTO;
  detailed?: boolean;
}) {
  return (
    <li className="flex flex-wrap items-start justify-between gap-2 py-2.5">
      <div className="min-w-0">
        <p className="text-[11px] font-medium text-ink-800">
          {AUDIT_ACTION_LABELS[event.action]}
          <span className="font-normal text-ink-500">
            {' '}
            · {event.teacher.name} · {event.course.name}
          </span>
        </p>
        <p className="mt-0.5 text-[9px] text-ink-400">
          {AUDIT_ACTOR_LABELS[event.actor]} · {formatDateTime(event.createdAt)}
          {event.reasonCode ? ` · ${moderationReasonLabel(event.reasonCode)}` : ''}
          {detailed ? ` · 评价 ${event.reviewId} · 修订 v${event.revision}` : ''}
        </p>
      </div>
      <span className="rounded-full bg-paper px-2 py-0.5 text-[9px] text-ink-400">
        {event.fromStatus ? `${REVIEW_STATUS_LABELS[event.fromStatus]} → ` : ''}
        {REVIEW_STATUS_LABELS[event.toStatus]}
      </span>
    </li>
  );
}

function AdminLoadMore({
  loaded,
  total,
  loading,
  onLoad,
}: {
  loaded: number;
  total: number;
  loading: boolean;
  onLoad: () => void;
}) {
  return (
    <div className="flex justify-center pt-1">
      <button
        type="button"
        onClick={onLoad}
        disabled={loading}
        className="btn-secondary h-9 px-4 text-[11px]"
      >
        {loading ? (
          <LoaderCircle className="size-3.5 animate-spin" />
        ) : (
          <ChevronDown className="size-3.5" />
        )}
        {loading ? '正在加载' : `加载更多（已显示 ${loaded} / ${total}）`}
      </button>
    </div>
  );
}

function AdminSummaryCard({
  summary,
  busy,
  onRegenerate,
}: {
  summary: AdminSummaryDTO;
  busy: boolean;
  onRegenerate: () => void;
}) {
  const hint =
    summary.state === 'insufficient'
      ? `当前只有 ${summary.sampleCount} 条公开评价，未达到 ${RATING_MIN_SAMPLES} 条样本门槛；公开页面不会展示摘要。`
      : summary.state === 'generating'
        ? '公开来源已变化或摘要等待重建；公开页面会隐藏旧句子，避免引用过期。'
        : summary.state === 'unavailable'
          ? '尚未生成摘要；可基于当前公开评价生成，引用会指向现有公开评价。'
          : '摘要与当前公开来源保持同步；再次生成会用最新公开评价替换现有句子与引用。';

  return (
    <article className="surface p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`rounded-full px-2 py-0.5 text-[9px] font-semibold ring-1 ring-inset ${summaryStateTone(summary.state)}`}
            >
              {SUMMARY_STATE_LABELS[summary.state]}
            </span>
            <Link
              to={`/teachers/${summary.teacher.id}`}
              className="text-xs font-semibold text-ink-900 transition hover:text-jade-700"
            >
              {summary.teacher.name}
            </Link>
            <span className="text-[10px] text-ink-500">{summary.teacher.departmentName}</span>
          </div>
          <p className="mt-1.5 text-[10px] text-ink-400">
            公开样本 {summary.sampleCount} 条 · 摘要 {summary.sentenceCount} 句 · 来源版本{' '}
            {summary.teacherSummaryEpoch}
            {summary.generatedAt
              ? ` · 生成于 ${formatDateTime(summary.generatedAt)}`
              : ''}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-sun-50 px-2 py-0.5 text-[9px] font-medium text-sun-700">
            本地演示 · 非平台 AI
          </span>
          <button
            type="button"
            onClick={onRegenerate}
            disabled={busy || !summary.canRegenerate}
            title={summary.canRegenerate ? '使用当前公开评价重建摘要' : '公开样本不足，暂不可生成'}
            className="btn-secondary h-9 px-3 text-[11px]"
          >
            {busy ? (
              <LoaderCircle className="size-3.5 animate-spin" />
            ) : (
              <Sparkles className="size-3.5" />
            )}
            {busy
              ? '正在生成'
              : summary.canRegenerate
                ? summary.state === 'ready'
                  ? '重新生成'
                  : '生成摘要'
                : '样本不足'}
          </button>
        </div>
      </div>
      <p className="mt-3 rounded-xl bg-paper/55 px-3 py-2 text-[10px] leading-relaxed text-ink-500">
        {hint}
      </p>
    </article>
  );
}

function AdminAppealCard({
  appeal,
  busy,
  restoring,
  note,
  onNoteChange,
  onAskRestore,
  onCancelRestore,
  onUphold,
  onRestore,
}: {
  appeal: AppealDTO;
  busy: boolean;
  restoring: boolean;
  note: string;
  onNoteChange: (value: string) => void;
  onAskRestore: () => void;
  onCancelRestore: () => void;
  onUphold: () => void;
  onRestore: () => void;
}) {
  const pending = appeal.status === 'pending';
  const canRestore =
    pending && (appeal.review.status === 'rejected' || appeal.review.status === 'hidden');
  const excerpt =
    appeal.review.comment && appeal.review.comment.length > 200
      ? `${appeal.review.comment.slice(0, 200)}…`
      : appeal.review.comment;
  const previousReason = appeal.review.moderationReason
    ? moderationReasonLabel(appeal.review.moderationReason)
    : null;

  return (
    <article className="surface p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`rounded-full px-2 py-0.5 text-[9px] font-semibold ring-1 ring-inset ${appealStatusTone(appeal.status)}`}
            >
              {APPEAL_STATUS_LABELS[appeal.status]}
            </span>
            <span className="text-xs font-semibold text-ink-900">作者申诉</span>
            <span className="rounded-full bg-paper px-2 py-0.5 text-[9px] text-ink-400">
              评价状态：{REVIEW_STATUS_LABELS[appeal.review.status]}
            </span>
            {previousReason ? (
              <span className="rounded-full bg-paper px-2 py-0.5 text-[9px] text-ink-400">
                最近处理：{previousReason}
              </span>
            ) : null}
          </div>
          <p className="mt-1.5 text-[10px] text-ink-400">
            申诉于 {formatDate(appeal.createdAt)}
            {appeal.resolvedAt ? ` · 处理于 ${formatDate(appeal.resolvedAt)}` : ''} · 版本{' '}
            {appeal.version}
          </p>
        </div>
        <span className="rounded-full bg-paper px-2 py-0.5 font-mono text-[9px] text-ink-400">
          {appeal.id.slice(0, 8)}
        </span>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-line/70 bg-paper/45 px-3 py-2">
        <Link
          to={`/teachers/${appeal.review.teacher.id}`}
          className="text-xs font-semibold text-ink-900 transition hover:text-jade-700"
        >
          {appeal.review.teacher.name}
        </Link>
        <span className="text-[10px] text-ink-500">{appeal.review.course.name}</span>
        <span className="rounded-full bg-white px-2 py-0.5 text-[9px] text-ink-400">
          {appeal.review.term.label}
        </span>
      </div>

      <div className="mt-3 rounded-xl bg-paper/55 px-3 py-2.5">
        <p className="text-[9px] font-medium text-ink-400">申诉说明</p>
        <p className="mt-1 whitespace-pre-wrap text-[11px] leading-relaxed text-ink-700">
          {appeal.reason}
        </p>
      </div>

      {excerpt ? (
        <p className="mt-2 line-clamp-3 rounded-xl border border-line/60 px-3 py-2 text-[10px] leading-relaxed text-ink-500">
          被申诉评价：{excerpt}
        </p>
      ) : null}

      <div className="mt-3 grid grid-cols-2 gap-1.5 sm:grid-cols-4">
        {SCORE_DIMENSIONS.map((dimension) => (
          <div key={dimension.key} className="rounded-lg border border-line/60 bg-paper/50 px-2 py-1">
            <span className="block text-[9px] text-ink-400">{dimension.label}</span>
            <span className="mt-0.5 block text-[11px] font-semibold text-jade-700">
              {formatScore(appeal.review.scores[dimension.key])}
            </span>
          </div>
        ))}
      </div>

      {pending ? (
        <div className="mt-4 border-t border-line/60 pt-3.5">
          <label
            htmlFor={`appeal-note-${appeal.id}`}
            className="block text-[10px] font-semibold text-ink-600"
          >
            处理说明（可选，作者可见）
          </label>
          <textarea
            id={`appeal-note-${appeal.id}`}
            rows={2}
            maxLength={1000}
            value={note}
            onChange={(event) => onNoteChange(event.target.value)}
            disabled={busy}
            placeholder="说明复核依据或补充要求。"
            className="field mt-1.5 resize-y py-2 text-[11px]"
          />

          {restoring ? (
            <div className="mt-3 rounded-2xl border border-jade-100 bg-jade-50/50 p-3.5">
              <p className="flex items-center gap-2 text-[11px] font-semibold text-jade-800">
                <RotateCcw className="size-3.5" />
                确认恢复这条评价的公开状态？
              </p>
              <p className="mt-1 text-[10px] leading-relaxed text-jade-700">
                恢复后评价重新进入公开列表、公开评分与摘要来源；本申诉记为已支持，并写入审计记录。
              </p>
              <div className="mt-2.5 flex flex-wrap items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={onRestore}
                  disabled={busy}
                  className="inline-flex h-8 items-center gap-1 rounded-full bg-jade-700 px-3 text-[10px] font-semibold text-white transition hover:bg-jade-800 disabled:opacity-60"
                >
                  {busy ? (
                    <LoaderCircle className="size-3 animate-spin" />
                  ) : (
                    <RotateCcw className="size-3" />
                  )}
                  确认恢复公开
                </button>
                <button
                  type="button"
                  onClick={onCancelRestore}
                  disabled={busy}
                  className="text-[10px] font-medium text-ink-500 transition hover:text-ink-800"
                >
                  取消
                </button>
              </div>
            </div>
          ) : (
            <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2">
              <p className="flex items-center gap-1.5 text-[10px] text-ink-400">
                <ShieldCheck className="size-3" />
                {canRestore
                  ? '维持原判不会改变评价；恢复会立即更新公开统计。'
                  : '该评价当前不可恢复，只能维持原判。'}
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onUphold}
                  disabled={busy}
                  className="btn-secondary h-9 px-3.5 text-[11px]"
                >
                  {busy ? (
                    <LoaderCircle className="size-3.5 animate-spin" />
                  ) : (
                    <XCircle className="size-3.5" />
                  )}
                  维持原判
                </button>
                <button
                  type="button"
                  onClick={onAskRestore}
                  disabled={busy || !canRestore}
                  className="btn-primary h-9 px-3.5 text-[11px]"
                >
                  <RotateCcw className="size-3.5" />
                  恢复公开
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-line/60 pt-2.5 text-[10px]">
          <span
            className={`flex items-center gap-1 font-medium ${
              appeal.resolution === 'restored' ? 'text-jade-700' : 'text-ink-500'
            }`}
          >
            {appeal.resolution === 'restored' ? (
              <CheckCircle2 className="size-3" />
            ) : (
              <ShieldCheck className="size-3" />
            )}
            {appeal.resolution ? APPEAL_RESOLUTION_LABELS[appeal.resolution] : '已处理'}
          </span>
          {appeal.decisionNote ? (
            <span className="text-ink-500">处理说明：{appeal.decisionNote}</span>
          ) : null}
          <span className="ml-auto rounded-full bg-paper px-2 py-0.5 text-[9px] text-ink-400">
            申诉人身份未展示
          </span>
        </div>
      )}
    </article>
  );
}

function AdminReportCard({
  report,
  busy,
  hiding,
  onAskHide,
  onCancelHide,
  onDismiss,
  onHide,
}: {
  report: ReportDTO;
  busy: boolean;
  hiding: boolean;
  onAskHide: () => void;
  onCancelHide: () => void;
  onDismiss: () => void;
  onHide: () => void;
}) {
  const pending = report.status === 'pending';
  const canHide = pending && report.review.status === 'published';
  const excerpt =
    report.review.comment && report.review.comment.length > 200
      ? `${report.review.comment.slice(0, 200)}…`
      : report.review.comment;

  return (
    <article className="surface p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`rounded-full px-2 py-0.5 text-[9px] font-semibold ring-1 ring-inset ${reportStatusTone(report.status)}`}
            >
              {REPORT_STATUS_LABELS[report.status]}
            </span>
            <span className="text-xs font-semibold text-ink-900">
              {reportReasonLabel(report.reasonCode)}
            </span>
            <span className="rounded-full bg-paper px-2 py-0.5 text-[9px] text-ink-400">
              评价状态：{REVIEW_STATUS_LABELS[report.review.status]}
            </span>
          </div>
          <p className="mt-1.5 text-[10px] text-ink-400">
            举报于 {formatDate(report.createdAt)}
            {report.resolvedAt ? ` · 处理于 ${formatDate(report.resolvedAt)}` : ''} · 版本 {report.version}
          </p>
        </div>
        <span className="rounded-full bg-paper px-2 py-0.5 font-mono text-[9px] text-ink-400">
          {report.id.slice(0, 8)}
        </span>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-line/70 bg-paper/45 px-3 py-2">
        <Link
          to={`/teachers/${report.review.teacher.id}`}
          className="text-xs font-semibold text-ink-900 transition hover:text-jade-700"
        >
          {report.review.teacher.name}
        </Link>
        <span className="text-[10px] text-ink-500">{report.review.course.name}</span>
        <span className="rounded-full bg-white px-2 py-0.5 text-[9px] text-ink-400">
          {report.review.term.label}
        </span>
      </div>

      {report.note ? (
        <div className="mt-3 rounded-xl bg-paper/55 px-3 py-2.5">
          <p className="text-[9px] font-medium text-ink-400">举报说明</p>
          <p className="mt-1 whitespace-pre-wrap text-[11px] leading-relaxed text-ink-700">{report.note}</p>
        </div>
      ) : (
        <p className="mt-3 text-[10px] italic text-ink-400">举报人没有填写补充说明。</p>
      )}

      {excerpt ? (
        <p className="mt-2 line-clamp-3 rounded-xl border border-line/60 px-3 py-2 text-[10px] leading-relaxed text-ink-500">
          被举报内容：{excerpt}
        </p>
      ) : null}

      {pending ? (
        <div className="mt-4 border-t border-line/60 pt-3.5">
          {hiding ? (
            <div className="rounded-2xl border border-rose-100 bg-rose-50/50 p-3.5">
              <p className="flex items-center gap-2 text-[11px] font-semibold text-rose-700">
                <EyeOff className="size-3.5" />
                确认隐藏这条评价？
              </p>
              <p className="mt-1 text-[10px] leading-relaxed text-rose-600">
                隐藏后评价立即退出公开列表、公开评分与摘要来源，作者会在「我的」看到状态变化。
                此操作会同时处理该评价下所有待处理举报。
              </p>
              <div className="mt-2.5 flex flex-wrap items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={onHide}
                  disabled={busy}
                  className="inline-flex h-8 items-center gap-1 rounded-full bg-rose-600 px-3 text-[10px] font-semibold text-white transition hover:bg-rose-700 disabled:opacity-60"
                >
                  {busy ? <LoaderCircle className="size-3 animate-spin" /> : <EyeOff className="size-3" />}
                  确认隐藏
                </button>
                <button
                  type="button"
                  onClick={onCancelHide}
                  disabled={busy}
                  className="text-[10px] font-medium text-ink-500 transition hover:text-ink-800"
                >
                  取消
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="flex items-center gap-1.5 text-[10px] text-ink-400">
                <ShieldCheck className="size-3" />
                {canHide
                  ? '驳回会保留评价；隐藏会从公开统计中移除。'
                  : '该评价已不在公开状态，只能驳回举报。'}
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onDismiss}
                  disabled={busy}
                  className="btn-secondary h-9 px-3.5 text-[11px]"
                >
                  {busy ? (
                    <LoaderCircle className="size-3.5 animate-spin" />
                  ) : (
                    <XCircle className="size-3.5" />
                  )}
                  驳回举报
                </button>
                <button
                  type="button"
                  onClick={onAskHide}
                  disabled={busy || !canHide}
                  className="btn-primary h-9 px-3.5 text-[11px]"
                >
                  <EyeOff className="size-3.5" />
                  隐藏评价
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-line/60 pt-2.5 text-[10px]">
          <span className="flex items-center gap-1 font-medium text-ink-500">
            {report.resolution === 'hidden' ? (
              <CheckCircle2 className="size-3 text-jade-600" />
            ) : (
              <ShieldCheck className="size-3 text-ink-400" />
            )}
            {report.resolution ? REPORT_RESOLUTION_LABELS[report.resolution] : '已处理'}
          </span>
          <span className="ml-auto rounded-full bg-paper px-2 py-0.5 text-[9px] text-ink-400">
            举报人身份未展示
          </span>
        </div>
      )}
    </article>
  );
}

function AdminReviewCard({
  review,
  busy,
  rejecting,
  reason,
  auditOpen,
  auditEvents,
  auditLoading,
  auditError,
  revisionsOpen,
  revisions,
  revisionsLoading,
  revisionsError,
  onToggleAudit,
  onToggleRevisions,
  onReasonChange,
  onAskReject,
  onCancelReject,
  onApprove,
  onReject,
}: {
  review: AdminReviewDTO;
  busy: boolean;
  rejecting: boolean;
  reason: ModerationReasonCode;
  auditOpen: boolean;
  auditEvents: AuditEventDTO[];
  auditLoading: boolean;
  auditError: string | null;
  revisionsOpen: boolean;
  revisions: AdminReviewRevisionDTO[];
  revisionsLoading: boolean;
  revisionsError: string | null;
  onToggleAudit: () => void;
  onToggleRevisions: () => void;
  onReasonChange: (value: ModerationReasonCode) => void;
  onAskReject: () => void;
  onCancelReject: () => void;
  onApprove: () => void;
  onReject: () => void;
}) {
  const pending = review.status === 'pending';

  return (
    <article className="surface p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`rounded-full px-2 py-0.5 text-[9px] font-semibold ring-1 ring-inset ${reviewStatusTone(review.status)}`}
            >
              {REVIEW_STATUS_LABELS[review.status]}
            </span>
            <h2 className="text-sm font-bold text-ink-950">{review.teacher.name}</h2>
            <span className="text-[11px] text-ink-500">{review.course.name}</span>
            <span className="rounded-full bg-paper px-2 py-0.5 text-[9px] text-ink-400">
              {review.term.label}
            </span>
          </div>
          <p className="mt-1.5 text-[10px] text-ink-400">
            提交于 {formatDate(review.submittedAt)}
            {review.publishedAt ? ` · 公开于 ${formatDate(review.publishedAt)}` : ''} · 修订 {review.revision} · 版本{' '}
            {review.version}
          </p>
        </div>
        {!pending ? (
          <span className="flex items-center gap-1 rounded-full bg-paper px-2.5 py-1 text-[9px] text-ink-400">
            <Clock3 className="size-3" />
            仅待审核状态可执行动作
          </span>
        ) : null}
      </div>

      <div className="mt-3 grid grid-cols-2 gap-1.5 sm:grid-cols-4">
        {SCORE_DIMENSIONS.map((dimension) => (
          <div key={dimension.key} className="rounded-lg border border-line/60 bg-paper/50 px-2.5 py-1.5">
            <span className="block text-[9px] text-ink-400">{dimension.label}</span>
            <span className="mt-0.5 block text-[11px] font-semibold text-jade-700">
              {formatScore(review.scores[dimension.key])}
            </span>
          </div>
        ))}
      </div>

      {review.comment ? (
        <p className="mt-3 whitespace-pre-wrap rounded-xl bg-paper/45 px-3 py-2.5 text-[11px] leading-relaxed text-ink-700">
          {review.comment}
        </p>
      ) : (
        <p className="mt-3 text-[10px] italic text-ink-400">这条评价没有文字说明，只有维度评分。</p>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-1.5 text-[9px] text-ink-400">
        <span className="font-medium text-ink-500">描述项</span>
        {review.descriptive.difficulty !== null ? (
          <span className="rounded-full bg-paper px-1.5 py-0.5">难度 {review.descriptive.difficulty}/5</span>
        ) : null}
        {review.descriptive.workload !== null ? (
          <span className="rounded-full bg-paper px-1.5 py-0.5">作业量 {review.descriptive.workload}/5</span>
        ) : null}
        {review.descriptive.attendance ? (
          <span className="rounded-full bg-paper px-1.5 py-0.5">点名 {review.descriptive.attendance}</span>
        ) : null}
        {review.descriptive.difficulty === null &&
        review.descriptive.workload === null &&
        !review.descriptive.attendance ? (
          <span>未填写</span>
        ) : null}
      </div>

      {pending ? (
        <div className="mt-4 border-t border-line/60 pt-3.5">
          {rejecting ? (
            <div className="rounded-2xl border border-rose-100 bg-rose-50/50 p-3.5">
              <label htmlFor={`reason-${review.id}`} className="block text-[10px] font-semibold text-rose-700">
                驳回原因（作者可见）
              </label>
              <select
                id={`reason-${review.id}`}
                value={reason}
                onChange={(event) => onReasonChange(event.target.value as ModerationReasonCode)}
                disabled={busy}
                className="select-field mt-1.5 py-2 text-[11px]"
              >
                {MODERATION_REASON_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2">
                <p className="text-[9px] leading-relaxed text-rose-600">
                  驳回不会删除评价记录；作者可修改后重新送审，也可申诉或撤回。
                </p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={onReject}
                    disabled={busy}
                    className="inline-flex h-8 items-center gap-1 rounded-full bg-rose-600 px-3 text-[10px] font-semibold text-white transition hover:bg-rose-700 disabled:opacity-60"
                  >
                    {busy ? <LoaderCircle className="size-3 animate-spin" /> : <XCircle className="size-3" />}
                    确认驳回
                  </button>
                  <button
                    type="button"
                    onClick={onCancelReject}
                    disabled={busy}
                    className="text-[10px] font-medium text-ink-500 transition hover:text-ink-800"
                  >
                    取消
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="flex items-center gap-1.5 text-[10px] text-ink-400">
                <AlertCircle className="size-3" />
                通过后公开；驳回原因会回显给作者。
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onAskReject}
                  disabled={busy}
                  className="btn-secondary h-9 px-3.5 text-[11px]"
                >
                  <XCircle className="size-3.5" />
                  驳回
                </button>
                <button
                  type="button"
                  onClick={onApprove}
                  disabled={busy}
                  className="btn-primary h-9 px-3.5 text-[11px]"
                >
                  {busy ? (
                    <LoaderCircle className="size-3.5 animate-spin" />
                  ) : (
                    <CheckCircle2 className="size-3.5" />
                  )}
                  通过并公开
                </button>
              </div>
            </div>
          )}
        </div>
      ) : null}

      <div className="mt-4 border-t border-line/60 pt-3">
        <div className="grid gap-2 sm:grid-cols-2">
          <button
            type="button"
            onClick={onToggleRevisions}
            aria-expanded={revisionsOpen}
            className="flex items-center justify-between gap-2 rounded-xl bg-paper/55 px-3 py-2 text-[10px] font-semibold text-ink-500 transition hover:text-jade-700"
          >
            <span className="flex items-center gap-1.5">
              <Layers className="size-3.5" />
              {revisionsOpen ? '收起修订历史' : '查看修订历史'}
            </span>
            {revisionsOpen ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
          </button>
          <button
            type="button"
            onClick={onToggleAudit}
            aria-expanded={auditOpen}
            className="flex items-center justify-between gap-2 rounded-xl bg-paper/55 px-3 py-2 text-[10px] font-semibold text-ink-500 transition hover:text-jade-700"
          >
            <span className="flex items-center gap-1.5">
              <History className="size-3.5" />
              {auditOpen ? '收起审计记录' : '查看审计记录'}
            </span>
            {auditOpen ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
          </button>
        </div>

        {revisionsOpen ? (
          <div className="mt-3">
            {revisionsLoading ? (
              <p className="flex items-center gap-1.5 text-[10px] text-ink-400">
                <LoaderCircle className="size-3 animate-spin" />
                正在读取修订历史…
              </p>
            ) : revisionsError ? (
              <p className="rounded-xl border border-rose-100 bg-rose-50/60 px-3 py-2 text-[10px] text-rose-700">
                {revisionsError}
              </p>
            ) : revisions.length === 0 ? (
              <p className="text-[10px] text-ink-400">暂无修订记录。</p>
            ) : (
              <div className="space-y-2.5">
                {revisions.map((revision) => (
                  <div
                    key={revision.revision}
                    className={`rounded-xl border px-3 py-2.5 ${
                      revision.isCurrent
                        ? 'border-jade-200 bg-jade-50/40'
                        : 'border-line/70 bg-paper/40'
                    }`}
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[10px] font-semibold text-ink-800">
                        修订 {revision.revision}
                      </span>
                      <span
                        className={`rounded-full px-1.5 py-0.5 text-[8px] font-semibold ${
                          revision.isCurrent
                            ? 'bg-jade-700 text-white'
                            : 'bg-white text-ink-400'
                        }`}
                      >
                        {revision.isCurrent
                          ? '当前修订'
                          : revision.publishedAt
                            ? '历史公开版本'
                            : '历史未公开'}
                      </span>
                      <span className="ml-auto text-[9px] text-ink-300">
                        提交于 {formatDate(revision.submittedAt)}
                        {revision.publishedAt
                          ? ` · 公开于 ${formatDate(revision.publishedAt)}`
                          : ''}
                      </span>
                    </div>
                    <div className="mt-1.5 grid grid-cols-2 gap-1 sm:grid-cols-4">
                      {SCORE_DIMENSIONS.map((dimension) => (
                        <span
                          key={dimension.key}
                          className="rounded-md bg-white/75 px-1.5 py-1 text-[9px] text-ink-500"
                        >
                          {dimension.label}
                          <strong className="ml-1 text-[10px] text-ink-800">
                            {formatScore(revision.scores[dimension.key])}
                          </strong>
                        </span>
                      ))}
                    </div>
                    <p className="mt-1.5 whitespace-pre-wrap text-[10px] leading-relaxed text-ink-600">
                      {revision.comment ?? '（无文字说明）'}
                    </p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-1 text-[8px] text-ink-400">
                      {revision.descriptive.difficulty !== null ? (
                        <span className="rounded-full bg-white px-1.5 py-0.5">
                          难度 {revision.descriptive.difficulty}/5
                        </span>
                      ) : null}
                      {revision.descriptive.workload !== null ? (
                        <span className="rounded-full bg-white px-1.5 py-0.5">
                          作业量 {revision.descriptive.workload}/5
                        </span>
                      ) : null}
                      {revision.descriptive.attendance ? (
                        <span className="rounded-full bg-white px-1.5 py-0.5">
                          点名 {revision.descriptive.attendance}
                        </span>
                      ) : null}
                      {revision.descriptive.difficulty === null &&
                      revision.descriptive.workload === null &&
                      !revision.descriptive.attendance ? (
                        <span>未填写描述项</span>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            )}
            <p className="mt-2 text-[9px] leading-relaxed text-ink-300">
              修订历史只展示内容与版本；仅当前修订参与审核与公开，历史修订不包含作者身份。
            </p>
          </div>
        ) : null}

        {auditOpen ? (
          <div className="mt-3">
            {auditLoading ? (
              <p className="flex items-center gap-1.5 text-[10px] text-ink-400">
                <LoaderCircle className="size-3 animate-spin" />
                正在读取审计记录…
              </p>
            ) : auditError ? (
              <p className="rounded-xl border border-rose-100 bg-rose-50/60 px-3 py-2 text-[10px] text-rose-700">
                {auditError}
              </p>
            ) : auditEvents.length === 0 ? (
              <p className="text-[10px] text-ink-400">暂无审计记录。</p>
            ) : (
              <ol className="space-y-3 border-l border-line pl-4">
                {auditEvents.map((event) => (
                  <li key={event.id} className="relative">
                    <span className="absolute -left-[21px] top-1 size-2 rounded-full bg-jade-600 ring-4 ring-white" />
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[10px] font-semibold text-ink-800">
                        {AUDIT_ACTION_LABELS[event.action]}
                      </span>
                      <span className="rounded-full bg-paper px-1.5 py-0.5 text-[9px] text-ink-400">
                        {AUDIT_ACTOR_LABELS[event.actor]}
                      </span>
                      <span className="ml-auto text-[9px] text-ink-300">
                        {formatDateTime(event.createdAt)}
                      </span>
                    </div>
                    <p className="mt-0.5 text-[9px] leading-relaxed text-ink-400">
                      {event.fromStatus
                        ? `${REVIEW_STATUS_LABELS[event.fromStatus]} → `
                        : ''}
                      {REVIEW_STATUS_LABELS[event.toStatus]}
                      {event.reasonCode && event.reasonCode !== 'appeal_restore'
                        ? ` · ${moderationReasonLabel(event.reasonCode)}`
                        : ''}{' '}
                      · rev {event.revision}
                    </p>
                  </li>
                ))}
              </ol>
            )}
            <p className="mt-2 text-[9px] leading-relaxed text-ink-300">
              审计只展示动作与状态变化，不返回作者、举报人或申诉人的账号身份。
            </p>
          </div>
        ) : null}
      </div>
    </article>
  );
}
