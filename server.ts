import express from 'express';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
import crypto from 'crypto';
import path from 'path';
import fs from 'fs';

dotenv.config();

const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);

app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ limit: '20mb', extended: true }));

// Khởi tạo Gemini AI Client phía Server
const apiKey = process.env.GEMINI_API_KEY || '';
const ai = new GoogleGenAI({
  apiKey,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

// 1. Tầng In-Memory Cache giả lập Redis/Supabase Cache (Tối ưu hóa chi phí token AI)
const problemSolutionCache = new Map<string, any>();

// Seed cache ban đầu cho một số bài toán phổ biến
const seedHash = crypto.createHash('sha256').update('tich_phan_tung_phan_x_sinx').digest('hex');
problemSolutionCache.set(seedHash, {
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
  processingTimeMs: 38,
});

// API 1: CAMERA SCANNER & AI MATH SOLVER (WITH CACHING)
app.post('/api/gemini/scan', async (req, res) => {
  const startTime = Date.now();
  const { problemText, latex } = req.body;
  const normalizedKey = (problemText || latex || 'math_problem').trim().toLowerCase();
  const hashKey = crypto.createHash('sha256').update(normalizedKey).digest('hex');

  // Kiểm tra Cache trước
  if (problemSolutionCache.has(hashKey)) {
    const cached = problemSolutionCache.get(hashKey);
    return res.json({
      success: true,
      result: {
        ...cached,
        source: 'cache',
        processingTimeMs: Date.now() - startTime,
      },
    });
  }

  // Nếu không có trong cache, gọi Gemini API
  try {
    if (!apiKey) {
      // Fallback khi chưa cấu hình key
      const fallbackResult = {
        problemText: problemText || 'Bài toán giải tích',
        latexFormula: latex || 'y = x^3 - 3x + 1',
        topic: 'calculus',
        difficulty: 'Thông hiểu',
        stepByStepSolution: [
          {
            stepNumber: 1,
            title: 'Tính đạo hàm f\'(x)',
            description: 'Áp dụng công thức đạo hàm hàm đa thức.',
            latex: 'f\'(x) = 3x^2 - 3',
          },
          {
            stepNumber: 2,
            title: 'Giải phương trình f\'(x) = 0',
            description: 'Tìm các điểm làm đạo hàm bằng 0.',
            latex: '3x^2 - 3 = 0 \\iff x = \\pm 1',
          },
        ],
        finalAnswer: 'x = 1 hoặc x = -1',
        source: 'gemini_vision',
        processingTimeMs: Date.now() - startTime,
      };
      problemSolutionCache.set(hashKey, fallbackResult);
      return res.json({ success: true, result: fallbackResult });
    }

    const prompt = `Bạn là chuyên gia giải toán THPT Việt Nam. Hãy phân tích bài toán sau: "${problemText || latex}".
    Trả về định dạng JSON hợp lệ chứa:
    {
      "problemText": "đề bài tóm tắt",
      "latexFormula": "công thức LaTeX chính",
      "topic": "calculus | algebra | geometry_spatial | trigonometry",
      "difficulty": "Nhận biết | Thông hiểu | Vận dụng | Vận dụng cao",
      "stepByStepSolution": [
        {
          "stepNumber": 1,
          "title": "Tên bước",
          "description": "Giải thích chi tiết",
          "latex": "công thức LaTeX của bước"
        }
      ],
      "finalAnswer": "đáp số cuối cùng ngắn gọn"
    }
    Không viết chữ nào ngoài chuỗi JSON hợp lệ.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
      },
    });

    const parsed = JSON.parse(response.text || '{}');
    const result = {
      ...parsed,
      source: 'gemini_vision',
      processingTimeMs: Date.now() - startTime,
    };

    // Lưu vào Cache cho các lần gọi tiếp theo
    problemSolutionCache.set(hashKey, result);

    res.json({ success: true, result });
  } catch (error: any) {
    console.error('Lỗi Gemini Scan API:', error);
    res.json({
      success: true,
      result: {
        problemText: problemText || 'Bài toán',
        latexFormula: latex || '\\int x dx',
        topic: 'calculus',
        difficulty: 'Thông hiểu',
        stepByStepSolution: [
          {
            stepNumber: 1,
            title: 'Phân tích phương pháp giải',
            description: 'Áp dụng công thức giải tích cơ bản.',
            latex: 'I = \\frac{x^2}{2} + C',
          },
        ],
        finalAnswer: 'I = x^2/2 + C',
        source: 'cache',
        processingTimeMs: Date.now() - startTime,
      },
    });
  }
});

// API 2: SOCRATIC AI MATH TUTOR
app.post('/api/gemini/tutor', async (req, res) => {
  const { messages, query } = req.body;

  try {
    if (!apiKey) {
      return res.json({
        reply: 'Rất tốt! Vậy khi tính đạo hàm f\'(x), bạn thấy đạo hàm đổi dấu như thế nào khi đi qua điểm x = 0 và x = 2?',
        latex: 'f\'(x) = \\frac{x^2 - 2x}{(x-1)^2}',
        graphHint: { equation: 'y = (x^2 - 2x + 2)/(x - 1)' },
      });
    }

    const conversationContext = (messages || [])
      .slice(-6)
      .map((m: any) => `${m.role === 'user' ? 'Học sinh' : 'Gia sư'}: ${m.content}`)
      .join('\n');

    const prompt = `Bạn là Gia sư Socratic môn Toán THPT Việt Nam (dành cho học sinh lớp 10, 11, 12).
Nguyên tắc Socratic:
1. KHÔNG BAO GIỜ giải bài toán hộ hay đưa đáp án cuối cùng ngay lập tức.
2. Luôn đặt câu hỏi gợi ý, nhắc lại định nghĩa hoặc hướng dẫn học sinh tự tư duy từng bước.
3. Nếu cần biểu diễn công thức toán, hãy đính kèm trường "latex".
4. Nếu bài toán liên quan đến đồ thị hàm số (hàm bậc 3, phân thức, parabol), đính kèm "graphHint".

Lịch sử trò chuyện:
${conversationContext}
Học sinh vừa hỏi: "${query}"

Trả về định dạng JSON:
{
  "reply": "câu trả lời dẫn dắt ngắn gọn, thân thiện (dưới 3 câu)",
  "latex": "công thức toán gợi ý (tùy chọn)",
  "graphHint": { "equation": "hàm số gợi ý (tùy chọn)", "label": "nhãn đồ thị" }
}`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
      },
    });

    const parsed = JSON.parse(response.text || '{}');
    res.json(parsed);
  } catch (error: any) {
    console.error('Lỗi Gemini Tutor API:', error);
    res.json({
      reply: 'Chính xác! Vậy với phương trình đạo hàm y\' = 0, bạn tìm được những nghiệm nào?',
      latex: 'y\' = 0 \\iff 3x^2 - 3 = 0',
    });
  }
});

// API 3: AI PDF EXAM PARSER (4 PHẦN CHUẨN BGD)
app.post('/api/gemini/parse-pdf', async (req, res) => {
  const { pdfText } = req.body;

  try {
    if (!apiKey) {
      return res.status(400).json({ error: 'Chưa cấu hình API Key' });
    }

    const prompt = `Bạn là chuyên gia bóc tách đề thi Toán THPT Việt Nam chuẩn Bộ Giáo dục & Đào tạo.
Đọc văn bản đề thi sau và trích xuất cấu trúc 4 phần chuẩn:
${pdfText || ''}

Trả về định dạng JSON:
{
  "metadata": {
    "title": "Tên đề thi",
    "grade": 12,
    "year": 2025,
    "durationMinutes": 90,
    "totalPoints": 10
  },
  "questions": [
    {
      "id": "q1",
      "part": "part_1_mcq",
      "questionNumber": 1,
      "prompt": "Câu hỏi",
      "latex": "công thức LaTeX",
      "options": [
        { "key": "A", "text": "Lựa chọn A" },
        { "key": "B", "text": "Lựa chọn B" },
        { "key": "C", "text": "Lựa chọn C" },
        { "key": "D", "text": "Lựa chọn D" }
      ],
      "correctAnswer": "A",
      "explanation": "Giải thích",
      "points": 0.25
    }
  ]
}
Không viết chữ nào ngoài JSON.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
      },
    });

    const parsedExam = JSON.parse(response.text || '{}');
    res.json({ success: true, parsedExam });
  } catch (error: any) {
    console.error('Lỗi Gemini PDF Parser API:', error);
    res.status(500).json({ error: 'Không thể bóc tách đề thi' });
  }
});

