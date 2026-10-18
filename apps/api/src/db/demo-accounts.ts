import type { PGlite } from '@electric-sql/pglite';
import { randomUUID } from 'node:crypto';
import type { AccountRole } from '@soclear/contracts';
import { hashPassword } from '../auth/passwords.js';

export const DEMO_ACCOUNTS = [
  {
    handle: 'demo-student',
    password: 'soclear-demo-student',
    displayName: '演示学生',
    role: 'user' as AccountRole,
    student: true,
    label: '认证学生（演示）',
  },
  {
    handle: 'demo-moderator',
    password: 'soclear-demo-moderator',
    displayName: '演示内容管理员',
    role: 'content_admin' as AccountRole,
    student: false,
    label: '内容管理员（演示）',
  },
  {
    handle: 'demo-user',
    password: 'soclear-demo-user',
    displayName: '演示用户',
    role: 'user' as AccountRole,
    student: false,
    label: '普通用户（演示，无学生资格）',
  },
] as const;

export async function seedDemoAccounts(database: PGlite): Promise<void> {
  const existing = await database.query<{ count: number }>(
    'select count(*)::int as count from private.accounts where is_demo',
  );
  if ((existing.rows[0]?.count ?? 0) > 0) return;

  for (const account of DEMO_ACCOUNTS) {
    const accountId = randomUUID();
    const passwordHash = await hashPassword(account.password);
    await database.query(
      `insert into private.accounts
        (id, handle, display_name, password_hash, role, status, is_demo)
       values ($1, $2, $3, $4, $5, 'active', true)`,
      [accountId, account.handle, account.displayName, passwordHash, account.role],
    );

    if (account.student) {
      await database.query(
        `insert into private.student_grants
          (account_id, grant_id, status, institution_scope, assurance, is_demo, version, verified_at)
         values ($1, $2, 'active', 'inst-main', 'demo_only', true, 1, now())`,
        [accountId, randomUUID()],
      );
    }
  }
}
