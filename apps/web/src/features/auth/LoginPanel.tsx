import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import type { DemoAccountsDTO, SessionDTO } from '@soclear/contracts';
import { AlertCircle, KeyRound, LoaderCircle, LogIn, ShieldCheck, UserRound } from 'lucide-react';
import { useToast } from '../../components/Toast';
import { errorMessage } from '../api/client';
import { fetchDemoAccounts, useAuth } from './AuthProvider';

type DemoAccount = DemoAccountsDTO['accounts'][number];

export function LoginPanel({
  title = '登录本地演示账号',
  description = '账号只用于本地合成数据。登录后不会获得真实学校身份，也不会自动获得学生评价资格。',
  compact = false,
  onSuccess,
}: {
  title?: string;
  description?: string;
  compact?: boolean;
  onSuccess?: (session: SessionDTO) => void;
}) {
  const { session, login } = useAuth();
  const toast = useToast();
  const handleId = useId();
  const passwordId = useId();
  const passwordRef = useRef<HTMLInputElement>(null);
  const [handle, setHandle] = useState('');
  const [password, setPassword] = useState('');
  const [accounts, setAccounts] = useState<DemoAccount[]>([]);
  const [accountsError, setAccountsError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (session?.demo === false) return;
    const controller = new AbortController();
    fetchDemoAccounts(controller.signal)
      .then((data) => setAccounts(data.accounts))
      .catch((cause: unknown) => {
        if (cause instanceof DOMException && cause.name === 'AbortError') return;
        setAccountsError(errorMessage(cause));
      });
    return () => controller.abort();
  }, [session?.demo]);

  const fillAccount = (account: DemoAccount) => {
    setHandle(account.handle);
    setPassword(account.password);
    setError(null);
    passwordRef.current?.focus();
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!handle.trim() || password.length < 8) {
      setError('请输入账号与至少 8 位密码。');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const next = await login(handle.trim(), password);
      toast(`已登录：${next.account?.displayName ?? '当前账号'}`, 'success');
      setPassword('');
      onSuccess?.(next);
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setSubmitting(false);
    }
  };

  if (session && !session.authAvailable) {
    return (
      <div className={`rounded-2xl border border-sun-100 bg-sun-50/70 ${compact ? 'p-4' : 'p-5'}`}>
        <p className="flex items-center gap-2 text-sm font-semibold text-sun-700">
          <ShieldCheck className="size-4" />
          当前 API 未启用演示登录
        </p>
        <p className="mt-2 text-[11px] leading-relaxed text-sun-700/90">
          本地演示登录由 API 的 <code className="font-mono">DEMO_AUTH</code> 控制。公开查询仍然可用；真实学生认证尚未接入，因此这里不会提供替代登录。
        </p>
      </div>
    );
  }

  return (
    <div className={compact ? '' : 'rounded-3xl border border-line bg-white p-5 sm:p-6'}>
      <div className="flex items-center gap-2.5">
        <span className="flex size-9 items-center justify-center rounded-2xl bg-jade-50 text-jade-700">
          <KeyRound className="size-4" />
        </span>
        <div>
          <h2 className="text-base font-bold tracking-tight text-ink-950">{title}</h2>
          <p className="mt-0.5 text-[10px] leading-relaxed text-ink-400">{description}</p>
        </div>
      </div>

      <form onSubmit={submit} className="mt-4 space-y-3">
        <div>
          <label htmlFor={handleId} className="mb-1.5 block text-[11px] font-semibold text-ink-700">
            账号
          </label>
          <div className="relative">
            <UserRound className="pointer-events-none absolute left-3.5 top-1/2 size-3.5 -translate-y-1/2 text-ink-300" />
            <input
              id={handleId}
              name="handle"
              type="text"
              autoComplete="username"
              spellCheck={false}
              value={handle}
              onChange={(event) => setHandle(event.target.value)}
              placeholder="demo-student"
              className="field py-2.5 pl-9 text-xs"
            />
          </div>
        </div>

        <div>
          <label htmlFor={passwordId} className="mb-1.5 block text-[11px] font-semibold text-ink-700">
            密码
          </label>
          <div className="relative">
            <KeyRound className="pointer-events-none absolute left-3.5 top-1/2 size-3.5 -translate-y-1/2 text-ink-300" />
            <input
              ref={passwordRef}
              id={passwordId}
              name="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="仅用于本地演示"
              className="field py-2.5 pl-9 text-xs"
            />
          </div>
        </div>

        {error ? (
          <p role="alert" className="flex items-start gap-1.5 rounded-xl bg-rose-50/70 px-3 py-2 text-[11px] leading-relaxed text-rose-700">
            <AlertCircle className="mt-0.5 size-3.5 shrink-0" />
            {error}
          </p>
        ) : null}

        <button type="submit" disabled={submitting} className="btn-primary h-10 w-full px-4 text-xs">
          {submitting ? (
            <>
              <LoaderCircle className="size-3.5 animate-spin" />
              正在登录
            </>
          ) : (
            <>
              <LogIn className="size-3.5" />
              登录
            </>
          )}
        </button>
      </form>

      {accounts.length > 0 ? (
        <div className="mt-4 border-t border-line/70 pt-3.5">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[10px] font-semibold text-ink-500">本地演示账号</p>
            <span className="rounded-full bg-sun-50 px-1.5 py-0.5 text-[8px] font-medium text-sun-700">
              仅合成数据
            </span>
          </div>
          <div className="mt-2 space-y-1.5">
            {accounts.map((account) => (
              <button
                key={account.handle}
                type="button"
                onClick={() => fillAccount(account)}
                className="flex w-full items-center justify-between gap-3 rounded-xl border border-line/70 bg-paper/40 px-3 py-2 text-left transition hover:border-jade-200 hover:bg-jade-50/40"
              >
                <span className="min-w-0">
                  <span className="block text-[11px] font-semibold text-ink-800">{account.label}</span>
                  <span className="mt-0.5 block truncate font-mono text-[9px] text-ink-400">
                    {account.handle} / {account.password}
                  </span>
                </span>
                <span className="shrink-0 text-[9px] font-semibold text-jade-700">填入</span>
              </button>
            ))}
          </div>
          <p className="mt-2 text-[9px] leading-relaxed text-ink-400">
            这些账号与密码来自本地种子数据，登录与评价操作不会接触学校系统。生产环境会关闭该入口。
          </p>
        </div>
      ) : accountsError ? (
        <p className="mt-3 text-[10px] leading-relaxed text-ink-400">
          演示账号列表暂不可用；仍可直接输入已知的本地账号。
        </p>
      ) : null}
    </div>
  );
}
