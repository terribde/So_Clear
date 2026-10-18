import {
  type AttendanceFrequency,
  type CourseDTO,
  type DepartmentDTO,
  type ScoreSet,
  type TermDTO,
} from '@soclear/contracts';

export const DATA_VERSION = 1;
export const DATA_UPDATED_AT = '2026-10-16T08:00:00.000Z';

export const departments: DepartmentDTO[] = [
  { id: 'd-math', name: '数学学院' },
  { id: 'd-cs', name: '计算机与人工智能学院' },
  { id: 'd-physics', name: '物理科学与技术学院' },
  { id: 'd-ee', name: '电气工程学院' },
  { id: 'd-civil', name: '土木工程学院' },
  { id: 'd-foreign', name: '外国语学院' },
  { id: 'd-econ', name: '经济管理学院' },
  { id: 'd-humanities', name: '人文学院' },
];

export const terms: TermDTO[] = [
  { id: 't-2026-1', label: '2026–2027 第一学期', isCurrent: true },
  { id: 't-2025-2', label: '2025–2026 第二学期', isCurrent: false },
  { id: 't-2025-1', label: '2025–2026 第一学期', isCurrent: false },
  { id: 't-2024-2', label: '2024–2025 第二学期', isCurrent: false },
];

export const courses: CourseDTO[] = [
  { id: 'c-calc1', name: '高等数学（I）', departmentId: 'd-math', departmentName: '数学学院' },
  { id: 'c-linear', name: '线性代数', departmentId: 'd-math', departmentName: '数学学院' },
  { id: 'c-stat', name: '概率论与数理统计', departmentId: 'd-math', departmentName: '数学学院' },
  { id: 'c-ds', name: '数据结构与算法', departmentId: 'd-cs', departmentName: '计算机与人工智能学院' },
  { id: 'c-prog', name: '程序设计基础', departmentId: 'd-cs', departmentName: '计算机与人工智能学院' },
  { id: 'c-discrete', name: '离散数学', departmentId: 'd-cs', departmentName: '计算机与人工智能学院' },
  { id: 'c-phys1', name: '大学物理（I）', departmentId: 'd-physics', departmentName: '物理科学与技术学院' },
  { id: 'c-circuits', name: '电路分析', departmentId: 'd-ee', departmentName: '电气工程学院' },
  { id: 'c-theorymech', name: '理论力学', departmentId: 'd-civil', departmentName: '土木工程学院' },
  { id: 'c-academiceng', name: '学术英语', departmentId: 'd-foreign', departmentName: '外国语学院' },
  { id: 'c-microecon', name: '微观经济学', departmentId: 'd-econ', departmentName: '经济管理学院' },
  { id: 'c-modernchinese', name: '现代汉语', departmentId: 'd-humanities', departmentName: '人文学院' },
];

export interface SeedSummary {
  state: 'ready' | 'missing' | 'generating';
  sentences: Array<{ text: string; citationIndexes: number[] }>;
}

export interface SeedTeacher {
  id: string;
  slug: string;
  name: string;
  title: string;
  departmentId: string;
  tags: string[];
  courseIds: string[];
  baseScores: ScoreSet;
  reviewCount: number;
  summary?: SeedSummary;
}

