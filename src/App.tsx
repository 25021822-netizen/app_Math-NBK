/**
 * Math&NBK - Ứng Dụng Học Toán THPT Thông Minh
 * Bản Quyền: Math&NBK Education Platform
 */

import React, { useState, useEffect, useMemo, useRef, lazy, Suspense } from 'react';
import {
  UserProfile,
  UserRole,
  CheatLog,
  Exam,
  Classroom,
  StudentExamSubmission,
  ClassroomLesson,
  ClassroomChatMessage,
  AutoApprovalSettings,
  ScoreVisibilityMode,
  AdminBroadcastMessage,
  BroadcastTargetAudience,
  BroadcastCategory,
  sortAdminBroadcasts,
  isBroadcastVisibleToRole,
  getBroadcastAudienceLabel,
  canStudentViewExamScore,
  canAccessSubjectTab,
  getTeacherSubjectTab,
} from './types/math';
import {
  classifyScoreByScale,
  formatPointsNumber,
  getExamScaleInfo,
} from './lib/scoringEngine';
import { pickPreferredImageUrl } from './services/examImageService';
import {
  fetchDbState,
  startDbPolling,
  dbApproveUser,
  dbApproveAllUsers,
  dbFetchAdminSettings,
  dbSaveAdminSettings,
  dbRejectUser,
  dbDeleteUser,
  dbUpdateUser,
  dbSaveClassrooms,
  dbSaveSubmission,
  dbDeleteSubmission,
  dbDeleteSubmissionsBatch,
  dbSaveCheatLog,
  dbDeleteCheatLog,
  dbClearAllCheatLogs,
  dbSaveLessons,
  dbSaveLesson,
  dbDeleteLesson,
  dbSaveExam,
  dbDeleteExam,
  dbSaveExams,
  dbSaveMessage,
  dbDeleteMessage,
  dbToggleMessageReaction,
  dbDisbandClassroom,
  dbSendAdminBroadcast,
  dbTogglePinAdminBroadcast,
  dbDismissBroadcastForUser,
  dbDeleteAdminBroadcastGlobally,
  getLocallyDismissedBroadcastIds,
  markBroadcastDismissedLocally,
  isExamDeletedLocally,
  isExamRecentlySaved,
  clearExamDeletedLocally,
  markExamRecentlySaved,
} from './services/dbSyncService';
import { Navbar } from './components/Navbar';
const ExamEngineView = lazy(() =>
  import('./components/student/ExamEngineView').then((m) => ({ default: m.ExamEngineView }))
);
const StudentHistoryView = lazy(() =>
  import('./components/student/StudentHistoryView').then((m) => ({ default: m.StudentHistoryView }))
);
const UserProfileView = lazy(() =>
  import('./components/student/UserProfileView').then((m) => ({ default: m.UserProfileView }))
);
const ClassroomManagerView = lazy(() =>
  import('./components/classroom/ClassroomManagerView').then((m) => ({ default: m.ClassroomManagerView }))
);
const TeacherPortalView = lazy(() =>
  import('./components/teacher/TeacherPortalView').then((m) => ({ default: m.TeacherPortalView }))
);
const TeacherGradebookView = lazy(() =>
  import('./components/teacher/TeacherGradebookView').then((m) => ({ default: m.TeacherGradebookView }))
);
const GeometryCanvasView = lazy(() =>
  import('./components/geometry/GeometryCanvasView').then((m) => ({ default: m.GeometryCanvasView }))
);
const PhysicsSimulationLabView = lazy(() =>
  import('./components/physics/PhysicsSimulationLabView').then((m) => ({ default: m.PhysicsSimulationLabView }))
);
const ChemistryExperimentLabView = lazy(() =>
  import('./components/chemistry/ChemistryExperimentLabView').then((m) => ({ default: m.ChemistryExperimentLabView }))
);
import { InkNotesView } from './components/notes/InkNotesView';
const AdminDashboardView = lazy(() =>
  import('./components/admin/AdminDashboardView').then((m) => ({ default: m.AdminDashboardView }))
);
const AdminBroadcastView = lazy(() =>
  import('./components/admin/AdminBroadcastView').then((m) => ({ default: m.AdminBroadcastView }))
);
const AuthLoginView = lazy(() =>
  import('./components/auth/AuthLoginView').then((m) => ({ default: m.AuthLoginView }))
);
import {
  triggerPushNotification,
  requestNotificationPermission,
  PushNotificationItem,
} from './utils/notificationService';
import {
  BookOpen,
  Camera,
  MessageSquare,
  Award,
  Users,
  FileCheck,
  BarChart3,
  FileText,
  Compass,
  User,
  Bell,
  X,
  ShieldAlert,
  LogOut,
  AlertTriangle,
  CheckCircle2,
  Atom,
  FlaskConical,
} from 'lucide-react';

const SESSION_MAX_AGE_MS = 24 * 60 * 60 * 1000;
const SESSION_LOGIN_AT_KEY = 'math_nbk_session_login_at';

const INITIAL_USER_PROFILE: UserProfile = {
  id: '',
  name: '',
  email: '',
  role: 'student',
  tier: 'free',
  xp: 0,
  streakDays: 0,
  lastActiveDate: '',
  dailyScanCount: 0,
  maxDailyScans: 5,
  grade: 12,
  status: 'active',
};

function clearStoredAuthSession() {
  try {
    localStorage.removeItem('math_nbk_auth_user');
    localStorage.removeItem(SESSION_LOGIN_AT_KEY);
    sessionStorage.removeItem('math_nbk_auth_session');
    sessionStorage.removeItem('math_nbk_admin_session');
    sessionStorage.removeItem(SESSION_LOGIN_AT_KEY);
  } catch {}
}

function getRestoredAuthSession(): {
  isAuth: boolean;
  user: UserProfile;
  remembered: boolean;
  loginAt: number | null;
  expiredNotice: string | null;
} {
  try {
    const localSaved = localStorage.getItem('math_nbk_auth_user');
    const sessionSaved = sessionStorage.getItem('math_nbk_auth_session');
    const raw = localSaved || sessionSaved;
    if (!raw) {
      return { isAuth: false, user: INITIAL_USER_PROFILE, remembered: true, loginAt: null, expiredNotice: null };
    }
    const parsed = JSON.parse(raw);
    if (!parsed || !parsed.id || parsed.role === 'admin') {
      clearStoredAuthSession();
      return { isAuth: false, user: INITIAL_USER_PROFILE, remembered: true, loginAt: null, expiredNotice: null };
    }

    const rawLoginAt = localSaved
      ? localStorage.getItem(SESSION_LOGIN_AT_KEY)
      : sessionStorage.getItem(SESSION_LOGIN_AT_KEY);
    const loginAt = rawLoginAt ? Number(rawLoginAt) : Number(parsed._sessionLoginAt);

    if (!Number.isFinite(loginAt) || loginAt <= 0 || Date.now() - loginAt >= SESSION_MAX_AGE_MS) {
      const wasExpired = Number.isFinite(loginAt) && loginAt > 0 && Date.now() - loginAt >= SESSION_MAX_AGE_MS;
      clearStoredAuthSession();
      return {
        isAuth: false,
        user: INITIAL_USER_PROFILE,
        remembered: true,
        loginAt: null,
        expiredNotice: wasExpired
          ? 'Phiên đăng nhập đã hết hạn sau 24 giờ. Vui lòng đăng nhập lại để tiếp tục!'
          : null,
      };
    }

    return {
      isAuth: true,
      user: parsed as UserProfile,
      remembered: Boolean(localSaved),
      loginAt,
      expiredNotice: null,
    };
  } catch {
    clearStoredAuthSession();
    return { isAuth: false, user: INITIAL_USER_PROFILE, remembered: true, loginAt: null, expiredNotice: null };
  }
}

interface TabErrorBoundaryState {
  hasError: boolean;
  errorMsg: string;
}

class TabErrorBoundary extends React.Component<
  { resetKey: string; children: React.ReactNode },
  TabErrorBoundaryState
