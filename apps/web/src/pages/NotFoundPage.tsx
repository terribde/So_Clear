import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Compass, SearchX } from 'lucide-react';
import { pageTitle } from '../lib/format';

export function NotFoundPage() {
  useEffect(() => {
    document.title = pageTitle('页面不存在');
  }, []);

  return (
    <div className="mx-auto flex max-w-3xl flex-col items-center px-4 py-20 text-center sm:px-6">
      <span className="brand-serif text-7xl font-bold tracking-widest text-jade-200">404</span>
      <span className="mt-2 flex size-12 items-center justify-center rounded-2xl bg-jade-50 text-jade-700">
        <SearchX className="size-5" />
      </span>
      <h1 className="mt-4 text-xl font-bold tracking-tight text-ink-950">这条路径没有对应的页面</h1>
      <p className="mt-2 max-w-md text-xs leading-relaxed text-ink-500">
        可能是链接过期，或该功能尚未开放。你可以回到首页、教师库或课程开课查询继续浏览。
      </p>
      <div className="mt-5 flex flex-wrap justify-center gap-2">
        <Link to="/" className="btn-primary h-10 px-4 text-xs">
          <ArrowLeft className="size-3.5" />
          返回首页
        </Link>
        <Link to="/teachers" className="btn-secondary h-10 px-4 text-xs">
          <Compass className="size-3.5 text-jade-600" />
          去教师库
        </Link>
      </div>
    </div>
  );
}
