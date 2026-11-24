import type { Exam, StudentExamSubmission } from '../types/math';

/**
 * Bộ công cụ chấm điểm tự động & Chuẩn hóa đáp án Toán THPT
 * Theo định dạng đề thi mới của Bộ Giáo dục & Đào tạo (Áp dụng từ năm 2025)
 */

/**
 * 1. Chấm điểm Phần II: Câu hỏi Đúng/Sai gồm 4 ý độc lập a, b, c, d
 * Quy tắc tính điểm lũy tiến BGD:
 * - Đúng 1 ý: 0.10 điểm
 * - Đúng 2 ý: 0.25 điểm
 * - Đúng 3 ý: 0.50 điểm
 * - Đúng 4 ý: 1.00 điểm
 * - Đúng 0 ý: 0.00 điểm
 */
export function gradePart2TrueFalse(
  studentAnswers: Record<'a' | 'b' | 'c' | 'd', boolean | null | undefined>,
  correctAnswers: Record<'a' | 'b' | 'c' | 'd', boolean>
): {
  correctCount: number;
  earnedPoints: number;
  details: Record<'a' | 'b' | 'c' | 'd', boolean>;
} {
  const keys: ('a' | 'b' | 'c' | 'd')[] = ['a', 'b', 'c', 'd'];
  let correctCount = 0;
  const details = {
    a: false,
    b: false,
    c: false,
    d: false,
  };

  for (const key of keys) {
    const isMatch = studentAnswers[key] === correctAnswers[key];
    details[key] = isMatch;
    if (isMatch) {
      correctCount++;
    }
  }

  let earnedPoints = 0;
  switch (correctCount) {
    case 1:
      earnedPoints = 0.1;
      break;
    case 2:
      earnedPoints = 0.25;
      break;
    case 3:
      earnedPoints = 0.5;
      break;
    case 4:
      earnedPoints = 1.0;
      break;
    default:
      earnedPoints = 0.0;
  }

  return {
    correctCount,
    earnedPoints,
    details,
  };
}

/**
 * 2. Kiểm tra tính hợp lệ của câu trả lời ngắn Phần III
 * Quy định BGD:
 * - Độ dài tối đa 4 ký tự/chữ số
 * - Chỉ chấp nhận các ký tự: số [0-9], dấu âm [-], dấu phẩy/chấm [, .], dấu gạch chéo [/]
 * - Ví dụ hợp lệ: "-2/3", "3,14", "12", "-0,5", "4"
 */
export function validatePart3ShortAnswerFormat(rawAnswer: string): {
  isValidFormat: boolean;
  sanitized: string;
  errorMessage?: string;
} {
  const sanitized = rawAnswer.trim().replace(/\s+/g, '');

  if (sanitized.length === 0) {
    return { isValidFormat: false, sanitized: '', errorMessage: 'Chưa nhập đáp án' };
  }

  if (sanitized.length > 4) {
    return {
      isValidFormat: false,
      sanitized,
      errorMessage: `Độ dài vượt quá 4 ký tự (hiện tại: ${sanitized.length})`,
    };
  }

  // Regex cho phép ký tự số, dấu trừ, dấu phẩy, dấu chấm, dấu gạch chéo
  const allowedPattern = /^[-0-9,\.\/]+$/;
  if (!allowedPattern.test(sanitized)) {
    return {
      isValidFormat: false,
      sanitized,
      errorMessage: 'Chứa ký tự không hợp lệ. Chỉ cho phép số và các dấu -, ,, ., /',
    };
  }

  return { isValidFormat: true, sanitized };
}

/**
 * 3. Chuẩn hóa giá trị số học / phân số tự động (Dùng cho Phần III và Phần IV)
 * Thuật toán quy đổi:
 * - Thay thế dấu phẩy thập phân ',' của tiếng Việt thành '.'
 * - Phân tích phân số 'a/b' thành giá trị số thực
 * - Chuyển đổi phần trăm 'x%' -> x / 100
 * - So sánh sai số epsilon (1e-4) để chấp nhận các cách viết tương đương:
 *   Ví dụ: "1/2" == "0.5" == "0,5" == "2/4"
 */
