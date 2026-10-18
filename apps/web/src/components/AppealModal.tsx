import { useEffect, useState, type FormEvent } from 'react';
import {
  API_ERROR_CODES,
  ME_PATHS,
  type OwnReviewDTO,
} from '@soclear/contracts';
import { AlertCircle, LoaderCircle, Scale, ShieldCheck } from 'lucide-react';
import { Modal } from './Modal';
import { useToast } from './Toast';
import { ApiRequestError, apiRequest, errorMessage } from '../features/api/client';
import { useAuth } from '../features/auth/AuthProvider';
import {
  moderationReasonLabel,
  type ModerationReasonCode,
} from '../features/auth/labels';

const appealFormId = 'appeal-submission-form';

export function AppealModal({
  open,
  onClose,
  review,
  onSubmitted,
}: {
  open: boolean;
  onClose: () => void;
  review: OwnReviewDTO | null;
  onSubmitted?: () => void;
}) {
  const { session, refresh } = useAuth();
  const toast = useToast();
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setReason('');
    setSubmitting(false);
    setError(null);
  }, [open, review?.id]);

  if (!review) return null;

  const excerpt =
    review.comment && review.comment.length > 160
      ? `${review.comment.slice(0, 160)}…`
      : review.comment;
  const previousReason = review.moderationReason
    ? moderationReasonLabel(review.moderationReason as ModerationReasonCode)
    : null;

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = reason.trim();
    if (trimmed.length < 10) {
      setError('请至少填写 10 个字，说明需要复核的具体内容。');
      return;
    }
    if (!session?.csrfToken) {
      setError('会话校验信息缺失，请刷新页面后重新登录。');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      await apiRequest(ME_PATHS.appeals, {
        method: 'POST',
        credentials: 'include',
        csrfToken: session.csrfToken,
        body: { reviewId: review.id, reason: trimmed },
      });
      toast('申诉已提交，管理员复核后会更新处理结果。', 'success');
      onSubmitted?.();
      onClose();
    } catch (cause) {
      if (cause instanceof ApiRequestError) {
        if (cause.code === API_ERROR_CODES.appealAlreadyExists) {
          setError('这条评价已经提交过申诉，不能重复提交。');
        } else if (cause.code === API_ERROR_CODES.appealNotActionable) {
          setError('当前评价状态不允许申诉，请刷新后查看最新状态。');
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

  const footer = (
    <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
      <span className="text-[10px] leading-relaxed text-ink-400">
        每份评价只能申诉一次；维持原判后仍可修改并重新送审或撤回评价。
      </span>
      <div className="flex items-center justify-end gap-2">
        <button type="button" onClick={onClose} className="btn-ghost h-10 px-3 text-xs">
          取消
        </button>
        <button
          type="submit"
          form={appealFormId}
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
              <Scale className="size-3.5" />
              提交申诉
            </>
          )}
        </button>
      </div>
    </div>
  );

  return (
    <Modal
      open={open}
      onClose={onClose}
      eyebrow="APPEAL / 申诉"
      title="对处理结果提出申诉"
      description="申诉用于复核驳回或隐藏决定；不会自动恢复评价，申诉人身份不会出现在公开页面或审核队列中。"
      footer={footer}
    >
      <div className="space-y-4">
        <div className="rounded-2xl border border-line/80 bg-paper/50 p-3.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-ink-900">{review.teacher.name}</span>
            <span className="text-[10px] text-ink-500">{review.course.name}</span>
            <span className="rounded-full bg-white px-2 py-0.5 text-[9px] text-ink-400">
              {review.term.label}
            </span>
          </div>
          <p className="mt-2 line-clamp-4 text-[11px] leading-relaxed text-ink-600">
            {excerpt ?? '这条评价没有文字说明，只有维度评分。'}
          </p>
          {previousReason ? (
            <p className="mt-2 text-[10px] text-ink-400">上一次处理原因：{previousReason}</p>
          ) : null}
        </div>

        <form id={appealFormId} onSubmit={submit} className="space-y-4">
          <div>
            <div className="flex items-center justify-between gap-2">
              <label htmlFor="appeal-reason" className="text-[11px] font-semibold text-ink-700">
                申诉说明（必填，10–1000 字）
              </label>
              <span className="text-[9px] text-ink-300">{reason.length} / 1000</span>
            </div>
            <textarea
              id="appeal-reason"
              rows={5}
              minLength={10}
              maxLength={1000}
              required
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              disabled={submitting}
              placeholder="说明原处理结果可能遗漏的课堂事实、课程背景或引用依据，便于管理员复核。请勿填写教师或同学的联系方式、学号等隐私信息。"
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
              管理员可以维持原判，或在核实后恢复公开。恢复会重新计入公开评分与摘要来源，
              并写入审计记录；每份评价只能提交一次申诉。
            </p>
          </div>
        </form>
      </div>
    </Modal>
  );
}
