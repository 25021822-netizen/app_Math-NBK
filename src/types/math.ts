export type UserRole = 'student' | 'teacher' | 'admin';
export type AccountTier = 'free' | 'premium';

export type TeachingSubject = 'Toán Học' | 'Vật Lý' | 'Hóa Học';
export const TEACHING_SUBJECTS: TeachingSubject[] = ['Toán Học', 'Vật Lý', 'Hóa Học'];

export function resolveTeacherSubject(role: UserRole, subject?: string): TeachingSubject | null {
  if (role !== 'teacher') return null;
  const normalized = (subject || '').trim().toLowerCase();
  if (normalized.includes('hóa') || normalized.includes('hoa')) return 'Hóa Học';
  if (normalized.includes('lý') || normalized.includes('ly')) return 'Vật Lý';
  return 'Toán Học';
}

export function getTeacherSubjectTab(subject?: string): 'geometry' | 'physics_sim' | 'chemistry_lab' {
  const resolved = resolveTeacherSubject('teacher', subject);
  if (resolved === 'Hóa Học') return 'chemistry_lab';
  if (resolved === 'Vật Lý') return 'physics_sim';
  return 'geometry';
}

export function canAccessSubjectTab(tab: string, role: UserRole, subject?: string): boolean {
  if (role !== 'teacher') return true;
  const teacherSubject = resolveTeacherSubject(role, subject);
  if (tab === 'geometry') {
    return teacherSubject === 'Toán Học';
  }
  if (tab === 'physics_sim') {
    return teacherSubject === 'Vật Lý';
  }
  if (tab === 'chemistry_lab') {
    return teacherSubject === 'Hóa Học';
  }
  return true;
}

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  tier: AccountTier;
  xp: number;
  streakDays: number;
  lastActiveDate: string;
  dailyScanCount: number;
  maxDailyScans: number;
  grade: 10 | 11 | 12;
  avatar?: string;
  schoolName?: string;
  phone?: string;
  bio?: string;
  password?: string; // Mật khẩu đăng nhập tối thiểu 8 ký tự
  status?: 'active' | 'pending_approval' | 'rejected'; // Trạng thái tài khoản (phê duyệt bởi admin)
  requestedAt?: string; // Thời gian gửi yêu cầu đăng ký
  rejectionReason?: string; // Lý do từ chối nếu có
  subject?: string; // Tổ chuyên môn hoặc bộ môn giảng dạy (Toán Học | Vật Lý | Hóa Học)
}

export interface AutoApprovalSettings {
  enabled: boolean;
  autoApproveStudents: boolean;
  autoApproveTeachers: boolean;
  defaultTier: AccountTier;
  notifyAdminOnAutoApproval?: boolean;
}

export type MathTopic = 
  | 'algebra' 
  | 'geometry_plane' 
  | 'geometry_spatial' 
  | 'trigonometry' 
  | 'calculus' 
  | 'arithmetic_probability';

export interface SkillNode {
  id: string;
  grade: 10 | 11 | 12;
  topic: MathTopic;
  title: string;
  description: string;
  level: number;
  totalSteps: number;
  completedSteps: number;
  isLocked: boolean;
  xpReward: number;
  prerequisiteId?: string;
  coordinates: { x: number; y: number };
}

export type ExamPartType = 
  | 'part_1_mcq' 
  | 'part_2_true_false' 
  | 'part_3_short_answer';

export interface QuestionPart1MCQ {
  id: string;
  part: 'part_1_mcq';
  questionNumber: number;
  prompt: string;
  latex?: string;
  options: {
    key: 'A' | 'B' | 'C' | 'D';
    text: string;
    latex?: string;
    imageUrl?: string; // Ảnh cắt riêng của phương án A, B, C, D
  }[];
  correctAnswer: 'A' | 'B' | 'C' | 'D';
  explanation: string;
  points: number;
  imageAttachment?: string; // Dán/cắt file ảnh minh họa hoặc đề bài
  pdfAttachmentName?: string; // Tên file tài liệu / hình vẽ đính kèm
  pdfAttachmentUrl?: string;
  optionsAttachmentUrl?: string; // Ảnh cắt khối 4 đáp án A, B, C, D
}

export interface QuestionPart2TrueFalseItem {
  id: string;
  subKey: 'a' | 'b' | 'c' | 'd';
  text: string;
  latex?: string;
  isCorrect: boolean; // Giá trị chân lý đúng của mệnh đề
  imageUrl?: string; // Ảnh cắt riêng của từng mệnh đề a, b, c, d
}