export function parseNumericValue(input: string): number | null {
  if (!input) return null;
  let clean = input.trim().toLowerCase().replace(/\s+/g, '');

  // Xử lý dấu phẩy thập phân kiểu Việt Nam
  clean = clean.replace(/,/g, '.');

  // Kiểm tra phần trăm
  if (clean.endsWith('%')) {
    const numPart = parseFloat(clean.slice(0, -1));
    return isNaN(numPart) ? null : numPart / 100;
  }

  // Kiểm tra phân số dạng a/b hoặc -a/b
  if (clean.includes('/')) {
    const parts = clean.split('/');
    if (parts.length === 2) {
      const numerator = parseFloat(parts[0]);
      const denominator = parseFloat(parts[1]);
      if (!isNaN(numerator) && !isNaN(denominator) && denominator !== 0) {
        return numerator / denominator;
      }
    }
  }

  // Xử lý số thực thông thường
  const directNum = parseFloat(clean);
  return isNaN(directNum) ? null : directNum;
}

/**
 * So sánh đáp án của học sinh với đáp án chuẩn
 */
export function isAnswerEquivalent(
  studentAnswer: string,
  correctAnswer: string,
  acceptedVariants: string[] = []
): boolean {
  if (!studentAnswer || !correctAnswer) return false;

  const cleanStudent = studentAnswer.trim().toLowerCase().replace(/\s+/g, '').replace(/,/g, '.');
  const cleanCorrect = correctAnswer.trim().toLowerCase().replace(/\s+/g, '').replace(/,/g, '.');

  // 1. So sánh trực tiếp chuỗi đã chuẩn hóa
  if (cleanStudent === cleanCorrect) return true;

  // 2. Kiểm tra trong danh sách các biến thể chấp nhận
  for (const variant of acceptedVariants) {
    const cleanVariant = variant.trim().toLowerCase().replace(/\s+/g, '').replace(/,/g, '.');
    if (cleanStudent === cleanVariant) return true;
  }

  // 3. So sánh giá trị số thực với ngưỡng sai số epsilon
  const studentNum = parseNumericValue(cleanStudent);
  const correctNum = parseNumericValue(cleanCorrect);

  if (studentNum !== null && correctNum !== null) {
    const epsilon = 1e-4;
    return Math.abs(studentNum - correctNum) < epsilon;
  }

  return false;
}

/**
 * 4. Thang điểm động theo từng đề thi & Thống kê kết quả học sinh
 */
export interface ExamScaleInfo {
  totalPoints: number;
  part1Max: number;
  part2Max: number;
  part3Max: number;
}

export type ScoreRankKey = 'excellent' | 'good' | 'average' | 'below';

export interface GradebookAnalytics {
  total: number;
  average: number;
  rawAverage: number;
  max: number;
  min: number;
  maxSubmissionScale: number;
  minSubmissionScale: number;
  averagePercent: number;
  maxPercent: number;
  minPercent: number;
  scalePoints: number;
  isUniformScale: boolean;
  distinctScales: number[];
  excellentCount: number;
  goodCount: number;
  averageCount: number;
  belowCount: number;
  cheatingCount: number;
  thresholds: {
    excellentMin: number;
    goodMin: number;
    averageMin: number;
  };
}

export function formatPointsNumber(value: number): string {
  const rounded = Number((value || 0).toFixed(2));
  return Number.isInteger(rounded) ? String(rounded) : rounded.toString();
}

