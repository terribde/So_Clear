import { Link } from 'react-router-dom';
import { BrandLockup } from './Brand';

const footerLinks = [
  { to: '/teachers', label: '教师库' },
  { to: '/compare', label: '教师对比' },
  { to: '/courses', label: '课程与开课' },
  { to: '/guide', label: '评分口径与隐私' },
  { to: '/assistant', label: '学生 AI（规划中）' },
  { to: '/me', label: '我的与认证' },
];

export function Footer() {
  return (
    <footer className="mt-14 border-t border-line/80 pb-24 pt-10 md:mb-0 md:pb-10">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="grid gap-8 md:grid-cols-[1.4fr_1fr]">
          <div>
            <BrandLockup compact />
            <p className="mt-4 max-w-md text-sm leading-relaxed text-ink-500">
              面向学生的教师评价与课程查询。把教学资料和主观评价分开呈现，用样本量、评分口径和审核流程说明每一个分数从哪里来。
            </p>
            <p className="mt-4 text-[11px] leading-relaxed text-ink-400">
              当前站点使用合成演示数据与本地演示数据库，不代表任何真实教师、课程或校内评价；未连接学校系统或线上服务。
            </p>
          </div>

          <div className="grid grid-cols-2 gap-x-6 gap-y-2.5 text-sm">
            {footerLinks.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                className="w-fit text-ink-500 transition hover:text-jade-700"
              >
                {link.label}
              </Link>
            ))}
          </div>
        </div>

        <div className="mt-9 flex flex-col gap-2 border-t border-line/70 pt-4 text-[11px] text-ink-400 sm:flex-row sm:items-center sm:justify-between">
          <span>© 2026 清如许 SoClear · 设计基线与合成数据均处于开发阶段</span>
          <span className="inline-flex items-center gap-1.5">
            <span className="size-1.5 rounded-full bg-jade-400" />
            公开查询可用 · 本地演示已接入账号、评价提交与审核
          </span>
        </div>
      </div>
    </footer>
  );
}
