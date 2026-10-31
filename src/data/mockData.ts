import {
  UserProfile,
  SkillNode,
  Exam,
  ScanResult,
  CheatLog,
  Classroom,
  ClassroomLesson,
  StudentExamSubmission,
  ClassroomChatMessage,
  FriendRequest,
  FriendRelation,
  SocraticMessage,
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
  schoolName: 'Toán Thầy Nguyễn Bá Kỳ',
  phone: '024 3858 1234',
  bio: 'Quản trị viên toàn quyền hệ thống Math&NBK.',
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
  schoolName: 'Toán Thầy Nguyễn Bá Kỳ',
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

export const SAMPLE_OCR_PROBLEMS: {
  id: string;
  title: string;
  category: string;
  imagePreviewText: string;
  latex: string;
  difficulty: 'Nhận biết' | 'Thông hiểu' | 'Vận dụng' | 'Vận dụng cao';
  solution: ScanResult;
}[] = [
  {
    id: 'sample_1',
    title: 'Tích phân từng phần',
    category: 'Giải tích 12',
    imagePreviewText: '∫ [0 → π/2] x · sin(x) dx',
    latex: '\\int_{0}^{\\frac{\\pi}{2}} x \\sin(x) \\, dx',
    difficulty: 'Thông hiểu',
    solution: {
      problemText: 'Tính tích phân xác định: I = ∫_0^(π/2) x sin(x) dx',
      latexFormula: '\\int_{0}^{\\frac{\\pi}{2}} x \\sin(x) \\, dx',
      topic: 'calculus',
      difficulty: 'Thông hiểu',
      stepByStepSolution: [
        {
          stepNumber: 1,
          title: 'Đặt biến tích phân từng phần',
          description: 'Sử dụng quy tắc ưu tiên Lôgarit - Đa thức - Lượng giác - Mũ.',
          latex: 'u = x \\implies du = dx; \\quad dv = \\sin(x)dx \\implies v = -\\cos(x)',
        },
        {
          stepNumber: 2,
          title: 'Áp dụng công thức I = u·v - ∫ v du',
          description: 'Thay các đại lượng đã tính vào biểu thức tích phân từng phần.',
          latex: 'I = \\left[ -x \\cos(x) \\right]_0^{\\frac{\\pi}{2}} - \\int_0^{\\frac{\\pi}{2}} (-\\cos(x)) dx',
        },
        {
          stepNumber: 3,
          title: 'Thế cận và tính tích phân còn lại',
          description: 'Vì cos(π/2) = 0 và cos(0) = 1 nên hạng tử đầu bằng 0.',
          latex: 'I = 0 + \\left[ \\sin(x) \\right]_0^{\\frac{\\pi}{2}} = \\sin\\left(\\frac{\\pi}{2}\\right) - \\sin(0) = 1',
        },
      ],
      finalAnswer: 'I = 1',
      source: 'cache',
      processingTimeMs: 42,
    },
  },
  {
    id: 'sample_2',
    title: 'Cực trị hàm phân thức bậc 2 trên bậc 1',
    category: 'Đại số & Giải tích 12',
    imagePreviewText: 'y = (x² - 2x + 2) / (x - 1)',
    latex: 'y = \\frac{x^2 - 2x + 2}{x - 1}',
    difficulty: 'Vận dụng',
    solution: {
      problemText: 'Tìm điểm cực trị của đồ thị hàm số y = (x² - 2x + 2) / (x - 1)',
      latexFormula: 'y = \\frac{x^2 - 2x + 2}{x - 1}',
      topic: 'calculus',
      difficulty: 'Vận dụng',
      stepByStepSolution: [
        {
          stepNumber: 1,
          title: 'Tập xác định & tính đạo hàm y\'',
          description: 'Điều kiện xác định x ≠ 1. Áp dụng công thức (u/v)\' = (u\'v - uv\') / v².',
          latex: 'y\' = \\frac{(2x - 2)(x - 1) - (x^2 - 2x + 2)}{(x - 1)^2} = \\frac{x^2 - 2x}{(x - 1)^2}',
        },
        {
          stepNumber: 2,
          title: 'Giải phương trình đạo hàm y\' = 0',
          description: 'Tử thức x² - 2x = 0 cho hai nghiệm phân biệt.',
          latex: 'y\' = 0 \\iff x(x - 2) = 0 \\iff \\begin{cases} x = 0 \\implies y = -2 \\\\ x = 2 \\implies y = 2 \\end{cases}',
        },
        {
          stepNumber: 3,
          title: 'Lập bảng xét dấu & kết luận',
          description: 'Qua x = 0 đạo hàm đổi dấu từ + sang - (cực đại), qua x = 2 đạo hàm đổi dấu từ - sang + (cực tiểu).',
          latex: 'A(0; -2) \\text{ là điểm cực đại}, \\quad B(2; 2) \\text{ là điểm cực tiểu}',
        },
      ],
      finalAnswer: 'Điểm CĐ: (0; -2), Điểm CT: (2; 2)',
      source: 'gemini_vision',
      processingTimeMs: 1420,
    },
  },
  {
    id: 'sample_3',
    title: 'Khoảng cách điểm đến mặt phẳng (Oxyz)',
    category: 'Hình học không gian Oxyz',
    imagePreviewText: 'd(M, (P)) với M(1; 2; -1), (P): 2x - 2y + z + 5 = 0',
    latex: 'd(M, (P)) = \\frac{|2(1) - 2(2) + (-1) + 5|}{\\sqrt{2^2 + (-2)^2 + 1^2}}',
    difficulty: 'Thông hiểu',
    solution: {
      problemText: 'Trong không gian Oxyz, tính khoảng cách từ điểm M(1; 2; -1) đến mặt phẳng (P): 2x - 2y + z + 5 = 0.',
      latexFormula: 'd(M, (P)) = \\frac{|Ax_M + By_M + Cz_M + D|}{\\sqrt{A^2 + B^2 + C^2}}',
      topic: 'geometry_spatial',
      difficulty: 'Thông hiểu',
      stepByStepSolution: [
        {
          stepNumber: 1,
          title: 'Nhận dạng tọa độ điểm và hệ số mặt phẳng',
          description: 'M(1; 2; -1), mặt phẳng (P) có pháp tuyến n = (2; -2; 1) và D = 5.',
          latex: 'A = 2, B = -2, C = 1, D = 5',
        },
        {
          stepNumber: 2,
          title: 'Thay vào công thức khoảng cách',
          description: 'Tính tử số (trị tuyệt đối) và mẫu số (độ dài vectơ pháp tuyến).',
          latex: 'd(M, (P)) = \\frac{|2 \\cdot 1 - 2 \\cdot 2 + 1 \\cdot (-1) + 5|}{\\sqrt{2^2 + (-2)^2 + 1^2}} = \\frac{|2 - 4 - 1 + 5|}{\\sqrt{4 + 4 + 1}}',
        },
        {
          stepNumber: 3,
          title: 'Rút gọn kết quả',
          description: 'Tử số là |2| = 2, mẫu số là căn bậc hai của 9 = 3.',
          latex: 'd(M, (P)) = \\frac{2}{3}',
        },
      ],
      finalAnswer: 'd(M, (P)) = 2/3',
      source: 'cache',
      processingTimeMs: 35,
    },
  },
];

export const SAMPLE_SCAN_RESULTS: ScanResult[] = SAMPLE_OCR_PROBLEMS.map((p) => p.solution);

export const SAMPLE_SOCRATIC_MESSAGES: SocraticMessage[] = [];

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
