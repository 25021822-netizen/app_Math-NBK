import React, { useState, useMemo, useEffect } from 'react';
import { UserProfile, CheatLog, UserRole, AccountTier, AutoApprovalSettings } from '../../types/math';
import {
  Users,
  ShieldAlert,
  Cpu,
  Database,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Sparkles,
  Zap,
  Search,
  UserPlus,
  X,
  Check,
  ShieldCheck,
  GraduationCap,
  Award,
  Filter,
  Eye,
  EyeOff,
  Key,
  Lock,
  Copy,
  RefreshCw,
  Edit3,
  Trash2,
  ToggleLeft,
  ToggleRight,
  SlidersHorizontal,
  CheckCheck,
  UserCheck,
} from 'lucide-react';

interface AdminDashboardViewProps {
  cheatLogs: CheatLog[];
  users?: UserProfile[];
  onCreateUser?: (newUser: UserProfile) => void;
  onToggleUserTier?: (userId: string) => void;
  onUpdateUser?: (updatedUser: UserProfile) => void;
  onDeleteUser?: (userId: string) => void;
  onApproveUser?: (userId: string) => void;
  onRejectUser?: (userId: string, reason?: string) => void;
  autoApprovalSettings?: AutoApprovalSettings;
  onUpdateAutoApprovalSettings?: (settings: AutoApprovalSettings) => void;
  onApproveAllUsers?: (targetRole?: 'all' | 'student' | 'teacher', tier?: AccountTier) => void;
}

