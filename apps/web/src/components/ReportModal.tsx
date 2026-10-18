import { useEffect, useState, type FormEvent } from 'react';
import {
  API_ERROR_CODES,
  ME_PATHS,
  REPORT_REASONS,
  type PublicReviewDTO,
  type ReportReasonCode,
} from '@soclear/contracts';
import { AlertCircle, Flag, LoaderCircle, ShieldCheck } from 'lucide-react';
import { Modal } from './Modal';
import { useToast } from './Toast';
import { ApiRequestError, apiRequest, errorMessage } from '../features/api/client';
import { useAuth } from '../features/auth/AuthProvider';
import { LoginPanel } from '../features/auth/LoginPanel';

const reportFormId = 'report-submission-form';

export function ReportModal({
  open,
  onClose,
  review,
  teacherName,
  onSubmitted,
}: {
  open: boolean;
  onClose: () => void;
  review: PublicReviewDTO | null;
  teacherName: string;
  onSubmitted?: () => void;
}) {
  const { session, refresh } = useAuth();
  const toast = useToast();
  const [reason, setReason] = useState<ReportReasonCode>('privacy');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setReason('privacy');
    setNote('');
    setSubmitting(false);
    setError(null);
  }, [open, review?.id]);

  if (!review) return null;

  const excerpt =
    review.comment && review.comment.length > 160
      ? `${review.comment.slice(0, 160)}…`
      : review.comment;

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!session?.csrfToken) {
      setError('会话校验信息缺失，请刷新页面后重新登录。');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      await apiRequest(ME_PATHS.reports, {
        method: 'POST',
        credentials: 'include',
        csrfToken: session.csrfToken,
        body: {
          reviewId: review.id,
          reasonCode: reason,
          note: note.trim() || null,
        },
      });
      toast('举报已提交，管理员会核查；处理结果可在「我的」查看。', 'success');
      onSubmitted?.();
      onClose();
    } catch (cause) {
      if (cause instanceof ApiRequestError) {
        if (cause.code === API_ERROR_CODES.reportAlreadyExists) {
          setError('你已经举报过这条评价，请等待管理员处理。');
        } else if (cause.code === API_ERROR_CODES.reportSelfForbidden) {
          setError('不能举报自己提交的评价。');
        } else if (cause.code === API_ERROR_CODES.reportNotActionable) {
          setError('这条评价已不在公开状态，无法举报。');
        } else if (
          cause.code === API_ERROR_CODES.unauthenticated ||
          cause.code === API_ERROR_CODES.csrfFailed
        ) {
          setError('会话已失效或校验失败，请刷新页面后重新登录。');
          await refresh().catch(() => undefined);
        } else {
          setError(cause.message);
        }
      } else {
        setError(errorMessage(cause));
      }
      setSubmitting(false);
    }
  };

  const footer = session?.authenticated ? (
    <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
      <span className="text-[10px] leading-relaxed text-ink-400">
        举报不会自动删除评价；内容是否隐藏由管理员核查后决定。
      </span>
      <div className="flex items-center justify-end gap-2">
        <button type="button" onClick={onClose} className="btn-ghost h-10 px-3 text-xs">
          取消
        </button>
        <button
          type="submit"
          form={reportFormId}
          disabled={submitting}
          className="btn-primary h-10 px-4 text-xs"
        >
          {submitting ? (
            <>
              <LoaderCircle className="size-3.5 animate-spin" />
              正在提交
            </>
          ) : (
            <>
              <Flag className="size-3.5" />
              提交举报
            </>
          )}
        </button>
      </div>
    </div>
  ) : undefined;

  return (
    <Modal
      open={open}
      onClose={onClose}
      eyebrow="REPORT / 举报"
      title="举报这条公开评价"
      description="举报用于核查隐私、攻击、虚假信息或无关内容；不会自动删除评价，也不会公开举报人信息。"
      footer={footer}
    >
      <div className="space-y-4">
        <div className="rounded-2xl border border-line/80 bg-paper/50 p-3.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-ink-900">{teacherName}</span>
            <span className="text-[10px] text-ink-500">{review.course.name}</span>
            <span className="rounded-full bg-white px-2 py-0.5 text-[9px] text-ink-400">
              {review.term.label}
            </span>
          </div>
          <p className="mt-2 line-clamp-4 text-[11px] leading-relaxed text-ink-600">
            {excerpt ?? '这条评价没有文字说明，只有维度评分。'}
          </p>
        </div>

        {!session?.authenticated ? (
          <LoginPanel
            compact
            title="登录后提交举报"
            description="任何本地演示账号都可以举报公开内容；举报人身份不会出现在公开页面或审核队列中。"
          />
        ) : (
          <form id={reportFormId} onSubmit={submit} className="space-y-4">
            <div>
              <label htmlFor="report-reason" className="mb-1.5 block text-[11px] font-semibold text-ink-700">
                举报原因
              </label>
              <select
                id="report-reason"
                value={reason}
                onChange={(event) => setReason(event.target.value as ReportReasonCode)}
                disabled={submitting}
                className="select-field py-2.5 text-xs"
              >
                {REPORT_REASONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <div className="flex items-center justify-between gap-2">
                <label htmlFor="report-note" className="text-[11px] font-semibold text-ink-700">
                  补充说明（可选，最多 1000 字）
                </label>
                <span className="text-[9px] text-ink-300">{note.length} / 1000</span>
              </div>
              <textarea
                id="report-note"
                rows={4}
                maxLength={1000}
                value={note}
                onChange={(event) => setNote(event.target.value)}
                disabled={submitting}
                placeholder="说明需要核查的具体问题。请勿提交教师或同学的联系方式、学号等隐私信息。"
                className="field mt-1.5 resize-y py-2.5 text-xs"
              />
            </div>

            {error ? (
              <p
                role="alert"
                className="flex items-start gap-2 rounded-xl border border-rose-100 bg-rose-50/70 px-3 py-2.5 text-[11px] leading-relaxed text-rose-700"
              >
                <AlertCircle className="mt-0.5 size-3.5 shrink-0" />
                {error}
              </p>
            ) : null}

            <div className="flex items-start gap-2.5 rounded-2xl bg-paper/70 p-3.5 text-[10px] leading-relaxed text-ink-500">
              <ShieldCheck className="mt-0.5 size-4 shrink-0 text-jade-600" />
              <p>
                同一账号对同一条评价只能提交一次举报。管理员可以驳回举报，或在核实后隐藏评价；
                隐藏会立即影响公开统计与摘要来源，作者可在「我的」看到状态变化。
              </p>
            </div>
          </form>
        )}
      </div>
    </Modal>
  );
}
