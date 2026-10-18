import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  BookOpenText,
  CheckCircle2,
  Clock3,
  Fingerprint,
  LockKeyhole,
  MessageSquareText,
  ShieldCheck,
  Sparkles,
  UserRound,
} from 'lucide-react';
import { PageHeader } from '../components/PageHeader';
import { pageTitle } from '../lib/format';

const groups = [
  { name: '游客', key: 'guest', ability: '公开教师、课程、开课与公开评价查询', current: true },
  { name: '用户', key: 'user', ability: '独立平台账号、本人的处理记录与补救入口', current: false },
  { name: '认证学生', key: 'verified_student', ability: '在资格有效时提交评价、使用受控检索', current: false },
  { name: '内容管理员', key: 'content_admin', ability: '按能力审核内容、处理举报与总结例外', current: false },
  { name: '系统管理员', key: 'system_admin', ability: '授权范围内的配置、数据、AI 预算与审计', current: false },
];

const roadmap = [
  { status: '已就绪', title: '公开查询', text: '教师、课程、开课与公开评价浏览；四维汇总与样本阈值。', done: true },
  { status: '下一阶段', title: '账号与会话', text: '独立平台账号，登录、退出与会话管理；不把校园账号接成平台登录。', done: false },
  { status: '下一阶段', title: '匿名学生认证', text: '可信证明仅在隔离验证流程中短暂处理，结果用于评价资格而不是公开展示。', done: false },
  { status: '下一阶段', title: '评价与审核', text: '提交、修订、撤回、审核、举报与申诉；本人记录可追踪处理状态。', done: false },
  { status: '后续阶段', title: '学生 AI 与管理区', text: '浏览器直连的 BYOK 工具，以及需要独立升权与严格 CSP 的 /admin 工作区。', done: false },
];

