import {
  SCORE_DIMENSIONS,
  type AttendanceFrequency,
  type ScoreSet,
} from '@soclear/contracts';

export interface LocalSummaryReview {
  id: string;
  scores: ScoreSet;
  difficulty: number | null;
  workload: number | null;
  attendance: AttendanceFrequency | null;
  comment: string | null;
}

export interface LocalSummarySentence {
  text: string;
  citationIndexes: number[];
}

const THEMES = [
  { label: '讲授清晰度', keywords: ['板书', '推导', '例题', '讲解', '清晰', '听懂'] },
  { label: '课程组织', keywords: ['资料', '进度', '安排', '章节', '作业量', '复习'] },
  { label: '反馈支持', keywords: ['答疑', '反馈', '批改', '沟通', '课后'] },
  { label: '考核透明度', keywords: ['考核', '评分', '平时分', '期末', '范围'] },
] as const;

const ATTENDANCE_PRIORITY: AttendanceFrequency[] = [
  '每节必点',
  '经常点名',
  '偶尔点名',
  '基本不点名',
  '未说明',
];

function mean(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

// Citation indexes are 1-based positions in the public review ordering.
export function buildLocalTeacherSummary(
  reviews: LocalSummaryReview[],
): LocalSummarySentence[] {
  if (reviews.length === 0) return [];

  const indexes = new Map(reviews.map((review, index) => [review.id, index + 1]));
  const toCitationIndexes = (ids: string[]): number[] =>
    [...new Set(ids)]
      .map((id) => indexes.get(id))
      .filter((index): index is number => index !== undefined)
      .sort((left, right) => left - right);

  const dimensionAverages = SCORE_DIMENSIONS.map((dimension) => {
    const values = reviews.map((review) => review.scores[dimension.key]);
    return {
      ...dimension,
      average: mean(values) ?? 0,
    };
  });
  const sortedDimensions = [...dimensionAverages].sort(
    (left, right) => right.average - left.average,
  );
  const strongest = sortedDimensions[0]!;
  const weakest = sortedDimensions[sortedDimensions.length - 1]!;
  const highestStrongest = [...reviews].sort(
    (left, right) => right.scores[strongest.key] - left.scores[strongest.key],
  )[0];
  const lowestWeakest = [...reviews].sort(
    (left, right) => left.scores[weakest.key] - right.scores[weakest.key],
  )[0];

  const sentences: LocalSummarySentence[] = [];
  sentences.push({
    text: `当前 ${reviews.length} 条公开评价中，${strongest.label}平均 ${strongest.average.toFixed(1)} 分，${weakest.label}平均 ${weakest.average.toFixed(1)} 分（满分 5 分）。`,
    citationIndexes: toCitationIndexes(
      [highestStrongest?.id, lowestWeakest?.id].filter(
        (id): id is string => Boolean(id),
      ),
    ),
  });

  const themed = THEMES.map((theme) => {
    const matches = reviews.filter(
      (review) =>
        review.comment &&
        theme.keywords.some((keyword) => review.comment!.includes(keyword)),
    );
    return { ...theme, matches };
  })
    .filter((theme) => theme.matches.length > 0)
    .sort((left, right) => right.matches.length - left.matches.length)
    .slice(0, 2);

  if (themed.length > 0) {
    const representative = themed
      .flatMap((theme) => theme.matches.slice(0, 2).map((review) => review.id));
    sentences.push({
      text: `公开评价中，${themed.map((theme) => `「${theme.label}」`).join('与')}相关的具体描述出现得较多。`,
      citationIndexes: toCitationIndexes(representative),
    });
  } else {
    sentences.push({
      text: '公开评价以维度评分和描述项为主，文字描述较少。',
      citationIndexes: toCitationIndexes(reviews.slice(0, 2).map((review) => review.id)),
    });
  }

  const difficulties = reviews
    .map((review) => review.difficulty)
    .filter((value): value is number => value !== null);
  const workloads = reviews
    .map((review) => review.workload)
    .filter((value): value is number => value !== null);
  const attendanceCounts = new Map<AttendanceFrequency, number>();
  reviews.forEach((review) => {
    if (!review.attendance) return;
    attendanceCounts.set(
      review.attendance,
      (attendanceCounts.get(review.attendance) ?? 0) + 1,
    );
  });
  const topAttendance = ATTENDANCE_PRIORITY.map((attendance) => ({
    attendance,
    count: attendanceCounts.get(attendance) ?? 0,
  }))
    .filter((entry) => entry.count > 0)
    .sort((left, right) => right.count - left.count)[0]?.attendance;

  const descriptiveParts: string[] = [];
  const difficultyAverage = mean(difficulties);
  const workloadAverage = mean(workloads);
  if (difficultyAverage !== null) {
    descriptiveParts.push(`难度平均 ${difficultyAverage.toFixed(1)}/5`);
  }
  if (workloadAverage !== null) {
    descriptiveParts.push(`作业量平均 ${workloadAverage.toFixed(1)}/5`);
  }
  if (topAttendance) {
    descriptiveParts.push(`${topAttendance}较常见`);
  }
  if (descriptiveParts.length > 0) {
    const descriptiveSources = reviews
      .filter(
        (review) =>
          review.difficulty !== null ||
          review.workload !== null ||
          review.attendance !== null,
      )
      .slice(0, 2)
      .map((review) => review.id);
    sentences.push({
      text: `描述项中，${descriptiveParts.join('、')}；这些描述不参与综合分。`,
      citationIndexes: toCitationIndexes(descriptiveSources),
    });
  }

  return sentences;
}
