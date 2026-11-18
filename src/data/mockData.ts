import {
  UserProfile,
  SkillNode,
  Exam,
  CheatLog,
  Classroom,
  ClassroomLesson,
  StudentExamSubmission,
  ClassroomChatMessage,
  FriendRequest,
  FriendRelation,
} from '../types/math';

export const SAMPLE_ADMIN: UserProfile = {
  id: '25021822',
  name: 'Ban Quản Trị Hệ Thống',
  email: 'daon36124@gmail.com',
  role: 'admin',
  tier: 'premium',
  xp: 15000,
  streakDays: 1,
  lastActiveDate: new Date().toISOString().split('T')[0],
  dailyScanCount: 0,
  maxDailyScans: 9999,
  grade: 12,
  avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=Admin25021822',
  schoolName: 'Toán Học LIKI',
  phone: '024 3858 1234',
  bio: 'Quản trị viên toàn quyền hệ thống Toán Học LIKI.',
  password: 'Anhhungxom8@',
  status: 'active',
};

export const DEFAULT_GUEST_USER: UserProfile = {
  id: '',
  name: 'Chưa Đăng Nhập',
  email: '',
  role: 'student',
  tier: 'free',
  xp: 0,
  streakDays: 0,
  lastActiveDate: new Date().toISOString().split('T')[0],
  dailyScanCount: 0,
  maxDailyScans: 10,
  grade: 12,
  avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=GuestNBK',
  schoolName: 'Toán Học LIKI',
  status: 'active',
};

export const INITIAL_USER_PROFILE: UserProfile = DEFAULT_GUEST_USER;

export const SAMPLE_SKILL_TREES: Record<10 | 11 | 12, SkillNode[]> = {
  12: [
    {
      id: 'g12_1',
      grade: 12,
      topic: 'calculus',
      title: 'Tính đơn điệu của hàm số',
      description: 'Quy tắc xét dấu đạo hàm f\'(x), các khoảng đồng biến nghịch biến.',
      level: 1,
      totalSteps: 5,
      completedSteps: 5,
      isLocked: false,
      xpReward: 50,
      coordinates: { x: 0, y: 0 },
    },
    {
      id: 'g12_2',
      grade: 12,
      topic: 'calculus',
      title: 'Cực trị của hàm số',
      description: 'Điều kiện cấp 1 và cấp 2, tìm tọa độ cực đại cực tiểu.',
      level: 2,
      totalSteps: 5,
      completedSteps: 3,
      isLocked: false,
      xpReward: 60,
      prerequisiteId: 'g12_1',
      coordinates: { x: 30, y: 1 },
    },
    {
      id: 'g12_3',
      grade: 12,
      topic: 'calculus',
      title: 'Giá trị lớn nhất & nhỏ nhất',
      description: 'Tìm GTLN, GTNN trên đoạn [a; b] và khoảng vô hạn.',
      level: 3,
      totalSteps: 4,
      completedSteps: 0,
      isLocked: false,
      xpReward: 70,
      prerequisiteId: 'g12_2',
      coordinates: { x: -25, y: 2 },
    },
    {
      id: 'g12_4',
      grade: 12,
      topic: 'calculus',
      title: 'Đường tiệm cận đồ thị',
      description: 'Tiệm cận đứng, tiệm cận ngang và tiệm cận xiên hàm phân thức.',
      level: 4,
      totalSteps: 5,
      completedSteps: 0,
      isLocked: true,
      xpReward: 80,
      prerequisiteId: 'g12_3',
      coordinates: { x: 20, y: 3 },
    },
    {
      id: 'g12_5',
      grade: 12,
      topic: 'geometry_spatial',
      title: 'Hệ tọa độ Oxyz trong không gian',
      description: 'Tọa độ vectơ, tích có hướng và khoảng cách điểm đến mặt phẳng.',
      level: 5,
      totalSteps: 6,
      completedSteps: 0,
      isLocked: true,
      xpReward: 100,
      prerequisiteId: 'g12_4',
      coordinates: { x: 0, y: 4 },
    },
  ],
  11: [
    {
      id: 'g11_1',
      grade: 11,
      topic: 'trigonometry',
      title: 'Hàm số lượng giác cơ bản',
      description: 'Tập xác định, chu kỳ và đồ thị y = sin x, y = cos x.',
      level: 1,
      totalSteps: 4,
      completedSteps: 4,
      isLocked: false,
      xpReward: 50,
      coordinates: { x: 0, y: 0 },
    },
    {
      id: 'g11_2',
      grade: 11,
      topic: 'trigonometry',
      title: 'Phương trình lượng giác',
      description: 'Giải các dạng sin x = m, cos x = m và phương trình bậc 2.',
      level: 2,
      totalSteps: 5,
      completedSteps: 2,
      isLocked: false,
      xpReward: 60,
      coordinates: { x: 25, y: 1 },
    },
    {
      id: 'g11_3',
      grade: 11,
      topic: 'geometry_spatial',
      title: 'Quan hệ vuông góc trong không gian',
      description: 'Đường thẳng vuông góc mặt phẳng, góc giữa hai mặt phẳng.',
      level: 3,
      totalSteps: 5,
      completedSteps: 0,
      isLocked: true,
      xpReward: 80,
      coordinates: { x: -20, y: 2 },
    },
  ],
  10: [
    {
      id: 'g10_1',
      grade: 10,
      topic: 'algebra',
      title: 'Mệnh đề và Tập hợp',
      description: 'Mệnh đề kéo theo, tương đương và các phép toán tập hợp.',
      level: 1,
      totalSteps: 4,
      completedSteps: 4,
      isLocked: false,
      xpReward: 50,
      coordinates: { x: 0, y: 0 },
    },
    {
      id: 'g10_2',
      grade: 10,
      topic: 'algebra',
      title: 'Bất phương trình bậc hai một ẩn',
      description: 'Định lý dấu tam thức bậc hai và ứng dụng giải bài toán thực tế.',
      level: 2,
      totalSteps: 5,
      completedSteps: 1,
      isLocked: false,
      xpReward: 60,
      coordinates: { x: 30, y: 1 },
    },
    {
      id: 'g10_3',
      grade: 10,
      topic: 'trigonometry',
      title: 'Hệ thức lượng trong tam giác',
      description: 'Định lý sin, định lý cosin và công thức tính diện tích Heron.',
      level: 3,
      totalSteps: 4,
      completedSteps: 0,
      isLocked: true,
      xpReward: 70,
      coordinates: { x: -15, y: 2 },
    },
  ],
};

