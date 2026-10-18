import { useEffect, useState, type FormEvent } from 'react';
import {
  API_ERROR_CODES,
  ATTENDANCE_OPTIONS,
  ME_PATHS,
  PUBLIC_PATHS,
  SCORE_DIMENSIONS,
  type AttendanceFrequency,
  type ReviewSubmissionInput,
  type ScoreKey,
  type ScoreSet,
  type TeacherPublicDTO,
  type TermDTO,
} from '@soclear/contracts';
import {
  AlertCircle,
  BadgeCheck,
  CheckCircle2,
  Clock3,
  LoaderCircle,
  LockKeyhole,
  PenLine,
  ShieldCheck,
} from 'lucide-react';
import { Modal } from './Modal';
import { useToast } from './Toast';
import { ApiRequestError, apiGet, apiRequest, errorMessage } from '../features/api/client';
import { useAuth } from '../features/auth/AuthProvider';
import { LoginPanel } from '../features/auth/LoginPanel';

const submitFormId = 'review-submission-form';

export function ReviewEntryModal({
  open,
  onClose,
  teacher,
  onSubmitted,
}: {
  open: boolean;
  onClose: () => void;
  teacher: TeacherPublicDTO;
  onSubmitted?: () => void;
}) {
  const { session, refresh, logout } = useAuth();
  const toast = useToast();
  const [courseId, setCourseId] = useState(teacher.courses[0]?.id ?? '');
  const [termId, setTermId] = useState('');
  const [terms, setTerms] = useState<TermDTO[]>([]);
  const [termsLoading, setTermsLoading] = useState(false);
  const [termsError, setTermsError] = useState<string | null>(null);
  const [scores, setScores] = useState<Partial<Record<ScoreKey, number>>>({});
  const [difficulty, setDifficulty] = useState('');
  const [workload, setWorkload] = useState('');
  const [attendance, setAttendance] = useState('');
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const grantActive = session?.studentGrant.state === 'active';

  useEffect(() => {
    if (!open) return;
    setCourseId(teacher.courses[0]?.id ?? '');
    setScores({});
    setDifficulty('');
    setWorkload('');
    setAttendance('');
    setComment('');
    setError(null);
    setSubmitting(false);
  }, [open, teacher.id]);

  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    setTermsLoading(true);
    setTermsError(null);

    apiGet<TermDTO[]>(PUBLIC_PATHS.terms, controller.signal)
      .then((result) => {
        setTerms(result.data);
        setTermId(result.data.find((term) => term.isCurrent)?.id ?? result.data[0]?.id ?? '');
        setTermsLoading(false);
      })
      .catch((cause: unknown) => {
        if (controller.signal.aborted) return;
        setTermsError(errorMessage(cause));
        setTermsLoading(false);
      });

    return () => controller.abort();
  }, [open]);

  const setScore = (key: ScoreKey, value: number) => {
    setScores((previous) => ({ ...previous, [key]: value }));
  };

  const scoresComplete = SCORE_DIMENSIONS.every((dimension) => Boolean(scores[dimension.key]));
  const canSubmit =
    Boolean(session?.authenticated) &&
    grantActive &&
    teacher.courses.length > 0 &&
    Boolean(courseId) &&
    Boolean(termId) &&
    scoresComplete &&
    !submitting &&
    !termsLoading;

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
    if (!courseId || !termId) {
      setError('请选择课程与学期。');
      return;
    }

    const payload: ReviewSubmissionInput = {
      teacherId: teacher.id,
      courseId,
      termId,
      scores: scores as ScoreSet,
      difficulty: difficulty ? Number(difficulty) : null,
      workload: workload ? Number(workload) : null,
      attendance: attendance ? (attendance as AttendanceFrequency) : null,
      comment: comment.trim() ? comment.trim() : null,
    };

    setSubmitting(true);
    setError(null);
    try {
      await apiRequest(ME_PATHS.reviews, {
        method: 'POST',
        credentials: 'include',
        csrfToken: session.csrfToken,
        body: payload,
      });
      toast('评价已提交，等待内容管理员审核；通过后才会进入公开统计。', 'success');
      onSubmitted?.();
      onClose();
    } catch (cause) {
      if (cause instanceof ApiRequestError) {
        if (cause.code === API_ERROR_CODES.reviewSlotTaken) {
          setError('你已有一份未撤回的同教师、同课程、同学期评价。请在「我的」中修订或撤回后再提交。');
        } else if (cause.code === API_ERROR_CODES.verificationRequired) {
          setError('当前账号没有有效的匿名学生资格，无法提交评价。');
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

  const footer =
    session?.authenticated && grantActive ? (
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
        <span className="text-[10px] leading-relaxed text-ink-400">
          提交即表示你确认内容来自本人真实课堂体验，并同意经过人工审核。
        </span>
        <div className="flex items-center justify-end gap-2">
          <button type="button" onClick={onClose} className="btn-ghost h-10 px-3 text-xs">
            取消
          </button>
          <button
            type="submit"
            form={submitFormId}
            disabled={!canSubmit}
            className="btn-primary h-10 px-4 text-xs"
          >
            {submitting ? (
              <>
                <LoaderCircle className="size-3.5 animate-spin" />
                正在提交
              </>
            ) : (
              <>
                <PenLine className="size-3.5" />
                提交审核
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
      eyebrow="REVIEW / 评价"
      title={`评价 ${teacher.name} 的课`}
      description="四维评分与文字说明分开呈现；提交后需要人工审核，作者身份不会随评价公开。"
      footer={footer}
      maxWidth="lg"
    >
      {!session?.authenticated ? (
        <div className="space-y-4">
          <div className="flex items-start gap-2.5 rounded-2xl border border-jade-100 bg-jade-50/60 p-3.5">
            <LockKeyhole className="mt-0.5 size-4 shrink-0 text-jade-700" />
            <div className="text-[11px] leading-relaxed text-jade-800">
              <p className="font-semibold">提交评价需要登录并具备有效的匿名学生资格</p>
              <p className="mt-0.5 text-jade-700/90">
                当前为本地演示环境，可使用下方演示学生账号体验完整流程；登录只用于本地合成数据。
              </p>
            </div>
          </div>
          <LoginPanel
            compact
            title="登录后继续"
            description="使用演示学生账号提交评价；普通用户账号可以登录，但没有学生资格。"
          />
        </div>
      ) : !grantActive ? (
        <div className="space-y-4">
          <div className="flex items-start gap-3 rounded-2xl border border-rose-100 bg-rose-50/60 p-4">
            <AlertCircle className="mt-0.5 size-4 shrink-0 text-rose-500" />
            <div>
              <p className="text-xs font-semibold text-rose-700">当前账号没有有效的匿名学生资格</p>
              <p className="mt-1 text-[11px] leading-relaxed text-rose-700/90">
                登录不等于具备学生资格。请切换到下面标注为「认证学生（演示）」的账号，或等真实匿名认证接入后再提交。
              </p>
            </div>
          </div>
          <div className="flex items-center justify-between gap-3 rounded-2xl bg-paper/60 px-3.5 py-2.5">
            <p className="text-[10px] text-ink-500">
              当前账号：{session.account?.displayName}（{session.mainGroup}）
            </p>
            <button
              type="button"
              onClick={async () => {
                try {
                  await logout();
                  toast('已退出登录，可以切换账号。', 'info');
                } catch (cause) {
                  toast(errorMessage(cause), 'error');
                }
              }}
              className="btn-secondary h-8 shrink-0 px-3 text-[10px]"
            >
              切换账号
            </button>
          </div>
        </div>
      ) : (
        <form id={submitFormId} onSubmit={submit} className="space-y-5">
          <div className="flex items-start gap-2.5 rounded-2xl border border-jade-100 bg-jade-50/60 p-3">
            <BadgeCheck className="mt-0.5 size-4 shrink-0 text-jade-700" />
            <p className="text-[10px] leading-relaxed text-jade-700">
              以 <span className="font-semibold">{session.account?.displayName}</span> 的匿名学生资格提交；
              公开页面只会显示「匿名在校生」。
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="review-course" className="mb-1.5 block text-[11px] font-semibold text-ink-700">
                课程
              </label>
              {teacher.courses.length > 0 ? (
                <select
                  id="review-course"
                  className="select-field py-2.5 text-xs"
                  value={courseId}
                  onChange={(event) => setCourseId(event.target.value)}
                  disabled={submitting}
                >
                  {teacher.courses.map((course) => (
                    <option key={course.id} value={course.id}>
                      {course.name}
                    </option>
                  ))}
                </select>
              ) : (
                <p className="rounded-xl bg-rose-50/60 px-3 py-2 text-[10px] text-rose-700">
                  该教师的公开课程尚未接入，暂时无法选择课程。
                </p>
              )}
            </div>
            <div>
              <label htmlFor="review-term" className="mb-1.5 block text-[11px] font-semibold text-ink-700">
                学期
              </label>
              <select
                id="review-term"
                className="select-field py-2.5 text-xs"
                value={termId}
                onChange={(event) => setTermId(event.target.value)}
                disabled={submitting || termsLoading || terms.length === 0}
              >
                {terms.length === 0 ? <option value="">暂无可用学期</option> : null}
                {terms.map((term) => (
                  <option key={term.id} value={term.id}>
                    {term.label}
                    {term.isCurrent ? '（本学期）' : ''}
                  </option>
                ))}
              </select>
              {termsError ? (
                <p className="mt-1 text-[9px] text-rose-600">学期加载失败：{termsError}</p>
              ) : null}
            </div>
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
                            name={`score-${dimension.key}`}
                            value={value}
                            checked={selected}
                            onChange={() => setScore(dimension.key, value)}
                            disabled={submitting}
                            className="sr-only"
                          />
                          {value}
                        </label>
                      );
                    })}
                  </div>
                  <div className="mt-1 flex justify-between text-[9px] text-ink-400">
                    <span>{dimension.low}</span>
                    <span>{dimension.high}</span>
                  </div>
                </fieldset>
              ))}
            </div>
            <p className="mt-2 text-[10px] leading-relaxed text-ink-400">
              综合分是四个维度的算术平均值；难度、作业量与点名情况只作描述性选项，不参与总分。
            </p>
          </div>

          <div>
            <h3 className="flex items-center gap-2 text-sm font-semibold text-ink-900">
              <ShieldCheck className="size-4 text-jade-600" />
              描述项与文字说明
            </h3>
            <div className="mt-2.5 grid gap-3 sm:grid-cols-3">
              <div>
                <label htmlFor="review-difficulty" className="mb-1.5 block text-[10px] font-medium text-ink-500">
                  课程难度（可选）
                </label>
                <select
                  id="review-difficulty"
                  className="select-field py-2 text-[11px]"
                  value={difficulty}
                  onChange={(event) => setDifficulty(event.target.value)}
                  disabled={submitting}
                >
                  <option value="">不填</option>
                  {[1, 2, 3, 4, 5].map((value) => (
                    <option key={value} value={value}>
                      {value} / 5
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="review-workload" className="mb-1.5 block text-[10px] font-medium text-ink-500">
                  作业量（可选）
                </label>
                <select
                  id="review-workload"
                  className="select-field py-2 text-[11px]"
                  value={workload}
                  onChange={(event) => setWorkload(event.target.value)}
                  disabled={submitting}
                >
                  <option value="">不填</option>
                  {[1, 2, 3, 4, 5].map((value) => (
                    <option key={value} value={value}>
                      {value} / 5
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="review-attendance" className="mb-1.5 block text-[10px] font-medium text-ink-500">
                  点名情况（可选）
                </label>
                <select
                  id="review-attendance"
                  className="select-field py-2 text-[11px]"
                  value={attendance}
                  onChange={(event) => setAttendance(event.target.value)}
                  disabled={submitting}
                >
                  <option value="">不填</option>
                  {ATTENDANCE_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mt-3">
              <div className="flex items-center justify-between gap-2">
                <label htmlFor="review-comment" className="text-[10px] font-medium text-ink-500">
                  文字说明（可选，最多 1000 字）
                </label>
                <span className="text-[9px] text-ink-300">{comment.length} / 1000</span>
              </div>
              <textarea
                id="review-comment"
                rows={4}
                maxLength={1000}
                value={comment}
                onChange={(event) => setComment(event.target.value)}
                disabled={submitting}
                placeholder="可以写课堂体验、作业与考核安排等具体信息。请勿包含教师或同学的隐私、联系方式和人身攻击。"
                className="field mt-1.5 resize-y py-2.5 text-xs"
              />
            </div>
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
              同一作者、教师、课程与学期只保留一份未撤回评价。公开前由内容管理员审核；作者不能审核自己的评价。
              驳回原因只对你和管理员可见，公开页面不会出现作者、审核人或驳回信息。
            </p>
          </div>

          <div className="flex items-center gap-1.5 text-[10px] text-ink-400">
            <Clock3 className="size-3" />
            审核通过后，这条评价会立即进入公开统计；平台摘要会在来源变化后重新生成。
          </div>
        </form>
      )}
    </Modal>
  );
}
