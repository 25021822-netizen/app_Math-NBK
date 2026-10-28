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
  Exam,
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
 * Tối ưu hóa dữ liệu bài học khi lưu lên Firestore (giới hạn tài liệu < 1MB)
 */
function sanitizeLessonForFirestore(lesson: ClassroomLesson): ClassroomLesson {
  const copy = { ...lesson };
  if (copy.pdfAttachment && copy.pdfAttachment.fileData && copy.pdfAttachment.fileData.length > 400000) {
    copy.pdfAttachment = { ...copy.pdfAttachment, fileData: '' };
  }
  if (copy.practicePdfAttachment && copy.practicePdfAttachment.fileData && copy.practicePdfAttachment.fileData.length > 400000) {
    copy.practicePdfAttachment = { ...copy.practicePdfAttachment, fileData: '' };
  }
  if (copy.attachments && Array.isArray(copy.attachments)) {
    copy.attachments = copy.attachments.map((att) => {
      if (att.url && att.url.length > 400000) {
        return { ...att, url: '' };
      }
      return att;
    });
  }
  return copy;
}

/**
 * Lưu 1 bài học chuyên đề lớp học (Thêm mới hoặc Cập nhật) - Đồng bộ Real-Time
 */
export async function dbSaveLesson(lesson: ClassroomLesson): Promise<boolean> {
  try {
    const firestorePayload = sanitizeLessonForFirestore(lesson);
    await setDoc(doc(db, 'lessons', lesson.id), firestorePayload, { merge: true });
    fetch('/api/db/lesson/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lesson }),
    }).catch(() => {});
    return true;
  } catch (err) {
    console.warn('Lỗi dbSaveLesson Firestore, lưu qua server:', err);
    try {
      await fetch('/api/db/lesson/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lesson }),
      });
      return true;
    } catch {
      return false;
    }
  }
}

/**
 * Xóa 1 bài học chuyên đề khỏi Firestore & Server
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
      const firestorePayload = sanitizeLessonForFirestore(les);
      await setDoc(doc(db, 'lessons', les.id), firestorePayload, { merge: true });
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
 * Lưu 1 đề thi mới hoặc cập nhật đề thi (Đồng bộ Real-Time cả Firestore và Server)
 * Giúp học sinh thấy đề thi ngay lập tức khi giáo viên đăng bài
 */
export async function dbSaveExam(exam: Exam): Promise<boolean> {
  try {
    await setDoc(doc(db, 'exams', exam.id), exam, { merge: true });
    fetch('/api/db/exam/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ exam }),
    }).catch(() => {});
    return true;
  } catch (err) {
    console.warn('Lỗi dbSaveExam Firestore, chuyển hướng qua server:', err);
    try {
      await fetch('/api/db/exam/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ exam }),
      });
      return true;
    } catch {
      return false;
    }
  }
}

/**
 * Xóa 1 đề thi khỏi Firestore & Server
 */
export async function dbDeleteExam(examId: string): Promise<boolean> {
  try {
    await deleteDoc(doc(db, 'exams', examId));
    fetch('/api/db/exam/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ examId }),
    }).catch(() => {});
    return true;
  } catch (err) {
    console.warn('Lỗi dbDeleteExam Firestore:', err);
    return false;
  }
}

/**
 * Lưu danh sách đề thi đồng bộ lên Firestore & Server
 */
export async function dbSaveExams(exams: Exam[]): Promise<boolean> {
  try {
    for (const ex of exams) {
      await setDoc(doc(db, 'exams', ex.id), ex, { merge: true });
    }
    fetch('/api/db/exams', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ exams }),
    }).catch(() => {});
    return true;
  } catch {
    return false;
  }
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
    stateAccumulator.classroomLessons = list;
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
    stateAccumulator.exams = list;
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
          // Đồng bộ Bài học chuyên đề
          if (json.data.classroomLessons && Array.isArray(json.data.classroomLessons)) {
            if (JSON.stringify(json.data.classroomLessons) !== JSON.stringify(stateAccumulator.classroomLessons)) {
              stateAccumulator.classroomLessons = json.data.classroomLessons;
              hasChanges = true;
            }
          }
          // Đồng bộ Đề thi
          if (json.data.exams && Array.isArray(json.data.exams)) {
            if (JSON.stringify(json.data.exams) !== JSON.stringify(stateAccumulator.exams)) {
              stateAccumulator.exams = json.data.exams;
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
