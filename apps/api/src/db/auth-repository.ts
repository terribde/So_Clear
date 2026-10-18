import type { PGlite } from '@electric-sql/pglite';
import type { AccountRole } from '@soclear/contracts';

type DbTimestamp = string | Date;

export interface AccountRow {
  id: string;
  handle: string;
  display_name: string;
  password_hash: string;
  role: AccountRole;
  status: 'active' | 'restricted' | 'disabled';
  is_demo: boolean;
}

export interface SessionAccountRow {
  session_id: string;
  expires_at: DbTimestamp;
  account_id: string;
  handle: string;
  display_name: string;
  role: AccountRole;
  status: 'active' | 'restricted' | 'disabled';
  is_demo: boolean;
  grant_status: 'active' | 'revoked' | null;
  grant_scope: string | null;
  grant_assurance: 'demo_only' | 'verified_at_claim' | null;
  grant_version: number | null;
}

export const toIso = (value: DbTimestamp): string =>
  value instanceof Date ? value.toISOString() : new Date(value).toISOString();

export class AuthRepository {
  constructor(private readonly database: PGlite) {}

  async findAccountByHandle(handle: string): Promise<AccountRow | null> {
    const result = await this.database.query<AccountRow>(
      `select id, handle, display_name, password_hash, role, status, is_demo
       from private.accounts
       where handle = $1`,
      [handle],
    );
    return result.rows[0] ?? null;
  }

  async createSession(accountId: string, tokenHash: string, expiresAt: Date): Promise<void> {
    await this.database.query('delete from private.account_sessions where account_id = $1 and expires_at <= now()', [accountId]);
    await this.database.query(
      `insert into private.account_sessions (id, account_id, token_hash, expires_at)
       values (gen_random_uuid(), $1, $2, $3)`,
      [accountId, tokenHash, expiresAt.toISOString()],
    );
  }

  async findSession(tokenHash: string): Promise<SessionAccountRow | null> {
    const result = await this.database.query<SessionAccountRow>(
      `select s.id as session_id, s.expires_at,
              a.id as account_id, a.handle, a.display_name, a.role, a.status, a.is_demo,
              g.status as grant_status, g.institution_scope as grant_scope,
              g.assurance as grant_assurance, g.version as grant_version
       from private.account_sessions s
       join private.accounts a on a.id = s.account_id
       left join private.student_grants g on g.account_id = a.id
       where s.token_hash = $1
         and s.revoked_at is null
         and s.expires_at > now()`,
      [tokenHash],
    );
    return result.rows[0] ?? null;
  }

  async revokeSession(sessionId: string): Promise<void> {
    await this.database.query(
      'update private.account_sessions set revoked_at = now() where id = $1 and revoked_at is null',
      [sessionId],
    );
  }
}