export const AdminDashboardView: React.FC<AdminDashboardViewProps> = ({
  cheatLogs,
  users: propUsers,
  onCreateUser,
  onToggleUserTier,
  onUpdateUser,
  onDeleteUser,
  onApproveUser,
  onRejectUser,
  autoApprovalSettings: propAutoApprovalSettings,
  onUpdateAutoApprovalSettings,
  onApproveAllUsers,
}) => {
  const [activeTab, setActiveTab] = useState<'tokens' | 'users' | 'pending_requests' | 'cheat_logs'>('users');
  const [approvalMessage, setApprovalMessage] = useState<string | null>(null);
  const [isBulkApproving, setIsBulkApproving] = useState(false);

  // Auto-Approval Configuration State
  const [autoApproval, setAutoApproval] = useState<AutoApprovalSettings>(
    propAutoApprovalSettings || {
      enabled: true,
      autoApproveStudents: true,
      autoApproveTeachers: true,
      defaultTier: 'free',
      notifyAdminOnAutoApproval: true,
    }
  );

  useEffect(() => {
    if (propAutoApprovalSettings) {
      setAutoApproval(propAutoApprovalSettings);
    }
  }, [propAutoApprovalSettings]);

  const handleToggleAutoApproval = (key: keyof AutoApprovalSettings, value?: any) => {
    const updated: AutoApprovalSettings = {
      ...autoApproval,
      [key]: value !== undefined ? value : !autoApproval[key],
    };
    setAutoApproval(updated);
    if (onUpdateAutoApprovalSettings) {
      onUpdateAutoApprovalSettings(updated);
    }
    setApprovalMessage(
      key === 'enabled'
        ? `Đã ${updated.enabled ? 'BẬT' : 'TẮT'} chế độ Duyệt Tự Động của Admin!`
        : 'Đã cập nhật cấu hình duyệt tự động!'
    );
    setTimeout(() => setApprovalMessage(null), 3500);
  };

  // Internal user state if not provided via props (Duy nhất 1 tài khoản Admin có sẵn)
  const [internalUsers, setInternalUsers] = useState<UserProfile[]>([]);

  const usersList = propUsers || internalUsers;
  const pendingUsers = usersList.filter((u) => u.status === 'pending_approval');
  const pendingCount = pendingUsers.length;

  const handleApprove = (userId: string) => {
    if (onApproveUser) {
      onApproveUser(userId);
    } else {
      setInternalUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, status: 'active' } : u))
      );
    }
    const target = usersList.find((u) => u.id === userId);
    setApprovalMessage(`Đã phê duyệt và kích hoạt tài khoản "${target ? target.name : userId}" thành công!`);
    setTimeout(() => setApprovalMessage(null), 3500);
  };

  const handleReject = (userId: string) => {
    if (onRejectUser) {
      onRejectUser(userId);
    } else {
      setInternalUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, status: 'rejected' } : u))
      );
    }
    const target = usersList.find((u) => u.id === userId);
    setApprovalMessage(`Đã từ chối yêu cầu đăng ký của "${target ? target.name : userId}".`);
    setTimeout(() => setApprovalMessage(null), 3500);
  };

  const handleBulkApprove = async () => {
    if (pendingCount === 0) return;
    setIsBulkApproving(true);
    try {
      if (onApproveAllUsers) {
        await onApproveAllUsers('all', autoApproval.defaultTier || 'free');
      } else {
        setInternalUsers((prev) =>
          prev.map((u) =>
            u.status === 'pending_approval'
              ? { ...u, status: 'active', tier: autoApproval.defaultTier || 'free' }
              : u
          )
        );
      }
      setApprovalMessage(`⚡ Đã tự động phê duyệt và kích hoạt thành công tất cả ${pendingCount} tài khoản!`);
      setTimeout(() => setApprovalMessage(null), 4000);
    } catch (err) {
      console.error(err);
    } finally {
      setIsBulkApproving(false);
    }
  };

  // Search & Filter state in User Management
  const [userRoleFilter, setUserRoleFilter] = useState<'all' | 'teacher' | 'student'>('all');
  const [userSearchTerm, setUserSearchTerm] = useState('');

  // ==========================================
  // ==========================================
  // STATE CẤP TÀI KHOẢN MỚI & MẬT KHẨU (CHỈ ADMIN MỚI CÓ QUYỀN)
  // ==========================================
  const [showCreateUserModal, setShowCreateUserModal] = useState<boolean>(false);
  const [newUserName, setNewUserName] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserRole, setNewUserRole] = useState<'teacher' | 'student'>('student');
  const [newUserGrade, setNewUserGrade] = useState<10 | 11 | 12>(12);
  const [newUserTier, setNewUserTier] = useState<AccountTier>('free');
  const [newUserPassword, setNewUserPassword] = useState('MatKhau@123');
  const [showCreatePassword, setShowCreatePassword] = useState(false);
  const [createUserError, setCreateUserError] = useState<string | null>(null);
  const [createUserSuccess, setCreateUserSuccess] = useState<string | null>(null);

  // Quản lý hiển thị và chỉnh sửa mật khẩu trong bảng tài khoản
  const [revealedPasswordUserIds, setRevealedPasswordUserIds] = useState<string[]>([]);
  const [copiedPasswordUserId, setCopiedPasswordUserId] = useState<string | null>(null);
  const [editingPasswordUser, setEditingPasswordUser] = useState<UserProfile | null>(null);
  const [editNewPassword, setEditNewPassword] = useState('');
  const [showEditNewPassword, setShowEditNewPassword] = useState(false);
  const [editPasswordError, setEditPasswordError] = useState<string | null>(null);
  const [editPasswordSuccess, setEditPasswordSuccess] = useState<string | null>(null);

  // Xóa tài khoản người dùng (Admin quyền cao nhất)
  const [userToDelete, setUserToDelete] = useState<UserProfile | null>(null);
  const [deleteUserSuccess, setDeleteUserSuccess] = useState<string | null>(null);

  const handleConfirmDeleteUser = () => {
    if (!userToDelete) return;
    const deletedName = userToDelete.name;
    const deletedId = userToDelete.id;

    if (onDeleteUser) {
      onDeleteUser(deletedId);
    } else {
      setInternalUsers((prev) => prev.filter((u) => u.id !== deletedId));
    }

    setDeleteUserSuccess(`Đã xóa tài khoản "${deletedName}" (${deletedId}) thành công!`);
    setUserToDelete(null);
    setTimeout(() => setDeleteUserSuccess(null), 3500);
  };

  // Sinh mật khẩu ngẫu nhiên tối thiểu 8 ký tự bất kỳ
  const generateRandomPassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%^&*';
    let res = '';
    for (let i = 0; i < 10; i++) {
      res += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return res;
  };

  const toggleRevealPassword = (userId: string) => {
    setRevealedPasswordUserIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  const handleCopyPassword = (userId: string, password?: string) => {
    if (!password) return;
    navigator.clipboard.writeText(password);
    setCopiedPasswordUserId(userId);
    setTimeout(() => setCopiedPasswordUserId(null), 2000);
  };

  const handleOpenEditPassword = (u: UserProfile) => {
    setEditingPasswordUser(u);
    setEditNewPassword(u.password || generateRandomPassword());
    setShowEditNewPassword(false);
    setEditPasswordError(null);
    setEditPasswordSuccess(null);
  };

  const handleSaveEditPassword = (e: React.FormEvent) => {
    e.preventDefault();
    setEditPasswordError(null);
    if (!editNewPassword || editNewPassword.trim().length < 8) {
      setEditPasswordError('Mật khẩu tối thiểu 8 ký tự bất kỳ!');
      return;
    }
    if (!editingPasswordUser) return;
    const updated = {
      ...editingPasswordUser,
      password: editNewPassword.trim(),
    };
    if (onUpdateUser) {
      onUpdateUser(updated);
    } else {
      setInternalUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
    }
    setEditPasswordSuccess(`Đã cập nhật mật khẩu cho "${editingPasswordUser.name}" thành công!`);
    setTimeout(() => {
      setEditingPasswordUser(null);
      setEditPasswordSuccess(null);
    }, 1800);
  };

  // Lọc duy nhất theo id để tránh lỗi duplicate key cl_101, cl_102, cl_103
  const allLogs = useMemo(() => {
    const map = new Map<string, CheatLog>();
    (cheatLogs || []).forEach((log) => {
      if (log && log.id) {
        map.set(log.id, log);
      }
    });
    return Array.from(map.values());
  }, [cheatLogs]);

  const toggleTier = (userId: string) => {
    if (onToggleUserTier) {
      onToggleUserTier(userId);
    } else {
      setInternalUsers((prev) =>
        prev.map((u) => {
          if (u.id === userId) {
            const nextTier = u.tier === 'free' ? 'premium' : 'free';
            return {
              ...u,
              tier: nextTier,
              maxDailyScans: nextTier === 'premium' ? 9999 : 10,
            };
          }
          return u;
        })
      );
    }
  };

  // Tự động sinh ID nội bộ duy nhất theo vai trò
  const generateRecommendedId = (role: 'teacher' | 'student') => {
    const prefix = role === 'teacher' ? 'usr_teacher' : 'usr_student';
    return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  };

  const handleOpenCreateModal = () => {
    setNewUserName('');
    setNewUserEmail('');
    setNewUserRole('student');
    setNewUserGrade(12);
    setNewUserTier('free');
    setNewUserPassword(generateRandomPassword());
    setShowCreatePassword(false);
    setCreateUserError(null);
    setCreateUserSuccess(null);
    setShowCreateUserModal(true);
  };

  // Submit tạo tài khoản mới (Admin Only)
  const handleCreateUserSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setCreateUserError(null);

    if (!newUserName.trim()) {
      setCreateUserError('Vui lòng nhập họ và tên!');
      return;
    }

    if (!newUserPassword || newUserPassword.trim().length < 8) {
      setCreateUserError('Mật khẩu bắt buộc có tối thiểu 8 ký tự bất kỳ!');
      return;
    }

    let trimmedId = generateRecommendedId(newUserRole).toLowerCase();
    while (usersList.some((u) => u.id.toLowerCase() === trimmedId)) {
      trimmedId = generateRecommendedId(newUserRole).toLowerCase();
    }

    const finalEmail =
      newUserEmail.trim() ||
      `${newUserName.trim().toLowerCase().replace(/\s+/g, '')}.${Math.floor(100 + Math.random() * 900)}@thpt-nbk.edu.vn`;

    const newUser: UserProfile = {
      id: trimmedId,
      name: newUserName.trim(),
      email: finalEmail,
      role: newUserRole,
      tier: newUserTier,
      xp: newUserRole === 'teacher' ? 5000 : 500,
      streakDays: 1,
      lastActiveDate: new Date().toISOString().split('T')[0],
      dailyScanCount: 0,
      maxDailyScans: newUserTier === 'premium' ? 9999 : 10,
      grade: newUserGrade,
      avatar: `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(newUserName.trim())}`,
      password: newUserPassword.trim(),
      status: 'active',
    };

    if (onCreateUser) {
      onCreateUser(newUser);
    } else {
      setInternalUsers((prev) => [newUser, ...prev]);
    }

    setCreateUserSuccess(
      `Đã tạo thành công tài khoản cho ${newUserRole === 'teacher' ? 'Giáo viên' : 'Học sinh'} "${newUser.name}" (${newUser.email}, Mật khẩu: ${newUser.password})`
    );

    setTimeout(() => {
      setShowCreateUserModal(false);
      setCreateUserSuccess(null);
    }, 2000);
  };

  // Lọc danh sách người dùng hiển thị
  const filteredUsers = usersList.filter((u) => {
    const matchesRole = userRoleFilter === 'all' || u.role === userRoleFilter;
    const matchesSearch =
      u.name.toLowerCase().includes(userSearchTerm.toLowerCase()) ||
      u.email.toLowerCase().includes(userSearchTerm.toLowerCase()) ||
      u.id.toLowerCase().includes(userSearchTerm.toLowerCase());
    return matchesRole && matchesSearch;
  });

  return (
    <div className="w-full max-w-5xl mx-auto px-4 py-8 space-y-8">
      {/* Top Header */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-rose-600 flex items-center gap-1.5">
            <ShieldCheck size={16} />
            <span>Trung Tâm Quản Trị Hệ Thống Toàn Quyền (Super Admin)</span>
          </span>
          <h1 className="text-2xl font-extrabold text-slate-900 mt-1">Math&NBK Admin Center</h1>
          <p className="text-slate-500 text-xs sm:text-sm mt-0.5">
            Độc quyền quyền hạn cấp tài khoản Giáo viên & Học sinh, quản lý token AI và nhật ký thi.
          </p>
        </div>

        {/* Tab switchers */}
        <div className="flex flex-wrap bg-slate-100 p-1 rounded-2xl border border-slate-200 text-xs font-bold gap-1">
          <button
            onClick={() => setActiveTab('users')}
            className={`px-3.5 py-1.5 rounded-xl transition-all flex items-center gap-1.5 ${
              activeTab === 'users' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
            }`}
          >
            <Users size={14} />
            <span>Tài Khoản ({usersList.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('pending_requests')}
            className={`px-3.5 py-1.5 rounded-xl transition-all flex items-center gap-1.5 ${
              activeTab === 'pending_requests' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
            }`}
          >
            <Clock size={14} className={pendingCount > 0 ? 'text-amber-500' : ''} />
            <span>Chờ Duyệt</span>
            {pendingCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-amber-500 text-white font-mono text-[10px] font-bold animate-pulse">
                {pendingCount}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('tokens')}
            className={`px-3.5 py-1.5 rounded-xl transition-all flex items-center gap-1.5 ${
              activeTab === 'tokens' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
            }`}
          >
            <Cpu size={14} />
            <span>Token & Cache</span>
          </button>
          <button
            onClick={() => setActiveTab('cheat_logs')}
            className={`px-3.5 py-1.5 rounded-xl transition-all flex items-center gap-1.5 ${
              activeTab === 'cheat_logs' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
            }`}
          >
            <ShieldAlert size={14} />
            <span>Nhật Ký Thi ({allLogs.length})</span>
          </button>
        </div>
      </div>

      {/* Thông báo thao tác phê duyệt */}
      {approvalMessage && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 size={18} className="text-emerald-600 shrink-0" />
          <span>{approvalMessage}</span>
        </div>
      )}

      {/* TAB 1: USER MANAGEMENT (CHỈ ADMIN MỚI CÓ QUYỀN TẠO TÀI KHOẢN) */}
      {activeTab === 'users' && (
        <div className="space-y-6">
          {/* Callout thông báo yêu cầu chờ duyệt nếu có */}
          {pendingCount > 0 && (
            <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-50 via-orange-50 to-amber-50 border border-amber-300 text-amber-900 text-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-in fade-in shadow-xs">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-amber-500 text-white flex items-center justify-center font-bold text-sm shrink-0 shadow-xs">
                  {pendingCount}
                </div>
                <div>
                  <h5 className="font-extrabold text-xs text-amber-950">
                    Có {pendingCount} yêu cầu đăng ký tài khoản mới đang chờ duyệt!
                  </h5>
                  <p className="text-[11px] text-amber-800 mt-0.5">
                    Học sinh hoặc giáo viên vừa đăng ký và cần Quản trị viên đối chiếu phê duyệt để kích hoạt.
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={handleBulkApprove}
                  disabled={isBulkApproving}
                  className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-xs transition-all shrink-0 shadow-xs flex items-center gap-1.5 cursor-pointer"
                >
                  <Zap size={14} className="fill-current" />
                  <span>{isBulkApproving ? 'Đang duyệt...' : `⚡ Phê Duyệt Tự Động Tất Cả (${pendingCount})`}</span>
                </button>
                <button
                  onClick={() => setActiveTab('pending_requests')}
                  className="px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs transition-colors shrink-0 shadow-xs flex items-center gap-1.5 cursor-pointer"
                >
                  <Clock size={14} />
                  <span>Xem Chi Tiết →</span>
                </button>
              </div>
            </div>
          )}

          {/* Security Banner regarding Admin Exclusive User Provisioning */}
          <div className="p-4 rounded-2xl bg-gradient-to-r from-rose-50 via-amber-50 to-slate-50 border border-rose-200 text-xs text-rose-950 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-rose-600 text-white flex items-center justify-center shrink-0">
                <ShieldAlert size={20} />
              </div>
              <div>
                <h4 className="font-extrabold text-sm text-rose-900">
                  Phân Quyền Tuyệt Đối: Chỉ Admin Mới Được Cấp Tài Khoản
                </h4>
                <p className="text-[11px] text-slate-600 mt-0.5">
                  Theo quy định an toàn bảo mật GDPT 2018, học sinh và giáo viên không thể tự tạo tài khoản. Chỉ Quản Trị Viên (Admin) mới có quyền tạo và cấp phát mã định danh (User ID) cho Giáo viên và Học sinh.
                </p>
              </div>
            </div>

            <button
              onClick={handleOpenCreateModal}
              className="px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-xs whitespace-nowrap transition-colors"
            >
              <UserPlus size={16} />
              <span>+ Cấp Tài Khoản Mới</span>
            </button>
          </div>

          {deleteUserSuccess && (
            <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center gap-2 animate-in fade-in">
              <CheckCircle2 size={16} />
              <span>{deleteUserSuccess}</span>
            </div>
          )}

          {/* User Table Card */}
          <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-xs">
            {/* Filter and search bar */}
            <div className="p-5 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl text-xs font-semibold">
                <button
                  onClick={() => setUserRoleFilter('all')}
                  className={`px-3 py-1 rounded-lg transition-all ${
                    userRoleFilter === 'all' ? 'bg-white text-slate-900 font-bold shadow-xs' : 'text-slate-600'
                  }`}
                >
                  Tất cả ({usersList.length})
                </button>
                <button
                  onClick={() => setUserRoleFilter('teacher')}
                  className={`px-3 py-1 rounded-lg transition-all ${
                    userRoleFilter === 'teacher' ? 'bg-white text-purple-700 font-bold shadow-xs' : 'text-slate-600'
                  }`}
                >
                  Giáo viên ({usersList.filter((u) => u.role === 'teacher').length})
                </button>
                <button
                  onClick={() => setUserRoleFilter('student')}
                  className={`px-3 py-1 rounded-lg transition-all ${
                    userRoleFilter === 'student' ? 'bg-white text-blue-700 font-bold shadow-xs' : 'text-slate-600'
                  }`}
                >
                  Học sinh ({usersList.filter((u) => u.role === 'student').length})
                </button>
              </div>

              <div className="relative">
                <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  value={userSearchTerm}
                  onChange={(e) => setUserSearchTerm(e.target.value)}
                  placeholder="Tìm theo tên, email, ID..."
                  className="h-9 pl-8 pr-3 rounded-xl border border-slate-300 text-xs focus:border-blue-600 focus:outline-none w-full sm:w-56"
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 uppercase font-bold tracking-wider border-b border-slate-200">
                  <tr>
                    <th className="px-6 py-3">Họ Tên & Email</th>
                    <th className="px-6 py-3">Mã ID Hệ Thống</th>
                    <th className="px-6 py-3">Vai Trò / Khối</th>
                    <th className="px-6 py-3">Gói Cước</th>
                    <th className="px-6 py-3">Mật Khẩu (Admin Quản Lý)</th>
                    <th className="px-6 py-3">Trạng Thái</th>
                    <th className="px-6 py-3 text-right">Thao Tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredUsers.map((u) => (
                    <tr key={u.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="font-bold text-slate-900">{u.name}</div>
                        <div className="text-[11px] text-slate-400 font-mono">{u.email}</div>
                      </td>
                      <td className="px-6 py-4 font-mono font-bold text-blue-700">
                        {u.id}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`px-2.5 py-0.5 rounded-full font-bold uppercase text-[10px] ${
                              u.role === 'teacher'
                                ? 'bg-purple-100 text-purple-700'
                                : u.role === 'admin'
                                ? 'bg-rose-100 text-rose-700'
                                : 'bg-blue-100 text-blue-700'
                            }`}
                          >
                            {u.role === 'teacher' ? 'Giáo viên' : u.role === 'admin' ? 'Quản trị' : 'Học sinh'}
                          </span>
                          {u.role === 'student' && (
                            <span className="text-[11px] font-semibold text-slate-500">Khối {u.grade}</span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`px-2.5 py-0.5 rounded-full font-bold uppercase text-[10px] ${
                            u.tier === 'premium' ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {u.tier === 'premium' ? 'Premium (Pro)' : 'Free Tier'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1.5 font-mono text-xs">
                          {revealedPasswordUserIds.includes(u.id) ? (
                            <span className="font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                              {u.password || '(Chưa đặt)'}
                            </span>
                          ) : (
                            <span className="text-slate-400 font-black tracking-widest bg-slate-100 px-2 py-0.5 rounded">
                              ••••••••
                            </span>
                          )}
                          <button
                            type="button"
                            onClick={() => toggleRevealPassword(u.id)}
                            className="p-1 rounded text-slate-400 hover:text-blue-600 transition-colors"
                            title={revealedPasswordUserIds.includes(u.id) ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                          >
                            {revealedPasswordUserIds.includes(u.id) ? <EyeOff size={14} /> : <Eye size={14} />}
                          </button>
                          {u.password && (
                            <button
                              type="button"
                              onClick={() => handleCopyPassword(u.id, u.password)}
                              className="p-1 rounded text-slate-400 hover:text-emerald-600 transition-colors"
                              title="Sao chép mật khẩu"
                            >
                              {copiedPasswordUserId === u.id ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handleOpenEditPassword(u)}
                            className="p-1 rounded text-slate-400 hover:text-purple-600 transition-colors ml-0.5"
                            title="Đổi mật khẩu người dùng này"
                          >
                            <Key size={14} />
                          </button>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        {u.status === 'pending_approval' ? (
                          <div className="flex flex-col gap-1 items-start">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200 animate-pulse">
                              <Clock size={11} className="text-amber-600" />
                              <span>Chờ duyệt</span>
                            </span>
                            <div className="flex items-center gap-1 mt-0.5">
                              <button
                                type="button"
                                onClick={() => handleApprove(u.id)}
                                className="px-2 py-0.5 rounded bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10px] shadow-2xs transition-colors"
                                title="Phê duyệt kích hoạt tài khoản"
                              >
                                Duyệt
                              </button>
                              <button
                                type="button"
                                onClick={() => handleReject(u.id)}
                                className="px-1.5 py-0.5 rounded bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 font-bold text-[10px] transition-colors"
                                title="Từ chối yêu cầu đăng ký"
                              >
                                Từ chối
                              </button>
                            </div>
                          </div>
                        ) : u.status === 'rejected' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                            <X size={12} className="text-rose-600" />
                            <span>Đã từ chối</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <CheckCircle2 size={12} className="text-emerald-600" />
                            <span>Hoạt động</span>
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => toggleTier(u.id)}
                            className="px-2.5 py-1 rounded-lg border border-slate-300 hover:bg-slate-100 font-semibold text-slate-700 transition-colors text-[11px]"
                            title={u.tier === 'free' ? 'Nâng cấp lên gói Premium Pro' : 'Chuyển về gói Miễn Phí'}
                          >
                            {u.tier === 'free' ? 'Nâng Pro' : 'Hạ Free'}
                          </button>
                          {u.role !== 'admin' ? (
                            <button
                              type="button"
                              onClick={() => setUserToDelete(u)}
                              className="px-2.5 py-1 rounded-lg border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-600 font-bold transition-colors flex items-center gap-1 text-[11px]"
                              title={`Xóa vĩnh viễn tài khoản ${u.name} (${u.id})`}
                            >
                              <Trash2 size={13} />
                              <span>Xóa</span>
                            </button>
                          ) : (
                            <span
                              className="px-2 py-1 rounded-lg text-slate-400 bg-slate-50 border border-slate-200 text-[10px] font-semibold cursor-not-allowed inline-flex items-center gap-1"
                              title="Tài khoản Quản Trị Viên hệ thống không thể xóa"
                            >
                              <ShieldCheck size={12} className="text-rose-500" />
                              <span>Cố định</span>
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB: YÊU CẦU ĐĂNG KÝ TÀI KHOẢN CHỜ ADMIN PHÊ DUYỆT */}
      {activeTab === 'pending_requests' && (
        <div className="space-y-6">
          {/* BẢNG ĐIỀU KHIỂN CHẾ ĐỘ DUYỆT TỰ ĐỘNG CỦA ADMIN */}
          <div className="p-6 rounded-3xl bg-gradient-to-br from-slate-900 via-indigo-950 to-blue-950 border border-indigo-500/30 text-white shadow-xl relative overflow-hidden space-y-5">
            {/* Ambient background glow */}
            <div className="absolute top-0 right-0 w-80 h-80 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-60 h-60 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none" />

            <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-full bg-cyan-500/20 border border-cyan-400/30 text-cyan-300 font-mono text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5">
                    <Zap size={12} className="text-cyan-400 animate-pulse" />
                    <span>Hệ Thống Duyệt Tự Động Admin</span>
                  </span>
                  <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 ${
                    autoApproval.enabled
                      ? 'bg-emerald-500/20 border border-emerald-400/40 text-emerald-300'
                      : 'bg-slate-700/50 border border-slate-600/40 text-slate-400'
                  }`}>
                    <span className={`w-2 h-2 rounded-full ${autoApproval.enabled ? 'bg-emerald-400' : 'bg-slate-500'}`} />
                    <span>{autoApproval.enabled ? 'Đang BẬT' : 'Đang TẮT'}</span>
                  </span>
                </div>

                <h3 className="text-lg font-black text-white flex items-center gap-2 mt-1">
                  <span>Cấu Hình Tự Động Phê Duyệt Tài Khoản</span>
                  <Sparkles size={18} className="text-amber-400" />
                </h3>
                <p className="text-xs text-blue-200/80 max-w-2xl leading-relaxed">
                  Khi kích hoạt, tài khoản đăng ký mới sẽ được tự động kích hoạt ngay lập tức mà không cần quản trị viên can thiệp thủ công.
                </p>
              </div>

              {/* Master Switch Button */}
              <div className="flex items-center gap-3 shrink-0">
                <button
                  type="button"
                  onClick={() => handleToggleAutoApproval('enabled')}
                  className={`px-4 py-2.5 rounded-2xl font-black text-xs transition-all flex items-center gap-2 shadow-lg cursor-pointer ${
                    autoApproval.enabled
                      ? 'bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white shadow-emerald-500/25 ring-2 ring-emerald-400/30'
                      : 'bg-slate-800 hover:bg-slate-750 text-slate-300 border border-slate-700 shadow-black/20'
                  }`}
                >
                  {autoApproval.enabled ? <ToggleRight size={20} className="text-white" /> : <ToggleLeft size={20} className="text-slate-400" />}
                  <span>{autoApproval.enabled ? 'Chế Độ: ĐANG BẬT' : 'Chế Độ: ĐANG TẮT'}</span>
                </button>
              </div>
            </div>

            {/* Granular Options & Toggles */}
            <div className="relative z-10 pt-4 border-t border-white/10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
              {/* Auto-approve Students */}
              <label className="flex items-center gap-2.5 p-3 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 transition-colors cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={autoApproval.autoApproveStudents}
                  onChange={(e) => handleToggleAutoApproval('autoApproveStudents', e.target.checked)}
                  className="w-4 h-4 rounded-md accent-cyan-500 text-cyan-600 focus:ring-0 cursor-pointer"
                />
                <div>
                  <span className="font-bold text-white block">Tự duyệt Học sinh</span>
                  <span className="text-[10px] text-blue-200/60 block">Kích hoạt ngay khi HS đăng ký</span>
                </div>
              </label>

              {/* Auto-approve Teachers */}
              <label className="flex items-center gap-2.5 p-3 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 transition-colors cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={autoApproval.autoApproveTeachers}
                  onChange={(e) => handleToggleAutoApproval('autoApproveTeachers', e.target.checked)}
                  className="w-4 h-4 rounded-md accent-cyan-500 text-cyan-600 focus:ring-0 cursor-pointer"
                />
                <div>
                  <span className="font-bold text-white block">Tự duyệt Giáo viên</span>
                  <span className="text-[10px] text-blue-200/60 block">Kích hoạt ngay khi GV đăng ký</span>
                </div>
              </label>

              {/* Default Account Tier */}
              <div className="p-3 rounded-2xl bg-white/5 border border-white/10 flex flex-col justify-between">
                <span className="text-[10px] text-blue-200/70 font-semibold uppercase tracking-wider block">
                  Gói mặc định khi duyệt:
                </span>
                <select
                  value={autoApproval.defaultTier || 'free'}
                  onChange={(e) => handleToggleAutoApproval('defaultTier', e.target.value as AccountTier)}
                  className="mt-1 bg-black/40 border border-white/15 rounded-xl px-2.5 py-1 text-white font-bold text-xs focus:outline-none focus:border-cyan-400 cursor-pointer"
                >
                  <option value="free" className="bg-slate-900 text-white">Miễn Phí (Free Tier)</option>
                  <option value="premium" className="bg-slate-900 text-white">Nâng Cao (Premium Tier)</option>
                </select>
              </div>

              {/* Notify Admin */}
              <label className="flex items-center gap-2.5 p-3 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 transition-colors cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={autoApproval.notifyAdminOnAutoApproval ?? true}
                  onChange={(e) => handleToggleAutoApproval('notifyAdminOnAutoApproval', e.target.checked)}
                  className="w-4 h-4 rounded-md accent-cyan-500 text-cyan-600 focus:ring-0 cursor-pointer"
                />
                <div>
                  <span className="font-bold text-white block">Thông báo cho Admin</span>
                  <span className="text-[10px] text-blue-200/60 block">Gửi push notification khi duyệt</span>
                </div>
              </label>
            </div>

            {/* Quick Bulk Approval Action Banner */}
            <div className="relative z-10 pt-2 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-white/5">
              <div className="text-xs text-blue-200/80 flex items-center gap-2">
                <UserCheck size={16} className="text-cyan-400 shrink-0" />
                <span>
                  Hàng đợi: <strong className="text-amber-300 font-mono font-bold text-sm">{pendingCount}</strong> tài khoản đang chờ phê duyệt.
                </span>
              </div>

              <button
                type="button"
                onClick={handleBulkApprove}
                disabled={pendingCount === 0 || isBulkApproving}
                className={`px-5 py-2.5 rounded-2xl font-black text-xs transition-all flex items-center justify-center gap-2 shadow-lg cursor-pointer ${
                  pendingCount === 0
                    ? 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed opacity-60'
                    : 'bg-gradient-to-r from-amber-500 via-orange-500 to-emerald-500 hover:from-amber-400 hover:to-emerald-400 text-slate-950 shadow-orange-500/25 active:scale-95'
                }`}
              >
                <Zap size={16} className={pendingCount > 0 ? 'fill-current' : ''} />
                <span>
                  {isBulkApproving
                    ? 'Đang Tự Động Kích Hoạt...'
                    : `Phê Duyệt Tự Động Tất Cả (${pendingCount} Yêu Cầu)`}
                </span>
              </button>
            </div>
          </div>

          {/* Tiêu đề danh sách yêu cầu chờ duyệt */}
          <div className="p-5 rounded-3xl bg-white border border-slate-200 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-amber-600 flex items-center gap-1.5">
                <Clock size={16} />
                <span>Danh Sách Chờ Phê Duyệt Thủ Công ({pendingUsers.length})</span>
              </span>
              <h3 className="text-xl font-black text-slate-900 mt-1">
                Yêu Cầu Tài Khoản Mới Đang Chờ Duyệt
              </h3>
            </div>

            <div className="px-4 py-2 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 font-mono text-xs font-bold shrink-0">
              Chờ xử lý: {pendingUsers.length} tài khoản
            </div>
          </div>

          {pendingUsers.length === 0 ? (
            <div className="p-12 text-center rounded-3xl bg-white border border-slate-200 shadow-xs space-y-3">
              <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto">
                <CheckCircle2 size={30} />
              </div>
              <h4 className="font-extrabold text-base text-slate-900">
                Không Có Yêu Cầu Nào Đang Chờ Duyệt
              </h4>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                Tất cả yêu cầu đăng ký tài khoản từ giáo viên và học sinh đã được phê duyệt hoặc xử lý đầy đủ.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {pendingUsers.map((u) => (
                <div
                  key={u.id}
                  className="bg-white p-5 rounded-3xl border border-amber-200 shadow-xs space-y-4 hover:border-amber-300 transition-colors"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-2xl bg-slate-100 overflow-hidden shrink-0 border border-slate-200">
                        <img
                          src={u.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${u.name}`}
                          alt={u.name}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div>
                        <h4 className="font-extrabold text-sm text-slate-900">{u.name}</h4>
                        <p className="text-[11px] font-mono text-slate-500">{u.email}</p>
                        <span className="text-[10px] text-slate-400 block mt-0.5">
                          ID Đề xuất: <code className="font-mono text-slate-700 font-bold">{u.id}</code>
                        </span>
                      </div>
                    </div>

                    <span
                      className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                        u.role === 'teacher'
                          ? 'bg-purple-100 text-purple-700'
                          : 'bg-blue-100 text-blue-700'
                      }`}
                    >
                      {u.role === 'teacher' ? 'Giáo viên' : `Học sinh Lớp ${u.grade}`}
                    </span>
                  </div>

                  <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100 text-xs space-y-1.5">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-500">Trường THPT:</span>
                      <span className="font-semibold text-slate-800">{u.schoolName || 'Chưa cập nhật'}</span>
                    </div>
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-500">Thời gian gửi yêu cầu:</span>
                      <span className="font-mono text-slate-700">
                        {u.requestedAt
                          ? new Date(u.requestedAt).toLocaleString('vi-VN', {
                              hour: '2-digit',
                              minute: '2-digit',
                              day: '2-digit',
                              month: '2-digit',
                              year: 'numeric',
                            })
                          : 'Vừa xong'}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-1">
                    <button
                      onClick={() => handleReject(u.id)}
                      className="flex-1 py-2 rounded-xl bg-slate-100 hover:bg-rose-50 hover:text-rose-700 text-slate-600 font-bold text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <X size={14} />
                      <span>Từ Chối</span>
                    </button>
                    <button
                      onClick={() => handleApprove(u.id)}
                      className="flex-1 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <CheckCircle2 size={14} />
                      <span>Phê Duyệt Kích Hoạt</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: AI TOKEN & CACHE */}
      {activeTab === 'tokens' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-5 rounded-3xl bg-white border border-slate-200 shadow-xs">
              <span className="text-xs font-bold text-slate-500 block">Tổng Token Đã Dùng</span>
              <span className="text-2xl font-black text-slate-900 font-mono mt-1 block">
                124,580 <span className="text-xs font-medium text-slate-400">tk</span>
              </span>
              <span className="text-[11px] text-blue-600 font-semibold mt-1 block">
                Mô hình: Gemini 3.8 Flash
              </span>
            </div>

            <div className="p-5 rounded-3xl bg-white border border-slate-200 shadow-xs">
              <span className="text-xs font-bold text-slate-500 block">Tỷ Lệ Trúng Cache (Redis)</span>
              <span className="text-2xl font-black text-emerald-600 font-mono mt-1 block">
                68.4%
              </span>
              <span className="text-[11px] text-emerald-700 font-semibold mt-1 block">
                Tiết kiệm 85,200 token gọi lại
              </span>
            </div>

            <div className="p-5 rounded-3xl bg-white border border-slate-200 shadow-xs">
              <span className="text-xs font-bold text-slate-500 block">Chi Phí Ước Tính</span>
              <span className="text-2xl font-black text-slate-900 font-mono mt-1 block">
                $1.24
              </span>
              <span className="text-[11px] text-slate-500 font-semibold mt-1 block">
                Ngân sách trường: $500/tháng
              </span>
            </div>

            <div className="p-5 rounded-3xl bg-white border border-slate-200 shadow-xs">
              <span className="text-xs font-bold text-slate-500 block">Người Dùng Hoạt Động</span>
              <span className="text-2xl font-black text-blue-600 font-mono mt-1 block">
                {usersList.length}
              </span>
              <span className="text-[11px] text-blue-700 font-semibold mt-1 block">
                Tài khoản chính quy
              </span>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: CHEAT LOGS */}
      {activeTab === 'cheat_logs' && (
        <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-xs space-y-4 p-6">
          <div className="flex items-center justify-between pb-3 border-b border-slate-200">
            <div>
              <h3 className="font-extrabold text-base text-slate-900">
                Nhật Ký Giám Sát Chống Gian Lận Trực Tuyến
              </h3>
              <p className="text-xs text-slate-500">
                Ghi nhận các sự kiện chuyển ứng dụng, rời màn hình và vi phạm quá 3 lần
              </p>
            </div>
            <span className="px-3 py-1 rounded-full bg-red-100 text-red-700 text-xs font-bold">
              {allLogs.length} vi phạm được ghi nhận
            </span>
          </div>

          <div className="space-y-3">
            {allLogs.map((log) => (
              <div
                key={log.id}
                className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900">{log.studentName}</span>
                    <span className="text-slate-400">·</span>
                    <span className="text-slate-500 font-mono">
                      {new Date(log.timestamp).toLocaleTimeString('vi-VN')}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        log.infractionNumber >= 3
                          ? 'bg-red-600 text-white'
                          : log.infractionNumber === 2
                          ? 'bg-amber-500 text-white'
                          : 'bg-yellow-400 text-slate-900'
                      }`}
                    >
                      Lần {log.infractionNumber}
                    </span>
                  </div>
                  <p className="text-slate-600">{log.reason}</p>
                  <p className="text-[11px] text-slate-400">Đề thi: {log.examTitle}</p>
                </div>

                <div className="text-right">
                  <span
                    className={`font-bold block ${
                      log.actionTaken === 'auto_submitted_disqualified'
                        ? 'text-red-600'
                        : 'text-amber-600'
                    }`}
                  >
                    {log.actionTaken === 'auto_submitted_disqualified'
                      ? 'Tự động nộp bài & Đình chỉ'
                      : `Cảnh báo vi phạm lần ${log.infractionNumber}`}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: CẤP TÀI KHOẢN MỚI CHO GIÁO VIÊN / HỌC SINH (CHỈ ADMIN MỚI CÓ QUYỀN) */}
      {/* ========================================================================= */}
      {showCreateUserModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 space-y-5 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center">
                  <ShieldCheck size={22} />
                </div>
                <div>
                  <h3 className="font-extrabold text-base text-slate-900">
                    Cấp Tài Khoản Mới (Quyền Quản Trị)
                  </h3>
                  <p className="text-xs text-rose-600 font-semibold">
                    Chỉ Admin mới có thẩm quyền khởi tạo tài khoản GV / HS
                  </p>
                </div>
              </div>
              <button onClick={() => setShowCreateUserModal(false)} className="text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
            </div>

            {createUserError && (
              <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-center gap-2">
                <AlertTriangle size={16} />
                <span>{createUserError}</span>
              </div>
            )}

            {createUserSuccess && (
              <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center gap-2">
                <CheckCircle2 size={16} />
                <span>{createUserSuccess}</span>
              </div>
            )}

            <form onSubmit={handleCreateUserSubmit} className="space-y-4 text-xs">
              {/* Chọn vai trò: Giáo viên hoặc Học sinh */}
              <div className="space-y-1.5">
                <label className="font-bold text-slate-700 block">Chọn vai trò tài khoản:</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setNewUserRole('teacher');
                    }}
                    className={`py-2.5 px-3 rounded-xl border font-bold text-xs flex items-center justify-center gap-2 transition-all ${
                      newUserRole === 'teacher'
                        ? 'bg-purple-600 text-white border-purple-600 shadow-xs'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <GraduationCap size={16} />
                    <span>Giáo Viên Toán</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setNewUserRole('student');
                    }}
                    className={`py-2.5 px-3 rounded-xl border font-bold text-xs flex items-center justify-center gap-2 transition-all ${
                      newUserRole === 'student'
                        ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <Users size={16} />
                    <span>Học Sinh THPT</span>
                  </button>
                </div>
              </div>

              {/* Họ và tên */}
              <div className="space-y-1">
                <label className="font-bold text-slate-700">Họ và tên người dùng *</label>
                <input
                  type="text"
                  value={newUserName}
                  onChange={(e) => setNewUserName(e.target.value)}
                  placeholder={newUserRole === 'teacher' ? 'VD: ThS. Hoàng Văn Bách' : 'VD: Đặng Quốc Huy'}
                  className="w-full h-10 px-3 rounded-xl border border-slate-300 text-xs focus:border-blue-600 focus:outline-none"
                  required
                />
              </div>

              {/* Email */}
              <div className="space-y-1">
                <label className="font-bold text-slate-700">Email trường học (Tùy chọn)</label>
                <input
                  type="email"
                  value={newUserEmail}
                  onChange={(e) => setNewUserEmail(e.target.value)}
                  placeholder="Tự động sinh theo tên nếu để trống"
                  className="w-full h-10 px-3 rounded-xl border border-slate-300 text-xs focus:border-blue-600 focus:outline-none"
                />
              </div>

              {/* Mật khẩu khởi tạo tài khoản (Tối thiểu 8 ký tự bất kỳ) */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-slate-700 flex items-center gap-1.5">
                    <Key size={13} className="text-rose-600" />
                    <span>Mật khẩu ban đầu * (Tối thiểu 8 ký tự bất kỳ)</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setNewUserPassword(generateRandomPassword())}
                    className="text-[11px] text-blue-600 hover:underline font-semibold flex items-center gap-1"
                  >
                    <RefreshCw size={11} />
                    <span>Tạo ngẫu nhiên</span>
                  </button>
                </div>
                <div className="relative">
                  <input
                    type={showCreatePassword ? 'text' : 'password'}
                    value={newUserPassword}
                    onChange={(e) => setNewUserPassword(e.target.value)}
                    placeholder="Nhập mật khẩu (tối thiểu 8 ký tự bất kỳ)..."
                    className="w-full h-10 px-3 pr-10 rounded-xl border border-slate-300 font-mono text-xs font-bold text-slate-900 focus:border-blue-600 focus:outline-none"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowCreatePassword((v) => !v)}
                    className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 p-0.5"
                    title={showCreatePassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                  >
                    {showCreatePassword ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
                <div className="flex items-center justify-between text-[10px]">
                  {newUserPassword.length < 8 ? (
                    <span className="text-rose-600 font-bold">
                      ⚠️ Hiện có {newUserPassword.length}/8 ký tự (chưa đủ 8 ký tự)
                    </span>
                  ) : (
                    <span className="text-emerald-600 font-bold">
                      ✓ Đạt yêu cầu bảo mật ({newUserPassword.length} ký tự)
                    </span>
                  )}
                  <span className="text-slate-400">Chấp nhận mọi loại ký tự</span>
                </div>
              </div>

              {/* Khối lớp (Nếu là Học sinh) */}
              {newUserRole === 'student' && (
                <div className="space-y-1">
                  <label className="font-bold text-slate-700">Khối Lớp Đang Học *</label>
                  <select
                    value={newUserGrade}
                    onChange={(e) => setNewUserGrade(Number(e.target.value) as any)}
                    className="w-full h-10 px-3 rounded-xl border border-slate-300 text-xs bg-white focus:border-blue-600 focus:outline-none"
                  >
                    <option value={12}>Lớp 12 (Ôn thi Tốt nghiệp THPT)</option>
                    <option value={11}>Lớp 11 (GDPT 2018)</option>
                    <option value={10}>Lớp 10 (GDPT 2018)</option>
                  </select>
                </div>
              )}

              {/* Gói cước */}
              <div className="space-y-1">
                <label className="font-bold text-slate-700">Gói Tài Khoản</label>
                <select
                  value={newUserTier}
                  onChange={(e) => setNewUserTier(e.target.value as AccountTier)}
                  className="w-full h-10 px-3 rounded-xl border border-slate-300 text-xs bg-white focus:border-blue-600 focus:outline-none"
                >
                  <option value="free">Miễn Phí (Free Tier - 10 lượt quét/ngày)</option>
                  <option value="premium">Nâng Cao (Premium Pro - Không giới hạn AI & Đề thi)</option>
                </select>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateUserModal(false)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-300 text-xs font-bold text-slate-700 hover:bg-slate-50"
                >
                  Hủy Bỏ
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-xs"
                >
                  Xác Nhận Cấp Tài Khoản
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: ĐỔI MẬT KHẨU TÀI KHOẢN (ADMIN QUẢN TRỊ VIÊN CẬP NHẬT TRỰC TIẾP) */}
      {/* ========================================================================= */}
      {editingPasswordUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center">
                  <Key size={20} />
                </div>
                <div>
                  <h3 className="font-extrabold text-sm text-slate-900">
                    Đổi Mật Khẩu Người Dùng
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Cập nhật mật khẩu cho {editingPasswordUser.name} ({editingPasswordUser.id})
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingPasswordUser(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X size={18} />
              </button>
            </div>

            {editPasswordError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-center gap-2">
                <AlertTriangle size={15} />
                <span>{editPasswordError}</span>
              </div>
            )}

            {editPasswordSuccess && (
              <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center gap-2">
                <CheckCircle2 size={15} />
                <span>{editPasswordSuccess}</span>
              </div>
            )}

            <form onSubmit={handleSaveEditPassword} className="space-y-4 text-xs">
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-slate-700">Mật khẩu mới * (Tối thiểu 8 ký tự bất kỳ)</label>
                  <button
                    type="button"
                    onClick={() => setEditNewPassword(generateRandomPassword())}
                    className="text-[11px] text-blue-600 hover:underline font-semibold flex items-center gap-1"
                  >
                    <RefreshCw size={11} />
                    <span>Tạo ngẫu nhiên</span>
                  </button>
                </div>
                <div className="relative">
                  <input
                    type={showEditNewPassword ? 'text' : 'password'}
                    value={editNewPassword}
                    onChange={(e) => setEditNewPassword(e.target.value)}
                    placeholder="Nhập mật khẩu mới..."
                    className="w-full h-10 px-3 pr-10 rounded-xl border border-slate-300 font-mono text-xs font-bold text-slate-900 focus:border-purple-600 focus:outline-none"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowEditNewPassword((v) => !v)}
                    className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 p-0.5"
                  >
                    {showEditNewPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
                <p className="text-[10px]">
                  {editNewPassword.length < 8 ? (
                    <span className="text-rose-600 font-bold">⚠️ Tối thiểu 8 ký tự ({editNewPassword.length}/8)</span>
                  ) : (
                    <span className="text-emerald-600 font-bold">✓ Hợp lệ ({editNewPassword.length} ký tự)</span>
                  )}
                </p>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingPasswordUser(null)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-300 text-xs font-bold text-slate-700 hover:bg-slate-50"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs shadow-xs"
                >
                  Lưu Mật Khẩu
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: XÁC NHẬN XÓA TÀI KHOẢN NGƯỜI DÙNG (ADMIN QUẢN TRỊ VIÊN) */}
      {/* ========================================================================= */}
      {userToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-rose-100 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-start gap-3">
              <div className="w-11 h-11 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                <Trash2 size={22} />
              </div>
              <div className="flex-1">
                <h3 className="font-extrabold text-base text-slate-900">
                  Xác Nhận Xóa Tài Khoản?
                </h3>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  Hành động này sẽ xóa vĩnh viễn tài khoản của{' '}
                  <strong className="text-slate-800">{userToDelete.name}</strong> (Mã:{' '}
                  <code className="text-rose-600 font-bold">{userToDelete.id}</code>, Vai trò:{' '}
                  <span className="font-semibold">
                    {userToDelete.role === 'teacher' ? 'Giáo viên' : userToDelete.role === 'student' ? 'Học sinh' : 'Quản trị viên'}
                  </span>
                  ). Dữ liệu cá nhân và quyền truy cập của tài khoản này sẽ bị thu hồi hoàn toàn.
                </p>
              </div>
            </div>

            <div className="p-3 bg-rose-50/70 border border-rose-200/80 rounded-2xl text-[11px] text-rose-800 flex items-center gap-2">
              <AlertTriangle size={16} className="text-rose-600 shrink-0" />
              <span>Chỉ Quản trị viên cấp cao mới có quyền thực hiện thao tác xóa tài khoản này.</span>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setUserToDelete(null)}
                className="flex-1 py-2.5 rounded-xl border border-slate-300 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors"
              >
                Hủy Bỏ
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteUser}
                className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-md transition-colors flex items-center justify-center gap-1.5"
              >
                <Trash2 size={14} />
                <span>Xác Nhận Xóa</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
