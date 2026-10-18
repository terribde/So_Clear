import { NavLink } from 'react-router-dom';
import { CalendarDays, House, UserRound, UsersRound } from 'lucide-react';

const items = [
  { to: '/', label: '首页', icon: House, end: true },
  { to: '/teachers', label: '教师库', icon: UsersRound, end: false },
  { to: '/courses', label: '选课', icon: CalendarDays, end: false },
  { to: '/me', label: '我的', icon: UserRound, end: false },
];

export function BottomNav() {
  return (
    <nav aria-label="移动端主导航" className="fixed inset-x-0 bottom-0 z-40 border-t border-line/90 bg-white/94 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:hidden">
      <div className="mx-auto grid max-w-lg grid-cols-4 px-2 pb-1.5 pt-1">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `relative flex flex-col items-center gap-1 rounded-2xl py-1.5 text-[10px] font-medium transition ${
                  isActive ? 'text-jade-700' : 'text-ink-400'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <span
                    className={`flex h-7 w-12 items-center justify-center rounded-full transition ${
                      isActive ? 'bg-jade-50' : 'bg-transparent'
                    }`}
                  >
                    <Icon className="size-[18px]" strokeWidth={isActive ? 2.2 : 1.8} />
                  </span>
                  <span>{item.label}</span>
                </>
              )}
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
}