export const teachers: SeedTeacher[] = [
  {
    id: 't-shenzhiyuan',
    slug: 'shenzhiyuan',
    name: '沈知远',
    title: '教授',
    departmentId: 'd-math',
    tags: ['板书清楚', '推导严谨', '节奏稳'],
    courseIds: ['c-calc1', 'c-linear'],
    baseScores: { clarity: 4.8, organization: 4.6, feedback: 4.2, assessmentTransparency: 4.4 },
    reviewCount: 9,
    summary: {
      state: 'ready',
      sentences: [
        { text: '多条评价都提到板书结构清楚，关键推导会停下来确认同学是否跟上。', citationIndexes: [1, 3] },
        { text: '课程资料与作业安排较稳定，复习时能按周找到对应材料。', citationIndexes: [2, 5] },
        { text: '也有评价提到课堂节奏偏快，课前预习会更容易跟上。', citationIndexes: [4, 6] },
      ],
    },
  },
  {
    id: 't-linwangshu',
    slug: 'linwangshu',
    name: '林望舒',
    title: '副教授',
    departmentId: 'd-math',
    tags: ['例题充分', '答疑耐心'],
    courseIds: ['c-calc1', 'c-stat'],
    baseScores: { clarity: 4.5, organization: 4.4, feedback: 4.6, assessmentTransparency: 4.3 },
    reviewCount: 7,
    summary: {
      state: 'ready',
      sentences: [
        { text: '板书与例题安排获得较多正向反馈，答疑耐心是反复出现的描述。', citationIndexes: [1, 2] },
        { text: '课程进度总体稳定，部分同学希望增加习题课的讲解时间。', citationIndexes: [3, 5] },
      ],
    },
  },
  {
    id: 't-guqinghe',
    slug: 'guqinghe',
    name: '顾清和',
    title: '讲师',
    departmentId: 'd-cs',
    tags: ['项目驱动', '代码规范', '反馈具体'],
    courseIds: ['c-ds', 'c-prog'],
    baseScores: { clarity: 4.7, organization: 4.6, feedback: 4.8, assessmentTransparency: 4.5 },
    reviewCount: 8,
    summary: {
      state: 'ready',
      sentences: [
        { text: '项目式作业是评价中的高频反馈，代码规范与提交要求说明得较细。', citationIndexes: [1, 2] },
        { text: '答疑反馈被认为具体，能指出问题所在并给出修改方向。', citationIndexes: [3, 7] },
        { text: '任务量不低，更适合愿意投入时间动手实践的同学。', citationIndexes: [4, 8] },
      ],
    },
  },
  {
    id: 't-zhouyan',
    slug: 'zhouyan',
    name: '周砚',
    title: '教授',
    departmentId: 'd-cs',
    tags: ['干货多', '节奏快'],
    courseIds: ['c-ds', 'c-discrete'],
    baseScores: { clarity: 4.3, organization: 4.0, feedback: 3.8, assessmentTransparency: 4.1 },
    reviewCount: 6,
    summary: { state: 'missing', sentences: [] },
  },
  {
    id: 't-chenmingche',
    slug: 'chenmingche',
    name: '陈明澈',
    title: '副教授',
    departmentId: 'd-physics',
    tags: ['演示实验', '逻辑清晰'],
    courseIds: ['c-phys1'],
    baseScores: { clarity: 4.4, organization: 4.2, feedback: 4.0, assessmentTransparency: 4.3 },
    reviewCount: 5,
  },
  {
    id: 't-xunanqiao',
    slug: 'xunanqiao',
    name: '许南乔',
    title: '讲师',
    departmentId: 'd-foreign',
    tags: ['互动多', '作业适量'],
    courseIds: ['c-academiceng'],
    baseScores: { clarity: 3.9, organization: 3.7, feedback: 4.2, assessmentTransparency: 3.8 },
    reviewCount: 4,
  },
  {
    id: 't-tangyuan',
    slug: 'tangyuan',
    name: '唐予安',
    title: '教授',
    departmentId: 'd-civil',
    tags: ['要求严格', '答疑认真', '考核口径清晰'],
    courseIds: ['c-theorymech'],
    baseScores: { clarity: 4.2, organization: 4.5, feedback: 4.3, assessmentTransparency: 4.7 },
    reviewCount: 5,
    summary: { state: 'missing', sentences: [] },
  },
  {
    id: 't-jiangjinyue',
    slug: 'jiangjinyue',
    name: '江浸月',
    title: '副教授',
    departmentId: 'd-ee',
    tags: ['案例多', '实验结合'],
    courseIds: ['c-circuits'],
    baseScores: { clarity: 4.5, organization: 4.3, feedback: 4.1, assessmentTransparency: 4.4 },
    reviewCount: 6,
    summary: {
      state: 'ready',
      sentences: [
        { text: '案例与实验结合被多次提及，课堂内容与电路分析场景联系紧密。', citationIndexes: [1, 4] },
        { text: '考核构成和复习范围提前说明，评价中对其透明度有正向反馈。', citationIndexes: [2, 5] },
        { text: '少数评价希望习题课节奏再放慢一些。', citationIndexes: [3, 6] },
      ],
    },
  },
  {
    id: 't-songzhiwei',
    slug: 'songzhiwei',
    name: '宋知微',
    title: '讲师',
    departmentId: 'd-econ',
    tags: ['讨论式', '案例较新'],
    courseIds: ['c-microecon'],
    baseScores: { clarity: 3.8, organization: 3.6, feedback: 3.9, assessmentTransparency: 3.5 },
    reviewCount: 3,
  },
  {
    id: 't-hansongsheng',
    slug: 'hansongsheng',
    name: '韩松声',
    title: '教授',
    departmentId: 'd-humanities',
    tags: ['阅读量大', '旁征博引'],
    courseIds: ['c-modernchinese'],
    baseScores: { clarity: 4.1, organization: 3.9, feedback: 3.8, assessmentTransparency: 4.0 },
    reviewCount: 0,
  },
  {
    id: 't-liangguanlan',
    slug: 'liangguanlan',
    name: '梁观澜',
    title: '副教授',
    departmentId: 'd-math',
    tags: ['结构清楚', '小测频繁'],
    courseIds: ['c-linear', 'c-stat'],
    baseScores: { clarity: 4.1, organization: 4.6, feedback: 3.9, assessmentTransparency: 4.4 },
    reviewCount: 5,
    summary: { state: 'generating', sentences: [] },
  },
  {
    id: 't-shenyanqiu',
    slug: 'shenyanqiu',
    name: '沈砚秋',
    title: '讲师',
    departmentId: 'd-cs',
    tags: ['上机辅导', '耐心'],
    courseIds: ['c-prog'],
    baseScores: { clarity: 3.7, organization: 3.5, feedback: 4.2, assessmentTransparency: 3.6 },
    reviewCount: 2,
  },
  {
    id: 't-yetinglan',
    slug: 'yetinglan',
    name: '叶听澜',
    title: '副教授',
    departmentId: 'd-physics',
    tags: ['推导细', '语速平稳'],
    courseIds: ['c-phys1'],
    baseScores: { clarity: 4.6, organization: 4.4, feedback: 4.5, assessmentTransparency: 4.2 },
    reviewCount: 7,
    summary: {
      state: 'ready',
      sentences: [
        { text: '推导过程细致，语速平稳，适合同步记笔记。', citationIndexes: [1, 5] },
        { text: '答疑与作业反馈较及时，课后沟通渠道明确。', citationIndexes: [2, 6] },
        { text: '课堂互动相对少，更适合自主学习的同学。', citationIndexes: [3, 7] },
      ],
    },
  },
  {
    id: 't-qinyuanshan',
    slug: 'qinyuanshan',
    name: '秦远山',
    title: '教授',
    departmentId: 'd-ee',
    tags: ['工程视角', '严谨'],
    courseIds: ['c-circuits'],
    baseScores: { clarity: 4.2, organization: 4.4, feedback: 3.9, assessmentTransparency: 4.5 },
    reviewCount: 5,
    summary: { state: 'missing', sentences: [] },
  },
  {
    id: 't-sujianwei',
    slug: 'sujianwei',
    name: '苏见微',
    title: '讲师',
    departmentId: 'd-foreign',
    tags: ['写作反馈细'],
    courseIds: ['c-academiceng'],
    baseScores: { clarity: 4.0, organization: 3.8, feedback: 4.3, assessmentTransparency: 3.9 },
    reviewCount: 1,
  },
  {
    id: 't-luxingzhou',
    slug: 'luxingzhou',
    name: '陆行舟',
    title: '副教授',
    departmentId: 'd-civil',
    tags: ['例题多', '考核透明'],
    courseIds: ['c-theorymech'],
    baseScores: { clarity: 4.3, organization: 4.1, feedback: 4.0, assessmentTransparency: 4.6 },
    reviewCount: 6,
    summary: {
      state: 'ready',
      sentences: [
        { text: '课程例题覆盖面广，考核范围与平时练习的对应关系较清楚。', citationIndexes: [2, 4] },
        { text: '评价普遍认可答疑态度，作业批改会指出关键步骤。', citationIndexes: [1, 5] },
        { text: '课程节奏中等，适合希望稳步推进的同学。', citationIndexes: [3, 6] },
      ],
    },
  },
];

