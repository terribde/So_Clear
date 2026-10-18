import { NavLink, Link } from 'react-router-dom';
import { ShieldCheck, UserRound } from 'lucide-react';
import { BrandLink } from './Brand';
import { useAuth } from '../features/auth/AuthProvider';

const navigation = [
  { to: '/', label: '首页', end: true },
  { to: '/teachers', label: '教师库', end: false },
  { to: '/courses', label: '课程与开课', end: false },
  { to: '/guide', label: '评价方法', end: false },
];

export function Header() {
  const { session } = useAuth();
  const accountLabel = session?.authenticated ? session.account?.displayName ?? '我的' : '登录';

  return (
    <header className="sticky top-0 z-40 border-b border-line/75 bg-paper/88 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <BrandLink />

        <nav aria-label="主导航" className="hidden items-center gap-0.5 rounded-full border border-line/80 bg-white/55 p-1 md:flex">
          {navigation.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `rounded-full px-3.5 py-1.5 text-[13px] font-medium transition ${
                  isActive
                    ? 'bg-white text-ink-950 shadow-[0_1px_3px_rgba(11,23,19,0.08)]'
                    : 'text-ink-500 hover:text-ink-900'
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="flex items-center gap-2.5">
          <span className="hidden items-center gap-1.5 rounded-full border border-line/80 bg-white/60 px-2.5 py-1 text-[10px] font-medium tracking-wide text-ink-400 lg:inline-flex">
            <span className="size-1.5 rounded-full bg-jade-500" />
            合成演示
          </span>
          {session?.isAdmin ? (
            <>
              <Link
                to="/admin"
                className="hidden h-9 items-center gap-1.5 rounded-full border border-line bg-white px-3 text-xs font-semibold text-ink-700 transition hover:border-jade-300 hover:text-jade-700 sm:inline-flex"
              >
                <ShieldCheck className="size-3.5" />
                审核
              </Link>
              <Link
                to="/admin"
                className="flex size-9 items-center justify-center rounded-full border border-line bg-white text-ink-600 transition hover:border-jade-300 hover:text-jade-700 sm:hidden"
                aria-label="进入管理工作区"
              >
                <ShieldCheck className="size-4" />
              </Link>
            </>
          ) : null}
          <Link
            to="/me"
            className="hidden h-9 max-w-40 items-center gap-1.5 rounded-full border border-line bg-white px-3.5 text-xs font-semibold text-ink-700 transition hover:border-jade-300 hover:text-jade-700 sm:inline-flex"
          >
            <UserRound className="size-3.5 shrink-0" />
            <span className="truncate">{accountLabel}</span>
          </Link>
          <Link
            to="/me"
            className="flex size-9 items-center justify-center rounded-full border border-line bg-white text-ink-600 transition hover:border-jade-300 hover:text-jade-700 sm:hidden"
            aria-label={session?.authenticated ? '查看我的账号与评价' : '登录或查看我的'}
          >
            <UserRound className="size-4" />
          </Link>
        </div>
      </div>
    </header>
  );
}
