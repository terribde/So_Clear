import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Ban,
  BookOpenText,
  Check,
  Cpu,
  Database,
  Globe2,
  KeyRound,
  LockKeyhole,
  MonitorSmartphone,
  Route,
  ShieldCheck,
  Sparkles,
  X,
} from 'lucide-react';
import { PageHeader } from '../components/PageHeader';
import { pageTitle } from '../lib/format';

const providers = [
  { name: 'OpenAI 兼容 HTTPS 接口', status: '待评估', detail: '需验证 CORS、协议、模型名规则与重定向策略' },
  { name: 'OpenAI', status: '待评估', detail: '浏览器直连兼容性与站点 CSP 来源待实测' },
  { name: 'DeepSeek', status: '待评估', detail: '浏览器 CORS 与流式响应协议待实测' },
  { name: '自定义供应商', status: '不默认开放', detail: '只接受 registry 固定的 HTTPS origin 与协议' },
];

const flow = [
  {
    icon: <KeyRound className="size-4" />,
    title: '页内配置',
    text: '选择受支持供应商，填写模型名与自己的 Key。Key 只存在于当前页的内存变量中。',
  },
  {
    icon: <MonitorSmartphone className="size-4" />,
    title: '浏览器直连',
    text: '浏览器直接向供应商发起请求，不经过清如许服务器，也不携带本站会话。',
  },
  {
    icon: <Database className="size-4" />,
    title: '受控证据',
    text: '本站只接受校验过的检索条件，返回公开候选、最小证据与短期来源票据。',
  },
  {
    icon: <ShieldCheck className="size-4" />,
    title: '来源复核',
    text: '模型解释显示前，再核对引用与当前公开状态；失败时只展示确定性结果。',
  },
];

