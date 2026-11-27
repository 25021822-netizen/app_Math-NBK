import React, { useState } from 'react';
import {
  BookOpen,
  Download,
  FileText,
  GraduationCap,
  ShieldCheck,
  User,
  X,
  Compass,
  Atom,
  FlaskConical,
  FileCheck,
  Users,
  BarChart3,
  HelpCircle,
  NotebookPen,
} from 'lucide-react';
import { UserRole } from '../../types/math';

interface UserGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultRole?: UserRole;
}

type GuideTab = 'overview' | 'student' | 'teacher' | 'admin';

const GUIDE_MARKDOWN = `# Giới Thiệu & Hướng Dẫn Sử Dụng Nền Tảng Toán Học LIKI

**Toán Học LIKI** là hệ thống học tập, giảng dạy, luyện thi và thực hành mô phỏng trực tuyến dành cho bậc **Trung học phổ thông (Lớp 10, 11, 12)** theo định hướng chương trình **GDPT 2018**, tích hợp đầy đủ 3 môn **Toán Học · Vật Lý · Hóa Học**.

---

## 1. Giới Thiệu Tổng Quan Các Tính Năng Chính

- **Nhóm Lớp Trực Tuyến:** Quản lý danh sách học sinh, đăng bài giảng lý thuyết & bài tập PDF, thảo luận theo thời gian thực, nhắc tên (@tên, @Cả Lớp) và thông báo đẩy tức thời khi có bài mới.
- **Hệ Thống Thi Trực Tuyến Chuẩn 3 Phần BGD:**
  - Phần I: Trắc nghiệm nhiều phương án lựa chọn (4 chọn 1).
  - Phần II: Trắc nghiệm Đúng / Sai (4 ý a, b, c, d chấm theo thang điểm bậc chuẩn).
  - Phần III: Câu hỏi trả lời ngắn.
  - Hỗ trợ tự động lưu bài làm nháp, đánh dấu câu hỏi xem lại, giám sát toàn màn hình & chống chuyển tab.
- **Biên Soạn Đề Thi Đa Phương Thức (Dành Cho Giáo Viên):**
  - Tự tạo đề thủ công với trình soạn công thức LaTeX / KaTeX.
  - Nhập từ file **PDF, Word (.docx/.doc), ảnh hoặc mã nguồn LaTeX**.
  - **Phòng Cắt Câu Đề Thi:** Khoanh vùng cắt từng câu hỏi/đáp án từ đề thi gốc hoặc cắt tự động toàn đề.
  - Tùy chỉnh linh hoạt: thời gian mở/đóng đề, số lượt làm bài, bật/tắt giám sát màn hình, chế độ hiển thị điểm & đáp án, thang điểm tùy chọn theo từng đề.
- **Tổng Hợp Điểm Thi & Xuất Báo Cáo:**
  - Tự động thống kê điểm theo đúng thang điểm thực tế của từng đề (thang 10, thang 40 hoặc thang điểm tùy chỉnh).
  - Bảng thống kê chi tiết **số học sinh làm đúng / làm sai cho từng câu hỏi**.
  - Xuất báo cáo hàng loạt hoặc từng học sinh ra **PDF, In A4, Excel (.xlsx), Word (.docx)** kèm tổng thời gian làm bài và đáp án từng câu đã chọn của mỗi thí sinh.
- **Phòng Vẽ Hình 2D / 3D & Đồ Thị Hàm Số:** Dựng hình phẳng 2D, bảng biến thiên, đồ thị hàm số, hình không gian 3D & hệ trục Oxyz.
- **Phòng Mô Phỏng Vật Lý:** Cơ học, dao động điều hòa, ném xiên, sóng cơ & giao thoa, quang học & lượng tử, điện học & mạch RLC, nhiệt học khí lý tưởng và hạt nhân.
- **Phòng Thí Nghiệm Hóa Học & Phân Tử 3D:** Pin Galvani với điện cực tan, tinh chế kim loại & mạ điện, mô hình sản xuất công nghiệp (Al2O3, H2SO4, NH3, HNO3, Xút-Clo, gang thép), điều chế Ester, chuẩn độ pH, cân bằng phương trình và chế độ **phân tử 3D tương tác xoay 360°**.

---

## 2. Hướng Dẫn Dành Cho Học Sinh

1. **Tham gia nhóm lớp:** Vào mục **Nhóm Lớp**, nhập **Mã lớp** do thầy cô cung cấp và nhấn **Tham Gia**.
2. **Xem bài giảng & Thảo luận:** Mở tab **Bài Giảng & Tài Liệu** để xem/tải PDF lý thuyết & bài tập; mở tab **Thảo Luận Lớp** để trao đổi bài tập với thầy cô và bạn bè.
3. **Làm bài thi:** Vào tab **Đề Thi Đã Giao** → nhấn **Vào Làm Bài**. Hệ thống tự động lưu đáp án nháp mỗi 10 giây; bật toàn màn hình nếu đề có yêu cầu giám sát.
4. **Xem lại bài đã làm:** Vào mục **Bài Đã Làm** để xem điểm, thời gian làm bài, đáp án chi tiết từng câu hoặc làm lại (nếu còn lượt).
5. **Thực hành 3 môn:** Sử dụng đầy đủ **Vẽ Hình 2D/3D**, **Vật Lý** và **Hóa Học** (có chế độ 3D xoay quan sát phân tử).
6. **Trên điện thoại:** Nhấn vào **nút 3 gạch (Menu)** ở góc trên bên phải để mở danh sách chuyển trang.

---

## 3. Hướng Dẫn Dành Cho Giáo Viên

1. **Quản lý lớp & đăng bài:** Vào **Quản Lý Nhóm Lớp** → **Tạo Lớp Học Mới**, chia sẻ Mã lớp hoặc thêm trực tiếp học sinh, sau đó đăng bài giảng và bài tập PDF.
2. **Tạo đề thi (3 cách):**
   - Tự tạo đề thủ công (nhập công thức toán, đặt thang điểm riêng từng câu).
   - Nhập file đề PDF / Word / mã LaTeX có sẵn.
   - **Phòng Cắt Câu Đề Thi:** Khoanh vùng cắt trực tiếp câu hỏi từ PDF/Word hoặc cắt tự động toàn đề.
3. **Cấu hình & giao đề:** Chọn lớp nhận đề, thời gian mở/đóng đề, số lượt làm bài, chế độ xem điểm và giám sát màn hình. Quản lý lại bất kỳ lúc nào tại **Kho Đề Thi**.
4. **Thống kê & xuất báo cáo:** Vào **Tổng Hợp Điểm Thi** để xem phổ điểm theo đúng thang điểm của đề, thống kê số bạn đúng/sai từng câu và xuất **PDF / Excel / Word** (kèm tổng thời gian làm bài & đáp án từng câu của từng thí sinh).

---

## 4. Hướng Dẫn Dành Cho Quản Trị Viên (Admin)

1. **Tab Tài Khoản:** Xem danh sách người dùng, cấp tài khoản mới, đổi mật khẩu hoặc xóa tài khoản.
2. **Tab Chờ Duyệt:** Phê duyệt / từ chối yêu cầu đăng ký mới và bật/tắt chế độ tự động phê duyệt theo vai trò.
3. **Tab Nhật Ký Thi:** Theo dõi lịch sử vi phạm quy chế thi trên toàn hệ thống.
4. **Thông Báo Chung:** Gửi tin nhắn thông báo đến tất cả mọi người, chỉ Giáo viên hoặc chỉ Học sinh; theo dõi và thu hồi thông báo đã phát.
`;

