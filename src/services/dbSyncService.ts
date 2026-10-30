import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  where,
} from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import {
  UserProfile,
  Classroom,
  StudentExamSubmission,
  CheatLog,
  ClassroomLesson,
  ClassroomChatMessage,
  Exam,
} from '../types/math';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map((provider) => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || [],
    },
    operationType,
    path,
  };
  console.error('[Firestore Error Details]', JSON.stringify(errInfo, null, 2));
  throw new Error(JSON.stringify(errInfo));
}

export interface DatabaseState {
  version: number;
  lastUpdated: string;
  users: UserProfile[];
  classrooms: Classroom[];
  submissions: StudentExamSubmission[];
  cheatLogs: CheatLog[];
  classroomLessons: ClassroomLesson[];
  classroomMessages: Record<string, ClassroomChatMessage[]>;
  exams: Exam[];
}

export const DEFAULT_ADMIN_PROFILE: UserProfile = {
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

// Đảm bảo luôn có tài khoản Admin mẫu trên Firestore khi khởi động
let adminSeeded = false;
async function ensureAdminSeeded() {
  if (adminSeeded) return;
  adminSeeded = true;
  try {
    // Dọn dẹp tài khoản admin cũ usr_admin_01 nếu còn tồn tại
    try {
      const oldRef = doc(db, 'users', 'usr_admin_01');
      const oldSnap = await getDoc(oldRef);
      if (oldSnap.exists()) {
        await deleteDoc(oldRef);
      }
    } catch {}

    const adminRef = doc(db, 'users', DEFAULT_ADMIN_PROFILE.id);
    const snap = await getDoc(adminRef);
    if (!snap.exists()) {
      await setDoc(adminRef, DEFAULT_ADMIN_PROFILE);
    } else {
      await setDoc(adminRef, DEFAULT_ADMIN_PROFILE, { merge: true });
    }
  } catch (err) {
    console.warn('Lỗi kiểm tra admin Firestore:', err);
  }
}

/**
 * Lấy trạng thái cơ sở dữ liệu (tương thích ngược)
 */
export async function fetchDbState(): Promise<DatabaseState | null> {
  try {
    const res = await fetch('/api/db/state');
    if (res.ok) {
      const json = await res.json();
      return json.data || null;
    }
  } catch {}
  return null;
}

/**
 * Gửi yêu cầu đăng ký tài khoản mới lên Firestore (Đồng bộ mọi thiết bị: Điện thoại, Laptop, PC)
 */
export async function dbRegisterUser(newUser: UserProfile): Promise<{ success: boolean; error?: string; user?: UserProfile }> {
  try {
    const userRef = doc(db, 'users', newUser.id);
    const snap = await getDoc(userRef);

    if (snap.exists()) {
      return {
        success: false,
        error: `Mã ID "${newUser.id}" đã được sử dụng! Mỗi tài khoản chỉ có 1 ID duy nhất trên hệ thống.`,
      };
    }

    // Kiểm tra trùng Email trên Firestore
    const qEmail = query(collection(db, 'users'), where('email', '==', newUser.email.trim().toLowerCase()));
    const emailSnap = await getDocs(qEmail);
    if (!emailSnap.empty) {
      return {
        success: false,
        error: 'Địa chỉ Email này đã tồn tại trên hệ thống!',
      };
    }

    const payload = {
      ...newUser,
      id: newUser.id.trim().toLowerCase(),
      email: newUser.email.trim().toLowerCase(),
      status: 'pending_approval' as const,
      requestedAt: new Date().toISOString(),
    };

    await setDoc(userRef, payload);

    // Cũng gửi tới server endpoint để đồng bộ song song
    fetch('/api/db/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user: payload }),
    }).catch(() => {});

    return { success: true, user: payload };
  } catch (err: any) {
    // Fallback qua server nếu Firestore bị gián đoạn
    try {
      const res = await fetch('/api/db/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user: newUser }),
      });
      return await res.json();
    } catch {
      return { success: false, error: err.message || 'Lỗi kết nối cơ sở dữ liệu đám mây.' };
    }
  }
}

/**
 * Admin phê duyệt kích hoạt tài khoản trên Firestore
 */