export function getExamScaleInfo(exam?: Exam | null, fallbackScore?: number): ExamScaleInfo {
  if (!exam) {
    const fallbackTotal =
      typeof fallbackScore === 'number' && fallbackScore > 10 ? Math.ceil(fallbackScore) : 10;
    return {
      totalPoints: fallbackTotal,
      part1Max: Number((fallbackTotal * 0.3).toFixed(2)),
      part2Max: Number((fallbackTotal * 0.4).toFixed(2)),
      part3Max: Number((fallbackTotal * 0.3).toFixed(2)),
    };
  }

  const questions = Array.isArray(exam.questions) ? exam.questions : [];
  if (questions.length > 0) {
    let part1Max = 0;
    let part2Max = 0;
    let part3Max = 0;
    questions.forEach((q) => {
      if (q.part === 'part_1_mcq') {
        part1Max += q.points || 0.25;
      } else if (q.part === 'part_2_true_false') {
        part2Max += q.points || 1.0;
      } else if (q.part === 'part_3_short_answer') {
        part3Max += q.points || 0.5;
      }
    });
    const sumFromQuestions = Number((part1Max + part2Max + part3Max).toFixed(2));
    const totalPoints =
      sumFromQuestions > 0
        ? sumFromQuestions
        : exam.totalPoints > 0
        ? Number(exam.totalPoints.toFixed(2))
        : 10;
    return {
      totalPoints,
      part1Max: Number(part1Max.toFixed(2)),
      part2Max: Number(part2Max.toFixed(2)),
      part3Max: Number(part3Max.toFixed(2)),
    };
  }

  const fallbackTotal = exam.totalPoints > 0 ? Number(exam.totalPoints.toFixed(2)) : 10;
  return {
    totalPoints: fallbackTotal,
    part1Max: Number((fallbackTotal * 0.3).toFixed(2)),
    part2Max: Number((fallbackTotal * 0.4).toFixed(2)),
    part3Max: Number((fallbackTotal * 0.3).toFixed(2)),
  };
}

export function getSubmissionScalePoints(
  submission: Pick<StudentExamSubmission, 'examId' | 'score'>,
  examsList: Exam[]
): number {
  const exam = examsList.find((e) => e.id === submission.examId) || null;
  return getExamScaleInfo(exam, submission.score).totalPoints;
}

export function classifyScoreByScale(
  score: number,
  maxPoints: number
): {
  key: ScoreRankKey;
  label: 'Giỏi' | 'Khá' | 'Trung bình' | 'Yếu';
  percent: number;
} {
  const safeMax = maxPoints > 0 ? maxPoints : 10;
  const ratio = Math.max(0, score / safeMax);
  const percent = Number((ratio * 100).toFixed(1));

  if (ratio >= 0.8 - 1e-6) {
    return { key: 'excellent', label: 'Giỏi', percent };
  }
  if (ratio >= 0.65 - 1e-6) {
    return { key: 'good', label: 'Khá', percent };
  }
  if (ratio >= 0.5 - 1e-6) {
    return { key: 'average', label: 'Trung bình', percent };
  }
  return { key: 'below', label: 'Yếu', percent };
}