export const SAMPLE_EXAMS: Exam[] = [];

// Toàn bộ dữ liệu đề thi cũ và câu hỏi mẫu đã được xóa sạch
export const SAMPLE_EXAM_BGD: Exam = {
  id: '',
  title: '',
  grade: 12,
  year: 2025,
  durationMinutes: 90,
  totalPoints: 10,
  status: 'draft',
  createdBy: '',
  createdAt: '',
  questions: [],
};

export const SAMPLE_CHEAT_LOGS: CheatLog[] = [];

// ==========================================
// TÀI KHOẢN HỆ THỐNG: DUY NHẤT 1 TÀI KHOẢN QUẢN TRỊ ADMIN CÓ SẴN
// Tất cả tài khoản Giáo viên và Học sinh sẽ được người dùng tự đăng ký và Admin phê duyệt.
// ==========================================
export const SAMPLE_STUDENTS: UserProfile[] = [];

export const SAMPLE_TEACHERS: UserProfile[] = [];

export const SAMPLE_PENDING_REGISTRATIONS: UserProfile[] = [];

// Khởi tạo danh sách người dùng hệ thống: DUY NHẤT 1 TÀI KHOẢN ADMIN
export const INITIAL_ALL_USERS: UserProfile[] = [
  { ...SAMPLE_ADMIN, status: 'active' },
];

export const ALL_INITIAL_USERS: UserProfile[] = INITIAL_ALL_USERS;

// ==========================================
// NHÓM LỚP, BÀI NỘP, BÀI HỌC & TIN NHẮN (KHỞI TẠO RỖNG SẠCH SẼ)
// ==========================================
export const SAMPLE_CLASSROOMS: Classroom[] = [];

export const SAMPLE_SUBMISSIONS: StudentExamSubmission[] = [];

export const INITIAL_CLASSROOM_MESSAGES: Record<string, ClassroomChatMessage[]> = {};

export const INITIAL_FRIEND_RELATIONS: FriendRelation[] = [];

export const INITIAL_FRIEND_REQUESTS: FriendRequest[] = [];

export const SAMPLE_CLASSROOM_LESSONS: ClassroomLesson[] = [];