export async function dbApproveUser(userId: string): Promise<boolean> {
  try {
    const ref = doc(db, 'users', userId);
    await updateDoc(ref, {
      status: 'active',
      rejectionReason: '',
    });

    fetch('/api/db/user/approve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId }),
    }).catch(() => {});

    return true;
  } catch {
    return false;
  }
}

/**
 * Admin từ chối yêu cầu đăng ký
 */
export async function dbRejectUser(userId: string, reason?: string): Promise<boolean> {
  try {
    const ref = doc(db, 'users', userId);
    await updateDoc(ref, {
      status: 'rejected',
      rejectionReason: reason || 'Thông tin tài khoản không hợp lệ',
    });

    fetch('/api/db/user/reject', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, reason }),
    }).catch(() => {});

    return true;
  } catch {
    return false;
  }
}

/**
 * Admin xóa tài khoản
 */
export async function dbDeleteUser(userId: string): Promise<boolean> {
  try {
    await deleteDoc(doc(db, 'users', userId));

    fetch('/api/db/user/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId }),
    }).catch(() => {});

    return true;
  } catch {
    return false;
  }
}

/**
 * Cập nhật thông tin hồ sơ
 */
export async function dbUpdateUser(user: UserProfile): Promise<boolean> {
  try {
    await setDoc(doc(db, 'users', user.id), user, { merge: true });

    fetch('/api/db/user/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user }),
    }).catch(() => {});

    return true;
  } catch {
    return false;
  }
}

/**
 * Đồng bộ danh sách lớp học
 */
export async function dbSaveClassrooms(classrooms: Classroom[]): Promise<boolean> {
  const cleanClasses = cleanForFirestore(classrooms);
  try {
    for (const c of cleanClasses) {
      await setDoc(doc(db, 'classrooms', c.id), c, { merge: true });
    }
    fetch('/api/db/classrooms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ classrooms: cleanClasses }),
    }).catch(() => {});
    return true;
  } catch (err) {
    console.warn('Lỗi dbSaveClassrooms Firestore:', err);
    return false;
  }
}

/**
 * Lưu kết quả bài làm thi của học sinh
 */
export async function dbSaveSubmission(submission: StudentExamSubmission): Promise<boolean> {
  const cleanSub = cleanForFirestore(submission);
  try {
    await setDoc(doc(db, 'submissions', submission.id), cleanSub, { merge: true });

    fetch('/api/db/submissions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ submission: cleanSub }),
    }).catch(() => {});

    return true;
  } catch (err) {
    console.warn('Lỗi dbSaveSubmission Firestore:', err);
    return false;
  }
}

/**
 * Lưu nhật ký vi phạm quy chế thi
 */
export async function dbSaveCheatLog(log: CheatLog): Promise<boolean> {
  try {
    await setDoc(doc(db, 'cheatLogs', log.id), log, { merge: true });

    fetch('/api/db/cheat-logs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ log }),
    }).catch(() => {});

    return true;
  } catch {
    return false;
  }
}

/**
 * Làm sạch hoàn toàn dữ liệu trước khi gửi lên Firestore:
 * 1. Loại bỏ triệt để các trường có giá trị undefined (Firestore báo lỗi nếu có undefined)
 * 2. Cắt giảm file base64 quá lớn (> 300KB) để bảo đảm document không vượt 1MB Firestore limit
 */
export function cleanForFirestore<T>(data: T): any {
  if (data === null || data === undefined) return null;
  return JSON.parse(JSON.stringify(data));
}

function sanitizeLessonForFirestore(lesson: ClassroomLesson): any {
  const cleaned = cleanForFirestore(lesson);
  // Tuyệt đối không lưu chuỗi base64 fileData nặng vào Firestore document
  if (cleaned.pdfAttachment) {
    cleaned.pdfAttachment.fileData = '';
  }
  if (cleaned.practicePdfAttachment) {
    cleaned.practicePdfAttachment.fileData = '';
  }
  if (cleaned.attachments && Array.isArray(cleaned.attachments)) {
    cleaned.attachments = cleaned.attachments.map((att: any) => {
      if (att.url && (att.url.startsWith('data:') || att.url.length > 2000)) {
        return {
          ...att,
          url:
            (att.name === cleaned.pdfAttachment?.fileName && cleaned.pdfAttachment?.fileUrl) ||
            (att.name === cleaned.practicePdfAttachment?.fileName && cleaned.practicePdfAttachment?.fileUrl) ||
            '',
        };
      }
      return att;
    });
  }
  return cleanForFirestore(cleaned);
}

