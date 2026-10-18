import {
  RATING_MIN_SAMPLES,
  RATING_SCHEMA_VERSION,
  SCORE_KEYS,
  type RatingSummaryDTO,
  type ScoreSet,
} from '@soclear/contracts';
import { reviews, teachersById } from '../data/seed.js';

const round = (value: number, digits = 2) => Math.round(value * 10 ** digits) / 10 ** digits;

export function getPublishedReviews(teacherId: string) {
  return reviews
    .filter((review) => review.teacherId === teacherId && review.status === 'published')
    .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt) || b.id.localeCompare(a.id));
}

export function summarizeTeacherRatings(teacherId: string): RatingSummaryDTO {
  const published = getPublishedReviews(teacherId);
  const publishedCount = published.length;

  if (publishedCount === 0) {
    return {
      schemaVersion: RATING_SCHEMA_VERSION,
      minSamples: RATING_MIN_SAMPLES,
      publishedCount,
      eligible: false,
      overall: null,
      scores: null,
      statsUpdatedAt: teachersById.get(teacherId) ? '2026-10-16T08:00:00.000Z' : new Date(0).toISOString(),
    };
  }

  const averages = {} as ScoreSet;
  for (const key of SCORE_KEYS) {
    const total = published.reduce((sum, review) => sum + review.scores[key], 0);
    averages[key] = round(total / publishedCount);
  }

  const eligible = publishedCount >= RATING_MIN_SAMPLES;
  const overall = eligible
    ? round(SCORE_KEYS.reduce((sum, key) => sum + averages[key], 0) / SCORE_KEYS.length)
    : null;

  return {
    schemaVersion: RATING_SCHEMA_VERSION,
    minSamples: RATING_MIN_SAMPLES,
    publishedCount,
    eligible,
    overall,
    scores: eligible ? averages : null,
    statsUpdatedAt: published[0]!.publishedAt,
  };
}