export interface SeedReview {
  id: string;
  teacherId: string;
  courseId: string;
  termId: string;
  scores: ScoreSet;
  difficulty: number;
  workload: number;
  attendance: AttendanceFrequency | null;
  comment: string | null;
  publishedAt: string;
  revision: number;
  status: 'published' | 'pending' | 'hidden' | 'withdrawn';
  moderationNote: string | null;
}

const reviewComments = [
  '板书结构比较清楚，关键推导会停下来确认大家有没有跟上。',
  '课程资料按周整理，复习时能很快找到对应章节和作业。',
  '答疑时会把问题拆成几步来讲，不会只丢一个结论。',
  '开学时说明了平时分与期末的比例，复习范围也比较明确。',
  '例题覆盖得比较全，课后按题型再做一遍会有收获。',
  '节奏偏快，课前不预习容易跟不上；老师愿意在课后重复讲关键步骤。',
  '作业量不算小，但提交要求写得清楚，按时完成压力可控。',
  '课堂互动不多，更适合能够自主安排预习和复习的同学。',
  '作业批改会指出具体步骤的问题，比只给分数更有帮助。',
  '课程中段有一次小测，用来检查前几章的基础，难度适中。',
  '课件和板书有些重复，如果能提前发讲义会更好安排笔记。',
  '期末题型与平时练习接近，没有刻意增加偏题。',
  '老师对考勤要求比较稳定，偶尔点名，不会临时改变规则。',
  '讨论环节能听到不同思路，但需要提前读完指定材料。',
  '整体安排比较紧凑，建议留出固定的复习时间。',
  '反馈通常在一周内给到，能看出老师认真看过作业。',
  '课堂举例贴近课程本身，复杂概念会尽量用简单语言解释。',
  '不同教学班的进度略有差异，借笔记时要注意章节对应。',
];