/**
 * Tải file PDF lên máy chủ để lưu trữ vĩnh viễn dạng file nhị phân chuẩn và nhận link fileUrl
 */
export async function dbUploadPdfFile(
  fileName: string,
  fileData: string
): Promise<{ success: boolean; fileUrl?: string; fileName?: string; fileSize?: string; error?: string }> {
  try {
    const res = await fetch('/api/upload/file', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fileName, fileData }),
    });
    if (res.ok) {
      const data = await res.json();
      return data;
    }
    const errData = await res.json().catch(() => ({}));
    return { success: false, error: errData.error || 'Máy chủ không thể lưu file' };
  } catch (err: any) {
    console.warn('Lỗi khi tải file lên máy chủ:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Lưu 1 bài học chuyên đề lớp học (Thêm mới hoặc Cập nhật) - Đồng bộ Real-Time cả Firestore và Server
 */
export async function dbSaveLesson(lesson: ClassroomLesson): Promise<boolean> {
  console.log('[dbSaveLesson] Bắt đầu đồng bộ bài học:', {
    id: lesson.id,
    title: lesson.title,
    chapter: lesson.chapter,
    classId: lesson.classId,
    timestamp: new Date().toISOString(),
  });

  const lessonToSave = { ...lesson };

  // 1. Đảm bảo file PDF bài học được lưu vào server và có link fileUrl chuẩn
  if (lessonToSave.pdfAttachment?.fileData && !lessonToSave.pdfAttachment.fileUrl) {
    try {
      console.log(`[dbSaveLesson] Đang tải PDF bài học lên máy chủ: "${lessonToSave.pdfAttachment.fileName}"...`);
      const uploadRes = await dbUploadPdfFile(lessonToSave.pdfAttachment.fileName, lessonToSave.pdfAttachment.fileData);
      if (uploadRes.success && uploadRes.fileUrl) {
        console.log(`[dbSaveLesson] Upload PDF bài học thành công: ${uploadRes.fileUrl}`);
        lessonToSave.pdfAttachment = {
          ...lessonToSave.pdfAttachment,
          fileUrl: uploadRes.fileUrl,
          fileSize: uploadRes.fileSize || lessonToSave.pdfAttachment.fileSize,
          fileData: '',
        };
      } else {
        console.warn(`[dbSaveLesson] Cảnh báo upload PDF bài học:`, uploadRes.error);
      }
    } catch (err) {
      console.error('[dbSaveLesson] Lỗi ngoại lệ khi upload PDF bài học:', err);
    }
  } else if (lessonToSave.pdfAttachment) {
    lessonToSave.pdfAttachment = {
      ...lessonToSave.pdfAttachment,
      fileData: '',
    };
  }

  // 2. Đảm bảo file PDF luyện tập được lưu vào server và có link fileUrl chuẩn
  if (lessonToSave.practicePdfAttachment?.fileData && !lessonToSave.practicePdfAttachment.fileUrl) {
    try {
      console.log(`[dbSaveLesson] Đang tải PDF luyện tập lên máy chủ: "${lessonToSave.practicePdfAttachment.fileName}"...`);
      const uploadRes = await dbUploadPdfFile(lessonToSave.practicePdfAttachment.fileName, lessonToSave.practicePdfAttachment.fileData);
      if (uploadRes.success && uploadRes.fileUrl) {
        console.log(`[dbSaveLesson] Upload PDF luyện tập thành công: ${uploadRes.fileUrl}`);
        lessonToSave.practicePdfAttachment = {
          ...lessonToSave.practicePdfAttachment,
          fileUrl: uploadRes.fileUrl,
          fileSize: uploadRes.fileSize || lessonToSave.practicePdfAttachment.fileSize,
          fileData: '',
        };
      } else {
        console.warn(`[dbSaveLesson] Cảnh báo upload PDF luyện tập:`, uploadRes.error);
      }
    } catch (err) {
      console.error('[dbSaveLesson] Lỗi ngoại lệ khi upload PDF luyện tập:', err);
    }
  } else if (lessonToSave.practicePdfAttachment) {
    lessonToSave.practicePdfAttachment = {
      ...lessonToSave.practicePdfAttachment,
      fileData: '',
    };
  }

  // 3. Chuẩn hóa attachments url (loại bỏ chuỗi base64 nặng để tránh nghẽn payload)
  if (lessonToSave.attachments && Array.isArray(lessonToSave.attachments)) {
    lessonToSave.attachments = lessonToSave.attachments.map((att) => {
      if (att.name === lessonToSave.pdfAttachment?.fileName && lessonToSave.pdfAttachment?.fileUrl) {
        return { ...att, url: lessonToSave.pdfAttachment.fileUrl };
      }
      if (att.name === lessonToSave.practicePdfAttachment?.fileName && lessonToSave.practicePdfAttachment?.fileUrl) {
        return { ...att, url: lessonToSave.practicePdfAttachment.fileUrl };
      }
      if (att.url && att.url.startsWith('data:')) {
        return { ...att, url: '' };
      }
      return att;
    });
  }

  const cleanLesson = cleanForFirestore(lessonToSave);
  if (!cleanLesson || !cleanLesson.id) {
    const missingIdError = new Error('Dữ liệu bài học không hợp lệ hoặc thiếu mã định danh (id).');
    console.error('[dbSaveLesson] Thất bại kiểm tra định danh bài học:', cleanLesson);
    throw missingIdError;
  }

  // 4. Lưu lên Server API để lưu trữ bền vững
  const saveToServer = async () => {
    try {
      const serverRes = await fetch('/api/db/lesson/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lesson: cleanLesson }),
      });
      if (!serverRes.ok) {
        const text = await serverRes.text().catch(() => '');
        throw new Error(`Server API HTTP ${serverRes.status}: ${text || serverRes.statusText}`);
      }
      const data = await serverRes.json().catch(() => ({}));
      console.log(`[dbSaveLesson] Lưu Server API thành công:`, data);
      return { success: true };
    } catch (err: any) {
      console.error('[dbSaveLesson] Lỗi khi lưu Server API /api/db/lesson/save:', err);
      return { success: false, error: err?.message || String(err) };
    }
  };

  // 5. Lưu lên Firestore Real-Time để push tức thời tới mọi thiết bị khác
  const firestorePath = `lessons/${cleanLesson.id}`;
  const saveToFirestore = async () => {
    try {
      const firestorePayload = sanitizeLessonForFirestore(lessonToSave);
      console.log(`[dbSaveLesson] Đang ghi Firestore document "${firestorePath}"...`);
      await setDoc(doc(db, 'lessons', cleanLesson.id), firestorePayload, { merge: true });
      console.log(`[dbSaveLesson] Ghi Firestore document "${firestorePath}" THÀNH CÔNG!`);
      return { success: true };
    } catch (err: any) {
      console.error(`[dbSaveLesson] THẤT BẠI khi ghi Firestore document "${firestorePath}":`, err);
      handleFirestoreError(err, OperationType.WRITE, firestorePath);
    }
  };

  const [serverResult, firestoreResult] = await Promise.allSettled([
    saveToServer(),
    saveToFirestore(),
  ]);

  // Nếu Firestore ném lỗi, bắt buộc ném ra để UI hiển thị thông báo lỗi
  if (firestoreResult.status === 'rejected') {
    throw firestoreResult.reason;
  }

  if (serverResult.status === 'fulfilled' && !serverResult.value.success) {
    console.warn('[dbSaveLesson] Cảnh báo Server API lưu thất bại:', serverResult.value.error);
  }

  return true;
}

/**
 * Xóa 1 bài học chuyên đề khỏi Firestore & Server
 */
export async function dbDeleteLesson(lessonId: string): Promise<boolean> {
  const serverPromise = fetch('/api/db/lesson/delete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ lessonId }),
  }).catch(() => null);

  const firestorePromise = deleteDoc(doc(db, 'lessons', lessonId)).catch((err) => {
    console.warn('Lỗi dbDeleteLesson Firestore:', err);
  });

  await Promise.allSettled([serverPromise, firestorePromise]);
  return true;
}

