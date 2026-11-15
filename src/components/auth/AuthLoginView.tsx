import React, { useState } from 'react';
import { UserProfile, UserRole, AutoApprovalSettings } from '../../types/math';
import { dbRegisterUser } from '../../services/dbSyncService';
import {
  BookOpen,
  Lock,
  Mail,
  User,
  GraduationCap,
  ShieldCheck,
  Eye,
  EyeOff,
  Sparkles,
  ArrowRight,
  School,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  X,
  Compass,
  FileCheck,
  MessageSquare,
  Zap,
  Hash,
} from 'lucide-react';

interface AuthLoginViewProps {
  allUsers: UserProfile[];
  onLoginSuccess: (user: UserProfile, rememberMe?: boolean) => void;
  onRegisterUser: (newUser: UserProfile) => void;
  autoApprovalSettings?: AutoApprovalSettings;
}

export const AuthLoginView: React.FC<AuthLoginViewProps> = ({
  allUsers,
  onLoginSuccess,
  onRegisterUser,
  autoApprovalSettings,
}) => {
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');

  // Login form state (Không điền sẵn - người dùng tự nhập)
  const [loginIdentifier, setLoginIdentifier] = useState<string>('');
  const [loginPassword, setLoginPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [rememberMe, setRememberMe] = useState<boolean>(true);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // Register form state
  const [regRole, setRegRole] = useState<'student' | 'teacher'>('student');
  const [regCustomId, setRegCustomId] = useState<string>('');
  const [regName, setRegName] = useState<string>('');
  const [regEmail, setRegEmail] = useState<string>('');
  const [regGrade, setRegGrade] = useState<10 | 11 | 12>(12);
  const [regSchool, setRegSchool] = useState<string>('Toán Học LIKI');
  const [regPassword, setRegPassword] = useState<string>('');
  const [regConfirmPassword, setRegConfirmPassword] = useState<string>('');
  const [regError, setRegError] = useState<string | null>(null);
  const [regSuccess, setRegSuccess] = useState<boolean>(false);
  const [pendingModalUser, setPendingModalUser] = useState<UserProfile | null>(null);
  const [regPendingNotice, setRegPendingNotice] = useState<string | null>(null);

  // Forgot password modal state
  const [showForgotModal, setShowForgotModal] = useState<boolean>(false);
  const [forgotEmail, setForgotEmail] = useState<string>('');
  const [forgotSubmitted, setForgotSubmitted] = useState<boolean>(false);

  // Handle Login
  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);

    const iden = loginIdentifier.trim().toLowerCase();
    const pass = loginPassword.trim();

    if (!iden || !pass) {
      setLoginError('Vui lòng nhập đầy đủ Email/ID và Mật khẩu!');
      return;
    }

    setIsLoading(true);

    setTimeout(() => {
      // Tìm người dùng theo email hoặc ID
      const user = allUsers.find(
        (u) =>
          u.email.toLowerCase() === iden ||
          u.id.toLowerCase() === iden
      );

      if (!user) {
        setIsLoading(false);
        setLoginError('Không tìm thấy tài khoản với Email hoặc ID này trên hệ thống!');
        return;
      }

      // Kiểm tra trạng thái phê duyệt từ Admin
      if (user.status === 'pending_approval') {
        setIsLoading(false);
        setLoginError('Tài khoản của bạn đang chờ Admin phê duyệt! Vui lòng liên hệ Ban Quản Trị hoặc đợi duyệt trước khi đăng nhập.');
        return;
      }
      if (user.status === 'rejected') {
        setIsLoading(false);
        setLoginError(`Tài khoản đã bị từ chối phê duyệt.${user.rejectionReason ? ` Lý do: ${user.rejectionReason}` : ''}`);
        return;
      }

      // Kiểm tra mật khẩu (nếu user có password thì đối chiếu)
      if (user.password && user.password !== pass) {
        setIsLoading(false);
        setLoginError('Mật khẩu không chính xác! Vui lòng kiểm tra lại.');
        return;
      }

      setIsLoading(false);
      onLoginSuccess(user, rememberMe);
    }, 450);
  };

  // Handle Register (Gửi yêu cầu tới Admin, TUYỆT ĐỐI KHÔNG CÓ QUYỀN TẠO ADMIN)
  const handleRegisterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setRegError(null);

    if (!regCustomId.trim()) {
      setRegError('Vui lòng nhập Mã ID tài khoản!');
      return;
    }
    if (/\s/.test(regCustomId.trim())) {
      setRegError('Mã ID tài khoản không được chứa khoảng trắng!');
      return;
    }
    if (allUsers.some((u) => u.id.toLowerCase() === regCustomId.trim().toLowerCase())) {
      setRegError('Mã ID này đã tồn tại trên hệ thống! Vui lòng chọn ID khác.');
      return;
    }
    if (!regName.trim()) {
      setRegError('Vui lòng nhập họ và tên của bạn!');
      return;
    }
    if (!regEmail.trim() || !regEmail.includes('@')) {
      setRegError('Vui lòng nhập địa chỉ email hợp lệ!');
      return;
    }
    if (allUsers.some((u) => u.email.toLowerCase() === regEmail.trim().toLowerCase())) {
      setRegError('Email này đã được sử dụng. Vui lòng đăng nhập hoặc dùng email khác!');
      return;
    }
    if (regPassword.length < 8) {
      setRegError('Mật khẩu bảo mật phải có tối thiểu 8 ký tự!');
      return;
    }
    if (regPassword !== regConfirmPassword) {
      setRegError('Mật khẩu xác nhận không khớp!');
      return;
    }

    const finalId = regCustomId.trim().toLowerCase();

    // Kiểm tra cấu hình Duyệt Tự Động của Admin
    const isAutoApproved = Boolean(
      autoApprovalSettings?.enabled &&
      ((regRole === 'student' && autoApprovalSettings.autoApproveStudents) ||
       (regRole === 'teacher' && autoApprovalSettings.autoApproveTeachers))
    );

    const initialStatus = isAutoApproved ? 'active' : 'pending_approval';

    const newApplicant: UserProfile = {
      id: finalId,
      name: regName.trim(),
      email: regEmail.trim().toLowerCase(),
      role: regRole, // 'student' or 'teacher' (TUYỆT ĐỐI KHÔNG CHO PHÉP TẠO ADMIN)
      tier: 'free',
      xp: 100,
      streakDays: 1,
      lastActiveDate: new Date().toISOString().split('T')[0],
      dailyScanCount: 0,
      maxDailyScans: 9999,
      grade: regGrade,
      avatar: `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(regName.trim())}`,
      schoolName: regSchool.trim() || 'Toán Học LIKI',
      bio: `${regRole === 'teacher' ? 'Giáo viên THPT' : `Học sinh lớp ${regGrade} THPT`}, tài khoản đăng ký mới trên nền tảng Toán Học LIKI.`,
      subject: 'Toán Học THPT',
      password: regPassword,
      status: initialStatus,
      requestedAt: new Date().toISOString(),
      ...(isAutoApproved ? { approvedAt: new Date().toISOString() } : {}),
    };

    // 1. Cập nhật vào state React ứng dụng
    onRegisterUser(newApplicant);

    // 2. Đồng bộ trực tiếp lên Server Database để máy khác xem được ngay
    dbRegisterUser(newApplicant).then((res) => {
      if (!res.success && res.error) {
        setRegError(res.error);
      }
    }).catch((err) => console.error('Lỗi sync đăng ký:', err));

    // Kích hoạt thông báo đẩy tới Admin
    try {
      const event = new CustomEvent('math_nbk_push_notification', {
        detail: {
          id: `notif_${Date.now()}`,
          title: isAutoApproved ? 'Tài Khoản Mới Đã Tự Động Kích Hoạt' : 'Yêu Cầu Cấp Tài Khoản Mới',
          message: isAutoApproved
            ? `Tài khoản ${newApplicant.name} (${regRole === 'teacher' ? 'Giáo viên' : 'Học sinh'} - ${newApplicant.email}) đã được hệ thống tự động phê duyệt và kích hoạt thành công.`
            : `Người dùng ${newApplicant.name} (${regRole === 'teacher' ? 'Giáo viên' : 'Học sinh'} - ${newApplicant.email}) vừa gửi yêu cầu đăng ký. Vui lòng vào Trung tâm quản trị để duyệt.`,
          type: 'system',
          timestamp: new Date().toISOString(),
          isRead: false,
          targetTab: 'admin_dashboard',
        },
      });
      window.dispatchEvent(event);
    } catch (err) {
      // ignore
    }

    setPendingModalUser(newApplicant);
    setRegCustomId('');
    setRegName('');
    setRegEmail('');
    setRegPassword('');
    setRegConfirmPassword('');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-indigo-950 text-slate-100 flex flex-col justify-between selection:bg-blue-600 selection:text-white relative overflow-hidden font-sans">
      {/* Decorative ambient background glows */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-600/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-indigo-500/15 rounded-full blur-3xl pointer-events-none" />

      {/* Top Header Bar */}
      <header className="relative z-10 max-w-7xl w-full mx-auto px-6 py-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-cyan-400 flex items-center justify-center text-white shadow-lg shadow-blue-500/30">
            <BookOpen size={24} className="stroke-[2.5]" />
          </div>
          <div className="flex flex-col">
            <span className="text-2xl font-black tracking-tight text-white leading-none">
              Toán Học <span className="text-cyan-400">LIKI</span>
            </span>
            <span className="text-[11px] text-blue-200 font-semibold tracking-wide">
              Hệ Thống Học & Thi Toán THPT
            </span>
          </div>
        </div>

      </header>

      {/* Main Center Content */}
      <main className="relative z-10 max-w-6xl w-full mx-auto px-4 sm:px-6 py-6 flex-1 flex items-center justify-center">
        <div className="w-full grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
          {/* Left Column: Platform Highlights & Introduction */}
          <div className="lg:col-span-6 space-y-6 text-center lg:text-left">

            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white tracking-tight leading-tight">
              Đăng nhập để luyện thi, giải toán và học cùng{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-blue-400 to-indigo-300">
                Trợ Lý AI Liki 24/7
              </span>
            </h1>

            {/* Feature Cards Grid */}
            <div className="grid grid-cols-2 gap-3 pt-2">
              <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-xs text-left space-y-1">
                <div className="w-8 h-8 rounded-xl bg-blue-500/20 text-cyan-400 flex items-center justify-center">
                  <FileCheck size={16} />
                </div>
                <h4 className="font-extrabold text-xs text-white">Đề Thi BGD 2025</h4>
                <p className="text-[11px] text-slate-400">Chấm điểm 3 phần tự động, bảng xếp hạng lớp.</p>
              </div>

              <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-xs text-left space-y-1">
                <div className="w-8 h-8 rounded-xl bg-indigo-500/20 text-indigo-300 flex items-center justify-center">
                  <Compass size={16} />
                </div>
                <h4 className="font-extrabold text-xs text-white">Three.js 3D & Oxyz</h4>
                <p className="text-[11px] text-slate-400">Mô phỏng 3D PBR chóp, nón, trụ và đồ thị z = f(x,y).</p>
              </div>

              <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-xs text-left space-y-1">
                <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-300 flex items-center justify-center">
                  <Sparkles size={16} />
                </div>
                <h4 className="font-extrabold text-xs text-white">Trợ Lý AI Liki</h4>
                <p className="text-[11px] text-slate-400">Gợi mở tư duy từng bước & tra cứu Google Search.</p>
              </div>

              <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-xs text-left space-y-1">
                <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-300 flex items-center justify-center">
                  <MessageSquare size={16} />
                </div>
                <h4 className="font-extrabold text-xs text-white">Nhóm Lớp Trực Tuyến</h4>
                <p className="text-[11px] text-slate-400">Chat trao đổi bài tập, tag tên, thông báo đẩy bài mới.</p>
              </div>
            </div>
          </div>

          {/* Right Column: Authentication Card */}
          <div className="lg:col-span-6 w-full max-w-md mx-auto">
            <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-3xl p-6 sm:p-8 shadow-2xl relative">
              {/* Tab Selector: Đăng Nhập / Đăng Ký */}
              <div className="flex bg-black/30 p-1 rounded-2xl border border-white/10 mb-6 font-bold text-xs">
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode('login');
                    setLoginError(null);
                  }}
                  className={`flex-1 py-2.5 rounded-xl transition-all ${
                    authMode === 'login'
                      ? 'bg-blue-600 text-white shadow-md'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Đăng Nhập
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode('register');
                    setRegError(null);
                  }}
                  className={`flex-1 py-2.5 rounded-xl transition-all ${
                    authMode === 'register'
                      ? 'bg-blue-600 text-white shadow-md'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Đăng Ký Học Sinh
                </button>
              </div>

              {/* MODE 1: FORM ĐĂNG NHẬP */}
              {authMode === 'login' && (
                <form onSubmit={handleLoginSubmit} className="space-y-4">
                  <div>
                    <h3 className="text-xl font-black text-white">Chào mừng trở lại!</h3>
                  </div>

                  {regPendingNotice && (
                    <div className="p-3 rounded-2xl bg-amber-500/20 border border-amber-500/40 text-amber-200 text-xs font-semibold flex items-start gap-2 animate-in fade-in">
                      <AlertCircle size={16} className="shrink-0 text-amber-400 mt-0.5" />
                      <span>{regPendingNotice}</span>
                    </div>
                  )}

                  {loginError && (
                    <div className="p-3 rounded-2xl bg-rose-500/20 border border-rose-500/40 text-rose-200 text-xs font-semibold flex items-center gap-2 animate-in fade-in">
                      <AlertCircle size={16} className="shrink-0 text-rose-400" />
                      <span>{loginError}</span>
                    </div>
                  )}

                  {/* Input Email */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-300 block">
                      Email tài khoản
                    </label>
                    <div className="relative">
                      <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="text"
                        value={loginIdentifier}
                        onChange={(e) => setLoginIdentifier(e.target.value)}
                        placeholder="VD: an.nguyen@thpt-nbk.edu.vn"
                        className="w-full h-11 pl-10 pr-3 rounded-2xl bg-black/40 border border-white/20 text-white placeholder-slate-500 text-xs focus:border-cyan-400 focus:outline-none transition-colors"
                      />
                    </div>
                  </div>

                  {/* Input Password */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-slate-300">Mật khẩu</label>
                      <button
                        type="button"
                        onClick={() => setShowForgotModal(true)}
                        className="text-[11px] text-cyan-400 hover:underline font-semibold"
                      >
                        Quên mật khẩu?
                      </button>
                    </div>
                    <div className="relative">
                      <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={loginPassword}
                        onChange={(e) => setLoginPassword(e.target.value)}
                        placeholder="Nhập mật khẩu của bạn..."
                        className="w-full h-11 pl-10 pr-10 rounded-2xl bg-black/40 border border-white/20 text-white placeholder-slate-500 text-xs focus:border-cyan-400 focus:outline-none transition-colors"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                      >
                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>

                  {/* Remember Me */}
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="rememberMe"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="rounded border-white/20 bg-black/40 text-blue-600 focus:ring-blue-500 w-4 h-4"
                    />
                    <label htmlFor="rememberMe" className="text-xs text-slate-300 font-medium cursor-pointer">
                      Ghi nhớ phiên đăng nhập trên thiết bị này
                    </label>
                  </div>

                  {/* Submit Button */}
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full h-12 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-extrabold text-sm shadow-lg shadow-blue-500/25 flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
                  >
                    {isLoading ? (
                      <span className="flex items-center gap-2">
                        <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        <span>Đang xác thực...</span>
                      </span>
                    ) : (
                      <>
                        <span>Đăng Nhập Vào Hệ Thống</span>
                        <ArrowRight size={16} />
                      </>
                    )}
                  </button>
                </form>
              )}

              {/* MODE 2: FORM ĐĂNG KÝ (GỬI YÊU CẦU ĐẾN ADMIN - TUYỆT ĐỐI KHÔNG CÓ ADMIN) */}
              {authMode === 'register' && (
                <form onSubmit={handleRegisterSubmit} className="space-y-3.5">
                  <div>
                    <h3 className="text-xl font-black text-white">Đăng ký tài khoản mới</h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Yêu cầu tài khoản sẽ được gửi trực tiếp đến Ban Quản Trị để phê duyệt.
                    </p>
                  </div>

                  {/* Lựa chọn vai trò: Chỉ Học sinh hoặc Giáo viên (TUYỆT ĐỐI KHÔNG CÓ ADMIN) */}
                  <div className="space-y-1.5 p-3 rounded-2xl bg-white/5 border border-white/10">
                    <div className="flex items-center justify-between">
                      <label className="text-[11px] font-bold text-slate-300">Vai trò đăng ký *</label>
                      <span className="text-[10px] text-amber-300 font-bold flex items-center gap-1">
                        <ShieldCheck size={12} />
                        <span>Không có quyền tạo Admin</span>
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => setRegRole('student')}
                        className={`h-10 rounded-xl border text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                          regRole === 'student'
                            ? 'bg-blue-600/30 border-cyan-400 text-cyan-200 shadow-xs'
                            : 'bg-black/30 border-white/10 text-slate-400 hover:text-white'
                        }`}
                      >
                        <BookOpen size={14} className={regRole === 'student' ? 'text-cyan-400' : ''} />
                        <span>Học Sinh</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setRegRole('teacher')}
                        className={`h-10 rounded-xl border text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                          regRole === 'teacher'
                            ? 'bg-purple-600/30 border-purple-400 text-purple-200 shadow-xs'
                            : 'bg-black/30 border-white/10 text-slate-400 hover:text-white'
                        }`}
                      >
                        <GraduationCap size={14} className={regRole === 'teacher' ? 'text-purple-400' : ''} />
                        <span>Giáo Viên</span>
                      </button>
                    </div>

                    <p className="text-[10px] text-slate-400 italic">
                      * Tài khoản Quản trị viên chỉ do Quản trị hệ thống cấp phát.
                    </p>
                  </div>

                  {regError && (
                    <div className="p-3 rounded-2xl bg-rose-500/20 border border-rose-500/40 text-rose-200 text-xs font-semibold flex items-center gap-2">
                      <AlertCircle size={15} className="shrink-0 text-rose-400" />
                      <span>{regError}</span>
                    </div>
                  )}

                  {/* Mã ID tài khoản */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <label className="text-[11px] font-bold text-slate-300">
                        Mã ID tài khoản *
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          const prefix = regRole === 'teacher' ? 'gv' : 'hs';
                          setRegCustomId(`${prefix}_${Math.random().toString(36).slice(2, 8)}`);
                        }}
                        className="text-[10px] text-cyan-400 hover:underline font-semibold cursor-pointer"
                      >
                        Tạo mã nhanh
                      </button>
                    </div>
                    <div className="relative">
                      <Hash size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="text"
                        value={regCustomId}
                        onChange={(e) => setRegCustomId(e.target.value)}
                        placeholder={regRole === 'teacher' ? 'VD: gv_nam01' : 'VD: hs_my2026'}
                        className="w-full h-10 pl-10 pr-3 rounded-xl bg-black/40 border border-white/20 text-white placeholder-slate-500 text-xs font-mono focus:border-cyan-400 focus:outline-none"
                      />
                    </div>
                  </div>

                  {/* Họ tên */}
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-300">
                      Họ và tên {regRole === 'teacher' ? 'giáo viên' : 'học sinh'} *
                    </label>
                    <div className="relative">
                      <User size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="text"
                        value={regName}
                        onChange={(e) => setRegName(e.target.value)}
                        placeholder={regRole === 'teacher' ? 'VD: ThS. Hoàng Văn Nam' : 'VD: Trần Thảo My'}
                        className="w-full h-10 pl-10 pr-3 rounded-xl bg-black/40 border border-white/20 text-white placeholder-slate-500 text-xs focus:border-cyan-400 focus:outline-none"
                      />
                    </div>
                  </div>

                  {/* Email & Khối lớp / Bộ môn */}
                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                    <div className="sm:col-span-8 space-y-1">
                      <label className="text-[11px] font-bold text-slate-300">
                        Email {regRole === 'teacher' ? 'giáo viên' : 'học sinh'} *
                      </label>
                      <input
                        type="email"
                        value={regEmail}
                        onChange={(e) => setRegEmail(e.target.value)}
                        placeholder="email@thpt-nbk.edu.vn"
                        className="w-full h-10 px-3 rounded-xl bg-black/40 border border-white/20 text-white placeholder-slate-500 text-xs focus:border-cyan-400 focus:outline-none"
                      />
                    </div>

                    <div className="sm:col-span-4 space-y-1">
                      <label className="text-[11px] font-bold text-slate-300">
                        {regRole === 'teacher' ? 'Bộ môn' : 'Khối lớp'}
                      </label>
                      {regRole === 'teacher' ? (
                        <div className="w-full h-10 px-2 rounded-xl bg-slate-900 border border-white/20 text-purple-300 text-xs font-bold flex items-center justify-center">
                          Toán THPT
                        </div>
                      ) : (
                        <select
                          value={regGrade}
                          onChange={(e) => setRegGrade(Number(e.target.value) as 10 | 11 | 12)}
                          className="w-full h-10 px-2 rounded-xl bg-slate-900 border border-white/20 text-white text-xs font-bold focus:border-cyan-400 focus:outline-none"
                        >
                          <option value={12}>Khối 12</option>
                          <option value={11}>Khối 11</option>
                          <option value={10}>Khối 10</option>
                        </select>
                      )}
                    </div>
                  </div>

                  {/* Trường học */}
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-300">Trường THPT</label>
                    <div className="relative">
                      <School size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="text"
                        value={regSchool}
                        onChange={(e) => setRegSchool(e.target.value)}
                        placeholder="Tên trường THPT..."
                        className="w-full h-10 pl-10 pr-3 rounded-xl bg-black/40 border border-white/20 text-white placeholder-slate-500 text-xs focus:border-cyan-400 focus:outline-none"
                      />
                    </div>
                  </div>

                  {/* Mật khẩu & Xác nhận (Tối thiểu 8 ký tự) */}
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-slate-300">Mật khẩu (≥ 8 ký tự) *</label>
                      <input
                        type="password"
                        value={regPassword}
                        onChange={(e) => setRegPassword(e.target.value)}
                        placeholder="Tối thiểu 8 ký tự"
                        className="w-full h-10 px-3 rounded-xl bg-black/40 border border-white/20 text-white placeholder-slate-500 text-xs focus:border-cyan-400 focus:outline-none"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-slate-300">Nhập lại MK *</label>
                      <input
                        type="password"
                        value={regConfirmPassword}
                        onChange={(e) => setRegConfirmPassword(e.target.value)}
                        placeholder="Nhập lại mật khẩu..."
                        className="w-full h-10 px-3 rounded-xl bg-black/40 border border-white/20 text-white placeholder-slate-500 text-xs focus:border-cyan-400 focus:outline-none"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="w-full h-11 mt-2 rounded-2xl bg-gradient-to-r from-blue-600 via-indigo-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white font-extrabold text-xs shadow-lg shadow-blue-500/25 flex items-center justify-center gap-2 transition-all cursor-pointer"
                  >
                    <ShieldCheck size={16} />
                    <span>Gửi Yêu Cầu Đăng Ký Đến Admin</span>
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* MODAL: QUÊN MẬT KHẨU */}
      {showForgotModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 border border-white/20 max-w-md w-full rounded-3xl p-6 space-y-4 shadow-2xl relative text-slate-100">
            <button
              onClick={() => {
                setShowForgotModal(false);
                setForgotSubmitted(false);
              }}
              className="absolute top-4 right-4 p-1.5 rounded-full text-slate-400 hover:text-white hover:bg-white/10"
            >
              <X size={18} />
            </button>

            <div className="w-12 h-12 rounded-2xl bg-blue-500/20 text-cyan-400 flex items-center justify-center">
              <HelpCircle size={24} />
            </div>

            <div>
              <h3 className="text-lg font-black text-white">Khôi Phục Mật Khẩu</h3>
              <p className="text-xs text-slate-400 mt-1">
                Nhập Email tài khoản hoặc mã ID của bạn để nhận mã xác thực đặt lại mật khẩu.
              </p>
            </div>

            {forgotSubmitted ? (
              <div className="p-4 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-200 text-xs space-y-2">
                <div className="font-extrabold flex items-center gap-1.5">
                  <CheckCircle2 size={16} />
                  <span>Đã gửi hướng dẫn khôi phục!</span>
                </div>
                <p className="text-[11px] text-emerald-300">
                  Hệ thống đã gửi liên kết đặt lại mật khẩu đến <strong>{forgotEmail}</strong>. Bạn cũng có thể liên hệ Giáo viên bộ môn hoặc Quản trị viên để đặt lại mật khẩu trực tiếp.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setShowForgotModal(false);
                    setForgotSubmitted(false);
                  }}
                  className="w-full mt-2 py-2 rounded-xl bg-emerald-600 text-white font-bold text-xs"
                >
                  Đóng & Quay lại Đăng Nhập
                </button>
              </div>
            ) : (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (forgotEmail.trim()) {
                    setForgotSubmitted(true);
                  }
                }}
                className="space-y-3"
              >
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-300">Email hoặc ID tài khoản</label>
                  <input
                    type="text"
                    required
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    placeholder="VD: an.nguyen@thpt-nbk.edu.vn"
                    className="w-full h-11 px-3 rounded-2xl bg-black/40 border border-white/20 text-white text-xs focus:border-cyan-400 focus:outline-none"
                  />
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowForgotModal(false)}
                    className="flex-1 py-2.5 rounded-xl border border-white/20 text-slate-300 font-bold text-xs hover:bg-white/5"
                  >
                    Hủy
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md"
                  >
                    Gửi Yêu Cầu
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* MODAL: THÔNG BÁO KẾT QUẢ ĐĂNG KÝ (DUYỆT TỰ ĐỘNG HOẶC CHỜ DUYỆT) */}
      {pendingModalUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in">
          <div className="bg-slate-900 border border-cyan-500/40 max-w-md w-full rounded-3xl p-6 space-y-4 shadow-2xl relative text-slate-100 animate-in zoom-in-95">
            {pendingModalUser.status === 'active' ? (
              <>
                <div className="w-14 h-14 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
                  <CheckCircle2 size={32} />
                </div>

                <div>
                  <span className="text-[10px] font-black uppercase tracking-wider text-emerald-400 flex items-center gap-1">
                    <Zap size={12} className="fill-current" />
                    <span>Duyệt Tự Động Thành Công</span>
                  </span>
                  <h3 className="text-xl font-black text-white mt-1">Tài Khoản Đã Kích Hoạt!</h3>
                  <p className="text-xs text-slate-300 mt-2 leading-relaxed">
                    Chúc mừng <strong className="text-white">{pendingModalUser.name}</strong>! Hệ thống Duyệt Tự Động của Admin đã kích hoạt ngay lập tức tài khoản ({pendingModalUser.role === 'teacher' ? 'Giáo viên THPT' : 'Học sinh THPT'}) của bạn.
                  </p>
                </div>

                <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-200 text-xs space-y-1">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-slate-400">Mã ID tài khoản:</span>
                    <span className="font-mono font-bold text-white">{pendingModalUser.id}</span>
                  </div>
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-slate-400">Email đăng nhập:</span>
                    <span className="font-mono font-bold text-cyan-300">{pendingModalUser.email}</span>
                  </div>
                </div>

                <div className="flex flex-col gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      onLoginSuccess(pendingModalUser, rememberMe);
                      setPendingModalUser(null);
                    }}
                    className="w-full py-3 rounded-2xl bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 text-white font-extrabold text-xs shadow-lg shadow-emerald-500/30 transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Zap size={16} className="fill-current" />
                    <span>Vào Học / Giảng Dạy Ngay</span>
                    <ArrowRight size={16} />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const userEmail = pendingModalUser.email;
                      setPendingModalUser(null);
                      setAuthMode('login');
                      setLoginIdentifier(userEmail);
                      setLoginPassword('');
                    }}
                    className="w-full py-2.5 rounded-2xl bg-white/5 hover:bg-white/10 text-slate-300 font-bold text-xs transition-colors"
                  >
                    Quay Lại Màn Hình Đăng Nhập
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="w-14 h-14 rounded-2xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center border border-cyan-500/30">
                  <ShieldCheck size={32} />
                </div>

                <div>
                  <span className="text-[10px] font-black uppercase tracking-wider text-cyan-400">
                    Gửi yêu cầu đăng ký thành công
                  </span>
                  <h3 className="text-xl font-black text-white mt-1">Đã Chuyển Đến Ban Quản Trị</h3>
                  <p className="text-xs text-slate-300 mt-2 leading-relaxed">
                    Yêu cầu cấp tài khoản cho <strong className="text-white">{pendingModalUser.name}</strong> (
                    {pendingModalUser.role === 'teacher' ? 'Giáo viên THPT' : 'Học sinh THPT'}) với email{' '}
                    <span className="font-mono text-cyan-300">{pendingModalUser.email}</span> đã được ghi nhận trên hệ thống.
                  </p>
                </div>

                <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs space-y-1">
                  <div className="font-bold flex items-center gap-1.5 text-amber-300">
                    <AlertCircle size={15} />
                    <span>Lưu ý bảo mật:</span>
                  </div>
                  <p className="text-[11px] text-slate-300">
                    Người dùng không có quyền tự kích hoạt hay tự tạo Admin. Quản Trị Viên (Admin) sẽ đối chiếu thông tin và phê duyệt tài khoản. Bạn sẽ có thể đăng nhập ngay sau khi được Admin duyệt!
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    const userEmail = pendingModalUser.email;
                    setPendingModalUser(null);
                    setAuthMode('login');
                    setLoginIdentifier(userEmail);
                    setLoginPassword('');
                    setRegPendingNotice(
                      `Yêu cầu tạo tài khoản cho "${userEmail}" đang chờ Admin duyệt. Bạn sẽ đăng nhập được ngay sau khi Ban Quản Trị phê duyệt.`
                    );
                  }}
                  className="w-full py-3 rounded-2xl bg-gradient-to-r from-blue-600 via-indigo-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white font-extrabold text-xs shadow-lg shadow-cyan-600/30 transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <span>Tôi Đã Hiểu - Quay Lại Đăng Nhập</span>
                  <ArrowRight size={16} />
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="relative z-10 max-w-7xl w-full mx-auto px-6 py-4 border-t border-white/10 text-center text-xs text-slate-400 flex flex-col sm:flex-row items-center justify-between gap-2">
        <p>© 2026 Math&NBK Education Platform. Chuẩn chương trình giáo dục phổ thông mới.</p>
        <p className="text-slate-400">Hỗ trợ: cskh@thpt-nbk.edu.vn · Hotline: 024 3858 1234</p>
      </footer>
    </div>
  );
};
