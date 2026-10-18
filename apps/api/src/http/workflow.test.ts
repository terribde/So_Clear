import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import {
  ADMIN_PATHS,
  AUTH_PATHS,
  ME_PATHS,
  PUBLIC_PATHS,
} from '@soclear/contracts';
import { buildApp } from './routes.js';

const app = await buildApp({
  cursorSecret: 'test-cursor-secret',
  sessionSecret: 'test-session-secret',
  demoAuth: true,
  loginRateLimit: { limit: 300, windowMs: 60_000 },
  rateLimit: { limit: 2_000, windowMs: 60_000 },
});

after(async () => {
  await app.close();
});

interface LoginResult {
  cookie: string;
  csrf: string;
  session: Record<string, unknown>;
}

function extractCookie(header: string | string[] | undefined): string {
  const value = Array.isArray(header) ? header[0] : header;
  assert.ok(value, 'expected a session cookie');
  return value.split(';')[0]!;
}

async function login(handle: string, password: string): Promise<LoginResult> {
  const response = await app.inject({
    method: 'POST',
    url: AUTH_PATHS.login,
    payload: { handle, password },
  });
  assert.equal(response.statusCode, 200, response.body);
  const body = response.json();
  assert.ok(body.data.csrfToken);
  return {
    cookie: extractCookie(response.headers['set-cookie']),
    csrf: body.data.csrfToken,
    session: body.data,
  };
}

const reviewPayload = {
  teacherId: 't-shenzhiyuan',
  courseId: 'c-calc1',
  termId: 't-2026-1',
  scores: { clarity: 5, organization: 4, feedback: 4, assessmentTransparency: 5 },
  difficulty: 3,
  workload: 4,
  attendance: '偶尔点名',
  comment: '测试评价：推导清晰，作业反馈具体。',
} as const;

test('demo login issues an httpOnly session and CSRF token', async () => {
  const response = await app.inject({
    method: 'POST',
    url: AUTH_PATHS.login,
    payload: { handle: 'demo-student', password: 'soclear-demo-student' },
  });
  assert.equal(response.statusCode, 200);
  const setCookie = response.headers['set-cookie'];
  const raw = Array.isArray(setCookie) ? setCookie.join(';') : String(setCookie);
  assert.match(raw, /HttpOnly/i);
  assert.match(raw, /SameSite=Lax/i);

  const body = response.json();
  assert.equal(body.data.authenticated, true);
  assert.equal(body.data.mainGroup, 'verified_student');
  assert.equal(body.data.studentGrant.state, 'active');
  assert.equal(body.data.studentGrant.assurance, 'demo_only');
  assert.equal(body.data.account.handle, 'demo-student');
  assert.ok(body.data.csrfToken);

  const cookie = extractCookie(setCookie);
  const session = await app.inject({
    method: 'GET',
    url: AUTH_PATHS.session,
    headers: { cookie },
  });
  assert.equal(session.statusCode, 200);
  assert.equal(session.json().data.authenticated, true);
  assert.equal(session.json().data.csrfToken, body.data.csrfToken);

  const wrongPassword = await app.inject({
    method: 'POST',
    url: AUTH_PATHS.login,
    payload: { handle: 'demo-student', password: 'wrong-password' },
  });
  assert.equal(wrongPassword.statusCode, 401);
  assert.equal(wrongPassword.json().error.code, 'AUTH_INVALID_CREDENTIALS');
});

test('review submission requires session, CSRF and an active student grant', async () => {
  const unauthenticated = await app.inject({
    method: 'POST',
    url: ME_PATHS.reviews,
    payload: reviewPayload,
  });
  assert.equal(unauthenticated.statusCode, 401);

  const student = await login('demo-student', 'soclear-demo-student');
  const noCsrf = await app.inject({
    method: 'POST',
    url: ME_PATHS.reviews,
    headers: { cookie: student.cookie },
    payload: reviewPayload,
  });
  assert.equal(noCsrf.statusCode, 403);
  assert.equal(noCsrf.json().error.code, 'CSRF_FAILED');

  const user = await login('demo-user', 'soclear-demo-user');
  assert.equal(user.session.mainGroup, 'user');
  const unverified = await app.inject({
    method: 'POST',
    url: ME_PATHS.reviews,
    headers: { cookie: user.cookie, 'x-csrf-token': user.csrf },
    payload: reviewPayload,
  });
  assert.equal(unverified.statusCode, 403);
  assert.equal(unverified.json().error.code, 'STUDENT_VERIFICATION_REQUIRED');
});

test('student can submit one pending review per teacher, course and term', async () => {
  const student = await login('demo-student', 'soclear-demo-student');
  const headers = { cookie: student.cookie, 'x-csrf-token': student.csrf };

  const publicBefore = await app.inject({
    method: 'GET',
    url: `${PUBLIC_PATHS.teacherReviews('t-shenzhiyuan')}?limit=50`,
  });
  const countBefore = publicBefore.json().meta.page.total;

  const created = await app.inject({
    method: 'POST',
    url: ME_PATHS.reviews,
    headers,
    payload: reviewPayload,
  });
  assert.equal(created.statusCode, 201, created.body);
  const review = created.json().data;
  assert.equal(review.status, 'pending');
  assert.equal(review.version, 1);
  assert.equal(review.revision, 1);
  assert.equal(review.teacher.name, '沈知远');
  assert.equal(review.course.name, '高等数学（I）');
  assert.equal(review.publishedAt, null);
  assert.equal(review.actions.canWithdraw, true);

  const duplicate = await app.inject({
    method: 'POST',
    url: ME_PATHS.reviews,
    headers,
    payload: reviewPayload,
  });
  assert.equal(duplicate.statusCode, 409);
  assert.equal(duplicate.json().error.code, 'REVIEW_SLOT_TAKEN');

  const own = await app.inject({
    method: 'GET',
    url: ME_PATHS.reviews,
    headers: { cookie: student.cookie },
  });
  assert.equal(own.statusCode, 200);
  assert.equal(own.json().meta.page.total, 1);
  assert.equal(own.json().data[0].id, review.id);

  const publicAfter = await app.inject({
    method: 'GET',
    url: `${PUBLIC_PATHS.teacherReviews('t-shenzhiyuan')}?limit=50`,
  });
  assert.equal(publicAfter.json().meta.page.total, countBefore);
  assert.equal(
    publicAfter.json().data.some((entry: { id: string }) => entry.id === review.id),
    false,
  );
});

test('only content administrators can review pending submissions and users cannot self-review', async () => {
  const student = await login('demo-student', 'soclear-demo-student');
  const forbidden = await app.inject({
    method: 'GET',
    url: ADMIN_PATHS.reviews,
    headers: { cookie: student.cookie },
  });
  assert.equal(forbidden.statusCode, 403);

  const moderator = await login('demo-moderator', 'soclear-demo-moderator');
  assert.equal(moderator.session.mainGroup, 'content_admin');
  assert.equal(moderator.session.isAdmin, true);

  const queue = await app.inject({
    method: 'GET',
    url: ADMIN_PATHS.reviews,
    headers: { cookie: moderator.cookie },
  });
  assert.equal(queue.statusCode, 200);
  assert.ok(queue.json().data.length >= 1);
  const queueText = JSON.stringify(queue.json().data);
  for (const forbiddenField of ['accountId', 'author', 'email', 'studentGrant']) {
    assert.equal(queueText.includes(`"${forbiddenField}"`), false);
  }

  const pending = queue.json().data[0];
  const noCsrf = await app.inject({
    method: 'POST',
    url: ADMIN_PATHS.reviewDecision(pending.id),
    headers: { cookie: moderator.cookie },
    payload: { decision: 'approve', expectedVersion: pending.version },
  });
  assert.equal(noCsrf.statusCode, 403);
  assert.equal(noCsrf.json().error.code, 'CSRF_FAILED');

  const approved = await app.inject({
    method: 'POST',
    url: ADMIN_PATHS.reviewDecision(pending.id),
    headers: { cookie: moderator.cookie, 'x-csrf-token': moderator.csrf },
    payload: { decision: 'approve', expectedVersion: pending.version },
  });
  assert.equal(approved.statusCode, 200, approved.body);
  assert.equal(approved.json().data.status, 'published');

  const repeated = await app.inject({
    method: 'POST',
    url: ADMIN_PATHS.reviewDecision(pending.id),
    headers: { cookie: moderator.cookie, 'x-csrf-token': moderator.csrf },
    payload: { decision: 'approve', expectedVersion: pending.version + 1 },
  });
  assert.equal(repeated.statusCode, 409);
  assert.equal(repeated.json().error.code, 'REVIEW_NOT_EDITABLE');

  const publicReviews = await app.inject({
    method: 'GET',
    url: `${PUBLIC_PATHS.teacherReviews('t-shenzhiyuan')}?limit=50`,
  });
  assert.ok(publicReviews.json().data.some((entry: { id: string }) => entry.id === pending.id));

  const publicReview = await app.inject({
    method: 'GET',
    url: PUBLIC_PATHS.review(pending.id),
  });
  assert.equal(publicReview.statusCode, 200);
  const publicText = JSON.stringify(publicReview.json().data);
  for (const forbiddenField of ['accountId', 'author', 'email', 'moderationReason']) {
    assert.equal(publicText.includes(`"${forbiddenField}"`), false);
  }

  const summary = await app.inject({
    method: 'GET',
    url: PUBLIC_PATHS.teacherSummary('t-shenzhiyuan'),
  });
  assert.equal(summary.json().data.state, 'generating');
});

test('withdrawing a published review removes it from public reads and frees the slot', async () => {
  const student = await login('demo-student', 'soclear-demo-student');
  const headers = { cookie: student.cookie, 'x-csrf-token': student.csrf };

  const own = await app.inject({
    method: 'GET',
    url: ME_PATHS.reviews,
    headers: { cookie: student.cookie },
  });
  const published = own.json().data.find((entry: { status: string }) => entry.status === 'published');
  assert.ok(published);

  const stale = await app.inject({
    method: 'POST',
    url: ME_PATHS.reviewWithdraw(published.id),
    headers,
    payload: { expectedVersion: published.version - 1 },
  });
  assert.equal(stale.statusCode, 409);
  assert.equal(stale.json().error.code, 'VERSION_CONFLICT');

  const withdrawn = await app.inject({
    method: 'POST',
    url: ME_PATHS.reviewWithdraw(published.id),
    headers,
    payload: { expectedVersion: published.version },
  });
  assert.equal(withdrawn.statusCode, 200, withdrawn.body);
  assert.equal(withdrawn.json().data.status, 'withdrawn');
  assert.equal(withdrawn.json().data.version, published.version + 1);

  const publicReview = await app.inject({
    method: 'GET',
    url: PUBLIC_PATHS.review(published.id),
  });
  assert.equal(publicReview.statusCode, 404);

  const resubmitted = await app.inject({
    method: 'POST',
    url: ME_PATHS.reviews,
    headers,
    payload: { ...reviewPayload, comment: '撤回后重新提交的新评价。' },
  });
  assert.equal(resubmitted.statusCode, 201, resubmitted.body);
  assert.equal(resubmitted.json().data.status, 'pending');
  assert.notEqual(resubmitted.json().data.id, published.id);
});