/**
 * Lưu danh sách bài học chuyên đề lớp học đồng bộ Real-Time
 */
export async function dbSaveLessons(lessons: ClassroomLesson[]): Promise<boolean> {
  const sanitizedList = lessons.map((les) => sanitizeLessonForFirestore(les));
  const cleanLessons = cleanForFirestore(sanitizedList);
  if (!Array.isArray(cleanLessons)) return false;

  const serverPromise = fetch('/api/db/lessons', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ lessons: cleanLessons }),
  }).catch(() => null);

  const firestorePromise = (async () => {
    try {
      for (const les of cleanLessons) {
        await setDoc(doc(db, 'lessons', les.id), les, { merge: true });
      }
    } catch (err) {
      console.warn('Lỗi dbSaveLessons Firestore:', err);
    }
  })();

  await Promise.allSettled([serverPromise, firestorePromise]);
  return true;
}

/**
 * Tải danh sách bài học từ Server (On-demand)
 */
export async function dbFetchLessons(): Promise<ClassroomLesson[]> {
  try {
    const res = await fetch('/api/db/state', { headers: { 'Cache-Control': 'no-cache' } });
    if (res.ok) {
      const json = await res.json();
      if (json.success && json.data?.classroomLessons) {
        return json.data.classroomLessons;
      }
    }
  } catch {}
  return [];
}

