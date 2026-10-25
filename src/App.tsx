/**
 * Math&NBK - Ứng Dụng Học Toán THPT Thông Minh
 * Bản Quyền: Math&NBK Education Platform
 */

import React, { useState, useEffect } from 'react';
import { UserProfile, UserRole, AccountTier, CheatLog, Exam, Classroom, StudentExamSubmission, ClassroomLesson } from './types/math';
import {
  INITIAL_USER_PROFILE,
  SAMPLE_CHEAT_LOGS,
  SAMPLE_EXAM_BGD,
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
  dbSaveMessage,
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
  const [examsList, setExamsList] = useState<Exam[]>([SAMPLE_EXAM_BGD]);
  const [activeExamId, setActiveExamId] = useState<string>(SAMPLE_EXAM_BGD.id);

  // Nhóm lớp, Bài học & Kết quả bài nộp của học sinh (Đồng bộ qua máy chủ)
  const [classrooms, setClassrooms] = useState<Classroom[]>(SAMPLE_CLASSROOMS);
  const [submissions, setSubmissions] = useState<StudentExamSubmission[]>(SAMPLE_SUBMISSIONS);
  const [classroomLessons, setClassroomLessons] = useState<ClassroomLesson[]>(SAMPLE_CLASSROOM_LESSONS);

  // Quản lý thông báo đẩy (Push Notifications)
  const [notifications, setNotifications] = useState<PushNotificationItem[]>([
    {
      id: 'notif_welcome',
      title: 'Chào mừng bạn đến với Math&NBK',
      message: 'Hệ thống học Toán THPT thông minh GDPT 2018 tích hợp AI và phòng thi chuẩn Bộ GD&ĐT.',
      type: 'system',
      timestamp: new Date().toISOString(),
      isRead: false,
      targetTab: 'classroom',
    },
  ]);
  const [activeToast, setActiveToast] = useState<PushNotificationItem | null>(null);

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

  // Lắng nghe sự kiện thông báo đẩy trong hệ thống
  useEffect(() => {
    const handler = (e: Event) => {
      const customEvent = e as CustomEvent<PushNotificationItem>;
      if (customEvent.detail) {
        setNotifications((prev) => [customEvent.detail, ...prev]);
        setActiveToast(customEvent.detail);
        const timer = setTimeout(() => {
          setActiveToast((curr) => (curr?.id === customEvent.detail.id ? null : curr));
        }, 6000);
        return () => clearTimeout(timer);
      }
    };
    window.addEventListener('math_nbk_push_notification', handler);
    return () => window.removeEventListener('math_nbk_push_notification', handler);
  }, []);

  // Tự động đồng bộ Real-Time cơ sở dữ liệu trên máy chủ (Sync đa thiết bị / khác máy)
  useEffect(() => {
    let knownPendingIds = new Set<string>();

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

      if (remoteData.classroomLessons && Array.isArray(remoteData.classroomLessons)) {
        setClassroomLessons(remoteData.classroomLessons);
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
      const allowedTeacherTabs = ['classroom', 'teacher_gradebook', 'teacher_portal', 'geometry', 'ask_ai', 'profile', 'exam', 'three_3d', 'image_studio'];
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

  // Cập nhật bài học đồng bộ lên Server
  const handleUpdateLessons = (updated: ClassroomLesson[]) => {
    setClassroomLessons(updated);
    dbSaveLessons(updated).catch(console.error);
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

  // Giáo viên đăng tải đề thi mới: Tự động phát thông báo đẩy cho học sinh
  const handlePublishExam = (newExam: Exam) => {
    setExamsList((prev) => {
      const filtered = prev.filter((e) => e.id !== newExam.id);
      return [newExam, ...filtered];
    });
    setActiveExamId(newExam.id);

    // Kích hoạt thông báo đẩy cho học sinh
    triggerPushNotification(`Đề thi mới: ${newExam.title}`, {
      message: `Thầy cô vừa đăng tải đề thi mới (${newExam.durationMinutes} phút - ${newExam.questions.length} câu). Nhấn để vào phòng luyện thi ngay!`,
      type: 'exam_published',
      targetTab: 'classroom',
      examId: newExam.id,
    });
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
            classrooms={classrooms}
            onUpdateClassrooms={handleUpdateClassrooms}
            examsList={examsList}
            onUpdateExamsList={setExamsList}
            onSelectExamToTake={(examId) => {
              setActiveExamId(examId);
              setCurrentTab('exam');
            }}
            onViewClassGradebook={() => {
              setCurrentTab('teacher_gradebook');
            }}
            classroomLessons={classroomLessons}
            onUpdateLessons={handleUpdateLessons}
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
            onStartExam={() => setCurrentTab('exam')}
          />
        );
      }

      // Default for teacher: Teacher Portal (Tạo đề thi thủ công & Tải PDF)
      return (
        <TeacherPortalView
          classrooms={classrooms}
          onPublishExam={handlePublishExam}
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
            classrooms={classrooms}
            onUpdateClassrooms={handleUpdateClassrooms}
            examsList={examsList}
            onUpdateExamsList={setExamsList}
            onSelectExamToTake={(examId) => {
              setActiveExamId(examId);
              setCurrentTab('exam');
            }}
            classroomLessons={classroomLessons}
            onUpdateLessons={handleUpdateLessons}
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
            onStartExam={() => setCurrentTab('exam')}
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
            onStartExam={() => setCurrentTab('exam')}
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
            onStartExam={() => setCurrentTab('exam')}
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
          deviceMode={deviceMode}
          onSelectDeviceMode={setDeviceMode}
          userName={userProfile.name}
          userAvatar={userProfile.avatar}
          onLogout={handleLogout}
          notifications={notifications}
          onClearNotifications={() => setNotifications([])}
          onRequestPushPermission={requestNotificationPermission}
        />
      )}

      {/* Main Content Area (100% toàn màn hình khi làm bài, không khung viền thừa) */}
      <main className={`flex-1 flex justify-center ${isExamMode ? 'w-full p-0' : 'py-4 sm:py-8 px-2 sm:px-4'}`}>
        {isExamMode || deviceMode === 'desktop' ? (
          <div className="w-full">{renderCurrentView()}</div>
        ) : deviceMode === 'tablet' ? (
          // Tablet Frame (iPad Style 768px)
          <div className="w-full max-w-[820px] bg-white rounded-[40px] border-[12px] border-slate-800 shadow-2xl overflow-hidden flex flex-col my-auto max-h-[90vh]">
            <div className="h-6 bg-slate-800 flex items-center justify-center">
              <div className="w-3 h-3 rounded-full bg-slate-700" />
            </div>
            <div className="flex-1 overflow-y-auto">{renderCurrentView()}</div>
          </div>
        ) : (
          // Smartphone Frame (iPhone Style 414px)
          <div className="w-full max-w-[420px] bg-white rounded-[48px] border-[14px] border-slate-900 shadow-2xl overflow-hidden flex flex-col my-auto max-h-[88vh]">
            {/* Dynamic Island / Notch */}
            <div className="h-8 bg-slate-900 flex items-center justify-center relative">
              <div className="w-24 h-4 bg-black rounded-full" />
            </div>

            {/* Scrollable Screen Content */}
            <div className="flex-1 overflow-y-auto pb-16">{renderCurrentView()}</div>

            {/* Mobile Bottom Tab Bar (Phân quyền giao diện độc lập tuyệt đối theo 3 vai trò) */}
            {currentTab !== 'exam' && (
              <div className="h-16 bg-white/95 border-t border-slate-200 flex items-center justify-around px-2 relative z-20">
                {userRole === 'admin' ? (
                  // 1. Thanh điều hướng cho Quản Trị Viên
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
                  // 2. Thanh điều hướng cho Giáo Viên
                  <>
                    <button
                      onClick={() => setCurrentTab('classroom')}
                      className={`flex flex-col items-center gap-0.5 ${
                        currentTab === 'classroom' ? 'text-blue-600 font-bold' : 'text-slate-400'
                      }`}
                    >
                      <Users size={18} />
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
                  // 3. Thanh điều hướng cho Học Sinh
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
                      <Users size={18} />
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
              </div>
            )}
          </div>
        )}
      </main>

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
          className="fixed bottom-5 right-5 z-50 max-w-sm w-full bg-slate-900/95 text-white p-4 rounded-2xl shadow-2xl border border-blue-500/30 backdrop-blur-md cursor-pointer animate-in slide-in-from-bottom-5 duration-300 hover:scale-[1.02] transition-transform flex items-start gap-3"
        >
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center shrink-0 shadow-xs">
            {activeToast.type === 'exam_graded' ? (
              <FileCheck size={20} className="text-emerald-300" />
            ) : (
              <Sparkles size={20} className="text-amber-300" />
            )}
          </div>
          <div className="flex-1 min-w-0 pr-1">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-wider text-blue-400">
                {activeToast.type === 'exam_graded' ? 'Kết quả chấm thi' : 'Thông báo mới'}
              </span>
              <span className="text-[10px] text-slate-400">Vừa xong</span>
            </div>
            <h4 className="text-xs font-bold text-white truncate mt-0.5">{activeToast.title}</h4>
            <p className="text-[11px] text-slate-300 line-clamp-2 mt-0.5 leading-snug">
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
                <p className="text-xs text-slate-500">Hệ thống học toán Math&NBK</p>
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