export function AccountPage() {
  useEffect(() => {
    document.title = pageTitle('我的');
  }, []);

  return (
    <div className="mx-auto max-w-6xl px-4 pb-16 pt-8 sm:px-6 sm:pt-10">
      <PageHeader
        eyebrow="ACCOUNT / 我的"
        title="账号、匿名资格与本人记录"
        description="这里将承载独立平台账号、学生资格状态、我的评价与补救入口。当前版本尚未接入登录，因此没有可用的账户操作。"
      />

      <div className="mt-6 grid gap-5 lg:grid-cols-12">
        <div className="space-y-5 lg:col-span-7">
          <section className="surface relative overflow-hidden p-5 sm:p-6">
            <div className="pointer-events-none absolute -right-20 -top-24 size-64 rounded-full bg-jade-50/80" />
            <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-4">
                <span className="flex size-16 items-center justify-center rounded-[22px] border border-line bg-paper text-ink-300">
                  <UserRound className="size-7" strokeWidth={1.6} />
                </span>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-xl font-bold tracking-tight text-ink-950">访客</h2>
                    <span className="rounded-full bg-paper px-2 py-0.5 text-[9px] font-medium text-ink-400">guest</span>
                    <span className="rounded-full bg-sun-50 px-2 py-0.5 text-[9px] font-medium text-sun-700">
                      登录未开放
                    </span>
                  </div>
                  <p className="mt-1.5 text-[11px] leading-relaxed text-ink-500">
                    当前无需登录即可查询公开资料。账号与认证接入后，本页会显示你的学生资格状态与本人记录。
                  </p>
                </div>
              </div>
              <span className="inline-flex w-fit items-center gap-1.5 rounded-full border border-line bg-white px-3 py-1.5 text-[10px] text-ink-400">
                <LockKeyhole className="size-3.5" />
                暂无可用登录方式
              </span>
            </div>

            <div className="relative mt-5 grid gap-2 sm:grid-cols-2">
              <Link to="/teachers" className="group flex items-center justify-between rounded-2xl border border-line/80 bg-white/70 px-4 py-3 transition hover:border-jade-200">
                <span className="flex items-center gap-2 text-xs font-semibold text-ink-800">
                  <BookOpenText className="size-4 text-jade-600" />
                  去教师库看看
                </span>
                <ArrowRight className="size-3.5 text-ink-300 transition group-hover:translate-x-0.5 group-hover:text-jade-600" />
              </Link>
              <Link to="/guide" className="group flex items-center justify-between rounded-2xl border border-line/80 bg-white/70 px-4 py-3 transition hover:border-jade-200">
                <span className="flex items-center gap-2 text-xs font-semibold text-ink-800">
                  <ShieldCheck className="size-4 text-jade-600" />
                  了解匿名与认证边界
                </span>
                <ArrowRight className="size-3.5 text-ink-300 transition group-hover:translate-x-0.5 group-hover:text-jade-600" />
              </Link>
            </div>
          </section>

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
              {groups.map((group, index) => (
                <div
                  key={group.key}
                  className={`flex flex-col gap-1.5 px-4 py-3 sm:flex-row sm:items-center sm:justify-between ${
                    index > 0 ? 'border-t border-line/60' : ''
                  } ${group.current ? 'bg-jade-50/40' : 'bg-white'}`}
                >
                  <div className="flex items-center gap-2.5">
                    <span className="text-xs font-semibold text-ink-800">{group.name}</span>
                    <span className="rounded bg-paper px-1.5 py-0.5 font-mono text-[9px] text-ink-400">{group.key}</span>
                    {group.current ? (
                      <span className="rounded-full bg-jade-100 px-1.5 py-0.5 text-[8px] font-semibold text-jade-700">
                        当前
                      </span>
                    ) : null}
                  </div>
                  <p className="text-[10px] leading-relaxed text-ink-500 sm:max-w-[56%] sm:text-right">{group.ability}</p>
                </div>
              ))}
            </div>

            <p className="mt-3 text-[10px] leading-relaxed text-ink-400">
              平台账号不等于学生身份；登录也不自动获得评价提交或学生 AI 数据权限。当前版本的“游客”只能访问公开查询。
            </p>
          </section>

          <section className="surface p-5 sm:p-6">
            <div className="flex items-center gap-2.5">
              <span className="flex size-8 items-center justify-center rounded-xl bg-sun-50 text-sun-700">
                <Sparkles className="size-4" />
              </span>
              <div>
                <h2 className="text-lg font-bold tracking-tight text-ink-950">没有积分，也没有签到奖励</h2>
                <p className="mt-0.5 text-[10px] text-ink-400">这是产品边界，不是暂时隐藏。</p>
              </div>
            </div>
            <p className="mt-3 text-[11px] leading-relaxed text-ink-500">
              清如许不建设积分账户、签到、评价奖励、充值、流水或 AI 扣分。公开查询不收费；学生自带模型的费用由供应商直接结算；平台只管理自身分析任务的实际成本预算。
            </p>
            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              {['不设积分账户', '不做签到奖励', '不向学生扣 AI 分'].map((item) => (
                <div key={item} className="flex items-center gap-1.5 rounded-xl bg-paper/60 px-3 py-2 text-[10px] text-ink-500">
                  <CheckCircle2 className="size-3 text-jade-600" />
                  {item}
                </div>
              ))}
            </div>
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
              <span className="text-[9px] text-ink-400">P1 公开查询</span>
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
              <h2 className="text-sm font-semibold text-ink-900">这个页面现在不会做什么</h2>
            </div>
            <ul className="mt-3 space-y-2 text-[10px] leading-relaxed text-ink-500">
              <li className="flex items-start gap-2">
                <span className="mt-1 size-1 shrink-0 rounded-full bg-ink-300" />
                不提供虚假的登录或注册表单，也不收集邮箱、学号或密码。
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-1 size-1 shrink-0 rounded-full bg-ink-300" />
                不把校园账号、校园邮箱或 SSO 身份接入平台登录。
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-1 size-1 shrink-0 rounded-full bg-ink-300" />
                不保存评价草稿、学生认证原文或学生模型 Key。
              </li>
            </ul>
          </section>

          <div className="rounded-3xl bg-jade-900 p-5 text-white">
            <MessageSquareText className="size-5 text-jade-200" />
            <p className="mt-3 text-sm font-semibold leading-relaxed">先让查询与评价口径值得信任，再加上账号和提交流程。</p>
            <p className="mt-2 text-[10px] leading-relaxed text-jade-100/80">
              账号、认证、写评价与管理区会按阶段接入，不通过“先上线登录、后补安全”来缩短流程。
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
    </div>
  );
}
