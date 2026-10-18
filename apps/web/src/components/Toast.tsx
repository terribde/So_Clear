import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';

type ToastTone = 'success' | 'error' | 'info';

interface ToastMessage {
  id: number;
  message: string;
  tone: ToastTone;
}

type ToastPush = (message: string, tone?: ToastTone) => void;

const ToastContext = createContext<ToastPush | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const timerRef = useRef<number | null>(null);
  const nextId = useRef(0);

  const push = useCallback<ToastPush>((message, tone = 'info') => {
    if (timerRef.current) window.clearTimeout(timerRef.current);
    const id = ++nextId.current;
    setToast({ id, message, tone });
    timerRef.current = window.setTimeout(() => {
      setToast((current) => (current?.id === id ? null : current));
    }, 3600);
  }, []);

  useEffect(
    () => () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    },
    [],
  );

  const contextValue = useMemo(() => push, [push]);

  return (
    <ToastContext.Provider value={contextValue}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 top-4 z-[90] flex justify-center px-4">
        <AnimatePresence>
          {toast ? (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, y: -14, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.97 }}
              transition={{ type: 'spring', stiffness: 380, damping: 30 }}
              role="status"
              className={`pointer-events-auto flex max-w-md items-start gap-2.5 rounded-2xl border px-4 py-3 text-sm font-medium shadow-lg backdrop-blur-md ${
                toast.tone === 'success'
                  ? 'border-jade-200 bg-jade-50/95 text-jade-800'
                  : toast.tone === 'error'
                    ? 'border-rose-200 bg-rose-50/95 text-rose-800'
                    : 'border-line bg-white/95 text-ink-700'
              }`}
            >
              {toast.tone === 'success' ? (
                <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-jade-600" />
              ) : toast.tone === 'error' ? (
                <AlertCircle className="mt-0.5 size-4 shrink-0 text-rose-500" />
              ) : (
                <Info className="mt-0.5 size-4 shrink-0 text-ink-400" />
              )}
              <span className="leading-relaxed">{toast.message}</span>
              <button
                type="button"
                onClick={() => setToast(null)}
                className="ml-1 rounded-md p-0.5 text-ink-300 transition hover:text-ink-700"
                aria-label="关闭提示"
              >
                <X className="size-3.5" />
              </button>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastPush {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used inside ToastProvider');
  return context;
}