const termBases: Record<string, string> = {
  't-2026-1': '2026-09-08T12:00:00.000Z',
  't-2025-2': '2026-02-24T12:00:00.000Z',
  't-2025-1': '2025-09-15T12:00:00.000Z',
  't-2024-2': '2025-02-25T12:00:00.000Z',
};

const scoreOffsets = [-0.4, 0.1, 0.4, 0, -0.2];
const attendanceCycle: Array<AttendanceFrequency | null> = [
  '偶尔点名',
  '每节必点',
  '经常点名',
  '基本不点名',
  null,
  '未说明',
];

const clampScore = (value: number) => Math.min(5, Math.max(1, Math.round(value)));

function makeScores(teacher: SeedTeacher, reviewIndex: number): ScoreSet {
  const keys = ['clarity', 'organization', 'feedback', 'assessmentTransparency'] as const;
  const scores = {} as ScoreSet;
  keys.forEach((key, dimensionIndex) => {
    const offset = scoreOffsets[(reviewIndex + dimensionIndex * 2) % scoreOffsets.length]!;
    scores[key] = clampScore(teacher.baseScores[key] + offset);
  });
  return scores;
}

function makePublishedAt(termId: string, reviewIndex: number): string {
  const base = new Date(termBases[termId]!);
  base.setUTCDate(base.getUTCDate() + ((reviewIndex * 4) % 30));
  return base.toISOString();
}

export const reviews: SeedReview[] = teachers.flatMap((teacher, teacherIndex) =>
  Array.from({ length: teacher.reviewCount }, (_, reviewIndex) => {
    const termId = terms[reviewIndex % terms.length]!.id;
    const courseId = teacher.courseIds[reviewIndex % teacher.courseIds.length]!;
    const commentIndex = (teacherIndex * 5 + reviewIndex * 3) % reviewComments.length;
    return {
      id: `rv-${teacher.slug}-${String(reviewIndex + 1).padStart(2, '0')}`,
      teacherId: teacher.id,
      courseId,
      termId,
      scores: makeScores(teacher, reviewIndex),
      difficulty: [2, 3, 3, 4, 4, 5][(teacherIndex + reviewIndex) % 6]!,
      workload: [2, 3, 4, 3, 5, 2][(teacherIndex + reviewIndex * 2) % 6]!,
      attendance: attendanceCycle[(teacherIndex + reviewIndex) % attendanceCycle.length]!,
      comment: reviewIndex % 6 === 5 ? null : reviewComments[commentIndex]!,
      publishedAt: makePublishedAt(termId, reviewIndex),
      revision: 1,
      status: 'published',
      moderationNote: null,
    } satisfies SeedReview;
  }),
);

