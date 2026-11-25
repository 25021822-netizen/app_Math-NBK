import React, { useState, useEffect } from 'react';
import { UserRole, canAccessSubjectTab, resolveTeacherSubject } from '../types/math';
import {
  PushNotificationItem,
  isNotificationsEnabled,
  setNotificationsEnabled,
  isNotificationSoundEnabled,
  setNotificationSoundEnabled,
  playNotificationChime,
} from '../utils/notificationService';
import {
  BookOpen,
  Flame,
  Zap,
  UserCheck,
  Users,
  Compass,
  User,
  Bell,
  BellOff,
  BellRing,
  Volume2,
  VolumeX,
  LogOut,
  Check,
  CheckCircle2,
  FileCheck,
  ShieldAlert,
  GraduationCap,
  Box,
  Wand2,
  Menu,
  X,
  BarChart3,
  FileText,
  ChevronRight,
  Shield,
  Layers,
  Atom,
  FlaskConical,
} from 'lucide-react';

interface NavbarProps {
  currentTab: string;
  onSelectTab: (tab: string) => void;
  userRole: UserRole;
  onSelectRole?: (role: UserRole) => void;
  streakDays: number;
  xp: number;
  deviceMode?: 'desktop' | 'tablet' | 'mobile';
  onSelectDeviceMode?: (mode: 'desktop' | 'tablet' | 'mobile') => void;
  onOpenFriendsModal?: () => void;
  friendsCount?: number;
  pendingRequestsCount?: number;
  userName?: string;
  userAvatar?: string;
  onLogout?: () => void;
  notifications?: PushNotificationItem[];
  onClearNotifications?: () => void;
  onRequestPushPermission?: () => void;
  unreadClassroomMessagesCount?: number;
  userSubject?: string;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentTab,
  onSelectTab,
  userRole,
  onSelectRole,
  streakDays,
  xp,
  onOpenFriendsModal,
  friendsCount = 0,
  pendingRequestsCount = 0,
  userName = 'Người Dùng',
  userAvatar,
  onLogout,
  notifications = [],
  onClearNotifications,
  onRequestPushPermission,
  unreadClassroomMessagesCount = 0,
  userSubject,
}) => {
  const teacherSubject = resolveTeacherSubject(userRole, userSubject);
  const [showNotifDropdown, setShowNotifDropdown] = useState<boolean>(false);
  const [showMobileMenu, setShowMobileMenu] = useState<boolean>(false);
  const [notificationsEnabled, setNotificationsEnabledState] = useState<boolean>(() => isNotificationsEnabled());
  const [soundEnabled, setSoundEnabledState] = useState<boolean>(() => isNotificationSoundEnabled());

  useEffect(() => {
    const handleToggle = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (typeof detail?.enabled === 'boolean') {
        setNotificationsEnabledState(detail.enabled);
      }
    };
    const handleSoundToggle = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (typeof detail?.enabled === 'boolean') {
        setSoundEnabledState(detail.enabled);
      }
    };
    window.addEventListener('math_nbk_notifications_toggle', handleToggle);
    window.addEventListener('math_nbk_sound_toggle', handleSoundToggle);
    return () => {
      window.removeEventListener('math_nbk_notifications_toggle', handleToggle);
      window.removeEventListener('math_nbk_sound_toggle', handleSoundToggle);
    };
  }, []);

  const handleToggleNotifications = () => {
    const next = !notificationsEnabled;
    setNotificationsEnabledState(next);
    setNotificationsEnabled(next);
    if (next) {
      playNotificationChime('general');
    }
  };

  const handleToggleSound = () => {
    const next = !soundEnabled;
    setSoundEnabledState(next);
    setNotificationSoundEnabled(next);
    if (next) {
      playNotificationChime('general');
    }
  };

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const handleMobileTabSelect = (tab: string) => {
    onSelectTab(tab);
    setShowMobileMenu(false);
  };

  return (
    <>
      {/* ========================================================= */}
      {/* 1. TOP HEADER BAR (DESKTOP & MOBILE)                      */}
      {/* ========================================================= */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 h-16 flex items-center justify-between gap-2 sm:gap-6">
          {/* Zone 1: Brand Wordmark */}
          <div className="flex items-center gap-2.5 shrink-0">
            <a
              href="#"
              onClick={(e) => {
                e.preventDefault();
                if (userRole === 'admin') handleMobileTabSelect('admin_dashboard');
                else handleMobileTabSelect('classroom');
              }}
              className="flex items-center gap-2 sm:gap-2.5 group"
            >
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-tr from-blue-700 to-indigo-600 flex items-center justify-center text-white shadow-xs group-hover:scale-105 transition-transform">
                <BookOpen size={20} className="stroke-[2.5]" />
              </div>
              <div className="flex flex-col">
                <span className="text-lg sm:text-xl font-extrabold tracking-tight text-slate-900 leading-none">
                  Toán Học <span className="text-blue-600">LIKI</span>
                </span>
                <span className="text-[9px] sm:text-[10px] text-slate-400 font-medium tracking-wide">
                  Toán · Vật Lý · Hóa Học THPT
                </span>
              </div>
            </a>
          </div>

          {/* Zone 2: Desktop Navigation Links (Single-line, whitespace-nowrap) */}
          <nav className="hidden md:flex items-center gap-2.5 lg:gap-3.5 text-xs lg:text-[13px] font-medium text-slate-600 overflow-x-auto no-scrollbar">
            {userRole === 'student' && (
              <>
                <button
                  onClick={() => onSelectTab('classroom')}
                  className={`whitespace-nowrap transition-colors py-1 ${
                    currentTab === 'classroom'
                      ? 'text-blue-600 font-bold border-b-2 border-blue-600'
                      : 'hover:text-slate-900'
                  }`}
                >
                  <span className="relative inline-flex items-center gap-1.5">
                    <span>Nhóm Lớp</span>
                    {unreadClassroomMessagesCount > 0 && (
                      <span className="inline-flex items-center justify-center px-1.5 py-0.2 text-[10px] font-black leading-none text-white bg-rose-500 rounded-full shadow-xs animate-pulse">
                        {unreadClassroomMessagesCount > 99 ? '99+' : unreadClassroomMessagesCount}
                      </span>
                    )}
                  </span>
                </button>
                <button
                  onClick={() => onSelectTab('student_history')}
                  className={`whitespace-nowrap transition-colors py-1 ${
                    currentTab === 'student_history'
                      ? 'text-blue-600 font-bold border-b-2 border-blue-600'
                      : 'hover:text-slate-900'
                  }`}
                >
                  Bài Đã Làm
                </button>
                <button
                  onClick={() => onSelectTab('geometry')}
                  className={`whitespace-nowrap transition-colors py-1 flex items-center gap-1 ${
                    currentTab === 'geometry'
                      ? 'text-blue-600 font-bold border-b-2 border-blue-600'
                      : 'hover:text-slate-900'
                  }`}
                >
                  <Compass size={14} />
                  <span>Vẽ Hình 2D/3D</span>
                </button>
                <button
                  onClick={() => onSelectTab('physics_sim')}
                  className={`whitespace-nowrap transition-colors py-1 flex items-center gap-1 ${
                    currentTab === 'physics_sim'
                      ? 'text-sky-600 font-bold border-b-2 border-sky-600'
                      : 'hover:text-slate-900'
                  }`}
                >
                  <Atom size={14} className="text-sky-600" />
                  <span>Mô Phỏng (Vật Lý)</span>
                </button>
                <button
                  onClick={() => onSelectTab('chemistry_lab')}
                  className={`whitespace-nowrap transition-colors py-1 flex items-center gap-1 ${
                    currentTab === 'chemistry_lab'
                      ? 'text-emerald-600 font-bold border-b-2 border-emerald-600'
                      : 'hover:text-slate-900'
                  }`}
                >
                  <FlaskConical size={14} className="text-emerald-600" />
                  <span>Thí Nghiệm (Hóa Học)</span>
                </button>
                <button
                  onClick={() => onSelectTab('profile')}
                  className={`whitespace-nowrap transition-colors py-1 flex items-center gap-1 ${
                    currentTab === 'profile'
                      ? 'text-blue-600 font-bold border-b-2 border-blue-600'
                      : 'hover:text-slate-900'
                  }`}
                >
                  <User size={14} />
                  <span>Hồ Sơ</span>
                </button>
              </>
            )}

            {userRole === 'teacher' && (
              <>
                <button
                  onClick={() => onSelectTab('classroom')}
                  className={`whitespace-nowrap transition-colors py-1 ${
                    currentTab === 'classroom'
                      ? 'text-blue-600 font-bold border-b-2 border-blue-600'
                      : 'hover:text-slate-900'
                  }`}
                >
                  <span className="relative inline-flex items-center gap-1.5">
                    <span>Quản Lý Nhóm Lớp</span>
                    {unreadClassroomMessagesCount > 0 && (
                      <span className="inline-flex items-center justify-center px-1.5 py-0.2 text-[10px] font-black leading-none text-white bg-rose-500 rounded-full shadow-xs animate-pulse">
                        {unreadClassroomMessagesCount > 99 ? '99+' : unreadClassroomMessagesCount}
                      </span>
                    )}
                  </span>
                </button>
                <button
                  onClick={() => onSelectTab('teacher_gradebook')}
                  className={`whitespace-nowrap transition-colors py-1 ${
                    currentTab === 'teacher_gradebook'
                      ? 'text-blue-600 font-bold border-b-2 border-blue-600'
                      : 'hover:text-slate-900'
                  }`}
                >
                  Tổng Hợp Điểm Thi
                </button>
                <button
                  onClick={() => onSelectTab('exam_repository')}
                  className={`whitespace-nowrap transition-colors py-1 flex items-center gap-1.5 ${
                    currentTab === 'exam_repository'
                      ? 'text-blue-600 font-bold border-b-2 border-blue-600'
                      : 'hover:text-slate-900'
                  }`}
                >
                  <Layers size={14} className="text-amber-500" />
                  <span>Kho Đề Thi</span>
                </button>
                <button
                  onClick={() => onSelectTab('teacher_portal')}
                  className={`whitespace-nowrap transition-colors py-1 ${
                    currentTab === 'teacher_portal'
                      ? 'text-blue-600 font-bold border-b-2 border-blue-600'
                      : 'hover:text-slate-900'
                  }`}
                >
                  Tạo Đề Thi & Tải PDF
                </button>
                {canAccessSubjectTab('geometry', userRole, userSubject) && (
                  <button
                    onClick={() => onSelectTab('geometry')}
                    className={`whitespace-nowrap transition-colors py-1 flex items-center gap-1 ${
                      currentTab === 'geometry'
                        ? 'text-blue-600 font-bold border-b-2 border-blue-600'
                        : 'hover:text-slate-900'
                    }`}
                  >
                    <Compass size={14} />
                    <span>Vẽ Hình 2D/3D</span>
                  </button>
                )}
                {canAccessSubjectTab('physics_sim', userRole, userSubject) && (
                  <button
                    onClick={() => onSelectTab('physics_sim')}
                    className={`whitespace-nowrap transition-colors py-1 flex items-center gap-1 ${
                      currentTab === 'physics_sim'
                        ? 'text-sky-600 font-bold border-b-2 border-sky-600'
                        : 'hover:text-slate-900'
                    }`}
                  >
                    <Atom size={14} className="text-sky-600" />
                    <span>Mô Phỏng (Vật Lý)</span>
                  </button>
                )}
                {canAccessSubjectTab('chemistry_lab', userRole, userSubject) && (
                  <button
                    onClick={() => onSelectTab('chemistry_lab')}
                    className={`whitespace-nowrap transition-colors py-1 flex items-center gap-1 ${
                      currentTab === 'chemistry_lab'
                        ? 'text-emerald-600 font-bold border-b-2 border-emerald-600'
                        : 'hover:text-slate-900'
                    }`}
                  >
                    <FlaskConical size={14} className="text-emerald-600" />
                    <span>Thí Nghiệm (Hóa Học)</span>
                  </button>
                )}
                <button
                  onClick={() => onSelectTab('profile')}
                  className={`whitespace-nowrap transition-colors py-1 flex items-center gap-1 ${
                    currentTab === 'profile'
                      ? 'text-blue-600 font-bold border-b-2 border-blue-600'
                      : 'hover:text-slate-900'
                  }`}
                >
                  <User size={14} />
                  <span>Hồ Sơ</span>
                </button>
              </>
            )}

            {userRole === 'admin' && (
              <>
                <button
                  onClick={() => onSelectTab('admin_dashboard')}
                  className={`whitespace-nowrap transition-colors py-1 ${
                    currentTab === 'admin_dashboard'
                      ? 'text-blue-600 font-bold border-b-2 border-blue-600'
                      : 'hover:text-slate-900'
                  }`}
                >
                  Trung Tâm Quản Trị Hệ Thống
                </button>
                <button
                  onClick={() => onSelectTab('profile')}
                  className={`whitespace-nowrap transition-colors py-1 flex items-center gap-1 ${
                    currentTab === 'profile'
                      ? 'text-blue-600 font-bold border-b-2 border-blue-600'
                      : 'hover:text-slate-900'
                  }`}
                >
                  <User size={14} />
                  <span>Hồ Sơ</span>
                </button>
              </>
            )}
          </nav>

          {/* Zone 3: Controls, Icons & Mobile Menu Button */}
          <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">

            {/* Friends Network Button */}
            {onOpenFriendsModal && (
              <button
                onClick={onOpenFriendsModal}
                title="Mạng lưới bạn bè qua ID"
                className="relative p-2 sm:px-3 sm:py-1.5 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 text-xs font-bold flex items-center gap-1.5 transition-colors whitespace-nowrap shadow-xs cursor-pointer"
              >
                <UserCheck size={16} />
                <span className="hidden sm:inline">Bạn Bè</span>
                {friendsCount > 0 && (
                  <span className="text-[10px] bg-blue-600 text-white px-1.5 py-0.2 rounded-full font-mono font-bold">
                    {friendsCount}
                  </span>
                )}
                {pendingRequestsCount > 0 && (
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-500 absolute -top-1 -right-1 animate-pulse" />
                )}
              </button>
            )}


            {/* Push Notification Bell Icon with Badge & Dropdown */}
            <div className="relative">
              <button
                onClick={() => setShowNotifDropdown(!showNotifDropdown)}
                title={
                  notificationsEnabled
                    ? 'Thông báo hệ thống, bài mới & chat (Đang BẬT)'
                    : 'Thông báo đang TẮT (Bấm để mở cài đặt)'
                }
                className={`relative p-2 rounded-xl border transition-all cursor-pointer ${
                  !notificationsEnabled
                    ? 'text-slate-400 bg-slate-50 border-slate-200 hover:text-slate-600'
                    : unreadCount > 0
                    ? 'text-blue-600 bg-blue-50/80 border-blue-200 hover:bg-blue-100 shadow-2xs'
                    : 'text-slate-600 hover:text-blue-600 hover:bg-blue-50 border-slate-200'
                }`}
              >
                {notificationsEnabled ? (
                  <Bell size={18} />
                ) : (
                  <BellOff size={18} />
                )}
                {notificationsEnabled && unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-rose-600 text-white font-mono font-bold text-[10px] flex items-center justify-center animate-pulse shadow-xs">
                    {unreadCount}
                  </span>
                )}
              </button>

              {/* Notification Dropdown Panel */}
              {showNotifDropdown && (
                <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-3xl border border-slate-200 shadow-2xl p-4 z-50 animate-in fade-in space-y-3.5">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                    <div className="flex items-center gap-2">
                      <div
                        className={`w-7 h-7 rounded-lg flex items-center justify-center ${
                          notificationsEnabled ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 text-slate-400'
                        }`}
                      >
                        {notificationsEnabled ? <BellRing size={15} /> : <BellOff size={15} />}
                      </div>
                      <span className="font-extrabold text-xs text-slate-900">
                        Thông Báo ({notifications.length})
                      </span>
                    </div>
                    {notifications.length > 0 && onClearNotifications && (
                      <button
                        onClick={onClearNotifications}
                        className="text-[10px] text-slate-400 hover:text-rose-600 font-bold transition-colors cursor-pointer"
                      >
                        Xóa tất cả
                      </button>
                    )}
                  </div>

                  {/* CẦN GẠT ON / OFF THÔNG BÁO (THEO YÊU CẦU NGƯỜI DÙNG) */}
                  <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 space-y-2.5">
                    {/* Cần gạt chính: Bật / Tắt tất cả thông báo */}
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div
                          className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 transition-colors ${
                            notificationsEnabled
                              ? 'bg-blue-600 text-white shadow-xs'
                              : 'bg-slate-200 text-slate-500'
                          }`}
                        >
                          {notificationsEnabled ? <Bell size={16} /> : <BellOff size={16} />}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="font-extrabold text-xs text-slate-900">Nhận Thông Báo</span>
                            <span
                              className={`px-1.5 py-0.2 rounded text-[9px] font-bold uppercase tracking-wider ${
                                notificationsEnabled
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-slate-200 text-slate-600'
                              }`}
                            >
                              {notificationsEnabled ? 'ON' : 'OFF'}
                            </span>
                          </div>
                          <span className="text-[10px] text-slate-500 block truncate">
                            {notificationsEnabled
                              ? 'Báo khi đăng bài, đăng đề & nhắc tên trong chat'
                              : 'Đang tạm dừng nhận thông báo'}
                          </span>
                        </div>
                      </div>

                      {/* Cần gạt Toggle Switch ON / OFF */}
                      <button
                        type="button"
                        role="switch"
                        aria-checked={notificationsEnabled}
                        onClick={handleToggleNotifications}
                        title={notificationsEnabled ? 'Gạt để TẮT thông báo' : 'Gạt để BẬT thông báo'}
                        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none shadow-inner ${
                          notificationsEnabled ? 'bg-blue-600' : 'bg-slate-300'
                        }`}
                      >
                        <span
                          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                            notificationsEnabled ? 'translate-x-5' : 'translate-x-0'
                          }`}
                        />
                      </button>
                    </div>

                    {/* Cần gạt phụ: Bật / Tắt Âm thanh chuông báo */}
                    {notificationsEnabled && (
                      <div className="flex items-center justify-between gap-3 pt-2 border-t border-slate-200/70 text-xs">
                        <div className="flex items-center gap-2 text-slate-600">
                          {soundEnabled ? (
                            <Volume2 size={14} className="text-blue-600" />
                          ) : (
                            <VolumeX size={14} className="text-slate-400" />
                          )}
                          <span className="text-[11px] font-semibold">Âm thanh chuông báo:</span>
                        </div>
                        <button
                          type="button"
                          onClick={handleToggleSound}
                          className={`px-2 py-0.5 rounded-lg font-bold text-[10px] transition-colors cursor-pointer ${
                            soundEnabled
                              ? 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                              : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
                          }`}
                        >
                          {soundEnabled ? 'Chuông: BẬT' : 'Chuông: TẮT'}
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Browser Push Permission Request Button (nếu đang BẬT) */}
                  {notificationsEnabled && onRequestPushPermission && (
                    <div className="p-2.5 rounded-2xl bg-blue-50/70 border border-blue-200 flex items-center justify-between gap-2 text-xs">
                      <span className="text-[11px] font-semibold text-blue-900">
                        Nhận báo đẩy trình duyệt ngoài màn hình?
                      </span>
                      <button
                        onClick={() => {
                          onRequestPushPermission();
                        }}
                        className="px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-[10px] shrink-0 shadow-xs cursor-pointer"
                      >
                        Cấp quyền
                      </button>
                    </div>
                  )}

                  {/* Notifications List */}
                  <div className="max-h-64 overflow-y-auto space-y-2 pr-1">
                    {notifications.length === 0 ? (
                      <p className="text-xs text-slate-400 text-center py-6 italic">
                        Hiện chưa có thông báo mới nào.
                      </p>
                    ) : (
                      notifications.map((n) => (
                        <div
                          key={n.id}
                          onClick={() => {
                            if (n.targetTab) onSelectTab(n.targetTab);
                            setShowNotifDropdown(false);
                          }}
                          className={`p-3 rounded-2xl border transition-all cursor-pointer ${
                            n.type === 'exam_published'
                              ? 'bg-amber-50/60 border-amber-200 hover:bg-amber-50'
                              : n.type === 'exam_graded'
                              ? 'bg-emerald-50/60 border-emerald-200 hover:bg-emerald-50'
                              : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <h5 className="font-bold text-xs text-slate-900 flex items-center gap-1.5">
                              {n.type === 'exam_published' && <FileCheck size={14} className="text-amber-600 shrink-0" />}
                              {n.type === 'exam_graded' && <CheckCircle2 size={14} className="text-emerald-600 shrink-0" />}
                              <span>{n.title}</span>
                            </h5>
                            <span className="text-[9px] text-slate-400 font-mono shrink-0">
                              {new Date(n.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-600 mt-1 line-clamp-2">{n.message}</p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* User Account Avatar & Profile Pill */}
            <button
              onClick={() => onSelectTab('profile')}
              title="Xem hồ sơ cá nhân"
              className="flex items-center gap-2 p-1.5 pr-2.5 sm:pr-3 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 transition-colors cursor-pointer"
            >
              <div className="w-7 h-7 rounded-lg overflow-hidden bg-blue-100 shrink-0">
                {userAvatar ? (
                  <img src={userAvatar} alt={userName} className="w-full h-full object-cover" />
                ) : (
                  <User size={16} className="text-blue-600 m-auto mt-1" />
                )}
              </div>
              <div className="hidden lg:flex flex-col text-left">
                <span className="text-xs font-bold text-slate-800 leading-none truncate max-w-[110px]">
                  {userName}
                </span>
                <span className="text-[9px] text-slate-400 font-semibold uppercase">
                  {userRole === 'student'
                    ? 'Học sinh'
                    : userRole === 'teacher'
                    ? `GV ${teacherSubject || 'Toán Học'}`
                    : 'Quản trị'}
                </span>
              </div>
            </button>

            {/* Isolated Role Indicator Badge */}
            <div
              className={`hidden sm:flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl border text-xs font-bold shadow-2xs select-none ${
                userRole === 'admin'
                  ? 'bg-rose-50 border-rose-200 text-rose-700'
                  : userRole === 'teacher'
                  ? 'bg-purple-50 border-purple-200 text-purple-700'
                  : 'bg-emerald-50 border-emerald-200 text-emerald-700'
              }`}
            >
              {userRole === 'admin' ? (
                <ShieldAlert size={15} className="text-rose-600 shrink-0" />
              ) : userRole === 'teacher' ? (
                <GraduationCap size={15} className="text-purple-600 shrink-0" />
              ) : (
                <BookOpen size={15} className="text-emerald-600 shrink-0" />
              )}
              <span className="whitespace-nowrap hidden md:inline">
                {userRole === 'admin'
                  ? 'Quản Trị Viên'
                  : userRole === 'teacher'
                  ? `GV ${teacherSubject || 'Toán Học'}`
                  : 'Học Sinh'}
              </span>
            </div>

            {/* ========================================================= */}
            {/* MOBILE HAMBURGER BUTTON (HIỂN THỊ RÕ RÀNG TRÊN ĐIỆN THOẠI) */}
            {/* ========================================================= */}
            <button
              type="button"
              onClick={() => setShowMobileMenu(!showMobileMenu)}
              className={`md:hidden p-2 rounded-xl transition-all border flex items-center justify-center cursor-pointer ${
                showMobileMenu
                  ? 'bg-blue-600 text-white border-blue-600 shadow-md'
                  : 'bg-slate-50 text-slate-800 hover:bg-slate-100 border-slate-300'
              }`}
              aria-label="Mở thực đơn chức năng điện thoại"
            >
              {showMobileMenu ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>

        {/* ========================================================= */}
        {/* MOBILE MENU DRAWER OVERLAY (MENU ĐẦY ĐỦ CHO ĐIỆN THOẠI)    */}
        {/* ========================================================= */}
        {showMobileMenu && (
          <div className="md:hidden border-t border-slate-200 bg-white/98 backdrop-blur-xl animate-in slide-in-from-top-3 duration-200 shadow-2xl max-h-[calc(100dvh-4rem)] overflow-y-auto">
            <div className="max-w-lg mx-auto px-4 py-5 space-y-4">
              {/* User Identity Card on Mobile */}
              <div className="p-3.5 rounded-2xl bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-xl overflow-hidden bg-white border border-blue-200 shrink-0 shadow-xs">
                    {userAvatar ? (
                      <img src={userAvatar} alt={userName} className="w-full h-full object-cover" />
                    ) : (
                      <User size={22} className="text-blue-600 m-auto mt-2.5" />
                    )}
                  </div>
                  <div className="flex flex-col">
                    <span className="font-extrabold text-sm text-slate-900 leading-tight">
                      {userName}
                    </span>
                    <span className="text-[11px] text-blue-700 font-semibold mt-0.5">
                      {userRole === 'student'
                        ? 'Học Sinh THPT'
                        : userRole === 'teacher'
                        ? `Giáo Viên ${teacherSubject || 'Toán Học'} THPT`
                        : 'Quản Trị Viên'}
                    </span>
                  </div>
                </div>

                <div className="flex flex-col items-end gap-1">
                  <span className="text-[10px] text-slate-500 font-mono font-bold">
                    {xp} XP
                  </span>
                </div>
              </div>


              {/* Title Section */}
              <div className="text-[11px] font-black uppercase tracking-wider text-slate-400 px-1">
                Tất Cả Chức Năng Hệ Thống
              </div>

              {/* Navigation Links for Mobile */}
              <div className="grid grid-cols-1 gap-1.5">
                {userRole === 'student' && (
                  <>
                    <button
                      onClick={() => handleMobileTabSelect('classroom')}
                      className={`w-full p-3 rounded-2xl flex items-center justify-between text-left transition-all ${
                        currentTab === 'classroom'
                          ? 'bg-blue-600 text-white font-bold shadow-md shadow-blue-500/20'
                          : 'bg-slate-50 hover:bg-slate-100 text-slate-800 border border-slate-200'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`relative w-9 h-9 rounded-xl flex items-center justify-center ${
                          currentTab === 'classroom' ? 'bg-white/20 text-white' : 'bg-indigo-100 text-indigo-600'
                        }`}>
                          <Users size={18} />
                          {unreadClassroomMessagesCount > 0 && (
                            <span className="absolute -top-1 -right-1 bg-rose-500 text-white text-[9px] font-black px-1 rounded-full min-w-[15px] h-4 flex items-center justify-center shadow-xs">
                              {unreadClassroomMessagesCount > 99 ? '99+' : unreadClassroomMessagesCount}
                            </span>
                          )}
                        </div>
                        <div>
                          <div className="text-xs font-extrabold flex items-center gap-2">
                            <span>Nhóm Lớp Trực Tuyến</span>
                            {unreadClassroomMessagesCount > 0 && (
                              <span className="bg-rose-500 text-white text-[9px] px-1.5 py-0.2 rounded-full font-bold">
                                {unreadClassroomMessagesCount} mới
                              </span>
                            )}
                          </div>
                          <div className={`text-[10px] ${currentTab === 'classroom' ? 'text-blue-100' : 'text-slate-400'}`}>
                            Trao đổi bài tập, lớp học trực tuyến & bài giảng
                          </div>
                        </div>
                      </div>
                      <ChevronRight size={16} className="opacity-60" />
                    </button>

                    <button
                      onClick={() => handleMobileTabSelect('student_history')}
                      className={`w-full p-3 rounded-2xl flex items-center justify-between text-left transition-all ${
                        currentTab === 'student_history'
                          ? 'bg-blue-600 text-white font-bold shadow-md shadow-blue-500/20'
                          : 'bg-slate-50 hover:bg-slate-100 text-slate-800 border border-slate-200'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                          currentTab === 'student_history' ? 'bg-white/20 text-white' : 'bg-emerald-100 text-emerald-600'
                        }`}>
                          <FileCheck size={18} />
                        </div>
                        <div>
                          <div className="text-xs font-extrabold">Bài Đã Làm & Lịch Sử Thi</div>
                          <div className={`text-[10px] ${currentTab === 'student_history' ? 'text-blue-100' : 'text-slate-400'}`}>
                            Xem lại kết quả, bài nộp, làm lại đề thi
                          </div>
                        </div>
                      </div>
                      <ChevronRight size={16} className="opacity-60" />
                    </button>

                    <button
                      onClick={() => handleMobileTabSelect('geometry')}
                      className={`w-full p-3 rounded-2xl flex items-center justify-between text-left transition-all ${
                        currentTab === 'geometry'
                          ? 'bg-blue-600 text-white font-bold shadow-md shadow-blue-500/20'
                          : 'bg-slate-50 hover:bg-slate-100 text-slate-800 border border-slate-200'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                          currentTab === 'geometry' ? 'bg-white/20 text-white' : 'bg-cyan-100 text-cyan-600'
                        }`}>
                          <Compass size={18} />
                        </div>
                        <div>
                          <div className="text-xs font-extrabold">Phòng Vẽ Hình 2D / 3D</div>
                          <div className={`text-[10px] ${currentTab === 'geometry' ? 'text-blue-100' : 'text-slate-400'}`}>
                            Vẽ hình học không gian, trục tọa độ Oxyz &amp; xuất ảnh
                          </div>
                        </div>
                      </div>
                      <ChevronRight size={16} className="opacity-60" />
                    </button>

                    <button
                      onClick={() => handleMobileTabSelect('physics_sim')}
                      className={`w-full p-3 rounded-2xl flex items-center justify-between text-left transition-all ${
                        currentTab === 'physics_sim'
                          ? 'bg-sky-600 text-white font-bold shadow-md shadow-sky-500/20'
                          : 'bg-slate-50 hover:bg-slate-100 text-slate-800 border border-slate-200'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                          currentTab === 'physics_sim' ? 'bg-white/20 text-white' : 'bg-sky-100 text-sky-600'
                        }`}>
                          <Atom size={18} />
                        </div>
                        <div>
                          <div className="text-xs font-extrabold">Mô Phỏng (Vật Lý)</div>
                          <div className={`text-[10px] ${currentTab === 'physics_sim' ? 'text-sky-100' : 'text-slate-400'}`}>
                            Dao động, ném xiên, giao thoa sóng &amp; mạch điện RLC
                          </div>
                        </div>
                      </div>
                      <ChevronRight size={16} className="opacity-60" />
                    </button>

                    <button
                      onClick={() => handleMobileTabSelect('chemistry_lab')}
                      className={`w-full p-3 rounded-2xl flex items-center justify-between text-left transition-all ${
                        currentTab === 'chemistry_lab'
                          ? 'bg-emerald-600 text-white font-bold shadow-md shadow-emerald-500/20'
                          : 'bg-slate-50 hover:bg-slate-100 text-slate-800 border border-slate-200'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                          currentTab === 'chemistry_lab' ? 'bg-white/20 text-white' : 'bg-emerald-100 text-emerald-600'
                        }`}>
                          <FlaskConical size={18} />
                        </div>
                        <div>
                          <div className="text-xs font-extrabold">Thí Nghiệm (Hóa Học)</div>
                          <div className={`text-[10px] ${currentTab === 'chemistry_lab' ? 'text-emerald-100' : 'text-slate-400'}`}>
                            Chuẩn độ pH, kim loại + acid, kết tủa &amp; cân bằng hóa học
                          </div>
                        </div>
                      </div>
                      <ChevronRight size={16} className="opacity-60" />
                    </button>

                    <button
                      onClick={() => handleMobileTabSelect('profile')}
                      className={`w-full p-3 rounded-2xl flex items-center justify-between text-left transition-all ${
                        currentTab === 'profile'
                          ? 'bg-blue-600 text-white font-bold shadow-md shadow-blue-500/20'
                          : 'bg-slate-50 hover:bg-slate-100 text-slate-800 border border-slate-200'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                          currentTab === 'profile' ? 'bg-white/20 text-white' : 'bg-purple-100 text-purple-600'
                        }`}>
                          <User size={18} />
                        </div>
                        <div>
                          <div className="text-xs font-extrabold">Hồ Sơ Học Sinh</div>
                          <div className={`text-[10px] ${currentTab === 'profile' ? 'text-blue-100' : 'text-slate-400'}`}>
                            Thông tin cá nhân, trường học & đổi mật khẩu
                          </div>
                        </div>
                      </div>
                      <ChevronRight size={16} className="opacity-60" />
                    </button>
                  </>
                )}

                {userRole === 'teacher' && (
                  <>
                    <button
                      onClick={() => handleMobileTabSelect('classroom')}
                      className={`w-full p-3 rounded-2xl flex items-center justify-between text-left transition-all ${
                        currentTab === 'classroom'
                          ? 'bg-blue-600 text-white font-bold shadow-md'
                          : 'bg-slate-50 hover:bg-slate-100 text-slate-800 border border-slate-200'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-indigo-100 text-indigo-600 flex items-center justify-center">
                          <Users size={18} />
                        </div>
                        <div>
                          <div className="text-xs font-extrabold">Quản Lý Nhóm Lớp</div>
                          <div className="text-[10px] text-slate-400">Danh sách học sinh, bài giảng, nhóm lớp</div>
                        </div>
                      </div>
                      <ChevronRight size={16} className="opacity-60" />
                    </button>

                    <button
                      onClick={() => handleMobileTabSelect('teacher_gradebook')}
                      className={`w-full p-3 rounded-2xl flex items-center justify-between text-left transition-all ${
                        currentTab === 'teacher_gradebook'
                          ? 'bg-blue-600 text-white font-bold shadow-md'
                          : 'bg-slate-50 hover:bg-slate-100 text-slate-800 border border-slate-200'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center">
                          <BarChart3 size={18} />
                        </div>
                        <div>
                          <div className="text-xs font-extrabold">Tổng Hợp Điểm Thi</div>
                          <div className="text-[10px] text-slate-400">Bảng điểm thi, xếp loại & phân tích phổ điểm</div>
                        </div>
                      </div>
                      <ChevronRight size={16} className="opacity-60" />
                    </button>

                    <button
                      onClick={() => handleMobileTabSelect('exam_repository')}
                      className={`w-full p-3 rounded-2xl flex items-center justify-between text-left transition-all ${
                        currentTab === 'exam_repository'
                          ? 'bg-blue-600 text-white font-bold shadow-md shadow-blue-500/20'
                          : 'bg-slate-50 hover:bg-slate-100 text-slate-800 border border-slate-200'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center">
                          <Layers size={18} />
                        </div>
                        <div>
                          <div className="text-xs font-extrabold">Kho Đề Thi & Giao Đề</div>
                          <div className="text-[10px] text-slate-400">Danh sách đề đã tạo & giao cho các nhóm lớp</div>
                        </div>
                      </div>
                      <ChevronRight size={16} className="opacity-60" />
                    </button>

                    <button
                      onClick={() => handleMobileTabSelect('teacher_portal')}
                      className={`w-full p-3 rounded-2xl flex items-center justify-between text-left transition-all ${
                        currentTab === 'teacher_portal'
                          ? 'bg-blue-600 text-white font-bold shadow-md'
                          : 'bg-slate-50 hover:bg-slate-100 text-slate-800 border border-slate-200'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center">
                          <FileText size={18} />
                        </div>
                        <div>
                          <div className="text-xs font-extrabold">Tạo Đề Thi & Tải PDF / Word</div>
                          <div className="text-[10px] text-slate-400">Tạo đề thi 4 phần chuẩn Bộ GD&ĐT</div>
                        </div>
                      </div>
                      <ChevronRight size={16} className="opacity-60" />
                    </button>

                    {canAccessSubjectTab('geometry', userRole, userSubject) && (
                      <button
                        onClick={() => handleMobileTabSelect('geometry')}
                        className={`w-full p-3 rounded-2xl flex items-center justify-between text-left transition-all ${
                          currentTab === 'geometry'
                            ? 'bg-blue-600 text-white font-bold shadow-md'
                            : 'bg-slate-50 hover:bg-slate-100 text-slate-800 border border-slate-200'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-cyan-100 text-cyan-600 flex items-center justify-center">
                            <Compass size={18} />
                          </div>
                          <div>
                            <div className="text-xs font-extrabold">Vẽ Hình 2D / 3D</div>
                            <div className="text-[10px] text-slate-400">Vẽ hình học không gian, trục Oxyz</div>
                          </div>
                        </div>
                        <ChevronRight size={16} className="opacity-60" />
                      </button>
                    )}

                    {canAccessSubjectTab('physics_sim', userRole, userSubject) && (
                      <button
                        onClick={() => handleMobileTabSelect('physics_sim')}
                        className={`w-full p-3 rounded-2xl flex items-center justify-between text-left transition-all ${
                          currentTab === 'physics_sim'
                            ? 'bg-sky-600 text-white font-bold shadow-md'
                            : 'bg-slate-50 hover:bg-slate-100 text-slate-800 border border-slate-200'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-sky-100 text-sky-600 flex items-center justify-center">
                            <Atom size={18} />
                          </div>
                          <div>
                            <div className="text-xs font-extrabold">Mô Phỏng (Vật Lý)</div>
                            <div className="text-[10px] text-slate-400">Dao động, ném xiên, giao thoa &amp; mạch RLC</div>
                          </div>
                        </div>
                        <ChevronRight size={16} className="opacity-60" />
                      </button>
                    )}

                    {canAccessSubjectTab('chemistry_lab', userRole, userSubject) && (
                      <button
                        onClick={() => handleMobileTabSelect('chemistry_lab')}
                        className={`w-full p-3 rounded-2xl flex items-center justify-between text-left transition-all ${
                          currentTab === 'chemistry_lab'
                            ? 'bg-emerald-600 text-white font-bold shadow-md'
                            : 'bg-slate-50 hover:bg-slate-100 text-slate-800 border border-slate-200'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center">
                            <FlaskConical size={18} />
                          </div>
                          <div>
                            <div className="text-xs font-extrabold">Thí Nghiệm (Hóa Học)</div>
                            <div className="text-[10px] text-slate-400">Chuẩn độ pH, kim loại + acid, kết tủa &amp; cân bằng</div>
                          </div>
                        </div>
                        <ChevronRight size={16} className="opacity-60" />
                      </button>
                    )}

                    <button
                      onClick={() => handleMobileTabSelect('profile')}
                      className={`w-full p-3 rounded-2xl flex items-center justify-between text-left transition-all ${
                        currentTab === 'profile'
                          ? 'bg-blue-600 text-white font-bold shadow-md'
                          : 'bg-slate-50 hover:bg-slate-100 text-slate-800 border border-slate-200'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-purple-100 text-purple-600 flex items-center justify-center">
                          <User size={18} />
                        </div>
                        <div>
                          <div className="text-xs font-extrabold">Hồ Sơ Giáo Viên</div>
                          <div className="text-[10px] text-slate-400">Thông tin giáo viên & đổi mật khẩu</div>
                        </div>
                      </div>
                      <ChevronRight size={16} className="opacity-60" />
                    </button>
                  </>
                )}

                {userRole === 'admin' && (
                  <>
                    <button
                      onClick={() => handleMobileTabSelect('admin_dashboard')}
                      className={`w-full p-3 rounded-2xl flex items-center justify-between text-left transition-all ${
                        currentTab === 'admin_dashboard'
                          ? 'bg-blue-600 text-white font-bold shadow-md'
                          : 'bg-slate-50 hover:bg-slate-100 text-slate-800 border border-slate-200'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center">
                          <ShieldAlert size={18} />
                        </div>
                        <div>
                          <div className="text-xs font-extrabold">Trung Tâm Quản Trị Hệ Thống</div>
                          <div className="text-[10px] text-slate-400">Phê duyệt và quản lý người dùng hệ thống</div>
                        </div>
                      </div>
                      <ChevronRight size={16} className="opacity-60" />
                    </button>

                    <button
                      onClick={() => handleMobileTabSelect('profile')}
                      className={`w-full p-3 rounded-2xl flex items-center justify-between text-left transition-all ${
                        currentTab === 'profile'
                          ? 'bg-blue-600 text-white font-bold shadow-md'
                          : 'bg-slate-50 hover:bg-slate-100 text-slate-800 border border-slate-200'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-purple-100 text-purple-600 flex items-center justify-center">
                          <User size={18} />
                        </div>
                        <div>
                          <div className="text-xs font-extrabold">Hồ Sơ Quản Trị Viên</div>
                          <div className="text-[10px] text-slate-400">Thông tin bảo mật Admin & đổi mật khẩu</div>
                        </div>
                      </div>
                      <ChevronRight size={16} className="opacity-60" />
                    </button>
                  </>
                )}
              </div>

              {/* Logout Button in Mobile Menu */}
              {onLogout && (
                <div className="pt-2 border-t border-slate-100">
                  <button
                    onClick={() => {
                      setShowMobileMenu(false);
                      onLogout();
                    }}
                    className="w-full py-3 rounded-2xl bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 font-extrabold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer"
                  >
                    <LogOut size={16} />
                    <span>Đăng Xuất Tài Khoản</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </header>
    </>
  );
};
