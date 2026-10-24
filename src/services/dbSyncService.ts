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
import { db } from '../lib/firebase';
import {
  UserProfile,
  Classroom,
  StudentExamSubmission,
  CheatLog,
  ClassroomLesson,
  ClassroomChatMessage,
} from '../types/math';

export interface DatabaseState {
  version: number;
  lastUpdated: string;
  users: UserProfile[];
  classrooms: Classroom[];
  submissions: StudentExamSubmission[];
  cheatLogs: CheatLog[];
  classroomLessons: ClassroomLesson[];
  classroomMessages: Record<string, ClassroomChatMessage[]>;
}

export const DEFAULT_ADMIN_PROFILE: UserProfile = {
  id: 'usr_admin_01',
  name: 'Ban Giám Hiệu - Quản Trị Hệ Thống',
  email: 'admin@thpt-nbk.edu.vn',
  role: 'admin',
  tier: 'premium',
  xp: 15000,
  streakDays: 1,
  lastActiveDate: new Date().toISOString().split('T')[0],
  dailyScanCount: 0,
  maxDailyScans: 9999,
  grade: 12,
  avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=AdminNBK',
  schoolName: 'THPT Chuyên Nguyễn Bỉnh Khiêm',
  phone: '024 3858 1234',
  bio: 'Quản trị viên toàn quyền hệ thống Math&NBK.',
  password: 'AdminNBK@2025',
  status: 'active',
};

// Đảm bảo luôn có tài khoản Admin mẫu trên Firestore khi khởi động
let adminSeeded = false;
async function ensureAdminSeeded() {
  if (adminSeeded) return;
  adminSeeded = true;
  try {
    const adminRef = doc(db, 'users', DEFAULT_ADMIN_PROFILE.id);
    const snap = await getDoc(adminRef);
    if (!snap.exists()) {
      await setDoc(adminRef, DEFAULT_ADMIN_PROFILE);
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
  try {
    for (const c of classrooms) {
      await setDoc(doc(db, 'classrooms', c.id), c, { merge: true });
    }
    fetch('/api/db/classrooms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ classrooms }),
    }).catch(() => {});
    return true;
  } catch {
    return false;
  }
}

/**
 * Lưu kết quả bài làm thi của học sinh
 */
export async function dbSaveSubmission(submission: StudentExamSubmission): Promise<boolean> {
  try {
    await setDoc(doc(db, 'submissions', submission.id), submission, { merge: true });

    fetch('/api/db/submissions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ submission }),
    }).catch(() => {});

    return true;
  } catch {
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
 * Lưu bài học chuyên đề lớp học
 */
export async function dbSaveLessons(lessons: ClassroomLesson[]): Promise<boolean> {
  try {
    for (const les of lessons) {
      await setDoc(doc(db, 'lessons', les.id), les, { merge: true });
    }
    fetch('/api/db/lessons', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lessons }),
    }).catch(() => {});
    return true;
  } catch {
    return false;
  }
}

/**
 * Lưu tin nhắn chat trong nhóm lớp
 */
export async function dbSaveMessage(classId: string, message: ClassroomChatMessage): Promise<boolean> {
  try {
    await setDoc(doc(db, 'messages', message.id), { ...message, classId }, { merge: true });

    fetch('/api/db/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ classId, message }),
    }).catch(() => {});

    return true;
  } catch {
    return false;
  }
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

    // Luôn bảo đảm có tài khoản admin
    if (!usersList.some((u) => u.id === DEFAULT_ADMIN_PROFILE.id)) {
      usersList.unshift(DEFAULT_ADMIN_PROFILE);
    }

    stateAccumulator.users = usersList;
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

  // 5. Polling dự phòng qua server endpoint song song
  const fallbackPoll = async () => {
    try {
      const res = await fetch('/api/db/state', {
        headers: { 'Cache-Control': 'no-cache' },
      });
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          if (json.data.users && json.data.users.length > stateAccumulator.users.length) {
            stateAccumulator.users = json.data.users;
            dispatchUpdate();
          }
        }
      }
    } catch {
      // offline
    }
  };

  const timer = setInterval(fallbackPoll, intervalMs * 2);

  return () => {
    unsubUsers();
    unsubClassrooms();
    unsubSubmissions();
    unsubCheatLogs();
    clearInterval(timer);
  };
}