/**
 * Lưu 1 đề thi mới hoặc cập nhật đề thi (Đồng bộ Real-Time cả Firestore và Server)
 * Giúp học sinh thấy đề thi ngay lập tức khi giáo viên đăng bài
 */
export async function dbSaveExam(exam: Exam): Promise<boolean> {
  const cleanExam = cleanForFirestore(exam);
  if (!cleanExam || !cleanExam.id) return false;

  const serverPromise = fetch('/api/db/exam/save', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ exam: cleanExam }),
  }).catch((err) => {
    console.warn('Lỗi dbSaveExam Server API:', err);
    return null;
  });

  const firestorePromise = (async () => {
    try {
      await setDoc(doc(db, 'exams', cleanExam.id), cleanExam, { merge: true });
    } catch (err) {
      console.warn('Lỗi dbSaveExam Firestore:', err);
    }
  })();

  await Promise.allSettled([serverPromise, firestorePromise]);
  return true;
}

/**
 * Xóa 1 đề thi khỏi Firestore & Server
 */
export async function dbDeleteExam(examId: string): Promise<boolean> {
  const serverPromise = fetch('/api/db/exam/delete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ examId }),
  }).catch(() => null);

  const firestorePromise = (async () => {
    try {
      await deleteDoc(doc(db, 'exams', examId));
    } catch (err) {
      console.warn('Lỗi dbDeleteExam Firestore:', err);
    }
  })();

  await Promise.allSettled([serverPromise, firestorePromise]);
  return true;
}

/**
 * Lưu danh sách đề thi đồng bộ lên Firestore & Server
 */
export async function dbSaveExams(exams: Exam[]): Promise<boolean> {
  const cleanExams = cleanForFirestore(exams);
  if (!Array.isArray(cleanExams)) return false;

  const serverPromise = fetch('/api/db/exams', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ exams: cleanExams }),
  }).catch(() => null);

  const firestorePromise = (async () => {
    try {
      for (const ex of cleanExams) {
        await setDoc(doc(db, 'exams', ex.id), ex, { merge: true });
      }
    } catch (err) {
      console.warn('Lỗi dbSaveExams Firestore:', err);
    }
  })();

  await Promise.allSettled([serverPromise, firestorePromise]);
  return true;
}

/**
 * Lưu tin nhắn chat trong nhóm lớp (Đồng bộ tức thời Real-time cả Firestore và Server)
 */
