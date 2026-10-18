import test from 'node:test';
import assert from 'node:assert/strict';
import { RATING_MIN_SAMPLES } from '@soclear/contracts';
import { teachersById } from '../data/seed.js';
import { summarizeTeacherRatings } from './ratings.js';

test('eligible teachers expose an overall score based on the four dimensions', () => {
  const summary = summarizeTeacherRatings('t-shenzhiyuan');
  assert.equal(summary.eligible, true);
  assert.equal(summary.publishedCount, 9);
  assert.ok(summary.overall !== null && summary.overall > 1 && summary.overall <= 5);
  assert.ok(summary.scores);
  assert.ok(summary.scores.clarity >= summary.scores.assessmentTransparency - 1);
});

test('small samples suppress all aggregate scores but keep the count', () => {
  const summary = summarizeTeacherRatings('t-xunanqiao');
  assert.equal(summary.eligible, false);
  assert.equal(summary.publishedCount, 4);
  assert.equal(summary.overall, null);
  assert.equal(summary.scores, null);
  assert.ok(summary.publishedCount < RATING_MIN_SAMPLES);
});

test('a teacher with no published reviews reports zero samples and no scores', () => {
  const summary = summarizeTeacherRatings('t-hansongsheng');
  assert.equal(summary.publishedCount, 0);
  assert.equal(summary.eligible, false);
  assert.equal(summary.overall, null);
  assert.ok(teachersById.has('t-hansongsheng'));
});

test('stats timestamp follows the newest published review', () => {
  const summary = summarizeTeacherRatings('t-guqinghe');
  assert.match(summary.statsUpdatedAt, /^2026-/);
  assert.equal(summary.minSamples, RATING_MIN_SAMPLES);
});