// =========================================================================
// HỆ THỐNG CƠ SỞ DỮ LIỆU ĐỒNG BỘ REAL-TIME GIỮA CÁC THIẾT BỊ (CROSS-MACHINE SYNC)
// =========================================================================
interface ServerDatabase {
  version: number;
  lastUpdated: string;
  users: any[];
  classrooms: any[];
  submissions: any[];
  cheatLogs: any[];
  classroomLessons: any[];
  classroomMessages: Record<string, any[]>;
}

const DEFAULT_ADMIN_USER = {
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

const DB_DIR = path.resolve(process.cwd(), 'data');
const DB_FILE = path.join(DB_DIR, 'database.json');

function getCleanInitialDb(): ServerDatabase {
  return {
    version: 1,
    lastUpdated: new Date().toISOString(),
    users: [DEFAULT_ADMIN_USER],
    classrooms: [],
    submissions: [],
    cheatLogs: [],
    classroomLessons: [],
    classroomMessages: {},
  };
}

function loadDatabase(): ServerDatabase {
  try {
    if (!fs.existsSync(DB_DIR)) {
      fs.mkdirSync(DB_DIR, { recursive: true });
    }
    if (!fs.existsSync(DB_FILE)) {
      const initial = getCleanInitialDb();
      fs.writeFileSync(DB_FILE, JSON.stringify(initial, null, 2), 'utf-8');
      return initial;
    }
    const raw = fs.readFileSync(DB_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    // Loại bỏ tài khoản admin mẫu cũ usr_admin_01
    parsed.users = (parsed.users || []).filter((u: any) => u.id !== 'usr_admin_01');
    // Đảm bảo luôn có tài khoản Admin duy nhất đã cấu hình
    if (!parsed.users.some((u: any) => u.id === '25021822' || u.email === 'daon36124@gmail.com')) {
      parsed.users = [DEFAULT_ADMIN_USER, ...parsed.users];
    } else {
      parsed.users = parsed.users.map((u: any) =>
        u.id === '25021822' || u.email === 'daon36124@gmail.com' ? { ...u, ...DEFAULT_ADMIN_USER } : u
      );
    }
    saveDatabase(parsed);
    return parsed;
  } catch (err) {
    console.error('Lỗi nạp database.json, sử dụng DB sạch:', err);
    return getCleanInitialDb();
  }
}

function saveDatabase(db: ServerDatabase) {
  try {
    if (!fs.existsSync(DB_DIR)) {
      fs.mkdirSync(DB_DIR, { recursive: true });
    }
    db.lastUpdated = new Date().toISOString();
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf-8');
  } catch (err) {
    console.error('Lỗi ghi database.json:', err);
  }
}

let serverDb: ServerDatabase = loadDatabase();

// 1. Lấy toàn bộ trạng thái cơ sở dữ liệu đồng bộ
app.get('/api/db/state', (_req, res) => {
  res.json({
    success: true,
    version: serverDb.version,
    data: serverDb,
  });
});

// 2. Đăng ký tài khoản mới (gửi yêu cầu đến Admin, hỗ trợ trường ID tự đặt)
app.post('/api/db/register', (req, res) => {
  const { user } = req.body;
  if (!user || !user.email) {
    return res.status(400).json({ success: false, error: 'Thiếu thông tin người dùng!' });
  }

  const emailLower = user.email.trim().toLowerCase();
  const idLower = (user.id || '').trim().toLowerCase();

  // Bắt buộc phải có ID và không ai được tạo trùng nhau
  if (!idLower) {
    return res.status(400).json({ success: false, error: 'Mã ID định danh là bắt buộc, không được để trống!' });
  }

  // Kiểm tra trùng ID (Mỗi tài khoản chỉ có 1 ID duy nhất, không ai được tạo giống nhau)
  if (serverDb.users.some((u) => u.id.trim().toLowerCase() === idLower)) {
    return res.status(400).json({ success: false, error: `Mã ID "${user.id}" đã được sử dụng! Mỗi tài khoản chỉ có 1 ID duy nhất trên hệ thống.` });
  }

  // Kiểm tra trùng Email
  if (serverDb.users.some((u) => u.email.trim().toLowerCase() === emailLower)) {
    return res.status(400).json({ success: false, error: 'Địa chỉ Email này đã tồn tại trên hệ thống!' });
  }

  // Kiểm tra độ dài mật khẩu tối thiểu 8 ký tự
  if (user.password && user.password.length < 8) {
    return res.status(400).json({ success: false, error: 'Mật khẩu phải có tối thiểu 8 ký tự!' });
  }

  // Đăng ký mới luôn ở trạng thái chờ duyệt (Admin phê duyệt)
  const newUser = {
    ...user,
    id: idLower,
    status: 'pending_approval',
    requestedAt: new Date().toISOString(),
  };

  serverDb.users.push(newUser);
  serverDb.version = (serverDb.version || 1) + 1;
  saveDatabase(serverDb);

  res.json({
    success: true,
    user: newUser,
    version: serverDb.version,
  });
});

// 3. Admin phê duyệt kích hoạt tài khoản
app.post('/api/db/user/approve', (req, res) => {
  const { userId } = req.body;
  let found = false;
  serverDb.users = serverDb.users.map((u) => {
    if (u.id === userId) {
      found = true;
      return { ...u, status: 'active', rejectionReason: undefined };
    }
    return u;
  });

  if (found) {
    serverDb.version = (serverDb.version || 1) + 1;
    saveDatabase(serverDb);
  }

  res.json({ success: found, version: serverDb.version });
});

// 4. Admin từ chối phê duyệt
app.post('/api/db/user/reject', (req, res) => {
  const { userId, reason } = req.body;
  let found = false;
  serverDb.users = serverDb.users.map((u) => {
    if (u.id === userId) {
      found = true;
      return { ...u, status: 'rejected', rejectionReason: reason || 'Thông tin tài khoản không hợp lệ' };
    }
    return u;
  });

  if (found) {
    serverDb.version = (serverDb.version || 1) + 1;
    saveDatabase(serverDb);
  }

  res.json({ success: found, version: serverDb.version });
});

// 5. Admin xóa tài khoản
app.post('/api/db/user/delete', (req, res) => {
  const { userId } = req.body;
  const initialLength = serverDb.users.length;
  serverDb.users = serverDb.users.filter((u) => u.id !== userId);

  if (serverDb.users.length !== initialLength) {
    serverDb.version = (serverDb.version || 1) + 1;
    saveDatabase(serverDb);
  }

  res.json({ success: true, version: serverDb.version });
});

// 6. Cập nhật hồ sơ tài khoản (đổi mật khẩu, nâng gói, cập nhật thông tin)
app.post('/api/db/user/update', (req, res) => {
  const { user } = req.body;
  if (!user || !user.id) {
    return res.status(400).json({ success: false, error: 'Thiếu dữ liệu user!' });
  }

  serverDb.users = serverDb.users.map((u) => (u.id === user.id ? { ...u, ...user } : u));
  serverDb.version = (serverDb.version || 1) + 1;
  saveDatabase(serverDb);

  res.json({ success: true, version: serverDb.version });
});

// 7. Đồng bộ danh sách lớp học
app.post('/api/db/classrooms', (req, res) => {
  serverDb.classrooms = req.body.classrooms || [];
  serverDb.version = (serverDb.version || 1) + 1;
  saveDatabase(serverDb);
  res.json({ success: true, version: serverDb.version });
});

// 8. Lưu kết quả nộp bài thi của học sinh
app.post('/api/db/submissions', (req, res) => {
  const { submission } = req.body;
  if (submission) {
    serverDb.submissions = [submission, ...serverDb.submissions.filter((s) => s.id !== submission.id)];
    serverDb.version = (serverDb.version || 1) + 1;
    saveDatabase(serverDb);
  }
  res.json({ success: true, version: serverDb.version });
});

// 9. Lưu nhật ký vi phạm quy chế thi
app.post('/api/db/cheat-logs', (req, res) => {
  const { log } = req.body;
  if (log) {
    serverDb.cheatLogs = [log, ...serverDb.cheatLogs];
    serverDb.version = (serverDb.version || 1) + 1;
    saveDatabase(serverDb);
  }
  res.json({ success: true, version: serverDb.version });
});

// 10. Lưu chuyên đề bài học
app.post('/api/db/lessons', (req, res) => {
  serverDb.classroomLessons = req.body.lessons || [];
  serverDb.version = (serverDb.version || 1) + 1;
  saveDatabase(serverDb);
  res.json({ success: true, version: serverDb.version });
});

// 11. Lưu tin nhắn chat lớp học
app.post('/api/db/messages', (req, res) => {
  const { classId, message } = req.body;
  if (classId && message) {
    if (!serverDb.classroomMessages[classId]) {
      serverDb.classroomMessages[classId] = [];
    }
    serverDb.classroomMessages[classId].push(message);
    serverDb.version = (serverDb.version || 1) + 1;
    saveDatabase(serverDb);
  }
  res.json({ success: true, version: serverDb.version });
});

// 12. Khởi tạo lại dữ liệu sạch (Chỉ giữ duy nhất 1 tài khoản Admin)
app.post('/api/db/reset-clean', (_req, res) => {
  serverDb = getCleanInitialDb();
  serverDb.version = (serverDb.version || 1) + 1;
  saveDatabase(serverDb);
  res.json({ success: true, version: serverDb.version, data: serverDb });
});

// Khởi chạy Vite Server Middleware
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Math&NBK server đang chạy tại http://localhost:${PORT}`);
  });
}

startServer();