export function AssistantPage() {
  useEffect(() => {
    document.title = pageTitle('学生 AI · 规划中');
  }, []);

  return (
    <div className="mx-auto max-w-6xl px-4 pb-16 pt-8 sm:px-6 sm:pt-10">
      <PageHeader
        eyebrow="ASSISTANT / 学生 AI"
        title="用你自己的模型，问公开证据"
        description="学生自带模型（BYOK）计划把模型选择权与费用交还给学生：清如许不代理模型、不接收 Key、不保存个人问答。当前阶段仅完成规划说明，没有可用的模型调用。"
        action={
          <span className="inline-flex items-center gap-1.5 rounded-full border border-sun-100 bg-sun-50 px-3 py-1.5 text-[10px] font-semibold text-sun-700">
            <span className="size-1.5 rounded-full bg-sun-600" />
            规划中 · 未开放
          </span>
        }
      />

      <section className="relative mt-6 overflow-hidden rounded-[28px] bg-jade-900 p-6 text-white sm:p-8">
        <div className="pointer-events-none absolute -right-20 -top-24 size-72 rounded-full border border-white/10" />
        <div className="pointer-events-none absolute -bottom-28 -left-16 size-72 rounded-full border border-white/10" />
        <div className="relative max-w-2xl">
          <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-[10px] font-medium text-jade-100">
            <Sparkles className="size-3.5" />
            BYOK · Browser-only
          </span>
          <h2 className="brand-serif mt-4 text-2xl font-bold leading-snug tracking-wide sm:text-3xl">
            让模型帮你比较，
            <br className="hidden sm:block" />
            而不是替你决定。
          </h2>
          <p className="mt-3 max-w-xl text-[11px] leading-relaxed text-jade-100/80 sm:text-xs">
            计划中的学生 AI 只能使用受控公开检索、公开评价证据与来源校验。它不会读取待审内容、作者身份、管理数据或内部评分，也没有 SQL、网页抓取或审核权限。
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Link
              to="/teachers"
              className="inline-flex h-10 items-center gap-1.5 rounded-full bg-white px-4 text-[11px] font-semibold text-jade-800 transition hover:bg-jade-50"
            >
              先用结构化查询
              <ArrowRight className="size-3.5" />
            </Link>
            <Link
              to="/courses"
              className="inline-flex h-10 items-center gap-1.5 rounded-full border border-white/20 px-4 text-[11px] font-semibold text-white transition hover:bg-white/10"
            >
              查看课程开课
            </Link>
          </div>
        </div>
      </section>

      <div className="mt-6 grid gap-5 lg:grid-cols-12">
        <div className="space-y-5 lg:col-span-7">
          <section className="surface p-5 sm:p-6">
            <div className="flex items-center gap-2.5">
              <span className="flex size-8 items-center justify-center rounded-xl bg-jade-50 text-jade-700">
                <Route className="size-4" />
              </span>
              <div>
                <h2 className="text-lg font-bold tracking-tight text-ink-950">计划中的调用链路</h2>
                <p className="mt-0.5 text-[10px] text-ink-400">供应商请求与本站证据请求始终分离。</p>
              </div>
            </div>

            <div className="mt-4 grid gap-2.5 sm:grid-cols-2">
              {flow.map((item, index) => (
                <div key={item.title} className="rounded-2xl border border-line/80 bg-paper/40 p-4">
                  <div className="flex items-center justify-between">
                    <span className="flex size-8 items-center justify-center rounded-xl bg-white text-jade-700 ring-1 ring-inset ring-line">
                      {item.icon}
                    </span>
                    <span className="brand-serif text-xl font-bold text-jade-200">0{index + 1}</span>
                  </div>
                  <p className="mt-2.5 text-xs font-semibold text-ink-800">{item.title}</p>
                  <p className="mt-1 text-[11px] leading-relaxed text-ink-500">{item.text}</p>
                </div>
              ))}
            </div>

            <div className="mt-3 flex items-start gap-2 rounded-xl bg-sun-50/60 px-3.5 py-3 text-[10px] leading-relaxed text-sun-700">
              <Globe2 className="mt-0.5 size-3.5 shrink-0" />
              供应商不支持浏览器 CORS 时不提供服务器中转或通用代理回退；该供应商会被禁用或移出 registry。这是浏览器安全边界，不是可用性妥协。
            </div>
          </section>

          <section className="surface p-5 sm:p-6">
            <div className="flex items-center gap-2.5">
              <span className="flex size-8 items-center justify-center rounded-xl bg-water-50 text-water-500">
                <Cpu className="size-4" />
              </span>
              <div>
                <h2 className="text-lg font-bold tracking-tight text-ink-950">供应商兼容性</h2>
                <p className="mt-0.5 text-[10px] text-ink-400">以下均为规划项，未进行浏览器实测，不代表可用。</p>
              </div>
            </div>

            <div className="mt-4 overflow-hidden rounded-2xl border border-line/80">
              {providers.map((provider, index) => (
                <div
                  key={provider.name}
                  className={`flex flex-col gap-1.5 px-4 py-3 sm:flex-row sm:items-center sm:justify-between ${
                    index > 0 ? 'border-t border-line/60' : ''
                  }`}
                >
                  <div>
                    <p className="text-[11px] font-semibold text-ink-800">{provider.name}</p>
                    <p className="mt-0.5 text-[10px] text-ink-400">{provider.detail}</p>
                  </div>
                  <span className="w-fit shrink-0 rounded-full bg-paper px-2 py-0.5 text-[9px] font-medium text-ink-400">
                    {provider.status}
                  </span>
                </div>
              ))}
            </div>
          </section>
        </div>

        <aside className="space-y-5 lg:col-span-5">
          <section className="surface p-5">
            <div className="flex items-center gap-2">
              <LockKeyhole className="size-4 text-jade-600" />
              <h2 className="text-sm font-semibold text-ink-900">Key 的边界</h2>
            </div>
            <ul className="mt-3 space-y-2.5">
              {[
                '只保存在当前页面内存，不写入 localStorage、sessionStorage、IndexedDB、URL 或 Cookie。',
                '不进入本站任何请求、日志、埋点、崩溃报告或队列。',
                '离开页面、退出或切换 Key 时中止供应商请求并清理引用。',
                '不承诺 JavaScript 能物理擦除内存，但本站不持久化这段值。',
              ].map((rule) => (
                <li key={rule} className="flex items-start gap-2 text-[10px] leading-relaxed text-ink-500">
                  <Check className="mt-0.5 size-3 shrink-0 text-jade-600" />
                  {rule}
                </li>
              ))}
            </ul>
          </section>

          <section className="surface p-5">
            <div className="flex items-center gap-2">
              <Ban className="size-4 text-rose-soft" />
              <h2 className="text-sm font-semibold text-ink-900">不会发生的事</h2>
            </div>
            <ul className="mt-3 space-y-2.5">
              {[
                '服务器不接收、不转发学生 Key 或原始模型对话。',
                '不把模型输出当成审核决定、综合分或教师事实结论。',
                '不读取待审评价、作者映射、管理备注或内部置信度。',
                '不设置积分、扣费或“AI 次数”奖励；费用由学生与供应商直接结算。',
              ].map((rule) => (
                <li key={rule} className="flex items-start gap-2 text-[10px] leading-relaxed text-ink-500">
                  <X className="mt-0.5 size-3 shrink-0 text-rose-soft" />
                  {rule}
                </li>
              ))}
            </ul>
          </section>

          <section className="surface-soft p-4">
            <div className="flex items-center gap-2 text-xs font-semibold text-ink-800">
              <BookOpenText className="size-4 text-jade-600" />
              当 AI 尚未开放
            </div>
            <p className="mt-1.5 text-[10px] leading-relaxed text-ink-500">
              结构化查询已经可用。教师库支持按课程、学院与标签筛选；课程页支持按开课时间与四维偏好排序。它们不调用模型，也不产生额外费用。
            </p>
            <div className="mt-2.5 flex flex-wrap gap-2">
              <Link to="/teachers" className="chip py-1 text-[10px]">教师库</Link>
              <Link to="/courses" className="chip py-1 text-[10px]">课程与开课</Link>
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