test('rejecting a review records a private reason and keeps it out of public reads', async () => {
  const student = await login('demo-student', 'soclear-demo-student');
  const moderator = await login('demo-moderator', 'soclear-demo-moderator');

  const created = await app.inject({
    method: 'POST',
    url: ME_PATHS.reviews,
    headers: { cookie: student.cookie, 'x-csrf-token': student.csrf },
    payload: {
      ...reviewPayload,
      teacherId: 't-guqinghe',
      courseId: 'c-ds',
      comment: '缺少具体细节的评价。',
    },
  });
  assert.equal(created.statusCode, 201, created.body);
  const pending = created.json().data;

  const missingReason = await app.inject({
    method: 'POST',
    url: ADMIN_PATHS.reviewDecision(pending.id),
    headers: { cookie: moderator.cookie, 'x-csrf-token': moderator.csrf },
    payload: { decision: 'reject', expectedVersion: pending.version },
  });
  assert.equal(missingReason.statusCode, 422);

  const rejected = await app.inject({
    method: 'POST',
    url: ADMIN_PATHS.reviewDecision(pending.id),
    headers: { cookie: moderator.cookie, 'x-csrf-token': moderator.csrf },
    payload: {
      decision: 'reject',
      reasonCode: 'insufficient_detail',
      expectedVersion: pending.version,
    },
  });
  assert.equal(rejected.statusCode, 200, rejected.body);
  assert.equal(rejected.json().data.status, 'rejected');

  const own = await app.inject({
    method: 'GET',
    url: ME_PATHS.reviews,
    headers: { cookie: student.cookie },
  });
  const rejectedOwn = own.json().data.find((entry: { id: string }) => entry.id === pending.id);
  assert.equal(rejectedOwn.status, 'rejected');
  assert.equal(rejectedOwn.moderationReason, 'insufficient_detail');

  const publicReview = await app.inject({
    method: 'GET',
    url: PUBLIC_PATHS.review(pending.id),
  });
  assert.equal(publicReview.statusCode, 404);
});

test('authenticated accounts can report published reviews but not their own or twice', async () => {
  const unauthenticated = await app.inject({
    method: 'POST',
    url: ME_PATHS.reports,
    payload: { reviewId: 'rv-shenzhiyuan-01', reasonCode: 'privacy' },
  });
  assert.equal(unauthenticated.statusCode, 401);

  const user = await login('demo-user', 'soclear-demo-user');
  const userHeaders = { cookie: user.cookie, 'x-csrf-token': user.csrf };
  const student = await login('demo-student', 'soclear-demo-student');

  const publicReviews = await app.inject({
    method: 'GET',
    url: `${PUBLIC_PATHS.teacherReviews('t-shenzhiyuan')}?limit=50`,
  });
  const target = publicReviews.json().data[0];
  assert.ok(target);

  const created = await app.inject({
    method: 'POST',
    url: ME_PATHS.reports,
    headers: userHeaders,
    payload: {
      reviewId: target.id,
      reasonCode: 'privacy',
      note: '测试举报：评价包含需要核查的联系方式描述。',
    },
  });
  assert.equal(created.statusCode, 201, created.body);
  const report = created.json().data;
  assert.equal(report.status, 'pending');
  assert.equal(report.reasonCode, 'privacy');
  assert.equal(report.review.id, target.id);
  assert.equal(report.review.teacher.name, '沈知远');
  assert.equal(report.resolution, null);
  const reportText = JSON.stringify(report);
  for (const forbiddenField of ['accountId', 'reporter', 'reporter_account_id', 'email']) {
    assert.equal(reportText.includes(`"${forbiddenField}"`), false);
  }

  const duplicate = await app.inject({
    method: 'POST',
    url: ME_PATHS.reports,
    headers: userHeaders,
    payload: { reviewId: target.id, reasonCode: 'spam' },
  });
  assert.equal(duplicate.statusCode, 409);
  assert.equal(duplicate.json().error.code, 'REPORT_ALREADY_EXISTS');

  const ownReports = await app.inject({
    method: 'GET',
    url: ME_PATHS.reports,
    headers: { cookie: user.cookie },
  });
  assert.equal(ownReports.statusCode, 200);
  assert.equal(ownReports.json().meta.page.total, 1);
  assert.equal(ownReports.json().data[0].id, report.id);
  assert.equal(ownReports.json().data[0].review.publishedAt !== null, true);

  const own = await app.inject({
    method: 'GET',
    url: ME_PATHS.reviews,
    headers: { cookie: student.cookie },
  });
  const ownPending = own.json().data.find((entry: { status: string }) => entry.status === 'pending');
  assert.ok(ownPending);

  const selfReport = await app.inject({
    method: 'POST',
    url: ME_PATHS.reports,
    headers: { cookie: student.cookie, 'x-csrf-token': student.csrf },
    payload: { reviewId: ownPending.id, reasonCode: 'other' },
  });
  assert.equal(selfReport.statusCode, 403);
  assert.equal(selfReport.json().error.code, 'REPORT_SELF_FORBIDDEN');

  const pendingTarget = await app.inject({
    method: 'POST',
    url: ME_PATHS.reports,
    headers: userHeaders,
    payload: { reviewId: ownPending.id, reasonCode: 'other' },
  });
  assert.equal(pendingTarget.statusCode, 409);
  assert.equal(pendingTarget.json().error.code, 'REPORT_NOT_ACTIONABLE');
});

test('administrators can dismiss a report without changing the public review', async () => {
  const user = await login('demo-user', 'soclear-demo-user');
  const moderator = await login('demo-moderator', 'soclear-demo-moderator');
  const moderatorHeaders = { cookie: moderator.cookie, 'x-csrf-token': moderator.csrf };

  const publicReviews = await app.inject({
    method: 'GET',
    url: `${PUBLIC_PATHS.teacherReviews('t-shenzhiyuan')}?limit=50`,
  });
  const target = publicReviews.json().data[1];
  assert.ok(target);

  const created = await app.inject({
    method: 'POST',
    url: ME_PATHS.reports,
    headers: { cookie: user.cookie, 'x-csrf-token': user.csrf },
    payload: { reviewId: target.id, reasonCode: 'spam', note: '测试驳回：重复或无关内容。' },
  });
  assert.equal(created.statusCode, 201, created.body);
  const report = created.json().data;

  const forbidden = await app.inject({
    method: 'GET',
    url: ADMIN_PATHS.reports,
    headers: { cookie: user.cookie },
  });
  assert.equal(forbidden.statusCode, 403);

  const queue = await app.inject({
    method: 'GET',
    url: ADMIN_PATHS.reports,
    headers: { cookie: moderator.cookie },
  });
  assert.equal(queue.statusCode, 200);
  const queueText = JSON.stringify(queue.json().data);
  for (const forbiddenField of ['accountId', 'reporter', 'reporter_account_id', 'email']) {
    assert.equal(queueText.includes(`"${forbiddenField}"`), false);
  }

  const noCsrf = await app.inject({
    method: 'POST',
    url: ADMIN_PATHS.reportDecision(report.id),
    headers: { cookie: moderator.cookie },
    payload: { decision: 'dismiss', expectedVersion: report.version },
  });
  assert.equal(noCsrf.statusCode, 403);
  assert.equal(noCsrf.json().error.code, 'CSRF_FAILED');

  const dismissed = await app.inject({
    method: 'POST',
    url: ADMIN_PATHS.reportDecision(report.id),
    headers: moderatorHeaders,
    payload: { decision: 'dismiss', expectedVersion: report.version },
  });
  assert.equal(dismissed.statusCode, 200, dismissed.body);
  assert.equal(dismissed.json().data.status, 'dismissed');
  assert.equal(dismissed.json().data.resolution, 'dismissed');

  const publicReview = await app.inject({
    method: 'GET',
    url: PUBLIC_PATHS.review(target.id),
  });
  assert.equal(publicReview.statusCode, 200);

  const repeated = await app.inject({
    method: 'POST',
    url: ADMIN_PATHS.reportDecision(report.id),
    headers: moderatorHeaders,
    payload: { decision: 'dismiss', expectedVersion: report.version + 1 },
  });
  assert.equal(repeated.statusCode, 409);
  assert.equal(repeated.json().error.code, 'REPORT_NOT_ACTIONABLE');

  const ownReports = await app.inject({
    method: 'GET',
    url: ME_PATHS.reports,
    headers: { cookie: user.cookie },
  });
  const ownReport = ownReports
    .json()
    .data.find((entry: { id: string }) => entry.id === report.id);
  assert.equal(ownReport.status, 'dismissed');
  assert.equal(ownReport.resolution, 'dismissed');
});

test('hiding a reported review removes it from public reads and resolves reports', async () => {
  const user = await login('demo-user', 'soclear-demo-user');
  const moderator = await login('demo-moderator', 'soclear-demo-moderator');

  const publicReviews = await app.inject({
    method: 'GET',
    url: `${PUBLIC_PATHS.teacherReviews('t-shenzhiyuan')}?limit=50`,
  });
  const target = publicReviews.json().data[2];
  assert.ok(target);

  const created = await app.inject({
    method: 'POST',
    url: ME_PATHS.reports,
    headers: { cookie: user.cookie, 'x-csrf-token': user.csrf },
    payload: {
      reviewId: target.id,
      reasonCode: 'harassment',
      note: '测试隐藏：需要立即下架的公开内容。',
    },
  });
  assert.equal(created.statusCode, 201, created.body);
  const report = created.json().data;

  const resolved = await app.inject({
    method: 'POST',
    url: ADMIN_PATHS.reportDecision(report.id),
    headers: { cookie: moderator.cookie, 'x-csrf-token': moderator.csrf },
    payload: { decision: 'hide', expectedVersion: report.version },
  });
  assert.equal(resolved.statusCode, 200, resolved.body);
  assert.equal(resolved.json().data.status, 'resolved');
  assert.equal(resolved.json().data.resolution, 'hidden');
  assert.equal(resolved.json().data.review.status, 'hidden');

  const publicReview = await app.inject({
    method: 'GET',
    url: PUBLIC_PATHS.review(target.id),
  });
  assert.equal(publicReview.statusCode, 404);

  const publicList = await app.inject({
    method: 'GET',
    url: `${PUBLIC_PATHS.teacherReviews('t-shenzhiyuan')}?limit=50`,
  });
  assert.equal(
    publicList.json().data.some((entry: { id: string }) => entry.id === target.id),
    false,
  );

  const ownReports = await app.inject({
    method: 'GET',
    url: ME_PATHS.reports,
    headers: { cookie: user.cookie },
  });
  const ownReport = ownReports
    .json()
    .data.find((entry: { id: string }) => entry.id === report.id);
  assert.equal(ownReport.status, 'resolved');
  assert.equal(ownReport.resolution, 'hidden');
  assert.equal(ownReport.review.status, 'hidden');

  const summary = await app.inject({
    method: 'GET',
    url: PUBLIC_PATHS.teacherSummary('t-shenzhiyuan'),
  });
  assert.equal(summary.json().data.state, 'generating');
});

