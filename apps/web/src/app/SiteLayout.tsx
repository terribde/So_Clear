import { Outlet } from 'react-router-dom';
import { Header } from '../components/Header';
import { Footer } from '../components/Footer';
import { BottomNav } from '../components/BottomNav';

export function SiteLayout() {
  return (
    <div className="flex min-h-dvh flex-col">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[100] focus:rounded-full focus:bg-jade-700 focus:px-4 focus:py-2 focus:text-xs focus:font-semibold focus:text-white"
      >
        跳到主要内容
      </a>
      <Header />
      <main id="main-content" tabIndex={-1} className="flex-1 pb-20 focus:outline-none md:pb-0">
        <Outlet />
      </main>
      <Footer />
      <BottomNav />
    </div>
  );
}