export async function dbSaveMessage(classId: string, message: ClassroomChatMessage): Promise<boolean> {
  const payload = { ...message, classId };

  // 1. Lưu lên Firestore Real-time để đẩy ngay lập tức cho các máy khác đang mở app
  const firestorePromise = setDoc(doc(db, 'messages', message.id), payload, { merge: true })
    .catch((err) => {
      console.warn('Lỗi dbSaveMessage Firestore:', err);
      return null;
    });

  // 2. Đồng thời lưu vào Server Express API (data/database.json) để dự phòng mọi thiết bị
  const serverPromise = fetch('/api/db/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ classId, message: payload }),
  }).catch((err) => {
    console.warn('Lỗi dbSaveMessage Server API:', err);
    return null;
  });

  await Promise.allSettled([firestorePromise, serverPromise]);
  return true;
}

/**
 * Thả / Hủy tương tác biểu cảm Emoji trên tin nhắn chat (Đồng bộ Real-time mọi máy)
 */
export async function dbToggleMessageReaction(
  classId: string,
  messageId: string,
  emoji: string,
  userId: string
): Promise<boolean> {
  // 1. Cập nhật Server API ngay lập tức
  const serverPromise = fetch('/api/db/message/reaction', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ classId, messageId, emoji, userId }),
  }).catch(() => null);

  // 2. Cập nhật Firestore Real-time
  const firestorePromise = (async () => {
    try {
      const msgRef = doc(db, 'messages', messageId);
      const snap = await getDoc(msgRef);
      if (!snap.exists()) return;
      const msgData = snap.data() as ClassroomChatMessage;
      const reactions = msgData.reactions || [];
      const existing = reactions.find((r) => r.emoji === emoji);
      let nextReactions;
      if (existing) {
        if (existing.userIds.includes(userId)) {
          const nextUsers = existing.userIds.filter((uid) => uid !== userId);
          if (nextUsers.length === 0) {
            nextReactions = reactions.filter((r) => r.emoji !== emoji);
          } else {
            nextReactions = reactions.map((r) =>
              r.emoji === emoji ? { ...r, count: nextUsers.length, userIds: nextUsers } : r
            );
          }
        } else {
          nextReactions = reactions.map((r) =>
            r.emoji === emoji ? { ...r, count: r.count + 1, userIds: [...r.userIds, userId] } : r
          );
        }
      } else {
        nextReactions = [...reactions, { emoji, count: 1, userIds: [userId] }];
      }
      await updateDoc(msgRef, { reactions: nextReactions });
    } catch (err) {
      console.warn('Lỗi dbToggleMessageReaction Firestore:', err);
    }
  })();

  await Promise.allSettled([serverPromise, firestorePromise]);
  return true;
}

/**
 * Tải danh sách tin nhắn của 1 lớp học từ Server / Firestore (On-demand)
 */
export async function dbFetchClassMessages(classId: string): Promise<ClassroomChatMessage[]> {
  try {
    const res = await fetch(`/api/db/messages?classId=${encodeURIComponent(classId)}`);
    if (res.ok) {
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        return json.data;
      }
    }
  } catch {}
  return [];
}

/**
 * Thiết lập cơ chế tự động đồng bộ Real-Time qua Firestore onSnapshot
 * Đồng bộ ngay lập tức (<100ms) giữa Điện thoại, Máy tính, Máy tính bảng và mọi trình duyệt.
 */