test('authors can appeal moderated reviews and administrators can uphold the decision', async () => {
  const student = await login('demo-student', 'soclear-demo-student');
  const moderator = await login('demo-moderator', 'soclear-demo-moderator');
  const user = await login('demo-user', 'soclear-demo-user');

  const own = await app.inject({
    method: 'GET',
    url: ME_PATHS.reviews,
    headers: { cookie: student.cookie },
  });
  const rejected = own
    .json()
    .data.find((entry: { status: string }) => entry.status === 'rejected');
  assert.ok(rejected, 'expected a rejected review from the previous workflow');

  const unauthenticated = await app.inject({
    method: 'POST',
    url: ME_PATHS.appeals,
    payload: { reviewId: rejected.id, reason: '这条评价描述了实际课堂体验，希望重新核查。' },
  });
  assert.equal(unauthenticated.statusCode, 401);

  const noCsrf = await app.inject({
    method: 'POST',
    url: ME_PATHS.appeals,
    headers: { cookie: student.cookie },
    payload: { reviewId: rejected.id, reason: '这条评价描述了实际课堂体验，希望重新核查。' },
  });
  assert.equal(noCsrf.statusCode, 403);
  assert.equal(noCsrf.json().error.code, 'CSRF_FAILED');

  const tooShort = await app.inject({
    method: 'POST',
    url: ME_PATHS.appeals,
    headers: { cookie: student.cookie, 'x-csrf-token': student.csrf },
    payload: { reviewId: rejected.id, reason: '太短' },
  });
  assert.equal(tooShort.statusCode, 422);

  const notAuthor = await app.inject({
    method: 'POST',
    url: ME_PATHS.appeals,
    headers: { cookie: user.cookie, 'x-csrf-token': user.csrf },
    payload: { reviewId: rejected.id, reason: '尝试申诉一条不属于自己的评价。' },
  });
  assert.equal(notAuthor.statusCode, 404);

  const created = await app.inject({
    method: 'POST',
    url: ME_PATHS.appeals,
    headers: { cookie: student.cookie, 'x-csrf-token': student.csrf },
    payload: {
      reviewId: rejected.id,
      reason: '这条评价描述了实际课堂体验，希望重新核查驳回依据。',
    },
  });
  assert.equal(created.statusCode, 201, created.body);
  const appeal = created.json().data;
  assert.equal(appeal.status, 'pending');
  assert.equal(appeal.resolution, null);
  assert.equal(appeal.review.status, 'rejected');
  assert.equal(appeal.review.id, rejected.id);
  const appealText = JSON.stringify(appeal);
  for (const forbiddenField of ['accountId', 'appellant', 'email']) {
    assert.equal(appealText.includes(`"${forbiddenField}"`), false);
  }

  const duplicate = await app.inject({
    method: 'POST',
    url: ME_PATHS.appeals,
    headers: { cookie: student.cookie, 'x-csrf-token': student.csrf },
    payload: { reviewId: rejected.id, reason: '重复提交同一份申诉应当被拒绝。' },
  });
  assert.equal(duplicate.statusCode, 409);
  assert.equal(duplicate.json().error.code, 'APPEAL_ALREADY_EXISTS');

  const forbiddenQueue = await app.inject({
    method: 'GET',
    url: ADMIN_PATHS.appeals,
    headers: { cookie: user.cookie },
  });
  assert.equal(forbiddenQueue.statusCode, 403);

  const queue = await app.inject({
    method: 'GET',
    url: ADMIN_PATHS.appeals,
    headers: { cookie: moderator.cookie },
  });
  assert.equal(queue.statusCode, 200);
  const queueText = JSON.stringify(queue.json().data);
  for (const forbiddenField of ['accountId', 'appellant', 'appellant_account_id', 'email']) {
    assert.equal(queueText.includes(`"${forbiddenField}"`), false);
  }

  const noCsrfDecision = await app.inject({
    method: 'POST',
    url: ADMIN_PATHS.appealDecision(appeal.id),
    headers: { cookie: moderator.cookie },
    payload: { decision: 'uphold', expectedVersion: appeal.version },
  });
  assert.equal(noCsrfDecision.statusCode, 403);

  const upheld = await app.inject({
    method: 'POST',
    url: ADMIN_PATHS.appealDecision(appeal.id),
    headers: { cookie: moderator.cookie, 'x-csrf-token': moderator.csrf },
    payload: {
      decision: 'uphold',
      note: '复核后确认原驳回原因成立。',
      expectedVersion: appeal.version,
    },
  });
  assert.equal(upheld.statusCode, 200, upheld.body);
  assert.equal(upheld.json().data.status, 'rejected');
  assert.equal(upheld.json().data.resolution, 'upheld');
  assert.equal(upheld.json().data.decisionNote, '复核后确认原驳回原因成立。');
  assert.equal(upheld.json().data.review.status, 'rejected');

  const publicReview = await app.inject({
    method: 'GET',
    url: PUBLIC_PATHS.review(rejected.id),
  });
  assert.equal(publicReview.statusCode, 404);

  const repeated = await app.inject({
    method: 'POST',
    url: ADMIN_PATHS.appealDecision(appeal.id),
    headers: { cookie: moderator.cookie, 'x-csrf-token': moderator.csrf },
    payload: { decision: 'uphold', expectedVersion: appeal.version + 1 },
  });
  assert.equal(repeated.statusCode, 409);
  assert.equal(repeated.json().error.code, 'APPEAL_NOT_ACTIONABLE');

  const ownAppeals = await app.inject({
    method: 'GET',
    url: ME_PATHS.appeals,
    headers: { cookie: student.cookie },
  });
  assert.equal(ownAppeals.statusCode, 200);
  const ownAppeal = ownAppeals
    .json()
    .data.find((entry: { id: string }) => entry.id === appeal.id);
  assert.equal(ownAppeal.status, 'rejected');
  assert.equal(ownAppeal.resolution, 'upheld');

  const afterResolution = await app.inject({
    method: 'POST',
    url: ME_PATHS.appeals,
    headers: { cookie: student.cookie, 'x-csrf-token': student.csrf },
    payload: { reviewId: rejected.id, reason: '原判维持后再次提交申诉应当被拒绝。' },
  });
  assert.equal(afterResolution.statusCode, 409);
  assert.equal(afterResolution.json().error.code, 'APPEAL_ALREADY_EXISTS');
});

test('restoring an appeal republishes a rejected review and refreshes the summary', async () => {
  const student = await login('demo-student', 'soclear-demo-student');
  const moderator = await login('demo-moderator', 'soclear-demo-moderator');
  const studentHeaders = { cookie: student.cookie, 'x-csrf-token': student.csrf };
  const moderatorHeaders = { cookie: moderator.cookie, 'x-csrf-token': moderator.csrf };

  const created = await app.inject({
    method: 'POST',
    url: ME_PATHS.reviews,
    headers: studentHeaders,
    payload: {
      ...reviewPayload,
      teacherId: 't-guqinghe',
      courseId: 'c-prog',
      comment: '申诉恢复测试：课程项目要求与反馈节奏说明得比较具体。',
    },
  });
  assert.equal(created.statusCode, 201, created.body);
  const pending = created.json().data;

  const rejected = await app.inject({
    method: 'POST',
    url: ADMIN_PATHS.reviewDecision(pending.id),
    headers: moderatorHeaders,
    payload: {
      decision: 'reject',
      reasonCode: 'other',
      expectedVersion: pending.version,
    },
  });
  assert.equal(rejected.statusCode, 200, rejected.body);
  assert.equal(rejected.json().data.status, 'rejected');

  const appealCreated = await app.inject({
    method: 'POST',
    url: ME_PATHS.appeals,
    headers: studentHeaders,
    payload: {
      reviewId: pending.id,
      reason: '该评价包含具体课程项目与反馈节奏，申请重新核查。',
    },
  });
  assert.equal(appealCreated.statusCode, 201, appealCreated.body);
  const appeal = appealCreated.json().data;

  const restored = await app.inject({
    method: 'POST',
    url: ADMIN_PATHS.appealDecision(appeal.id),
    headers: moderatorHeaders,
    payload: {
      decision: 'restore',
      note: '复核后确认评价包含可核验的课堂细节。',
      expectedVersion: appeal.version,
    },
  });
  assert.equal(restored.statusCode, 200, restored.body);
  assert.equal(restored.json().data.status, 'accepted');
  assert.equal(restored.json().data.resolution, 'restored');
  assert.equal(restored.json().data.review.status, 'published');
  assert.ok(restored.json().data.review.publishedAt);

  const own = await app.inject({
    method: 'GET',
    url: ME_PATHS.reviews,
    headers: { cookie: student.cookie },
  });
  const restoredOwn = own.json().data.find((entry: { id: string }) => entry.id === pending.id);
  assert.equal(restoredOwn.status, 'published');
  assert.ok(restoredOwn.publishedAt);

  const publicReview = await app.inject({
    method: 'GET',
    url: PUBLIC_PATHS.review(pending.id),
  });
  assert.equal(publicReview.statusCode, 200);

  const publicList = await app.inject({
    method: 'GET',
    url: `${PUBLIC_PATHS.teacherReviews('t-guqinghe')}?limit=50`,
  });
  assert.ok(publicList.json().data.some((entry: { id: string }) => entry.id === pending.id));

  const summary = await app.inject({
    method: 'GET',
    url: PUBLIC_PATHS.teacherSummary('t-guqinghe'),
  });
  assert.equal(summary.json().data.state, 'generating');
});