export function computeGradebookAnalytics(
  submissions: StudentExamSubmission[],
  examsList: Exam[],
  selectedExamId?: string
): GradebookAnalytics {
  const selectedExam =
    selectedExamId && selectedExamId !== 'all'
      ? examsList.find((e) => e.id === selectedExamId) || null
      : null;

  if (submissions.length === 0) {
    const defaultScale = selectedExam ? getExamScaleInfo(selectedExam).totalPoints : 10;
    return {
      total: 0,
      average: 0,
      rawAverage: 0,
      max: 0,
      min: 0,
      maxSubmissionScale: defaultScale,
      minSubmissionScale: defaultScale,
      averagePercent: 0,
      maxPercent: 0,
      minPercent: 0,
      scalePoints: defaultScale,
      isUniformScale: true,
      distinctScales: [defaultScale],
      excellentCount: 0,
      goodCount: 0,
      averageCount: 0,
      belowCount: 0,
      cheatingCount: 0,
      thresholds: {
        excellentMin: Number((defaultScale * 0.8).toFixed(2)),
        goodMin: Number((defaultScale * 0.65).toFixed(2)),
        averageMin: Number((defaultScale * 0.5).toFixed(2)),
      },
    };
  }

  const enriched = submissions.map((sub) => {
    const scale = getSubmissionScalePoints(sub, examsList);
    const ratio = scale > 0 ? sub.score / scale : 0;
    const rank = classifyScoreByScale(sub.score, scale);
    return { sub, scale, ratio, rank };
  });

  const distinctScales = Array.from(new Set(enriched.map((item) => item.scale))).sort((a, b) => a - b);
  const isUniformScale = distinctScales.length === 1;
  const scalePoints = isUniformScale ? distinctScales[0] : 10;

  const rawSum = enriched.reduce((acc, item) => acc + item.sub.score, 0);
  const rawAverage = Number((rawSum / enriched.length).toFixed(2));
  const avgRatio = enriched.reduce((acc, item) => acc + item.ratio, 0) / enriched.length;
  const averagePercent = Number((avgRatio * 100).toFixed(1));
  const normalizedAvg10 = Number((avgRatio * 10).toFixed(2));

  let maxItem = enriched[0];
  let minItem = enriched[0];
  enriched.forEach((item) => {
    const cmpValue = isUniformScale ? item.sub.score : item.ratio;
    const curMaxValue = isUniformScale ? maxItem.sub.score : maxItem.ratio;
    const curMinValue = isUniformScale ? minItem.sub.score : minItem.ratio;
    if (cmpValue > curMaxValue) maxItem = item;
    if (cmpValue < curMinValue) minItem = item;
  });

  const excellentCount = enriched.filter((i) => i.rank.key === 'excellent').length;
  const goodCount = enriched.filter((i) => i.rank.key === 'good').length;
  const averageCount = enriched.filter((i) => i.rank.key === 'average').length;
  const belowCount = enriched.filter((i) => i.rank.key === 'below').length;
  const cheatingCount = submissions.filter((s) => s.infractionCount > 0 || s.isDisqualified).length;

  return {
    total: submissions.length,
    average: isUniformScale ? rawAverage : normalizedAvg10,
    rawAverage,
    max: maxItem.sub.score,
    min: minItem.sub.score,
    maxSubmissionScale: maxItem.scale,
    minSubmissionScale: minItem.scale,
    averagePercent,
    maxPercent: Number((maxItem.ratio * 100).toFixed(1)),
    minPercent: Number((minItem.ratio * 100).toFixed(1)),
    scalePoints,
    isUniformScale,
    distinctScales,
    excellentCount,
    goodCount,
    averageCount,
    belowCount,
    cheatingCount,
    thresholds: {
      excellentMin: Number((scalePoints * 0.8).toFixed(2)),
      goodMin: Number((scalePoints * 0.65).toFixed(2)),
      averageMin: Number((scalePoints * 0.5).toFixed(2)),
    },
  };
}

/**
 * 5. Thống kê đáp án đưa ra của từng câu (Số bạn làm đúng / sai / bỏ trống)
 */
export interface QuestionOptionStat {
  key: string;
  label: string;
  count: number;
  percent: number;
  isCorrect: boolean;
}

export interface TrueFalseSubItemStat {
  subKey: 'a' | 'b' | 'c' | 'd';
  expected: 'Đ' | 'S';
  correctCount: number;
  wrongCount: number;
  unansweredCount: number;
  choseTrueCount: number;
  choseFalseCount: number;
}

export interface ExamQuestionStatItem {
  questionId: string;
  questionNumber: number;
  part: 'part_1_mcq' | 'part_2_true_false' | 'part_3_short_answer' | 'unknown';
  partLabel: string;
  prompt: string;
  points: number;
  correctAnswerDisplay: string;
  totalSubmissions: number;
  correctCount: number;
  partialCount: number;
  wrongCount: number;
  unansweredCount: number;
  correctRate: number;
  optionStats: QuestionOptionStat[];
  tfSubItems?: TrueFalseSubItemStat[];
}