export interface SeedMeeting {
  weekday: number | null;
  startPeriod: number | null;
  endPeriod: number | null;
  weeks: string | null;
  location: string | null;
  timeUnknown: boolean;
}

export interface SeedSection {
  id: string;
  sectionCode: string;
  courseId: string;
  termId: string;
  campus: string;
  capacity: number | null;
  teacherIds: string[];
  meetings: SeedMeeting[];
  note: string | null;
  updatedAt: string;
}

const meeting = (
  weekday: number,
  startPeriod: number,
  endPeriod: number,
  location: string,
  weeks = '1–16 周',
): SeedMeeting => ({ weekday, startPeriod, endPeriod, weeks, location, timeUnknown: false });

export const sections: SeedSection[] = [
  {
    id: 's-calc1-01',
    sectionCode: 'SEC-HM101-01',
    courseId: 'c-calc1',
    termId: 't-2026-1',
    campus: '犀浦校区',
    capacity: 120,
    teacherIds: ['t-shenzhiyuan'],
    meetings: [meeting(1, 1, 2, '犀浦校区 X2210'), meeting(3, 3, 4, '犀浦校区 X2210')],
    note: null,
    updatedAt: DATA_UPDATED_AT,
  },
  {
    id: 's-calc1-02',
    sectionCode: 'SEC-HM101-02',
    courseId: 'c-calc1',
    termId: 't-2026-1',
    campus: '犀浦校区',
    capacity: 100,
    teacherIds: ['t-linwangshu'],
    meetings: [meeting(2, 3, 4, '犀浦校区 X2312'), meeting(4, 1, 2, '犀浦校区 X2312')],
    note: null,
    updatedAt: DATA_UPDATED_AT,
  },
  {
    id: 's-calc1-03',
    sectionCode: 'SEC-HM101-03',
    courseId: 'c-calc1',
    termId: 't-2026-1',
    campus: '九里校区',
    capacity: 80,
    teacherIds: ['t-shenzhiyuan', 't-linwangshu'],
    meetings: [meeting(3, 5, 6, '九里校区 4-305', '1–8 周')],
    note: '共同授课教学班',
    updatedAt: DATA_UPDATED_AT,
  },
  {
    id: 's-linear-01',
    sectionCode: 'SEC-XX201-01',
    courseId: 'c-linear',
    termId: 't-2026-1',
    campus: '犀浦校区',
    capacity: 90,
    teacherIds: ['t-shenzhiyuan'],
    meetings: [meeting(5, 1, 2, '犀浦校区 X2210')],
    note: null,
    updatedAt: DATA_UPDATED_AT,
  },
  {
    id: 's-linear-02',
    sectionCode: 'SEC-XX201-02',
    courseId: 'c-linear',
    termId: 't-2026-1',
    campus: '犀浦校区',
    capacity: 90,
    teacherIds: ['t-liangguanlan'],
    meetings: [meeting(2, 5, 6, '犀浦校区 X3201')],
    note: null,
    updatedAt: DATA_UPDATED_AT,
  },
  {
    id: 's-stat-01',
    sectionCode: 'SEC-GL301-01',
    courseId: 'c-stat',
    termId: 't-2026-1',
    campus: '犀浦校区',
    capacity: 100,
    teacherIds: ['t-linwangshu'],
    meetings: [meeting(4, 5, 6, '犀浦校区 X2312')],
    note: null,
    updatedAt: DATA_UPDATED_AT,
  },
  {
    id: 's-stat-02',
    sectionCode: 'SEC-GL301-02',
    courseId: 'c-stat',
    termId: 't-2026-1',
    campus: '犀浦校区',
    capacity: 100,
    teacherIds: ['t-liangguanlan'],
    meetings: [meeting(1, 3, 4, '犀浦校区 X3201')],
    note: null,
    updatedAt: DATA_UPDATED_AT,
  },
  {
    id: 's-ds-01',
    sectionCode: 'SEC-SJ201-01',
    courseId: 'c-ds',
    termId: 't-2026-1',
    campus: '犀浦校区',
    capacity: 80,
    teacherIds: ['t-guqinghe'],
    meetings: [meeting(1, 5, 6, '犀浦校区 X1210'), meeting(3, 5, 6, '犀浦校区 X1210')],
    note: null,
    updatedAt: DATA_UPDATED_AT,
  },
  {
    id: 's-ds-02',
    sectionCode: 'SEC-SJ201-02',
    courseId: 'c-ds',
    termId: 't-2026-1',
    campus: '犀浦校区',
    capacity: 80,
    teacherIds: ['t-zhouyan'],
    meetings: [meeting(2, 1, 2, '犀浦校区 X1208'), meeting(4, 3, 4, '犀浦校区 X1208')],
    note: null,
    updatedAt: DATA_UPDATED_AT,
  },
  {
    id: 's-prog-01',
    sectionCode: 'SEC-CX101-01',
    courseId: 'c-prog',
    termId: 't-2026-1',
    campus: '犀浦校区',
    capacity: 60,
    teacherIds: ['t-guqinghe'],
    meetings: [meeting(5, 3, 4, '犀浦校区 X1210'), meeting(5, 5, 6, '犀浦校区 机房 X0302')],
    note: null,
    updatedAt: DATA_UPDATED_AT,
  },
  {
    id: 's-prog-02',
    sectionCode: 'SEC-CX101-02',
    courseId: 'c-prog',
    termId: 't-2026-1',
    campus: '九里校区',
    capacity: 60,
    teacherIds: ['t-shenyanqiu'],
    meetings: [meeting(3, 1, 2, '九里校区 2-201'), meeting(3, 3, 4, '九里校区 机房 2-105')],
    note: null,
    updatedAt: DATA_UPDATED_AT,
  },
  {
    id: 's-phys1-01',
    sectionCode: 'SEC-WL101-01',
    courseId: 'c-phys1',
    termId: 't-2026-1',
    campus: '犀浦校区',
    capacity: 120,
    teacherIds: ['t-chenmingche'],
    meetings: [meeting(1, 1, 2, '犀浦校区 X4101'), meeting(3, 1, 2, '犀浦校区 X4101')],
    note: null,
    updatedAt: DATA_UPDATED_AT,
  },
  {
    id: 's-phys1-02',
    sectionCode: 'SEC-WL101-02',
    courseId: 'c-phys1',
    termId: 't-2026-1',
    campus: '犀浦校区',
    capacity: 120,
    teacherIds: ['t-yetinglan'],
    meetings: [meeting(2, 3, 4, '犀浦校区 X4103'), meeting(4, 3, 4, '犀浦校区 X4103')],
    note: null,
    updatedAt: DATA_UPDATED_AT,
  },
  {
    id: 's-academiceng-01',
    sectionCode: 'SEC-YY101-01',
    courseId: 'c-academiceng',
    termId: 't-2026-1',
    campus: '犀浦校区',
    capacity: 40,
    teacherIds: ['t-xunanqiao'],
    meetings: [meeting(3, 3, 4, '犀浦校区 X5206')],
    note: null,
    updatedAt: DATA_UPDATED_AT,
  },
  {
    id: 's-academiceng-02',
    sectionCode: 'SEC-YY101-02',
    courseId: 'c-academiceng',
    termId: 't-2026-1',
    campus: '九里校区',
    capacity: 40,
    teacherIds: ['t-sujianwei'],
    meetings: [meeting(5, 3, 4, '九里校区 1-407')],
    note: null,
    updatedAt: DATA_UPDATED_AT,
  },
  {
    id: 's-theorymech-01',
    sectionCode: 'SEC-LL201-01',
    courseId: 'c-theorymech',
    termId: 't-2026-1',
    campus: '犀浦校区',
    capacity: 90,
    teacherIds: ['t-tangyuan'],
    meetings: [meeting(1, 3, 4, '犀浦校区 X6102'), meeting(4, 1, 2, '犀浦校区 X6102')],
    note: null,
    updatedAt: DATA_UPDATED_AT,
  },
  {
    id: 's-theorymech-02',
    sectionCode: 'SEC-LL201-02',
    courseId: 'c-theorymech',
    termId: 't-2026-1',
    campus: '九里校区',
    capacity: 90,
    teacherIds: ['t-luxingzhou'],
    meetings: [meeting(2, 5, 6, '九里校区 3-110'), meeting(5, 1, 2, '九里校区 3-110')],
    note: null,
    updatedAt: DATA_UPDATED_AT,
  },
  {
    id: 's-theorymech-03',
    sectionCode: 'SEC-LL201-03',
    courseId: 'c-theorymech',
    termId: 't-2026-1',
    campus: '犀浦校区',
    capacity: null,
    teacherIds: ['t-luxingzhou'],
    meetings: [
      {
        weekday: null,
        startPeriod: null,
        endPeriod: null,
        weeks: '待排',
        location: null,
        timeUnknown: true,
      },
    ],
    note: '教务来源尚未给出上课时间，不能据此判断时间冲突。',
    updatedAt: DATA_UPDATED_AT,
  },
  {
    id: 's-circuits-01',
    sectionCode: 'SEC-DL201-01',
    courseId: 'c-circuits',
    termId: 't-2026-1',
    campus: '犀浦校区',
    capacity: 100,
    teacherIds: ['t-jiangjinyue'],
    meetings: [meeting(2, 1, 2, '犀浦校区 X3305'), meeting(4, 5, 6, '犀浦校区 X3305')],
    note: null,
    updatedAt: DATA_UPDATED_AT,
  },
  {
    id: 's-circuits-02',
    sectionCode: 'SEC-DL201-02',
    courseId: 'c-circuits',
    termId: 't-2026-1',
    campus: '犀浦校区',
    capacity: 100,
    teacherIds: ['t-qinyuanshan'],
    meetings: [meeting(5, 5, 6, '犀浦校区 X3307')],
    note: null,
    updatedAt: DATA_UPDATED_AT,
  },
  {
    id: 's-microecon-01',
    sectionCode: 'SEC-JJ101-01',
    courseId: 'c-microecon',
    termId: 't-2026-1',
    campus: '犀浦校区',
    capacity: 80,
    teacherIds: ['t-songzhiwei'],
    meetings: [meeting(3, 5, 6, '犀浦校区 X7203')],
    note: null,
    updatedAt: DATA_UPDATED_AT,
  },
  {
    id: 's-modernchinese-01',
    sectionCode: 'SEC-ZW101-01',
    courseId: 'c-modernchinese',
    termId: 't-2026-1',
    campus: '九里校区',
    capacity: 60,
    teacherIds: ['t-hansongsheng'],
    meetings: [meeting(4, 3, 4, '九里校区 5-201')],
    note: null,
    updatedAt: DATA_UPDATED_AT,
  },
  {
    id: 's-discrete-01',
    sectionCode: 'SEC-LS201-01',
    courseId: 'c-discrete',
    termId: 't-2026-1',
    campus: '犀浦校区',
    capacity: 70,
    teacherIds: ['t-zhouyan'],
    meetings: [meeting(3, 1, 2, '犀浦校区 X1208')],
    note: null,
    updatedAt: DATA_UPDATED_AT,
  },
  {
    id: 's-discrete-02',
    sectionCode: 'SEC-LS201-02',
    courseId: 'c-discrete',
    termId: 't-2026-1',
    campus: '九里校区',
    capacity: 70,
    teacherIds: ['t-zhouyan'],
    meetings: [meeting(4, 5, 6, '九里校区 2-108')],
    note: null,
    updatedAt: DATA_UPDATED_AT,
  },
];

export const currentTerm = terms.find((term) => term.isCurrent)!;

export const departmentsById = new Map(departments.map((department) => [department.id, department]));
export const coursesById = new Map(courses.map((course) => [course.id, course]));
export const termsById = new Map(terms.map((term) => [term.id, term]));
export const teachersById = new Map(teachers.map((teacher) => [teacher.id, teacher]));
export const sectionsByTeacher = new Map<string, SeedSection[]>();
export const sectionsById = new Map(sections.map((section) => [section.id, section]));
export const reviewsById = new Map(reviews.map((review) => [review.id, review]));

for (const section of sections) {
  for (const teacherId of section.teacherIds) {
    const list = sectionsByTeacher.get(teacherId) ?? [];
    list.push(section);
    sectionsByTeacher.set(teacherId, list);
  }
}

export const publishedReviewCount = reviews.filter((review) => review.status === 'published').length;