test('a hidden review can be restored through a successful appeal', async () => {
  const student = await login('demo-student', 'soclear-demo-student');
  const moderator = await login('demo-moderator', 'soclear-demo-moderator');
  const user = await login('demo-user', 'soclear-demo-user');
  const studentHeaders = { cookie: student.cookie, 'x-csrf-token': student.csrf };
  const moderatorHeaders = { cookie: moderator.cookie, 'x-csrf-token': moderator.csrf };

  const created = await app.inject({
    method: 'POST',
    url: ME_PATHS.reviews,
    headers: studentHeaders,
    payload: {
      ...reviewPayload,
      termId: 't-2025-2',
      comment: '隐藏申诉测试：评价只描述课程安排与实际作业反馈。',
    },
  });
  assert.equal(created.statusCode, 201, created.body);
  const pending = created.json().data;

  const approved = await app.inject({
    method: 'POST',
    url: ADMIN_PATHS.reviewDecision(pending.id),
    headers: moderatorHeaders,
    payload: { decision: 'approve', expectedVersion: pending.version },
  });
  assert.equal(approved.statusCode, 200, approved.body);

  const reportCreated = await app.inject({
    method: 'POST',
    url: ME_PATHS.reports,
    headers: { cookie: user.cookie, 'x-csrf-token': user.csrf },
    payload: {
      reviewId: pending.id,
      reasonCode: 'other',
      note: '隐藏申诉测试举报。',
    },
  });
  assert.equal(reportCreated.statusCode, 201, reportCreated.body);
  const report = reportCreated.json().data;

  const hidden = await app.inject({
    method: 'POST',
    url: ADMIN_PATHS.reportDecision(report.id),
    headers: moderatorHeaders,
    payload: { decision: 'hide', expectedVersion: report.version },
  });
  assert.equal(hidden.statusCode, 200, hidden.body);
  assert.equal(hidden.json().data.review.status, 'hidden');

  const appealCreated = await app.inject({
    method: 'POST',
    url: ME_PATHS.appeals,
    headers: studentHeaders,
    payload: {
      reviewId: pending.id,
      reason: '评价仅描述课程安排与作业反馈，申请重新核查隐藏依据。',
    },
  });
  assert.equal(appealCreated.statusCode, 201, appealCreated.body);
  const appeal = appealCreated.json().data;
  assert.equal(appeal.review.status, 'hidden');

  const restored = await app.inject({
    method: 'POST',
    url: ADMIN_PATHS.appealDecision(appeal.id),
    headers: moderatorHeaders,
    payload: {
      decision: 'restore',
      note: '复核后未发现需要隐藏的内容，恢复公开。',
      expectedVersion: appeal.version,
    },
  });
  assert.equal(restored.statusCode, 200, restored.body);
  assert.equal(restored.json().data.status, 'accepted');
  assert.equal(restored.json().data.resolution, 'restored');
  assert.equal(restored.json().data.review.status, 'published');

  const publicReview = await app.inject({
    method: 'GET',
    url: PUBLIC_PATHS.review(pending.id),
  });
  assert.equal(publicReview.statusCode, 200);

  const ownReports = await app.inject({
    method: 'GET',
    url: ME_PATHS.reports,
    headers: { cookie: user.cookie },
  });
  const historicalReport = ownReports
    .json()
    .data.find((entry: { id: string }) => entry.id === report.id);
  assert.equal(historicalReport.status, 'resolved');
  assert.equal(historicalReport.resolution, 'hidden');
});

test('hidden reviews can be revised after appeal resolution and re-moderated', async () => {
  const student = await login('demo-student', 'soclear-demo-student');
  const moderator = await login('demo-moderator', 'soclear-demo-moderator');
  const user = await login('demo-user', 'soclear-demo-user');
  const studentHeaders = { cookie: student.cookie, 'x-csrf-token': student.csrf };
  const moderatorHeaders = { cookie: moderator.cookie, 'x-csrf-token': moderator.csrf };

  const created = await app.inject({
    method: 'POST',
    url: ME_PATHS.reviews,
    headers: studentHeaders,
    payload: {
      ...reviewPayload,
      termId: 't-2025-1',
      scores: { clarity: 3, organization: 3, feedback: 3, assessmentTransparency: 3 },
      comment: '隐藏修订测试：初稿描述课堂安排。',
    },
  });
  assert.equal(created.statusCode, 201, created.body);
  const review = created.json().data;

  const approved = await app.inject({
    method: 'POST',
    url: ADMIN_PATHS.reviewDecision(review.id),
    headers: moderatorHeaders,
    payload: { decision: 'approve', expectedVersion: review.version },
  });
  assert.equal(approved.statusCode, 200, approved.body);

  const reportCreated = await app.inject({
    method: 'POST',
    url: ME_PATHS.reports,
    headers: { cookie: user.cookie, 'x-csrf-token': user.csrf },
    payload: {
      reviewId: review.id,
      reasonCode: 'other',
      note: '隐藏修订测试举报。',
    },
  });
  assert.equal(reportCreated.statusCode, 201, reportCreated.body);
  const report = reportCreated.json().data;

  const hidden = await app.inject({
    method: 'POST',
    url: ADMIN_PATHS.reportDecision(report.id),
    headers: moderatorHeaders,
    payload: { decision: 'hide', expectedVersion: report.version },
  });
  assert.equal(hidden.statusCode, 200, hidden.body);
  assert.equal(hidden.json().data.review.status, 'hidden');

  const appealCreated = await app.inject({
    method: 'POST',
    url: ME_PATHS.appeals,
    headers: studentHeaders,
    payload: {
      reviewId: review.id,
      reason: '评价只描述课堂安排，申请复核隐藏依据并保留修订机会。',
    },
  });
  assert.equal(appealCreated.statusCode, 201, appealCreated.body);
  const appeal = appealCreated.json().data;

  const blocked = await app.inject({
    method: 'PATCH',
    url: ME_PATHS.reviewUpdate(review.id),
    headers: studentHeaders,
    payload: {
      expectedVersion: hidden.json().data.review.version,
      scores: { clarity: 4, organization: 4, feedback: 4, assessmentTransparency: 4 },
    },
  });
  assert.equal(blocked.statusCode, 409);
  assert.equal(blocked.json().error.code, 'REVIEW_NOT_EDITABLE');

  const upheld = await app.inject({
    method: 'POST',
    url: ADMIN_PATHS.appealDecision(appeal.id),
    headers: moderatorHeaders,
    payload: {
      decision: 'uphold',
      note: '隐藏依据保留，但作者可以提交修订后重新审核。',
      expectedVersion: appeal.version,
    },
  });
  assert.equal(upheld.statusCode, 200, upheld.body);
  assert.equal(upheld.json().data.review.status, 'hidden');

  const edited = await app.inject({
    method: 'PATCH',
    url: ME_PATHS.reviewUpdate(review.id),
    headers: studentHeaders,
    payload: {
      expectedVersion: hidden.json().data.review.version,
      scores: { clarity: 5, organization: 4, feedback: 4, assessmentTransparency: 5 },
      comment: '隐藏修订测试：补充课堂互动与作业反馈的具体说明。',
    },
  });
  assert.equal(edited.statusCode, 200, edited.body);
  const revised = edited.json().data;
  assert.equal(revised.status, 'pending');
  assert.equal(revised.revision, 2);
  assert.equal(revised.version, hidden.json().data.review.version + 1);
  assert.equal(revised.actions.canEdit, true);
  assert.equal(revised.publishedAt, null);

  const stillHiddenPublicly = await app.inject({
    method: 'GET',
    url: PUBLIC_PATHS.review(review.id),
  });
  assert.equal(stillHiddenPublicly.statusCode, 404);

  const audit = await app.inject({
    method: 'GET',
    url: ADMIN_PATHS.reviewAudit(review.id),
    headers: { cookie: moderator.cookie },
  });
  const events = audit.json().data;
  assert.deepEqual(
    events.map((event: { action: string }) => event.action),
    ['submit', 'approve', 'hide', 'appeal_uphold', 'resubmit'],
  );
  const resubmitEvent = events[4];
  assert.equal(resubmitEvent.actor, 'author');
  assert.equal(resubmitEvent.fromStatus, 'hidden');
  assert.equal(resubmitEvent.toStatus, 'pending');
  assert.equal(resubmitEvent.revision, 2);

  const finalApproval = await app.inject({
    method: 'POST',
    url: ADMIN_PATHS.reviewDecision(review.id),
    headers: moderatorHeaders,
    payload: { decision: 'approve', expectedVersion: revised.version },
  });
  assert.equal(finalApproval.statusCode, 200, finalApproval.body);

  const publicReview = await app.inject({
    method: 'GET',
    url: PUBLIC_PATHS.review(review.id),
  });
  assert.equal(publicReview.statusCode, 200);
  assert.equal(
    publicReview.json().data.comment,
    '隐藏修订测试：补充课堂互动与作业反馈的具体说明。',
  );
  assert.equal(publicReview.json().data.scores.clarity, 5);
});

