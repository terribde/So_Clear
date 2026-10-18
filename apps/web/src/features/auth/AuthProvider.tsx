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
import { AUTH_PATHS, type DemoAccountsDTO, type SessionDTO } from '@soclear/contracts';
import { apiGet, apiRequest, errorMessage } from '../api/client';

export const GUEST_SESSION: SessionDTO = {
  authenticated: false,
  account: null,
  mainGroup: 'guest',
  studentGrant: { state: 'none', scope: null, assurance: null, version: null },
  isAdmin: false,
  csrfToken: null,
  authAvailable: true,
  demo: true,
};

interface AuthContextValue {
  session: SessionDTO | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<SessionDTO>;
  login: (handle: string, password: string) => Promise<SessionDTO>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<SessionDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const sessionRef = useRef<SessionDTO | null>(null);
  sessionRef.current = session;

  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;

    apiRequest<SessionDTO>(AUTH_PATHS.session, {
      credentials: 'include',
      signal: controller.signal,
    })
      .then((result) => {
        if (cancelled) return;
        setSession(result.data);
        setError(null);
      })
      .catch((cause: unknown) => {
        if (cancelled || (cause instanceof DOMException && cause.name === 'AbortError')) return;
        setSession({ ...GUEST_SESSION, authAvailable: false, demo: false });
        setError(errorMessage(cause));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, []);

  const refresh = useCallback(async () => {
    const result = await apiRequest<SessionDTO>(AUTH_PATHS.session, {
      credentials: 'include',
    });
    setSession(result.data);
    setError(null);
    return result.data;
  }, []);

  const login = useCallback(async (handle: string, password: string) => {
    const result = await apiRequest<SessionDTO>(AUTH_PATHS.login, {
      method: 'POST',
      credentials: 'include',
      body: { handle, password },
    });
    setSession(result.data);
    setError(null);
    return result.data;
  }, []);

  const logout = useCallback(async () => {
    const current = sessionRef.current;
    let failure: unknown = null;

    try {
      if (current?.authenticated) {
        await apiRequest<void>(AUTH_PATHS.logout, {
          method: 'POST',
          credentials: 'include',
          csrfToken: current.csrfToken,
        });
      }
    } catch (cause) {
      failure = cause;
    }

    try {
      const next = await refresh();
      if (failure && next.authenticated) throw failure;
    } catch (cause) {
      if (cause === failure) throw cause;
      setSession({
        ...GUEST_SESSION,
        authAvailable: current?.authAvailable ?? true,
        demo: current?.demo ?? true,
      });
    }
  }, [refresh]);

  const value = useMemo<AuthContextValue>(
    () => ({ session, loading, error, refresh, login, logout }),
    [error, loading, login, logout, refresh, session],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
}

export async function fetchDemoAccounts(signal?: AbortSignal): Promise<DemoAccountsDTO> {
  const result = await apiGet<DemoAccountsDTO>(AUTH_PATHS.demoAccounts, signal);
  return result.data;
}
