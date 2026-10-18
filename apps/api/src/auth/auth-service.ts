import type { FastifyReply, FastifyRequest } from 'fastify';
import type {
  AccountRefDTO,
  AccountRole,
  MainGroup,
  SessionDTO,
  StudentGrantStatusDTO,
} from '@soclear/contracts';
import { API_ERROR_CODES } from '@soclear/contracts';
import type { AuthRepository, SessionAccountRow } from '../db/auth-repository.js';
import { ApiError } from '../domain/errors.js';
import { verifyPassword } from './passwords.js';
import {
  createSessionToken,
  deriveCsrfToken,
  hashSessionToken,
  safeEqual,
} from './tokens.js';

export interface AuthOptions {
  cookieName: string;
  sessionSecret: string;
  demoAuth: boolean;
  secureCookie: boolean;
  sessionTtlMs?: number;
}

export interface SessionContext {
  sessionId: string;
  token: string;
  account: AccountRefDTO;
  role: AccountRole;
  mainGroup: MainGroup;
  grant: StudentGrantStatusDTO;
  csrfToken: string;
}

const DEFAULT_SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export class AuthService {
  constructor(
    private readonly repository: AuthRepository,
    private readonly options: AuthOptions,
  ) {}

  private get ttlMs(): number {
    return this.options.sessionTtlMs ?? DEFAULT_SESSION_TTL_MS;
  }

  async login(handle: string, password: string): Promise<{ token: string; session: SessionContext } | null> {
    const normalizedHandle = handle.trim().toLowerCase();
    const account = await this.repository.findAccountByHandle(normalizedHandle);
    if (!account || account.status !== 'active' || (account.is_demo && !this.options.demoAuth)) {
      return null;
    }
    if (!(await verifyPassword(password, account.password_hash))) {
      return null;
    }

    const token = createSessionToken();
    const expiresAt = new Date(Date.now() + this.ttlMs);
    await this.repository.createSession(account.id, hashSessionToken(token), expiresAt);
    const row = await this.repository.findSession(hashSessionToken(token));
    if (!row) return null;

    return { token, session: this.toContext(row, token) };
  }

  async resolve(request: FastifyRequest): Promise<SessionContext | null> {
    const cookies = request.cookies as Record<string, string | undefined>;
    const token = cookies[this.options.cookieName];
    if (!token) return null;
    const row = await this.repository.findSession(hashSessionToken(token));
    if (!row || row.status !== 'active' || (row.is_demo && !this.options.demoAuth)) return null;
    return this.toContext(row, token);
  }

  async requireSession(request: FastifyRequest): Promise<SessionContext> {
    const session = await this.resolve(request);
    if (!session) {
      throw new ApiError(401, API_ERROR_CODES.unauthenticated, '请先登录。');
    }
    return session;
  }

  requireCsrf(session: SessionContext, request: FastifyRequest): void {
    const header = request.headers['x-csrf-token'];
    if (!safeEqual(typeof header === 'string' ? header : undefined, session.csrfToken)) {
      throw new ApiError(403, API_ERROR_CODES.csrfFailed, '请求校验失败，请刷新页面后重试。');
    }
  }

  requireAdmin(session: SessionContext): void {
    if (session.role !== 'content_admin' && session.role !== 'system_admin') {
      throw new ApiError(403, API_ERROR_CODES.forbidden, '没有可用的管理权限。');
    }
  }

  requireActiveGrant(session: SessionContext): void {
    if (session.grant.state !== 'active') {
      throw new ApiError(
        403,
        API_ERROR_CODES.verificationRequired,
        '提交评价需要有效的匿名学生资格。',
      );
    }
  }

  async logout(session: SessionContext): Promise<void> {
    await this.repository.revokeSession(session.sessionId);
  }

  setCookie(reply: FastifyReply, token: string): void {
    reply.setCookie(this.options.cookieName, token, {
      path: '/',
      httpOnly: true,
      sameSite: 'lax',
      secure: this.options.secureCookie,
      maxAge: Math.floor(this.ttlMs / 1000),
    });
  }

  clearCookie(reply: FastifyReply): void {
    reply.clearCookie(this.options.cookieName, {
      path: '/',
      httpOnly: true,
      sameSite: 'lax',
      secure: this.options.secureCookie,
    });
  }

  toDTO(session: SessionContext | null): SessionDTO {
    return {
      authenticated: Boolean(session),
      account: session?.account ?? null,
      mainGroup: session?.mainGroup ?? 'guest',
      studentGrant: session?.grant ?? {
        state: 'none',
        scope: null,
        assurance: null,
        version: null,
      },
      isAdmin: session?.role === 'content_admin' || session?.role === 'system_admin',
      csrfToken: session?.csrfToken ?? null,
      authAvailable: this.options.demoAuth,
      demo: this.options.demoAuth,
    };
  }

  private toContext(row: SessionAccountRow, token: string): SessionContext {
    const grant: StudentGrantStatusDTO = {
      state: row.grant_status ?? 'none',
      scope: row.grant_scope,
      assurance: row.grant_assurance,
      version: row.grant_version,
    };

    const mainGroup: MainGroup =
      row.role === 'content_admin' || row.role === 'system_admin'
        ? row.role
        : grant.state === 'active'
          ? 'verified_student'
          : 'user';

    return {
      sessionId: row.session_id,
      token,
      account: {
        id: row.account_id,
        handle: row.handle,
        displayName: row.display_name,
        demo: row.is_demo,
      },
      role: row.role,
      mainGroup,
      grant,
      csrfToken: deriveCsrfToken(this.options.sessionSecret, token),
    };
  }
}