test('administrators can read a privacy-safe governance audit timeline', async () => {
  const student = await login('demo-student', 'soclear-demo-student');
  const moderator = await login('demo-moderator', 'soclear-demo-moderator');
  const user = await login('demo-user', 'soclear-demo-user');

  const own = await app.inject({
    method: 'GET',
    url: ME_PATHS.reviews,
    headers: { cookie: student.cookie },
  });
  const rejected = own
    .json()
    .data.find((entry: { comment: string | null }) =>
      entry.comment?.includes('缺少具体细节的评价'),
    );
  const restored = own
    .json()
    .data.find((entry: { comment: string | null }) =>
      entry.comment?.includes('申诉恢复测试'),
    );
  assert.ok(rejected);
  assert.ok(restored);

  const unauthenticated = await app.inject({
    method: 'GET',
    url: ADMIN_PATHS.reviewAudit(rejected.id),
  });
  assert.equal(unauthenticated.statusCode, 401);

  const forbidden = await app.inject({
    method: 'GET',
    url: ADMIN_PATHS.reviewAudit(rejected.id),
    headers: { cookie: student.cookie },
  });
  assert.equal(forbidden.statusCode, 403);

  const missing = await app.inject({
    method: 'GET',
    url: ADMIN_PATHS.reviewAudit('rv-does-not-exist'),
    headers: { cookie: moderator.cookie },
  });
  assert.equal(missing.statusCode, 404);

  const rejectedAudit = await app.inject({
    method: 'GET',
    url: ADMIN_PATHS.reviewAudit(rejected.id),
    headers: { cookie: moderator.cookie },
  });
  assert.equal(rejectedAudit.statusCode, 200);
  const rejectedEvents = rejectedAudit.json().data;
  assert.deepEqual(
    rejectedEvents.map((event: { action: string }) => event.action),
    ['submit', 'reject', 'appeal_uphold'],
  );
  assert.equal(rejectedEvents[0].actor, 'author');
  assert.equal(rejectedEvents[0].fromStatus, null);
  assert.equal(rejectedEvents[0].toStatus, 'pending');
  assert.equal(rejectedEvents[1].actor, 'moderator');
  assert.equal(rejectedEvents[1].reasonCode, 'insufficient_detail');
  assert.equal(rejectedEvents[2].fromStatus, 'rejected');
  assert.equal(rejectedEvents[2].toStatus, 'rejected');
  assert.equal(typeof rejectedEvents[0].id, 'number');
  assert.equal(typeof rejectedEvents[0].createdAt, 'string');
  const auditText = JSON.stringify([...rejectedEvents]);
  for (const forbiddenField of [
    'accountId',
    'displayName',
    'email',
    'actor_account_id',
    'reporter',
  ]) {
    assert.equal(auditText.includes(`"${forbiddenField}"`), false);
  }

  const restoredAudit = await app.inject({
    method: 'GET',
    url: ADMIN_PATHS.reviewAudit(restored.id),
    headers: { cookie: moderator.cookie },
  });
  assert.equal(restoredAudit.statusCode, 200);
  const restoredEvents = restoredAudit.json().data;
  assert.deepEqual(
    restoredEvents.map((event: { action: string }) => event.action),
    ['submit', 'reject', 'appeal_restore'],
  );
  assert.equal(restoredEvents[2].fromStatus, 'rejected');
  assert.equal(restoredEvents[2].toStatus, 'published');

  const publicReviews = await app.inject({
    method: 'GET',
    url: `${PUBLIC_PATHS.teacherReviews('t-shenzhiyuan')}?limit=50`,
  });
  const existingUserReports = await app.inject({
    method: 'GET',
    url: ME_PATHS.reports,
    headers: { cookie: user.cookie },
  });
  const reportedReviewIds = new Set(
    existingUserReports
      .json()
      .data.map((entry: { review: { id: string } }) => entry.review.id),
  );
  const reportTarget = publicReviews
    .json()
    .data.find((entry: { id: string }) => !reportedReviewIds.has(entry.id));
  assert.ok(reportTarget);

  const reportCreated = await app.inject({
    method: 'POST',
    url: ME_PATHS.reports,
    headers: { cookie: user.cookie, 'x-csrf-token': user.csrf },
    payload: {
      reviewId: reportTarget.id,
      reasonCode: 'spam',
      note: '审计时间线测试：驳回后应留下治理记录。',
    },
  });
  assert.equal(reportCreated.statusCode, 201, reportCreated.body);
  const report = reportCreated.json().data;

  const dismissed = await app.inject({
    method: 'POST',
    url: ADMIN_PATHS.reportDecision(report.id),
    headers: { cookie: moderator.cookie, 'x-csrf-token': moderator.csrf },
    payload: { decision: 'dismiss', expectedVersion: report.version },
  });
  assert.equal(dismissed.statusCode, 200, dismissed.body);

  const reportAudit = await app.inject({
    method: 'GET',
    url: ADMIN_PATHS.reviewAudit(reportTarget.id),
    headers: { cookie: moderator.cookie },
  });
  assert.equal(reportAudit.statusCode, 200);
  const reportEvents = reportAudit.json().data;
  const lastEvent = reportEvents[reportEvents.length - 1];
  assert.equal(lastEvent.action, 'report_dismiss');
  assert.equal(lastEvent.actor, 'moderator');
  assert.equal(lastEvent.fromStatus, 'published');
  assert.equal(lastEvent.toStatus, 'published');
});

test('administrator queues expose stable offset pagination', async () => {
  const moderator = await login('demo-moderator', 'soclear-demo-moderator');
  const user = await login('demo-user', 'soclear-demo-user');
  const moderatorHeaders = { cookie: moderator.cookie };

  const invalidOffset = await app.inject({
    method: 'GET',
    url: `${ADMIN_PATHS.reviews}?status=published&limit=2&offset=-1`,
    headers: moderatorHeaders,
  });
  assert.equal(invalidOffset.statusCode, 422);

  const firstPage = await app.inject({
    method: 'GET',
    url: `${ADMIN_PATHS.reviews}?status=published&limit=2&offset=0`,
    headers: moderatorHeaders,
  });
  assert.equal(firstPage.statusCode, 200);
  const firstItems = firstPage.json().data;
  const firstMeta = firstPage.json().meta.page;
  assert.equal(firstItems.length, 2);
  assert.ok(firstMeta.total > 2);
  assert.equal(firstMeta.hasMore, true);

  const secondPage = await app.inject({
    method: 'GET',
    url: `${ADMIN_PATHS.reviews}?status=published&limit=2&offset=2`,
    headers: moderatorHeaders,
  });
  assert.equal(secondPage.statusCode, 200);
  const secondItems = secondPage.json().data;
  assert.equal(secondItems.length, 2);
  assert.equal(
    firstItems.some((entry: { id: string }) =>
      secondItems.some((next: { id: string }) => next.id === entry.id),
    ),
    false,
  );

  const lastPage = await app.inject({
    method: 'GET',
    url: `${ADMIN_PATHS.reviews}?status=published&limit=2&offset=${firstMeta.total - 1}`,
    headers: moderatorHeaders,
  });
  assert.equal(lastPage.statusCode, 200);
  assert.equal(lastPage.json().data.length, 1);
  assert.equal(lastPage.json().meta.page.hasMore, false);

  const publicReviews = await app.inject({
    method: 'GET',
    url: `${PUBLIC_PATHS.teacherReviews('t-shenzhiyuan')}?limit=50`,
  });
  const existingReports = await app.inject({
    method: 'GET',
    url: ME_PATHS.reports,
    headers: { cookie: user.cookie },
  });
  const reportedReviewIds = new Set(
    existingReports
      .json()
      .data.map((entry: { review: { id: string } }) => entry.review.id),
  );
  const reportTargets = publicReviews
    .json()
    .data.filter((entry: { id: string }) => !reportedReviewIds.has(entry.id))
    .slice(0, 2);
  assert.equal(reportTargets.length, 2);
  for (const [index, target] of reportTargets.entries()) {
    const report = await app.inject({
      method: 'POST',
      url: ME_PATHS.reports,
      headers: { cookie: user.cookie, 'x-csrf-token': user.csrf },
      payload: {
        reviewId: target.id,
        reasonCode: 'other',
        note: `分页测试举报 ${index}。`,
      },
    });
    assert.equal(report.statusCode, 201, report.body);
  }

  const reportsFirst = await app.inject({
    method: 'GET',
    url: `${ADMIN_PATHS.reports}?status=pending&limit=1&offset=0`,
    headers: moderatorHeaders,
  });
  assert.equal(reportsFirst.statusCode, 200);
  assert.equal(reportsFirst.json().data.length, 1);
  assert.ok(reportsFirst.json().meta.page.total >= 3);
  assert.equal(reportsFirst.json().meta.page.hasMore, true);

  const reportsSecond = await app.inject({
    method: 'GET',
    url: `${ADMIN_PATHS.reports}?status=pending&limit=1&offset=1`,
    headers: moderatorHeaders,
  });
  assert.equal(reportsSecond.statusCode, 200);
  assert.equal(reportsSecond.json().data.length, 1);
  assert.notEqual(
    reportsSecond.json().data[0].id,
    reportsFirst.json().data[0].id,
  );

  const reportsEnd = await app.inject({
    method: 'GET',
    url: `${ADMIN_PATHS.reports}?status=pending&limit=10&offset=${reportsFirst.json().meta.page.total}`,
    headers: moderatorHeaders,
  });
  assert.equal(reportsEnd.statusCode, 200);
  assert.equal(reportsEnd.json().data.length, 0);
  assert.equal(reportsEnd.json().meta.page.hasMore, false);

  const appealsFirst = await app.inject({
    method: 'GET',
    url: `${ADMIN_PATHS.appeals}?status=accepted&limit=1&offset=0`,
    headers: moderatorHeaders,
  });
  assert.equal(appealsFirst.statusCode, 200);
  assert.equal(appealsFirst.json().data.length, 1);
  assert.equal(appealsFirst.json().meta.page.total, 2);
  assert.equal(appealsFirst.json().meta.page.hasMore, true);

  const appealsSecond = await app.inject({
    method: 'GET',
    url: `${ADMIN_PATHS.appeals}?status=accepted&limit=1&offset=1`,
    headers: moderatorHeaders,
  });
  assert.equal(appealsSecond.statusCode, 200);
  assert.equal(appealsSecond.json().data.length, 1);
  assert.equal(appealsSecond.json().meta.page.hasMore, false);
  assert.notEqual(
    appealsSecond.json().data[0].id,
    appealsFirst.json().data[0].id,
  );
});

