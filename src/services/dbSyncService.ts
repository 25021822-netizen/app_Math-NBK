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
/**
 * Lưu 1 bài học chuyên đề lớp học (Thêm mới hoặc Cập nhật)
 */
export async function dbSaveLesson(lesson: ClassroomLesson): Promise<boolean> {
  try {
    await setDoc(doc(db, 'lessons', lesson.id), lesson, { merge: true });
    fetch('/api/db/lesson/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lesson }),
    }).catch(() => {});
    return true;
  } catch (err) {
    console.warn('Lỗi dbSaveLesson Firestore:', err);
    return false;
  }
}

/**
 * Xóa 1 bài học chuyên đề khỏi Firestore
 */
export async function dbDeleteLesson(lessonId: string): Promise<boolean> {
  try {
    await deleteDoc(doc(db, 'lessons', lessonId));
    fetch('/api/db/lesson/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lessonId }),
    }).catch(() => {});
    return true;
  } catch (err) {
    console.warn('Lỗi dbDeleteLesson Firestore:', err);
    return false;
  }
}

/**
 * Lưu danh sách bài học chuyên đề lớp học
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
 * Thả / Hủy tương tác biểu cảm Emoji trên tin nhắn chat (Đồng bộ Real-time mọi máy)
 */
export async function dbToggleMessageReaction(
  classId: string,
  messageId: string,
  emoji: string,
  userId: string
): Promise<boolean> {
  try {
    const msgRef = doc(db, 'messages', messageId);
    const snap = await getDoc(msgRef);
    if (!snap.exists()) return false;
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
    fetch('/api/db/message/reaction', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ classId, messageId, emoji, userId }),
    }).catch(() => {});
    return true;
  } catch (err) {
    console.warn('Lỗi dbToggleMessageReaction Firestore:', err);
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
    stateAccumulator.classroomLessons = list;
    dispatchUpdate();
  }, (err) => {
    console.warn('Lỗi Firestore lessons onSnapshot:', err);
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

  // 7. Polling dự phòng qua server endpoint song song
  const fallbackPoll = async () => {
    try {
      const res = await fetch('/api/db/state', {
        headers: { 'Cache-Control': 'no-cache' },
      });
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          let hasChanges = false;
          if (json.data.users && json.data.users.length > stateAccumulator.users.length) {
            stateAccumulator.users = json.data.users;
            hasChanges = true;
          }
          if (json.data.classroomLessons && json.data.classroomLessons.length > stateAccumulator.classroomLessons.length) {
            stateAccumulator.classroomLessons = json.data.classroomLessons;
            hasChanges = true;
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

  const timer = setInterval(fallbackPoll, intervalMs * 2);

  return () => {
    unsubUsers();
    unsubClassrooms();
    unsubSubmissions();
    unsubCheatLogs();
    unsubLessons();
    unsubMessages();
    clearInterval(timer);
  };
}
