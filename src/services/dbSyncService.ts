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

let currentLocalVersion = 0;
let isSyncing = false;

/**
 * Lấy toàn bộ trạng thái cơ sở dữ liệu đồng bộ từ máy chủ (Server Database)
 */
export async function fetchDbState(): Promise<DatabaseState | null> {
  try {
    const res = await fetch('/api/db/state', {
      headers: { 'Cache-Control': 'no-cache' },
    });
    if (!res.ok) return null;
    const json = await res.json();
    if (json.success && json.data) {
      currentLocalVersion = json.version || json.data.version || 1;
      return json.data;
    }
    return null;
  } catch (err) {
    // Khi đang offline hoặc máy chủ chưa sẵn sàng
    return null;
  }
}

/**
 * Gửi yêu cầu đăng ký tài khoản mới lên cơ sở dữ liệu máy chủ
 */
export async function dbRegisterUser(newUser: UserProfile): Promise<{ success: boolean; error?: string; user?: UserProfile }> {
  try {
    const res = await fetch('/api/db/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user: newUser }),
    });
    const data = await res.json();
    if (data.version) currentLocalVersion = data.version;
    return data;
  } catch (err: any) {
    return { success: false, error: err.message || 'Không thể kết nối đến máy chủ đồng bộ.' };
  }
}

/**
 * Admin duyệt phê duyệt tài khoản (đồng bộ ngay sang tất cả thiết bị khác)
 */
export async function dbApproveUser(userId: string): Promise<boolean> {
  try {
    const res = await fetch('/api/db/user/approve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId }),
    });
    const data = await res.json();
    if (data.version) currentLocalVersion = data.version;
    return !!data.success;
  } catch {
    return false;
  }
}

/**
 * Admin từ chối yêu cầu đăng ký
 */
export async function dbRejectUser(userId: string, reason?: string): Promise<boolean> {
  try {
    const res = await fetch('/api/db/user/reject', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, reason }),
    });
    const data = await res.json();
    if (data.version) currentLocalVersion = data.version;
    return !!data.success;
  } catch {
    return false;
  }
}

/**
 * Admin xóa tài khoản
 */
export async function dbDeleteUser(userId: string): Promise<boolean> {
  try {
    const res = await fetch('/api/db/user/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId }),
    });
    const data = await res.json();
    if (data.version) currentLocalVersion = data.version;
    return !!data.success;
  } catch {
    return false;
  }
}

/**
 * Cập nhật thông tin tài khoản
 */
export async function dbUpdateUser(user: UserProfile): Promise<boolean> {
  try {
    const res = await fetch('/api/db/user/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user }),
    });
    const data = await res.json();
    if (data.version) currentLocalVersion = data.version;
    return !!data.success;
  } catch {
    return false;
  }
}

/**
 * Đồng bộ danh sách lớp học
 */
export async function dbSaveClassrooms(classrooms: Classroom[]): Promise<boolean> {
  try {
    const res = await fetch('/api/db/classrooms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ classrooms }),
    });
    const data = await res.json();
    if (data.version) currentLocalVersion = data.version;
    return !!data.success;
  } catch {
    return false;
  }
}

/**
 * Lưu kết quả bài làm thi của học sinh
 */
export async function dbSaveSubmission(submission: StudentExamSubmission): Promise<boolean> {
  try {
    const res = await fetch('/api/db/submissions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ submission }),
    });
    const data = await res.json();
    if (data.version) currentLocalVersion = data.version;
    return !!data.success;
  } catch {
    return false;
  }
}

/**
 * Lưu nhật ký vi phạm quy chế thi
 */
export async function dbSaveCheatLog(log: CheatLog): Promise<boolean> {
  try {
    const res = await fetch('/api/db/cheat-logs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ log }),
    });
    const data = await res.json();
    if (data.version) currentLocalVersion = data.version;
    return !!data.success;
  } catch {
    return false;
  }
}

/**
 * Lưu bài học chuyên đề lớp học
 */
export async function dbSaveLessons(lessons: ClassroomLesson[]): Promise<boolean> {
  try {
    const res = await fetch('/api/db/lessons', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lessons }),
    });
    const data = await res.json();
    if (data.version) currentLocalVersion = data.version;
    return !!data.success;
  } catch {
    return false;
  }
}

/**
 * Lưu tin nhắn chat trong nhóm lớp
 */
export async function dbSaveMessage(classId: string, message: ClassroomChatMessage): Promise<boolean> {
  try {
    const res = await fetch('/api/db/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ classId, message }),
    });
    const data = await res.json();
    if (data.version) currentLocalVersion = data.version;
    return !!data.success;
  } catch {
    return false;
  }
}

/**
 * Thiết lập cơ chế tự động đồng bộ (Polling Real-Time Synchronization giữa các máy)
 */
export function startDbPolling(
  onRemoteUpdate: (state: DatabaseState) => void,
  intervalMs = 3500
): () => void {
  const poll = async () => {
    if (isSyncing) return;
    isSyncing = true;
    try {
      const res = await fetch(`/api/db/state?v=${currentLocalVersion}`, {
        headers: { 'Cache-Control': 'no-cache' },
      });
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          const serverVer = json.data.version || 1;
          if (serverVer > currentLocalVersion || currentLocalVersion === 0) {
            currentLocalVersion = serverVer;
            onRemoteUpdate(json.data);
          }
        }
      }
    } catch {
      // offline fallback
    } finally {
      isSyncing = false;
    }
  };

  // Poll lần đầu ngay lập tức
  poll();

  const timer = setInterval(poll, intervalMs);
  return () => clearInterval(timer);
}