test('administrators can regenerate a local summary with current source citations', async () => {
  const student = await login('demo-student', 'soclear-demo-student');
  const moderator = await login('demo-moderator', 'soclear-demo-moderator');
  const moderatorHeaders = { cookie: moderator.cookie, 'x-csrf-token': moderator.csrf };

  const unauthenticated = await app.inject({
    method: 'GET',
    url: ADMIN_PATHS.teacherSummaries,
  });
  assert.equal(unauthenticated.statusCode, 401);

  const forbidden = await app.inject({
    method: 'GET',
    url: ADMIN_PATHS.teacherSummaries,
    headers: { cookie: student.cookie },
  });
  assert.equal(forbidden.statusCode, 403);

  const invalidFilter = await app.inject({
    method: 'GET',
    url: `${ADMIN_PATHS.teacherSummaries}?filter=unknown`,
    headers: { cookie: moderator.cookie },
  });
  assert.equal(invalidFilter.statusCode, 422);

  const all = await app.inject({
    method: 'GET',
    url: `${ADMIN_PATHS.teacherSummaries}?filter=all&limit=50`,
    headers: { cookie: moderator.cookie },
  });
  assert.equal(all.statusCode, 200, all.body);
  const summaries = all.json().data;
  const target = summaries.find(
    (entry: { teacher: { id: string } }) => entry.teacher.id === 't-liangguanlan',
  );
  assert.ok(target);
  assert.equal(target.state, 'generating');
  assert.equal(target.sampleCount, 5);
  assert.equal(target.canRegenerate, true);
  assert.equal(target.localDemo, true);
  assert.equal(typeof target.teacher.name, 'string');
  assert.equal(typeof target.teacher.departmentName, 'string');

  const insufficient = await app.inject({
    method: 'GET',
    url: `${ADMIN_PATHS.teacherSummaries}?filter=insufficient&limit=50`,
    headers: { cookie: moderator.cookie },
  });
  assert.equal(insufficient.statusCode, 200);
  const insufficientItems = insufficient.json().data;
  assert.ok(insufficientItems.length > 0);
  assert.equal(
    insufficientItems.every(
      (entry: { state: string; sampleCount: number }) =>
        entry.state === 'insufficient' && entry.sampleCount < 5,
    ),
    true,
  );

  const unavailable = await app.inject({
    method: 'GET',
    url: `${ADMIN_PATHS.teacherSummaries}?filter=unavailable&limit=50`,
    headers: { cookie: moderator.cookie },
  });
  assert.equal(unavailable.statusCode, 200);
  const unavailableTarget = unavailable
    .json()
    .data.find(
      (entry: { teacher: { id: string } }) => entry.teacher.id === 't-zhouyan',
    );
  assert.ok(unavailableTarget);
  assert.equal(unavailableTarget.state, 'unavailable');
  assert.equal(unavailableTarget.canRegenerate, true);

  const noCsrf = await app.inject({
    method: 'POST',
    url: ADMIN_PATHS.summaryRegenerate('t-liangguanlan'),
    headers: { cookie: moderator.cookie },
    payload: { expectedEpoch: target.teacherSummaryEpoch },
  });
  assert.equal(noCsrf.statusCode, 403);
  assert.equal(noCsrf.json().error.code, 'CSRF_FAILED');

  const stale = await app.inject({
    method: 'POST',
    url: ADMIN_PATHS.summaryRegenerate('t-liangguanlan'),
    headers: moderatorHeaders,
    payload: { expectedEpoch: target.teacherSummaryEpoch + 99 },
  });
  assert.equal(stale.statusCode, 409);
  assert.equal(stale.json().error.code, 'SUMMARY_NOT_ACTIONABLE');

  const tooFewSamples = await app.inject({
    method: 'POST',
    url: ADMIN_PATHS.summaryRegenerate('t-shenyanqiu'),
    headers: moderatorHeaders,
    payload: { expectedEpoch: 0 },
  });
  assert.equal(tooFewSamples.statusCode, 409);
  assert.equal(tooFewSamples.json().error.code, 'SUMMARY_NOT_ACTIONABLE');

  const missing = await app.inject({
    method: 'POST',
    url: ADMIN_PATHS.summaryRegenerate('t-does-not-exist'),
    headers: moderatorHeaders,
    payload: { expectedEpoch: 0 },
  });
  assert.equal(missing.statusCode, 404);

  const regenerated = await app.inject({
    method: 'POST',
    url: ADMIN_PATHS.summaryRegenerate('t-liangguanlan'),
    headers: moderatorHeaders,
    payload: { expectedEpoch: target.teacherSummaryEpoch },
  });
  assert.equal(regenerated.statusCode, 200, regenerated.body);
  const summary = regenerated.json().data;
  assert.equal(summary.state, 'ready');
  assert.equal(summary.sampleCount, 5);
  assert.equal(summary.teacher.id, 't-liangguanlan');
  assert.equal(summary.teacherSummaryEpoch, target.teacherSummaryEpoch + 1);
  assert.ok(summary.sentenceCount >= 2);
  assert.equal(typeof summary.generatedAt, 'string');
  assert.equal(summary.canRegenerate, true);
  assert.equal(summary.localDemo, true);

  const publicSummary = await app.inject({
    method: 'GET',
    url: PUBLIC_PATHS.teacherSummary('t-liangguanlan'),
  });
  assert.equal(publicSummary.statusCode, 200);
  const publicData = publicSummary.json().data;
  assert.equal(publicData.state, 'ready');
  assert.equal(publicData.sampleCount, 5);
  assert.equal(publicData.sentences.length, summary.sentenceCount);
  assert.equal(publicData.teacherSummaryEpoch, summary.teacherSummaryEpoch);
  assert.equal(publicData.limitations.includes('本地确定性规则'), true);
  assert.equal(publicData.limitations.includes('不是平台 AI 生成'), true);

  const publicReviews = await app.inject({
    method: 'GET',
    url: `${PUBLIC_PATHS.teacherReviews('t-liangguanlan')}?limit=50`,
  });
  const reviewIds = new Set(
    publicReviews.json().data.map((entry: { id: string }) => entry.id),
  );
  for (const sentence of publicData.sentences) {
    assert.ok(sentence.text.length > 0);
    assert.ok(sentence.citations.length > 0);
    for (const citation of sentence.citations) {
      assert.equal(reviewIds.has(citation), true);
    }
  }

  const staleRetry = await app.inject({
    method: 'POST',
    url: ADMIN_PATHS.summaryRegenerate('t-liangguanlan'),
    headers: moderatorHeaders,
    payload: { expectedEpoch: target.teacherSummaryEpoch },
  });
  assert.equal(staleRetry.statusCode, 409);
  assert.equal(staleRetry.json().error.code, 'SUMMARY_NOT_ACTIONABLE');

  const stillReady = await app.inject({
    method: 'GET',
    url: PUBLIC_PATHS.teacherSummary('t-liangguanlan'),
  });
  assert.equal(stillReady.json().data.state, 'ready');
  assert.equal(
    stillReady.json().data.teacherSummaryEpoch,
    summary.teacherSummaryEpoch,
  );
});

test('administrators can read an aggregate overview without account identities', async () => {
  const student = await login('demo-student', 'soclear-demo-student');
  const moderator = await login('demo-moderator', 'soclear-demo-moderator');
  const user = await login('demo-user', 'soclear-demo-user');

  const unauthenticated = await app.inject({
    method: 'GET',
    url: ADMIN_PATHS.overview,
  });
  assert.equal(unauthenticated.statusCode, 401);

  const forbidden = await app.inject({
    method: 'GET',
    url: ADMIN_PATHS.overview,
    headers: { cookie: student.cookie },
  });
  assert.equal(forbidden.statusCode, 403);

  const publicReviews = await app.inject({
    method: 'GET',
    url: `${PUBLIC_PATHS.teacherReviews('t-shenzhiyuan')}?limit=50`,
  });
  const existingUserReports = await app.inject({
    method: 'GET',
    url: ME_PATHS.reports,
    headers: { cookie: user.cookie },
  });
  const reportedReviewIds = new Set(
    existingUserReports
      .json()
      .data.map((entry: { review: { id: string } }) => entry.review.id),
  );
  const reportTarget = publicReviews
    .json()
    .data.find((entry: { id: string }) => !reportedReviewIds.has(entry.id));
  assert.ok(reportTarget);

  const reportCreated = await app.inject({
    method: 'POST',
    url: ME_PATHS.reports,
    headers: { cookie: user.cookie, 'x-csrf-token': user.csrf },
    payload: {
      reviewId: reportTarget.id,
      reasonCode: 'spam',
      note: '总览最近动作测试：需要一条新的举报处理记录。',
    },
  });
  assert.equal(reportCreated.statusCode, 201, reportCreated.body);
  const report = reportCreated.json().data;
  const dismissed = await app.inject({
    method: 'POST',
    url: ADMIN_PATHS.reportDecision(report.id),
    headers: { cookie: moderator.cookie, 'x-csrf-token': moderator.csrf },
    payload: { decision: 'dismiss', expectedVersion: report.version },
  });
  assert.equal(dismissed.statusCode, 200, dismissed.body);

  const response = await app.inject({
    method: 'GET',
    url: ADMIN_PATHS.overview,
    headers: { cookie: moderator.cookie },
  });
  assert.equal(response.statusCode, 200, response.body);
  const overview = response.json().data;
  for (const status of ['pending', 'published', 'rejected', 'hidden', 'withdrawn']) {
    assert.equal(typeof overview.queues.reviews[status], 'number');
  }
  for (const status of ['pending', 'resolved', 'dismissed']) {
    assert.equal(typeof overview.queues.reports[status], 'number');
  }
  for (const status of ['pending', 'accepted', 'rejected']) {
    assert.equal(typeof overview.queues.appeals[status], 'number');
  }
  for (const state of ['ready', 'generating', 'insufficient', 'unavailable']) {
    assert.equal(typeof overview.queues.summaries[state], 'number');
  }

  const pendingReviews = await app.inject({
    method: 'GET',
    url: `${ADMIN_PATHS.reviews}?status=pending&limit=1`,
    headers: { cookie: moderator.cookie },
  });
  const pendingReports = await app.inject({
    method: 'GET',
    url: `${ADMIN_PATHS.reports}?status=pending&limit=1`,
    headers: { cookie: moderator.cookie },
  });
  const pendingAppeals = await app.inject({
    method: 'GET',
    url: `${ADMIN_PATHS.appeals}?status=pending&limit=1`,
    headers: { cookie: moderator.cookie },
  });
  const generatingSummaries = await app.inject({
    method: 'GET',
    url: `${ADMIN_PATHS.teacherSummaries}?filter=generating&limit=1`,
    headers: { cookie: moderator.cookie },
  });
  assert.equal(
    overview.queues.reviews.pending,
    pendingReviews.json().meta.page.total,
  );
  assert.equal(
    overview.queues.reports.pending,
    pendingReports.json().meta.page.total,
  );
  assert.equal(
    overview.queues.appeals.pending,
    pendingAppeals.json().meta.page.total,
  );
  assert.equal(
    overview.queues.summaries.generating,
    generatingSummaries.json().meta.page.total,
  );

  assert.ok(Array.isArray(overview.recentActions));
  assert.ok(overview.recentActions.length > 0);
  assert.ok(overview.recentActions.length <= 10);
  assert.ok(
    overview.recentActions.some((event: { action: string }) => event.action === 'report_dismiss'),
  );
  for (const event of overview.recentActions) {
    assert.equal(typeof event.teacher.name, 'string');
    assert.equal(typeof event.course.name, 'string');
    assert.equal(typeof event.reviewId, 'string');
    assert.equal(typeof event.createdAt, 'string');
    assert.ok(['author', 'moderator'].includes(event.actor));
  }
  const auditText = JSON.stringify(overview.recentActions);
  for (const forbiddenField of [
    'accountId',
    'displayName',
    'email',
    'actor_account_id',
    'reporter',
    'appellant',
  ]) {
    assert.equal(auditText.includes(`"${forbiddenField}"`), false);
  }
});

