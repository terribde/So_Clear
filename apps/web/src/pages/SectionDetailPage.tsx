import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { PUBLIC_PATHS, type SectionDTO } from '@soclear/contracts';
import {
  ArrowLeft,
  ArrowUpRight,
  Building2,
  CalendarDays,
  Check,
  Clock3,
  Copy,
  Info,
  MapPin,
  Users,
} from 'lucide-react';
import { PageHeader } from '../components/PageHeader';
import { RatingBadge } from '../components/RatingBadge';
import { ErrorState, LoadingBlock } from '../components/States';
import { useToast } from '../components/Toast';
import { useApiResource } from '../features/api/hooks';
import {
  formatDate,
  formatMeeting,
  meetingLocation,
  pageTitle,
} from '../lib/format';

export function SectionDetailPage() {
  const { sectionId } = useParams();
  const section = useApiResource<SectionDTO>(
    sectionId ? PUBLIC_PATHS.section(sectionId) : null,
  );
  const toast = useToast();
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    document.title = pageTitle(
      section.data ? `${section.data.course.name} · 开课详情` : '开课详情',
    );
  }, [section.data]);

  const copyCode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      toast(`已复制选课号 ${code}`, 'success');
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      toast('浏览器未允许复制，请手动选择选课号。', 'error');
    }
  };

  if (section.loading) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <LoadingBlock className="h-8 w-40" />
        <LoadingBlock className="mt-4 h-28" />
        <LoadingBlock className="mt-4 h-64" />
      </div>
    );
  }

  if (section.error || !section.data) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <ErrorState message={section.error ?? '未找到该开课。'} onRetry={section.reload} />
        <div className="mt-4 text-center">
          <Link to="/courses" className="btn-secondary h-9 px-4 text-xs">
            <ArrowLeft className="size-3.5" />
            返回课程与开课
          </Link>
        </div>
      </div>
    );
  }

  const detail = section.data;
  const allTimesUnknown = detail.meetings.every((meeting) => meeting.timeUnknown);

  return (
    <div className="mx-auto max-w-5xl px-4 pb-16 pt-8 sm:px-6 sm:pt-10">
      <Link
        to="/courses"
        className="inline-flex items-center gap-1.5 text-[11px] font-medium text-ink-500 transition hover:text-jade-700"
      >
        <ArrowLeft className="size-3.5" />
        课程与开课
      </Link>

      <div className="mt-4">
        <PageHeader
          eyebrow="SECTION / 开课详情"
          title={detail.course.name}
          description="开课信息来自教学资料快照；评分与文字评价另由学生评价提供，两者不混为同一来源。"
          action={
            <button
              type="button"
              onClick={() => void copyCode(detail.sectionCode)}
              className="btn-secondary h-10 px-4 text-xs"
            >
              {copied ? <Check className="size-3.5 text-jade-600" /> : <Copy className="size-3.5" />}
              {copied ? '已复制' : `复制 ${detail.sectionCode}`}
            </button>
          }
        />
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-12">
        <div className="space-y-5 lg:col-span-8">
          <section className="surface p-5 sm:p-6" aria-labelledby="section-teachers">
            <h2 id="section-teachers" className="section-title">
              授课教师
            </h2>
            <p className="mt-1 text-[10px] text-ink-400">
              共同授课按来源列出；教师映射待确认时不会按姓名自动合并。
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {detail.teachers.map((teacher) => (
                <Link
                  key={teacher.id}
                  to={`/teachers/${teacher.id}`}
                  className="group flex items-start justify-between gap-3 rounded-2xl border border-line/80 bg-white/70 p-4 transition hover:border-jade-200 hover:bg-jade-50/30"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-ink-900 group-hover:text-jade-700">
                      {teacher.name}
                    </p>
                    <p className="mt-1 text-[10px] text-ink-400">
                      {teacher.title} · {teacher.departmentName}
                    </p>
                    <span className="mt-2 inline-flex items-center gap-1 text-[10px] font-medium text-jade-700">
                      查看教师详情
                      <ArrowUpRight className="size-3" />
                    </span>
                  </div>
                  <RatingBadge summary={teacher.ratingSummary} size="sm" />
                </Link>
              ))}
            </div>
            {detail.teachers.length === 0 ? (
              <p className="mt-4 rounded-xl border border-dashed border-line-strong bg-paper/50 px-3 py-3 text-[11px] text-ink-500">
                来源尚未确认授课教师，页面不推测或补齐姓名。
              </p>
            ) : null}
          </section>

          <section className="surface p-5 sm:p-6" aria-labelledby="section-meetings">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 id="section-meetings" className="section-title">
                  上课安排
                </h2>
                <p className="mt-1 text-[10px] text-ink-400">
                  周次、星期、节次与地点均按来源展示；未知时间不能当作无冲突。
                </p>
              </div>
              <span className="rounded-full bg-paper px-2.5 py-1 text-[10px] text-ink-500">
                {detail.meetings.length} 段安排
              </span>
            </div>

            <div className="mt-4 space-y-2">
              {detail.meetings.map((meeting, index) => (
                <div
                  key={`${detail.id}-meeting-${index}`}
                  className={`flex flex-wrap items-center justify-between gap-3 rounded-2xl px-4 py-3 ${
                    meeting.timeUnknown
                      ? 'border border-dashed border-sun-100 bg-sun-50/60 text-sun-700'
                      : 'bg-paper/60 text-ink-700'
                  }`}
                >
                  <span className="inline-flex items-center gap-2 text-sm font-semibold">
                    <Clock3 className="size-4 text-jade-600" />
                    {formatMeeting(meeting)}
                    {meeting.weeks ? (
                      <span className="text-[11px] font-normal text-ink-400">· {meeting.weeks}</span>
                    ) : null}
                  </span>
                  <span className="inline-flex items-center gap-1.5 text-[11px]">
                    <MapPin className="size-3.5 text-ink-300" />
                    {meetingLocation(meeting)}
                  </span>
                </div>
              ))}
            </div>

            {allTimesUnknown ? (
              <div className="mt-3 flex items-start gap-2 rounded-2xl bg-sun-50/70 px-4 py-3 text-[11px] leading-relaxed text-sun-700">
                <Info className="mt-0.5 size-4 shrink-0" />
                <span>
                  这段开课的完整时间尚未公布。页面保留“时间待定”状态，用于选课时提醒你继续向开课单位核对，而不是给出未经证实的时段。
                </span>
              </div>
            ) : null}

            {detail.note ? (
              <p className="mt-3 rounded-2xl bg-paper/60 px-4 py-3 text-[11px] leading-relaxed text-ink-500">
                {detail.note}
              </p>
            ) : null}
          </section>
        </div>

        <aside className="space-y-5 lg:col-span-4">
          <section className="surface p-5" aria-labelledby="section-facts">
            <h2 id="section-facts" className="text-sm font-semibold text-ink-900">
              开课信息
            </h2>
            <dl className="mt-4 space-y-3 text-[11px]">
              <div className="flex items-center justify-between gap-3">
                <dt className="inline-flex items-center gap-1.5 text-ink-400">
                  <CalendarDays className="size-3.5" />
                  学期
                </dt>
                <dd className="text-right font-medium text-ink-800">{detail.term.label}</dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="inline-flex items-center gap-1.5 text-ink-400">
                  <Building2 className="size-3.5" />
                  校区
                </dt>
                <dd className="text-right font-medium text-ink-800">{detail.campus}</dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="inline-flex items-center gap-1.5 text-ink-400">
                  <Users className="size-3.5" />
                  容量
                </dt>
                <dd className="text-right font-medium text-ink-800">
                  {detail.capacity === null ? '来源未提供' : `${detail.capacity} 人`}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-ink-400">选课号</dt>
                <dd className="text-right font-mono text-[11px] font-medium text-ink-800">
                  {detail.sectionCode}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-ink-400">数据版本</dt>
                <dd className="text-right text-ink-500">v{detail.dataVersion}</dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-ink-400">来源更新时间</dt>
                <dd className="text-right text-ink-500">{formatDate(detail.updatedAt)}</dd>
              </div>
            </dl>
            <p className="mt-4 border-t border-line/60 pt-3 text-[10px] leading-relaxed text-ink-400">
              容量、时间与地点均为来源快照，不承诺实时余量或调停课变更。当前页面使用合成演示数据。
            </p>
          </section>

          <section className="rounded-3xl bg-jade-900 p-5 text-white">
            <h2 className="text-sm font-semibold">查询边界</h2>
            <p className="mt-2 text-[10px] leading-relaxed text-jade-100/80">
              本页只展示公开教学资料。评价正文需经人工审核后才会出现在教师详情页，不会把开课信息与主观评分混为一体。
            </p>
            <Link
              to="/guide"
              className="mt-4 inline-flex h-9 items-center gap-1.5 rounded-full bg-white px-3.5 text-[11px] font-semibold text-jade-800 transition hover:bg-jade-50"
            >
              查看评分与审核口径
              <ArrowUpRight className="size-3.5" />
            </Link>
          </section>
        </aside>
      </div>
    </div>
  );
}
