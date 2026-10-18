import { useEffect, useState, type FormEvent } from 'react';
import {
  API_ERROR_CODES,
  ATTENDANCE_OPTIONS,
  ME_PATHS,
  SCORE_DIMENSIONS,
  type AttendanceFrequency,
  type OwnReviewDTO,
  type ScoreKey,
  type ScoreSet,
} from '@soclear/contracts';
import { AlertCircle, CheckCircle2, LoaderCircle, PenLine } from 'lucide-react';
import { Modal } from './Modal';
import { useToast } from './Toast';
import { ApiRequestError, apiRequest, errorMessage } from '../features/api/client';
import { useAuth } from '../features/auth/AuthProvider';

const editFormId = 'review-edit-form';

export function ReviewEditModal({
  open,
  onClose,
  review,
  onUpdated,
}: {
  open: boolean;
  onClose: () => void;
  review: OwnReviewDTO | null;
  onUpdated?: () => void;
}) {
  const { session, refresh } = useAuth();
  const toast = useToast();
  const [scores, setScores] = useState<Partial<Record<ScoreKey, number>>>({});
  const [difficulty, setDifficulty] = useState('');
  const [workload, setWorkload] = useState('');
  const [attendance, setAttendance] = useState('');
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !review) return;
    setScores(review.scores);
    setDifficulty(
      review.descriptive.difficulty !== null ? String(review.descriptive.difficulty) : '',
    );
    setWorkload(review.descriptive.workload !== null ? String(review.descriptive.workload) : '');
    setAttendance(review.descriptive.attendance ?? '');
    setComment(review.comment ?? '');
    setSubmitting(false);
    setError(null);
  }, [open, review?.id, review?.version, review?.status]);

  if (!review) return null;

  const scoresComplete = SCORE_DIMENSIONS.every((dimension) => Boolean(scores[dimension.key]));
  const canSubmit =
    Boolean(session?.authenticated) && scoresComplete && !submitting;
  const isPublishedRevision = review.status === 'published';
  const isRejectedRevision = review.status === 'rejected';
  const isHiddenRevision = review.status === 'hidden';
  const isResubmission =
    isPublishedRevision || isRejectedRevision || isHiddenRevision;

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!session?.csrfToken) {
      setError('会话校验信息缺失，请刷新页面后重新登录。');
      return;
    }
    if (!scoresComplete) {
      setError('请为四个评分维度都选择 1–5 分。');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      await apiRequest(ME_PATHS.reviewUpdate(review.id), {
        method: 'PATCH',
        credentials: 'include',
        csrfToken: session.csrfToken,
        body: {
          expectedVersion: review.version,
          scores: scores as ScoreSet,
          difficulty: difficulty ? Number(difficulty) : null,
          workload: workload ? Number(workload) : null,
          attendance: attendance ? (attendance as AttendanceFrequency) : null,
          comment: comment.trim() ? comment.trim() : null,
        },
      });
      toast(
        isPublishedRevision
          ? `已下架原公开版本并生成待审修订 v${review.revision + 1}，审核通过后恢复公开。`
          : isRejectedRevision
            ? `已生成待审修订 v${review.revision + 1}，重新进入审核队列。`
            : isHiddenRevision
              ? `已生成待审修订 v${review.revision + 1}，审核通过前内容仍不公开。`
              : `待审评价已更新为修订 v${review.revision + 1}，仍需人工审核。`,
        'success',
      );
      onUpdated?.();
      onClose();
    } catch (cause) {
      if (cause instanceof ApiRequestError) {
        if (cause.code === API_ERROR_CODES.reviewNotEditable) {
          setError('当前状态不允许修订：申诉可能正在复核，或评价已撤回。请关闭后查看最新状态。');
          onUpdated?.();
        } else if (cause.code === API_ERROR_CODES.versionConflict) {
          setError('评价已被其他操作更新，请关闭后刷新记录再编辑。');
          onUpdated?.();
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

  return (
    <Modal
      open={open}
      onClose={onClose}
      eyebrow={
        isPublishedRevision
          ? 'REVISE / 已公开评价'
          : isRejectedRevision
            ? 'REVISE / 驳回评价'
            : isHiddenRevision
              ? 'REVISE / 已隐藏评价'
              : 'EDIT / 待审评价'
      }
      title={`${isResubmission ? '修订' : '编辑'}对 ${review.teacher.name} 的评价`}
      description={
        isPublishedRevision
          ? '保存后当前公开版本会立即下架，教师统计与摘要来源同步失效；新修订需再次通过人工审核才会恢复公开。'
          : isRejectedRevision
            ? '保存后会生成新的待审修订并重新进入审核队列，历史内容与处理记录保留。'
            : isHiddenRevision
              ? '保存后会生成新的待审修订并重新进入审核队列；审核通过前内容仍不会公开，历史处理与申诉记录保留。'
              : '修改会生成新的待审修订，不会跳过人工审核；审核通过后内容将锁定。'
      }
      maxWidth="lg"
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
          <span className="text-[10px] leading-relaxed text-ink-400">
            当前修订 v{review.revision}；
            {isPublishedRevision
              ? '保存后公开版本立即下架，新修订审核通过后恢复展示。'
              : isRejectedRevision
                ? '保存后回到待审核，审核通过后才会公开。'
                : isHiddenRevision
                  ? '保存后回到待审核；审核通过前内容仍不会公开。'
                  : '保存后公开页面仍不会展示，直到审核通过。'}
          </span>
          <div className="flex items-center justify-end gap-2">
            <button type="button" onClick={onClose} className="btn-ghost h-10 px-3 text-xs">
              取消
            </button>
            <button
              type="submit"
              form={editFormId}
              disabled={!canSubmit}
              className="btn-primary h-10 px-4 text-xs"
            >
              {submitting ? (
                <>
                  <LoaderCircle className="size-3.5 animate-spin" />
                  {isResubmission ? '正在重新送审' : '正在保存'}
                </>
              ) : (
                <>
                  <PenLine className="size-3.5" />
                  {isResubmission ? '重新送审' : '保存修订'}
                </>
              )}
            </button>
          </div>
        </div>
      }
    >
      <form id={editFormId} onSubmit={submit} className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-line/70 bg-paper/45 px-3.5 py-2.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-ink-800">{review.course.name}</span>
            <span className="rounded-full bg-white px-2 py-0.5 text-[9px] text-ink-400">
              {review.term.label}
            </span>
          </div>
          <span className="rounded-full bg-white px-2 py-0.5 font-mono text-[9px] text-ink-400">
            v{review.version} · rev {review.revision}
          </span>
        </div>

        <div>
          <div className="flex items-center justify-between gap-2">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-ink-900">
              <PenLine className="size-4 text-jade-600" />
              四个必填维度
            </h3>
            <span className="text-[9px] text-ink-400">1 分最低 · 5 分最高</span>
          </div>
          <div className="mt-2.5 space-y-3">
            {SCORE_DIMENSIONS.map((dimension) => (
              <fieldset key={dimension.key}>
                <legend className="flex w-full items-center justify-between gap-3">
                  <span className="text-[11px] font-semibold text-ink-700">{dimension.label}</span>
                  <span
                    className={`text-[9px] font-medium ${
                      scores[dimension.key] ? 'text-jade-700' : 'text-ink-300'
                    }`}
                  >
                    {scores[dimension.key] ? `${scores[dimension.key]} / 5` : '必填'}
                  </span>
                </legend>
                <div className="mt-1.5 grid grid-cols-5 gap-1.5">
                  {[1, 2, 3, 4, 5].map((value) => {
                    const selected = scores[dimension.key] === value;
                    return (
                      <label
                        key={value}
                        className={`flex h-9 cursor-pointer items-center justify-center rounded-xl border text-xs font-semibold transition focus-within:ring-2 focus-within:ring-jade-300 focus-within:ring-offset-1 ${
                          selected
                            ? 'border-jade-700 bg-jade-700 text-white'
                            : 'border-line bg-white text-ink-500 hover:border-jade-300 hover:text-jade-700'
                        }`}
                      >
                        <input
                          type="radio"
                          name={`edit-score-${dimension.key}`}
                          value={value}
                          checked={selected}
                          onChange={() =>
                            setScores((previous) => ({ ...previous, [dimension.key]: value }))
                          }
                          disabled={submitting}
                          className="sr-only"
                        />
                        {value}
                      </label>
                    );
                  })}
                </div>
              </fieldset>
            ))}
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <label htmlFor="edit-difficulty" className="mb-1.5 block text-[10px] font-medium text-ink-500">
              难度（可选）
            </label>
            <select
              id="edit-difficulty"
              value={difficulty}
              onChange={(event) => setDifficulty(event.target.value)}
              disabled={submitting}
              className="select-field py-2.5 text-xs"
            >
              <option value="">不填写</option>
              {[1, 2, 3, 4, 5].map((value) => (
                <option key={value} value={value}>
                  {value} / 5
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="edit-workload" className="mb-1.5 block text-[10px] font-medium text-ink-500">
              作业量（可选）
            </label>
            <select
              id="edit-workload"
              value={workload}
              onChange={(event) => setWorkload(event.target.value)}
              disabled={submitting}
              className="select-field py-2.5 text-xs"
            >
              <option value="">不填写</option>
              {[1, 2, 3, 4, 5].map((value) => (
                <option key={value} value={value}>
                  {value} / 5
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="edit-attendance" className="mb-1.5 block text-[10px] font-medium text-ink-500">
              点名情况（可选）
            </label>
            <select
              id="edit-attendance"
              value={attendance}
              onChange={(event) => setAttendance(event.target.value)}
              disabled={submitting}
              className="select-field py-2.5 text-xs"
            >
              <option value="">不填写</option>
              {ATTENDANCE_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between gap-2">
            <label htmlFor="edit-comment" className="text-[10px] font-medium text-ink-500">
              文字说明（可选，最多 1000 字）
            </label>
            <span className="text-[9px] text-ink-300">{comment.length} / 1000</span>
          </div>
          <textarea
            id="edit-comment"
            rows={4}
            maxLength={1000}
            value={comment}
            onChange={(event) => setComment(event.target.value)}
            disabled={submitting}
            placeholder="可以补充课堂体验、作业与考核安排等具体信息。请勿包含教师或同学的隐私、联系方式和人身攻击。"
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
          <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-jade-600" />
          <p>
            {isPublishedRevision
              ? '公开内容会在保存后立即下架，公开统计与摘要来源同步失效；只有新修订重新审核通过后才恢复展示。教师、课程、学期与评价名额保持不变。'
              : isRejectedRevision
                ? '重新送审会在原记录上生成新修订，保留历史驳回与申诉记录，不改变教师、课程、学期与评价名额。'
                : isHiddenRevision
                  ? '重新送审会在原记录上生成新修订，保留历史隐藏与申诉记录；审核通过前内容不会恢复公开，教师与课程范围保持不变。'
                  : '保存只更新当前待审修订，不改变教师、课程、学期与评价名额。管理员仍会看到最新内容；审核通过、驳回或撤回后，这份评价将不可再编辑。'}
          </p>
        </div>
      </form>
    </Modal>
  );
}