export interface QuestionPart2TrueFalse {
  id: string;
  part: 'part_2_true_false';
  questionNumber: number;
  prompt: string;
  latex?: string;
  items: QuestionPart2TrueFalseItem[]; // 4 ý độc lập a, b, c, d
  explanation: string;
  points: number; // Tối đa 1.0 điểm theo quy tắc lũy tiến 0.1 -> 0.25 -> 0.5 -> 1.0
  imageAttachment?: string;
  pdfAttachmentName?: string;
  pdfAttachmentUrl?: string;
  optionsAttachmentUrl?: string; // Ảnh cắt khối 4 ý a, b, c, d
}

export interface QuestionPart3ShortAnswer {
  id: string;
  part: 'part_3_short_answer';
  questionNumber: number;
  prompt: string;
  latex?: string;
  correctAnswer: string; // Tối đa 4 ký tự/chữ số, hỗ trợ -, ,, /
  explanation: string;
  points: number;
  imageAttachment?: string;
  pdfAttachmentName?: string;
  pdfAttachmentUrl?: string;
  optionsAttachmentUrl?: string; // Ảnh cắt vùng đáp số / lời giải
}

// Chỉ gồm 3 phần thi trắc nghiệm khách quan chuẩn BGD (đã loại bỏ hoàn toàn tự luận)
export type Question = 
  | QuestionPart1MCQ 
  | QuestionPart2TrueFalse 
  | QuestionPart3ShortAnswer;

export type ScoreVisibilityMode = 'immediate' | 'after_close' | 'hidden';

export interface Exam {
  id: string;
  title: string;
  grade: 10 | 11 | 12;
  year: number;
  durationMinutes: number;
  totalPoints: number;
  status: 'draft' | 'approved' | 'archived';
  createdBy: string;
  teacherId?: string;
  createdById?: string;
  createdByEmail?: string;
  createdAt: string;
  questions: Question[];
  // Tính năng mới cho giáo viên
  maxAttempts?: number; // Giới hạn số lượt làm bài (1, 2, 3... hoặc 0/undefined là không giới hạn)
  openTime?: string; // Thời gian mở đề thi (YYYY-MM-DDTHH:mm)
  closeTime?: string; // Thời gian đóng đề thi (YYYY-MM-DDTHH:mm)
  distributionType?: 'classroom' | 'repository' | 'both'; // Giao cho nhóm lớp hoặc đưa vào kho tổng hợp
  targetClassIds?: string[]; // Danh sách nhóm lớp được giao đề
  allowViewAnswersAfterSubmit?: boolean; // Bật/tắt cho phép xem đáp án & lời giải chi tiết khi làm xong
  scoreVisibility?: ScoreVisibilityMode; // Cho biết điểm ngay ('immediate'), sau khi đóng/công bố ('after_close'), hoặc không cho biết điểm ('hidden')
  enableScreenMonitoring?: boolean; // Bật/tắt ô kiểm soát màn hình: bắt buộc toàn màn hình, cấm chuyển tab, ghi nhật ký rời màn hình
  maxInfractions?: number; // Số lần vi phạm tối đa trước khi tự động nộp bài (mặc định: 3)
}

export function canStudentViewExamScore(exam?: Exam | null, nowMs: number = Date.now()): boolean {
  if (!exam) return true;
  const mode: ScoreVisibilityMode = exam.scoreVisibility || 'immediate';
  if (mode === 'hidden') return false;
  if (mode === 'after_close') {
    if (!exam.closeTime) return false;
    const closeMs = new Date(exam.closeTime).getTime();
    return Number.isFinite(closeMs) && nowMs >= closeMs;
  }
  return true;
}

export function getExamScoreVisibilityLabel(mode?: ScoreVisibilityMode): string {
  if (mode === 'hidden') return 'Không cho biết điểm';
  if (mode === 'after_close') return 'Biết điểm sau';
  return 'Biết điểm ngay';
}

export interface ExamAttempt {
  id: string;
  examId: string;
  studentId: string;
  startTime: string;
  endTime?: string;
  answers: Record<string, any>;
  score?: number;
  partScores?: {
    part1: number;
    part2: number;
    part3: number;
    part4: number;
  };
  infractionCount: number;
  isDisqualified: boolean;
  status: 'in_progress' | 'submitted' | 'disqualified';
}

export interface CheatLog {
  id: string;
  examId: string;
  examTitle: string;
  studentId: string;
  studentName: string;
  timestamp: string;
  infractionNumber: number;
  event: 'app_state_blur' | 'visibility_hidden' | 'window_unfocus' | 'screen_capture';
  reason: string;
  actionTaken: 'warning_1' | 'warning_2' | 'auto_submitted_disqualified';
}