test('administrators can browse filtered governance history with stable pagination', async () => {
  const student = await login('demo-student', 'soclear-demo-student');
  const moderator = await login('demo-moderator', 'soclear-demo-moderator');
  const moderatorHeaders = { cookie: moderator.cookie };

  const unauthenticated = await app.inject({
    method: 'GET',
    url: ADMIN_PATHS.audit,
  });
  assert.equal(unauthenticated.statusCode, 401);

  const forbidden = await app.inject({
    method: 'GET',
    url: ADMIN_PATHS.audit,
    headers: { cookie: student.cookie },
  });
  assert.equal(forbidden.statusCode, 403);

  const invalidAction = await app.inject({
    method: 'GET',
    url: `${ADMIN_PATHS.audit}?action=unknown`,
    headers: moderatorHeaders,
  });
  assert.equal(invalidAction.statusCode, 422);

  const invalidActor = await app.inject({
    method: 'GET',
    url: `${ADMIN_PATHS.audit}?actor=system`,
    headers: moderatorHeaders,
  });
  assert.equal(invalidActor.statusCode, 422);

  const firstPage = await app.inject({
    method: 'GET',
    url: `${ADMIN_PATHS.audit}?limit=3&offset=0`,
    headers: moderatorHeaders,
  });
  assert.equal(firstPage.statusCode, 200, firstPage.body);
  const firstItems = firstPage.json().data;
  const firstMeta = firstPage.json().meta.page;
  assert.equal(firstItems.length, 3);
  assert.ok(firstMeta.total > 3);
  assert.equal(firstMeta.hasMore, true);

  const secondPage = await app.inject({
    method: 'GET',
    url: `${ADMIN_PATHS.audit}?limit=3&offset=3`,
    headers: moderatorHeaders,
  });
  assert.equal(secondPage.statusCode, 200);
  const secondItems = secondPage.json().data;
  assert.equal(secondItems.length, 3);
  assert.equal(
    firstItems.some((entry: { id: number }) =>
      secondItems.some((next: { id: number }) => next.id === entry.id),
    ),
    false,
  );

  const endPage = await app.inject({
    method: 'GET',
    url: `${ADMIN_PATHS.audit}?limit=5&offset=${firstMeta.total}`,
    headers: moderatorHeaders,
  });
  assert.equal(endPage.statusCode, 200);
  assert.equal(endPage.json().data.length, 0);
  assert.equal(endPage.json().meta.page.hasMore, false);

  const authorActions = await app.inject({
    method: 'GET',
    url: `${ADMIN_PATHS.audit}?actor=author&limit=50`,
    headers: moderatorHeaders,
  });
  assert.equal(authorActions.statusCode, 200);
  const authorItems = authorActions.json().data;
  assert.ok(authorItems.length > 0);
  assert.equal(
    authorItems.every(
      (event: { actor: string; action: string }) =>
        event.actor === 'author' &&
        ['submit', 'edit', 'resubmit', 'withdraw'].includes(event.action),
    ),
    true,
  );

  const moderatorActions = await app.inject({
    method: 'GET',
    url: `${ADMIN_PATHS.audit}?actor=moderator&limit=50`,
    headers: moderatorHeaders,
  });
  assert.equal(moderatorActions.statusCode, 200);
  const moderatorItems = moderatorActions.json().data;
  assert.ok(moderatorItems.length > 0);
  assert.equal(
    moderatorItems.every((event: { actor: string }) => event.actor === 'moderator'),
    true,
  );

  const rejectedActions = await app.inject({
    method: 'GET',
    url: `${ADMIN_PATHS.audit}?action=reject&limit=50`,
    headers: moderatorHeaders,
  });
  assert.equal(rejectedActions.statusCode, 200);
  const rejectedItems = rejectedActions.json().data;
  assert.ok(rejectedItems.length > 0);
  assert.equal(
    rejectedItems.every((event: { action: string }) => event.action === 'reject'),
    true,
  );

  const restoredActions = await app.inject({
    method: 'GET',
    url: `${ADMIN_PATHS.audit}?action=appeal_restore&limit=50`,
    headers: moderatorHeaders,
  });
  assert.equal(restoredActions.statusCode, 200);
  const restoredItems = restoredActions.json().data;
  assert.ok(restoredItems.length > 0);
  assert.equal(
    restoredItems.every(
      (event: { action: string; actor: string }) =>
        event.action === 'appeal_restore' && event.actor === 'moderator',
    ),
    true,
  );
  assert.equal(restoredItems[0].toStatus, 'published');
  assert.equal(
    restoredItems[0].fromStatus === 'rejected' ||
      restoredItems[0].fromStatus === 'hidden',
    true,
  );

  const auditText = JSON.stringify([...firstItems, ...authorItems, ...moderatorItems]);
  for (const forbiddenField of [
    'accountId',
    'displayName',
    'email',
    'actor_account_id',
    'reporter',
    'appellant',
  ]) {
    assert.equal(auditText.includes(`"${forbiddenField}"`), false);
  }
});