> {
  state: TabErrorBoundaryState = { hasError: false, errorMsg: '' };

  static getDerivedStateFromError(error: Error): TabErrorBoundaryState {
    return { hasError: true, errorMsg: error?.message || 'Lỗi hiển thị giao diện' };
  }

  componentDidUpdate(prevProps: { resetKey: string }) {
    if (prevProps.resetKey !== this.props.resetKey && this.state.hasError) {
      this.setState({ hasError: false, errorMsg: '' });
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="max-w-lg mx-auto my-12 bg-white border border-rose-200 rounded-2xl p-6 text-center shadow-sm space-y-3">
          <h3 className="text-base font-bold text-slate-900">Không thể tải mục này</h3>
          <p className="text-xs text-slate-600">{this.state.errorMsg}</p>
          <button
            type="button"
            onClick={() => this.setState({ hasError: false, errorMsg: '' })}
            className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold cursor-pointer"
          >
            Thử tải lại
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  const [initialSession] = useState(() => getRestoredAuthSession());
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(initialSession.isAuth);
  const [sessionLoginAt, setSessionLoginAt] = useState<number | null>(initialSession.loginAt);
  const [sessionExpiredNotice, setSessionExpiredNotice] = useState<string | null>(initialSession.expiredNotice);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState<boolean>(false);
  const [currentTab, setCurrentTab] = useState<string>(
    initialSession.isAuth && initialSession.user.role === 'admin' ? 'admin_dashboard' : 'classroom'
  );
  const [userRole, setUserRole] = useState<UserRole>(
    initialSession.isAuth ? initialSession.user.role : 'student'
  );
  const [userProfile, setUserProfile] = useState<UserProfile>(initialSession.user);
  const rememberSessionRef = useRef<boolean>(initialSession.remembered);
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
  const [cheatLogs, setCheatLogs] = useState<CheatLog[]>([]);
  const [examsList, setExamsList] = useState<Exam[]>(() => {
    try {
      const s = localStorage.getItem('math_liki_exams');
      const parsed: Exam[] = s ? JSON.parse(s) : [];
      return Array.isArray(parsed)
        ? parsed.filter((e) => e && e.id && e.id !== 'exam_bgd_2025_01' && !isExamDeletedLocally(e.id))
        : [];
    } catch {
      return [];
    }
  });
  const [activeExamId, setActiveExamId] = useState<string>('');

  // Nhóm lớp, Bài học & Kết quả bài nộp của học sinh (Đồng bộ qua máy chủ và localStorage)
  const [classrooms, setClassrooms] = useState<Classroom[]>(() => {
    try {
      const s = localStorage.getItem('math_liki_classrooms');
      const parsed: Classroom[] = s ? JSON.parse(s) : [];
      return Array.isArray(parsed)
        ? parsed.map((c) => ({
            ...c,
            assignedExamIds: (c.assignedExamIds || []).filter((eid) => !isExamDeletedLocally(eid)),
          }))
        : [];
    } catch {
      return [];
    }
  });
  const [submissions, setSubmissions] = useState<StudentExamSubmission[]>([]);
  const [classroomLessons, setClassroomLessons] = useState<ClassroomLesson[]>([]);
  const [classroomMessages, setClassroomMessages] = useState<Record<string, ClassroomChatMessage[]>>({});
  const [adminBroadcasts, setAdminBroadcasts] = useState<AdminBroadcastMessage[]>(() => {
    try {
      const s = localStorage.getItem('math_liki_admin_broadcasts');
      const parsed = s ? JSON.parse(s) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });
  const [broadcastDismissTick, setBroadcastDismissTick] = useState<number>(0);

  // Cấu hình Duyệt Tự Động của Admin (Auto-Approval Settings)
  const [autoApprovalSettings, setAutoApprovalSettings] = useState<AutoApprovalSettings>({
    enabled: true,
    autoApproveStudents: true,
    autoApproveTeachers: true,
    defaultTier: 'free',
  });

  // Tải cấu hình duyệt tự động từ Server DB hoặc Cache
  useEffect(() => {
    dbFetchAdminSettings().then((settings) => {
      if (settings) {
        setAutoApprovalSettings(settings);
      }
    }).catch(console.error);
  }, []);

  // Quản lý thông báo đẩy (Push Notifications)
  const [notifications, setNotifications] = useState<PushNotificationItem[]>([
    {
      id: 'notif_welcome',
      title: 'Chào mừng bạn đến với Toán Học LIKI',
      message: 'Nền tảng học tập và luyện thi Toán THPT trực tuyến.',
      type: 'system',
      timestamp: new Date().toISOString(),
      isRead: false,
      targetTab: 'classroom',
    },
  ]);
  const [floatingToasts, setFloatingToasts] = useState<PushNotificationItem[]>([]);
  const [externalClassJump, setExternalClassJump] = useState<{
    classId: string;
    tab?: 'curriculum' | 'chat';
    lessonId?: string;
    nonce: number;
  } | null>(null);
  const deletedExamIdsRef = useRef<Set<string>>(new Set());

  // Theo dõi thời điểm đọc tin nhắn của từng nhóm lớp để tính số tin chưa đọc (Unread badge)
  const [lastReadChatMap, setLastReadChatMap] = useState<Record<string, number>>(() => {
    try {
      const raw = localStorage.getItem('math_nbk_last_read_chat');
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  });

  // Khi người dùng đang ở tab classroom, tự động đánh dấu đã đọc tất cả tin nhắn lớp của mình
  useEffect(() => {
    if (currentTab === 'classroom' && isAuthenticated) {
      const now = Date.now();
      setLastReadChatMap((prev) => {
        const next = { ...prev };
        classrooms.forEach((c) => {
          next[c.id] = now;
          if (c.code) next[c.code] = now;
        });
        try {
          localStorage.setItem('math_nbk_last_read_chat', JSON.stringify(next));
        } catch {}
        return next;
      });
    }
  }, [currentTab, classrooms, isAuthenticated]);

  // Kiểm tra thời hạn phiên đăng nhập 24 giờ liên tục (tự động đăng xuất khi đủ 24h, kể cả khi mở tab/ngủ máy)
  useEffect(() => {
    if (!isAuthenticated) return;

    const expireSessionNow = () => {
      clearStoredAuthSession();
      setShowLogoutConfirm(false);
      setIsAuthenticated(false);
      setUserProfile(INITIAL_USER_PROFILE);
      setUserRole('student');
      setCurrentTab('classroom');
      setSessionLoginAt(null);
      setSessionExpiredNotice('Phiên đăng nhập đã hết hạn sau 24 giờ. Vui lòng đăng nhập lại để tiếp tục!');
    };

    if (!sessionLoginAt || !Number.isFinite(sessionLoginAt)) {
      expireSessionNow();
      return;
    }

    const checkRemaining = () => {
      const elapsed = Date.now() - sessionLoginAt;
      if (elapsed >= SESSION_MAX_AGE_MS) {
        expireSessionNow();
        return true;
      }
      return false;
    };

    if (checkRemaining()) return;

    const remainingMs = Math.max(0, sessionLoginAt + SESSION_MAX_AGE_MS - Date.now());
    const exactTimer = setTimeout(expireSessionNow, remainingMs);
    const interval = setInterval(checkRemaining, 30000);
    const handleVisibilityOrFocus = () => {
      checkRemaining();
    };
    window.addEventListener('focus', handleVisibilityOrFocus);
    document.addEventListener('visibilitychange', handleVisibilityOrFocus);

    return () => {
      clearTimeout(exactTimer);
      clearInterval(interval);
      window.removeEventListener('focus', handleVisibilityOrFocus);
      document.removeEventListener('visibilitychange', handleVisibilityOrFocus);
    };
  }, [isAuthenticated, sessionLoginAt]);

  // Danh sách thông báo Admin hiển thị ở Nhóm Lớp (tin ghim luôn ở trên cùng và không bị xóa bởi người dùng)
  const visibleBroadcastsForUser = useMemo(() => {
    const normId = (userProfile.id || '').trim().toLowerCase();
    const normEmail = (userProfile.email || '').trim().toLowerCase();
    const localDismissedSet = new Set(
      getLocallyDismissedBroadcastIds(userProfile.id).map((id) => id.trim())
    );
    const filtered = (adminBroadcasts || []).filter((b) => {
      if (!b || !b.id) return false;
      if (!isBroadcastVisibleToRole(b, userProfile.role)) return false;
      if (b.isPinned) return true;
      if (localDismissedSet.has(b.id)) return false;
      const deletedIds = Array.isArray(b.deletedByUserIds) ? b.deletedByUserIds : [];
      const isDeletedByMe = deletedIds.some((uid) => {
        const lowerUid = String(uid || '').trim().toLowerCase();
        return (normId && lowerUid === normId) || (normEmail && lowerUid === normEmail);
      });
      return !isDeletedByMe;
    });
    return sortAdminBroadcasts(filtered);
  }, [adminBroadcasts, userProfile.id, userProfile.email, userProfile.role, broadcastDismissTick]);

  // Kiểm tra quyền nhìn thấy / là thành viên hợp lệ của nhóm lớp
  // - Giáo viên: CHỈ được nhìn thấy và vào các lớp do chính mình tạo (kể cả lớp công khai của giáo viên khác)
  // - Học sinh: thấy các lớp công khai để nhập mã tham gia, và các lớp cá nhân mà mình đã là thành viên
  // - Admin: thấy toàn bộ
  const canUserSeeClassroom = (cls: Classroom | undefined | null, user: UserProfile): boolean => {
    if (!cls) return false;
    const lowerId = (user.id || '').toLowerCase().trim();
    const isOwnerTeacher = Boolean(lowerId && (cls.teacherId || '').toLowerCase().trim() === lowerId);

    if (user.role === 'teacher') {
      return isOwnerTeacher;
    }

    if (user.role === 'admin') {
      return true;
    }

    if (cls.visibility !== 'private') return true;
    const lowerEmail = (user.email || '').toLowerCase().trim();
    const isEnrolledStudent = Boolean(
      cls.studentIds &&
      cls.studentIds.some((sId) => {
        const lowerS = (sId || '').toLowerCase().trim();
        return (lowerId && lowerS === lowerId) || (lowerEmail && lowerS === lowerEmail);
      })
    );
    return isEnrolledStudent;
  };

  const visibleClassrooms = useMemo(
    () => classrooms.filter((c) => canUserSeeClassroom(c, userProfile)),
    [classrooms, userProfile]
  );

  const teacherOwnedClassIdSet = useMemo(() => {
    const ids = new Set<string>();
    if (userProfile.role !== 'teacher') return ids;
    const lowerId = (userProfile.id || '').toLowerCase().trim();
    classrooms.forEach((c) => {
      if (lowerId && (c.teacherId || '').toLowerCase().trim() === lowerId) {
        ids.add(c.id);
      }
    });
    return ids;
  }, [classrooms, userProfile.id, userProfile.role]);

  // Kiểm tra quyền giáo viên đối với từng đề thi (chỉ thấy đề do chính mình tạo hoặc thuộc lớp của mình, tuyệt đối không thấy kho đề chung/đề của giáo viên khác)
  const canTeacherAccessExam = (exam: Exam, user: UserProfile, allClasses: Classroom[]): boolean => {
    if (!exam || !exam.id) return false;
    if (user.role !== 'teacher') return true;

    const lowerUserId = (user.id || '').toLowerCase().trim();
    const lowerUserEmail = (user.email || '').toLowerCase().trim();
    const lowerUserName = (user.name || '').toLowerCase().trim();

    const ownerId = (exam.teacherId || exam.createdById || '').toLowerCase().trim();
    const ownerEmail = (exam.createdByEmail || '').toLowerCase().trim();

    if (ownerId) {
      return Boolean(lowerUserId && ownerId === lowerUserId);
    }
    if (ownerEmail) {
      return Boolean(lowerUserEmail && ownerEmail === lowerUserEmail);
    }

    // Dữ liệu đề thi cũ chưa có teacherId/createdById: kiểm tra theo lớp của giáo viên hoặc tên người tạo cụ thể
    const ownedClassIds = new Set(
      allClasses
        .filter((c) => lowerUserId && (c.teacherId || '').toLowerCase().trim() === lowerUserId)
        .map((c) => c.id)
    );
    const assignedClassIds = new Set<string>(exam.targetClassIds || []);
    allClasses.forEach((c) => {
      if (c.assignedExamIds && c.assignedExamIds.includes(exam.id)) {
        assignedClassIds.add(c.id);
      }
    });

    if (assignedClassIds.size > 0) {
      return Array.from(assignedClassIds).some((cid) => ownedClassIds.has(cid));
    }

    const creatorName = (exam.createdBy || '').toLowerCase().trim();
    const genericNames = new Set(['giáo viên', 'admin', 'máy quét ocr liki', 'tổ bộ môn']);
    if (creatorName && !genericNames.has(creatorName) && lowerUserName && creatorName === lowerUserName) {
      return true;
    }

    return false;
  };

  const visibleTeacherExams = useMemo(() => {
    if (userProfile.role !== 'teacher') return examsList;
    return examsList.filter((ex) => canTeacherAccessExam(ex, userProfile, classrooms));
  }, [examsList, userProfile, classrooms]);

  const visibleTeacherExamIdSet = useMemo(
    () => new Set(visibleTeacherExams.map((e) => e.id)),
    [visibleTeacherExams]
  );

  const visibleTeacherSubmissions = useMemo(() => {
    if (userProfile.role !== 'teacher') return submissions;
    return submissions.filter(
      (sub) =>
        (sub.classId && teacherOwnedClassIdSet.has(sub.classId)) ||
        (sub.examId && visibleTeacherExamIdSet.has(sub.examId))
    );
  }, [submissions, userProfile.role, teacherOwnedClassIdSet, visibleTeacherExamIdSet]);

  // Tính toán số lượng tin nhắn chưa đọc trong các nhóm lớp mà người dùng tham gia
  const unreadClassroomMessagesCount = useMemo(() => {
    if (currentTab === 'classroom' || !isAuthenticated) return 0;
    let count = 0;
    const myClassIds = new Set<string>();

    const lowerUserId = (userProfile.id || '').toLowerCase().trim();
    const lowerEmail = (userProfile.email || '').toLowerCase().trim();

    classrooms.forEach((c) => {
      const isOwnerTeacher = Boolean(lowerUserId && (c.teacherId || '').toLowerCase().trim() === lowerUserId);
      const isEnrolledStudent = Boolean(
        c.studentIds &&
        c.studentIds.some((sId) => {
          const lowerS = (sId || '').toLowerCase().trim();
          return (lowerUserId && lowerS === lowerUserId) || (lowerEmail && lowerS === lowerEmail);
        })
      );
      const isMember =
        userProfile.role === 'teacher'
          ? isOwnerTeacher
          : userProfile.role === 'admin'
          ? true
          : isEnrolledStudent;

      if (isMember) {
        myClassIds.add(c.id);
        if (c.code) myClassIds.add(c.code);
      }
    });

    for (const [classId, msgs] of Object.entries(classroomMessages)) {
      if (!myClassIds.has(classId)) continue;
      const lastRead = lastReadChatMap[classId] || 0;
      if (Array.isArray(msgs)) {
        for (const m of msgs) {
          if (m && m.senderId !== userProfile.id) {
            const msgTime = new Date(m.timestamp).getTime();
            if (msgTime > lastRead) {
              count++;
            }
          }
        }
      }
    }
    return count;
  }, [currentTab, classrooms, classroomMessages, userProfile, lastReadChatMap, isAuthenticated]);

  // Tham chiếu trạng thái mới nhất cho bộ xử lý Real-Time Polling
  const userProfileRef = useRef(userProfile);
  useEffect(() => {
    userProfileRef.current = userProfile;
  }, [userProfile]);

  const isAuthenticatedRef = useRef(isAuthenticated);
  useEffect(() => {
    isAuthenticatedRef.current = isAuthenticated;
  }, [isAuthenticated]);

  const classroomsRef = useRef(classrooms);
  useEffect(() => {
    classroomsRef.current = classrooms;
  }, [classrooms]);

  const examsListRef = useRef(examsList);
  useEffect(() => {
    examsListRef.current = examsList;
  }, [examsList]);

  const toastTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const dismissFloatingToast = (toastId: string) => {
    const existingTimer = toastTimersRef.current.get(toastId);
    if (existingTimer) {
      clearTimeout(existingTimer);
      toastTimersRef.current.delete(toastId);
    }
    setFloatingToasts((prev) => prev.filter((t) => t.id !== toastId));
  };

  // Lắng nghe sự kiện thông báo đẩy trong hệ thống (hiển thị dạng stack tối đa 3 thông báo nổi an toàn cho mobile)
  useEffect(() => {
    const handler = (e: Event) => {
      const customEvent = e as CustomEvent<PushNotificationItem>;
      const detail = customEvent.detail;
      if (!detail) return;

      setNotifications((prev) => [detail, ...prev]);

      if (!detail.isMuted) {
        setFloatingToasts((prev) => [detail, ...prev.filter((t) => t.id !== detail.id)].slice(0, 3));
        const existingTimer = toastTimersRef.current.get(detail.id);
        if (existingTimer) clearTimeout(existingTimer);
        const duration =
          detail.type === 'lesson_published' || detail.type === 'exam_published' ? 12000 : 7000;
        const timer = setTimeout(() => {
          toastTimersRef.current.delete(detail.id);
          setFloatingToasts((curr) => curr.filter((t) => t.id !== detail.id));
        }, duration);
        toastTimersRef.current.set(detail.id, timer);
      }
    };
    window.addEventListener('math_nbk_push_notification', handler);
    return () => {
      window.removeEventListener('math_nbk_push_notification', handler);
      toastTimersRef.current.forEach((timer) => clearTimeout(timer));
      toastTimersRef.current.clear();
    };
  }, []);

  // Tự động đồng bộ Real-Time cơ sở dữ liệu trên máy chủ (Sync đa thiết bị / khác máy)
  useEffect(() => {
    const RECENT_WINDOW_MS = 3 * 60 * 1000;

    let knownPendingIds = new Set<string>();
    let hasLoadedUsersOnce = false;
    let knownLessonIds = new Set<string>();
    let hasLoadedLessonsOnce = false;
    let knownClassExamPairs = new Set<string>();
    let hasLoadedAssignmentsOnce = false;
    let latestRemoteClasses: Classroom[] = classroomsRef.current;
    let latestRemoteExams: Exam[] = examsListRef.current;
    let knownChatMessageIds = new Set<string>();
    let isInitialMessageLoad = true;
    let knownBroadcastIds = new Set<string>();
    let hasLoadedBroadcastsOnce = false;

    const readSeenPosts = (uid: string): { lessons: Set<string>; exams: Set<string>; broadcasts: Set<string> } => {
      try {
        const raw = localStorage.getItem(`math_nbk_seen_posts_${uid}`);
        if (!raw) return { lessons: new Set(), exams: new Set(), broadcasts: new Set() };
        const parsed = JSON.parse(raw);
        return {
          lessons: new Set(Array.isArray(parsed?.lessons) ? parsed.lessons : []),
          exams: new Set(Array.isArray(parsed?.exams) ? parsed.exams : []),
          broadcasts: new Set(Array.isArray(parsed?.broadcasts) ? parsed.broadcasts : []),
        };
      } catch {
        return { lessons: new Set(), exams: new Set(), broadcasts: new Set() };
      }
    };

    const markPostSeen = (uid: string, kind: 'lessons' | 'exams' | 'broadcasts', postId: string) => {
      if (!uid || !postId) return;
      try {
        const current = readSeenPosts(uid);
        current[kind].add(postId);
        const trimArr = (s: Set<string>) => Array.from(s).slice(-250);
        localStorage.setItem(
          `math_nbk_seen_posts_${uid}`,
          JSON.stringify({
            lessons: trimArr(current.lessons),
            exams: trimArr(current.exams),
            broadcasts: trimArr(current.broadcasts),
          })
        );
      } catch {}
    };

    const isStudentMember = (cls: Classroom | undefined | null, user: UserProfile): boolean => {
      if (!cls || user.role !== 'student') return false;
      const lowerId = (user.id || '').toLowerCase().trim();
      const lowerEmail = (user.email || '').toLowerCase().trim();
      return Boolean(
        cls.studentIds &&
          cls.studentIds.some((sid) => {
            const ls = (sid || '').toLowerCase().trim();
            return (lowerId && ls === lowerId) || (lowerEmail && ls === lowerEmail);
          })
      );
    };

    const evaluateStudentExamNotifications = (classes: Classroom[], exams: Exam[]) => {
      const curUser = userProfileRef.current;
      const isLoggedInStudent = Boolean(isAuthenticatedRef.current && curUser?.id && curUser.role === 'student');

      const currentPairs: Array<{ pairKey: string; cls: Classroom; exam: Exam }> = [];
      const seenPairsInLoop = new Set<string>();

      classes.forEach((cls) => {
        const assignedSet = new Set<string>(cls.assignedExamIds || []);
        exams.forEach((ex) => {
          if (ex.targetClassIds?.includes(cls.id) && ex.distributionType !== 'repository') {
            assignedSet.add(ex.id);
          }
        });
        assignedSet.forEach((examId) => {
          const examObj = exams.find((e) => e.id === examId);
          if (!examObj || examObj.distributionType === 'repository') return;
          const pairKey = `${cls.id}::${examId}`;
          if (seenPairsInLoop.has(pairKey)) return;
          seenPairsInLoop.add(pairKey);
          currentPairs.push({ pairKey, cls, exam: examObj });
        });
      });

      if (!hasLoadedAssignmentsOnce) {
        if (classes.length > 0 || exams.length > 0) {
          if (isLoggedInStudent) {
            const seen = readSeenPosts(curUser.id);
            const nowMs = Date.now();
            currentPairs.forEach(({ pairKey, cls, exam }) => {
              knownClassExamPairs.add(pairKey);
              if (!isStudentMember(cls, curUser) || isExamRecentlySaved(exam.id) || seen.exams.has(exam.id)) {
                return;
              }
              const createdMs = exam.createdAt ? new Date(exam.createdAt).getTime() : 0;
              const isBrandNew = Number.isFinite(createdMs) && createdMs > 0 && nowMs - createdMs <= RECENT_WINDOW_MS;
              if (isBrandNew) {
                markPostSeen(curUser.id, 'exams', exam.id);
                triggerPushNotification(`Đề thi mới: ${exam.title}`, {
                  message: `Giáo viên vừa giao đề thi "${exam.title}" cho lớp ${cls.name} (${exam.durationMinutes} phút · ${exam.questions.length} câu). Nhấn để làm bài ngay!`,
                  type: 'exam_published',
                  targetTab: 'exam',
                  targetClassId: cls.id,
                  examId: exam.id,
                  actionLabel: 'Làm bài ngay',
                });
              } else {
                markPostSeen(curUser.id, 'exams', exam.id);
              }
            });
          } else {
            currentPairs.forEach(({ pairKey }) => knownClassExamPairs.add(pairKey));
          }
          hasLoadedAssignmentsOnce = true;
        }
        return;
      }

      const freshPairs = currentPairs.filter(({ pairKey }) => !knownClassExamPairs.has(pairKey));
      if (freshPairs.length > 0 && isLoggedInStudent) {
        const seen = readSeenPosts(curUser.id);
        freshPairs.forEach(({ pairKey, cls, exam }) => {
          knownClassExamPairs.add(pairKey);
          if (!isStudentMember(cls, curUser) || isExamRecentlySaved(exam.id) || seen.exams.has(exam.id)) {
            return;
          }
          seen.exams.add(exam.id);
          markPostSeen(curUser.id, 'exams', exam.id);
          triggerPushNotification(`Đề thi mới: ${exam.title}`, {
            message: `Giáo viên vừa giao đề thi "${exam.title}" cho lớp ${cls.name} (${exam.durationMinutes} phút · ${exam.questions.length} câu). Nhấn để làm bài ngay!`,
            type: 'exam_published',
            targetTab: 'exam',
            targetClassId: cls.id,
            examId: exam.id,
            actionLabel: 'Làm bài ngay',
          });
        });
      }
      currentPairs.forEach(({ pairKey }) => knownClassExamPairs.add(pairKey));
    };

    const unsubscribe = startDbPolling((remoteData) => {
      if (remoteData.users && Array.isArray(remoteData.users)) {
        const freshPending = remoteData.users.filter((u) => u.status === 'pending_approval');
        const curUser = userProfileRef.current;
        if (hasLoadedUsersOnce && isAuthenticatedRef.current && curUser?.role === 'admin') {
          const newArrivals = freshPending.filter((u) => !knownPendingIds.has(u.id));
          if (newArrivals.length > 0) {
            newArrivals.forEach((u) => {
              triggerPushNotification('Yêu Cầu Cấp Tài Khoản Mới', {
                message: `Người dùng ${u.name} (${u.role === 'teacher' ? 'Giáo viên' : 'Học sinh'} - ID: ${u.id}) vừa gửi yêu cầu đăng ký. Vui lòng vào duyệt.`,
                type: 'system',
                targetTab: 'admin_dashboard',
              });
            });
          }
        }
        knownPendingIds = new Set(freshPending.map((u) => u.id));
        hasLoadedUsersOnce = true;

        setAllUsers(remoteData.users);

        // Đồng bộ trạng thái tài khoản đang đăng nhập (CHỈ KHI ĐANG ĐĂNG NHẬP VÀ CÓ ID HỢP LỆ)
        const curr = userProfileRef.current;
        if (curr && curr.id) {
          const fresh = remoteData.users.find((u) => u.id === curr.id);
          if (fresh) {
            if (fresh.status === 'rejected') {
              clearStoredAuthSession();
              setSessionLoginAt(null);
              setIsAuthenticated(false);
              setUserProfile(INITIAL_USER_PROFILE);
              setUserRole('student');
            } else {
              const mergedUser = { ...curr, ...fresh };
              if (JSON.stringify(mergedUser) !== JSON.stringify(curr)) {
                setUserProfile(mergedUser);
                // Tuyệt đối không tự động ghi đè admin vào localStorage để tránh auto-login khi mở lại trang
                if (fresh.role !== 'admin') {
                  if (rememberSessionRef.current) {
                    localStorage.setItem('math_nbk_auth_user', JSON.stringify(mergedUser));
                  } else {
                    sessionStorage.setItem('math_nbk_auth_session', JSON.stringify(mergedUser));
                  }
                }
              }
            }
          }
        }
      }

      if (remoteData.classrooms && Array.isArray(remoteData.classrooms)) {
        const sanitizedClasses = remoteData.classrooms.map((c) => ({
          ...c,
          assignedExamIds: (c.assignedExamIds || []).filter(
            (eid) => !deletedExamIdsRef.current.has(eid) && !isExamDeletedLocally(eid)
          ),
        }));
        latestRemoteClasses = sanitizedClasses;
        setClassrooms(sanitizedClasses);
        evaluateStudentExamNotifications(latestRemoteClasses, latestRemoteExams);
      }

      if (remoteData.submissions && Array.isArray(remoteData.submissions)) {
        setSubmissions(remoteData.submissions);
      }

      if (remoteData.cheatLogs && Array.isArray(remoteData.cheatLogs)) {
        setCheatLogs(remoteData.cheatLogs);
      }

      // Đồng bộ Bài học chuyên đề tức thời giữa các máy (Giáo viên đăng bài -> Học sinh nhận thông báo nổi)
      if (remoteData.classroomLessons && Array.isArray(remoteData.classroomLessons)) {
        const lessonMap = new Map<string, ClassroomLesson>();
        remoteData.classroomLessons.forEach((l) => lessonMap.set(l.id, l));
        const mergedLessons = Array.from(lessonMap.values());

        const remoteNonSampleLessons = remoteData.classroomLessons.filter(
          (l) => Boolean(l && l.id)
        );
        const curUser = userProfileRef.current;
        const isLoggedInStudent = Boolean(isAuthenticatedRef.current && curUser?.id && curUser.role === 'student');
        const activeClasses = latestRemoteClasses.length > 0 ? latestRemoteClasses : classroomsRef.current;

        if (!hasLoadedLessonsOnce) {
          if (isLoggedInStudent) {
            const seen = readSeenPosts(curUser.id);
            const nowMs = Date.now();
            remoteNonSampleLessons.forEach((l) => {
              knownLessonIds.add(l.id);
              const matchedClass = activeClasses.find((c) => c.id === l.classId);
              if (!matchedClass || !isStudentMember(matchedClass, curUser) || seen.lessons.has(l.id)) {
                return;
              }
              const pubMs = l.publishedAt ? new Date(l.publishedAt).getTime() : 0;
              const isBrandNew = Number.isFinite(pubMs) && pubMs > 0 && nowMs - pubMs <= RECENT_WINDOW_MS;
              markPostSeen(curUser.id, 'lessons', l.id);
              if (isBrandNew) {
                triggerPushNotification(`Bài học mới: ${l.title}`, {
                  message: `Thầy cô vừa đăng tải bài học "${l.title}" (${l.chapter}) trong lớp ${matchedClass.name}. Nhấn để mở xem ngay!`,
                  type: 'lesson_published',
                  targetTab: 'classroom',
                  targetClassId: matchedClass.id,
                  lessonId: l.id,
                  actionLabel: 'Xem bài học',
                });
              }
            });
          } else {
            remoteNonSampleLessons.forEach((l) => knownLessonIds.add(l.id));
          }
          hasLoadedLessonsOnce = true;
        } else {
          const freshLessonArrivals = remoteNonSampleLessons.filter((l) => !knownLessonIds.has(l.id));
          if (freshLessonArrivals.length > 0 && isLoggedInStudent) {
            const seen = readSeenPosts(curUser.id);
            freshLessonArrivals.forEach((l) => {
              const matchedClass = activeClasses.find((c) => c.id === l.classId);
              if (!matchedClass || !isStudentMember(matchedClass, curUser) || seen.lessons.has(l.id)) {
                return;
              }
              markPostSeen(curUser.id, 'lessons', l.id);
              triggerPushNotification(`Bài học mới: ${l.title}`, {
                message: `Thầy cô vừa đăng tải bài học "${l.title}" (${l.chapter}) trong lớp ${matchedClass.name}. Nhấn để mở xem ngay!`,
                type: 'lesson_published',
                targetTab: 'classroom',
                targetClassId: matchedClass.id,
                lessonId: l.id,
                actionLabel: 'Xem bài học',
              });
            });
          }
          remoteNonSampleLessons.forEach((l) => knownLessonIds.add(l.id));
        }
        setClassroomLessons(mergedLessons);
      }

      // Cập nhật danh sách mã đề đã bị xóa từ Server / Firestore
      if (Array.isArray(remoteData.deletedExamIds)) {
        remoteData.deletedExamIds.forEach((delId) => {
          if (delId && !isExamRecentlySaved(delId)) {
            deletedExamIdsRef.current.add(delId);
          }
        });
      }

      // Đồng bộ Đề thi tức thời giữa các máy (Giáo viên đăng đề -> Học sinh nhận thông báo nổi & vào làm ngay)
      if (remoteData.exams && Array.isArray(remoteData.exams)) {
        const validExams = remoteData.exams.filter(
          (ex) =>
            ex &&
            ex.id &&
            ex.id !== 'exam_bgd_2025_01' &&
            !deletedExamIdsRef.current.has(ex.id) &&
            !isExamDeletedLocally(ex.id)
        );

        latestRemoteExams = validExams;
        evaluateStudentExamNotifications(latestRemoteClasses, latestRemoteExams);
        setExamsList((prevExams) => {
          const prevMap = new Map<string, Exam>();
          prevExams.forEach((e) => {
            if (e && e.id && !deletedExamIdsRef.current.has(e.id) && !isExamDeletedLocally(e.id)) {
              prevMap.set(e.id, e);
            }
          });

          const merged = validExams.map((remoteEx) => {
            const localEx = prevMap.get(remoteEx.id);
            if (!localEx || !Array.isArray(localEx.questions)) return remoteEx;
            const preferLocal = isExamRecentlySaved(remoteEx.id);
            // Bảo tồn ảnh đã cắt nếu bản ghi remote chưa kịp có
            const mergedQuestions = (remoteEx.questions || []).map((rq) => {
              const lq = localEx.questions.find((q) => q.id === rq.id || q.questionNumber === rq.questionNumber);
              if (!lq) return rq;
              const primary = preferLocal ? lq : rq;
              const secondary = preferLocal ? rq : lq;
              return {
                ...secondary,
                ...primary,
                pdfAttachmentUrl: pickPreferredImageUrl(primary.pdfAttachmentUrl, secondary.pdfAttachmentUrl),
                imageAttachment:
                  pickPreferredImageUrl(primary.imageAttachment, secondary.imageAttachment) ||
                  pickPreferredImageUrl(primary.pdfAttachmentUrl, secondary.pdfAttachmentUrl),
                optionsAttachmentUrl: pickPreferredImageUrl(primary.optionsAttachmentUrl, secondary.optionsAttachmentUrl),
                options:
                  primary.part === 'part_1_mcq' && Array.isArray((primary as any).options)
                    ? (primary as any).options.map((popt: any) => {
                        const sopt =
                          secondary.part === 'part_1_mcq' && Array.isArray((secondary as any).options)
                            ? (secondary as any).options.find((o: any) => o.key === popt.key)
                            : null;
                        return {
                          ...popt,
                          imageUrl: pickPreferredImageUrl(popt.imageUrl, sopt?.imageUrl),
                        };
                      })
                    : (primary as any).options,
                items:
                  primary.part === 'part_2_true_false' && Array.isArray((primary as any).items)
                    ? (primary as any).items.map((pitem: any) => {
                        const sitem =
                          secondary.part === 'part_2_true_false' && Array.isArray((secondary as any).items)
                            ? (secondary as any).items.find((i: any) => i.subKey === pitem.subKey)
                            : null;
                        return {
                          ...pitem,
                          imageUrl: pickPreferredImageUrl(pitem.imageUrl, sitem?.imageUrl),
                        };
                      })
                    : (primary as any).items,
              };
            });
            return preferLocal
              ? {
                  ...remoteEx,
                  ...localEx,
                  questions: mergedQuestions,
                }
              : {
                  ...localEx,
                  ...remoteEx,
                  questions: mergedQuestions,
                };
          });

          // Giữ lại mọi đề hợp lệ đang có ở cục bộ (chỉ loại bỏ khi thực sự nằm trong danh sách đã xóa)
          prevExams.forEach((localEx) => {
            if (
              localEx &&
              localEx.id &&
              localEx.id !== 'exam_bgd_2025_01' &&
              !deletedExamIdsRef.current.has(localEx.id) &&
              !isExamDeletedLocally(localEx.id) &&
              !merged.some((m) => m.id === localEx.id)
            ) {
              merged.push(localEx);
            }
          });

          const finalExams = merged
            .filter((e) => e && e.id && !deletedExamIdsRef.current.has(e.id) && !isExamDeletedLocally(e.id))
            .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());

          try {
            localStorage.setItem('math_liki_exams', JSON.stringify(finalExams));
          } catch {}
          return finalExams;
        });
      }

      // Đồng bộ Tin nhắn chat tức thời & Bắn thông báo khi được nhắc tên (@mention) hoặc giáo viên đăng tin
      if (remoteData.classroomMessages) {
        const curUser = userProfileRef.current;
        const currentClasses = classroomsRef.current;

        // Trích xuất toàn bộ tin nhắn thành một danh sách phẳng
        const allRemoteMsgs: ClassroomChatMessage[] = [];
        if (Array.isArray(remoteData.classroomMessages)) {
          allRemoteMsgs.push(...remoteData.classroomMessages);
        } else if (typeof remoteData.classroomMessages === 'object') {
          Object.values(remoteData.classroomMessages).forEach((list) => {
            if (Array.isArray(list)) allRemoteMsgs.push(...list);
          });
        }

        if (isInitialMessageLoad) {
          allRemoteMsgs.forEach((m) => knownChatMessageIds.add(m.id));
          isInitialMessageLoad = false;
        } else {
          const freshMessages = allRemoteMsgs.filter((m) => !knownChatMessageIds.has(m.id));
          freshMessages.forEach((m) => {
            knownChatMessageIds.add(m.id);
            if (curUser && curUser.id && m.senderId !== curUser.id) {
              const matchedClass = currentClasses.find((c) => c.id === m.classId);
              const className = matchedClass ? matchedClass.name : 'Nhóm lớp';

              // Kiểm tra xem người dùng có phải thành viên của nhóm lớp này không
              const lowerCurId = (curUser.id || '').toLowerCase().trim();
              const lowerCurEmail = (curUser.email || '').toLowerCase().trim();
              const isMember = matchedClass
                ? (matchedClass.teacherId || '').toLowerCase().trim() === lowerCurId ||
                  (matchedClass.studentIds || []).some((sid) => {
                    const ls = (sid || '').toLowerCase().trim();
                    return ls === lowerCurId || (lowerCurEmail && ls === lowerCurEmail);
                  })
                : false;

              if (isMember) {
                // Kiểm tra xem có được nhắc tên (@mention hoặc @Cả Lớp / @all / @everyone)
                const mentionsUser = m.mentions && m.mentions.some(
                  (mention) => mention.userId === curUser.id || mention.userId === 'all'
                );
                const contentText = typeof m.content === 'string' ? m.content : '';
                const textMentionsUser =
                  (curUser.name && contentText.toLowerCase().includes(`@${curUser.name.toLowerCase()}`)) ||
                  contentText.includes('@Cả Lớp') ||
                  contentText.toLowerCase().includes('@all') ||
                  contentText.toLowerCase().includes('@everyone');

                if (mentionsUser || textMentionsUser) {
                  triggerPushNotification(`${m.senderName} đã nhắc đến bạn trong ${className}`, {
                    message: `"${contentText.slice(0, 120)}${contentText.length > 120 ? '...' : ''}"`,
                    type: 'chat_message',
                    targetTab: 'classroom',
                  });
                } else if (m.senderRole === 'teacher' && curUser.role === 'student') {
                  // Thông báo tin nhắn quan trọng từ giáo viên tới học sinh trong lớp
                  triggerPushNotification(`Giáo viên ${m.senderName} gửi tin nhắn trong ${className}`, {
                    message: `"${m.content.slice(0, 120)}${m.content.length > 120 ? '...' : ''}"`,
                    type: 'chat_message',
                    targetTab: 'classroom',
                  });
                }
              }
            }
          });
        }

        setClassroomMessages(remoteData.classroomMessages);
      }

      // Đồng bộ Thông báo tin nhắn chung từ Admin (Hiển thị tại Nhóm Lớp & thông báo đẩy tới mọi tài khoản)
      if (Array.isArray(remoteData.adminBroadcasts)) {
        const curUser = userProfileRef.current;
        const isLoggedInNonAdmin = Boolean(isAuthenticatedRef.current && curUser?.id && curUser.role !== 'admin');
        const normCurId = (curUser?.id || '').trim().toLowerCase();
        const normCurEmail = (curUser?.email || '').trim().toLowerCase();
        const localDismissed = curUser?.id ? new Set(getLocallyDismissedBroadcastIds(curUser.id)) : new Set<string>();

        const isDismissedForCurrentUser = (b: AdminBroadcastMessage) => {
          if (b.isPinned) return false;
          if (localDismissed.has(b.id)) return true;
          const delArr = Array.isArray(b.deletedByUserIds) ? b.deletedByUserIds : [];
          return delArr.some((uid) => {
            const lu = String(uid || '').trim().toLowerCase();
            return (normCurId && lu === normCurId) || (normCurEmail && lu === normCurEmail);
          });
        };

        if (!hasLoadedBroadcastsOnce) {
          if (isLoggedInNonAdmin) {
            const seen = readSeenPosts(curUser.id);
            const nowMs = Date.now();
            remoteData.adminBroadcasts.forEach((b) => {
              knownBroadcastIds.add(b.id);
              if (!isBroadcastVisibleToRole(b, curUser.role)) return;
              if (isDismissedForCurrentUser(b) || seen.broadcasts.has(b.id)) return;
              markPostSeen(curUser.id, 'broadcasts', b.id);
              const createdMs = b.createdAt ? new Date(b.createdAt).getTime() : 0;
              if (Number.isFinite(createdMs) && createdMs > 0 && nowMs - createdMs <= RECENT_WINDOW_MS) {
                triggerPushNotification(`Thông báo từ Admin: ${b.title}`, {
                  message: b.content.slice(0, 140) + (b.content.length > 140 ? '...' : ''),
                  type: 'system',
                  targetTab: 'classroom',
                  actionLabel: 'Xem ở Nhóm Lớp',
                });
              }
            });
          } else {
            remoteData.adminBroadcasts.forEach((b) => knownBroadcastIds.add(b.id));
          }
          hasLoadedBroadcastsOnce = true;
        } else {
          const freshBroadcasts = remoteData.adminBroadcasts.filter((b) => !knownBroadcastIds.has(b.id));
          if (freshBroadcasts.length > 0 && isLoggedInNonAdmin) {
            const seen = readSeenPosts(curUser.id);
            freshBroadcasts.forEach((b) => {
              knownBroadcastIds.add(b.id);
              if (!isBroadcastVisibleToRole(b, curUser.role)) return;
              if (isDismissedForCurrentUser(b) || seen.broadcasts.has(b.id)) return;
              markPostSeen(curUser.id, 'broadcasts', b.id);
              triggerPushNotification(`Thông báo từ Admin: ${b.title}`, {
                message: b.content.slice(0, 140) + (b.content.length > 140 ? '...' : ''),
                type: 'system',
                targetTab: 'classroom',
                actionLabel: 'Xem ở Nhóm Lớp',
              });
            });
          }
          remoteData.adminBroadcasts.forEach((b) => knownBroadcastIds.add(b.id));
        }

        setAdminBroadcasts(remoteData.adminBroadcasts);
      }
    });

    return () => {
      unsubscribe();
    };
  }, []);

  // Phân quyền bảo mật tuyệt đối: Tự động điều hướng nếu tab không thuộc vai trò đang đăng nhập
  useEffect(() => {
    if (!isAuthenticated) return;
    if (userRole === 'admin') {
      if (
        currentTab !== 'admin_dashboard' &&
        currentTab !== 'admin_broadcasts' &&
        currentTab !== 'notes' &&
        currentTab !== 'profile'
      ) {
        setCurrentTab('admin_dashboard');
      }
    } else if (userRole === 'teacher') {
      const baseTeacherTabs = ['classroom', 'teacher_gradebook', 'teacher_portal', 'exam_repository', 'notes', 'profile', 'exam'];
      const isAllowedBase = baseTeacherTabs.includes(currentTab);
      const isAllowedSubject =
        ['geometry', 'physics_sim', 'chemistry_lab'].includes(currentTab) &&
        canAccessSubjectTab(currentTab, userRole, userProfile.subject);
      if (!isAllowedBase && !isAllowedSubject) {
        setCurrentTab('classroom');
      }
    } else if (userRole === 'student') {
      const allowedStudentTabs = ['classroom', 'student_history', 'geometry', 'physics_sim', 'chemistry_lab', 'notes', 'profile', 'exam'];
      if (!allowedStudentTabs.includes(currentTab)) {
        setCurrentTab('classroom');
      }
    }
  }, [userRole, userProfile.subject, currentTab, isAuthenticated]);

  // Đăng nhập thành công (Đặt mốc thời gian phiên 24 giờ)
  const handleLoginSuccess = (user: UserProfile, rememberMe = true) => {
    const loginAt = Date.now();
    setUserProfile(user);
    setUserRole(user.role);
    setSessionLoginAt(loginAt);
    setSessionExpiredNotice(null);
    setIsAuthenticated(true);
    if (user.role === 'admin') {
      // BẢO MẬT: KHÔNG LƯU TÀI KHOẢN ADMIN VÀO LOCALSTORAGE
      try {
        localStorage.removeItem('math_nbk_auth_user');
        localStorage.removeItem(SESSION_LOGIN_AT_KEY);
        sessionStorage.removeItem('math_nbk_auth_session');
        sessionStorage.setItem('math_nbk_admin_session', 'true');
        sessionStorage.setItem(SESSION_LOGIN_AT_KEY, String(loginAt));
      } catch {}
      setCurrentTab('admin_dashboard');
    } else {
      rememberSessionRef.current = rememberMe;
      try {
        if (rememberMe) {
          localStorage.setItem('math_nbk_auth_user', JSON.stringify(user));
          localStorage.setItem(SESSION_LOGIN_AT_KEY, String(loginAt));
          sessionStorage.removeItem('math_nbk_auth_session');
          sessionStorage.removeItem(SESSION_LOGIN_AT_KEY);
        } else {
          sessionStorage.setItem('math_nbk_auth_session', JSON.stringify(user));
          sessionStorage.setItem(SESSION_LOGIN_AT_KEY, String(loginAt));
          localStorage.removeItem('math_nbk_auth_user');
          localStorage.removeItem(SESSION_LOGIN_AT_KEY);
        }
      } catch {}
      setCurrentTab('classroom');
    }
  };

  // Yêu cầu đăng xuất (Hiện modal xác nhận)
  const handleLogout = () => {
    setShowLogoutConfirm(true);
  };

  // Xác nhận đăng xuất
  const handleConfirmLogout = () => {
    setShowLogoutConfirm(false);
    setIsAuthenticated(false);
    setSessionLoginAt(null);
    setSessionExpiredNotice(null);
    setUserProfile(INITIAL_USER_PROFILE);
    setUserRole('student');
    setCurrentTab('classroom');
    clearStoredAuthSession();
  };

  // Admin gửi thông báo tin nhắn đến tất cả mọi người, chỉ giáo viên hoặc chỉ học sinh (hiển thị trong Nhóm Lớp)
  const handleSendAdminBroadcast = async (payload: {
    title: string;
    content: string;
    priority: 'normal' | 'important';
    category: BroadcastCategory;
    targetAudience: BroadcastTargetAudience;
    isPinned: boolean;
  }) => {
    const nowIso = new Date().toISOString();
    const newBroadcast: AdminBroadcastMessage = {
      id: `bc_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      title: payload.title,
      content: payload.content,
      priority: payload.category === 'urgent' || payload.priority === 'important' ? 'important' : 'normal',
      category: payload.category || 'general',
      targetAudience: payload.targetAudience || 'all',
      isPinned: Boolean(payload.isPinned),
      pinnedAt: payload.isPinned ? nowIso : undefined,
      senderId: userProfile.id,
      senderName: userProfile.name || 'Ban Quản Trị Hệ Thống',
      createdAt: nowIso,
      deletedByUserIds: [],
    };
    setAdminBroadcasts((prev) => sortAdminBroadcasts([newBroadcast, ...prev]));
    await dbSendAdminBroadcast(newBroadcast);
    triggerPushNotification('Đã phát thông báo hệ thống', {
      message: `"${newBroadcast.title}" đã được gửi tới nhóm ${getBroadcastAudienceLabel(newBroadcast.targetAudience)} và hiển thị tại Nhóm Lớp.`,
      type: 'system',
      targetTab: 'admin_broadcasts',
    });
  };

  // Admin ghim hoặc bỏ ghim thông báo chung
  const handleTogglePinBroadcast = async (broadcastId: string, isPinned: boolean) => {
    if (!broadcastId) return;
    const pinnedAt = isPinned ? new Date().toISOString() : undefined;
    setAdminBroadcasts((prev) =>
      sortAdminBroadcasts(
        prev.map((b) => (b.id === broadcastId ? { ...b, isPinned, pinnedAt } : b))
      )
    );
    await dbTogglePinAdminBroadcast(broadcastId, isPinned);
  };

  // Người dùng tự xóa hẳn thông báo khỏi tài khoản của riêng mình (bị chặn nếu tin nhắn đang được ghim)
  const handleDismissBroadcastForUser = async (broadcastId: string) => {
    const normId = (userProfile.id || '').trim().toLowerCase();
    if (!broadcastId || !normId) return;
    const target = adminBroadcasts.find((b) => b.id === broadcastId);
    if (target?.isPinned) return;
    markBroadcastDismissedLocally(normId, broadcastId);
    setBroadcastDismissTick((t) => t + 1);
    setAdminBroadcasts((prev) =>
      prev.map((b) => {
        if (b.id === broadcastId) {
          const next = new Set((b.deletedByUserIds || []).map((id) => String(id).trim().toLowerCase()));
          next.add(normId);
          return { ...b, deletedByUserIds: Array.from(next) };
        }
        return b;
      })
    );
    await dbDismissBroadcastForUser(broadcastId, normId);
  };

  // Admin thu hồi/xóa vĩnh viễn một thông báo khỏi toàn hệ thống
  const handleDeleteAdminBroadcastGlobally = async (broadcastId: string) => {
    if (!broadcastId) return;
    setAdminBroadcasts((prev) => prev.filter((b) => b.id !== broadcastId));
    await dbDeleteAdminBroadcastGlobally(broadcastId);
  };

  // Admin phê duyệt kích hoạt tài khoản (Đồng bộ ngay lên Server DB)
  const handleApproveUser = (userId: string) => {
    setAllUsers((prev) =>
      prev.map((u) => (u.id === userId ? { ...u, status: 'active' } : u))
    );
    dbApproveUser(userId).catch(console.error);

    const approvedUser = allUsers.find((u) => u.id === userId);
    triggerPushNotification('Phê duyệt tài khoản thành công', {
      message: `Tài khoản của ${approvedUser ? approvedUser.name : userId} đã được kích hoạt thành công!`,
      type: 'system',
      targetTab: 'admin_dashboard',
    });
  };

  // Admin lưu cấu hình duyệt tự động (Auto-Approval Settings)
  const handleUpdateAutoApprovalSettings = (newSettings: AutoApprovalSettings) => {
    setAutoApprovalSettings(newSettings);
    dbSaveAdminSettings(newSettings).catch(console.error);
    triggerPushNotification('Cấu hình duyệt tự động', {
      message: `Đã ${newSettings.enabled ? 'BẬT' : 'TẮT'} chế độ tự động phê duyệt tài khoản mới!`,
      type: 'system',
      targetTab: 'admin_dashboard',
    });
  };

  // Admin phê duyệt tự động toàn bộ người dùng đang ở trạng thái pending_approval
  const handleApproveAllUsers = async (
    targetRole: 'all' | 'student' | 'teacher' = 'all'
  ) => {
    setAllUsers((prev) =>
      prev.map((u) => {
        if (u.status === 'pending_approval') {
          if (targetRole === 'all' || u.role === targetRole) {
            return {
              ...u,
              status: 'active',
              rejectionReason: undefined,
              approvedAt: new Date().toISOString(),
            };
          }
        }
        return u;
      })
    );

    const res = await dbApproveAllUsers(targetRole, 'free');
    triggerPushNotification('Phê duyệt tự động hoàn tất', {
      message: `Đã tự động phê duyệt và kích hoạt thành công ${res.approvedCount} tài khoản!`,
      type: 'system',
      targetTab: 'admin_dashboard',
    });
  };

  // Admin từ chối yêu cầu đăng ký (Đồng bộ ngay lên Server DB)
  const handleRejectUser = (userId: string, reason?: string) => {
    setAllUsers((prev) =>
      prev.map((u) =>
        u.id === userId ? { ...u, status: 'rejected', rejectionReason: reason || 'Thông tin không hợp lệ' } : u
      )
    );
    dbRejectUser(userId, reason).catch(console.error);
  };

  // Cập nhật thông tin hồ sơ (ảnh đại diện, mật khẩu, thông tin cá nhân) đồng bộ vào allUsers và Server DB
  const handleUpdateProfile = (updated: UserProfile) => {
    setUserProfile(updated);
    setAllUsers((prev) => prev.map((u) => (u.id === updated.id ? { ...u, ...updated } : u)));
    if (updated.role !== 'admin') {
      try {
        if (rememberSessionRef.current) {
          localStorage.setItem('math_nbk_auth_user', JSON.stringify(updated));
        } else {
          sessionStorage.setItem('math_nbk_auth_session', JSON.stringify(updated));
        }
      } catch {}
    }
    dbUpdateUser(updated).catch(console.error);
  };

  // Admin cấp mới tài khoản
  const handleCreateUser = (newUser: UserProfile) => {
    setAllUsers((prev) => [newUser, ...prev]);
    dbUpdateUser(newUser).catch(console.error);
  };

  // Admin cập nhật tài khoản / đổi mật khẩu người dùng
  const handleUpdateUser = (updatedUser: UserProfile) => {
    setAllUsers((prev) => prev.map((u) => (u.id === updatedUser.id ? { ...u, ...updatedUser } : u)));
    dbUpdateUser(updatedUser).catch(console.error);
    if (userProfile.id === updatedUser.id) {
      setUserProfile(updatedUser);
      if (updatedUser.role !== 'admin') {
        try {
          if (rememberSessionRef.current) {
            localStorage.setItem('math_nbk_auth_user', JSON.stringify(updatedUser));
          } else {
            sessionStorage.setItem('math_nbk_auth_session', JSON.stringify(updatedUser));
          }
        } catch {}
      }
    }
  };

  // Admin xóa tài khoản người dùng
  const handleDeleteUser = (userId: string) => {
    setAllUsers((prev) => prev.filter((u) => u.id !== userId));
    dbDeleteUser(userId).catch(console.error);
  };

  // Cập nhật lớp học đồng bộ lên Server
  const handleUpdateClassrooms = (updated: Classroom[]) => {
    setClassrooms(updated);
    dbSaveClassrooms(updated).catch(console.error);
  };

  // Cập nhật bài học đồng bộ lên Server & Firestore
  const handleUpdateLessons = (updated: ClassroomLesson[]) => {
    setClassroomLessons(updated);
    dbSaveLessons(updated).catch(console.error);
  };

  // Lưu 1 bài học (Thêm mới hoặc Sửa) đồng bộ ngay lên Firestore
  const handleSaveLesson = async (lesson: ClassroomLesson) => {
    // Cập nhật giao diện tức thời (Optimistic UI update)
    setClassroomLessons((prev) => {
      const idx = prev.findIndex((l) => l.id === lesson.id);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = lesson;
        return copy;
      }
      return [lesson, ...prev];
    });

    console.log('[handleSaveLesson] Bắt đầu đồng bộ bài học lên Firestore & Server:', {
      lessonId: lesson.id,
      title: lesson.title,
      classId: lesson.classId,
      chapter: lesson.chapter,
      hasPdf: !!lesson.pdfAttachment,
      hasPracticePdf: !!lesson.practicePdfAttachment,
      timestamp: new Date().toISOString(),
    });

    try {
      const success = await dbSaveLesson(lesson);
      if (!success) {
        throw new Error('Hệ thống cơ sở dữ liệu không phản hồi trạng thái thành công.');
      }
      console.log('[handleSaveLesson] Đồng bộ bài học lên Firestore & Server THÀNH CÔNG:', lesson.id);
      const targetClass = classrooms.find((c) => c.id === lesson.classId);
      const className = targetClass ? targetClass.name : 'Nhóm lớp';
      triggerPushNotification(`Đã đăng bài học: ${lesson.title}`, {
        message: `Đã xuất bản bài học "${lesson.title}" (${lesson.chapter}) trong ${className}.`,
        type: 'lesson_published',
        targetTab: 'classroom',
        targetClassId: lesson.classId,
        lessonId: lesson.id,
        actionLabel: 'Xem bài học',
      });
    } catch (error: any) {
      console.error('[handleSaveLesson] LỖI ĐỒNG BỘ BÀI HỌC LÊN FIRESTORE HOẶC SERVER:', {
        lessonId: lesson.id,
        lessonTitle: lesson.title,
        errorMessage: error instanceof Error ? error.message : String(error),
        errorStack: error?.stack,
        fullError: error,
      });

      // Trích xuất thông điệp lỗi rõ ràng, chi tiết để hiển thị trên Toast
      let userFriendlyMessage = 'Không thể đồng bộ bài học lên cơ sở dữ liệu Firestore.';
      const rawMsg = error instanceof Error ? error.message : String(error);

      try {
        // Kiểm tra cấu trúc FirestoreErrorInfo JSON chuẩn
        const parsed = JSON.parse(rawMsg);
        if (parsed && (parsed.error || parsed.operationType)) {
          userFriendlyMessage = `Lỗi Firestore [${parsed.operationType} ${parsed.path || ''}]: ${parsed.error}`;
        }
      } catch {
        if (rawMsg.includes('permission-denied') || rawMsg.includes('Missing or insufficient permissions')) {
          userFriendlyMessage = 'Lỗi bảo mật Firestore: Thiếu quyền ghi dữ liệu bài học (Permission Denied).';
        } else if (rawMsg.includes('quota') || rawMsg.includes('RESOURCE_EXHAUSTED')) {
          userFriendlyMessage = 'Lỗi hạn ngạch Firestore: Đã vượt quá giới hạn truy cập hôm nay (Quota Exceeded).';
        } else if (rawMsg.includes('413') || rawMsg.includes('Payload Too Large')) {
          userFriendlyMessage = 'Lỗi dung lượng: File đính kèm quá lớn vượt giới hạn cho phép.';
        } else if (rawMsg.includes('the client is offline')) {
          userFriendlyMessage = 'Lỗi mạng: Không thể kết nối với Firestore (Thiết bị đang offline).';
        } else {
          userFriendlyMessage = `Chi tiết lỗi: ${rawMsg}`;
        }
      }

      // Hiển thị Toast thông báo lỗi trực tiếp trên giao diện
      triggerPushNotification('Lỗi Đồng Bộ Bài Học!', {
        message: userFriendlyMessage,
        type: 'error',
        targetTab: 'classroom',
      });

      // Ném lại lỗi để form modal (ClassroomManagerView) bắt và hiển thị thông báo lỗi tại chỗ
      throw error;
    }
  };

  // Xóa 1 bài học và dữ liệu liên quan đồng bộ ngay trên Firestore & Server
  const handleDeleteLesson = async (lessonId: string) => {
    const target = classroomLessons.find((l) => l.id === lessonId);
    const title = target?.title || 'Bài học';

    setClassroomLessons((prev) => prev.filter((l) => l.id !== lessonId));
    try {
      await dbDeleteLesson(lessonId);
      triggerPushNotification('Đã Xóa Bài Học!', {
        message: `Đã xóa bài học "${title}" và các file tài liệu đính kèm thành công.`,
        type: 'system',
        targetTab: 'classroom',
      });
    } catch (err) {
      console.error('Lỗi khi xóa bài học:', err);
    }
  };

  // Xóa 1 đề thi và TOÀN BỘ dữ liệu liên quan (Bài nộp, Bảng điểm, Nhật ký vi phạm, Giao đề lớp)
  const handleDeleteExam = async (examId: string) => {
    deletedExamIdsRef.current.add(examId);
    const target = examsList.find((e) => e.id === examId);
    const title = target?.title || 'Đề thi';

    // 1. Cập nhật state danh sách đề thi & localStorage
    const nextExams = examsList.filter((e) => e.id !== examId);
    setExamsList(nextExams);
    try {
      localStorage.setItem('math_liki_exams', JSON.stringify(nextExams));
    } catch {}

    // 2. Xóa toàn bộ bài làm / bài nộp của đề thi này trong state
    setSubmissions((prev) => prev.filter((s) => s.examId !== examId));

    // 3. Xóa toàn bộ nhật ký vi phạm cheatLogs của đề thi này trong state
    setCheatLogs((prev) => prev.filter((c) => c.examId !== examId));

    // 4. Gỡ đề thi khỏi toàn bộ các nhóm lớp trong state & đồng bộ ngay lên Firestore/Server
    const nextClassrooms = classrooms.map((cls) => ({
      ...cls,
      assignedExamIds: (cls.assignedExamIds || []).filter((id) => id !== examId),
    }));
    setClassrooms(nextClassrooms);
    try {
      localStorage.setItem('math_liki_classrooms', JSON.stringify(nextClassrooms));
    } catch {}
    dbSaveClassrooms(nextClassrooms).catch(console.error);

    // 5. Nếu đang kích hoạt đề thi này, chuyển sang đề khác
    if (activeExamId === examId) {
      setActiveExamId(nextExams[0]?.id || '');
    }

    // 6. Xóa triệt để trên Firestore Database & Server API
    try {
      await dbDeleteExam(examId);
      triggerPushNotification('Đã Xóa Đề Thi!', {
        message: `Đã xóa đề thi "${title}" cùng toàn bộ bài nộp và dữ liệu liên quan thành công.`,
        type: 'exam_published',
      });
    } catch (err) {
      console.error('Lỗi khi xóa đề thi:', err);
    }
  };

  // Quản trị viên / Giáo viên giải tán nhóm lớp và toàn bộ dữ liệu liên quan
  const handleDisbandClassroom = async (classId: string) => {
    const targetClass = classrooms.find((c) => c.id === classId);
    const className = targetClass?.name || 'Nhóm lớp';

    // 1. Cập nhật state local ngay lập tức
    setClassrooms((prev) => prev.filter((c) => c.id !== classId));
    setClassroomLessons((prev) => prev.filter((l) => l.classId !== classId));
    setClassroomMessages((prev) => {
      const next = { ...prev };
      delete next[classId];
      return next;
    });

    // 2. Gỡ mã lớp khỏi targetClassIds của các đề thi
    setExamsList((prev) =>
      prev.map((ex) => {
        if (ex.targetClassIds && ex.targetClassIds.includes(classId)) {
          return {
            ...ex,
            targetClassIds: ex.targetClassIds.filter((cid) => cid !== classId),
          };
        }
        return ex;
      })
    );

    // 3. Đồng bộ xóa vĩnh viễn trên Firestore Database & Server API
    try {
      await dbDisbandClassroom(classId);
      triggerPushNotification('Giải Tán Nhóm Lớp Thành Công', {
        message: `Đã giải tán thành công nhóm lớp "${className}" cùng toàn bộ bài học và tin nhắn liên quan.`,
        type: 'system',
        targetTab: 'classroom',
      });
    } catch (err) {
      console.error('Lỗi khi giải tán nhóm lớp:', err);
    }
  };

  // Phân phối / Giao đề thi từ kho đề cho các nhóm lớp học
  const handleAssignExamToClasses = async (
    examId: string,
    targetClassIds: string[],
    distributionType: 'classroom' | 'repository' | 'both',
    maxAttempts?: number,
    openTime?: string,
    closeTime?: string,
    enableScreenMonitoring?: boolean,
    maxInfractions?: number,
    scoreVisibility?: ScoreVisibilityMode
  ) => {
    const targetExam = examsList.find((e) => e.id === examId);
    if (!targetExam) return;

    const allowedTargetClassIds =
      userRole === 'teacher'
        ? targetClassIds.filter((cid) => teacherOwnedClassIdSet.has(cid))
        : targetClassIds;

    const updatedExam: Exam = {
      ...targetExam,
      teacherId: targetExam.teacherId || targetExam.createdById || (userRole === 'teacher' ? userProfile.id : undefined),
      createdById: targetExam.createdById || targetExam.teacherId || (userRole === 'teacher' ? userProfile.id : undefined),
      createdByEmail: targetExam.createdByEmail || (userRole === 'teacher' ? userProfile.email : undefined),
      targetClassIds: allowedTargetClassIds,
      distributionType,
      maxAttempts: maxAttempts ?? targetExam.maxAttempts,
      openTime: openTime ?? targetExam.openTime,
      closeTime: closeTime ?? targetExam.closeTime,
      enableScreenMonitoring: enableScreenMonitoring !== undefined ? enableScreenMonitoring : targetExam.enableScreenMonitoring,
      maxInfractions: maxInfractions ?? targetExam.maxInfractions,
      scoreVisibility: scoreVisibility ?? targetExam.scoreVisibility,
    };

    markExamRecentlySaved(examId);

    setExamsList((prev) => {
      const next = prev.map((e) => (e.id === examId ? updatedExam : e));
      try {
        localStorage.setItem('math_liki_exams', JSON.stringify(next));
      } catch {}
      return next;
    });

    // Đồng bộ assignedExamIds vào từng nhóm lớp (giáo viên chỉ được sửa lớp thuộc quyền sở hữu)
    const updatedClassrooms = classrooms.map((cls) => {
      if (userRole === 'teacher' && !teacherOwnedClassIdSet.has(cls.id)) {
        return cls;
      }
      const shouldHaveExam = allowedTargetClassIds.includes(cls.id);
      const currentIds = cls.assignedExamIds || [];
      if (shouldHaveExam && !currentIds.includes(examId)) {
        return { ...cls, assignedExamIds: [...currentIds, examId] };
      } else if (!shouldHaveExam && currentIds.includes(examId)) {
        return { ...cls, assignedExamIds: currentIds.filter((id) => id !== examId) };
      }
      return cls;
    });

    setClassrooms(updatedClassrooms);
    try {
      localStorage.setItem('math_liki_classrooms', JSON.stringify(updatedClassrooms));
    } catch {}

    try {
      await dbSaveExam(updatedExam);
      await dbSaveClassrooms(updatedClassrooms);
      triggerPushNotification('Đã Phân Phối Đề Thi!', {
        message: `Đã giao đề thi "${updatedExam.title}" cho ${allowedTargetClassIds.length} nhóm lớp thành công!`,
        type: 'exam_published',
      });
    } catch (err) {
      console.error('Lỗi khi phân phối đề thi:', err);
    }
  };

  // Xóa tin nhắn nhóm lớp
  const handleDeleteChatMessage = (messageId: string, classId: string) => {
    setClassroomMessages((prev) => ({
      ...prev,
      [classId]: (prev[classId] || []).filter((m) => m.id !== messageId),
    }));
    dbDeleteMessage(classId, messageId).catch(console.error);
  };

  // Gửi tin nhắn chat nhóm lớp đồng bộ tức thời qua Firestore & Server
  const handleSendChatMessage = (message: ClassroomChatMessage) => {
    setClassroomMessages((prev) => {
      const existing = prev[message.classId] || [];
      const msgMap = new Map<string, ClassroomChatMessage>();
      existing.forEach((m) => msgMap.set(m.id, m));
      msgMap.set(message.id, message);
      return {
        ...prev,
        [message.classId]: Array.from(msgMap.values()).sort(
          (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
        ),
      };
    });
    dbSaveMessage(message.classId, message).catch(console.error);
  };

  // Thả / Hủy tương tác biểu cảm Emoji trên tin nhắn chat đồng bộ tức thời
  const handleToggleReaction = (messageId: string, emoji: string, classId: string) => {
    setClassroomMessages((prev) => {
      const existing = prev[classId] || [];
      const updated = existing.map((msg) => {
        if (msg.id === messageId) {
          const reactions = msg.reactions || [];
          const found = reactions.find((r) => r.emoji === emoji);
          let nextReactions;
          if (found) {
            if (found.userIds.includes(userProfile.id)) {
              const nextUsers = found.userIds.filter((uid) => uid !== userProfile.id);
              if (nextUsers.length === 0) {
                nextReactions = reactions.filter((r) => r.emoji !== emoji);
              } else {
                nextReactions = reactions.map((r) =>
                  r.emoji === emoji ? { ...r, count: nextUsers.length, userIds: nextUsers } : r
                );
              }
            } else {
              nextReactions = reactions.map((r) =>
                r.emoji === emoji ? { ...r, count: r.count + 1, userIds: [...r.userIds, userProfile.id] } : r
              );
            }
          } else {
            nextReactions = [...reactions, { emoji, count: 1, userIds: [userProfile.id] }];
          }
          return { ...msg, reactions: nextReactions };
        }
        return msg;
      });
      return { ...prev, [classId]: updated };
    });
    dbToggleMessageReaction(classId, messageId, emoji, userProfile.id).catch(console.error);
  };

  const handleRecordCheatLog = (log: CheatLog) => {
    if (userProfileRef.current.role !== 'student') return;
    setCheatLogs((prev) => [log, ...prev]);
    dbSaveCheatLog(log).catch(console.error);
  };

  const handleDeleteCheatLog = async (logId: string) => {
    if (!logId) return;
    setCheatLogs((prev) => prev.filter((c) => c.id !== logId));
    await dbDeleteCheatLog(logId);
  };

  const handleClearAllCheatLogs = async () => {
    setCheatLogs([]);
    await dbClearAllCheatLogs();
  };

  // Giáo viên đăng tải đề thi mới: Đồng bộ tức thời lên Firestore & Server DB cho toàn bộ học sinh thấy ngay
  const handlePublishExam = async (newExam: Exam): Promise<boolean> => {
    deletedExamIdsRef.current.delete(newExam.id);
    clearExamDeletedLocally(newExam.id);
    markExamRecentlySaved(newExam.id);

    // Xác định các nhóm lớp nhận đề thi (Nếu chọn Kho đề thì không ép giao cho lớp; giáo viên chỉ giao cho lớp của mình)
    const isRepoOnly = newExam.distributionType === 'repository';
    const rawTargetClassIds = isRepoOnly
      ? []
      : newExam.targetClassIds && newExam.targetClassIds.length > 0
      ? newExam.targetClassIds
      : visibleClassrooms.map((c) => c.id);
    const targetClassIds =
      userRole === 'teacher'
        ? rawTargetClassIds.filter((cid) => teacherOwnedClassIdSet.has(cid))
        : rawTargetClassIds;

    const examWithTargets: Exam = {
      ...newExam,
      teacherId: newExam.teacherId || newExam.createdById || userProfile.id,
      createdById: newExam.createdById || newExam.teacherId || userProfile.id,
      createdByEmail: newExam.createdByEmail || userProfile.email || undefined,
      targetClassIds: targetClassIds.length > 0 ? targetClassIds : undefined,
    };

    // Lưu ngay lập tức vào React state + localStorage trước khi đẩy lên DB để không bao giờ mất khi F5
    setExamsList((prev) => {
      const filtered = prev.filter((e) => e.id !== examWithTargets.id);
      const next = [examWithTargets, ...filtered];
      try {
        localStorage.setItem('math_liki_exams', JSON.stringify(next));
      } catch {}
      return next;
    });
    setActiveExamId(examWithTargets.id);

    // Cập nhật assignedExamIds của lớp và đồng bộ lên DB (Bảo đảm an toàn tuyệt đối với fallback array rỗng)
    if (targetClassIds.length > 0) {
      setClassrooms((prev) => {
        const updated = prev.map((cls) => {
          const currentAssigned = cls.assignedExamIds || [];
          if (targetClassIds.includes(cls.id) && !currentAssigned.includes(examWithTargets.id)) {
            return { ...cls, assignedExamIds: [...currentAssigned, examWithTargets.id] };
          }
          return cls;
        });
        try {
          localStorage.setItem('math_liki_classrooms', JSON.stringify(updated));
        } catch {}
        dbSaveClassrooms(updated).catch(console.error);
        return updated;
      });
    }

    // Chờ đồng bộ toàn bộ ảnh cắt & đề thi lên Firestore để mọi thiết bị (điện thoại, máy tính bảng) đều xem được ngay
    let savedOk = false;
    try {
      savedOk = await dbSaveExam(examWithTargets);
    } catch (err) {
      console.error('Lỗi khi lưu đề thi lên DB:', err);
    }

    // Kích hoạt thông báo đẩy theo đúng phạm vi phân phối
    const notifMsg = isRepoOnly
      ? `Đã lưu thành công đề thi "${newExam.title}" vào Kho Đề Cá Nhân (${newExam.durationMinutes} phút - ${newExam.questions.length} câu). Bạn có thể giao cho lớp bất kỳ lúc nào!`
      : `Thầy cô vừa đăng tải đề thi mới "${newExam.title}" (${newExam.durationMinutes} phút - ${newExam.questions.length} câu). Nhấn để vào phòng luyện thi ngay!`;

    triggerPushNotification(`Đề thi mới: ${newExam.title}`, {
      message: notifMsg,
      type: 'exam_published',
      targetTab: isRepoOnly ? 'exam_repository' : 'classroom',
      examId: newExam.id,
    });

    return savedOk;
  };

  // Cập nhật danh sách đề thi (Đồng bộ lên Firestore & Server DB)
  const handleUpdateExamsList = (updated: Exam[]) => {
    setExamsList(updated);
    try {
      localStorage.setItem('math_liki_exams', JSON.stringify(updated));
    } catch {}
    dbSaveExams(updated).catch(console.error);
  };

  // Cập nhật 1 đề thi cụ thể (ví dụ khi gỡ/giao lớp) mà không ghi đè toàn bộ danh sách đề
  const handleSaveSingleExam = (updatedExam: Exam) => {
    markExamRecentlySaved(updatedExam.id);
    setExamsList((prev) => {
      const next = prev.map((e) => (e.id === updatedExam.id ? updatedExam : e));
      try {
        localStorage.setItem('math_liki_exams', JSON.stringify(next));
      } catch {}
      return next;
    });
    dbSaveExam(updatedExam).catch(console.error);
  };

  // Xử lý nộp bài thi của học sinh: tự động ghi nhận vào submissions & cộng XP & phát thông báo kết quả & sync DB
  const handleAddSubmission = (submission: StudentExamSubmission) => {
    setSubmissions((prev) => [submission, ...prev]);
    dbSaveSubmission(submission).catch(console.error);

    const currUser = userProfileRef.current;
    const updatedUser: UserProfile = {
      ...currUser,
      xp: currUser.xp + Math.round(submission.score * 15),
      streakDays: currUser.streakDays + 1,
    };
    setUserProfile(updatedUser);
    setAllUsers((all) => all.map((u) => (u.id === updatedUser.id ? { ...u, ...updatedUser } : u)));
    if (updatedUser.role !== 'admin') {
      try {
        if (rememberSessionRef.current) {
          localStorage.setItem('math_nbk_auth_user', JSON.stringify(updatedUser));
        } else {
          sessionStorage.setItem('math_nbk_auth_session', JSON.stringify(updatedUser));
        }
      } catch {}
    }
    dbUpdateUser(updatedUser).catch(console.error);

    // Kích hoạt thông báo đẩy điểm thi hoặc xác nhận đã nộp bài (tôn trọng scoreVisibility của giáo viên)
    const targetExam = examsListRef.current.find((e) => e.id === submission.examId);
    const canViewScore = targetExam ? canStudentViewExamScore(targetExam) : true;
    const answersCount = Object.keys(submission.answers || {}).length;

    if (canViewScore) {
      const examScale = getExamScaleInfo(targetExam, submission.score);
      const rankInfo = classifyScoreByScale(submission.score, examScale.totalPoints);
      const formattedScore = submission.score.toFixed(2);
      triggerPushNotification(`Kết quả chấm bài: ${submission.examTitle}`, {
        message: `Điểm số của bạn: ${formattedScore}/${formatPointsNumber(examScale.totalPoints)} (${rankInfo.percent}% · ${answersCount} câu đã làm). ${
          rankInfo.key === 'excellent'
            ? 'Thành tích xuất sắc! 🎉'
            : 'Đã lưu học bạ. Nhấn để xem chi tiết lời giải.'
        }`,
        type: 'exam_graded',
        targetTab: 'student_history',
        examId: submission.examId,
        score: submission.score,
      });
    } else {
      triggerPushNotification(`Đã nộp bài: ${submission.examTitle}`, {
        message: `Bài làm của bạn (${answersCount} câu đã làm) đã được ghi nhận an toàn. ${
          targetExam?.scoreVisibility === 'after_close'
            ? 'Điểm sẽ được công bố sau khi kết thúc đợt thi.'
            : 'Giáo viên đang ẩn điểm cho đề thi này.'
        }`,
        type: 'exam_graded',
        targetTab: 'student_history',
        examId: submission.examId,
      });
    }
  };

  // Giáo viên xóa 1 hoặc nhiều bài nộp của học sinh trong Tổng Hợp Điểm Thi
  const handleDeleteSubmission = async (submissionId: string) => {
    if (!submissionId) return;
    setSubmissions((prev) => prev.filter((s) => s.id !== submissionId));
    await dbDeleteSubmission(submissionId);
  };

  const handleDeleteMultipleSubmissions = async (submissionIds: string[]) => {
    if (!submissionIds || submissionIds.length === 0) return;
    const idSet = new Set(submissionIds);
    setSubmissions((prev) => prev.filter((s) => !idSet.has(s.id)));
    await dbDeleteSubmissionsBatch(submissionIds);
  };

  // Nội dung màn hình theo tab hiện tại và vai trò người dùng
  const renderCurrentView = () => {
    // 1. Hồ Sơ Người Dùng (Học sinh, Giáo viên, Quản trị)
    if (currentTab === 'profile') {
      return (
        <UserProfileView
          userProfile={userProfile}
          onUpdateProfile={handleUpdateProfile}
          classrooms={visibleClassrooms}
          submissions={submissions}
          examsList={examsList}
          onNavigateToClassroom={() => setCurrentTab('classroom')}
          onLogout={handleLogout}
        />
      );
    }

    // 2. Vẽ Hình 2D & 3D (Học sinh hoặc Giáo viên Toán)
    if (currentTab === 'geometry' && canAccessSubjectTab('geometry', userRole, userProfile.subject)) {
      return <GeometryCanvasView />;
    }

    // 2b. Mô Phỏng Vật Lý & Thí Nghiệm Hóa Học (Học sinh hoặc Giáo viên đúng bộ môn)
    if (currentTab === 'physics_sim' && canAccessSubjectTab('physics_sim', userRole, userProfile.subject)) {
      return <PhysicsSimulationLabView />;
    }
    if (currentTab === 'chemistry_lab' && canAccessSubjectTab('chemistry_lab', userRole, userProfile.subject)) {
      return <ChemistryExperimentLabView />;
    }

    // 2c. Ghi Chú Bảng Vẽ (Scrble Ink style)
    if (currentTab === 'notes') {
      return (
        <InkNotesView
          currentUserId={userProfile.id}
          currentUserName={userProfile.name}
        />
      );
    }

    // 3. Quản trị viên (Super Admin)
    if (userRole === 'admin') {
      if (currentTab === 'admin_broadcasts') {
        const activeNonAdminUsers = allUsers.filter((u) => u.role !== 'admin' && u.status === 'active');
        const teacherCount = activeNonAdminUsers.filter((u) => u.role === 'teacher').length;
        const studentCount = activeNonAdminUsers.filter((u) => u.role === 'student').length;
        return (
          <AdminBroadcastView
            adminBroadcasts={adminBroadcasts}
            totalRecipientsCount={activeNonAdminUsers.length}
            teacherRecipientsCount={teacherCount}
            studentRecipientsCount={studentCount}
            onSendBroadcast={handleSendAdminBroadcast}
            onTogglePinBroadcast={handleTogglePinBroadcast}
            onDeleteBroadcastGlobally={handleDeleteAdminBroadcastGlobally}
          />
        );
      }

      return (
        <AdminDashboardView
          cheatLogs={cheatLogs}
          users={allUsers}
          onCreateUser={handleCreateUser}
          onUpdateUser={handleUpdateUser}
          onDeleteUser={handleDeleteUser}
          onApproveUser={handleApproveUser}
          onRejectUser={handleRejectUser}
          autoApprovalSettings={autoApprovalSettings}
          onUpdateAutoApprovalSettings={handleUpdateAutoApprovalSettings}
          onApproveAllUsers={handleApproveAllUsers}
          onDeleteCheatLog={handleDeleteCheatLog}
          onClearCheatLogs={handleClearAllCheatLogs}
        />
      );
    }

    // 4. Giáo viên
    if (userRole === 'teacher') {
      if (currentTab === 'classroom') {
        return (
          <ClassroomManagerView
            userRole={userRole}
            currentUserId={userProfile.id}
            currentUserName={userProfile.name}
            currentUserAvatar={userProfile.avatar}
            currentUserEmail={userProfile.email}
            classrooms={classrooms}
            onUpdateClassrooms={handleUpdateClassrooms}
            examsList={visibleTeacherExams}
            onSaveExam={handleSaveSingleExam}
            onSelectExamToTake={(examId) => {
              setActiveExamId(examId);
              setCurrentTab('exam');
            }}
            onViewClassGradebook={() => {
              setCurrentTab('teacher_gradebook');
            }}
            allUsers={allUsers}
            classroomMessages={classroomMessages}
            onSendChatMessage={handleSendChatMessage}
            onDeleteChatMessage={handleDeleteChatMessage}
            onToggleReaction={handleToggleReaction}
            classroomLessons={classroomLessons}
            onUpdateLessons={handleUpdateLessons}
            onSaveLesson={handleSaveLesson}
            onDeleteLesson={handleDeleteLesson}
            onDisbandClassroom={handleDisbandClassroom}
            externalClassJump={externalClassJump}
            adminBroadcasts={visibleBroadcastsForUser}
            onDismissBroadcast={handleDismissBroadcastForUser}
          />
        );
      }

      if (currentTab === 'teacher_gradebook') {
        return (
          <TeacherGradebookView
            classrooms={visibleClassrooms}
            submissions={visibleTeacherSubmissions}
            examsList={visibleTeacherExams}
            userRole={userProfile.role}
            onSelectClassroom={() => {
              setCurrentTab('classroom');
            }}
            onPreviewExam={(examId) => {
              setActiveExamId(examId);
              setCurrentTab('exam');
            }}
            onDeleteExam={handleDeleteExam}
            onDeleteSubmission={handleDeleteSubmission}
            onDeleteMultipleSubmissions={handleDeleteMultipleSubmissions}
          />
        );
      }

      if (currentTab === 'exam') {
        return (
          <ExamEngineView
            onRecordCheatLog={handleRecordCheatLog}
            examsList={visibleTeacherExams}
            activeExamId={activeExamId}
            onSelectExamId={setActiveExamId}
            submissions={visibleTeacherSubmissions}
            onExitExam={() => setCurrentTab('classroom')}
            isTeacherPreview={true}
          />
        );
      }

      if (currentTab === 'exam_repository') {
        return (
          <TeacherPortalView
            initialMode="manage_exams"
            classrooms={visibleClassrooms}
            onPublishExam={handlePublishExam}
            currentUserName={userProfile.name}
            currentUserId={userProfile.id}
            currentUserEmail={userProfile.email}
            examsList={visibleTeacherExams}
            onDeleteExam={handleDeleteExam}
            onAssignExamToClasses={handleAssignExamToClasses}
            onSaveSingleExam={handleSaveSingleExam}
            onPreviewExam={(exam) => {
              setActiveExamId(exam.id);
              setCurrentTab('exam');
            }}
          />
        );
      }

      // Default for teacher: Teacher Portal (Tạo đề thi thủ công & Tải PDF & Quản lý đề)
      return (
        <TeacherPortalView
          initialMode="manual"
          classrooms={visibleClassrooms}
          onPublishExam={handlePublishExam}
          currentUserName={userProfile.name}
          currentUserId={userProfile.id}
          currentUserEmail={userProfile.email}
          examsList={visibleTeacherExams}
          onDeleteExam={handleDeleteExam}
          onAssignExamToClasses={handleAssignExamToClasses}
          onSaveSingleExam={handleSaveSingleExam}
          onPreviewExam={(exam) => {
            setActiveExamId(exam.id);
            setCurrentTab('exam');
          }}
        />
      );
    }

    // 5. Học sinh
    switch (currentTab) {
      case 'classroom':
        return (
          <ClassroomManagerView
            userRole={userRole}
            currentUserId={userProfile.id}
            currentUserName={userProfile.name}
            currentUserAvatar={userProfile.avatar}
            currentUserEmail={userProfile.email}
            classrooms={classrooms}
            onUpdateClassrooms={handleUpdateClassrooms}
            examsList={examsList}
            onUpdateExamsList={handleUpdateExamsList}
            onSelectExamToTake={(examId) => {
              setActiveExamId(examId);
              setCurrentTab('exam');
            }}
            allUsers={allUsers}
            classroomMessages={classroomMessages}
            onSendChatMessage={handleSendChatMessage}
            onDeleteChatMessage={handleDeleteChatMessage}
            onToggleReaction={handleToggleReaction}
            classroomLessons={classroomLessons}
            onUpdateLessons={handleUpdateLessons}
            onSaveLesson={handleSaveLesson}
            onDeleteLesson={handleDeleteLesson}
            onDisbandClassroom={handleDisbandClassroom}
            externalClassJump={externalClassJump}
            adminBroadcasts={visibleBroadcastsForUser}
            onDismissBroadcast={handleDismissBroadcastForUser}
          />
        );
      case 'student_history':
        return (
          <StudentHistoryView
            currentStudentId={userProfile.id}
            submissions={submissions}
            examsList={examsList}
            classrooms={classrooms}
            onRetakeExam={(examId) => {
              setActiveExamId(examId);
              setCurrentTab('exam');
            }}
            onOpenExamHub={() => setCurrentTab('classroom')}
          />
        );
      case 'exam':
        return (
          <ExamEngineView
            onRecordCheatLog={handleRecordCheatLog}
            examsList={examsList}
            activeExamId={activeExamId}
            onSelectExamId={setActiveExamId}
            onSubmitExam={handleAddSubmission}
            onViewHistory={() => setCurrentTab('student_history')}
            onExitExam={() => setCurrentTab('classroom')}
            studentProfile={{ id: userProfile.id, name: userProfile.name, email: userProfile.email }}
            defaultClassId={
              visibleClassrooms.find((c) => c.studentIds?.includes(userProfile.id))?.id ||
              visibleClassrooms[0]?.id ||
              'general'
            }
            submissions={submissions}
          />
        );
      default:
        return (
          <ClassroomManagerView
            userRole={userRole}
            currentUserId={userProfile.id}
            currentUserName={userProfile.name}
            currentUserAvatar={userProfile.avatar}
            currentUserEmail={userProfile.email}
            classrooms={classrooms}
            onUpdateClassrooms={handleUpdateClassrooms}
            examsList={examsList}
            onUpdateExamsList={handleUpdateExamsList}
            onSelectExamToTake={(examId) => {
              setActiveExamId(examId);
              setCurrentTab('exam');
            }}
            allUsers={allUsers}
            classroomMessages={classroomMessages}
            onSendChatMessage={handleSendChatMessage}
            onDeleteChatMessage={handleDeleteChatMessage}
            onToggleReaction={handleToggleReaction}
            classroomLessons={classroomLessons}
            onUpdateLessons={handleUpdateLessons}
            onSaveLesson={handleSaveLesson}
            onDeleteLesson={handleDeleteLesson}
            onDisbandClassroom={handleDisbandClassroom}
            externalClassJump={externalClassJump}
            adminBroadcasts={visibleBroadcastsForUser}
            onDismissBroadcast={handleDismissBroadcastForUser}
          />
        );
    }
  };

  // Nếu chưa đăng nhập, hiển thị Giao diện Đăng nhập / Đăng ký
  if (!isAuthenticated) {
    return (
      <Suspense
        fallback={
          <div className="min-h-screen bg-slate-100 flex items-center justify-center p-6">
            <div className="bg-white border border-slate-200 rounded-2xl px-6 py-4 text-sm font-semibold text-slate-600 shadow-xs">
              Đang tải giao diện đăng nhập...
            </div>
          </div>
        }
      >
        <AuthLoginView
          allUsers={allUsers}
          onLoginSuccess={handleLoginSuccess}
          onRegisterUser={handleCreateUser}
          autoApprovalSettings={autoApprovalSettings}
          sessionExpiredNotice={sessionExpiredNotice}
          onDismissSessionNotice={() => setSessionExpiredNotice(null)}
        />
      </Suspense>
    );
  }

  const isExamMode = currentTab === 'exam';

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col font-sans text-slate-900">
      {/* Top Bar (ẨN HOÀN TOÀN KHI VÀO LÀM BÀI ĐỂ CHỈ HIỂN THỊ NỘI DUNG ĐỀ THI) */}
      {!isExamMode && (
        <Navbar
          currentTab={currentTab}
          onSelectTab={setCurrentTab}
          userRole={userRole}
          xp={userProfile.xp}
          userName={userProfile.name}
          userAvatar={userProfile.avatar}
          userSubject={userProfile.subject}
          onLogout={handleLogout}
          notifications={notifications}
          onClearNotifications={() => setNotifications([])}
          onRequestPushPermission={requestNotificationPermission}
          unreadClassroomMessagesCount={unreadClassroomMessagesCount}
          adminBroadcastsCount={adminBroadcasts.length}
        />
      )}

      {/* Main Content Area (Hoàn toàn tự nhiên, co giãn responsive mượt mà trên mọi thiết bị: PC, iPad, Điện thoại) */}
      <main
        className={`flex-1 flex justify-center ${
          isExamMode
            ? 'w-full p-0'
            : currentTab === 'notes'
            ? 'py-2 sm:py-3 px-2 sm:px-4'
            : 'py-3 sm:py-8 px-2 sm:px-4 pb-6 sm:pb-8'
        }`}
      >
        <div className="w-full">
          <TabErrorBoundary resetKey={currentTab}>
            <Suspense
              fallback={
                <div className="max-w-5xl mx-auto px-4 py-12 flex justify-center">
                  <div className="bg-white border border-slate-200 rounded-2xl px-6 py-4 text-sm font-semibold text-slate-600 shadow-xs">
                    Đang tải phân hệ học tập...
                  </div>
                </div>
              }
            >
              {renderCurrentView()}
            </Suspense>
          </TabErrorBoundary>
        </div>
      </main>

      {/* Footer */}
      {currentTab !== 'exam' && (
        <footer className="bg-white border-t border-slate-200 py-5 px-4 text-center text-xs text-slate-500">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
            <p>© 2026 Toán Học LIKI</p>
            <span className="text-slate-400">Học, Thi &amp; Thí Nghiệm Toán · Lý · Hóa THPT</span>
          </div>
        </footer>
      )}

      {/* Floating Push Notification Toast Stack (Top-anchored, mobile-safe) */}
      {floatingToasts.length > 0 && (
        <div
          aria-live="polite"
          className="fixed top-3 left-3 right-3 sm:left-auto sm:top-5 sm:right-5 sm:w-[400px] z-[90] flex flex-col gap-2.5 pointer-events-none"
        >
          {floatingToasts.map((toast) => {
            const handleToastAction = () => {
              if (toast.type === 'lesson_published' && toast.targetClassId) {
                setExternalClassJump({
                  classId: toast.targetClassId,
                  tab: 'curriculum',
                  lessonId: toast.lessonId,
                  nonce: Date.now(),
                });
                setCurrentTab('classroom');
              } else if (toast.type === 'exam_published' && toast.examId) {
                setActiveExamId(toast.examId);
                setCurrentTab(toast.targetTab || 'exam');
              } else {
                if (toast.targetClassId) {
                  setExternalClassJump({
                    classId: toast.targetClassId,
                    tab: toast.type === 'chat_message' ? 'chat' : 'curriculum',
                    lessonId: toast.lessonId,
                    nonce: Date.now(),
                  });
                }
                if (toast.targetTab) {
                  setCurrentTab(toast.targetTab);
                }
                if (toast.examId) {
                  setActiveExamId(toast.examId);
                }
              }
              dismissFloatingToast(toast.id);
            };

            const isLesson = toast.type === 'lesson_published';
            const isExam = toast.type === 'exam_published';
            const isError = toast.type === 'error';
            const isChat = toast.type === 'chat_message';
            const isGraded = toast.type === 'exam_graded';

            return (
              <div
                key={toast.id}
                role="alert"
                onClick={handleToastAction}
                className={`pointer-events-auto w-full text-white p-3.5 sm:p-4 rounded-2xl shadow-2xl backdrop-blur-md cursor-pointer animate-in slide-in-from-top-4 fade-in duration-300 hover:scale-[1.01] transition-transform flex items-start gap-3 ${
                  isError
                    ? 'bg-slate-950/95 border border-rose-500/70 ring-1 ring-rose-500/30'
                    : isLesson
                    ? 'bg-slate-900/95 border border-emerald-400/60 ring-1 ring-emerald-400/30'
                    : isExam
                    ? 'bg-slate-900/95 border border-blue-400/60 ring-1 ring-blue-400/30'
                    : isChat
                    ? 'bg-slate-900/95 border border-cyan-500/50 ring-1 ring-cyan-500/20'
                    : 'bg-slate-900/95 border border-blue-500/30'
                }`}
              >
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-xs ${
                    isError
                      ? 'bg-gradient-to-br from-rose-600 to-red-700 text-white'
                      : isLesson
                      ? 'bg-gradient-to-br from-emerald-500 to-teal-600 text-white'
                      : isExam
                      ? 'bg-gradient-to-br from-blue-600 to-indigo-600 text-white'
                      : isChat
                      ? 'bg-gradient-to-br from-cyan-600 to-blue-700 text-white'
                      : 'bg-gradient-to-br from-blue-600 to-indigo-600 text-white'
                  }`}
                >
                  {isError ? (
                    <AlertTriangle size={20} className="text-white animate-pulse" />
                  ) : isLesson ? (
                    <BookOpen size={20} className="text-white" />
                  ) : isExam ? (
                    <Award size={20} className="text-amber-200" />
                  ) : isChat ? (
                    <MessageSquare size={20} className="text-cyan-200" />
                  ) : isGraded ? (
                    <FileCheck size={20} className="text-emerald-300" />
                  ) : (
                    <Bell size={20} className="text-amber-300" />
                  )}
                </div>

                <div className="flex-1 min-w-0 pr-1">
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={`text-[10px] font-black uppercase tracking-wider truncate ${
                        isError
                          ? 'text-rose-400'
                          : isLesson
                          ? 'text-emerald-400'
                          : isExam
                          ? 'text-sky-400'
                          : isChat
                          ? 'text-cyan-400'
                          : 'text-blue-400'
                      }`}
                    >
                      {isError
                        ? 'Cảnh báo lỗi'
                        : isLesson
                        ? 'Bài học mới từ giáo viên'
                        : isExam
                        ? 'Đề thi mới từ giáo viên'
                        : isChat
                        ? 'Tin nhắn & Nhắc tên'
                        : isGraded
                        ? 'Kết quả bài thi'
                        : 'Thông báo mới'}
                    </span>
                    <span className="text-[10px] text-slate-400 shrink-0">Vừa xong</span>
                  </div>
                  <h4 className="text-xs sm:text-sm font-bold text-white truncate mt-0.5">{toast.title}</h4>
                  <p
                    className={`text-[11px] line-clamp-2 mt-0.5 leading-snug ${
                      isError ? 'text-rose-100 font-medium' : 'text-slate-300'
                    }`}
                  >
                    {toast.message}
                  </p>
                  {(toast.actionLabel || isLesson || isExam) && (
                    <div className="mt-2 flex items-center gap-2">
                      <span
                        className={`inline-flex items-center px-2.5 py-1 rounded-lg text-[11px] font-bold ${
                          isLesson
                            ? 'bg-emerald-500 text-white'
                            : isExam
                            ? 'bg-blue-600 text-white'
                            : 'bg-white/15 text-white'
                        }`}
                      >
                        {toast.actionLabel || (isLesson ? 'Xem bài học' : 'Làm bài ngay')}
                      </span>
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    dismissFloatingToast(toast.id);
                  }}
                  aria-label="Đóng thông báo"
                  className="text-slate-400 hover:text-white transition-colors p-1 shrink-0"
                >
                  <X size={15} />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal Xác Nhận Đăng Xuất */}
      {showLogoutConfirm && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0 border border-rose-100">
                <LogOut size={22} />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-slate-900">Xác Nhận Đăng Xuất</h3>
                <p className="text-xs text-slate-500">Hệ thống học toán LIKI</p>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-xs text-slate-700 space-y-2">
              <p>
                Bạn có chắc chắn muốn đăng xuất khỏi tài khoản{' '}
                <strong className="text-slate-900 font-bold">{userProfile.name}</strong> (
                <span className="font-semibold text-blue-600">
                  {userRole === 'admin' ? 'Quản Trị Viên' : userRole === 'teacher' ? 'Giáo Viên' : 'Học Sinh'}
                </span>
                ) không?
              </p>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => setShowLogoutConfirm(false)}
                className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-100 font-bold text-xs transition-colors cursor-pointer"
              >
                Hủy Bỏ / Ở Lại
              </button>
              <button
                type="button"
                onClick={handleConfirmLogout}
                className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <LogOut size={15} />
                <span>Xác Nhận Đăng Xuất</span>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