export interface Classroom {
  id: string;
  name: string;
  code: string;
  grade: 10 | 11 | 12;
  teacherId: string;
  teacherName: string;
  studentIds: string[];
  pendingStudentIds?: string[]; // Học sinh đang chờ giáo viên duyệt vào lớp
  requiresApproval?: boolean; // Chế độ duyệt thành viên
  visibility?: 'public' | 'private'; // 'public': Nhóm lớp công khai, 'private': Nhóm lớp cá nhân (chỉ thành viên trong nhóm mới nhìn thấy)
  assignedExamIds: string[];
  createdAt: string;
  description?: string;
}

export interface ClassroomLesson {
  id: string;
  classId: string;
  title: string;
  chapter: string; // Chuyên đề / Chương bài học
  description: string;
  theoryContent: string; // 1. Ô Bài học: Nội dung lý thuyết & trọng tâm kiến thức
  practiceContent?: string; // 2. Ô Luyện tập: Nội dung câu hỏi và bài tập rèn luyện (thay thế ô bài tập giao thêm)
  exercisesContent?: string; // Tương thích ngược
  content?: string; // Tương thích ngược
  teacherName: string;
  createdAt: string;
  publishedAt?: string; // Dấu thời gian ISO đầy đủ khi giáo viên đăng bài
  updatedAt?: string; // Thời gian cập nhật / chỉnh sửa gần nhất
  externalLink?: string; // Gắn link tài liệu trực tuyến (Google Drive, Youtube...)
  pdfAttachment?: {
    // File PDF gắn cho ô bài học (lý thuyết & bài giảng)
    fileName: string;
    fileSize: string; // Dung lượng (tối đa khoảng 10MB)
    fileData?: string; // Dữ liệu file PDF Data URL
    fileUrl?: string; // URL tải / xem file trực tiếp từ máy chủ
  };
  practicePdfAttachment?: {
    // File PDF gắn cho ô luyện tập
    fileName: string;
    fileSize: string; // Dung lượng (tối đa khoảng 10MB)
    fileData?: string; // Dữ liệu file PDF Data URL
    fileUrl?: string; // URL tải / xem file trực tiếp từ máy chủ
  };
  attachments?: {
    name: string;
    type: 'pdf' | 'image' | 'link';
    url: string;
    size?: string;
  }[];
  exercisesCount?: number; // Số câu luyện tập
  completedStudentIds?: string[];
}

export interface StudentExamSubmission {
  id: string;
  examId: string;
  examTitle: string;
  studentId: string;
  studentName: string;
  studentEmail: string;
  classId: string;
  submittedAt: string;
  score: number;
  partScores: {
    part1: number;
    part2: number;
    part3: number;
    part4?: number;
  };
  answers: Record<string, any>;
  infractionCount: number;
  isDisqualified: boolean;
  timeSpentSeconds: number;
}

// ==========================================
// CHAT TRONG NHÓM LỚP (GỬI ẢNH & TAG TÊN)
// ==========================================
export interface ChatMention {
  userId: string;
  userName: string;
}

export interface ChatReaction {
  emoji: string;
  count: number;
  userIds: string[];
}

export interface ClassroomChatMessage {
  id: string;
  classId: string;
  senderId: string;
  senderName: string;
  senderRole: UserRole;
  senderAvatar?: string;
  content: string;
  imageUrl?: string;
  mentions?: ChatMention[];
  reactions?: ChatReaction[];
  timestamp: string;
}

// ==========================================
// HỆ THỐNG KẾT BẠN QUA ID
// (GV - GV, HS - HS, GV - HS)
// ==========================================
export interface FriendRequest {
  id: string;
  fromUserId: string;
  fromUserName: string;
  fromUserRole: UserRole;
  fromUserEmail: string;
  fromUserAvatar?: string;
  toUserId: string;
  toUserName?: string;
  timestamp: string;
  status: 'pending' | 'accepted' | 'declined';
}

export interface FriendRelation {
  id: string;
  userId1: string;
  userId2: string;
  friendedAt: string;
}

export type BroadcastTargetAudience = 'all' | 'teacher' | 'student';

export type BroadcastCategory = 'general' | 'exam' | 'urgent' | 'maintenance' | 'event';

export interface AdminBroadcastMessage {
  id: string;
  title: string;
  content: string;
  senderId: string;
  senderName: string;
  priority?: 'normal' | 'important';
  category?: BroadcastCategory;
  targetAudience?: BroadcastTargetAudience;
  isPinned?: boolean;
  pinnedAt?: string;
  createdAt: string;
  deletedByUserIds: string[];
}

