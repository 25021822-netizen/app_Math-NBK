/**
 * Math&NBK - Ứng Dụng Học Toán THPT Thông Minh
 * Bản Quyền: Math&NBK Education Platform
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { UserProfile, UserRole, AccountTier, CheatLog, Exam, Classroom, StudentExamSubmission, ClassroomLesson, ClassroomChatMessage } from './types/math';
import {
  INITIAL_USER_PROFILE,
  SAMPLE_CHEAT_LOGS,
  SAMPLE_CLASSROOMS,
  SAMPLE_SUBMISSIONS,
  SAMPLE_CLASSROOM_LESSONS,
  ALL_INITIAL_USERS,
} from './data/mockData';
import {
  fetchDbState,
  startDbPolling,
  dbApproveUser,
  dbRejectUser,
  dbDeleteUser,
  dbUpdateUser,
  dbSaveClassrooms,
  dbSaveSubmission,
  dbSaveCheatLog,
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
} from './services/dbSyncService';
import { Navbar } from './components/Navbar';
import { AIMathStudioView } from './components/student/AIMathStudioView';
import { ExamEngineView } from './components/student/ExamEngineView';
import { StudentHistoryView } from './components/student/StudentHistoryView';
import { UserProfileView } from './components/student/UserProfileView';
import { ClassroomManagerView } from './components/classroom/ClassroomManagerView';
import { TeacherPortalView } from './components/teacher/TeacherPortalView';
import { TeacherGradebookView } from './components/teacher/TeacherGradebookView';
import { GeometryCanvasView } from './components/geometry/GeometryCanvasView';
import { AdminDashboardView } from './components/admin/AdminDashboardView';
import { AuthLoginView } from './components/auth/AuthLoginView';
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
  Sparkles,
  Compass,
  User,
  Bell,
  X,
  ShieldAlert,
  LogOut,
  AlertTriangle,
  CheckCircle2,
} from 'lucide-react';

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('math_nbk_auth_user');
      if (!saved) return false;
      const parsed = JSON.parse(saved);
      // BẢO MẬT TUYỆT ĐỐI: Không tự động đăng nhập tài khoản Admin khi vào website!
      // Tài khoản Admin nắm quyền tối cao hệ thống, bắt buộc phải nhập mật khẩu để đăng nhập.
      if (!parsed || !parsed.id || parsed.role === 'admin') {
        localStorage.removeItem('math_nbk_auth_user');
        return false;
      }
      return true;
    } catch {
      localStorage.removeItem('math_nbk_auth_user');
      return false;
    }
  });
  const [showLogoutConfirm, setShowLogoutConfirm] = useState<boolean>(false);
  const [currentTab, setCurrentTab] = useState<string>('ask_ai');
  const [userRole, setUserRole] = useState<UserRole>('student');
  const [userProfile, setUserProfile] = useState<UserProfile>(() => {
    try {
      const saved = localStorage.getItem('math_nbk_auth_user');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.id && parsed.role !== 'admin') {
          return parsed;
        }
      }
    } catch {}
    return INITIAL_USER_PROFILE;
  });
  const [allUsers, setAllUsers] = useState<UserProfile[]>(ALL_INITIAL_USERS);
  const [deviceMode, setDeviceMode] = useState<'desktop' | 'tablet' | 'mobile'>('desktop');
  const [cheatLogs, setCheatLogs] = useState<CheatLog[]>(SAMPLE_CHEAT_LOGS);
  const [examsList, setExamsList] = useState<Exam[]>(() => {
    try {
      const s = localStorage.getItem('math_liki_exams');
      return s ? JSON.parse(s) : [];
    } catch {
      return [];
    }
  });
  const [activeExamId, setActiveExamId] = useState<string>('');

  // Nhóm lớp, Bài học & Kết quả bài nộp của học sinh (Đồng bộ qua máy chủ và localStorage)
  const [classrooms, setClassrooms] = useState<Classroom[]>(() => {
    try {
      const s = localStorage.getItem('math_liki_classrooms');
      return s ? JSON.parse(s) : SAMPLE_CLASSROOMS;
    } catch {
      return SAMPLE_CLASSROOMS;
    }
  });
  const [submissions, setSubmissions] = useState<StudentExamSubmission[]>(SAMPLE_SUBMISSIONS);
  const [classroomLessons, setClassroomLessons] = useState<ClassroomLesson[]>(SAMPLE_CLASSROOM_LESSONS);
  const [classroomMessages, setClassroomMessages] = useState<Record<string, ClassroomChatMessage[]>>({});

  // Quản lý thông báo đẩy (Push Notifications)
  const [notifications, setNotifications] = useState<PushNotificationItem[]>([
    {
      id: 'notif_welcome',
      title: 'Chào mừng bạn đến với Toán Học LIKI',
      message: 'Hệ thống học Toán THPT thông minh GDPT 2018 tích hợp AI và phòng thi chuẩn Bộ GD&ĐT.',
      type: 'system',
      timestamp: new Date().toISOString(),
      isRead: false,
      targetTab: 'classroom',
    },
  ]);
  const [activeToast, setActiveToast] = useState<PushNotificationItem | null>(null);

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

  // Tính toán số lượng tin nhắn chưa đọc trong các nhóm lớp mà người dùng tham gia
  const unreadClassroomMessagesCount = useMemo(() => {
    if (currentTab === 'classroom' || !isAuthenticated) return 0;
    let count = 0;
    const myClassIds = new Set<string>();

    const lowerUserId = (userProfile.id || '').toLowerCase().trim();
    const lowerEmail = (userProfile.email || '').toLowerCase().trim();

    classrooms.forEach((c) => {
      const isMember =
        userProfile.role === 'admin' ||
        userProfile.role === 'teacher' ||
        (c.studentIds &&
          c.studentIds.some((sId) => {
            const lowerS = (sId || '').toLowerCase().trim();
            return lowerS === lowerUserId || (lowerEmail && lowerS === lowerEmail);
          }));

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

  // Tự động khôi phục tài khoản học sinh / giáo viên đã lưu (TUYỆT ĐỐI KHÔNG AUTO-LOGIN ADMIN)
  useEffect(() => {
    try {
      const saved = localStorage.getItem('math_nbk_auth_user');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.id && parsed.role !== 'admin') {
          setUserProfile(parsed);
          setUserRole(parsed.role);
          setIsAuthenticated(true);
        } else if (parsed && parsed.role === 'admin') {
          localStorage.removeItem('math_nbk_auth_user');
          setIsAuthenticated(false);
          setUserProfile(INITIAL_USER_PROFILE);
          setUserRole('student');
        }
      }
    } catch (e) {
      localStorage.removeItem('math_nbk_auth_user');
    }
  }, []);

  // Tham chiếu người dùng và nhóm lớp hiện tại cho bộ xử lý Real-Time Polling
  const userProfileRef = useRef(userProfile);
  useEffect(() => {
    userProfileRef.current = userProfile;
  }, [userProfile]);

  const classroomsRef = useRef(classrooms);
  useEffect(() => {
    classroomsRef.current = classrooms;
  }, [classrooms]);

  // Lắng nghe sự kiện thông báo đẩy trong hệ thống
  useEffect(() => {
    const handler = (e: Event) => {
      const customEvent = e as CustomEvent<PushNotificationItem>;
      if (customEvent.detail) {
        setNotifications((prev) => [customEvent.detail, ...prev]);
        // Chỉ hiển thị popup Toast khi người dùng ĐANG BẬT thông báo (!isMuted)
        if (!customEvent.detail.isMuted) {
          setActiveToast(customEvent.detail);
          const timer = setTimeout(() => {
            setActiveToast((curr) => (curr?.id === customEvent.detail.id ? null : curr));
          }, 6000);
          return () => clearTimeout(timer);
        }
      }
    };
    window.addEventListener('math_nbk_push_notification', handler);
    return () => window.removeEventListener('math_nbk_push_notification', handler);
  }, []);

  // Tự động đồng bộ Real-Time cơ sở dữ liệu trên máy chủ (Sync đa thiết bị / khác máy)
  useEffect(() => {
    let knownPendingIds = new Set<string>();
    let knownLessonIds = new Set<string>(SAMPLE_CLASSROOM_LESSONS.map((l) => l.id));
    let knownExamIds = new Set<string>();
    let knownChatMessageIds = new Set<string>();
    let isInitialMessageLoad = true;

    const unsubscribe = startDbPolling((remoteData) => {
      if (remoteData.users && Array.isArray(remoteData.users)) {
        const freshPending = remoteData.users.filter((u) => u.status === 'pending_approval');
        // Nếu có yêu cầu đăng ký mới từ thiết bị khác
        const newArrivals = freshPending.filter((u) => !knownPendingIds.has(u.id));
        if (newArrivals.length > 0 && knownPendingIds.size > 0) {
          newArrivals.forEach((u) => {
            triggerPushNotification('Yêu Cầu Cấp Tài Khoản Mới', {
              message: `Người dùng ${u.name} (${u.role === 'teacher' ? 'Giáo viên' : 'Học sinh'} - ID: ${u.id}) vừa gửi yêu cầu đăng ký. Vui lòng vào duyệt.`,
              type: 'system',
              targetTab: 'admin_dashboard',
            });
          });
        }
        knownPendingIds = new Set(freshPending.map((u) => u.id));

        setAllUsers(remoteData.users);

        // Đồng bộ trạng thái tài khoản đang đăng nhập (CHỈ KHI ĐANG ĐĂNG NHẬP VÀ CÓ ID HỢP LỆ)
        setUserProfile((curr) => {
          if (!curr || !curr.id) return curr;
          const fresh = remoteData.users.find((u) => u.id === curr.id);
          if (fresh) {
            if (fresh.status === 'rejected') {
              setIsAuthenticated(false);
              localStorage.removeItem('math_nbk_auth_user');
              return INITIAL_USER_PROFILE;
            } else {
              // Tuyệt đối không tự động ghi đè admin vào localStorage để tránh auto-login khi mở lại trang
              if (fresh.role !== 'admin') {
                localStorage.setItem('math_nbk_auth_user', JSON.stringify({ ...curr, ...fresh }));
              }
            }
            return { ...curr, ...fresh };
          }
          return curr;
        });
      }

      if (remoteData.classrooms && Array.isArray(remoteData.classrooms)) {
        setClassrooms(remoteData.classrooms);
      }

      if (remoteData.submissions && Array.isArray(remoteData.submissions)) {
        setSubmissions(remoteData.submissions);
      }

      if (remoteData.cheatLogs && Array.isArray(remoteData.cheatLogs)) {
        setCheatLogs(remoteData.cheatLogs);
      }

      // Đồng bộ Bài học chuyên đề tức thời giữa các máy (Giáo viên đăng bài -> Học sinh nhận thông báo)
      if (remoteData.classroomLessons && Array.isArray(remoteData.classroomLessons)) {
        const lessonMap = new Map<string, ClassroomLesson>();
        SAMPLE_CLASSROOM_LESSONS.forEach((l) => lessonMap.set(l.id, l));
        remoteData.classroomLessons.forEach((l) => lessonMap.set(l.id, l));
        const mergedLessons = Array.from(lessonMap.values());

        // Nếu có bài học mới được đăng tải từ máy giáo viên
        const freshLessonArrivals = mergedLessons.filter((l) => !knownLessonIds.has(l.id));
        if (freshLessonArrivals.length > 0 && knownLessonIds.size > 0) {
          freshLessonArrivals.forEach((l) => {
            triggerPushNotification(`Giáo viên vừa đăng bài học mới: ${l.title}`, {
              message: `Thầy cô vừa đăng tải bài học "${l.title}" (${l.chapter}). Nhấn để mở xem ngay!`,
              type: 'system',
              targetTab: 'classroom',
            });
          });
        }
        knownLessonIds = new Set(mergedLessons.map((l) => l.id));
        setClassroomLessons(mergedLessons);
      }

      // Đồng bộ Đề thi tức thời giữa các máy (Giáo viên đăng đề -> Học sinh nhận thông báo & vào làm ngay)
      if (remoteData.exams && Array.isArray(remoteData.exams)) {
        const validExams = remoteData.exams.filter((ex) => ex && ex.id && ex.id !== 'exam_bgd_2025_01');

        // Nếu có đề thi mới được xuất bản từ máy khác
        const freshExamArrivals = validExams.filter((ex) => !knownExamIds.has(ex.id));
        if (freshExamArrivals.length > 0 && knownExamIds.size > 0) {
          freshExamArrivals.forEach((ex) => {
            triggerPushNotification(`Giáo viên vừa đăng đề thi mới: ${ex.title}`, {
              message: `Thầy cô vừa đăng tải đề thi mới (${ex.durationMinutes} phút - ${ex.questions.length} câu). Nhấn để vào làm bài ngay!`,
              type: 'exam_published',
              targetTab: 'classroom',
              examId: ex.id,
            });
          });
        }
        knownExamIds = new Set(validExams.map((ex) => ex.id));
        setExamsList(validExams);
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
              const isMember = matchedClass
                ? matchedClass.teacherId === curUser.id || matchedClass.studentIds.includes(curUser.id)
                : true;

              if (isMember) {
                // Kiểm tra xem có được nhắc tên (@mention hoặc @Cả Lớp / @all / @everyone)
                const mentionsUser = m.mentions && m.mentions.some(
                  (mention) => mention.userId === curUser.id || mention.userId === 'all'
                );
                const textMentionsUser =
                  (curUser.name && m.content.toLowerCase().includes(`@${curUser.name.toLowerCase()}`)) ||
                  m.content.includes('@Cả Lớp') ||
                  m.content.toLowerCase().includes('@all') ||
                  m.content.toLowerCase().includes('@everyone');

                if (mentionsUser || textMentionsUser) {
                  triggerPushNotification(`${m.senderName} đã nhắc đến bạn trong ${className}`, {
                    message: `"${m.content.slice(0, 120)}${m.content.length > 120 ? '...' : ''}"`,
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
    });

    return () => {
      unsubscribe();
    };
  }, []);

  // Phân quyền bảo mật tuyệt đối: Tự động điều hướng nếu tab không thuộc vai trò đang đăng nhập
  useEffect(() => {
    if (!isAuthenticated) return;
    if (userRole === 'admin') {
      if (currentTab !== 'admin_dashboard' && currentTab !== 'profile') {
        setCurrentTab('admin_dashboard');
      }
    } else if (userRole === 'teacher') {
      const allowedTeacherTabs = ['classroom', 'teacher_gradebook', 'teacher_portal', 'exam_repository', 'geometry', 'ask_ai', 'profile', 'exam', 'three_3d', 'image_studio'];
      if (!allowedTeacherTabs.includes(currentTab)) {
        setCurrentTab('classroom');
      }
    } else if (userRole === 'student') {
      const allowedStudentTabs = ['ask_ai', 'classroom', 'student_history', 'geometry', 'profile', 'exam', 'three_3d', 'image_studio'];
      if (!allowedStudentTabs.includes(currentTab)) {
        setCurrentTab('ask_ai');
      }
    }
  }, [userRole, currentTab, isAuthenticated]);

  // Đăng nhập thành công
  const handleLoginSuccess = (user: UserProfile) => {
    setUserProfile(user);
    setUserRole(user.role);
    setIsAuthenticated(true);
    if (user.role === 'admin') {
      // BẢO MẬT: KHÔNG LƯU TÀI KHOẢN ADMIN VÀO LOCALSTORAGE
      // Tránh tuyệt đối lỗi khi mở trang web bị tự động đăng nhập vào tài khoản admin
      localStorage.removeItem('math_nbk_auth_user');
      sessionStorage.setItem('math_nbk_admin_session', 'true');
      setCurrentTab('admin_dashboard');
    } else {
      localStorage.setItem('math_nbk_auth_user', JSON.stringify(user));
      if (user.role === 'teacher') setCurrentTab('classroom');
      else setCurrentTab('ask_ai');
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
    setUserProfile(INITIAL_USER_PROFILE);
    setUserRole('student');
    setCurrentTab('ask_ai');
    localStorage.removeItem('math_nbk_auth_user');
    sessionStorage.removeItem('math_nbk_admin_session');
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
      localStorage.setItem('math_nbk_auth_user', JSON.stringify(updated));
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
        localStorage.setItem('math_nbk_auth_user', JSON.stringify(updatedUser));
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
      triggerPushNotification(`Giáo viên vừa đăng bài học mới: ${lesson.title}`, {
        message: `Đã xuất bản bài học "${lesson.title}" (${lesson.chapter}) trong ${className}.`,
        type: 'system',
        targetTab: 'classroom',
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
    const target = examsList.find((e) => e.id === examId);
    const title = target?.title || 'Đề thi';

    // 1. Cập nhật state danh sách đề thi
    setExamsList((prev) => prev.filter((e) => e.id !== examId));

    // 2. Xóa toàn bộ bài làm / bài nộp của đề thi này trong state
    setSubmissions((prev) => prev.filter((s) => s.examId !== examId));

    // 3. Xóa toàn bộ nhật ký vi phạm cheatLogs của đề thi này trong state
    setCheatLogs((prev) => prev.filter((c) => c.examId !== examId));

    // 4. Gỡ đề thi khỏi toàn bộ các nhóm lớp trong state
    setClassrooms((prev) =>
      prev.map((cls) => ({
        ...cls,
        assignedExamIds: (cls.assignedExamIds || []).filter((id) => id !== examId),
      }))
    );

    // 5. Nếu đang kích hoạt đề thi này, chuyển sang đề khác
    if (activeExamId === examId) {
      const remaining = examsList.filter((e) => e.id !== examId);
      setActiveExamId(remaining[0]?.id || '');
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
    maxInfractions?: number
  ) => {
    const targetExam = examsList.find((e) => e.id === examId);
    if (!targetExam) return;

    const updatedExam: Exam = {
      ...targetExam,
      targetClassIds,
      distributionType,
      maxAttempts: maxAttempts ?? targetExam.maxAttempts,
      openTime: openTime ?? targetExam.openTime,
      closeTime: closeTime ?? targetExam.closeTime,
      enableScreenMonitoring: enableScreenMonitoring !== undefined ? enableScreenMonitoring : targetExam.enableScreenMonitoring,
      maxInfractions: maxInfractions ?? targetExam.maxInfractions,
    };

    setExamsList((prev) => prev.map((e) => (e.id === examId ? updatedExam : e)));

    // Đồng bộ assignedExamIds vào từng nhóm lớp
    const updatedClassrooms = classrooms.map((cls) => {
      const shouldHaveExam = targetClassIds.includes(cls.id);
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
      await dbSaveExam(updatedExam);
      await dbSaveClassrooms(updatedClassrooms);
      triggerPushNotification('Đã Phân Phối Đề Thi!', {
        message: `Đã giao đề thi "${updatedExam.title}" cho ${targetClassIds.length} nhóm lớp thành công!`,
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

  const handleToggleTier = () => {
    const nextTier: AccountTier = userProfile.tier === 'free' ? 'premium' : 'free';
    const nextMax = nextTier === 'premium' ? 9999 : 10;
    const updated: UserProfile = {
      ...userProfile,
      tier: nextTier,
      maxDailyScans: nextMax,
    };
    handleUpdateProfile(updated);
  };

  const handleIncrementScan = () => {
    setUserProfile((prev) => ({
      ...prev,
      dailyScanCount: prev.dailyScanCount + 1,
    }));
  };

  const handleRecordCheatLog = (log: CheatLog) => {
    setCheatLogs((prev) => [log, ...prev]);
    dbSaveCheatLog(log).catch(console.error);
  };

  // Giáo viên đăng tải đề thi mới: Đồng bộ tức thời lên Firestore & Server DB cho toàn bộ học sinh thấy ngay
  const handlePublishExam = (newExam: Exam) => {
    setExamsList((prev) => {
      const filtered = prev.filter((e) => e.id !== newExam.id);
      return [newExam, ...filtered];
    });
    setActiveExamId(newExam.id);

    // Xác định các nhóm lớp nhận đề thi (Nếu chọn Kho đề thì không ép giao cho tất cả lớp)
    const isRepoOnly = newExam.distributionType === 'repository';
    const targetClassIds = isRepoOnly
      ? []
      : newExam.targetClassIds && newExam.targetClassIds.length > 0
      ? newExam.targetClassIds
      : classrooms.map((c) => c.id);

    const examWithTargets: Exam = {
      ...newExam,
      targetClassIds: targetClassIds.length > 0 ? targetClassIds : undefined,
    };

    // Đồng bộ tức thời lên Firestore và Server để học sinh các máy khác thấy ngay lập tức
    dbSaveExam(examWithTargets).catch((err) => {
      console.error('Lỗi khi lưu đề thi lên DB:', err);
    });

    // Cập nhật assignedExamIds của lớp và đồng bộ lên DB (Bảo đảm an toàn tuyệt đối với fallback array rỗng)
    if (targetClassIds.length > 0) {
      setClassrooms((prev) => {
        const updated = prev.map((cls) => {
          const currentAssigned = cls.assignedExamIds || [];
          if (targetClassIds.includes(cls.id) && !currentAssigned.includes(newExam.id)) {
            return { ...cls, assignedExamIds: [...currentAssigned, newExam.id] };
          }
          return cls;
        });
        dbSaveClassrooms(updated).catch(console.error);
        return updated;
      });
    }

    // Kích hoạt thông báo đẩy theo đúng phạm vi phân phối
    const notifMsg = isRepoOnly
      ? `Đã lưu thành công đề thi "${newExam.title}" vào Kho Đề Thi (${newExam.durationMinutes} phút - ${newExam.questions.length} câu). Bạn có thể giao cho lớp bất kỳ lúc nào!`
      : `Thầy cô vừa đăng tải đề thi mới "${newExam.title}" (${newExam.durationMinutes} phút - ${newExam.questions.length} câu). Nhấn để vào phòng luyện thi ngay!`;

    triggerPushNotification(`Đề thi mới: ${newExam.title}`, {
      message: notifMsg,
      type: 'exam_published',
      targetTab: isRepoOnly ? 'exam_repository' : 'classroom',
      examId: newExam.id,
    });
  };

  // Cập nhật danh sách đề thi (Đồng bộ lên Firestore & Server DB)
  const handleUpdateExamsList = (updated: Exam[]) => {
    setExamsList(updated);
    dbSaveExams(updated).catch(console.error);
  };

  // Xử lý nộp bài thi của học sinh: tự động ghi nhận vào submissions & cộng XP & phát thông báo kết quả & sync DB
  const handleAddSubmission = (submission: StudentExamSubmission) => {
    setSubmissions((prev) => [submission, ...prev]);
    dbSaveSubmission(submission).catch(console.error);
    setUserProfile((prev) => {
      const updated = {
        ...prev,
        xp: prev.xp + Math.round(submission.score * 15),
        streakDays: prev.streakDays + 1,
      };
      setAllUsers((all) => all.map((u) => (u.id === updated.id ? { ...u, ...updated } : u)));
      localStorage.setItem('math_nbk_auth_user', JSON.stringify(updated));
      dbUpdateUser(updated).catch(console.error);
      return updated;
    });

    // Kích hoạt thông báo đẩy điểm thi và kết quả chấm bài
    const formattedScore = submission.score.toFixed(1);
    const answersCount = Object.keys(submission.answers || {}).length;
    triggerPushNotification(`Kết quả chấm bài: ${submission.examTitle}`, {
      message: `Điểm số của bạn: ${formattedScore}/10 (${answersCount} câu đã làm). ${submission.score >= 8 ? 'Thành tích xuất sắc! 🎉' : 'Đã lưu học bạ. Nhấn để xem chi tiết lời giải.'}`,
      type: 'exam_graded',
      targetTab: 'student_history',
      examId: submission.examId,
      score: submission.score,
    });
  };

  // Nội dung màn hình theo tab hiện tại và vai trò người dùng
  const renderCurrentView = () => {
    // 1. Hồ Sơ Người Dùng (Học sinh, Giáo viên, Quản trị)
    if (currentTab === 'profile') {
      return (
        <UserProfileView
          userProfile={userProfile}
          onUpdateProfile={handleUpdateProfile}
          classrooms={classrooms}
          submissions={submissions}
          onNavigateToClassroom={() => setCurrentTab('classroom')}
          onToggleTier={handleToggleTier}
          onLogout={handleLogout}
        />
      );
    }

    // 2. Vẽ Hình 2D & 3D (Học sinh và Giáo viên)
    if (currentTab === 'geometry') {
      return <GeometryCanvasView />;
    }

    // 3. Quản trị viên (Super Admin)
    if (userRole === 'admin') {
      return (
        <AdminDashboardView
          cheatLogs={cheatLogs}
          users={allUsers}
          onCreateUser={handleCreateUser}
          onUpdateUser={handleUpdateUser}
          onDeleteUser={handleDeleteUser}
          onApproveUser={handleApproveUser}
          onRejectUser={handleRejectUser}
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
            examsList={examsList}
            onUpdateExamsList={handleUpdateExamsList}
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
            onDeleteExam={handleDeleteExam}
            onDisbandClassroom={handleDisbandClassroom}
          />
        );
      }

      if (currentTab === 'teacher_gradebook') {
        return (
          <TeacherGradebookView
            classrooms={classrooms}
            submissions={submissions}
            examsList={examsList}
            onSelectClassroom={() => {
              setCurrentTab('classroom');
            }}
            onPreviewExam={(examId) => {
              setActiveExamId(examId);
              setCurrentTab('exam');
            }}
            onDeleteExam={handleDeleteExam}
          />
        );
      }

      if (currentTab === 'exam') {
        return (
          <ExamEngineView
            onRecordCheatLog={handleRecordCheatLog}
            examsList={examsList}
            activeExamId={activeExamId}
            onSelectExamId={setActiveExamId}
            submissions={submissions}
            onExitExam={() => setCurrentTab('classroom')}
          />
        );
      }

      if (currentTab === 'ask_ai' || currentTab === 'scanner' || currentTab === 'tutor') {
        return (
          <AIMathStudioView
            dailyScanCount={userProfile.dailyScanCount}
            maxDailyScans={userProfile.maxDailyScans}
            tier={userProfile.tier}
            onIncrementScan={handleIncrementScan}
            onUpgradeTier={handleToggleTier}
            onStartExam={(newExam) => {
              if (newExam) {
                handlePublishExam(newExam);
              }
              setCurrentTab('exam');
            }}
          />
        );
      }

      if (currentTab === 'exam_repository') {
        return (
          <TeacherPortalView
            initialMode="manage_exams"
            classrooms={classrooms}
            onPublishExam={handlePublishExam}
            currentUserName={userProfile.name}
            examsList={examsList}
            onDeleteExam={handleDeleteExam}
            onAssignExamToClasses={handleAssignExamToClasses}
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
          classrooms={classrooms}
          onPublishExam={handlePublishExam}
          currentUserName={userProfile.name}
          examsList={examsList}
          onDeleteExam={handleDeleteExam}
          onAssignExamToClasses={handleAssignExamToClasses}
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
            defaultClassId="cls_12a1"
            submissions={submissions}
          />
        );
      case 'three_3d':
        return (
          <AIMathStudioView
            initialTab="three_3d"
            dailyScanCount={userProfile.dailyScanCount}
            maxDailyScans={userProfile.maxDailyScans}
            tier={userProfile.tier}
            onIncrementScan={handleIncrementScan}
            onUpgradeTier={handleToggleTier}
            onStartExam={(newExam) => {
              if (newExam) {
                handlePublishExam(newExam);
              }
              setCurrentTab('exam');
            }}
          />
        );
      case 'image_studio':
        return (
          <AIMathStudioView
            initialTab="image_studio"
            dailyScanCount={userProfile.dailyScanCount}
            maxDailyScans={userProfile.maxDailyScans}
            tier={userProfile.tier}
            onIncrementScan={handleIncrementScan}
            onUpgradeTier={handleToggleTier}
            onStartExam={(newExam) => {
              if (newExam) {
                handlePublishExam(newExam);
              }
              setCurrentTab('exam');
            }}
          />
        );
      case 'ask_ai':
      case 'scanner':
      case 'tutor':
      default:
        return (
          <AIMathStudioView
            initialTab="tutor"
            dailyScanCount={userProfile.dailyScanCount}
            maxDailyScans={userProfile.maxDailyScans}
            tier={userProfile.tier}
            onIncrementScan={handleIncrementScan}
            onUpgradeTier={handleToggleTier}
            onStartExam={(newExam) => {
              if (newExam) {
                handlePublishExam(newExam);
              }
              setCurrentTab('exam');
            }}
          />
        );
    }
  };

  // Nếu chưa đăng nhập, hiển thị Giao diện Đăng nhập / Đăng ký
  if (!isAuthenticated) {
    return (
      <AuthLoginView
        allUsers={allUsers}
        onLoginSuccess={handleLoginSuccess}
        onRegisterUser={handleCreateUser}
      />
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
          tier={userProfile.tier}
          onToggleTier={handleToggleTier}
          streakDays={userProfile.streakDays}
          xp={userProfile.xp}
          userName={userProfile.name}
          userAvatar={userProfile.avatar}
          onLogout={handleLogout}
          notifications={notifications}
          onClearNotifications={() => setNotifications([])}
          onRequestPushPermission={requestNotificationPermission}
          unreadClassroomMessagesCount={unreadClassroomMessagesCount}
        />
      )}

      {/* Main Content Area (Hoàn toàn tự nhiên, co giãn responsive mượt mà trên mọi thiết bị: PC, iPad, Điện thoại) */}
      <main className={`flex-1 flex justify-center ${isExamMode ? 'w-full p-0' : 'py-3 sm:py-8 px-2 sm:px-4 pb-20 md:pb-8'}`}>
        <div className="w-full">{renderCurrentView()}</div>
      </main>

      {/* Mobile Bottom Tab Bar (Thanh điều hướng tiện dụng ở chân trang trên điện thoại di động thực tế) */}
      {!isExamMode && isAuthenticated && (
        <nav aria-label="Điều hướng di động" className="fixed bottom-0 left-0 right-0 z-40 md:hidden bg-white/95 backdrop-blur-md border-t border-slate-200 shadow-lg px-2 h-16 flex items-center justify-around">
          {userRole === 'admin' ? (
            // 1. Quản Trị Viên
            <>
              <button
                onClick={() => setCurrentTab('admin_dashboard')}
                className={`flex flex-col items-center gap-0.5 ${
                  currentTab === 'admin_dashboard' ? 'text-blue-600 font-bold' : 'text-slate-400'
                }`}
              >
                <ShieldAlert size={18} />
                <span className="text-[10px]">Quản Trị</span>
              </button>
              <button
                onClick={() => setCurrentTab('profile')}
                className={`flex flex-col items-center gap-0.5 ${
                  currentTab === 'profile' ? 'text-blue-600 font-bold' : 'text-slate-400'
                }`}
              >
                <User size={18} />
                <span className="text-[10px]">Hồ Sơ</span>
              </button>
            </>
          ) : userRole === 'teacher' ? (
            // 2. Giáo Viên
            <>
              <button
                onClick={() => setCurrentTab('classroom')}
                className={`flex flex-col items-center gap-0.5 ${
                  currentTab === 'classroom' ? 'text-blue-600 font-bold' : 'text-slate-400'
                }`}
              >
                <div className="relative">
                  <Users size={18} />
                  {unreadClassroomMessagesCount > 0 && (
                    <span className="absolute -top-1.5 -right-2 bg-rose-500 text-white text-[9px] font-black px-1 rounded-full min-w-[15px] h-3.5 flex items-center justify-center shadow-xs animate-pulse">
                      {unreadClassroomMessagesCount > 99 ? '99+' : unreadClassroomMessagesCount}
                    </span>
                  )}
                </div>
                <span className="text-[10px]">Nhóm Lớp</span>
              </button>
              <button
                onClick={() => setCurrentTab('teacher_gradebook')}
                className={`flex flex-col items-center gap-0.5 ${
                  currentTab === 'teacher_gradebook' ? 'text-blue-600 font-bold' : 'text-slate-400'
                }`}
              >
                <BarChart3 size={18} />
                <span className="text-[10px]">Bảng Điểm</span>
              </button>
              <button
                onClick={() => setCurrentTab('teacher_portal')}
                className={`flex flex-col items-center gap-0.5 ${
                  currentTab === 'teacher_portal' ? 'text-blue-600 font-bold' : 'text-slate-400'
                }`}
              >
                <FileText size={18} />
                <span className="text-[10px]">Tạo Đề</span>
              </button>
              <button
                onClick={() => setCurrentTab('geometry')}
                className={`flex flex-col items-center gap-0.5 ${
                  currentTab === 'geometry' ? 'text-blue-600 font-bold' : 'text-slate-400'
                }`}
              >
                <Compass size={18} />
                <span className="text-[10px]">Vẽ Hình</span>
              </button>
              <button
                onClick={() => setCurrentTab('profile')}
                className={`flex flex-col items-center gap-0.5 ${
                  currentTab === 'profile' ? 'text-blue-600 font-bold' : 'text-slate-400'
                }`}
              >
                <User size={18} />
                <span className="text-[10px]">Hồ Sơ</span>
              </button>
            </>
          ) : (
            // 3. Học Sinh
            <>
              <button
                onClick={() => setCurrentTab('ask_ai')}
                className={`flex flex-col items-center gap-0.5 ${
                  currentTab === 'ask_ai' || currentTab === 'scanner' || currentTab === 'tutor'
                    ? 'text-blue-600 font-bold'
                    : 'text-slate-400'
                }`}
              >
                <Sparkles size={18} />
                <span className="text-[10px]">Hỏi AI</span>
              </button>
              <button
                onClick={() => setCurrentTab('classroom')}
                className={`flex flex-col items-center gap-0.5 ${
                  currentTab === 'classroom' ? 'text-blue-600 font-bold' : 'text-slate-400'
                }`}
              >
                <div className="relative">
                  <Users size={18} />
                  {unreadClassroomMessagesCount > 0 && (
                    <span className="absolute -top-1.5 -right-2 bg-rose-500 text-white text-[9px] font-black px-1 rounded-full min-w-[15px] h-3.5 flex items-center justify-center shadow-xs animate-pulse">
                      {unreadClassroomMessagesCount > 99 ? '99+' : unreadClassroomMessagesCount}
                    </span>
                  )}
                </div>
                <span className="text-[10px]">Nhóm lớp</span>
              </button>
              <button
                onClick={() => setCurrentTab('student_history')}
                className={`flex flex-col items-center gap-0.5 ${
                  currentTab === 'student_history' ? 'text-blue-600 font-bold' : 'text-slate-400'
                }`}
              >
                <FileCheck size={18} />
                <span className="text-[10px]">Bài đã làm</span>
              </button>
              <button
                onClick={() => setCurrentTab('geometry')}
                className={`flex flex-col items-center gap-0.5 ${
                  currentTab === 'geometry' ? 'text-blue-600 font-bold' : 'text-slate-400'
                }`}
              >
                <Compass size={18} />
                <span className="text-[10px]">Vẽ Hình</span>
              </button>
              <button
                onClick={() => setCurrentTab('profile')}
                className={`flex flex-col items-center gap-0.5 ${
                  currentTab === 'profile' ? 'text-blue-600 font-bold' : 'text-slate-400'
                }`}
              >
                <User size={18} />
                <span className="text-[10px]">Hồ Sơ</span>
              </button>
            </>
          )}
        </nav>
      )}

      {/* Footer */}
      {currentTab !== 'exam' && (
        <footer className="bg-white border-t border-slate-200 py-6 px-4 text-center text-xs text-slate-500">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
            <p>© 2026 Math&NBK Platform. Hệ thống Giáo dục Toán học THPT Chuẩn Quốc Gia.</p>
            <div className="flex items-center gap-4 text-slate-400">
              <span>Phiên bản 2.6 (GDPT 2018)</span>
              <span>·</span>
              <span>Học & Thi Trắc Nghiệm Thông Minh</span>
            </div>
          </div>
        </footer>
      )}

      {/* Floating Push Notification Toast */}
      {activeToast && (
        <div
          role="alert"
          onClick={() => {
            if (activeToast.targetTab) {
              setCurrentTab(activeToast.targetTab);
            }
            if (activeToast.examId) {
              setActiveExamId(activeToast.examId);
            }
            setActiveToast(null);
          }}
          className={`fixed bottom-5 right-5 z-50 max-w-sm w-full text-white p-4 rounded-2xl shadow-2xl backdrop-blur-md cursor-pointer animate-in slide-in-from-bottom-5 duration-300 hover:scale-[1.02] transition-transform flex items-start gap-3 ${
            activeToast.type === 'error'
              ? 'bg-slate-950/95 border border-rose-500/60 ring-1 ring-rose-500/30'
              : activeToast.type === 'chat_message'
              ? 'bg-slate-900/95 border border-cyan-500/40 ring-1 ring-cyan-500/20'
              : 'bg-slate-900/95 border border-blue-500/30'
          }`}
        >
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-xs ${
              activeToast.type === 'error'
                ? 'bg-gradient-to-br from-rose-600 to-red-700 text-white'
                : activeToast.type === 'chat_message'
                ? 'bg-gradient-to-br from-cyan-600 to-blue-700 text-white'
                : activeToast.type === 'exam_graded'
                ? 'bg-gradient-to-br from-blue-600 to-indigo-600'
                : 'bg-gradient-to-br from-blue-600 to-indigo-600'
            }`}
          >
            {activeToast.type === 'error' ? (
              <AlertTriangle size={20} className="text-white animate-pulse" />
            ) : activeToast.type === 'chat_message' ? (
              <MessageSquare size={20} className="text-cyan-200" />
            ) : activeToast.type === 'exam_graded' ? (
              <FileCheck size={20} className="text-emerald-300" />
            ) : (
              <Sparkles size={20} className="text-amber-300" />
            )}
          </div>
          <div className="flex-1 min-w-0 pr-1">
            <div className="flex items-center justify-between">
              <span
                className={`text-[10px] font-black uppercase tracking-wider ${
                  activeToast.type === 'error'
                    ? 'text-rose-400'
                    : activeToast.type === 'chat_message'
                    ? 'text-cyan-400'
                    : 'text-blue-400'
                }`}
              >
                {activeToast.type === 'error'
                  ? 'Cảnh báo lỗi'
                  : activeToast.type === 'chat_message'
                  ? 'Tin nhắn & Nhắc tên'
                  : activeToast.type === 'exam_graded'
                  ? 'Kết quả chấm thi'
                  : 'Thông báo mới'}
              </span>
              <span className="text-[10px] text-slate-400">Vừa xong</span>
            </div>
            <h4 className="text-xs font-bold text-white truncate mt-0.5">{activeToast.title}</h4>
            <p
              className={`text-[11px] line-clamp-2 mt-0.5 leading-snug ${
                activeToast.type === 'error' ? 'text-rose-100 font-medium' : 'text-slate-300'
              }`}
            >
              {activeToast.message}
            </p>
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setActiveToast(null);
            }}
            aria-label="Đóng thông báo"
            className="text-slate-400 hover:text-white transition-colors p-1"
          >
            <X size={14} />
          </button>
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
              <p className="text-[11px] text-slate-500">
                Sau khi đăng xuất, phiên làm việc sẽ kết thúc và bạn sẽ được chuyển về màn hình Đăng nhập.
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