export interface ExamQuestionStatGroup {
  examId: string;
  examTitle: string;
  totalPoints: number;
  submissionCount: number;
  hasExamDefinition: boolean;
  questions: ExamQuestionStatItem[];
}

const formatTFStatVal = (val: unknown): 'Đ' | 'S' | '—' => {
  if (val === undefined || val === null || val === '') return '—';
  if (val === true || val === 'true' || val === 'Đ') return 'Đ';
  if (val === false || val === 'false' || val === 'S') return 'S';
  return '—';
};

export function computeExamQuestionStats(
  submissions: StudentExamSubmission[],
  examsList: Exam[]
): ExamQuestionStatGroup[] {
  if (submissions.length === 0) return [];

  const groupedByExam = new Map<string, StudentExamSubmission[]>();
  submissions.forEach((sub) => {
    const list = groupedByExam.get(sub.examId) || [];
    list.push(sub);
    groupedByExam.set(sub.examId, list);
  });

  const groups: ExamQuestionStatGroup[] = [];

  groupedByExam.forEach((examSubs, examId) => {
    const exam = examsList.find((e) => e.id === examId) || null;
    const totalSubs = examSubs.length;

    if (exam && Array.isArray(exam.questions) && exam.questions.length > 0) {
      const scaleInfo = getExamScaleInfo(exam);
      const sortedQuestions = [...exam.questions].sort((a, b) => a.questionNumber - b.questionNumber);

      const questionStats: ExamQuestionStatItem[] = sortedQuestions.map((q) => {
        if (q.part === 'part_1_mcq') {
          const optionCounts = new Map<string, number>();
          const baseKeys = ['A', 'B', 'C', 'D'];
          baseKeys.forEach((k) => optionCounts.set(k, 0));

          let correctCount = 0;
          let wrongCount = 0;
          let unansweredCount = 0;

          examSubs.forEach((sub) => {
            const raw = sub.answers?.[q.id];
            const clean = raw !== undefined && raw !== null ? String(raw).trim().toUpperCase() : '';
            if (!clean) {
              unansweredCount += 1;
              return;
            }
            optionCounts.set(clean, (optionCounts.get(clean) || 0) + 1);
            if (clean === q.correctAnswer) {
              correctCount += 1;
            } else {
              wrongCount += 1;
            }
          });

          const optionStats: QuestionOptionStat[] = Array.from(optionCounts.entries()).map(
            ([optKey, count]) => ({
              key: optKey,
              label: optKey,
              count,
              percent: totalSubs > 0 ? Number(((count / totalSubs) * 100).toFixed(1)) : 0,
              isCorrect: optKey === q.correctAnswer,
            })
          );

          if (unansweredCount > 0) {
            optionStats.push({
              key: '__blank__',
              label: 'Bỏ trống',
              count: unansweredCount,
              percent: Number(((unansweredCount / totalSubs) * 100).toFixed(1)),
              isCorrect: false,
            });
          }

          return {
            questionId: q.id,
            questionNumber: q.questionNumber,
            part: 'part_1_mcq',
            partLabel: 'P.I (MCQ)',
            prompt: q.prompt,
            points: q.points || 0.25,
            correctAnswerDisplay: q.correctAnswer,
            totalSubmissions: totalSubs,
            correctCount,
            partialCount: 0,
            wrongCount,
            unansweredCount,
            correctRate: totalSubs > 0 ? Number(((correctCount / totalSubs) * 100).toFixed(1)) : 0,
            optionStats,
          };
        }

        if (q.part === 'part_2_true_false') {
          const items = Array.isArray(q.items) && q.items.length > 0 ? q.items : [];
          const subKeys: ('a' | 'b' | 'c' | 'd')[] =
            items.length > 0 ? items.map((it) => it.subKey) : ['a', 'b', 'c', 'd'];

          let correctCount = 0;
          let partialCount = 0;
          let wrongCount = 0;
          let unansweredCount = 0;

          const subTracker: Record<'a' | 'b' | 'c' | 'd', TrueFalseSubItemStat> = {
            a: { subKey: 'a', expected: 'Đ', correctCount: 0, wrongCount: 0, unansweredCount: 0, choseTrueCount: 0, choseFalseCount: 0 },
            b: { subKey: 'b', expected: 'Đ', correctCount: 0, wrongCount: 0, unansweredCount: 0, choseTrueCount: 0, choseFalseCount: 0 },
            c: { subKey: 'c', expected: 'Đ', correctCount: 0, wrongCount: 0, unansweredCount: 0, choseTrueCount: 0, choseFalseCount: 0 },
            d: { subKey: 'd', expected: 'Đ', correctCount: 0, wrongCount: 0, unansweredCount: 0, choseTrueCount: 0, choseFalseCount: 0 },
          };

          subKeys.forEach((sk) => {
            const def = items.find((it) => it.subKey === sk);
            subTracker[sk].expected = def?.isCorrect ? 'Đ' : 'S';
          });

          examSubs.forEach((sub) => {
            let answeredInSub = 0;
            let matchedInSub = 0;

            subKeys.forEach((sk) => {
              const fmt = formatTFStatVal(sub.answers?.[`${q.id}_${sk}`]);
              const expected = subTracker[sk].expected;
              if (fmt === '—') {
                subTracker[sk].unansweredCount += 1;
              } else {
                answeredInSub += 1;
                if (fmt === 'Đ') subTracker[sk].choseTrueCount += 1;
                else subTracker[sk].choseFalseCount += 1;

                if (fmt === expected) {
                  matchedInSub += 1;
                  subTracker[sk].correctCount += 1;
                } else {
                  subTracker[sk].wrongCount += 1;
                }
              }
            });

            if (answeredInSub === 0) {
              unansweredCount += 1;
            } else if (matchedInSub === subKeys.length) {
              correctCount += 1;
            } else if (matchedInSub > 0) {
              partialCount += 1;
            } else {
              wrongCount += 1;
            }
          });

          const tfSubItems = subKeys.map((sk) => subTracker[sk]);
          const correctAnswerDisplay = tfSubItems.map((it) => `${it.subKey}:${it.expected}`).join(' ');

          const optionStats: QuestionOptionStat[] = tfSubItems.map((it) => ({
            key: it.subKey,
            label: `${it.subKey} (${it.expected}): Đ=${it.choseTrueCount} · S=${it.choseFalseCount}`,
            count: it.correctCount,
            percent: totalSubs > 0 ? Number(((it.correctCount / totalSubs) * 100).toFixed(1)) : 0,
            isCorrect: true,
          }));

          return {
            questionId: q.id,
            questionNumber: q.questionNumber,
            part: 'part_2_true_false',
            partLabel: 'P.II (Đ/S)',
            prompt: q.prompt,
            points: q.points || 1.0,
            correctAnswerDisplay,
            totalSubmissions: totalSubs,
            correctCount,
            partialCount,
            wrongCount,
            unansweredCount,
            correctRate: totalSubs > 0 ? Number(((correctCount / totalSubs) * 100).toFixed(1)) : 0,
            optionStats,
            tfSubItems,
          };
        }

        // Part 3: Trả lời ngắn
        let correctCount = 0;
        let wrongCount = 0;
        let unansweredCount = 0;
        const answerBuckets = new Map<string, { label: string; count: number; isCorrect: boolean }>();

        examSubs.forEach((sub) => {
          const raw = sub.answers?.[q.id];
          const trimmed = raw !== undefined && raw !== null ? String(raw).trim() : '';
          if (!trimmed) {
            unansweredCount += 1;
            return;
          }
          const isMatch = isAnswerEquivalent(trimmed, q.correctAnswer);
          if (isMatch) correctCount += 1;
          else wrongCount += 1;

          const bucketKey = trimmed.toLowerCase().replace(/\s+/g, '');
          const existing = answerBuckets.get(bucketKey);
          if (existing) {
            existing.count += 1;
            if (isMatch) existing.isCorrect = true;
          } else {
            answerBuckets.set(bucketKey, { label: trimmed, count: 1, isCorrect: isMatch });
          }
        });

        const optionStats: QuestionOptionStat[] = Array.from(answerBuckets.entries())
          .sort((a, b) => {
            if (a[1].isCorrect !== b[1].isCorrect) return a[1].isCorrect ? -1 : 1;
            return b[1].count - a[1].count;
          })
          .map(([key, bucket]) => ({
            key,
            label: bucket.label,
            count: bucket.count,
            percent: totalSubs > 0 ? Number(((bucket.count / totalSubs) * 100).toFixed(1)) : 0,
            isCorrect: bucket.isCorrect,
          }));

        if (unansweredCount > 0) {
          optionStats.push({
            key: '__blank__',
            label: 'Bỏ trống',
            count: unansweredCount,
            percent: Number(((unansweredCount / totalSubs) * 100).toFixed(1)),
            isCorrect: false,
          });
        }

        return {
          questionId: q.id,
          questionNumber: q.questionNumber,
          part: 'part_3_short_answer',
          partLabel: 'P.III (Ngắn)',
          prompt: q.prompt,
          points: q.points || 0.5,
          correctAnswerDisplay: q.correctAnswer || '—',
          totalSubmissions: totalSubs,
          correctCount,
          partialCount: 0,
          wrongCount,
          unansweredCount,
          correctRate: totalSubs > 0 ? Number(((correctCount / totalSubs) * 100).toFixed(1)) : 0,
          optionStats,
        };
      });

      groups.push({
        examId,
        examTitle: exam.title,
        totalPoints: scaleInfo.totalPoints,
        submissionCount: totalSubs,
        hasExamDefinition: true,
        questions: questionStats,
      });
    } else {
      // Đề gốc không còn trong hệ thống: tổng hợp đáp án theo key có trong sub.answers
      const keySet = new Set<string>();
      examSubs.forEach((sub) => {
        Object.keys(sub.answers || {}).forEach((k) => {
          const tfMatch = k.match(/^(.+)_([abcd])$/);
          keySet.add(tfMatch ? tfMatch[1] : k);
        });
      });

      const sampleSub = examSubs[0];
      const fallbackScale = getSubmissionScalePoints(sampleSub, examsList);
      const questionStats: ExamQuestionStatItem[] = Array.from(keySet)
        .map((baseKey, idx) => {
          const numMatch = baseKey.match(/(\d+)$/);
          const qNum = numMatch ? Number(numMatch[1]) : idx + 1;
          const buckets = new Map<string, number>();
          let unansweredCount = 0;

          examSubs.forEach((sub) => {
            const raw = sub.answers?.[baseKey];
            const val = raw !== undefined && raw !== null ? String(raw).trim() : '';
            if (!val) unansweredCount += 1;
            else buckets.set(val, (buckets.get(val) || 0) + 1);
          });

          const optionStats: QuestionOptionStat[] = Array.from(buckets.entries())
            .sort((a, b) => b[1] - a[1])
            .map(([label, count]) => ({
              key: label,
              label,
              count,
              percent: Number(((count / totalSubs) * 100).toFixed(1)),
              isCorrect: false,
            }));

          return {
            questionId: baseKey,
            questionNumber: qNum,
            part: 'unknown' as const,
            partLabel: 'Câu hỏi',
            prompt: '',
            points: 0,
            correctAnswerDisplay: 'Đề gốc đã xóa',
            totalSubmissions: totalSubs,
            correctCount: 0,
            partialCount: 0,
            wrongCount: 0,
            unansweredCount,
            correctRate: 0,
            optionStats,
          };
        })
        .sort((a, b) => a.questionNumber - b.questionNumber);

      groups.push({
        examId,
        examTitle: sampleSub?.examTitle || 'Đề thi đã xóa',
        totalPoints: fallbackScale,
        submissionCount: totalSubs,
        hasExamDefinition: false,
        questions: questionStats,
      });
    }
  });

  return groups;
}