export function resolveBroadcastCategory(
  broadcast?: Pick<AdminBroadcastMessage, 'category' | 'priority'> | null
): BroadcastCategory {
  if (
    broadcast?.category === 'general' ||
    broadcast?.category === 'exam' ||
    broadcast?.category === 'urgent' ||
    broadcast?.category === 'maintenance' ||
    broadcast?.category === 'event'
  ) {
    return broadcast.category;
  }
  if (broadcast?.priority === 'important') {
    return 'urgent';
  }
  return 'general';
}

export const BROADCAST_CATEGORY_META: Record<
  BroadcastCategory,
  {
    label: string;
    shortLabel: string;
    cardBg: string;
    cardBorder: string;
    badgeClass: string;
    textClass: string;
    selectActiveClass: string;
    iconBgActiveClass: string;
  }
> = {
  general: {
    label: 'Thông báo chung',
    shortLabel: 'Chung',
    cardBg: 'bg-blue-50/70',
    cardBorder: 'border-blue-200',
    badgeClass: 'bg-blue-600 text-white',
    textClass: 'text-blue-700',
    selectActiveClass: 'bg-blue-50 border-blue-500 text-blue-900 ring-2 ring-blue-100',
    iconBgActiveClass: 'bg-blue-600 text-white',
  },
  exam: {
    label: 'Lịch thi & Kiểm tra',
    shortLabel: 'Lịch thi',
    cardBg: 'bg-violet-50/70',
    cardBorder: 'border-violet-200',
    badgeClass: 'bg-violet-600 text-white',
    textClass: 'text-violet-700',
    selectActiveClass: 'bg-violet-50 border-violet-500 text-violet-900 ring-2 ring-violet-100',
    iconBgActiveClass: 'bg-violet-600 text-white',
  },
  urgent: {
    label: 'Khẩn cấp / Quan trọng',
    shortLabel: 'Khẩn cấp',
    cardBg: 'bg-rose-50/80',
    cardBorder: 'border-rose-200',
    badgeClass: 'bg-rose-600 text-white',
    textClass: 'text-rose-700',
    selectActiveClass: 'bg-rose-50 border-rose-500 text-rose-900 ring-2 ring-rose-100',
    iconBgActiveClass: 'bg-rose-600 text-white',
  },
  maintenance: {
    label: 'Bảo trì & Hệ thống',
    shortLabel: 'Hệ thống',
    cardBg: 'bg-amber-50/80',
    cardBorder: 'border-amber-200',
    badgeClass: 'bg-amber-600 text-white',
    textClass: 'text-amber-800',
    selectActiveClass: 'bg-amber-50 border-amber-500 text-amber-900 ring-2 ring-amber-100',
    iconBgActiveClass: 'bg-amber-600 text-white',
  },
  event: {
    label: 'Sự kiện & Hoạt động',
    shortLabel: 'Sự kiện',
    cardBg: 'bg-emerald-50/70',
    cardBorder: 'border-emerald-200',
    badgeClass: 'bg-emerald-600 text-white',
    textClass: 'text-emerald-700',
    selectActiveClass: 'bg-emerald-50 border-emerald-500 text-emerald-900 ring-2 ring-emerald-100',
    iconBgActiveClass: 'bg-emerald-600 text-white',
  },
};

export function sortAdminBroadcasts(list: AdminBroadcastMessage[]): AdminBroadcastMessage[] {
  return [...list].sort((a, b) => {
    const pinA = a.isPinned ? 1 : 0;
    const pinB = b.isPinned ? 1 : 0;
    if (pinA !== pinB) return pinB - pinA;
    if (pinA === 1) {
      const pTimeA = new Date(a.pinnedAt || a.createdAt || 0).getTime();
      const pTimeB = new Date(b.pinnedAt || b.createdAt || 0).getTime();
      if (pTimeA !== pTimeB) return pTimeB - pTimeA;
    }
    return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
  });
}

export function isBroadcastVisibleToRole(
  broadcast: Pick<AdminBroadcastMessage, 'targetAudience'> | null | undefined,
  role: UserRole
): boolean {
  if (!broadcast) return false;
  if (role === 'admin') return true;
  const target = broadcast.targetAudience || 'all';
  if (target === 'all') return true;
  return target === role;
}

export function getBroadcastAudienceLabel(target?: BroadcastTargetAudience): string {
  if (target === 'teacher') return 'Chỉ Giáo viên';
  if (target === 'student') return 'Chỉ Học sinh';
  return 'Tất cả mọi người';
}


