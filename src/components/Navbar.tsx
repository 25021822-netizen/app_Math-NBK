import React, { useState } from 'react';
import { UserRole, AccountTier } from '../types/math';
import { PushNotificationItem } from '../utils/notificationService';
import {
  BookOpen,
  Flame,
  Zap,
  Smartphone,
  Monitor,
  Tablet,
  Sparkles,
  UserCheck,
  Users,
  Compass,
  User,
  Bell,
  LogOut,
  Check,
  CheckCircle2,
  FileCheck,
  ShieldAlert,
  GraduationCap,
} from 'lucide-react';

interface NavbarProps {
  currentTab: string;
  onSelectTab: (tab: string) => void;
  userRole: UserRole;
  onSelectRole?: (role: UserRole) => void;
  tier: AccountTier;
  onToggleTier: () => void;
  streakDays: number;
  xp: number;
  deviceMode: 'desktop' | 'tablet' | 'mobile';
  onSelectDeviceMode: (mode: 'desktop' | 'tablet' | 'mobile') => void;
  onOpenFriendsModal?: () => void;
  friendsCount?: number;
  pendingRequestsCount?: number;
  userName?: string;
  userAvatar?: string;
  onLogout?: () => void;
  notifications?: PushNotificationItem[];
  onClearNotifications?: () => void;
  onRequestPushPermission?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentTab,
  onSelectTab,
  userRole,
  onSelectRole,
  tier,
  onToggleTier,
  streakDays,
  xp,
  deviceMode,
  onSelectDeviceMode,
  onOpenFriendsModal,
  friendsCount = 0,
  pendingRequestsCount = 0,
  userName = 'Người Dùng',
  userAvatar,
  onLogout,
  notifications = [],
  onClearNotifications,
  onRequestPushPermission,
}) => {
  const [showNotifDropdown, setShowNotifDropdown] = useState<boolean>(false);
  const unreadCount = notifications.filter((n) => !n.isRead).length;
  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200">
      {/* Top Bar Contract: 3 zones separated by gap-8 */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-8">
        {/* Zone 1: Brand Wordmark (Single text element) */}
        <div className="flex items-center gap-3 shrink-0">
          <a
            href="#"
            onClick={(e) => {
              e.preventDefault();
              if (userRole === 'teacher') onSelectTab('classroom');
              else if (userRole === 'admin') onSelectTab('admin_dashboard');
              else onSelectTab('ask_ai');
            }}
            className="flex items-center gap-2.5 group"
          >
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-700 to-indigo-600 flex items-center justify-center text-white shadow-xs group-hover:scale-105 transition-transform">
              <BookOpen size={22} className="stroke-[2.5]" />
            </div>
            <div className="flex flex-col">
              <span className="text-xl font-extrabold tracking-tight text-slate-900 leading-none">
                Math<span className="text-blue-600">&</span>NBK
              </span>
              <span className="text-[10px] text-slate-400 font-medium tracking-wide">
                Toán THPT Thế Hệ Mới
              </span>
            </div>
          </a>
        </div>

        {/* Zone 2: Navigation Links (Single-line, whitespace-nowrap) */}
        <nav className="hidden md:flex items-center gap-4 lg:gap-5 text-sm font-medium text-slate-600">
          {userRole === 'student' && (
            <>
              <button
                onClick={() => onSelectTab('ask_ai')}
                className={`whitespace-nowrap transition-colors py-1 flex items-center gap-1.5 ${
                  currentTab === 'ask_ai' || currentTab === 'scanner' || currentTab === 'tutor'
                    ? 'text-blue-600 font-bold border-b-2 border-blue-600'
                    : 'hover:text-slate-900'
                }`}
              >
                <Sparkles size={15} className="text-blue-600" />
                <span>Hỏi AI</span>
              </button>
              <button
                onClick={() => onSelectTab('classroom')}
                className={`whitespace-nowrap transition-colors py-1 ${
                  currentTab === 'classroom'
                    ? 'text-blue-600 font-bold border-b-2 border-blue-600'
                    : 'hover:text-slate-900'
                }`}
              >
                Nhóm Lớp
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
                Quản Lý Nhóm Lớp
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
                onClick={() => onSelectTab('teacher_portal')}
                className={`whitespace-nowrap transition-colors py-1 ${
                  currentTab === 'teacher_portal'
                    ? 'text-blue-600 font-bold border-b-2 border-blue-600'
                    : 'hover:text-slate-900'
                }`}
              >
                Tạo Đề Thi & Tải PDF
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
                onClick={() => onSelectTab('ask_ai')}
                className={`whitespace-nowrap transition-colors py-1 flex items-center gap-1 ${
                  currentTab === 'ask_ai' || currentTab === 'scanner' || currentTab === 'tutor'
                    ? 'text-blue-600 font-bold border-b-2 border-blue-600'
                    : 'hover:text-slate-900'
                }`}
              >
                <Sparkles size={14} className="text-blue-600" />
                <span>Hỏi AI</span>
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
                Trung Tâm Quản Trị & Token AI
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

        {/* Zone 3: 1 Primary Action & Context Controls */}
        <div className="flex items-center gap-3 shrink-0">
          {/* Device viewport frame switcher */}
          <div className="hidden sm:flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
            <button
              onClick={() => onSelectDeviceMode('desktop')}
              title="Giao diện Màn hình rộng"
              className={`p-1.5 rounded-lg text-xs transition-colors ${
                deviceMode === 'desktop' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              <Monitor size={15} />
            </button>
            <button
              onClick={() => onSelectDeviceMode('tablet')}
              title="Khung Tablet (iPad)"
              className={`p-1.5 rounded-lg text-xs transition-colors ${
                deviceMode === 'tablet' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              <Tablet size={15} />
            </button>
            <button
              onClick={() => onSelectDeviceMode('mobile')}
              title="Khung Smartphone (iPhone)"
              className={`p-1.5 rounded-lg text-xs transition-colors ${
                deviceMode === 'mobile' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              <Smartphone size={15} />
            </button>
          </div>

          {/* Friends Network Button (GV-GV, HS-HS, GV-HS) */}
          {onOpenFriendsModal && (
            <button
              onClick={onOpenFriendsModal}
              title="Mạng lưới kết bạn qua ID (GV-GV, HS-HS, GV-HS)"
              className="relative px-3 py-1.5 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 text-xs font-bold flex items-center gap-1.5 transition-colors whitespace-nowrap shadow-xs"
            >
              <UserCheck size={15} />
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
              title="Thông báo hệ thống & bài thi mới"
              className="relative p-2 rounded-xl text-slate-600 hover:text-blue-600 hover:bg-blue-50 border border-slate-200 transition-colors"
            >
              <Bell size={18} />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-rose-600 text-white font-mono font-bold text-[10px] flex items-center justify-center animate-pulse shadow-xs">
                  {unreadCount}
                </span>
              )}
            </button>

            {/* Notification Dropdown Panel */}
            {showNotifDropdown && (
              <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-3xl border border-slate-200 shadow-2xl p-4 z-50 animate-in fade-in space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <Bell size={16} className="text-blue-600" />
                    <span className="font-extrabold text-xs text-slate-900">Thông Báo Đẩy ({notifications.length})</span>
                  </div>
                  {notifications.length > 0 && onClearNotifications && (
                    <button
                      onClick={onClearNotifications}
                      className="text-[10px] text-slate-400 hover:text-rose-600 font-bold transition-colors"
                    >
                      Xóa tất cả
                    </button>
                  )}
                </div>

                {/* Browser Push Permission Request Button */}
                {onRequestPushPermission && (
                  <div className="p-2.5 rounded-2xl bg-blue-50/70 border border-blue-200 flex items-center justify-between gap-2 text-xs">
                    <span className="text-[11px] font-semibold text-blue-900">Nhận thông báo khi giáo viên đăng bài thi mới?</span>
                    <button
                      onClick={() => {
                        onRequestPushPermission();
                        setShowNotifDropdown(false);
                      }}
                      className="px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-[10px] shrink-0 shadow-xs"
                    >
                      Bật Thông Báo
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
            className="flex items-center gap-2 p-1.5 pr-3 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 transition-colors cursor-pointer"
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
                {userRole === 'student' ? 'Học sinh' : userRole === 'teacher' ? 'Giáo viên' : 'Quản trị'}
              </span>
            </div>
          </button>

          {/* Isolated Role Indicator Badge (Không cho phép chuyển vai trò tự do, mỗi tài khoản tách biệt hoàn toàn) */}
          <div
            className={`hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold shadow-2xs select-none ${
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
            <span className="whitespace-nowrap">
              {userRole === 'admin' ? 'Quản Trị Viên' : userRole === 'teacher' ? 'Giáo Viên' : 'Học Sinh'}
            </span>
          </div>

          {/* Tier Badge / Upgrade Button */}
          <button
            onClick={onToggleTier}
            className={`px-3 py-1.5 text-xs font-bold rounded-xl flex items-center gap-1.5 transition-all whitespace-nowrap ${
              tier === 'premium'
                ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-xs'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-300'
            }`}
          >
            <Sparkles size={14} />
            <span className="hidden sm:inline">{tier === 'premium' ? 'Gói Pro' : 'Nâng cấp Pro'}</span>
          </button>

          {/* Logout Button */}
          {onLogout && (
            <button
              onClick={onLogout}
              title="Đăng xuất khỏi tài khoản để quay lại giao diện đăng nhập"
              className="p-2 rounded-xl text-rose-600 hover:text-white hover:bg-rose-600 border border-rose-200 hover:border-rose-600 transition-all shadow-xs flex items-center gap-1 text-xs font-bold"
            >
              <LogOut size={16} />
              <span className="hidden xl:inline">Đăng Xuất</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
