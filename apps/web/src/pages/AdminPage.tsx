import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, LockKeyhole, ShieldCheck } from 'lucide-react';
import { BrandLockup } from '../components/Brand';
import { pageTitle } from '../lib/format';

export function AdminPage() {
  useEffect(() => {
    document.title = pageTitle('管理工作区');
  }, []);

  return (
    <div className="flex min-h-dvh items-center justify-center px-4 py-10">
      <div className="surface w-full max-w-lg overflow-hidden">
        <div className="border-b border-line/70 bg-gradient-to-br from-jade-50/70 to-white px-6 py-5">
          <BrandLockup compact />
        </div>
        <div className="px-6 py-8 text-center">
          <span className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-paper text-ink-400 ring-1 ring-inset ring-line">
            <LockKeyhole className="size-6" />
          </span>
          <p className="eyebrow mt-5">ADMIN / RESTRICTED</p>
          <h1 className="mt-2 text-xl font-bold tracking-tight text-ink-950">管理工作区尚未开放</h1>
          <p className="mx-auto mt-2 max-w-sm text-[11px] leading-relaxed text-ink-500">
            同站 /admin 将使用独立管理文档、严格 CSP、短时强认证与逐动作能力校验。当前版本没有管理数据，也没有可用登录，因此不提供任何管理入口。
          </p>

          <div className="mt-4 flex items-start gap-2 rounded-xl bg-jade-50/60 px-3.5 py-3 text-left text-[10px] leading-relaxed text-jade-800">
            <ShieldCheck className="mt-0.5 size-3.5 shrink-0" />
            隐藏按钮或直接访问这段静态占位页不会获得任何权限。管理能力只由后端当前授权决定。
          </div>

          <Link to="/" className="btn-primary mt-6 h-10 px-4 text-xs">
            <ArrowLeft className="size-3.5" />
            返回公开站点
          </Link>
        </div>
      </div>
    </div>
  );
}
