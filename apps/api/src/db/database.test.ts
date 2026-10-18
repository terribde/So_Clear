import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { CatalogRepository } from './catalog-repository.js';
import { createDatabase } from './database.js';
import { seedDatabase } from './seed.js';
import {
  courses,
  departments,
  publishedReviewCount,
  sections,
  teachers,
  terms,
} from '../data/seed.js';
import { summarizeTeacherRatings } from '../domain/ratings.js';

const database = await createDatabase();
const repository = new CatalogRepository(database);

after(async () => {
  await database.close();
});

test('versioned migrations are recorded once', async () => {
  const result = await database.query<{ version: string }>(
    'select version from private.schema_migrations order by version',
  );
  assert.deepEqual(
    result.rows.map((row) => row.version),
    [
      '0001_catalog.sql',
      '0002_accounts_and_reviews.sql',
      '0003_reports.sql',
      '0004_appeals.sql',
      '0005_governance_audit.sql',
      '0006_admin_overview.sql',
      '0007_review_edit.sql',
      '0008_review_resubmit.sql',
    ],
  );
});

test('seed counts match the synthetic baseline and reseeding is idempotent', async () => {
  const count = async (sql: string) => {
    const result = await database.query<{ count: number }>(sql);
    return result.rows[0]!.count;
  };

  assert.equal(await count('select count(*)::int as count from core.teachers'), teachers.length);
  assert.equal(await count('select count(*)::int as count from core.departments'), departments.length);
  assert.equal(await count('select count(*)::int as count from core.courses'), courses.length);
  assert.equal(await count('select count(*)::int as count from core.terms'), terms.length);
  assert.equal(await count('select count(*)::int as count from core.sections'), sections.length);
  assert.equal(
    await count("select count(*)::int as count from core.reviews where status = 'published'"),
    publishedReviewCount,
  );

  await seedDatabase(database);

  assert.equal(await count('select count(*)::int as count from core.teachers'), teachers.length);
  assert.equal(await count('select count(*)::int as count from core.sections'), sections.length);
});

test('database-backed summaries match the seed-derived rating baseline', async () => {
  const stored = await repository.listTeachers();
  assert.equal(stored.length, teachers.length);

  for (const seedTeacher of teachers) {
    const teacher = stored.find((entry) => entry.id === seedTeacher.id);
    assert.ok(teacher, `missing teacher ${seedTeacher.id}`);
    assert.deepEqual(
      teacher.ratingSummary,
      summarizeTeacherRatings(seedTeacher.id),
      `rating summary mismatch for ${seedTeacher.id}`,
    );
  }
});

test('repository preserves public detail, section and summary states', async () => {
  const section = await repository.getSection('s-theorymech-03');
  assert.ok(section);
  assert.equal(section.capacity, null);
  assert.equal(section.meetings[0]?.timeUnknown, true);
  assert.equal(section.meetings[0]?.weekday, null);

  const review = await repository.getReview('rv-shenzhiyuan-01');
  assert.ok(review);
  assert.equal(review.teacherId, 't-shenzhiyuan');
  assert.equal(review.revision, 1);

  const ready = await repository.getTeacherSummary('t-shenzhiyuan');
  assert.ok(ready);
  assert.equal(ready.state, 'ready');
  assert.ok(ready.sentences[0]?.citations.length);

  const insufficient = await repository.getTeacherSummary('t-xunanqiao');
  assert.ok(insufficient);
  assert.equal(insufficient.state, 'insufficient');
  assert.deepEqual(insufficient.sentences, []);
});

test('schema rejects invalid scores, meeting times, duplicate slots and current terms', async () => {
  await assert.rejects(
    async () => {
      await database.transaction(async (tx) => {
        await tx.query(
          `insert into core.reviews
            (id, teacher_id, course_id, term_id, status, current_revision, publication_generation, created_at, updated_at)
           values ('rv-invalid-score', 't-shenzhiyuan', 'c-calc1', 't-2026-1', 'published', 1, 1, now(), now())`,
        );
        await tx.query(
          `insert into core.review_revisions
            (review_id, revision_no, clarity, organization, feedback, assessment_transparency,
             difficulty, workload, attendance, comment, rating_schema_version, submitted_at, published_at)
           values ('rv-invalid-score', 1, 6, 4, 4, 4, null, null, null, null, 1, now(), now())`,
        );
      });
    },
    /check constraint/i,
  );

  await assert.rejects(
    () =>
      database.query(
        `insert into core.meetings (section_id, sort_order, weekday, time_unknown)
         values ('s-calc1-01', 99, 1, true)`,
      ),
    /check constraint/i,
  );

  await assert.rejects(
    () =>
      database.query(
        `insert into core.sections
          (id, term_id, course_id, section_code, campus, capacity, note, data_version, source_updated_at)
         values ('s-duplicate-code', 't-2026-1', 'c-calc1', 'SEC-HM101-01', '犀浦校区', 10, null, 1, now())`,
      ),
    /duplicate key/i,
  );

  await assert.rejects(
    () =>
      database.query(
        `insert into core.terms (id, institution_id, label, is_current, sort_order)
         values ('t-second-current', 'inst-main', '重复当前学期', true, 99)`,
      ),
    /duplicate key/i,
  );

  await database.query("delete from core.terms where id in ('t-second-current')");
});

test('published projection never exposes pending or hidden reviews', async () => {
  for (const [id, status] of [
    ['rv-dbtest-pending', 'pending'],
    ['rv-dbtest-hidden', 'hidden'],
  ] as const) {
    await database.query(
      `insert into core.reviews
        (id, teacher_id, course_id, term_id, status, current_revision, publication_generation, created_at, updated_at)
       values ($1, 't-shenzhiyuan', 'c-calc1', 't-2026-1', $2, 1, 1, now(), now())`,
      [id, status],
    );
    await database.query(
      `insert into core.review_revisions
        (review_id, revision_no, clarity, organization, feedback, assessment_transparency,
         difficulty, workload, attendance, comment, rating_schema_version, submitted_at, published_at)
       values ($1, 1, 4, 4, 4, 4, null, null, null, null, 1, now(), now())`,
      [id],
    );
  }

  const visible = await database.query<{ id: string }>(
    `select id from published.review_public
     where id in ('rv-dbtest-pending', 'rv-dbtest-hidden')`,
  );
  assert.deepEqual(visible.rows, []);
  assert.equal(await repository.getReview('rv-dbtest-pending'), null);
  assert.equal(await repository.getReview('rv-dbtest-hidden'), null);

  await database.query("delete from core.reviews where id like 'rv-dbtest-%'");
});

test('file-backed database persists seeded data across restarts', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'soclear-db-'));
  try {
    const first = await createDatabase({ dataDir: directory });
    const firstCount = await first.query<{ count: number }>(
      'select count(*)::int as count from core.teachers',
    );
    await first.close();

    const second = await createDatabase({ dataDir: directory });
    const secondCount = await second.query<{ count: number }>(
      'select count(*)::int as count from core.teachers',
    );
    await second.close();

    assert.equal(firstCount.rows[0]?.count, teachers.length);
    assert.equal(secondCount.rows[0]?.count, teachers.length);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