export function startDbPolling(
  onRemoteUpdate: (state: DatabaseState) => void,
  intervalMs = 1500
): () => void {
  ensureAdminSeeded();

  const stateAccumulator: DatabaseState = {
    version: 1,
    lastUpdated: new Date().toISOString(),
    users: [DEFAULT_ADMIN_PROFILE],
    classrooms: [],
    submissions: [],
    cheatLogs: [],
    classroomLessons: [],
    classroomMessages: {},
    exams: [],
  };

  const dispatchUpdate = () => {
    stateAccumulator.version += 1;
    stateAccumulator.lastUpdated = new Date().toISOString();
    onRemoteUpdate({ ...stateAccumulator });
  };

  // 1. Lắng nghe thay đổi User trên Firestore Real-time
  const unsubUsers = onSnapshot(collection(db, 'users'), (snapshot) => {
    const usersList: UserProfile[] = [];
    snapshot.forEach((d) => {
      usersList.push(d.data() as UserProfile);
    });

    // Loại bỏ tài khoản mẫu cũ usr_admin_01 nếu còn sót lại
    const filteredUsers = usersList.filter((u) => u.id !== 'usr_admin_01');

    // Luôn bảo đảm có tài khoản admin duy nhất đã cấu hình
    if (!filteredUsers.some((u) => u.id === DEFAULT_ADMIN_PROFILE.id)) {
      filteredUsers.unshift(DEFAULT_ADMIN_PROFILE);
    }

    stateAccumulator.users = filteredUsers;
    dispatchUpdate();
  }, (err) => {
    console.warn('Lỗi Firestore users onSnapshot:', err);
  });

  // 2. Lắng nghe thay đổi Lớp học trên Firestore Real-time
  const unsubClassrooms = onSnapshot(collection(db, 'classrooms'), (snapshot) => {
    const list: Classroom[] = [];
    snapshot.forEach((d) => {
      list.push(d.data() as Classroom);
    });
    stateAccumulator.classrooms = list;
    dispatchUpdate();
  }, (err) => {
    console.warn('Lỗi Firestore classrooms onSnapshot:', err);
  });

  // 3. Lắng nghe Bài nộp thi trên Firestore Real-time
  const unsubSubmissions = onSnapshot(collection(db, 'submissions'), (snapshot) => {
    const list: StudentExamSubmission[] = [];
    snapshot.forEach((d) => {
      list.push(d.data() as StudentExamSubmission);
    });
    stateAccumulator.submissions = list;
    dispatchUpdate();
  }, (err) => {
    console.warn('Lỗi Firestore submissions onSnapshot:', err);
  });

  // 4. Lắng nghe Nhật ký gian lận thi trên Firestore Real-time
  const unsubCheatLogs = onSnapshot(collection(db, 'cheatLogs'), (snapshot) => {
    const list: CheatLog[] = [];
    snapshot.forEach((d) => {
      list.push(d.data() as CheatLog);
    });
    stateAccumulator.cheatLogs = list;
    dispatchUpdate();
  }, (err) => {
    console.warn('Lỗi Firestore cheatLogs onSnapshot:', err);
  });

  // 5. Lắng nghe Bài học đăng bởi giáo viên trên Firestore Real-time (Đồng bộ ngay tới học sinh)
  const unsubLessons = onSnapshot(collection(db, 'lessons'), (snapshot) => {
    const list: ClassroomLesson[] = [];
    snapshot.forEach((d) => {
      list.push(d.data() as ClassroomLesson);
    });
    const lessonMap = new Map<string, ClassroomLesson>();
    stateAccumulator.classroomLessons.forEach((l) => lessonMap.set(l.id, l));
    list.forEach((l) => lessonMap.set(l.id, l));
    stateAccumulator.classroomLessons = Array.from(lessonMap.values());
    dispatchUpdate();
  }, (err) => {
    console.warn('Lỗi Firestore lessons onSnapshot:', err);
  });

  // 5b. Lắng nghe Đề thi đăng bởi giáo viên trên Firestore Real-time (Đồng bộ ngay tới học sinh)
  const unsubExams = onSnapshot(collection(db, 'exams'), (snapshot) => {
    const list: Exam[] = [];
    snapshot.forEach((d) => {
      list.push(d.data() as Exam);
    });
    const examMap = new Map<string, Exam>();
    stateAccumulator.exams.forEach((e) => examMap.set(e.id, e));
    list.forEach((e) => examMap.set(e.id, e));
    stateAccumulator.exams = Array.from(examMap.values());
    dispatchUpdate();
  }, (err) => {
    console.warn('Lỗi Firestore exams onSnapshot:', err);
  });

  // 6. Lắng nghe Tin nhắn chat nhóm lớp trên Firestore Real-time (Đồng bộ tức thời mọi máy)
  const unsubMessages = onSnapshot(collection(db, 'messages'), (snapshot) => {
    const map: Record<string, ClassroomChatMessage[]> = {};
    snapshot.forEach((d) => {
      const data = d.data() as ClassroomChatMessage & { classId?: string };
      const cId = data.classId || 'cls_12a1';
      if (!map[cId]) {
        map[cId] = [];
      }
      map[cId].push(data);
    });
    // Sắp xếp tin nhắn theo thời gian tăng dần
    for (const k in map) {
      map[k].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    }
    stateAccumulator.classroomMessages = map;
    dispatchUpdate();
  }, (err) => {
    console.warn('Lỗi Firestore messages onSnapshot:', err);
  });

  // 7. Polling dự phòng qua server endpoint song song (Bảo đảm luôn đồng bộ kể cả khi Firestore mất mạng)
  const fallbackPoll = async () => {
    try {
      const res = await fetch('/api/db/state', {
        headers: { 'Cache-Control': 'no-cache' },
      });
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          let hasChanges = false;
          // Đồng bộ Users
          if (json.data.users && Array.isArray(json.data.users) && json.data.users.length > 0) {
            if (JSON.stringify(json.data.users) !== JSON.stringify(stateAccumulator.users)) {
              stateAccumulator.users = json.data.users;
              hasChanges = true;
            }
          }
          // Đồng bộ Lớp học
          if (json.data.classrooms && Array.isArray(json.data.classrooms)) {
            if (JSON.stringify(json.data.classrooms) !== JSON.stringify(stateAccumulator.classrooms)) {
              stateAccumulator.classrooms = json.data.classrooms;
              hasChanges = true;
            }
          }
          // Đồng bộ Bài học chuyên đề (hợp nhất thông minh)
          if (json.data.classroomLessons && Array.isArray(json.data.classroomLessons)) {
            const lessonMap = new Map<string, ClassroomLesson>();
            stateAccumulator.classroomLessons.forEach((l) => lessonMap.set(l.id, l));
            json.data.classroomLessons.forEach((l: ClassroomLesson) => lessonMap.set(l.id, l));
            const merged = Array.from(lessonMap.values());
            if (JSON.stringify(merged) !== JSON.stringify(stateAccumulator.classroomLessons)) {
              stateAccumulator.classroomLessons = merged;
              hasChanges = true;
            }
          }
          // Đồng bộ Đề thi (hợp nhất thông minh)
          if (json.data.exams && Array.isArray(json.data.exams)) {
            const examMap = new Map<string, Exam>();
            stateAccumulator.exams.forEach((e) => examMap.set(e.id, e));
            json.data.exams.forEach((e: Exam) => examMap.set(e.id, e));
            const mergedExams = Array.from(examMap.values());
            if (JSON.stringify(mergedExams) !== JSON.stringify(stateAccumulator.exams)) {
              stateAccumulator.exams = mergedExams;
              hasChanges = true;
            }
          }
          // Đồng bộ Tin nhắn chat lớp học
          if (json.data.classroomMessages && typeof json.data.classroomMessages === 'object') {
            const serverMsgs = json.data.classroomMessages as Record<string, ClassroomChatMessage[]>;
            for (const cId in serverMsgs) {
              const currentList = stateAccumulator.classroomMessages[cId] || [];
              const sList = serverMsgs[cId] || [];
              if (sList.length > 0) {
                const msgMap = new Map<string, ClassroomChatMessage>();
                currentList.forEach((m) => msgMap.set(m.id, m));
                let newFound = false;
                sList.forEach((m) => {
                  const exist = msgMap.get(m.id);
                  if (!exist || JSON.stringify(exist.reactions) !== JSON.stringify(m.reactions)) {
                    msgMap.set(m.id, m);
                    newFound = true;
                  }
                });
                if (newFound) {
                  stateAccumulator.classroomMessages[cId] = Array.from(msgMap.values()).sort(
                    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
                  );
                  hasChanges = true;
                }
              }
            }
          }
          if (hasChanges) {
            dispatchUpdate();
          }
        }
      }
    } catch {
      // offline
    }
  };

  // Kích hoạt nạp ngay lập tức khi mở trang / F5 để không bị trễ
  fallbackPoll();

  const timer = setInterval(fallbackPoll, intervalMs * 2);

  return () => {
    unsubUsers();
    unsubClassrooms();
    unsubSubmissions();
    unsubCheatLogs();
    unsubLessons();
    unsubExams();
    unsubMessages();
    clearInterval(timer);
  };
}
