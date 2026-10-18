import { PGlite } from '@electric-sql/pglite';
import { mkdir, readdir, readFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { seedDatabase } from './seed.js';

const MIGRATIONS_DIR = new URL('./migrations/', import.meta.url);

async function applyMigrations(database: PGlite): Promise<void> {
  await database.exec(`
    create schema if not exists private;
    create table if not exists private.schema_migrations (
      version text primary key,
      applied_at timestamptz not null default now()
    );
  `);

  const files = (await readdir(MIGRATIONS_DIR))
    .filter((file) => file.endsWith('.sql'))
    .sort();

  for (const file of files) {
    const existing = await database.query<{ exists: boolean }>(
      'select exists (select 1 from private.schema_migrations where version = $1) as exists',
      [file],
    );
    if (existing.rows[0]?.exists) continue;

    const sql = await readFile(new URL(file, MIGRATIONS_DIR), 'utf8');
    await database.transaction(async (tx) => {
      await tx.exec(sql);
      await tx.query('insert into private.schema_migrations (version) values ($1)', [file]);
    });
  }
}

export interface DatabaseOptions {
  dataDir?: string;
  seed?: boolean;
}

export async function createDatabase(options: DatabaseOptions = {}): Promise<PGlite> {
  if (options.dataDir && options.dataDir !== 'memory://') {
    await mkdir(dirname(options.dataDir), { recursive: true });
  }
  const database = options.dataDir
    ? new PGlite(options.dataDir)
    : new PGlite('memory://');
  await database.waitReady;
  await applyMigrations(database);
  if (options.seed !== false) {
    await seedDatabase(database);
  }
  return database;
}
