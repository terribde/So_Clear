import { Link } from 'react-router-dom';
import { SCORE_DIMENSIONS } from '@soclear/contracts';
import { ArrowRight, BadgeCheck, Clock3, LockKeyhole, PenLine, ShieldCheck } from 'lucide-react';
import { Modal } from './Modal';

export function ReviewEntryModal({
  open,
  onClose,
  teacherName,
}: {
  open: boolean;
  onClose: () => void;
  teacherName?: string;
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      eyebrow="评价入口 · 待开放"
      title={teacherName ? `评价 ${teacherName} 的课` : '写一条真实课堂评价'}
      description="评分与评价会分开呈现；公开前需要人工审核，作者身份不会随评价展示。"
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
          <button type="button" onClick={onClose} className="btn-ghost h-10 px-3 text-xs">
            先看看
          </button>
          <Link to="/guide" onClick={onClose} className="btn-primary h-10 px-4 text-xs">
            查看完整评价规则
            <ArrowRight className="size-3.5" />
          </Link>
        </div>
      }
    >
      <div className="space-y-5">
        <div className="flex items-start gap-3 rounded-2xl border border-sun-100 bg-sun-50/70 p-3.5">
          <LockKeyhole className="mt-0.5 size-4 shrink-0 text-sun-700" />
          <div className="text-xs leading-relaxed text-sun-700">
            <p className="font-semibold">当前版本尚未开放提交</p>
            <p className="mt-0.5 text-[11px] opacity-90">
              独立平台账号与匿名学生认证尚未接入。为避免收集无法核验或无法撤回的评价，这里不提供虚假的提交按钮。
            </p>
          </div>
        </div>

        <div>
          <h3 className="flex items-center gap-2 text-sm font-semibold text-ink-900">
            <PenLine className="size-4 text-jade-600" />
            四个必填维度
          </h3>
          <div className="mt-2.5 grid gap-2 sm:grid-cols-2">
            {SCORE_DIMENSIONS.map((dimension) => (
              <div key={dimension.key} className="rounded-xl border border-line/80 bg-paper/45 p-3">
                <p className="text-xs font-semibold text-ink-800">{dimension.label}</p>
                <p className="mt-1 text-[10px] leading-relaxed text-ink-400">
                  {dimension.low} → {dimension.high}
                </p>
              </div>
            ))}
          </div>
          <p className="mt-2 text-[10px] leading-relaxed text-ink-400">
            难度、作业量与点名情况只作描述性选项，不混入正向总分。
          </p>
        </div>

        <div>
          <h3 className="flex items-center gap-2 text-sm font-semibold text-ink-900">
            <ShieldCheck className="size-4 text-jade-600" />
            提交后会经历什么
          </h3>
          <ol className="mt-2.5 space-y-2.5">
            {[
              ['提交待审', '需要有效的匿名学生资格；同一作者、教师、课程、学期只保留一份未撤回评价。'],
              ['非作者审核', '内容管理员按修订版本审核，作者不能审核自己的评价，平台 AI 不代替人工决定。'],
              ['公开或驳回', '通过后进入公开统计；驳回会给出原因。作者可修订、撤回或申诉。'],
            ].map(([title, text], index) => (
              <li key={title} className="flex gap-3">
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-jade-50 text-[10px] font-bold text-jade-700">
                  {index + 1}
                </span>
                <div>
                  <p className="text-xs font-semibold text-ink-800">{title}</p>
                  <p className="mt-0.5 text-[11px] leading-relaxed text-ink-500">{text}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>

        <div className="flex items-start gap-2.5 rounded-2xl bg-paper/70 p-3.5 text-[11px] leading-relaxed text-ink-500">
          <BadgeCheck className="mt-0.5 size-4 shrink-0 text-jade-600" />
          <p>
            展示时只出现「匿名在校生」这类固定标识，不显示昵称、邮箱或作者映射。平台可追溯账号以处理滥用与撤回请求，但公开页面不会暴露。
          </p>
        </div>

        <div className="flex items-center gap-1.5 text-[10px] text-ink-400">
          <Clock3 className="size-3" />
          账号与认证将在下一阶段接入，届时这里的提交流程才会启用。
        </div>
      </div>
    </Modal>
  );
}