test('authors can edit a pending review and edits are audited', async () => {
  const student = await login('demo-student', 'soclear-demo-student');
  const user = await login('demo-user', 'soclear-demo-user');
  const moderator = await login('demo-moderator', 'soclear-demo-moderator');
  const studentHeaders = { cookie: student.cookie, 'x-csrf-token': student.csrf };
  const userHeaders = { cookie: user.cookie, 'x-csrf-token': user.csrf };
  const moderatorHeaders = { cookie: moderator.cookie, 'x-csrf-token': moderator.csrf };

  const created = await app.inject({
    method: 'POST',
    url: ME_PATHS.reviews,
    headers: studentHeaders,
    payload: {
      ...reviewPayload,
      teacherId: 't-linwangshu',
      courseId: 'c-stat',
      scores: { clarity: 3, organization: 3, feedback: 3, assessmentTransparency: 3 },
      difficulty: 2,
      workload: 2,
      attendance: '基本不点名',
      comment: '待编辑测试：初稿内容。',
    },
  });
  assert.equal(created.statusCode, 201, created.body);
  const pending = created.json().data;
  assert.equal(pending.status, 'pending');
  assert.equal(pending.revision, 1);

  const noCsrf = await app.inject({
    method: 'PATCH',
    url: ME_PATHS.reviewUpdate(pending.id),
    headers: { cookie: student.cookie },
    payload: {
      expectedVersion: pending.version,
      scores: { clarity: 4, organization: 4, feedback: 4, assessmentTransparency: 4 },
    },
  });
  assert.equal(noCsrf.statusCode, 403);
  assert.equal(noCsrf.json().error.code, 'CSRF_FAILED');

  const otherAuthor = await app.inject({
    method: 'PATCH',
    url: ME_PATHS.reviewUpdate(pending.id),
    headers: userHeaders,
    payload: {
      expectedVersion: pending.version,
      scores: { clarity: 4, organization: 4, feedback: 4, assessmentTransparency: 4 },
    },
  });
  assert.equal(otherAuthor.statusCode, 404);

  const stale = await app.inject({
    method: 'PATCH',
    url: ME_PATHS.reviewUpdate(pending.id),
    headers: studentHeaders,
    payload: {
      expectedVersion: pending.version + 5,
      scores: { clarity: 4, organization: 4, feedback: 4, assessmentTransparency: 4 },
    },
  });
  assert.equal(stale.statusCode, 409);
  assert.equal(stale.json().error.code, 'VERSION_CONFLICT');

  const edited = await app.inject({
    method: 'PATCH',
    url: ME_PATHS.reviewUpdate(pending.id),
    headers: studentHeaders,
    payload: {
      expectedVersion: pending.version,
      scores: { clarity: 5, organization: 4, feedback: 3, assessmentTransparency: 2 },
      difficulty: 4,
      workload: 5,
      attendance: '经常点名',
      comment: '编辑后：补充了课堂互动与作业反馈。',
    },
  });
  assert.equal(edited.statusCode, 200, edited.body);
  const updated = edited.json().data;
  assert.equal(updated.id, pending.id);
  assert.equal(updated.status, 'pending');
  assert.equal(updated.revision, 2);
  assert.equal(updated.version, pending.version + 1);
  assert.deepEqual(updated.scores, {
    clarity: 5,
    organization: 4,
    feedback: 3,
    assessmentTransparency: 2,
  });
  assert.equal(updated.descriptive.difficulty, 4);
  assert.equal(updated.descriptive.workload, 5);
  assert.equal(updated.descriptive.attendance, '经常点名');
  assert.equal(updated.comment, '编辑后：补充了课堂互动与作业反馈。');

  const own = await app.inject({
    method: 'GET',
    url: ME_PATHS.reviews,
    headers: { cookie: student.cookie },
  });
  const stored = own
    .json()
    .data.find((entry: { id: string }) => entry.id === pending.id);
  assert.ok(stored);
  assert.equal(stored.revision, 2);
  assert.equal(stored.version, updated.version);

  const publicBefore = await app.inject({
    method: 'GET',
    url: `${PUBLIC_PATHS.teacherReviews('t-linwangshu')}?limit=50`,
  });
  assert.equal(
    publicBefore
      .json()
      .data.some((entry: { id: string }) => entry.id === pending.id),
    false,
  );

  const audit = await app.inject({
    method: 'GET',
    url: ADMIN_PATHS.reviewAudit(pending.id),
    headers: { cookie: moderator.cookie },
  });
  assert.equal(audit.statusCode, 200);
  const events = audit.json().data;
  assert.deepEqual(
    events.map((event: { action: string }) => event.action),
    ['submit', 'edit'],
  );
  assert.equal(events[1].actor, 'author');
  assert.equal(events[1].fromStatus, 'pending');
  assert.equal(events[1].toStatus, 'pending');
  assert.equal(events[1].revision, 2);

  const approved = await app.inject({
    method: 'POST',
    url: ADMIN_PATHS.reviewDecision(pending.id),
    headers: moderatorHeaders,
    payload: { decision: 'approve', expectedVersion: updated.version },
  });
  assert.equal(approved.statusCode, 200, approved.body);

  const publicAfter = await app.inject({
    method: 'GET',
    url: `${PUBLIC_PATHS.teacherReviews('t-linwangshu')}?limit=50`,
  });
  assert.equal(
    publicAfter
      .json()
      .data.some((entry: { id: string }) => entry.id === pending.id),
    true,
  );

  const summaries = await app.inject({
    method: 'GET',
    url: `${ADMIN_PATHS.teacherSummaries}?limit=50`,
    headers: { cookie: moderator.cookie },
  });
  const linSummary = summaries
    .json()
    .data.find((entry: { teacher: { id: string } }) => entry.teacher.id === 't-linwangshu');
  assert.ok(linSummary);
  const regeneratedSummary = await app.inject({
    method: 'POST',
    url: ADMIN_PATHS.summaryRegenerate('t-linwangshu'),
    headers: moderatorHeaders,
    payload: { expectedEpoch: linSummary.teacherSummaryEpoch },
  });
  assert.equal(regeneratedSummary.statusCode, 200, regeneratedSummary.body);
  assert.equal(regeneratedSummary.json().data.state, 'ready');
  const summaryBeforeEdit = await app.inject({
    method: 'GET',
    url: PUBLIC_PATHS.teacherSummary('t-linwangshu'),
  });
  assert.equal(summaryBeforeEdit.json().data.state, 'ready');

  const publishedEdit = await app.inject({
    method: 'PATCH',
    url: ME_PATHS.reviewUpdate(pending.id),
    headers: studentHeaders,
    payload: {
      expectedVersion: approved.json().data.version,
      scores: { clarity: 2, organization: 5, feedback: 4, assessmentTransparency: 3 },
      difficulty: 5,
      workload: 1,
      attendance: '基本不点名',
      comment: '公开后修订：补充期中反馈与考核说明。',
    },
  });
  assert.equal(publishedEdit.statusCode, 200, publishedEdit.body);
  const publishedRevision = publishedEdit.json().data;
  assert.equal(publishedRevision.status, 'pending');
  assert.equal(publishedRevision.revision, 3);
  assert.equal(publishedRevision.version, approved.json().data.version + 1);
  assert.equal(publishedRevision.actions.canEdit, true);
  assert.equal(publishedRevision.publishedAt, null);
  assert.deepEqual(publishedRevision.scores, {
    clarity: 2,
    organization: 5,
    feedback: 4,
    assessmentTransparency: 3,
  });

  const publicDuringRevision = await app.inject({
    method: 'GET',
    url: `${PUBLIC_PATHS.teacherReviews('t-linwangshu')}?limit=50`,
  });
  assert.equal(
    publicDuringRevision
      .json()
      .data.some((entry: { id: string }) => entry.id === pending.id),
    false,
  );

  const publicSummaryAfterEdit = await app.inject({
    method: 'GET',
    url: PUBLIC_PATHS.teacherSummary('t-linwangshu'),
  });
  assert.equal(publicSummaryAfterEdit.json().data.state, 'generating');

  const summariesAfterEdit = await app.inject({
    method: 'GET',
    url: `${ADMIN_PATHS.teacherSummaries}?limit=50`,
    headers: { cookie: moderator.cookie },
  });
  const linSummaryAfterEdit = summariesAfterEdit
    .json()
    .data.find((entry: { teacher: { id: string } }) => entry.teacher.id === 't-linwangshu');
  assert.ok(linSummaryAfterEdit);
  assert.equal(linSummaryAfterEdit.state, 'generating');
  assert.equal(
    linSummaryAfterEdit.teacherSummaryEpoch,
    regeneratedSummary.json().data.teacherSummaryEpoch + 1,
  );

  const rejectedRevision = await app.inject({
    method: 'POST',
    url: ADMIN_PATHS.reviewDecision(pending.id),
    headers: moderatorHeaders,
    payload: {
      decision: 'reject',
      reasonCode: 'insufficient_detail',
      expectedVersion: publishedRevision.version,
    },
  });
  assert.equal(rejectedRevision.statusCode, 200, rejectedRevision.body);
  assert.equal(rejectedRevision.json().data.status, 'rejected');

  const rejectedEdit = await app.inject({
    method: 'PATCH',
    url: ME_PATHS.reviewUpdate(pending.id),
    headers: studentHeaders,
    payload: {
      expectedVersion: rejectedRevision.json().data.version,
      scores: { clarity: 4, organization: 4, feedback: 5, assessmentTransparency: 4 },
      difficulty: 3,
      workload: 3,
      attendance: '偶尔点名',
      comment: '驳回后修订：补充了具体作业与考核说明。',
    },
  });
  assert.equal(rejectedEdit.statusCode, 200, rejectedEdit.body);
  const rejectedRevisionData = rejectedEdit.json().data;
  assert.equal(rejectedRevisionData.status, 'pending');
  assert.equal(rejectedRevisionData.revision, 4);
  assert.equal(rejectedRevisionData.version, rejectedRevision.json().data.version + 1);

  const auditAfterResubmissions = await app.inject({
    method: 'GET',
    url: ADMIN_PATHS.reviewAudit(pending.id),
    headers: { cookie: moderator.cookie },
  });
  const resubmissionEvents = auditAfterResubmissions.json().data;
  assert.deepEqual(
    resubmissionEvents.map((event: { action: string }) => event.action),
    ['submit', 'edit', 'approve', 'resubmit', 'reject', 'resubmit'],
  );
  assert.equal(resubmissionEvents[3].actor, 'author');
  assert.equal(resubmissionEvents[3].fromStatus, 'published');
  assert.equal(resubmissionEvents[3].toStatus, 'pending');
  assert.equal(resubmissionEvents[3].revision, 3);
  assert.equal(resubmissionEvents[5].actor, 'author');
  assert.equal(resubmissionEvents[5].fromStatus, 'rejected');
  assert.equal(resubmissionEvents[5].toStatus, 'pending');
  assert.equal(resubmissionEvents[5].revision, 4);

  const globalResubmissions = await app.inject({
    method: 'GET',
    url: `${ADMIN_PATHS.audit}?action=resubmit&actor=author&limit=50`,
    headers: { cookie: moderator.cookie },
  });
  assert.equal(globalResubmissions.statusCode, 200);
  const globalItems = globalResubmissions.json().data.filter(
    (event: { reviewId: string }) => event.reviewId === pending.id,
  );
  assert.equal(globalItems.length, 2);
  assert.equal(globalItems.every((event: { actor: string }) => event.actor === 'author'), true);

  const revisionsResponse = await app.inject({
    method: 'GET',
    url: ADMIN_PATHS.reviewRevisions(pending.id),
    headers: { cookie: moderator.cookie },
  });
  assert.equal(revisionsResponse.statusCode, 200, revisionsResponse.body);
  const revisions = revisionsResponse.json().data;
  assert.deepEqual(
    revisions.map((revision: { revision: number }) => revision.revision),
    [4, 3, 2, 1],
  );
  assert.deepEqual(
    revisions.map((revision: { isCurrent: boolean }) => revision.isCurrent),
    [true, false, false, false],
  );
  assert.deepEqual(revisions[0].scores, {
    clarity: 4,
    organization: 4,
    feedback: 5,
    assessmentTransparency: 4,
  });
  assert.equal(revisions[0].comment, '驳回后修订：补充了具体作业与考核说明。');
  assert.equal(revisions[0].publishedAt, null);
  assert.equal(revisions[1].comment, '公开后修订：补充期中反馈与考核说明。');
  assert.equal(revisions[1].publishedAt, null);
  assert.equal(revisions[2].comment, '编辑后：补充了课堂互动与作业反馈。');
  assert.equal(typeof revisions[2].publishedAt, 'string');
  assert.equal(revisions[2].descriptive.attendance, '经常点名');
  assert.equal(revisions[3].comment, '待编辑测试：初稿内容。');
  assert.equal(revisions[3].scores.clarity, 3);
  const revisionText = JSON.stringify(revisions);
  for (const forbiddenField of ['accountId', 'authorId', 'displayName', 'email']) {
    assert.equal(revisionText.includes(`"${forbiddenField}"`), false);
  }

  const revisionsUnauthenticated = await app.inject({
    method: 'GET',
    url: ADMIN_PATHS.reviewRevisions(pending.id),
  });
  assert.equal(revisionsUnauthenticated.statusCode, 401);

  const revisionsForbidden = await app.inject({
    method: 'GET',
    url: ADMIN_PATHS.reviewRevisions(pending.id),
    headers: { cookie: student.cookie },
  });
  assert.equal(revisionsForbidden.statusCode, 403);

  const revisionsMissing = await app.inject({
    method: 'GET',
    url: ADMIN_PATHS.reviewRevisions('rv-does-not-exist'),
    headers: { cookie: moderator.cookie },
  });
  assert.equal(revisionsMissing.statusCode, 404);

  const finalApproval = await app.inject({
    method: 'POST',
    url: ADMIN_PATHS.reviewDecision(pending.id),
    headers: moderatorHeaders,
    payload: { decision: 'approve', expectedVersion: rejectedRevisionData.version },
  });
  assert.equal(finalApproval.statusCode, 200, finalApproval.body);

  const revisionsAfterApproval = await app.inject({
    method: 'GET',
    url: ADMIN_PATHS.reviewRevisions(pending.id),
    headers: { cookie: moderator.cookie },
  });
  const currentRevision = revisionsAfterApproval.json().data[0];
  assert.equal(currentRevision.revision, 4);
  assert.equal(currentRevision.isCurrent, true);
  assert.equal(typeof currentRevision.publishedAt, 'string');

  const publicFinal = await app.inject({
    method: 'GET',
    url: `${PUBLIC_PATHS.teacherReviews('t-linwangshu')}?limit=50`,
  });
  const publishedEntry = publicFinal
    .json()
    .data.find((entry: { id: string }) => entry.id === pending.id);
  assert.ok(publishedEntry);
  assert.equal(publishedEntry.comment, '驳回后修订：补充了具体作业与考核说明。');
  assert.equal(publishedEntry.scores.clarity, 4);
});

test('rejected reviews cannot be revised while an appeal is under review', async () => {
  const student = await login('demo-student', 'soclear-demo-student');
  const moderator = await login('demo-moderator', 'soclear-demo-moderator');
  const studentHeaders = { cookie: student.cookie, 'x-csrf-token': student.csrf };
  const moderatorHeaders = { cookie: moderator.cookie, 'x-csrf-token': moderator.csrf };

  const created = await app.inject({
    method: 'POST',
    url: ME_PATHS.reviews,
    headers: studentHeaders,
    payload: {
      ...reviewPayload,
      teacherId: 't-zhouyan',
      courseId: 'c-discrete',
      comment: '申诉复核期间修订拦截测试。',
    },
  });
  assert.equal(created.statusCode, 201, created.body);
  const review = created.json().data;

  const rejected = await app.inject({
    method: 'POST',
    url: ADMIN_PATHS.reviewDecision(review.id),
    headers: moderatorHeaders,
    payload: {
      decision: 'reject',
      reasonCode: 'insufficient_detail',
      expectedVersion: review.version,
    },
  });
  assert.equal(rejected.statusCode, 200, rejected.body);

  const appeal = await app.inject({
    method: 'POST',
    url: ME_PATHS.appeals,
    headers: studentHeaders,
    payload: {
      reviewId: review.id,
      reason: '希望补充材料后重新说明本门课程的实际体验。',
    },
  });
  assert.equal(appeal.statusCode, 201, appeal.body);

  const blocked = await app.inject({
    method: 'PATCH',
    url: ME_PATHS.reviewUpdate(review.id),
    headers: studentHeaders,
    payload: {
      expectedVersion: rejected.json().data.version,
      scores: { clarity: 5, organization: 5, feedback: 5, assessmentTransparency: 5 },
    },
  });
  assert.equal(blocked.statusCode, 409);
  assert.equal(blocked.json().error.code, 'REVIEW_NOT_EDITABLE');
});

test('logout revokes the session and clears the cookie', async () => {
  const student = await login('demo-student', 'soclear-demo-student');
  const logout = await app.inject({
    method: 'POST',
    url: AUTH_PATHS.logout,
    headers: { cookie: student.cookie, 'x-csrf-token': student.csrf },
  });
  assert.equal(logout.statusCode, 204);

  const session = await app.inject({
    method: 'GET',
    url: AUTH_PATHS.session,
    headers: { cookie: student.cookie },
  });
  assert.equal(session.json().data.authenticated, false);
  assert.equal(session.json().data.mainGroup, 'guest');
});
