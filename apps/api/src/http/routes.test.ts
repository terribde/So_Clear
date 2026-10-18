import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { buildApp } from './routes.js';

const app = buildApp({ cursorSecret: 'test-cursor-secret' });
after(async () => {
  await app.close();
});

test('overview and teacher list return the public envelope and no-store headers', async () => {
  const overview = await app.inject({ method: 'GET', url: '/api/v1/public/overview' });
  assert.equal(overview.statusCode, 200);
  assert.equal(overview.headers['cache-control'], 'no-store, max-age=0');
  const body = overview.json();
  assert.equal(body.error, null);
  assert.equal(body.meta.synthetic, true);
  assert.equal(body.data.teacherCount, 16);

  const list = await app.inject({ method: 'GET', url: '/api/v1/public/teachers?limit=5' });
  assert.equal(list.statusCode, 200);
  const listBody = list.json();
  assert.equal(listBody.data.length, 5);
  assert.equal(listBody.meta.page.total, 16);
  assert.equal(listBody.data[0].ratingSummary.eligible, true);
});

test('public teacher DTOs do not leak moderation or author fields', async () => {
  const response = await app.inject({ method: 'GET', url: '/api/v1/public/teachers/t-shenzhiyuan' });
  assert.equal(response.statusCode, 200);
  const teacher = response.json().data;
  const text = JSON.stringify(teacher);
  assert.equal(teacher.name, '沈知远');
  assert.equal(teacher.ratingSummary.publishedCount, 9);
  for (const forbidden of ['userId', 'authorNickname', 'userEmail', 'moderationNote', 'status', 'reviewerId']) {
    assert.equal(text.includes(`"${forbidden}"`), false, `unexpected field ${forbidden}`);
  }
});

test('teacher search supports keyword, department and current-term filters', async () => {
  const search = await app.inject({
    method: 'GET',
    url: `/api/v1/public/teachers?q=${encodeURIComponent('数据结构')}`,
  });
  assert.equal(search.statusCode, 200);
  const names = search.json().data.map((teacher: { name: string }) => teacher.name);
  assert.ok(names.includes('顾清和'));
  assert.ok(names.includes('周砚'));

  const department = await app.inject({
    method: 'GET',
    url: '/api/v1/public/teachers?departmentId=d-ee',
  });
  assert.equal(department.statusCode, 200);
  assert.ok(department.json().data.every((teacher: { department: { id: string } }) => teacher.department.id === 'd-ee'));

  const current = await app.inject({ method: 'GET', url: '/api/v1/public/teachers?term=current&limit=50' });
  assert.ok(current.json().data.every((teacher: { isTeachingThisTerm: boolean }) => teacher.isTeachingThisTerm));
});

test('cursor pagination is stable and cannot be reused across filters', async () => {
  const first = await app.inject({ method: 'GET', url: '/api/v1/public/teachers?limit=3' });
  const firstBody = first.json();
  assert.equal(firstBody.data.length, 3);
  assert.ok(firstBody.meta.page.nextCursor);

  const second = await app.inject({
    method: 'GET',
    url: `/api/v1/public/teachers?limit=3&cursor=${encodeURIComponent(firstBody.meta.page.nextCursor)}`,
  });
  assert.equal(second.statusCode, 200);
  const secondBody = second.json();
  assert.equal(secondBody.data.length, 3);
  const firstIds = new Set(firstBody.data.map((teacher: { id: string }) => teacher.id));
  assert.ok(secondBody.data.every((teacher: { id: string }) => !firstIds.has(teacher.id)));

  const mismatch = await app.inject({
    method: 'GET',
    url: `/api/v1/public/teachers?limit=3&sort=clarity&cursor=${encodeURIComponent(firstBody.meta.page.nextCursor)}`,
  });
  assert.equal(mismatch.statusCode, 422);
  assert.equal(mismatch.json().error.code, 'CURSOR_INVALID');
});

test('reviews hide unpublished rows and do not expose authorship', async () => {
  const response = await app.inject({
    method: 'GET',
    url: '/api/v1/public/teachers/t-shenzhiyuan/reviews?limit=20',
  });
  assert.equal(response.statusCode, 200);
  const body = response.json();
  assert.equal(body.data.length, 9);
  assert.ok(body.data.every((review: { id: string }) => review.id.startsWith('rv-shenzhiyuan-')));
  const text = JSON.stringify(body.data);
  for (const forbidden of ['userId', 'author', 'email', 'moderationNote', 'status']) {
    assert.equal(text.includes(`"${forbidden}"`), false, `unexpected review field ${forbidden}`);
  }
});

test('teacher summaries include citation ids only for ready states', async () => {
  const ready = await app.inject({ method: 'GET', url: '/api/v1/public/teachers/t-shenzhiyuan/ai-summary' });
  assert.equal(ready.statusCode, 200);
  const readyBody = ready.json();
  assert.equal(readyBody.data.state, 'ready');
  assert.ok(readyBody.data.sentences.length > 0);
  assert.ok(readyBody.data.sentences[0].citations.length > 0);

  const insufficient = await app.inject({ method: 'GET', url: '/api/v1/public/teachers/t-xunanqiao/ai-summary' });
  assert.equal(insufficient.json().data.state, 'insufficient');
  assert.deepEqual(insufficient.json().data.sentences, []);
});

test('missing resources and invalid filters return controlled errors', async () => {
  const missing = await app.inject({ method: 'GET', url: '/api/v1/public/teachers/t-does-not-exist' });
  assert.equal(missing.statusCode, 404);
  assert.equal(missing.json().error.code, 'NOT_FOUND');

  const badDepartment = await app.inject({
    method: 'GET',
    url: '/api/v1/public/sections?departmentId=d-unknown',
  });
  assert.equal(badDepartment.statusCode, 422);
  assert.equal(badDepartment.json().error.code, 'VALIDATION_FAILED');

  const unknownParameter = await app.inject({
    method: 'GET',
    url: '/api/v1/public/teachers?apiKey=canary-must-not-be-echoed',
  });
  assert.equal(unknownParameter.statusCode, 422);
  assert.equal(unknownParameter.json().error.code, 'VALIDATION_FAILED');
  assert.equal(JSON.stringify(unknownParameter.json()).includes('canary-must-not-be-echoed'), false);
});

test('sections expose meetings and never turn unknown time into a concrete slot', async () => {
  const response = await app.inject({ method: 'GET', url: '/api/v1/public/sections?limit=50' });
  assert.equal(response.statusCode, 200);
  const sections = response.json().data;
  const unknown = sections.find((section: { id: string }) => section.id === 's-theorymech-03');
  assert.ok(unknown);
  assert.equal(unknown.meetings[0].timeUnknown, true);
  assert.equal(unknown.meetings[0].weekday, null);
  assert.ok(unknown.note.includes('不能据此判断'));
});