export const UserGuideModal: React.FC<UserGuideModalProps> = ({
  isOpen,
  onClose,
  defaultRole = 'student',
}) => {
  const initialTab: GuideTab =
    defaultRole === 'admin'
      ? 'admin'
      : defaultRole === 'teacher'
      ? 'teacher'
      : 'overview';

  const [activeTab, setActiveTab] = useState<GuideTab>(initialTab);

  if (!isOpen) return null;

  const triggerDownload = (filename: string, content: string, mimeType: string) => {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const handleDownloadMarkdown = async () => {
    try {
      const res = await fetch('/huong-dan-su-dung.md');
      if (res.ok) {
        const text = await res.text();
        triggerDownload('huong-dan-su-dung-toan-hoc-liki.md', text, 'text/markdown;charset=utf-8');
        return;
      }
    } catch {
      // Fallback to embedded guide content
    }
    triggerDownload('huong-dan-su-dung-toan-hoc-liki.md', GUIDE_MARKDOWN, 'text/markdown;charset=utf-8');
  };

  const handleDownloadWord = () => {
    const htmlContent = `<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
<head>
<meta charset="utf-8" />
<title>Giới Thiệu & Hướng Dẫn Sử Dụng Toán Học LIKI</title>
<style>
  body { font-family: "Times New Roman", Arial, sans-serif; line-height: 1.55; color: #1e293b; padding: 24px; }
  h1 { color: #1d4ed8; border-bottom: 2px solid #bfdbfe; padding-bottom: 8px; font-size: 22pt; }
  h2 { color: #0f172a; margin-top: 20px; font-size: 15pt; }
  h3 { color: #1e40af; margin-top: 14px; font-size: 12.5pt; }
  p, li { font-size: 11.5pt; }
  ul, ol { margin-left: 20px; }
  .box { background: #eff6ff; border-left: 4px solid #2563eb; padding: 10px 14px; margin: 12px 0; }
</style>
</head>
<body>
  <h1>GIỚI THIỆU &amp; HƯỚNG DẪN SỬ DỤNG NỀN TẢNG TOÁN HỌC LIKI</h1>
  <p><strong>Toán Học LIKI</strong> là nền tảng học tập, giảng dạy, luyện thi và thực hành mô phỏng trực tuyến dành cho học sinh và giáo viên THPT (Lớp 10, 11, 12) theo chương trình GDPT 2018, tích hợp 3 môn <strong>Toán Học · Vật Lý · Hóa Học</strong>.</p>

  <h2>1. Tổng Quan Tính Năng Nổi Bật</h2>
  <ul>
    <li><strong>Nhóm Lớp Trực Tuyến:</strong> Quản lý thành viên, đăng bài giảng &amp; bài tập PDF, chat thời gian thực, nhắc tên (@tên, @Cả Lớp) và thông báo đẩy tức thời.</li>
    <li><strong>Thi Trực Tuyến Chuẩn 3 Phần BGD:</strong> Trắc nghiệm 4 chọn 1, Đúng/Sai 4 ý, Trả lời ngắn; tự lưu bài nháp mỗi 10 giây và giám sát toàn màn hình.</li>
    <li><strong>Tạo Đề Thi Đa Phương Thức:</strong> Soạn thủ công với công thức toán, nhập từ file PDF/Word/LaTeX, hoặc dùng Phòng Cắt Câu Đề Thi trực tiếp.</li>
    <li><strong>Thống Kê &amp; Xuất Báo Cáo:</strong> Chấm và thống kê theo đúng thang điểm riêng của từng đề, thống kê số bạn đúng/sai từng câu hỏi, xuất PDF/Word/Excel kèm tổng thời gian làm bài và đáp án từng câu của mỗi thí sinh.</li>
    <li><strong>Thực Hành Trực Quan 3 Môn:</strong> Vẽ hình 2D/3D &amp; Oxyz, Mô phỏng Vật Lý, Thí nghiệm Hóa Học &amp; mô hình phản ứng phân tử 3D xoay 360°.</li>
  </ul>

  <h2>2. Hướng Dẫn Dành Cho Học Sinh</h2>
  <ol>
    <li><strong>Tham gia lớp:</strong> Vào mục <em>Nhóm Lớp</em> → nhập <em>Mã lớp</em> do thầy cô cung cấp → nhấn <em>Tham Gia</em>.</li>
    <li><strong>Học &amp; Thảo luận:</strong> Mở tab <em>Bài Giảng &amp; Tài Liệu</em> để xem/tải PDF lý thuyết &amp; bài tập; dùng tab <em>Thảo Luận Lớp</em> để hỏi bài.</li>
    <li><strong>Làm bài thi:</strong> Vào tab <em>Đề Thi Đã Giao</em> → nhấn <em>Vào Làm Bài</em> → chọn đáp án và nhấn <em>Nộp Bài Thi</em> khi hoàn thành.</li>
    <li><strong>Xem lại kết quả:</strong> Vào mục <em>Bài Đã Làm</em> để xem điểm, thời gian làm, đáp án chi tiết từng câu hoặc làm lại nếu còn lượt.</li>
    <li><strong>Thực hành 2D/3D &amp; Thí nghiệm:</strong> Truy cập đầy đủ cả 3 phòng <em>Vẽ Hình 2D/3D</em>, <em>Vật Lý</em> và <em>Hóa Học</em>.</li>
    <li><strong>Trên điện thoại:</strong> Nhấn vào nút <strong>3 gạch (Menu)</strong> ở góc trên bên phải để chuyển nhanh giữa các trang.</li>
  </ol>

  <h2>3. Hướng Dẫn Dành Cho Giáo Viên</h2>
  <ol>
    <li><strong>Quản lý lớp:</strong> Tạo lớp học, chia sẻ mã lớp hoặc thêm trực tiếp học sinh, đăng bài giảng và tài liệu PDF.</li>
    <li><strong>Tạo &amp; giao đề thi:</strong> Chọn tạo thủ công, nhập file PDF/Word/LaTeX hoặc cắt câu hỏi trực tiếp từ đề gốc; tùy chỉnh thang điểm, thời gian mở/đóng đề, số lượt làm và giám sát màn hình.</li>
    <li><strong>Tổng hợp điểm &amp; Xuất báo cáo:</strong> Vào <em>Tổng Hợp Điểm Thi</em> để xem phổ điểm theo đúng thang điểm của đề, thống kê đúng/sai từng câu và xuất báo cáo PDF / Word / Excel.</li>
  </ol>

  <h2>4. Hướng Dẫn Dành Cho Quản Trị Viên</h2>
  <ul>
    <li><strong>Tab Tài Khoản:</strong> Tạo mới, xem/đổi mật khẩu, phân quyền và quản lý toàn bộ tài khoản.</li>
    <li><strong>Tab Chờ Duyệt:</strong> Phê duyệt hoặc từ chối tài khoản mới, bật/tắt phê duyệt tự động theo vai trò.</li>
    <li><strong>Tab Nhật Ký Thi:</strong> Theo dõi toàn bộ nhật ký cảnh báo vi phạm quy chế thi.</li>
    <li><strong>Thông Báo Chung:</strong> Gửi thông báo tới tất cả mọi người, chỉ Giáo viên hoặc chỉ Học sinh, hiển thị trực tiếp tại Nhóm Lớp và cho phép thu hồi toàn hệ thống.</li>
  </ul>
</body>
</html>`;
    triggerDownload(
      'huong-dan-su-dung-toan-hoc-liki.doc',
      '\ufeff' + htmlContent,
      'application/msword;charset=utf-8'
    );
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 animate-in fade-in"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="bg-blue-800 bg-gradient-to-r from-blue-800 via-indigo-700 to-blue-900 text-white px-5 py-4 sm:px-6 sm:py-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/15 border border-white/25 flex items-center justify-center shrink-0">
              <BookOpen size={20} />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black leading-tight">
                Giới Thiệu &amp; Hướng Dẫn Sử Dụng
              </h2>
              <p className="text-xs text-blue-100 mt-0.5">
                Nền tảng học, thi &amp; mô phỏng Toán · Vật Lý · Hóa Học THPT
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-center">
            <button
              type="button"
              onClick={handleDownloadWord}
              className="px-3 py-1.5 rounded-xl bg-white text-blue-800 hover:bg-blue-50 font-bold text-xs flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
            >
              <Download size={14} />
              <span>Tải File Word</span>
            </button>
            <button
              type="button"
              onClick={handleDownloadMarkdown}
              className="px-3 py-1.5 rounded-xl bg-white/15 hover:bg-white/25 text-white border border-white/25 font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <FileText size={14} />
              <span>Tải (.md)</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Đóng hướng dẫn"
              className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="px-4 sm:px-6 pt-3 pb-2 border-b border-slate-200 bg-slate-50 flex items-center gap-2 overflow-x-auto shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('overview')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 whitespace-nowrap transition-colors cursor-pointer ${
              activeTab === 'overview'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
            }`}
          >
            <HelpCircle size={14} />
            <span>Tổng Quan</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('student')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 whitespace-nowrap transition-colors cursor-pointer ${
              activeTab === 'student'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
            }`}
          >
            <User size={14} />
            <span>Dành Cho Học Sinh</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('teacher')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 whitespace-nowrap transition-colors cursor-pointer ${
              activeTab === 'teacher'
                ? 'bg-purple-600 text-white shadow-xs'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
            }`}
          >
            <GraduationCap size={14} />
            <span>Dành Cho Giáo Viên</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('admin')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 whitespace-nowrap transition-colors cursor-pointer ${
              activeTab === 'admin'
                ? 'bg-rose-600 text-white shadow-xs'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
            }`}
          >
            <ShieldCheck size={14} />
            <span>Quản Trị Viên</span>
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-5 text-slate-700 text-xs sm:text-sm leading-relaxed flex-1">
          {activeTab === 'overview' && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-blue-50 border border-blue-200 text-blue-950">
                <p className="font-semibold">
                  <strong>Toán Học LIKI</strong> là hệ thống học tập, giảng dạy, luyện thi và thực hành mô phỏng trực tuyến dành cho bậc <strong>THPT (Lớp 10, 11, 12)</strong> theo chuẩn chương trình <strong>GDPT 2018</strong>.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                <div className="p-4 rounded-2xl border border-slate-200 bg-white space-y-1.5">
                  <div className="flex items-center gap-2 font-extrabold text-slate-900">
                    <Users size={16} className="text-blue-600" />
                    <span>Nhóm Lớp &amp; Thảo Luận</span>
                  </div>
                  <p className="text-xs text-slate-600">
                    Quản lý thành viên, đăng bài giảng &amp; bài tập PDF, chat thời gian thực, tag tên (@tên, @Cả Lớp) và chuông báo bài mới.
                  </p>
                </div>

                <div className="p-4 rounded-2xl border border-slate-200 bg-white space-y-1.5">
                  <div className="flex items-center gap-2 font-extrabold text-slate-900">
                    <FileCheck size={16} className="text-emerald-600" />
                    <span>Thi Trực Tuyến Chuẩn 3 Phần</span>
                  </div>
                  <p className="text-xs text-slate-600">
                    Hỗ trợ Trắc nghiệm 4 chọn 1, Đúng/Sai 4 ý và Trả lời ngắn; tự động lưu bài nháp mỗi 10 giây và chống gian lận toàn màn hình.
                  </p>
                </div>

                <div className="p-4 rounded-2xl border border-slate-200 bg-white space-y-1.5">
                  <div className="flex items-center gap-2 font-extrabold text-slate-900">
                    <BarChart3 size={16} className="text-amber-600" />
                    <span>Thống Kê &amp; Xuất Báo Cáo</span>
                  </div>
                  <p className="text-xs text-slate-600">
                    Thống kê đúng theo thang điểm riêng của từng đề, đếm số bạn đúng/sai từng câu, xuất PDF/Word/Excel kèm thời gian làm và đáp án từng câu.
                  </p>
                </div>

                <div className="p-4 rounded-2xl border border-slate-200 bg-white space-y-1.5">
                  <div className="flex items-center gap-2 font-extrabold text-slate-900">
                    <Compass size={16} className="text-cyan-600" />
                    <span>Vẽ Hình 2D / 3D &amp; Oxyz</span>
                  </div>
                  <p className="text-xs text-slate-600">
                    Vẽ hình phẳng 2D, bảng biến thiên, đồ thị hàm số, dựng hình không gian 3D &amp; xuất ảnh chèn trực tiếp vào đề thi.
                  </p>
                </div>

                <div className="p-4 rounded-2xl border border-slate-200 bg-white space-y-1.5">
                  <div className="flex items-center gap-2 font-extrabold text-slate-900">
                    <Atom size={16} className="text-sky-600" />
                    <span>Vật Lý</span>
                  </div>
                  <p className="text-xs text-slate-600">
                    Cơ học, dao động điều hòa, ném xiên, sóng cơ, giao thoa, quang học, mạch RLC, khí lý tưởng và hạt nhân.
                  </p>
                </div>

                <div className="p-4 rounded-2xl border border-slate-200 bg-white space-y-1.5">
                  <div className="flex items-center gap-2 font-extrabold text-slate-900">
                    <FlaskConical size={16} className="text-emerald-600" />
                    <span>Hóa Học</span>
                  </div>
                  <p className="text-xs text-slate-600">
                    Pin Galvani điện cực tan, tinh chế kim loại, sản xuất công nghiệp (nhôm, H₂SO₄, NH₃...), điều chế Ester, chuẩn độ pH và quan sát phân tử 3D xoay 360°.
                  </p>
                </div>

                <div className="p-4 rounded-2xl border border-slate-200 bg-white space-y-1.5 md:col-span-2">
                  <div className="flex items-center gap-2 font-extrabold text-slate-900">
                    <NotebookPen size={16} className="text-blue-600" />
                    <span>Bảng Vẽ &amp; Ghi Chú Viết Tay</span>
                  </div>
                  <p className="text-xs text-slate-600">
                    Sổ tay viết vẽ tự do nhiều trang hỗ trợ bút mực cảm ứng lực, dạ quang, tẩy theo nét, kẻ trục Oxy, chèn ảnh đề bài, đèn chiếu laser và xuất PNG / PDF.
                  </p>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-xs text-slate-600 space-y-1">
                <p className="font-bold text-slate-900">Mẹo sử dụng trên điện thoại:</p>
                <p>
                  Thanh điều hướng trên điện thoại được thu gọn vào <strong>nút 3 gạch (Menu)</strong> ở góc trên bên phải màn hình. Nhấn vào nút này để chuyển nhanh sang các trang chức năng.
                </p>
              </div>
            </div>
          )}

          {activeTab === 'student' && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl border border-emerald-200 bg-emerald-50/70 space-y-2">
                <h3 className="font-black text-emerald-950 text-sm">1. Tham gia nhóm lớp &amp; xem tài liệu</h3>
                <ul className="list-disc pl-5 space-y-1 text-xs text-emerald-950">
                  <li>Vào mục <strong>Nhóm Lớp</strong>, nhập <strong>Mã lớp</strong> do thầy cô cung cấp và nhấn <strong>Tham Gia</strong>.</li>
                  <li>Trong tab <strong>Bài Giảng &amp; Tài Liệu</strong>, bạn có thể xem trước hoặc tải file PDF bài giảng và bài tập về máy.</li>
                  <li>Trong tab <strong>Thảo Luận Lớp</strong>, nhắn tin hỏi bài, gửi ảnh hoặc dùng <code>@tên</code> để nhắc bạn bè/thầy cô.</li>
                </ul>
              </div>

              <div className="p-4 rounded-2xl border border-slate-200 bg-white space-y-2">
                <h3 className="font-black text-slate-900 text-sm">2. Làm bài thi &amp; xem lại kết quả</h3>
                <ul className="list-disc pl-5 space-y-1 text-xs text-slate-600">
                  <li>Vào tab <strong>Đề Thi Đã Giao</strong> trong lớp học và nhấn <strong>Vào Làm Bài</strong>.</li>
                  <li>Hệ thống tự lưu nháp mỗi 10 giây; bạn có thể gắn cờ đánh dấu những câu cần kiểm tra lại ở bảng điều hướng câu hỏi.</li>
                  <li>Nếu đề bật giám sát màn hình, không thoát toàn màn hình hoặc chuyển sang tab khác quá số lần quy định.</li>
                  <li>Sau khi nộp bài, vào mục <strong>Bài Đã Làm</strong> để xem lại đáp án chi tiết, lời giải từng câu hoặc nhấn <strong>Làm Lại</strong> (nếu còn lượt).</li>
                </ul>
              </div>

              <div className="p-4 rounded-2xl border border-slate-200 bg-white space-y-2">
                <h3 className="font-black text-slate-900 text-sm">3. Thực hành phòng thí nghiệm &amp; hồ sơ</h3>
                <ul className="list-disc pl-5 space-y-1 text-xs text-slate-600">
                  <li>Học sinh được truy cập cả 3 phân hệ: <strong>Vẽ Hình 2D/3D</strong>, <strong>Vật Lý</strong> và <strong>Hóa Học</strong>.</li>
                  <li>Dùng mục <strong>Ghi Chú</strong> để viết nháp giải bài, vẽ hình, dán ảnh đề bài và lưu lại thành nhiều trang hoặc xuất ra file PDF.</li>
                  <li>Trong phòng Hóa học, chuyển sang chế độ <strong>3D Phân Tử</strong> để xoay và phóng to/thu nhỏ mô hình phản ứng hóa học.</li>
                  <li>Vào mục <strong>Hồ Sơ</strong> để chọn ảnh đại diện, cập nhật thông tin cá nhân và đổi mật khẩu tài khoản.</li>
                </ul>
              </div>
            </div>
          )}

          {activeTab === 'teacher' && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl border border-purple-200 bg-purple-50/70 space-y-2">
                <h3 className="font-black text-purple-950 text-sm">1. Quản lý lớp &amp; đăng bài học</h3>
                <ul className="list-disc pl-5 space-y-1 text-xs text-purple-950">
                  <li>Vào <strong>Quản Lý Nhóm Lớp</strong> → nhấn <strong>Tạo Lớp Học Mới</strong>, sau đó gửi Mã lớp cho học sinh hoặc thêm trực tiếp học sinh vào lớp.</li>
                  <li>Trong tab <strong>Bài Giảng</strong>, nhấn <strong>Đăng Bài Học Mới</strong> để đính kèm file PDF lý thuyết và bài tập cho cả lớp.</li>
                </ul>
              </div>

              <div className="p-4 rounded-2xl border border-slate-200 bg-white space-y-2">
                <h3 className="font-black text-slate-900 text-sm">2. Tạo đề thi &amp; cấu hình giao đề</h3>
                <ul className="list-disc pl-5 space-y-1 text-xs text-slate-600">
                  <li><strong>Tự Tạo Đề Thủ Công:</strong> Soạn từng câu hỏi Phần I, II, III và đặt thang điểm riêng cho mỗi câu.</li>
                  <li><strong>Nhập từ PDF / Word / LaTeX:</strong> Tải file đề có sẵn để hệ thống bóc tách thành câu hỏi tương tác.</li>
                  <li><strong>Phòng Cắt Câu Đề Thi:</strong> Khoanh vùng cắt trực tiếp từng câu hỏi từ file PDF/Word hoặc cắt tự động toàn đề.</li>
                  <li>Thiết lập thời gian mở/đóng đề, số lượt làm bài, chế độ hiển thị điểm và giám sát màn hình trước khi xuất bản; chỉnh sửa lại bất kỳ lúc nào trong <strong>Kho Đề Thi</strong>.</li>
                </ul>
              </div>

              <div className="p-4 rounded-2xl border border-slate-200 bg-white space-y-2">
                <h3 className="font-black text-slate-900 text-sm">3. Thống kê điểm &amp; xuất báo cáo</h3>
                <ul className="list-disc pl-5 space-y-1 text-xs text-slate-600">
                  <li>Vào <strong>Tổng Hợp Điểm Thi</strong> để xem bảng điểm, biểu đồ phân loại theo đúng thang điểm thực tế của từng đề.</li>
                  <li>Xem bảng <strong>Thống Kê Từng Câu Hỏi</strong> để biết chính xác số học sinh làm đúng và làm sai ở từng câu.</li>
                  <li>Xuất <strong>PDF / Excel / Word</strong> hàng loạt hoặc từng thí sinh (bao gồm tổng thời gian làm bài và bảng đáp án từng câu đã chọn).</li>
                </ul>
              </div>
            </div>
          )}

          {activeTab === 'admin' && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl border border-rose-200 bg-rose-50/70 space-y-2">
                <h3 className="font-black text-rose-950 text-sm">1. Trung tâm quản trị hệ thống</h3>
                <ul className="list-disc pl-5 space-y-1 text-xs text-rose-950">
                  <li><strong>Tab Tài Khoản:</strong> Xem danh sách giáo viên &amp; học sinh, cấp tài khoản mới, đổi mật khẩu hoặc xóa tài khoản.</li>
                  <li><strong>Tab Chờ Duyệt:</strong> Phê duyệt / từ chối các tài khoản đăng ký mới và bật/tắt chế độ tự động phê duyệt theo vai trò.</li>
                  <li><strong>Tab Nhật Ký Thi:</strong> Theo dõi toàn bộ lịch sử vi phạm quy chế thi (thoát toàn màn hình, rời tab) trên hệ thống.</li>
                </ul>
              </div>

              <div className="p-4 rounded-2xl border border-blue-200 bg-blue-50/60 space-y-2">
                <h3 className="font-black text-blue-950 text-sm">2. Thông báo chung hệ thống</h3>
                <ul className="list-disc pl-5 space-y-1 text-xs text-blue-950">
                  <li>Chọn đối tượng nhận cụ thể: <strong>Tất cả mọi người</strong>, <strong>Chỉ Giáo viên</strong> hoặc <strong>Chỉ Học sinh</strong>.</li>
                  <li>Thông báo hiển thị trực tiếp trong mục <strong>Nhóm Lớp</strong> của đúng nhóm người dùng được chọn; mỗi tài khoản có thể tự xóa hẳn khỏi hộp thư của mình hoặc Admin có thể thu hồi toàn hệ thống.</li>
                </ul>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
