import { useEffect, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { SCORE_DIMENSIONS } from '@soclear/contracts';
import {
  ArrowRight,
  BadgeCheck,
  BookOpenText,
  CheckCircle2,
  Clock3,
  Database,
  Fingerprint,
  Layers3,
  LockKeyhole,
  MessageSquareReply,
  Route,
  Scale,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { PageHeader } from '../components/PageHeader';
import { pageTitle } from '../lib/format';

const toc = [
  { id: 'sources', label: '展示什么' },
  { id: 'rating', label: '评分口径' },
  { id: 'lifecycle', label: '评价生命周期' },
  { id: 'privacy', label: '匿名与隐私' },
  { id: 'ai', label: '平台总结与学生 AI' },
  { id: 'data', label: '数据与演示边界' },
  { id: 'corrections', label: '更正与申诉' },
  { id: 'status', label: '当前交付状态' },
];

export function GuidePage() {
  useEffect(() => {
    document.title = pageTitle('评价方法');
  }, []);

  return (
    <div className="mx-auto max-w-6xl px-4 pb-16 pt-8 sm:px-6 sm:pt-10">
      <PageHeader
        eyebrow="METHOD / 评价方法"
        title="每个分数，都能解释来源"
        description="清如许把教学资料、学生评价与平台整理分开处理。这里说明四维评分、样本阈值、审核流程、匿名边界和当前尚未开放的能力。"
        action={
          <Link to="/teachers" className="btn-secondary h-9 px-3.5 text-[11px]">
            <BookOpenText className="size-3.5 text-jade-600" />
            去教师库
          </Link>
        }
      />

      <div className="mt-7 flex gap-1.5 overflow-x-auto pb-1 lg:hidden">
        {toc.map((item) => (
          <a key={item.id} href={`#${item.id}`} className="chip shrink-0 py-1 text-[10px]">
            {item.label}
          </a>
        ))}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[0.22fr_0.78fr]">
        <aside className="hidden lg:block">
          <nav className="surface sticky top-24 p-3">
            <p className="px-2 pb-2 pt-1 text-[9px] font-semibold tracking-[0.18em] text-ink-300">
              ON THIS PAGE
            </p>
            <div className="space-y-0.5">
              {toc.map((item) => (
                <a
                  key={item.id}
                  href={`#${item.id}`}
                  className="block rounded-lg px-2 py-1.5 text-[11px] text-ink-500 transition hover:bg-paper hover:text-jade-700"
                >
                  {item.label}
                </a>
              ))}
            </div>
          </nav>
        </aside>

        <div className="min-w-0 space-y-5">
          <section id="sources" className="surface scroll-mt-24 p-5 sm:p-6">
            <SectionTitle icon={<Layers3 className="size-4" />} title="我们展示什么" />
            <p className="mt-2 text-xs leading-relaxed text-ink-500">
              同一页面上有两类信息，来源和性质不同，不能混为一谈：
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-line/80 bg-paper/45 p-4">
                <p className="flex items-center gap-1.5 text-xs font-semibold text-ink-800">
                  <Database className="size-3.5 text-jade-600" /> 教学资料
                </p>
                <p className="mt-2 text-[11px] leading-relaxed text-ink-500">
                  姓名、职称、学院、课程与开课时间是来自授权来源的教学信息。它们有版本与导入时间，同名教师不会自动合并，学院变化也不会静默覆盖档案。
                </p>
              </div>
              <div className="rounded-2xl border border-line/80 bg-jade-50/40 p-4">
                <p className="flex items-center gap-1.5 text-xs font-semibold text-ink-800">
                  <MessageSquareReply className="size-3.5 text-jade-600" /> 学生评价
                </p>
                <p className="mt-2 text-[11px] leading-relaxed text-ink-500">
                  评分与文字是学生基于课堂体验的主观意见，不是对教师能力、人格或事实的客观结论。公开前需要审核，展示时固定匿名。
                </p>
              </div>
            </div>
            <div className="mt-4 flex items-start gap-2 rounded-xl bg-paper/60 px-3.5 py-3 text-[10px] leading-relaxed text-ink-500">
              <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-jade-600" />
              页面会显示数据版本与更新时间；无法确认的时间不会显示成“无课”或“无冲突”。
            </div>
          </section>

          <section id="rating" className="surface scroll-mt-24 p-5 sm:p-6">
            <SectionTitle icon={<Scale className="size-4" />} title="四维评分口径" />
            <p className="mt-2 text-xs leading-relaxed text-ink-500">
              首发使用四个正向维度，均为 1–5 分的整数。高风险或负向含义并入描述项，不混入总分。
            </p>
            <div className="mt-4 divide-y divide-line/70 rounded-2xl border border-line/80">
              {SCORE_DIMENSIONS.map((dimension, index) => (
                <div key={dimension.key} className="flex items-start gap-3 px-4 py-3">
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-jade-50 text-[10px] font-semibold text-jade-700">
                    {index + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-[12px] font-semibold text-ink-800">{dimension.label}</p>
                      <p className="text-[10px] text-ink-400">
                        {dimension.low} → {dimension.high}
                      </p>
                    </div>
                    <p className="mt-1 text-[11px] leading-relaxed text-ink-500">{dimension.description}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl bg-paper/60 p-4">
                <p className="stat-label">综合分</p>
                <p className="mt-1.5 text-[12px] font-semibold leading-relaxed text-ink-800">
                  四个维度均值的算术平均
                </p>
                <p className="mt-1 text-[10px] leading-relaxed text-ink-400">服务端计算并保留精确内部值，页面展示一位小数。</p>
              </div>
              <div className="rounded-2xl bg-paper/60 p-4">
                <p className="stat-label">展示阈值</p>
                <p className="mt-1.5 text-[12px] font-semibold leading-relaxed text-ink-800">
                  至少 5 条当前公开评价
                </p>
                <p className="mt-1 text-[10px] leading-relaxed text-ink-400">少于 5 条只显示样本量，不显示可排序综合分。</p>
              </div>
              <div className="rounded-2xl bg-paper/60 p-4">
                <p className="stat-label">描述项</p>
                <p className="mt-1.5 text-[12px] font-semibold leading-relaxed text-ink-800">
                  难度 / 作业量 / 点名
                </p>
                <p className="mt-1 text-[10px] leading-relaxed text-ink-400">独立展示，不参与综合分；不把“容易拿分”包装成正向教学质量。</p>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2 rounded-2xl bg-jade-900 px-4 py-3 text-[10px] text-jade-100">
              <span className="rounded-full bg-white/10 px-2 py-0.5">四维均分</span>
              <ArrowRight className="size-3 text-jade-300" />
              <span className="rounded-full bg-white/10 px-2 py-0.5">有效公开评价平均</span>
              <ArrowRight className="size-3 text-jade-300" />
              <span className="rounded-full bg-white/15 px-2 py-0.5 font-semibold text-white">
                达到 5 条后展示
              </span>
            </div>
          </section>

          <section id="lifecycle" className="surface scroll-mt-24 p-5 sm:p-6">
            <SectionTitle icon={<Route className="size-4" />} title="评价生命周期" />
            <p className="mt-2 text-xs leading-relaxed text-ink-500">
              每次内容修改都会生成新的修订；审核指定修订与版本，旧审核请求不能批准新内容。
            </p>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {[
                {
                  title: '提交 → 待审',
                  text: '只有有效的匿名学生资格可以提交。同一作者、教师、课程、学期只保留一份未撤回评价。',
                  tone: 'sun',
                },
                {
                  title: '人工审核 → 发布 / 驳回',
                  text: '非作者内容管理员审核；不能审核自己的评价。通过后进入公开统计，驳回会给出原因。',
                  tone: 'jade',
                },
                {
                  title: '作者修订 / 撤回',
                  text: '修改已发布评价会先撤下旧公开版本；撤回立即从公开投影与统计中移除。',
                  tone: 'sky',
                },
                {
                  title: '举报 / 隐藏',
                  text: '举报核实或紧急隐藏可以停止公开。隐藏和撤回不经普通审核恢复，需重新提交修订。',
                  tone: 'ink',
                },
              ].map((item) => (
                <div
                  key={item.title}
                  className={`rounded-2xl border p-4 ${
                    item.tone === 'jade'
                      ? 'border-jade-100 bg-jade-50/45'
                      : item.tone === 'sun'
                        ? 'border-sun-100 bg-sun-50/45'
                        : item.tone === 'sky'
                          ? 'border-water-100 bg-water-50/40'
                          : 'border-line/80 bg-paper/45'
                  }`}
                >
                  <div className="flex items-center gap-2 text-xs font-semibold text-ink-800">
                    <span className="flex size-5 items-center justify-center rounded-full bg-white text-[9px] font-bold text-ink-400 ring-1 ring-inset ring-line">
                      <CheckCircle2 className="size-3" />
                    </span>
                    {item.title}
                  </div>
                  <p className="mt-1.5 text-[11px] leading-relaxed text-ink-500">{item.text}</p>
                </div>
              ))}
            </div>
            <p className="mt-3 flex items-start gap-1.5 text-[10px] leading-relaxed text-ink-400">
              <Clock3 className="mt-0.5 size-3 shrink-0" />
              发布、撤回、隐藏与重提交都会在同一事务中更新公开投影，并提升受影响教师摘要的版本；旧摘要不会在撤稿后继续展示。
            </p>
          </section>

          <section id="privacy" className="surface scroll-mt-24 p-5 sm:p-6">
            <SectionTitle icon={<Fingerprint className="size-4" />} title="匿名与隐私" />
            <div className="mt-3 space-y-3 text-[11px] leading-relaxed text-ink-500">
              <p>
                公开评价只显示固定的匿名标识，不显示昵称、邮箱、学号、作者 ID、审核人、审核备注或举报信息。作者身份与评价内容在数据层分离，平台治理可追溯，但公开页面不可反查。
              </p>
              <p>
                规划中的学生认证采用独立验证流程：可信校园证明只在隔离验证服务的内存中短暂处理，认证原文不进入普通应用数据库、日志、队列或备份；平台只保留与账号无业务关联的资格结果。当前版本尚未接入该流程。
              </p>
            </div>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {[
                { icon: <LockKeyhole className="size-3.5" />, label: '不公开作者账号与昵称' },
                { icon: <ShieldCheck className="size-3.5" />, label: '不收集无法核验的修读证明' },
                { icon: <Fingerprint className="size-3.5" />, label: '匿名展示不等同不可治理' },
                { icon: <BadgeCheck className="size-3.5" />, label: '删号 / 撤回保留本人补救能力' },
              ].map((item) => (
                <div key={item.label} className="flex items-center gap-2 rounded-xl bg-paper/60 px-3 py-2.5 text-[10px] text-ink-600">
                  <span className="text-jade-600">{item.icon}</span>
                  {item.label}
                </div>
              ))}
            </div>
          </section>

          <section id="ai" className="surface scroll-mt-24 p-5 sm:p-6">
            <SectionTitle icon={<Sparkles className="size-4" />} title="平台总结与学生 AI 是两件事" />
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-jade-100 bg-jade-50/45 p-4">
                <p className="text-xs font-semibold text-ink-800">平台评价摘要</p>
                <p className="mt-1.5 text-[11px] leading-relaxed text-ink-500">
                  只读取当前公开评价，整理共同表述并绑定来源、样本与版本；不自动改分、不裁决事实真伪、不自动审核。来源变化后旧摘要立即失效。
                </p>
                <p className="mt-2 text-[10px] text-jade-700">当前页面展示的摘要是合成演示内容。</p>
              </div>
              <div className="rounded-2xl border border-line/80 bg-paper/45 p-4">
                <p className="flex items-center gap-2 text-xs font-semibold text-ink-800">
                  学生自带模型（BYOK）
                  <span className="rounded-full bg-white px-1.5 py-0.5 text-[8px] font-medium text-ink-400">规划中</span>
                </p>
                <p className="mt-1.5 text-[11px] leading-relaxed text-ink-500">
                  学生填写自己的供应商、模型与 Key，Key 只留在当前页内存并由浏览器直连。本站不代理模型请求，只提供受控的公开检索与证据校验。
                </p>
                <Link to="/assistant" className="mt-2 inline-flex items-center gap-1 text-[10px] font-semibold text-jade-700">
                  查看规划
                  <ArrowRight className="size-3" />
                </Link>
              </div>
            </div>
            <p className="mt-3 text-[10px] leading-relaxed text-ink-400">
              平台没有积分账户、签到奖励或 AI 扣分。学生模型的费用直接由供应商向学生结算；平台只管理后台分析的实际成本预算。
            </p>
          </section>

          <section id="data" className="surface scroll-mt-24 p-5 sm:p-6">
            <SectionTitle icon={<Database className="size-4" />} title="数据与演示边界" />
            <ul className="mt-3 space-y-2 text-[11px] leading-relaxed text-ink-500">
              <li>本版本所有教师、课程、教学班、评价与摘要均为合成演示数据，不对应真实个人或校内资料。</li>
              <li>前端只请求本站公开接口；浏览器不直接连接数据库，也不持有数据库或管理凭据。</li>
              <li>公开接口只返回白名单字段，不含作者、审核人、审核状态、驳回原因等管理字段。</li>
              <li>开课人数与时间为来源快照，不保证实时；未知时间不会被推断成没有冲突。</li>
            </ul>
          </section>

          <section id="corrections" className="surface scroll-mt-24 p-5 sm:p-6">
            <SectionTitle icon={<MessageSquareReply className="size-4" />} title="更正与申诉" />
            <p className="mt-2 text-xs leading-relaxed text-ink-500">
              教师与学生对公开内容都应拥有更正渠道。规划中的流程会区分内容纠错、隐私删除与账号处置，并要求相关操作留下审计；不会因为提出删除请求就自动移除所有内容，也不会把申诉材料公开。
            </p>
            <div className="mt-3 rounded-xl border border-dashed border-line-strong bg-paper/45 px-3.5 py-3 text-[10px] leading-relaxed text-ink-400">
              当前版本尚未开放账号、申诉与举报入口，因此不提供无法实际处理的表单或联系方式。
            </div>
          </section>

          <section id="status" className="surface scroll-mt-24 p-5 sm:p-6">
            <SectionTitle icon={<CheckCircle2 className="size-4" />} title="当前交付状态" />
            <div className="mt-4 space-y-2">
              {[
                ['已就绪', '公开教师、课程、开课与公开评价查询；四维评分与样本阈值；平台摘要状态展示。', 'done'],
                ['下一阶段', '独立平台账号与会话、匿名学生认证、评价提交与人工审核、本人记录与撤回。', 'next'],
                ['后续阶段', '学生自带模型（BYOK）、平台摘要真实生成、同站 /admin 管理工作区与受控运维。', 'later'],
              ].map(([title, text, state]) => (
                <div key={title} className="flex items-start gap-3 rounded-2xl border border-line/70 p-3.5">
                  <span
                    className={`mt-0.5 rounded-full px-2 py-0.5 text-[9px] font-semibold ${
                      state === 'done'
                        ? 'bg-jade-50 text-jade-700'
                        : state === 'next'
                          ? 'bg-sun-50 text-sun-700'
                          : 'bg-paper text-ink-400'
                    }`}
                  >
                    {title}
                  </span>
                  <p className="text-[11px] leading-relaxed text-ink-500">{text}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <Link to="/teachers" className="btn-primary h-9 px-4 text-[11px]">
                浏览教师库
                <ArrowRight className="size-3.5" />
              </Link>
              <Link to="/courses" className="btn-secondary h-9 px-4 text-[11px]">
                查询课程开课
              </Link>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function SectionTitle({ icon, title }: { icon: ReactNode; title: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="flex size-8 items-center justify-center rounded-xl bg-jade-50 text-jade-700">
        {icon}
      </span>
      <h2 className="text-lg font-bold tracking-tight text-ink-950">{title}</h2>
    </div>
  );
}
