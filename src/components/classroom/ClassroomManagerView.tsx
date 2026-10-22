import React, { useState, useRef } from 'react';
import { Classroom, ClassroomLesson, UserProfile, UserRole, Exam, ClassroomChatMessage, ChatMention } from '../../types/math';
import { SAMPLE_STUDENTS, SAMPLE_CLASSROOM_LESSONS } from '../../data/mockData';
import { MathView } from '../MathView';
import {
  Users,
  UserPlus,
  UserMinus,
  GraduationCap,
  Plus,
  BookOpen,
  Award,
  Search,
  CheckCircle2,
  AlertTriangle,
  X,
  FileCheck,
  ChevronRight,
  ShieldCheck,
  Hash,
  Flame,
  Zap,
  Copy,
  Check,
  BarChart3,
  MessageSquare,
  Image as ImageIcon,
  AtSign,
  Send,
  Eye,
  UserCheck,
  ShieldAlert,
  Sparkles,
  Paperclip,
  Download,
  BookMarked,
  Trash2,
  FolderPlus,
  Layers,
  ListChecks,
  FileText,
  ChevronDown,
  ChevronUp,
  CheckCircle,
  ExternalLink,
  BookCheck,
  Pencil,
  Edit3,
  Upload,
  Save,
  Smile,
  CheckCheck,
  ToggleLeft,
  ToggleRight,
  Heart,
  ThumbsUp,
  UserX,
  Bell,
  BellRing,
  Volume2,
  VolumeX,
  Minimize2,
  Maximize2,
  MessageCircle,
} from 'lucide-react';

interface ClassroomManagerViewProps {
  userRole: UserRole;
  currentUserId: string;
  currentUserName?: string;
  currentUserAvatar?: string;
  classrooms: Classroom[];
  onUpdateClassrooms: (updated: Classroom[]) => void;
  examsList: Exam[];
  onUpdateExamsList?: (exams: Exam[]) => void;
  onSelectExamToTake?: (examId: string) => void;
  onViewClassGradebook?: (classId: string) => void;
  allUsers?: UserProfile[];
  classroomMessages?: Record<string, ClassroomChatMessage[]>;
  onSendChatMessage?: (message: ClassroomChatMessage) => void;
  onQuickAddFriend?: (targetUserId: string) => void;
  friendIds?: string[];
  classroomLessons?: ClassroomLesson[];
  onUpdateLessons?: (updated: ClassroomLesson[]) => void;
}

export const ClassroomManagerView: React.FC<ClassroomManagerViewProps> = ({
  userRole,
  currentUserId,
  currentUserName = 'Nguyễn Văn An',
  currentUserAvatar,
  classrooms,
  onUpdateClassrooms,
  examsList,
  onUpdateExamsList,
  onSelectExamToTake,
  onViewClassGradebook,
  allUsers = SAMPLE_STUDENTS,
  classroomMessages = {},
  onSendChatMessage,
  onQuickAddFriend,
  friendIds = [],
  classroomLessons = SAMPLE_CLASSROOM_LESSONS,
  onUpdateLessons,
}) => {
  const [selectedClassId, setSelectedClassId] = useState<string>(classrooms[0]?.id || '');
  const [activeRightTab, setActiveRightTab] = useState<'curriculum' | 'chat' | 'students' | 'approvals'>('curriculum');
  const [approvalActionSuccess, setApprovalActionSuccess] = useState<string | null>(null);
  const [localLessons, setLocalLessons] = useState<ClassroomLesson[]>(classroomLessons || SAMPLE_CLASSROOM_LESSONS);
  const [showAddLessonModal, setShowAddLessonModal] = useState<boolean>(false);
  const [selectedLessonDetail, setSelectedLessonDetail] = useState<ClassroomLesson | null>(null);
  const [lessonActionSuccess, setLessonActionSuccess] = useState<string | null>(null);
  // Trạng thái thu gọn/mở rộng các chương học: Học sinh chỉ xem danh sách chương, ấn vào chương mới mở các bài học
  const [expandedChapters, setExpandedChapters] = useState<string[]>([]);

  const toggleChapter = (chapterTitle: string) => {
    setExpandedChapters((prev) =>
      prev.includes(chapterTitle) ? prev.filter((c) => c !== chapterTitle) : [...prev, chapterTitle]
    );
  };

  // Form thêm chương / bài học mới (Chương -> Bài học -> Ô Bài học & Ô Luyện tập)
  const [newLessonChapter, setNewLessonChapter] = useState('');
  const [newLessonTitle, setNewLessonTitle] = useState('');
  const [newLessonDesc, setNewLessonDesc] = useState('');
  const [newLessonTheory, setNewLessonTheory] = useState('');
  const [newLessonPractice, setNewLessonPractice] = useState('');
  const [newLessonExercisesCount, setNewLessonExercisesCount] = useState<number>(10);
  const [newLessonExternalLink, setNewLessonExternalLink] = useState('');
  const [newLessonPdfFile, setNewLessonPdfFile] = useState<{ fileName: string; fileSize: string; fileData: string } | null>(null);
  const [newLessonPracticePdfFile, setNewLessonPracticePdfFile] = useState<{ fileName: string; fileSize: string; fileData: string } | null>(null);
  const [newLessonAttachmentName, setNewLessonAttachmentName] = useState('');
  const [newLessonError, setNewLessonError] = useState<string | null>(null);

  // Form chỉnh sửa bài học đã đăng (Giáo viên)
  const [showEditLessonModal, setShowEditLessonModal] = useState<boolean>(false);
  const [editingLessonId, setEditingLessonId] = useState<string>('');
  const [editLessonChapter, setEditLessonChapter] = useState('');
  const [editLessonTitle, setEditLessonTitle] = useState('');
  const [editLessonDesc, setEditLessonDesc] = useState('');
  const [editLessonTheory, setEditLessonTheory] = useState('');
  const [editLessonPractice, setEditLessonPractice] = useState('');
  const [editLessonExercisesCount, setEditLessonExercisesCount] = useState<number>(10);
  const [editLessonExternalLink, setEditLessonExternalLink] = useState('');
  const [editLessonPdfFile, setEditLessonPdfFile] = useState<{ fileName: string; fileSize: string; fileData: string } | null>(null);
  const [editLessonPracticePdfFile, setEditLessonPracticePdfFile] = useState<{ fileName: string; fileSize: string; fileData: string } | null>(null);
  const [editLessonError, setEditLessonError] = useState<string | null>(null);

  // Tab chuyển đổi trong modal xem bài học: 'theory' (Ô Bài học) hoặc 'practice' (Ô Luyện tập)
  const [lessonDetailTab, setLessonDetailTab] = useState<'theory' | 'practice'>('theory');
  const lessonPdfInputRef = useRef<HTMLInputElement>(null);
  const practicePdfInputRef = useRef<HTMLInputElement>(null);
  const editLessonPdfInputRef = useRef<HTMLInputElement>(null);
  const editPracticePdfInputRef = useRef<HTMLInputElement>(null);

  const [showCreateClassModal, setShowCreateClassModal] = useState<boolean>(false);
  const [showAddStudentModal, setShowAddStudentModal] = useState<boolean>(false);
  const [studentToRemove, setStudentToRemove] = useState<{ id: string; name: string } | null>(null);
  const [examToRemoveFromClass, setExamToRemoveFromClass] = useState<Exam | null>(null);
  const [examActionSuccess, setExamActionSuccess] = useState<string | null>(null);
  const [hasCopiedCode, setHasCopiedCode] = useState<boolean>(false);

  // State tạo lớp mới
  const [newClassName, setNewClassName] = useState('');
  const [newClassGrade, setNewClassGrade] = useState<10 | 11 | 12>(12);
  const [newClassCode, setNewClassCode] = useState('');
  const [newClassDesc, setNewClassDesc] = useState('');

  // State thêm học sinh vào lớp (Admin-only rule for account creation)
  const [searchStudentTerm, setSearchStudentTerm] = useState('');
  const [selectedStudentToAdd, setSelectedStudentToAdd] = useState<string>('');
  const [manualStudentIdLookup, setManualStudentIdLookup] = useState('');
  const [studentLookupError, setStudentLookupError] = useState<string | null>(null);

  // State học sinh tham gia lớp bằng mã
  const [joinCodeInput, setJoinCodeInput] = useState('');
  const [joinMessage, setJoinMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // ==========================================
  // STATE CHO CHAT NHÓM LỚP (GỬI ẢNH, TAG TÊN, EMOJI, REACTIONS)
  // ==========================================
  const [chatMessageText, setChatMessageText] = useState('');
  const [attachedImage, setAttachedImage] = useState<string | null>(null);
  const [showMentionPicker, setShowMentionPicker] = useState<boolean>(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState<boolean>(false);
  const [emojiCategory, setEmojiCategory] = useState<'popular' | 'faces' | 'math' | 'symbols'>('popular');
  const [activeReactionMessageId, setActiveReactionMessageId] = useState<string | null>(null);
  const [lightboxImageUrl, setLightboxImageUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Tin nhắn lưu cục bộ của các nhóm lớp kèm phản ứng emoji
  const [localMessages, setLocalMessages] = useState<Record<string, ClassroomChatMessage[]>>(() => {
    return {
      cls_12a1: [
        {
          id: 'msg_init_01',
          classId: 'cls_12a1',
          senderId: 'usr_teacher_01',
          senderName: 'ThS. Trần Văn Minh',
          senderRole: 'teacher',
          senderAvatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=TeacherMinh',
          content: 'Chào cả lớp 12A1! Thầy đã cập nhật Chuyên đề Cực trị hàm số và giao Đề thi thử số 01. Các em vào làm bài nhé! 📚📐✨',
          reactions: [
            { emoji: '👍', count: 4, userIds: ['usr_student_01', 'usr_student_02', 'usr_student_03', 'usr_student_04'] },
            { emoji: '🔥', count: 3, userIds: ['usr_student_01', 'usr_student_02', 'usr_student_05'] },
          ],
          timestamp: new Date(Date.now() - 3600 * 4 * 1000).toISOString(),
        },
        {
          id: 'msg_init_02',
          classId: 'cls_12a1',
          senderId: 'usr_student_01',
          senderName: 'Nguyễn Văn An',
          senderRole: 'student',
          senderAvatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=VanAn',
          content: 'Dạ vâng ạ! @ThS. Trần Văn Minh cho em hỏi câu tích phân trong đề 1 dùng tích phân từng phần I = u.v - ∫ v du phải không thầy? 🤔💡',
          reactions: [
            { emoji: '💡', count: 2, userIds: ['usr_teacher_01', 'usr_student_02'] },
          ],
          timestamp: new Date(Date.now() - 3600 * 2 * 1000).toISOString(),
        },
        {
          id: 'msg_init_03',
          classId: 'cls_12a1',
          senderId: 'usr_teacher_01',
          senderName: 'ThS. Trần Văn Minh',
          senderRole: 'teacher',
          senderAvatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=TeacherMinh',
          content: 'Chính xác rồi em @Nguyễn Văn An nhé! Đặt u = x và dv = sin(x)dx là ra ngay kết quả = 1. 💯👏 Chúc cả lớp làm bài đạt điểm cao!',
          reactions: [
            { emoji: '❤️', count: 5, userIds: ['usr_student_01', 'usr_student_02', 'usr_student_03', 'usr_student_04', 'usr_student_05'] },
            { emoji: '💯', count: 4, userIds: ['usr_student_01', 'usr_student_03', 'usr_student_04', 'usr_student_05'] },
          ],
          timestamp: new Date(Date.now() - 3600 * 1 * 1000).toISOString(),
        },
      ],
      ...classroomMessages,
    };
  });

  // Lớp học đang chọn
  const currentClass = classrooms.find((c) => c.id === selectedClassId) || classrooms[0];

  // Danh sách tin nhắn lớp học hiện tại
  const currentClassMessages = currentClass ? localMessages[currentClass.id] || [] : [];

  // Danh sách bài học và chương học thuộc lớp đang chọn (Mục lục lớp)
  const currentClassLessons = currentClass ? localLessons.filter((l) => l.classId === currentClass.id) : [];

  // Nhóm các bài học theo Chương học (Mục lục chuyên đề)
  const groupedLessons = currentClassLessons.reduce((acc, lesson) => {
    const ch = lesson.chapter || 'Chuyên đề chung';
    if (!acc[ch]) acc[ch] = [];
    acc[ch].push(lesson);
    return acc;
  }, {} as Record<string, ClassroomLesson[]>);

  // Danh sách học sinh thuộc lớp đang chọn (tra từ allUsers)
  const registeredStudents = allUsers.filter((u) => u.role === 'student');
  const enrolledStudents = registeredStudents.filter((st) => currentClass?.studentIds.includes(st.id));

  // Danh sách học sinh chờ giáo viên phê duyệt vào lớp
  const pendingStudents = (currentClass?.pendingStudentIds || []).map((id) => {
    const existing = allUsers.find((u) => u.id === id);
    if (existing) return existing;
    return {
      id,
      name: `Học sinh (${id})`,
      email: `${id}@thpt-nbk.edu.vn`,
      role: 'student' as UserRole,
      tier: 'free' as const,
      xp: 450,
      streakDays: 1,
      lastActiveDate: new Date().toISOString().split('T')[0],
      dailyScanCount: 0,
      maxDailyScans: 10,
      grade: currentClass.grade || 12,
      avatar: `https://api.dicebear.com/7.x/bottts/svg?seed=${id}`,
    };
  });

  // Tất cả thành viên trong lớp (giáo viên + học sinh) để tag tên (@mention)
  const classTeacherUser = allUsers.find((u) => u.id === currentClass?.teacherId) || {
    id: currentClass?.teacherId || 'usr_teacher_01',
    name: currentClass?.teacherName || 'ThS. Trần Văn Minh',
    role: 'teacher' as UserRole,
    avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=TeacherMinh',
  };

  const classMembersForMention = [
    {
      id: classTeacherUser.id,
      name: classTeacherUser.name,
      role: 'teacher' as UserRole,
      avatar: (classTeacherUser as any).avatar,
    },
    ...enrolledStudents.map((s) => ({
      id: s.id,
      name: s.name,
      role: 'student' as UserRole,
      avatar: s.avatar,
    })),
  ];

  // Danh sách học sinh chưa có trong lớp để giáo viên thêm vào
  const availableStudentsToAdd = registeredStudents.filter(
    (st) =>
      !currentClass?.studentIds.includes(st.id) &&
      (st.name.toLowerCase().includes(searchStudentTerm.toLowerCase()) ||
        st.email.toLowerCase().includes(searchStudentTerm.toLowerCase()) ||
        st.id.toLowerCase().includes(searchStudentTerm.toLowerCase()))
  );

  // 1. Tạo lớp học mới (Giáo viên)
  const handleCreateClass = () => {
    if (!newClassName.trim()) return;

    const generatedCode =
      newClassCode.trim() ||
      `NBK-${newClassGrade}${Math.random().toString(36).substring(2, 5).toUpperCase()}`;

    const newClass: Classroom = {
      id: `cls_${Date.now()}`,
      name: newClassName.trim(),
      code: generatedCode,
      grade: newClassGrade,
      teacherId: currentUserId,
      teacherName: currentUserName,
      studentIds: [],
      assignedExamIds: [examsList[0]?.id || 'exam_bgd_2025_01'],
      createdAt: new Date().toISOString().split('T')[0],
      description: newClassDesc.trim() || 'Nhóm lớp bồi dưỡng Toán THPT.',
    };

    const updated = [newClass, ...classrooms];
    onUpdateClassrooms(updated);
    setSelectedClassId(newClass.id);
    setShowCreateClassModal(false);
    setNewClassName('');
    setNewClassCode('');
    setNewClassDesc('');
  };

  // 2. Giáo viên THÊM học sinh vào lớp (CHỈ thêm học sinh đã có tài khoản do Admin tạo!)
  const handleAddStudentToClass = () => {
    if (!currentClass) return;
    setStudentLookupError(null);

    let studentIdToAdd = selectedStudentToAdd;

    // Nếu giáo viên nhập ID học sinh để tra cứu
    if (!studentIdToAdd && manualStudentIdLookup.trim()) {
      const trimmedId = manualStudentIdLookup.trim();
      const existingStudent = registeredStudents.find(
        (s) => s.id.toLowerCase() === trimmedId.toLowerCase()
      );

      if (!existingStudent) {
        setStudentLookupError(
          `Không tìm thấy tài khoản học sinh mang ID "${trimmedId}". Lưu ý: Chỉ Quản Trị Viên (Admin) mới có quyền tạo tài khoản học sinh mới trong hệ thống.`
        );
        return;
      }
      studentIdToAdd = existingStudent.id;
    }

    if (!studentIdToAdd) return;

    if (currentClass.studentIds.includes(studentIdToAdd)) {
      setStudentLookupError('Học sinh này đã có trong danh sách lớp học!');
      return;
    }

    const updatedClassrooms = classrooms.map((cls) => {
      if (cls.id === currentClass.id) {
        return { ...cls, studentIds: [...cls.studentIds, studentIdToAdd] };
      }
      return cls;
    });

    onUpdateClassrooms(updatedClassrooms);
    setShowAddStudentModal(false);
    setSelectedStudentToAdd('');
    setManualStudentIdLookup('');
    setStudentLookupError(null);
  };

  // 3. Giáo viên XÓA học sinh ra khỏi lớp (với In-app confirmation modal)
  const confirmRemoveStudent = () => {
    if (!currentClass || !studentToRemove) return;

    const updatedClassrooms = classrooms.map((cls) => {
      if (cls.id === currentClass.id) {
        return {
          ...cls,
          studentIds: cls.studentIds.filter((id) => id !== studentToRemove.id),
        };
      }
      return cls;
    });

    onUpdateClassrooms(updatedClassrooms);
    setStudentToRemove(null);
  };

  // 3b. Giáo viên XÓA đề thi đã giao cho học sinh ở trong nhóm lớp
  const handleConfirmRemoveExamFromClass = () => {
    if (!currentClass || !examToRemoveFromClass) return;

    const examIdToRemove = examToRemoveFromClass.id;

    // Cập nhật danh sách đề thi giao trong Classroom
    const updatedClassrooms = classrooms.map((cls) => {
      if (cls.id === currentClass.id) {
        return {
          ...cls,
          assignedExamIds: cls.assignedExamIds.filter((id) => id !== examIdToRemove),
        };
      }
      return cls;
    });

    onUpdateClassrooms(updatedClassrooms);

    // Nếu đề thi có gắn targetClassIds thì gỡ ID lớp này ra
    if (onUpdateExamsList) {
      const updatedExams = examsList.map((ex) => {
        if (ex.id === examIdToRemove && ex.targetClassIds) {
          return {
            ...ex,
            targetClassIds: ex.targetClassIds.filter((cid) => cid !== currentClass.id),
          };
        }
        return ex;
      });
      onUpdateExamsList(updatedExams);
    }

    setExamActionSuccess(`Đã xóa đề "${examToRemoveFromClass.title}" khỏi danh sách giao cho lớp ${currentClass.name}!`);
    setTimeout(() => setExamActionSuccess(null), 4000);
    setExamToRemoveFromClass(null);
  };

  // Tải hoặc mở file PDF an toàn
  const handleDownloadPdf = (fileName: string, fileData?: string) => {
    if (fileData && fileData.startsWith('data:application/pdf')) {
      const link = document.createElement('a');
      link.href = fileData;
      link.download = fileName;
      link.click();
    } else {
      // Giả lập tài liệu PDF toán học để học sinh / giáo viên luôn tải được file hợp lệ
      const dummyPdf = `%PDF-1.4\n%Math&NBK Education Platform - ${fileName}\n1 0 obj\n<< /Title (${fileName}) /Author (Math&NBK) >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF`;
      const blob = new Blob([dummyPdf], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName.endsWith('.pdf') ? fileName : `${fileName}.pdf`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
  };

  // Hàm xử lý đọc file PDF tổng quát (giới hạn dung lượng ~10MB)
  const processPdfFile = (
    file: File,
    onSuccess: (data: { fileName: string; fileSize: string; fileData: string }) => void,
    onError: (msg: string | null) => void
  ) => {
    const MAX_SIZE = 10 * 1024 * 1024; // 10 MB
    if (file.size > MAX_SIZE) {
      onError(`Dung lượng file vượt quá giới hạn 10MB (hiện tại: ${(file.size / (1024 * 1024)).toFixed(2)} MB). Vui lòng chọn file PDF nhỏ hơn 10MB!`);
      return;
    }

    if (!file.name.toLowerCase().endsWith('.pdf') && file.type !== 'application/pdf') {
      onError('Vui lòng chọn file có định dạng PDF!');
      return;
    }

    onError(null);
    const sizeStr = (file.size / (1024 * 1024)).toFixed(2) + ' MB';
    const reader = new FileReader();
    reader.onload = () => {
      onSuccess({
        fileName: file.name,
        fileSize: sizeStr,
        fileData: reader.result as string,
      });
    };
    reader.readAsDataURL(file);
  };

  // Chọn PDF cho Ô Bài học (Tạo mới)
  const handleLessonPdfSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    processPdfFile(
      file,
      (data) => setNewLessonPdfFile(data),
      (err) => setNewLessonError(err)
    );
  };

  // Chọn PDF cho Ô Luyện tập (Tạo mới)
  const handlePracticePdfSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    processPdfFile(
      file,
      (data) => setNewLessonPracticePdfFile(data),
      (err) => setNewLessonError(err)
    );
  };

  // Chọn PDF cho Ô Bài học (Chỉnh sửa)
  const handleEditLessonPdfSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    processPdfFile(
      file,
      (data) => setEditLessonPdfFile(data),
      (err) => setEditLessonError(err)
    );
  };

  // Chọn PDF cho Ô Luyện tập (Chỉnh sửa)
  const handleEditPracticePdfSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    processPdfFile(
      file,
      (data) => setEditLessonPracticePdfFile(data),
      (err) => setEditLessonError(err)
    );
  };

  // 3c. Giáo viên tạo / upload Chương học và Bài học mới cho học sinh (Chương -> Bài học -> Ô Bài học & Ô Luyện tập)
  const handleCreateLessonSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentClass) return;

    if (!newLessonChapter.trim() || !newLessonTitle.trim()) {
      setNewLessonError('Vui lòng nhập đầy đủ tên Chương học và tên Bài học!');
      return;
    }

    const attachmentsList: { name: string; type: 'pdf' | 'image' | 'link'; url: string; size?: string }[] = [];
    if (newLessonPdfFile) {
      attachmentsList.push({
        name: newLessonPdfFile.fileName,
        type: 'pdf' as const,
        url: newLessonPdfFile.fileData,
        size: newLessonPdfFile.fileSize,
      });
    }
    if (newLessonPracticePdfFile) {
      attachmentsList.push({
        name: newLessonPracticePdfFile.fileName,
        type: 'pdf' as const,
        url: newLessonPracticePdfFile.fileData,
        size: newLessonPracticePdfFile.fileSize,
      });
    }

    if (newLessonExternalLink.trim()) {
      attachmentsList.push({
        name: 'Link tài liệu trực tuyến',
        type: 'link' as const,
        url: newLessonExternalLink.trim(),
        size: 'Web',
      });
    }

    const newLessonObj: ClassroomLesson = {
      id: `les_${Date.now()}`,
      classId: currentClass.id,
      chapter: newLessonChapter.trim(),
      title: newLessonTitle.trim(),
      description: newLessonDesc.trim() || 'Tài liệu lý thuyết và bài tập luyện tập theo chuẩn chương trình GDPT 2018.',
      theoryContent:
        newLessonTheory.trim() ||
        'Nội dung tóm tắt kiến thức trọng tâm, định lý, công thức và phương pháp giải bài tập.',
      practiceContent:
        newLessonPractice.trim() ||
        'Hệ thống ví dụ mẫu minh họa và câu hỏi bài tập rèn luyện cho học sinh.',
      exercisesContent:
        newLessonPractice.trim() ||
        'Hệ thống ví dụ mẫu minh họa và câu hỏi bài tập rèn luyện cho học sinh.',
      content: newLessonTheory.trim() || newLessonDesc.trim(),
      teacherName: currentUserName || 'ThS. Trần Văn Minh',
      createdAt: new Date().toISOString().split('T')[0],
      exercisesCount: Number(newLessonExercisesCount) || 10,
      completedStudentIds: [],
      externalLink: newLessonExternalLink.trim() || undefined,
      pdfAttachment: newLessonPdfFile || undefined,
      practicePdfAttachment: newLessonPracticePdfFile || undefined,
      attachments: attachmentsList.length > 0 ? attachmentsList : undefined,
    };

    const updated = [newLessonObj, ...localLessons];
    setLocalLessons(updated);
    if (onUpdateLessons) {
      onUpdateLessons(updated);
    }

    setShowAddLessonModal(false);
    setLessonActionSuccess(`Đã đăng tải bài học "${newLessonTitle.trim()}" thành công!`);
    setTimeout(() => setLessonActionSuccess(null), 3500);
  };

  // 3c-2. Giáo viên MỞ modal chỉnh sửa bài học đã đăng
  const handleOpenEditLesson = (lesson: ClassroomLesson) => {
    setEditingLessonId(lesson.id);
    setEditLessonChapter(lesson.chapter || '');
    setEditLessonTitle(lesson.title || '');
    setEditLessonDesc(lesson.description || '');
    setEditLessonTheory(lesson.theoryContent || lesson.content || '');
    setEditLessonPractice(lesson.practiceContent || lesson.exercisesContent || '');
    setEditLessonExercisesCount(lesson.exercisesCount || 10);
    setEditLessonExternalLink(lesson.externalLink || '');
    setEditLessonPdfFile(
      lesson.pdfAttachment
        ? { ...lesson.pdfAttachment, fileData: lesson.pdfAttachment.fileData || '#' }
        : null
    );
    setEditLessonPracticePdfFile(
      lesson.practicePdfAttachment
        ? { ...lesson.practicePdfAttachment, fileData: lesson.practicePdfAttachment.fileData || '#' }
        : null
    );
    setEditLessonError(null);
    setShowEditLessonModal(true);
  };

  // 3c-3. Giáo viên LƯU chỉnh sửa bài học
  const handleEditLessonSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editLessonTitle.trim() || !editLessonChapter.trim()) {
      setEditLessonError('Vui lòng nhập đầy đủ tên Chương học và tên Bài học!');
      return;
    }

    const attachmentsList: { name: string; type: 'pdf' | 'image' | 'link'; url: string; size?: string }[] = [];
    if (editLessonPdfFile) {
      attachmentsList.push({
        name: editLessonPdfFile.fileName,
        type: 'pdf' as const,
        url: editLessonPdfFile.fileData,
        size: editLessonPdfFile.fileSize,
      });
    }
    if (editLessonPracticePdfFile) {
      attachmentsList.push({
        name: editLessonPracticePdfFile.fileName,
        type: 'pdf' as const,
        url: editLessonPracticePdfFile.fileData,
        size: editLessonPracticePdfFile.fileSize,
      });
    }
    if (editLessonExternalLink.trim()) {
      attachmentsList.push({
        name: 'Link tài liệu trực tuyến',
        type: 'link' as const,
        url: editLessonExternalLink.trim(),
        size: 'Web',
      });
    }

    const updated = localLessons.map((l) => {
      if (l.id === editingLessonId) {
        const updatedLesson: ClassroomLesson = {
          ...l,
          chapter: editLessonChapter.trim(),
          title: editLessonTitle.trim(),
          description: editLessonDesc.trim(),
          theoryContent: editLessonTheory.trim(),
          practiceContent: editLessonPractice.trim(),
          exercisesContent: editLessonPractice.trim(),
          content: editLessonTheory.trim(),
          updatedAt: new Date().toISOString().split('T')[0],
          exercisesCount: Number(editLessonExercisesCount) || 10,
          externalLink: editLessonExternalLink.trim() || undefined,
          pdfAttachment: editLessonPdfFile || undefined,
          practicePdfAttachment: editLessonPracticePdfFile || undefined,
          attachments: attachmentsList.length > 0 ? attachmentsList : undefined,
        };

        if (selectedLessonDetail?.id === editingLessonId) {
          setSelectedLessonDetail(updatedLesson);
        }
        return updatedLesson;
      }
      return l;
    });

    setLocalLessons(updated);
    if (onUpdateLessons) {
      onUpdateLessons(updated);
    }

    setShowEditLessonModal(false);
    setLessonActionSuccess(`Đã cập nhật bài học "${editLessonTitle.trim()}" thành công!`);
    setTimeout(() => setLessonActionSuccess(null), 3500);
  };

  // Helper hiển thị văn bản có công thức Toán KaTeX
  const renderFormattedMathText = (content: string) => {
    if (!content) return null;
    const paragraphs = content.split('\n');
    return (
      <div className="space-y-2.5 leading-relaxed text-xs text-slate-800">
        {paragraphs.map((p, pIdx) => {
          const trimmed = p.trim();
          if (!trimmed) return <div key={pIdx} className="h-1.5" />;

          if (trimmed.startsWith('### ')) {
            return (
              <h5 key={pIdx} className="font-extrabold text-sm text-blue-900 mt-3 mb-1 flex items-center gap-1.5">
                <span className="w-1.5 h-3.5 bg-blue-600 rounded-full inline-block"></span>
                <span>{trimmed.replace('### ', '')}</span>
              </h5>
            );
          }

          if (trimmed.startsWith('$$') && trimmed.endsWith('$$')) {
            const formula = trimmed.slice(2, -2).trim();
            return (
              <div key={pIdx} className="my-2 p-3 rounded-xl bg-slate-50 border border-slate-200 text-center overflow-x-auto shadow-2xs">
                <MathView latex={formula} block={true} />
              </div>
            );
          }

          const parts = trimmed.split(/(\$[^\$]+\$)/g);
          return (
            <p key={pIdx} className={trimmed.startsWith('- ') ? 'pl-3 relative before:content-["•"] before:absolute before:left-0 before:text-blue-500' : ''}>
              {parts.map((part, partIdx) => {
                if (part.startsWith('$') && part.endsWith('$') && part.length > 2) {
                  return <MathView key={partIdx} latex={part.slice(1, -1)} className="mx-0.5 text-blue-700 font-semibold" />;
                }
                const boldParts = part.split(/(\*\*[^\*]+\*\*)/g);
                return boldParts.map((bPart, bIdx) => {
                  if (bPart.startsWith('**') && bPart.endsWith('**')) {
                    return <strong key={bIdx} className="font-bold text-slate-900">{bPart.slice(2, -2)}</strong>;
                  }
                  return <span key={bIdx}>{bPart}</span>;
                });
              })}
            </p>
          );
        })}
      </div>
    );
  };

  // 3d. Giáo viên xóa bài học khỏi mục lục lớp
  const handleDeleteLesson = (lessonId: string, lessonTitle: string) => {
    const updated = localLessons.filter((l) => l.id !== lessonId);
    setLocalLessons(updated);
    if (onUpdateLessons) {
      onUpdateLessons(updated);
    }
    setLessonActionSuccess(`Đã xóa bài học "${lessonTitle}" khỏi mục lục!`);
    setTimeout(() => setLessonActionSuccess(null), 3000);
  };

  // 3e. Học sinh đánh dấu hoàn thành bài học
  const handleToggleCompleteLesson = (lessonId: string) => {
    const updated = localLessons.map((l) => {
      if (l.id === lessonId) {
        const studentList = l.completedStudentIds || [];
        const isCompleted = studentList.includes(currentUserId);
        const nextList = isCompleted
          ? studentList.filter((id) => id !== currentUserId)
          : [...studentList, currentUserId];
        return {
          ...l,
          completedStudentIds: nextList,
        };
      }
      return l;
    });

    setLocalLessons(updated);
    if (onUpdateLessons) {
      onUpdateLessons(updated);
    }
  };

  // 4. Học sinh tham gia lớp học bằng mã Code (VD: NBK-12A1)
  const handleJoinClassByCode = () => {
    if (!joinCodeInput.trim()) return;

    const code = joinCodeInput.trim().toUpperCase();
    const foundClass = classrooms.find((c) => c.code.toUpperCase() === code);

    if (!foundClass) {
      setJoinMessage({
        text: `Không tìm thấy lớp học với mã "${code}". Vui lòng kiểm tra lại với thầy cô!`,
        type: 'error',
      });
      setTimeout(() => setJoinMessage(null), 4000);
      return;
    }

    if (foundClass.studentIds.includes(currentUserId)) {
      setJoinMessage({
        text: `Bạn đã là thành viên chính thức của lớp "${foundClass.name}" rồi!`,
        type: 'error',
      });
      setTimeout(() => setJoinMessage(null), 4000);
      setSelectedClassId(foundClass.id);
      return;
    }

    // Nếu học sinh đã gửi yêu cầu và đang nằm trong danh sách chờ duyệt
    if (foundClass.pendingStudentIds?.includes(currentUserId)) {
      setJoinMessage({
        text: `Bạn đã gửi yêu cầu gia nhập "${foundClass.name}" rồi. Vui lòng chờ thầy cô phê duyệt nhé!`,
        type: 'error',
      });
      setTimeout(() => setJoinMessage(null), 4000);
      return;
    }

    // Nếu lớp bật chế độ duyệt thành viên (mặc định requiresApproval !== false)
    if (foundClass.requiresApproval !== false) {
      const updated = classrooms.map((c) => {
        if (c.id === foundClass.id) {
          const nextPending = Array.from(new Set([...(c.pendingStudentIds || []), currentUserId]));
          return { ...c, pendingStudentIds: nextPending };
        }
        return c;
      });

      onUpdateClassrooms(updated);
      setSelectedClassId(foundClass.id);
      setJoinMessage({
        text: `Đã gửi yêu cầu tham gia "${foundClass.name}" thành công! Vui lòng chờ giáo viên duyệt.`,
        type: 'success',
      });
      setJoinCodeInput('');
      setTimeout(() => setJoinMessage(null), 4500);
      return;
    }

    // Nếu lớp không yêu cầu duyệt -> vào thẳng lớp
    const updated = classrooms.map((c) => {
      if (c.id === foundClass.id) {
        return { ...c, studentIds: [...c.studentIds, currentUserId] };
      }
      return c;
    });

    onUpdateClassrooms(updated);
    setSelectedClassId(foundClass.id);
    setJoinMessage({
      text: `Chúc mừng bạn đã tham gia thành công "${foundClass.name}"!`,
      type: 'success',
    });
    setJoinCodeInput('');
    setTimeout(() => setJoinMessage(null), 4000);
  };

  // 4b. Giáo viên duyệt học sinh vào lớp (Phê duyệt đơn lẻ)
  const handleApproveStudent = (studentId: string) => {
    if (!currentClass) return;
    const studentObj = allUsers.find((u) => u.id === studentId);
    const studentName = studentObj?.name || studentId;

    const updatedClassrooms = classrooms.map((cls) => {
      if (cls.id === currentClass.id) {
        const nextPending = (cls.pendingStudentIds || []).filter((id) => id !== studentId);
        const nextStudents = cls.studentIds.includes(studentId)
          ? cls.studentIds
          : [...cls.studentIds, studentId];
        return {
          ...cls,
          pendingStudentIds: nextPending,
          studentIds: nextStudents,
        };
      }
      return cls;
    });

    onUpdateClassrooms(updatedClassrooms);
    setApprovalActionSuccess(`Đã duyệt thành công học sinh ${studentName} vào lớp ${currentClass.name}!`);
    setTimeout(() => setApprovalActionSuccess(null), 3500);
  };

  // 4c. Giáo viên từ chối học sinh xin vào lớp
  const handleRejectStudent = (studentId: string) => {
    if (!currentClass) return;
    const studentObj = allUsers.find((u) => u.id === studentId);
    const studentName = studentObj?.name || studentId;

    const updatedClassrooms = classrooms.map((cls) => {
      if (cls.id === currentClass.id) {
        const nextPending = (cls.pendingStudentIds || []).filter((id) => id !== studentId);
        return {
          ...cls,
          pendingStudentIds: nextPending,
        };
      }
      return cls;
    });

    onUpdateClassrooms(updatedClassrooms);
    setApprovalActionSuccess(`Đã từ chối yêu cầu gia nhập của học sinh ${studentName}.`);
    setTimeout(() => setApprovalActionSuccess(null), 3500);
  };

  // 4d. Giáo viên duyệt TẤT CẢ học sinh đang chờ
  const handleApproveAllPending = () => {
    if (!currentClass || !currentClass.pendingStudentIds || currentClass.pendingStudentIds.length === 0) return;
    const count = currentClass.pendingStudentIds.length;

    const updatedClassrooms = classrooms.map((cls) => {
      if (cls.id === currentClass.id) {
        const nextStudents = Array.from(new Set([...cls.studentIds, ...(cls.pendingStudentIds || [])]));
        return {
          ...cls,
          pendingStudentIds: [],
          studentIds: nextStudents,
        };
      }
      return cls;
    });

    onUpdateClassrooms(updatedClassrooms);
    setApprovalActionSuccess(`Đã duyệt đồng loạt ${count} học sinh vào lớp ${currentClass.name}!`);
    setTimeout(() => setApprovalActionSuccess(null), 3500);
  };

  // 4e. Giáo viên bật/tắt chế độ duyệt thành viên (requiresApproval)
  const handleToggleRequiresApproval = () => {
    if (!currentClass) return;
    const currentVal = currentClass.requiresApproval !== false;
    const nextVal = !currentVal;

    const updatedClassrooms = classrooms.map((cls) => {
      if (cls.id === currentClass.id) {
        return {
          ...cls,
          requiresApproval: nextVal,
        };
      }
      return cls;
    });

    onUpdateClassrooms(updatedClassrooms);
    setApprovalActionSuccess(
      nextVal
        ? 'Đã BẬT chế độ duyệt thành viên: Học sinh nhập mã cần giáo viên phê duyệt mới được vào lớp!'
        : 'Đã TẮT chế độ duyệt thành viên: Học sinh nhập đúng mã sẽ vào lớp ngay lập tức!'
    );
    setTimeout(() => setApprovalActionSuccess(null), 4000);
  };

  // 5. Giao đề thi cho cả lớp
  const handleAssignExamToClass = (examId: string) => {
    if (!currentClass) return;

    const updated = classrooms.map((cls) => {
      if (cls.id === currentClass.id) {
        if (!cls.assignedExamIds.includes(examId)) {
          return { ...cls, assignedExamIds: [...cls.assignedExamIds, examId] };
        }
      }
      return cls;
    });

    onUpdateClassrooms(updated);
  };

  // ==========================================
  // XỬ LÝ CHAT TRONG NHÓM LỚP (GỬI ẢNH, TAG TÊN, EMOJI)
  // ==========================================
  const handleSendChatMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatMessageText.trim() && !attachedImage) return;
    if (!currentClass) return;

    // Tìm các tag @tên trong nội dung
    const mentions: ChatMention[] = [];
    classMembersForMention.forEach((member) => {
      if (chatMessageText.includes(`@${member.name}`)) {
        mentions.push({ userId: member.id, userName: member.name });
      }
    });

    const newMsg: ClassroomChatMessage = {
      id: `msg_${Date.now()}`,
      classId: currentClass.id,
      senderId: currentUserId,
      senderName: currentUserName,
      senderRole: userRole,
      senderAvatar: currentUserAvatar,
      content: chatMessageText.trim(),
      imageUrl: attachedImage || undefined,
      mentions: mentions.length > 0 ? mentions : undefined,
      reactions: [],
      timestamp: new Date().toISOString(),
    };

    setLocalMessages((prev) => ({
      ...prev,
      [currentClass.id]: [...(prev[currentClass.id] || []), newMsg],
    }));

    if (onSendChatMessage) {
      onSendChatMessage(newMsg);
    }

    setChatMessageText('');
    setAttachedImage(null);
    setShowMentionPicker(false);
    setShowEmojiPicker(false);
  };

  // Xử lý thả / hủy phản ứng Emoji trên từng tin nhắn
  const handleToggleReaction = (msgId: string, emoji: string) => {
    if (!currentClass) return;
    setLocalMessages((prev) => {
      const list = prev[currentClass.id] || [];
      const updated = list.map((msg) => {
        if (msg.id === msgId) {
          const reactions = msg.reactions || [];
          const existing = reactions.find((r) => r.emoji === emoji);
          let nextReactions: any[];
          if (existing) {
            if (existing.userIds.includes(currentUserId)) {
              const nextUsers = existing.userIds.filter((uid: string) => uid !== currentUserId);
              if (nextUsers.length === 0) {
                nextReactions = reactions.filter((r) => r.emoji !== emoji);
              } else {
                nextReactions = reactions.map((r) =>
                  r.emoji === emoji ? { ...r, count: nextUsers.length, userIds: nextUsers } : r
                );
              }
            } else {
              nextReactions = reactions.map((r) =>
                r.emoji === emoji ? { ...r, count: r.count + 1, userIds: [...r.userIds, currentUserId] } : r
              );
            }
          } else {
            nextReactions = [...reactions, { emoji, count: 1, userIds: [currentUserId] }];
          }
          return { ...msg, reactions: nextReactions };
        }
        return msg;
      });
      return { ...prev, [currentClass.id]: updated };
    });
    setActiveReactionMessageId(null);
  };

  // Chèn emoji vào ô soạn tin nhắn
  const handleInsertEmoji = (emoji: string) => {
    setChatMessageText((prev) => prev + emoji);
  };

  // Xử lý upload ảnh từ máy tính / điện thoại (Tối đa 10MB)
  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        alert('Dung lượng ảnh đính kèm vượt quá giới hạn 10MB. Vui lòng chọn ảnh nhỏ hơn!');
        return;
      }
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          setAttachedImage(event.target.result as string);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  // Chèn tag tên vào nội dung tin nhắn
  const handleInsertMention = (memberName: string) => {
    setChatMessageText((prev) => `${prev}@${memberName} `);
    setShowMentionPicker(false);
  };

  // Hàm render nội dung tin nhắn kèm định dạng highlight cho @tag
  const renderMessageContent = (content: string) => {
    const mentionPattern = /(@[A-Za-z0-9À-ỹ\s\.]+?)(?=\s|$)/g;
    const parts = content.split(mentionPattern);

    return parts.map((part, i) => {
      if (part.startsWith('@')) {
        return (
          <span
            key={i}
            className="inline-flex items-center px-1.5 py-0.5 rounded-md bg-blue-100 text-blue-700 font-bold text-xs mx-0.5 border border-blue-200"
          >
            {part}
          </span>
        );
      }
      return <span key={i}>{part}</span>;
    });
  };

  // Sao chép mã lớp học
  const handleCopyClassCode = () => {
    if (!currentClass) return;
    navigator.clipboard.writeText(currentClass.code);
    setHasCopiedCode(true);
    setTimeout(() => setHasCopiedCode(false), 2000);
  };

  return (
    <div className="w-full max-w-5xl mx-auto px-4 py-8 space-y-8">
      {/* Top Banner */}
      <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-blue-600 block">
            {userRole === 'teacher' ? 'Cổng Quản Trị Nhóm Lớp Giáo Viên' : 'Không Gian Lớp Học Của Tôi'}
          </span>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 mt-1">
            {userRole === 'teacher' ? 'Quản Lý Nhóm Lớp & Học Sinh' : 'Nhóm Lớp & Bài Tập Giao Về'}
          </h1>
          <p className="text-slate-500 text-xs sm:text-sm mt-1 max-w-xl">
            {userRole === 'teacher'
              ? 'Tạo nhóm lớp, cấp mã vào lớp, trao đổi thảo luận chat trực tiếp kèm gửi ảnh và tag tên học sinh.'
              : 'Tham gia lớp của thầy cô, chat trao đổi học tập cùng bạn bè, gửi ảnh bài toán và làm đề thi được giao.'}
          </p>
        </div>

        {/* Action button based on role */}
        <div className="flex items-center gap-2">
          {userRole === 'teacher' ? (
            <button
              onClick={() => setShowCreateClassModal(true)}
              className="px-5 py-2.5 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-xs flex items-center gap-2 transition-all"
            >
              <Plus size={16} />
              <span>Tạo Lớp Học Mới</span>
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={joinCodeInput}
                onChange={(e) => setJoinCodeInput(e.target.value)}
                placeholder="Nhập mã lớp (VD: NBK-12A1)"
                className="h-10 px-3 rounded-xl border border-slate-300 text-xs font-mono font-bold uppercase focus:border-blue-600 focus:outline-none"
              />
              <button
                onClick={handleJoinClassByCode}
                className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs whitespace-nowrap shadow-xs"
              >
                Vào Lớp
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Join notification message */}
      {joinMessage && (
        <div
          className={`p-4 rounded-2xl border text-xs font-bold flex items-center gap-2 animate-in fade-in duration-200 ${
            joinMessage.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}
        >
          {joinMessage.type === 'success' ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
          <span>{joinMessage.text}</span>
        </div>
      )}

      {/* Classroom Selection Tabs */}
      <div className="flex items-center gap-3 overflow-x-auto pb-2">
        {classrooms.map((cls) => {
          const isSelected = cls.id === currentClass?.id;
          return (
            <button
              key={cls.id}
              onClick={() => setSelectedClassId(cls.id)}
              className={`px-5 py-3 rounded-2xl border text-left shrink-0 transition-all ${
                isSelected
                  ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                  : 'bg-white text-slate-800 border-slate-200 hover:border-slate-300'
              }`}
            >
              <div className="flex items-center gap-2">
                <span
                  className={`text-[10px] font-black px-2 py-0.5 rounded-md uppercase ${
                    isSelected ? 'bg-blue-800 text-blue-100' : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  Khối {cls.grade}
                </span>
                <span className={`text-[11px] font-mono ${isSelected ? 'text-blue-200' : 'text-slate-400'}`}>
                  #{cls.code}
                </span>
              </div>
              <h4 className="font-bold text-sm mt-1">{cls.name}</h4>
              <span className={`text-[11px] mt-0.5 block ${isSelected ? 'text-blue-100' : 'text-slate-500'}`}>
                {cls.studentIds.length} học sinh · {cls.assignedExamIds.length} đề thi
              </span>
            </button>
          );
        })}
      </div>

      {/* Selected Classroom Details */}
      {currentClass && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column: Classroom Info & Assigned Exams (5 cols) */}
          <div className="lg:col-span-5 space-y-6">
            {/* Info Card */}
            <div className="bg-white rounded-3xl border border-slate-200 p-6 space-y-4 shadow-xs">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <GraduationCap size={20} className="text-blue-600" />
                  <h3 className="font-extrabold text-base text-slate-900">Thông Tin Nhóm Lớp</h3>
                </div>
                <span className="px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 text-[11px] font-bold">
                  Khối {currentClass.grade}
                </span>
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <span className="text-slate-400 block">Tên lớp học</span>
                  <span className="font-bold text-slate-800 text-sm">{currentClass.name}</span>
                </div>

                {/* Giáo viên & Nút kết bạn với giáo viên */}
                <div className="flex items-center justify-between p-3 rounded-2xl bg-purple-50/60 border border-purple-200/70">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-purple-700 block">Giáo viên chủ nhiệm</span>
                    <span className="font-bold text-slate-900 text-xs">{currentClass.teacherName}</span>
                    <span className="text-[11px] text-slate-500 font-mono block">ID: {currentClass.teacherId}</span>
                  </div>

                  {/* Nút kết bạn qua ID với giáo viên (GV - HS hoặc GV - GV) */}
                  {currentUserId !== currentClass.teacherId && onQuickAddFriend && (
                    <div>
                      {friendIds.includes(currentClass.teacherId) ? (
                        <span className="text-[11px] font-bold text-emerald-600 flex items-center gap-1 bg-white px-2 py-1 rounded-lg border border-emerald-200">
                          <Check size={12} />
                          <span>Bạn bè</span>
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => onQuickAddFriend(currentClass.teacherId)}
                          className="px-2.5 py-1 rounded-lg bg-purple-600 hover:bg-purple-700 text-white font-bold text-[11px] flex items-center gap-1 shadow-xs"
                        >
                          <UserPlus size={12} />
                          <span>Kết bạn GV</span>
                        </button>
                      )}
                    </div>
                  )}
                </div>

                <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-500 block">Mã tham gia lớp</span>
                    <span className="font-mono font-black text-blue-600 text-sm tracking-wider">
                      {currentClass.code}
                    </span>
                  </div>
                  <button
                    onClick={handleCopyClassCode}
                    className="px-3 py-1.5 rounded-xl bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 font-bold text-[11px] flex items-center gap-1 shadow-xs transition-colors"
                  >
                    {hasCopiedCode ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                    <span>{hasCopiedCode ? 'Đã sao chép' : 'Sao chép mã'}</span>
                  </button>
                </div>

                {currentClass.description && (
                  <div>
                    <span className="text-slate-400 block">Mô tả</span>
                    <p className="text-slate-600 mt-0.5 leading-relaxed">{currentClass.description}</p>
                  </div>
                )}
              </div>

              {/* Quick Jump to Gradebook for Teachers */}
              {userRole === 'teacher' && onViewClassGradebook && (
                <div className="pt-2 border-t border-slate-100">
                  <button
                    onClick={() => onViewClassGradebook(currentClass.id)}
                    className="w-full py-2.5 rounded-2xl bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-xs flex items-center justify-center gap-2 border border-blue-200 transition-colors"
                  >
                    <BarChart3 size={16} />
                    <span>Xem Bảng Điểm & Phổ Điểm Lớp Này</span>
                  </button>
                </div>
              )}
            </div>

            {/* Assigned Exams Card */}
            <div className="bg-white rounded-3xl border border-slate-200 p-6 space-y-4 shadow-xs">
              {(() => {
                const combinedExamIds = Array.from(
                  new Set([
                    ...currentClass.assignedExamIds,
                    ...examsList
                      .filter(
                        (e) =>
                          (e.targetClassIds && e.targetClassIds.includes(currentClass.id)) ||
                          e.distributionType === 'both'
                      )
                      .map((e) => e.id),
                  ])
                );

                return (
                  <>
                    <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                      <div className="flex items-center gap-2">
                        <Award size={20} className="text-amber-500" />
                        <h3 className="font-extrabold text-base text-slate-900">Đề Thi Giao Cho Lớp</h3>
                      </div>
                      <span className="text-xs text-blue-600 font-bold bg-blue-50 px-2.5 py-0.5 rounded-full">
                        {combinedExamIds.length} đề thi
                      </span>
                    </div>

                    <div className="space-y-2.5">
                      {combinedExamIds.length === 0 ? (
                        <p className="text-xs text-slate-400 italic py-2">Chưa có đề thi nào được giao cho nhóm lớp này.</p>
                      ) : (
                        combinedExamIds.map((examId) => {
                          const examObj = examsList.find((e) => e.id === examId);
                          if (!examObj) return null;

                          return (
                            <div
                              key={examId}
                              className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                            >
                              <div className="space-y-1">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <h4 className="font-bold text-slate-900">{examObj.title}</h4>
                                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800">
                                    {examObj.totalPoints} điểm
                                  </span>
                                  {examObj.maxAttempts && examObj.maxAttempts > 0 && (
                                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800">
                                      Tối đa {examObj.maxAttempts} lượt
                                    </span>
                                  )}
                                </div>
                                <div className="text-slate-400 text-[11px] flex items-center gap-2 flex-wrap">
                                  <span>{examObj.questions.length} câu hỏi</span>
                                  <span>·</span>
                                  <span>{examObj.durationMinutes} phút</span>
                                  {examObj.closeTime && (
                                    <>
                                      <span>·</span>
                                      <span className="text-rose-600 font-semibold">
                                        Hạn nộp: {new Date(examObj.closeTime).toLocaleDateString('vi-VN')}
                                      </span>
                                    </>
                                  )}
                                </div>
                              </div>

                              <div className="flex items-center gap-2 self-end sm:self-auto">
                                {userRole === 'student' && onSelectExamToTake && (
                                  <button
                                    onClick={() => {
                                      try {
                                        if (document.documentElement.requestFullscreen) {
                                          document.documentElement.requestFullscreen().catch(() => {});
                                        }
                                      } catch (e) {}
                                      onSelectExamToTake(examId);
                                    }}
                                    className="px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-[11px] shadow-xs whitespace-nowrap"
                                  >
                                    Làm Bài Ngay
                                  </button>
                                )}
                                {userRole === 'teacher' && (
                                  <div className="flex items-center gap-1.5">
                                    {onSelectExamToTake && (
                                      <button
                                        onClick={() => onSelectExamToTake(examId)}
                                        className="px-3 py-1.5 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-[11px] whitespace-nowrap"
                                      >
                                        Xem Đề
                                      </button>
                                    )}
                                    <button
                                      type="button"
                                      onClick={() => setExamToRemoveFromClass(examObj)}
                                      className="px-2.5 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 font-bold text-[11px] flex items-center gap-1 shadow-xs transition-colors whitespace-nowrap"
                                      title="Xóa đề này khỏi danh sách đề đã giao cho nhóm lớp"
                                    >
                                      <Trash2 size={13} />
                                      <span>Xóa khỏi lớp</span>
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </>
                );
              })()}

              {userRole === 'teacher' && examsList.length > currentClass.assignedExamIds.length && (
                <div className="pt-2">
                  <label className="text-xs font-bold text-slate-600 block mb-1.5">Giao thêm đề thi khác:</label>
                  <div className="flex gap-2">
                    <select
                      id="assignExamSelect"
                      className="flex-1 h-10 px-3 rounded-xl border border-slate-300 text-xs bg-white focus:outline-none"
                    >
                      {examsList
                        .filter((e) => !currentClass.assignedExamIds.includes(e.id))
                        .map((ex) => (
                          <option key={ex.id} value={ex.id}>
                            {ex.title}
                          </option>
                        ))}
                    </select>
                    <button
                      onClick={() => {
                        const selectEl = document.getElementById('assignExamSelect') as HTMLSelectElement;
                        if (selectEl && selectEl.value) {
                          handleAssignExamToClass(selectEl.value);
                        }
                      }}
                      className="px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl"
                    >
                      Giao Đề
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Tabbed Chat & Student Roster (7 cols) */}
          <div className="lg:col-span-7 bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-xs flex flex-col min-h-[600px]">
            {/* Tab switchers header */}
            <div className="p-3.5 sm:p-5 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 bg-slate-50/50">
              <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                <button
                  type="button"
                  onClick={() => setActiveRightTab('curriculum')}
                  className={`px-3 sm:px-4 py-2 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all ${
                    activeRightTab === 'curriculum'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'bg-white text-slate-600 hover:text-slate-900 border border-slate-200'
                  }`}
                >
                  <BookOpen size={15} />
                  <span>Mục Lục & Bài Học ({currentClassLessons.length})</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveRightTab('chat')}
                  className={`px-3 sm:px-4 py-2 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all ${
                    activeRightTab === 'chat'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'bg-white text-slate-600 hover:text-slate-900 border border-slate-200'
                  }`}
                >
                  <MessageSquare size={15} />
                  <span>Thảo Luận ({currentClassMessages.length})</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveRightTab('students')}
                  className={`px-3 sm:px-4 py-2 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all ${
                    activeRightTab === 'students'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'bg-white text-slate-600 hover:text-slate-900 border border-slate-200'
                  }`}
                >
                  <Users size={15} />
                  <span>Học Sinh ({enrolledStudents.length})</span>
                </button>

                {userRole === 'teacher' && (
                  <button
                    type="button"
                    onClick={() => setActiveRightTab('approvals')}
                    className={`px-3 sm:px-4 py-2 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all ${
                      activeRightTab === 'approvals'
                        ? 'bg-amber-600 text-white shadow-xs'
                        : 'bg-white text-slate-600 hover:text-slate-900 border border-slate-200'
                    }`}
                  >
                    <UserCheck size={15} />
                    <span>Duyệt Thành Viên</span>
                    {pendingStudents.length > 0 && (
                      <span
                        className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                          activeRightTab === 'approvals'
                            ? 'bg-white text-amber-800'
                            : 'bg-rose-500 text-white animate-pulse'
                        }`}
                      >
                        {pendingStudents.length}
                      </span>
                    )}
                  </button>
                )}
              </div>

              {/* Action buttons on the right based on active tab and role */}
              <div className="flex items-center gap-2">
                {userRole === 'teacher' && activeRightTab === 'curriculum' && (
                  <button
                    type="button"
                    onClick={() => {
                      setNewLessonChapter(
                        currentClass.grade === 12
                          ? 'Chương 1: Ứng dụng đạo hàm để khảo sát hàm số'
                          : 'Chương 1: Hàm số và phương trình lượng giác'
                      );
                      setNewLessonTitle('');
                      setNewLessonDesc('');
                      setNewLessonTheory('');
                      setNewLessonPractice('');
                      setNewLessonExercisesCount(10);
                      setNewLessonExternalLink('');
                      setNewLessonPdfFile(null);
                      setNewLessonPracticePdfFile(null);
                      setNewLessonAttachmentName('');
                      setNewLessonError(null);
                      setShowAddLessonModal(true);
                    }}
                    className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-xs flex items-center gap-1.5 transition-colors"
                  >
                    <FolderPlus size={14} />
                    <span>+ Thêm Bài Học</span>
                  </button>
                )}

                {userRole === 'teacher' && activeRightTab === 'approvals' && pendingStudents.length > 0 && (
                  <button
                    type="button"
                    onClick={handleApproveAllPending}
                    className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs flex items-center gap-1.5 transition-colors"
                  >
                    <CheckCheck size={14} />
                    <span>Duyệt Tất Cả ({pendingStudents.length})</span>
                  </button>
                )}

                {userRole === 'teacher' && activeRightTab === 'students' && (
                  <button
                    onClick={() => setShowAddStudentModal(true)}
                    className="px-3 py-1.5 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-xs border border-blue-200 flex items-center gap-1.5 transition-colors"
                  >
                    <UserPlus size={14} />
                    <span>+ Thêm Học Sinh</span>
                  </button>
                )}
              </div>
            </div>

            {/* TAB 0: MỤC LỤC & BÀI HỌC (GIÁO VIÊN UP CHƯƠNG HỌC & BÀI HỌC CHO HỌC SINH) */}
            {activeRightTab === 'curriculum' && (
              <div className="flex-1 flex flex-col p-4 sm:p-6 space-y-4">
                {/* Notification Toast */}
                {lessonActionSuccess && (
                  <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center gap-2 animate-in fade-in">
                    <CheckCircle2 size={16} />
                    <span>{lessonActionSuccess}</span>
                  </div>
                )}

                {/* Banner Tổng Quan Mục Lục */}
                <div className="p-4 rounded-2xl bg-gradient-to-r from-blue-50 via-indigo-50 to-slate-50 border border-blue-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                  <div>
                    <h4 className="font-extrabold text-blue-900 text-sm flex items-center gap-1.5">
                      <BookOpen size={16} className="text-blue-600" />
                      <span>Mục Lục Chương Trình & Chuyên Đề Toán THPT</span>
                    </h4>
                    <p className="text-[11px] text-slate-600 mt-0.5">
                      {userRole === 'teacher'
                        ? 'Giáo viên xây dựng mục lục, đăng tải lý thuyết, sơ đồ tư duy và tài liệu PDF bài tập cho học sinh.'
                        : 'Mục lục các chương học và từng bài học do thầy cô phân công. Nhấn vào bài để học và xem tài liệu.'}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className="px-2.5 py-1 rounded-xl bg-white text-blue-700 font-bold border border-blue-200 shadow-2xs">
                      {Object.keys(groupedLessons).length} Chương
                    </span>
                    <span className="px-2.5 py-1 rounded-xl bg-white text-blue-700 font-bold border border-blue-200 shadow-2xs">
                      {currentClassLessons.length} Bài học
                    </span>
                  </div>
                </div>

                {/* Danh Sách Các Chương Học & Từng Bài Học */}
                {currentClassLessons.length === 0 ? (
                  <div className="text-center py-12 px-4 rounded-3xl border-2 border-dashed border-slate-200 space-y-3 bg-slate-50/50 my-auto">
                    <div className="w-14 h-14 rounded-2xl bg-blue-100 text-blue-600 flex items-center justify-center mx-auto">
                      <BookOpen size={28} />
                    </div>
                    <h5 className="font-extrabold text-sm text-slate-800">Lớp chưa có mục lục bài học nào</h5>
                    <p className="text-xs text-slate-500 max-w-sm mx-auto">
                      {userRole === 'teacher'
                        ? 'Thầy/Cô hãy bắt đầu tạo chương học và tải lên bài học đầu tiên kèm tài liệu ôn thi.'
                        : 'Giáo viên chưa đăng tải bài học cho lớp này. Vui lòng quay lại sau!'}
                    </p>
                    {userRole === 'teacher' && (
                      <button
                        type="button"
                        onClick={() => {
                          setNewLessonChapter(
                            currentClass.grade === 12
                              ? 'Chương 1: Ứng dụng đạo hàm để khảo sát hàm số'
                              : 'Chương 1: Hàm số và phương trình lượng giác'
                          );
                          setNewLessonTitle('');
                          setNewLessonDesc('');
                          setNewLessonTheory('');
                          setNewLessonPractice('');
                          setNewLessonExercisesCount(10);
                          setNewLessonExternalLink('');
                          setNewLessonPdfFile(null);
                          setNewLessonPracticePdfFile(null);
                          setNewLessonAttachmentName('');
                          setNewLessonError(null);
                          setShowAddLessonModal(true);
                        }}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-xs inline-flex items-center gap-1.5"
                      >
                        <FolderPlus size={15} />
                        <span>+ Tạo Chương & Bài Học Đầu Tiên</span>
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="space-y-3.5 overflow-y-auto max-h-[500px] pr-1">
                    {Object.entries(groupedLessons).map(([chapterTitle, lessons], chIdx) => {
                      const isExpanded = expandedChapters.includes(chapterTitle);
                      const completedCount = lessons.filter((l) => l.completedStudentIds?.includes(currentUserId)).length;

                      return (
                        <div
                          key={chIdx}
                          className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-2xs transition-all hover:border-blue-200"
                        >
                          {/* Nút bấm Tiêu đề chương học - Nhấp để mở rộng / thu gọn các bài học */}
                          <button
                            type="button"
                            onClick={() => toggleChapter(chapterTitle)}
                            className={`w-full p-4 flex items-center justify-between gap-3 text-left transition-colors ${
                              isExpanded ? 'bg-blue-50/70 border-b border-blue-100' : 'hover:bg-slate-50/80'
                            }`}
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <span className="w-8 h-8 rounded-xl bg-blue-600 text-white font-black text-xs flex items-center justify-center shrink-0 shadow-2xs">
                                {chIdx + 1}
                              </span>
                              <div className="min-w-0">
                                <h5 className="font-extrabold text-sm text-slate-900 tracking-tight flex flex-wrap items-center gap-2 truncate">
                                  <span>{chapterTitle}</span>
                                  {userRole === 'student' && completedCount === lessons.length && lessons.length > 0 && (
                                    <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                                      Hoàn thành chương
                                    </span>
                                  )}
                                </h5>
                                <span className="text-[11px] text-slate-500 font-medium block mt-0.5">
                                  {lessons.length} bài học {userRole === 'student' ? `(Đã học ${completedCount}/${lessons.length})` : ''} · Nhấp để {isExpanded ? 'thu gọn' : 'xem từng bài học'}
                                </span>
                              </div>
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                              <span className="px-2.5 py-1 rounded-xl bg-white border border-slate-200 text-slate-700 text-[11px] font-bold shadow-2xs">
                                {lessons.length} bài
                              </span>
                              <div className="w-7 h-7 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-slate-500 shadow-2xs">
                                {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                              </div>
                            </div>
                          </button>

                          {/* Danh sách từng bài học trong chương (chỉ hiện khi nhấn vào chương) */}
                          {isExpanded && (
                            <div className="p-3 sm:p-4 space-y-3 bg-slate-50/40 animate-in fade-in duration-150">
                              {lessons.map((lesson) => {
                                const isCompleted = lesson.completedStudentIds?.includes(currentUserId);
                                const hasLessonPdf = !!lesson.pdfAttachment || lesson.attachments?.some((a) => a.type === 'pdf');
                                const hasPracticePdf = !!lesson.practicePdfAttachment;
                                const hasLink = !!lesson.externalLink || lesson.attachments?.some((a) => a.type === 'link');

                                return (
                                  <div
                                    key={lesson.id}
                                    className="p-4 rounded-2xl border border-slate-200 bg-white hover:border-blue-300 transition-all shadow-2xs space-y-3"
                                  >
                                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                                      <div className="space-y-1">
                                        <div className="flex items-center gap-2 flex-wrap">
                                          <h6 className="font-extrabold text-sm text-slate-900">{lesson.title}</h6>
                                          {isCompleted && (
                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold text-[10px]">
                                              <CheckCircle size={11} />
                                              <span>Đã học</span>
                                            </span>
                                          )}
                                          {lesson.updatedAt && (
                                            <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 font-medium text-[10px]">
                                              Đã sửa: {lesson.updatedAt}
                                            </span>
                                          )}
                                        </div>
                                        <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
                                          {lesson.description}
                                        </p>
                                      </div>

                                      {/* Nút Xem bài, Sửa & Xóa bài học */}
                                      <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-auto">
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setSelectedLessonDetail(lesson);
                                            setLessonDetailTab('theory');
                                          }}
                                          className="px-3 py-1.5 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-xs border border-blue-200 flex items-center gap-1 shadow-2xs transition-colors"
                                        >
                                          <Eye size={13} />
                                          <span>Xem Bài Học</span>
                                        </button>

                                        {userRole === 'teacher' && (
                                          <>
                                            <button
                                              type="button"
                                              onClick={() => handleOpenEditLesson(lesson)}
                                              className="px-2.5 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-700 font-bold text-xs border border-amber-200 flex items-center gap-1 shadow-2xs transition-colors"
                                              title="Chỉnh sửa nội dung bài học, ô luyện tập và file PDF"
                                            >
                                              <Pencil size={13} className="text-amber-600" />
                                              <span>Sửa</span>
                                            </button>

                                            <button
                                              type="button"
                                              onClick={() => handleDeleteLesson(lesson.id, lesson.title)}
                                              className="p-1.5 rounded-xl text-rose-500 hover:bg-rose-50 hover:text-rose-700 transition-colors"
                                              title="Xóa bài học này khỏi mục lục lớp"
                                            >
                                              <Trash2 size={15} />
                                            </button>
                                          </>
                                        )}
                                      </div>
                                    </div>

                                    {/* Nhãn chi tiết: Ô Bài học + PDF Bài học + Ô Luyện tập + PDF Luyện tập */}
                                    <div className="flex flex-wrap items-center gap-2 text-[11px] pt-1 border-t border-slate-100">
                                      <span className="px-2 py-0.5 rounded-md bg-blue-50 text-blue-800 font-semibold border border-blue-200 flex items-center gap-1">
                                        <BookOpen size={11} />
                                        <span>Ô Bài học</span>
                                      </span>

                                      {hasLessonPdf && (
                                        <span className="px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 font-semibold border border-indigo-200 flex items-center gap-1">
                                          <Paperclip size={11} />
                                          <span>PDF Bài học</span>
                                        </span>
                                      )}

                                      <span className="px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 font-semibold border border-amber-200 flex items-center gap-1">
                                        <ListChecks size={11} />
                                        <span>Ô Luyện tập ({lesson.exercisesCount || 10} câu)</span>
                                      </span>

                                      {hasPracticePdf && (
                                        <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 font-semibold border border-emerald-200 flex items-center gap-1">
                                          <Paperclip size={11} />
                                          <span>PDF Luyện tập</span>
                                        </span>
                                      )}

                                      {hasLink && (
                                        <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-semibold border border-slate-200 flex items-center gap-1">
                                          <ExternalLink size={11} />
                                          <span>Link trực tuyến</span>
                                        </span>
                                      )}

                                      {userRole === 'student' && (
                                        <div className="ml-auto">
                                          <button
                                            type="button"
                                            onClick={() => handleToggleCompleteLesson(lesson.id)}
                                            className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all flex items-center gap-1 ${
                                              isCompleted
                                                ? 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                                                : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200'
                                            }`}
                                          >
                                            <CheckCircle2 size={12} />
                                            <span>{isCompleted ? 'Hủy đánh dấu' : 'Đánh dấu đã học'}</span>
                                          </button>
                                        </div>
                                      )}

                                      {userRole === 'teacher' && (
                                        <div className="ml-auto text-slate-500 font-semibold text-[11px]">
                                          Đã học: {lesson.completedStudentIds?.length || 0} / {enrolledStudents.length} HS
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* TAB 1: CHAT TRONG NHÓM LỚP (GỬI ẢNH, TAG TÊN, EMOJI & PHẢN ỨNG) */}
            {activeRightTab === 'chat' && (
              <div className="flex-1 flex flex-col p-4 sm:p-6 space-y-4">
                {/* Chat Message Stream */}
                <div className="flex-1 overflow-y-auto space-y-4 max-h-[460px] pr-2">
                  {currentClassMessages.length > 0 ? (
                    currentClassMessages.map((msg) => {
                      const isMe = msg.senderId === currentUserId;
                      const isTeacher = msg.senderRole === 'teacher';

                      return (
                        <div
                          key={msg.id}
                          className={`flex gap-3 text-xs group relative ${isMe ? 'flex-row-reverse' : 'flex-row'}`}
                        >
                          {/* Avatar */}
                          <div className="w-8 h-8 rounded-xl overflow-hidden shrink-0 bg-slate-200 flex items-center justify-center font-bold text-slate-600 text-xs shadow-2xs">
                            {msg.senderAvatar ? (
                              <img src={msg.senderAvatar} alt={msg.senderName} className="w-full h-full object-cover" />
                            ) : (
                              msg.senderName.charAt(0)
                            )}
                          </div>

                          {/* Bubble and Reactions */}
                          <div className={`max-w-[85%] space-y-1.5 ${isMe ? 'items-end' : 'items-start'}`}>
                            <div className={`flex items-center gap-1.5 ${isMe ? 'justify-end' : 'justify-start'}`}>
                              <span className="font-extrabold text-[11px] text-slate-800">{msg.senderName}</span>
                              <span
                                className={`text-[9px] font-bold px-1.5 py-0.2 rounded ${
                                  isTeacher ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'
                                }`}
                              >
                                {isTeacher ? 'Giáo viên' : 'Học sinh'}
                              </span>
                              <span className="text-[10px] text-slate-400">
                                {new Date(msg.timestamp).toLocaleTimeString('vi-VN', {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </span>

                              {/* Quick reaction hover toolbar */}
                              <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5 bg-white/90 shadow-xs border border-slate-200 rounded-full px-1.5 py-0.5 ml-1">
                                {['👍', '❤️', '😂', '💡', '🔥'].map((em) => (
                                  <button
                                    key={em}
                                    type="button"
                                    onClick={() => handleToggleReaction(msg.id, em)}
                                    className="hover:scale-125 transition-transform text-xs p-0.5"
                                    title={`Thả cảm xúc ${em}`}
                                  >
                                    {em}
                                  </button>
                                ))}
                              </div>
                            </div>

                            <div
                              className={`p-3.5 rounded-2xl leading-relaxed text-xs shadow-2xs ${
                                isMe
                                  ? 'bg-blue-600 text-white rounded-tr-xs'
                                  : isTeacher
                                  ? 'bg-purple-50 text-slate-900 border border-purple-200/80 rounded-tl-xs'
                                  : 'bg-slate-100 text-slate-900 rounded-tl-xs'
                              }`}
                            >
                              {/* Message text with formatted mentions */}
                              <div className="whitespace-pre-wrap">{renderMessageContent(msg.content)}</div>

                              {/* Attached Image if present */}
                              {msg.imageUrl && (
                                <div className="mt-2.5 pt-2 border-t border-black/10">
                                  <div
                                    onClick={() => setLightboxImageUrl(msg.imageUrl || null)}
                                    className="cursor-pointer group relative overflow-hidden rounded-xl border border-black/10 inline-block max-w-full"
                                  >
                                    <img
                                      src={msg.imageUrl}
                                      alt="Ảnh đính kèm"
                                      className="max-h-56 max-w-full object-contain bg-slate-900/5 group-hover:opacity-95 transition-opacity"
                                    />
                                    <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-bold gap-1">
                                      <Eye size={16} />
                                      <span>Phóng to ảnh</span>
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>

                            {/* Message Reaction Pills */}
                            {msg.reactions && msg.reactions.length > 0 && (
                              <div className={`flex flex-wrap items-center gap-1 mt-1 ${isMe ? 'justify-end' : 'justify-start'}`}>
                                {msg.reactions.map((r, rIdx) => {
                                  const hasReacted = r.userIds.includes(currentUserId);
                                  return (
                                    <button
                                      key={rIdx}
                                      type="button"
                                      onClick={() => handleToggleReaction(msg.id, r.emoji)}
                                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold border transition-colors ${
                                        hasReacted
                                          ? 'bg-blue-100 border-blue-300 text-blue-800'
                                          : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100 shadow-2xs'
                                      }`}
                                      title={`${r.count} người đã thả ${r.emoji}`}
                                    >
                                      <span>{r.emoji}</span>
                                      <span className="font-mono text-[10px]">{r.count}</span>
                                    </button>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="py-16 text-center text-slate-400">
                      <MessageSquare size={36} className="mx-auto text-slate-300 mb-2" />
                      <p className="font-bold text-sm text-slate-600">Chưa có tin nhắn nào trong nhóm lớp</p>
                      <p className="text-xs text-slate-400 mt-1">
                        Hãy gửi lời chào, đặt câu hỏi toán học, thả emoji hoặc đính kèm ảnh bài tập!
                      </p>
                    </div>
                  )}
                </div>

                {/* Mention Picker Autocomplete dropdown */}
                {showMentionPicker && (
                  <div className="p-3 bg-white rounded-2xl border border-slate-300 shadow-xl space-y-2 animate-in fade-in duration-150">
                    <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                      <span>Tag tên thành viên (@mention):</span>
                      <button onClick={() => setShowMentionPicker(false)} className="text-slate-400 hover:text-slate-600">
                        <X size={14} />
                      </button>
                    </div>
                    <div className="max-h-36 overflow-y-auto space-y-1">
                      {classMembersForMention.map((member) => (
                        <button
                          key={member.id}
                          type="button"
                          onClick={() => handleInsertMention(member.name)}
                          className="w-full p-2 rounded-xl text-left hover:bg-blue-50 hover:text-blue-700 flex items-center justify-between text-xs transition-colors"
                        >
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-800">@{member.name}</span>
                            <span className="text-[10px] text-slate-400 font-mono">({member.id})</span>
                          </div>
                          <span
                            className={`text-[9px] font-bold px-1.5 py-0.2 rounded ${
                              member.role === 'teacher' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'
                            }`}
                          >
                            {member.role === 'teacher' ? 'Giáo viên' : 'Học sinh'}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Full Emoji Picker Popover */}
                {showEmojiPicker && (
                  <div className="p-3 bg-white rounded-2xl border border-slate-300 shadow-xl space-y-2.5 animate-in fade-in duration-150">
                    <div className="flex items-center justify-between pb-2 border-b border-slate-100 text-xs">
                      <div className="flex items-center gap-1 overflow-x-auto">
                        <button
                          type="button"
                          onClick={() => setEmojiCategory('popular')}
                          className={`px-2.5 py-1 rounded-lg font-bold text-[11px] transition-colors ${
                            emojiCategory === 'popular' ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-100'
                          }`}
                        >
                          Phổ Biến
                        </button>
                        <button
                          type="button"
                          onClick={() => setEmojiCategory('faces')}
                          className={`px-2.5 py-1 rounded-lg font-bold text-[11px] transition-colors ${
                            emojiCategory === 'faces' ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-100'
                          }`}
                        >
                          Biểu Cảm
                        </button>
                        <button
                          type="button"
                          onClick={() => setEmojiCategory('math')}
                          className={`px-2.5 py-1 rounded-lg font-bold text-[11px] transition-colors ${
                            emojiCategory === 'math' ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-100'
                          }`}
                        >
                          Học Tập
                        </button>
                        <button
                          type="button"
                          onClick={() => setEmojiCategory('symbols')}
                          className={`px-2.5 py-1 rounded-lg font-bold text-[11px] transition-colors ${
                            emojiCategory === 'symbols' ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-100'
                          }`}
                        >
                          Ký Hiệu Toán
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowEmojiPicker(false)}
                        className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100"
                      >
                        <X size={15} />
                      </button>
                    </div>

                    <div className="max-h-44 overflow-y-auto grid grid-cols-8 sm:grid-cols-10 gap-1.5 p-1">
                      {emojiCategory === 'popular' &&
                        ['👍', '❤️', '😂', '🔥', '💡', '💯', '👏', '🙌', '🎉', '✨', '💪', '🙏', '📚', '📐', '✍️', '🎓', '🎯', '🏆'].map((em, i) => (
                          <button
                            key={i}
                            type="button"
                            onClick={() => handleInsertEmoji(em)}
                            className="w-8 h-8 rounded-xl hover:bg-blue-50 hover:scale-125 transition-all text-base flex items-center justify-center"
                          >
                            {em}
                          </button>
                        ))}
                      {emojiCategory === 'faces' &&
                        ['😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😊', '😇', '😍', '🥰', '😘', '😋', '😜', '🤔', '🤫', '🥳', '😎', '🥺', '😢', '😭', '🤯', '🤩', '😴'].map((em, i) => (
                          <button
                            key={i}
                            type="button"
                            onClick={() => handleInsertEmoji(em)}
                            className="w-8 h-8 rounded-xl hover:bg-blue-50 hover:scale-125 transition-all text-base flex items-center justify-center"
                          >
                            {em}
                          </button>
                        ))}
                      {emojiCategory === 'math' &&
                        ['📚', '📖', '📝', '✏️', '✍️', '📐', '📏', '🎒', '🎓', '🏫', '🧠', '💻', '🔍', '🔬', '🏆', '🥇', '🥈', '🥉', '🎯', '⏰', '⏳'].map((em, i) => (
                          <button
                            key={i}
                            type="button"
                            onClick={() => handleInsertEmoji(em)}
                            className="w-8 h-8 rounded-xl hover:bg-blue-50 hover:scale-125 transition-all text-base flex items-center justify-center"
                          >
                            {em}
                          </button>
                        ))}
                      {emojiCategory === 'symbols' &&
                        ['∑', '∫', '√', 'π', '∞', '±', '≠', '≤', '≥', '≈', '⊥', '∥', '∠', '△', '∘', '∈', '∉', '⊂', '∩', '∪', '∅', '∀', '∃', '⇒', '⇔', 'ℝ', 'ℤ', 'ℕ', 'x²', 'y²'].map((em, i) => (
                          <button
                            key={i}
                            type="button"
                            onClick={() => handleInsertEmoji(em)}
                            className="w-8 h-8 rounded-xl hover:bg-blue-50 font-bold text-xs text-blue-800 border border-slate-200 flex items-center justify-center font-mono hover:scale-110 transition-all"
                          >
                            {em}
                          </button>
                        ))}
                    </div>
                  </div>
                )}

                {/* Attached Image Preview bar before sending */}
                {attachedImage && (
                  <div className="p-2.5 bg-blue-50 border border-blue-200 rounded-2xl flex items-center justify-between gap-3 animate-in fade-in">
                    <div className="flex items-center gap-3">
                      <img src={attachedImage} alt="Ảnh chuẩn bị gửi" className="w-12 h-12 object-cover rounded-xl border border-blue-200" />
                      <div>
                        <span className="text-xs font-bold text-blue-900 block">Đã đính kèm ảnh bài tập / hình vẽ</span>
                        <span className="text-[10px] text-blue-600 font-semibold">Sẽ được gửi kèm tin nhắn</span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setAttachedImage(null)}
                      className="p-1.5 rounded-xl bg-white text-rose-600 hover:bg-rose-50 border border-rose-200"
                    >
                      <X size={15} />
                    </button>
                  </div>
                )}

                {/* ======================================================== */}
                {/* THANH CÔNG CỤ CHAT & Ô NHẬP TIN NHẮN (KHÔNG GIAN TRÒ CHUYỆN) */}
                {/* ======================================================== */}
                <div className="pt-2 border-t border-slate-200 space-y-2.5 bg-white">
                  {/* Quick Emoji Bar: bấm nhanh các emoji thông dụng & ký hiệu toán */}
                  <div className="flex items-center justify-between gap-1 overflow-x-auto pb-1 text-xs">
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider shrink-0 mr-1 hidden sm:inline">
                        Emoji nhanh:
                      </span>
                      {['👍', '❤️', '😂', '🔥', '💡', '💯', '👏', '📚', '📐', '✍️', '∑', '√', 'π', '∞'].map((em, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => handleInsertEmoji(em)}
                          className="w-7 h-7 rounded-lg hover:bg-blue-50 hover:scale-115 transition-all text-sm flex items-center justify-center shrink-0 border border-transparent hover:border-blue-200"
                          title={`Chèn ${em}`}
                        >
                          {em}
                        </button>
                      ))}
                    </div>

                    <button
                      type="button"
                      onClick={() => setShowEmojiPicker((prev) => !prev)}
                      className={`px-2 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1 border shrink-0 transition-colors ${
                        showEmojiPicker
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border-slate-200'
                      }`}
                    >
                      <Smile size={13} />
                      <span>{showEmojiPicker ? 'Đóng' : 'Thêm Emoji'}</span>
                    </button>
                  </div>

                  {/* Form Soạn & Gửi Tin Nhắn */}
                  <form onSubmit={handleSendChatMessage} className="space-y-2">
                    {/* Hidden File Input for Image Attachment */}
                    <input
                      type="file"
                      ref={fileInputRef}
                      accept="image/*"
                      onChange={handleImageFileChange}
                      className="hidden"
                    />

                    {/* Action Bar & Message Input */}
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-end gap-2 bg-slate-50 p-2.5 rounded-2xl border border-slate-300 focus-within:border-blue-600 focus-within:bg-white transition-all shadow-inner">
                      {/* Text Input / Textarea */}
                      <textarea
                        rows={2}
                        value={chatMessageText}
                        onChange={(e) => setChatMessageText(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            handleSendChatMessage(e);
                          }
                        }}
                        placeholder={`Nhắn tin thảo luận trong ${currentClass?.name || 'nhóm lớp'} (Nhấn Enter để gửi, Shift+Enter xuống dòng)...`}
                        className="flex-1 w-full bg-transparent text-xs text-slate-800 placeholder-slate-400 focus:outline-none resize-none min-h-[46px] max-h-32"
                      />

                      {/* Tool Buttons & Send Button */}
                      <div className="flex items-center justify-between sm:justify-end gap-1.5 pt-1 sm:pt-0 shrink-0">
                        {/* Attach Image button */}
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          title="Đính kèm ảnh bài tập từ máy"
                          className="p-2 rounded-xl text-slate-500 hover:text-blue-600 hover:bg-blue-50 border border-slate-200 transition-colors flex items-center gap-1 text-[11px] font-semibold"
                        >
                          <ImageIcon size={16} />
                          <span className="hidden md:inline">Gửi ảnh</span>
                        </button>

                        {/* Tag Member button */}
                        <button
                          type="button"
                          onClick={() => setShowMentionPicker((prev) => !prev)}
                          title="Tag tên thành viên trong lớp (@tên)"
                          className={`p-2 rounded-xl border transition-colors flex items-center gap-1 text-[11px] font-semibold ${
                            showMentionPicker
                              ? 'bg-blue-100 text-blue-700 border-blue-300'
                              : 'text-slate-500 hover:text-blue-600 hover:bg-blue-50 border-slate-200'
                          }`}
                        >
                          <AtSign size={16} />
                          <span className="hidden md:inline">Tag tên</span>
                        </button>

                        {/* Send button */}
                        <button
                          type="submit"
                          disabled={!chatMessageText.trim() && !attachedImage}
                          className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-xs shadow-xs flex items-center justify-center gap-1.5 transition-all"
                        >
                          <Send size={15} />
                          <span>Gửi Tin</span>
                        </button>
                      </div>
                    </div>
                  </form>
                </div>
              </div>
            )}

            {/* TAB 2: DANH SÁCH HỌC SINH & QUẢN TRỊ THÀNH VIÊN */}
            {activeRightTab === 'students' && (
              <div className="p-6 space-y-4 flex-1">
                {/* Banner thông báo nếu có học sinh đang chờ duyệt */}
                {userRole === 'teacher' && pendingStudents.length > 0 && (
                  <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-between gap-3 text-xs animate-in fade-in">
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-xl bg-amber-600 text-white flex items-center justify-center font-bold text-xs shrink-0">
                        {pendingStudents.length}
                      </div>
                      <span className="font-bold text-amber-950">
                        Có {pendingStudents.length} học sinh đang gửi yêu cầu xin gia nhập lớp học này.
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setActiveRightTab('approvals')}
                      className="px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow-2xs whitespace-nowrap transition-colors"
                    >
                      Duyệt ngay →
                    </button>
                  </div>
                )}

                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <div>
                    <h3 className="font-extrabold text-sm text-slate-900">
                      Thành Viên Lớp ({enrolledStudents.length} học sinh)
                    </h3>
                    <p className="text-xs text-slate-500">
                      {userRole === 'teacher'
                        ? 'Giáo viên có quyền thêm hoặc xóa học sinh ra khỏi nhóm lớp'
                        : 'Danh sách các bạn học cùng lớp'}
                    </p>
                  </div>
                </div>

                {enrolledStudents.length > 0 ? (
                  <div className="space-y-2.5">
                    {enrolledStudents.map((st, idx) => {
                      const isMe = st.id === currentUserId;
                      const isFriend = friendIds.includes(st.id);

                      return (
                        <div
                          key={st.id}
                          className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 hover:border-slate-300 transition-all flex items-center justify-between gap-3 text-xs"
                        >
                          <div className="flex items-center gap-3">
                            <span className="w-6 h-6 rounded-lg bg-white border border-slate-200 font-bold text-slate-500 flex items-center justify-center text-[11px]">
                              {idx + 1}
                            </span>
                            <div className="w-10 h-10 rounded-xl bg-blue-100 overflow-hidden flex items-center justify-center text-blue-700 font-bold text-sm">
                              {st.avatar ? (
                                <img src={st.avatar} alt={st.name} className="w-full h-full object-cover" />
                              ) : (
                                st.name.charAt(0)
                              )}
                            </div>
                            <div>
                              <div className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                                <span>{st.name}</span>
                                {isMe && (
                                  <span className="text-[10px] font-bold bg-blue-100 text-blue-700 px-1.5 py-0.2 rounded">
                                    Bạn
                                  </span>
                                )}
                                {st.tier === 'premium' && (
                                  <span className="text-[9px] font-black uppercase px-1.5 py-0.2 bg-amber-100 text-amber-800 rounded">
                                    Pro
                                  </span>
                                )}
                              </div>
                              <span className="text-slate-400 font-mono text-[11px]">
                                ID: <strong className="text-slate-600">{st.id}</strong> · {st.email}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-3">
                            {/* Nút Kết bạn qua ID nhanh */}
                            {!isMe && onQuickAddFriend && (
                              <div>
                                {isFriend ? (
                                  <span className="text-[11px] font-bold text-emerald-600 flex items-center gap-1 bg-white px-2 py-1 rounded-lg border border-emerald-200">
                                    <Check size={12} />
                                    <span>Bạn bè</span>
                                  </span>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => onQuickAddFriend(st.id)}
                                    className="px-2.5 py-1 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-600 font-bold text-[11px] flex items-center gap-1 transition-colors"
                                  >
                                    <UserPlus size={12} />
                                    <span>Kết bạn</span>
                                  </button>
                                )}
                              </div>
                            )}

                            {/* Remove Student Button (Teacher Only) */}
                            {userRole === 'teacher' && (
                              <button
                                onClick={() => setStudentToRemove({ id: st.id, name: st.name })}
                                title="Xóa học sinh ra khỏi lớp"
                                className="p-2 rounded-xl text-rose-500 hover:text-rose-700 hover:bg-rose-50 transition-colors"
                              >
                                <UserMinus size={16} />
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="py-12 text-center text-slate-400">
                    <Users size={40} className="mx-auto text-slate-300 mb-2" />
                    <p className="font-bold text-sm text-slate-600">Chưa có học sinh nào trong lớp này</p>
                    <p className="text-xs text-slate-400 mt-1">
                      Hãy bấm "+ Thêm Học Sinh" hoặc gửi mã lớp <strong className="font-mono text-slate-700">{currentClass.code}</strong> cho học sinh.
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* TAB 3: DUYỆT THÀNH VIÊN VÀO NHÓM LỚP (GIÁO VIÊN) */}
            {activeRightTab === 'approvals' && userRole === 'teacher' && (
              <div className="p-6 space-y-6 flex-1 animate-in fade-in duration-150">
                {/* Header & Chế độ kiểm duyệt */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
                  <div>
                    <h3 className="font-extrabold text-base text-slate-900 flex items-center gap-2">
                      <UserCheck size={20} className="text-amber-600" />
                      <span>Xét Duyệt Thành Viên Xin Vào Lớp</span>
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Phê duyệt học sinh nhập mã lớp <strong className="font-mono text-blue-600">{currentClass.code}</strong> để chính thức vào lớp.
                    </p>
                  </div>

                  {/* Toggle Mode Bắt Buộc Duyệt */}
                  <div className="flex items-center gap-3 p-3 rounded-2xl bg-slate-50 border border-slate-200 shrink-0">
                    <div className="text-right">
                      <span className="text-[11px] font-bold text-slate-800 block">Chế độ duyệt thành viên</span>
                      <span className="text-[10px] text-slate-500">
                        {currentClass.requiresApproval !== false ? 'Bắt buộc phê duyệt' : 'Tự do vào lớp'}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={handleToggleRequiresApproval}
                      className={`w-12 h-6 flex items-center rounded-full p-1 cursor-pointer transition-colors ${
                        currentClass.requiresApproval !== false ? 'bg-amber-600 justify-end' : 'bg-slate-300 justify-start'
                      }`}
                      title="Bật/Tắt chế độ kiểm duyệt học sinh khi nhập mã vào lớp"
                    >
                      <span className="w-4 h-4 rounded-full bg-white shadow-md transform transition-transform" />
                    </button>
                  </div>
                </div>

                {/* Thông báo thao tác duyệt */}
                {approvalActionSuccess && (
                  <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center gap-2 animate-in fade-in">
                    <CheckCircle2 size={16} />
                    <span>{approvalActionSuccess}</span>
                  </div>
                )}

                {/* Danh sách học sinh chờ duyệt */}
                {pendingStudents.length === 0 ? (
                  <div className="py-16 text-center text-slate-400 space-y-3">
                    <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto border border-emerald-200 shadow-2xs">
                      <UserCheck size={28} />
                    </div>
                    <div>
                      <h4 className="font-extrabold text-sm text-slate-800">Không Có Học Sinh Chờ Duyệt</h4>
                      <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
                        Tất cả các yêu cầu gia nhập lớp <strong>{currentClass.name}</strong> đã được xử lý hoàn tất!
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-slate-700">
                        Danh sách đang chờ phê duyệt ({pendingStudents.length} học sinh):
                      </span>
                      <button
                        type="button"
                        onClick={handleApproveAllPending}
                        className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-2xs transition-colors"
                      >
                        <CheckCheck size={14} />
                        <span>Duyệt Tất Cả</span>
                      </button>
                    </div>

                    <div className="grid grid-cols-1 gap-3">
                      {pendingStudents.map((st) => (
                        <div
                          key={st.id}
                          className="p-4 rounded-2xl bg-white border border-slate-200 hover:border-amber-300 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-11 h-11 rounded-2xl bg-amber-50 border border-amber-200 overflow-hidden flex items-center justify-center font-bold text-amber-700 shrink-0">
                              {st.avatar ? (
                                <img src={st.avatar} alt={st.name} className="w-full h-full object-cover" />
                              ) : (
                                st.name.charAt(0)
                              )}
                            </div>
                            <div className="space-y-0.5">
                              <div className="flex items-center gap-2">
                                <h5 className="font-extrabold text-sm text-slate-900">{st.name}</h5>
                                <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-bold text-[10px]">
                                  Chờ phê duyệt
                                </span>
                              </div>
                              <p className="text-xs text-slate-500 font-mono">
                                ID: <strong className="text-slate-700">{st.id}</strong> · {st.email}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                            <button
                              type="button"
                              onClick={() => handleRejectStudent(st.id)}
                              className="px-3.5 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs border border-rose-200 flex items-center gap-1.5 transition-colors"
                            >
                              <UserX size={14} />
                              <span>Từ Chối</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => handleApproveStudent(st.id)}
                              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-xs transition-colors"
                            >
                              <CheckCircle size={14} />
                              <span>Chấp Nhận</span>
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: LIGHTBOX PHÓNG TO ẢNH TRONG CHAT                                   */}
      {/* ========================================================================= */}
      {lightboxImageUrl && (
        <div
          onClick={() => setLightboxImageUrl(null)}
          className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs cursor-pointer animate-in fade-in"
        >
          <div className="relative max-w-3xl w-full max-h-[90vh] flex flex-col items-center">
            <button
              onClick={() => setLightboxImageUrl(null)}
              className="absolute -top-10 right-0 text-white hover:text-slate-200 p-2"
            >
              <X size={24} />
            </button>
            <img
              src={lightboxImageUrl}
              alt="Phóng to ảnh"
              className="max-h-[85vh] w-auto max-w-full rounded-2xl shadow-2xl object-contain bg-white"
            />
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 1: TẠO LỚP HỌC MỚI (GIÁO VIÊN)                                       */}
      {/* ========================================================================= */}
      {showCreateClassModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-8 space-y-5 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-extrabold text-base text-slate-900">Tạo Nhóm Lớp Mới</h3>
              <button onClick={() => setShowCreateClassModal(false)} className="text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="space-y-1">
                <label className="font-bold text-slate-700">Tên lớp học</label>
                <input
                  type="text"
                  value={newClassName}
                  onChange={(e) => setNewClassName(e.target.value)}
                  placeholder="Ví dụ: Lớp 12A2 Chuyên Toán"
                  className="w-full h-11 px-3 rounded-xl border border-slate-300 text-sm focus:border-blue-600 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-slate-700">Khối lớp</label>
                  <select
                    value={newClassGrade}
                    onChange={(e) => setNewClassGrade(Number(e.target.value) as any)}
                    className="w-full h-11 px-3 rounded-xl border border-slate-300 text-sm bg-white focus:border-blue-600 focus:outline-none"
                  >
                    <option value={12}>Khối 12</option>
                    <option value={11}>Khối 11</option>
                    <option value={10}>Khối 10</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-slate-700">Mã lớp (Tùy chọn)</label>
                  <input
                    type="text"
                    value={newClassCode}
                    onChange={(e) => setNewClassCode(e.target.value.toUpperCase())}
                    placeholder="VD: NBK-12A2"
                    className="w-full h-11 px-3 rounded-xl border border-slate-300 text-sm font-mono font-bold uppercase focus:border-blue-600 focus:outline-none"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700">Mô tả lớp học</label>
                <textarea
                  rows={2}
                  value={newClassDesc}
                  onChange={(e) => setNewClassDesc(e.target.value)}
                  placeholder="Mô tả mục tiêu học tập của lớp..."
                  className="w-full p-2.5 rounded-xl border border-slate-300 text-xs focus:border-blue-600 focus:outline-none"
                />
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setShowCreateClassModal(false)}
                className="flex-1 py-2.5 rounded-xl border border-slate-300 text-xs font-bold text-slate-700 hover:bg-slate-50"
              >
                Hủy
              </button>
              <button
                onClick={handleCreateClass}
                disabled={!newClassName.trim()}
                className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold text-xs shadow-xs"
              >
                Tạo Lớp
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: THÊM HỌC SINH VÀO LỚP (GIÁO VIÊN - CHỈ THÊM TÀI KHOẢN ADMIN TẠO)  */}
      {/* ========================================================================= */}
      {showAddStudentModal && currentClass && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 space-y-5 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="font-extrabold text-base text-slate-900">Thêm Học Sinh Vào Lớp</h3>
                <p className="text-xs text-blue-600 font-semibold">{currentClass.name}</p>
              </div>
              <button onClick={() => setShowAddStudentModal(false)} className="text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
            </div>

            {/* Phân quyền an ninh: Chỉ admin mới có quyền tạo tài khoản */}
            <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs space-y-1">
              <div className="flex items-center gap-1.5 font-bold text-amber-950">
                <ShieldAlert size={16} className="text-amber-600" />
                <span>Quy định phân quyền RBAC:</span>
              </div>
              <p className="text-[11px] leading-relaxed">
                Chỉ <strong>Quản Trị Viên (Admin)</strong> mới có quyền cấp mới tài khoản cho Giáo viên và Học sinh. Giáo viên chỉ thêm học sinh đã có tài khoản vào lớp học.
              </p>
            </div>

            {studentLookupError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold">
                {studentLookupError}
              </div>
            )}

            {/* Cách 1: Chọn từ danh sách học sinh đã được Admin cấp tài khoản */}
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                <span>Cách 1: Chọn từ danh bạ học sinh nhà trường</span>
                <span className="text-slate-400">({availableStudentsToAdd.length} học sinh)</span>
              </div>

              <div className="relative">
                <Search size={14} className="absolute left-3 top-3 text-slate-400" />
                <input
                  type="text"
                  value={searchStudentTerm}
                  onChange={(e) => setSearchStudentTerm(e.target.value)}
                  placeholder="Tìm kiếm theo tên, email hoặc mã ID..."
                  className="w-full h-10 pl-9 pr-3 rounded-xl border border-slate-300 text-xs focus:border-blue-600 focus:outline-none"
                />
              </div>

              <div className="max-h-48 overflow-y-auto space-y-1.5 border border-slate-200 rounded-2xl p-2 bg-slate-50">
                {availableStudentsToAdd.length > 0 ? (
                  availableStudentsToAdd.map((st) => (
                    <label
                      key={st.id}
                      className={`p-2.5 rounded-xl border flex items-center justify-between text-xs cursor-pointer transition-colors ${
                        selectedStudentToAdd === st.id ? 'bg-blue-100 border-blue-400 font-bold' : 'bg-white border-slate-200'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <input
                          type="radio"
                          name="studentRadio"
                          checked={selectedStudentToAdd === st.id}
                          onChange={() => {
                            setSelectedStudentToAdd(st.id);
                            setManualStudentIdLookup('');
                            setStudentLookupError(null);
                          }}
                          className="text-blue-600 focus:ring-blue-500"
                        />
                        <span>{st.name}</span>
                        <span className="text-slate-400 font-mono text-[11px]">({st.id})</span>
                      </div>
                      <span className="text-[10px] text-slate-500 font-semibold">Khối {st.grade}</span>
                    </label>
                  ))
                ) : (
                  <p className="text-center text-xs text-slate-400 py-4">Không tìm thấy học sinh nào phù hợp</p>
                )}
              </div>
            </div>

            {/* Cách 2: Nhập Mã ID học sinh có sẵn trong hệ thống */}
            <div className="space-y-2 pt-3 border-t border-slate-100">
              <span className="text-xs font-bold text-slate-700 block">
                Cách 2: Hoặc nhập mã ID học sinh đã đăng ký
              </span>
              <input
                type="text"
                value={manualStudentIdLookup}
                onChange={(e) => {
                  setManualStudentIdLookup(e.target.value);
                  if (e.target.value) setSelectedStudentToAdd('');
                  setStudentLookupError(null);
                }}
                placeholder="Nhập mã ID học sinh (Ví dụ: usr_student_06)"
                className="w-full h-10 px-3 rounded-xl border border-slate-300 text-xs font-mono bg-white focus:border-blue-600 focus:outline-none"
              />
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setShowAddStudentModal(false)}
                className="flex-1 py-2.5 rounded-xl border border-slate-300 text-xs font-bold text-slate-700 hover:bg-slate-50"
              >
                Hủy
              </button>
              <button
                onClick={handleAddStudentToClass}
                disabled={!selectedStudentToAdd && !manualStudentIdLookup.trim()}
                className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold text-xs shadow-xs"
              >
                Thêm Vào Lớp
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: XÁC NHẬN XÓA HỌC SINH KHỎI LỚP (GIÁO VIÊN)                       */}
      {/* ========================================================================= */}
      {studentToRemove && currentClass && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
              <UserMinus size={24} />
            </div>

            <div className="text-center space-y-1">
              <h4 className="text-base font-black text-slate-900">Xác Nhận Xóa Học Sinh Khỏi Lớp</h4>
              <p className="text-xs text-slate-500">
                Bạn có chắc chắn muốn xóa học sinh <strong className="text-slate-800">{studentToRemove.name}</strong> ra khỏi lớp <strong>{currentClass.name}</strong> không?
              </p>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setStudentToRemove(null)}
                className="flex-1 py-2.5 rounded-xl border border-slate-300 text-xs font-bold text-slate-700 hover:bg-slate-50"
              >
                Hủy Bỏ
              </button>
              <button
                onClick={confirmRemoveStudent}
                className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-xs"
              >
                Xác Nhận Xóa
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 4: XÁC NHẬN GIÁO VIÊN XÓA ĐỀ THI ĐÃ GIAO KHỎI LỚP                   */}
      {/* ========================================================================= */}
      {examToRemoveFromClass && currentClass && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
              <Trash2 size={24} />
            </div>

            <div className="text-center space-y-1.5">
              <h4 className="text-base font-black text-slate-900">Xóa Đề Thi Đã Giao Khỏi Lớp?</h4>
              <p className="text-xs text-slate-500 leading-relaxed">
                Thầy/Cô có chắc chắn muốn xóa đề thi{' '}
                <strong className="text-slate-900 font-bold">"{examToRemoveFromClass.title}"</strong>{' '}
                khỏi nhóm lớp <strong className="text-blue-600 font-bold">{currentClass.name}</strong> không?
              </p>
              <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-[11px] text-left">
                ⚠️ <strong>Lưu ý:</strong> Sau khi xóa, học sinh trong nhóm lớp này sẽ không còn thấy đề thi trong danh sách làm bài. Điểm số các bài đã nộp trước đó vẫn được lưu trữ trong Bảng Điểm.
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setExamToRemoveFromClass(null)}
                className="flex-1 py-2.5 rounded-xl border border-slate-300 text-xs font-bold text-slate-700 hover:bg-slate-50"
              >
                Hủy Bỏ
              </button>
              <button
                type="button"
                onClick={handleConfirmRemoveExamFromClass}
                className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-xs"
              >
                Xác Nhận Xóa
              </button>
            </div>
          </div>
        </div>
      )}
      {/* ========================================================================= */}
      {/* MODAL 5: GIÁO VIÊN ĐĂNG TẢI CHƯƠNG HỌC & BÀI HỌC MỚI (MỤC LỤC LỚP)        */}
      {/* ========================================================================= */}
      {showAddLessonModal && currentClass && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 sm:p-7 space-y-4 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-blue-100 text-blue-600 flex items-center justify-center shadow-2xs">
                  <FolderPlus size={20} />
                </div>
                <div>
                  <h4 className="text-base font-extrabold text-slate-900">
                    Đăng Tải Chương Học & Bài Học Mới
                  </h4>
                  <span className="text-[11px] text-slate-500">
                    Lớp: <strong className="text-blue-600">{currentClass.name}</strong> (Khối {currentClass.grade})
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowAddLessonModal(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {newLessonError && (
              <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold flex items-center gap-2">
                <AlertTriangle size={15} />
                <span>{newLessonError}</span>
              </div>
            )}

            <form onSubmit={handleCreateLessonSubmit} className="space-y-4 text-xs">
              {/* Chọn hoặc nhập Chương học */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-slate-700">Tên Chương học / Chuyên đề *</label>
                  <span className="text-[10px] text-blue-600 font-semibold">Gợi ý chương GDPT</span>
                </div>
                <input
                  type="text"
                  list="suggested-chapters"
                  value={newLessonChapter}
                  onChange={(e) => setNewLessonChapter(e.target.value)}
                  placeholder="Ví dụ: Chương 1: Ứng dụng đạo hàm để khảo sát hàm số"
                  className="w-full h-10 px-3 rounded-xl border border-slate-300 font-semibold focus:border-blue-600 focus:outline-none"
                  required
                />
                <datalist id="suggested-chapters">
                  <option value="Chương 1: Ứng dụng đạo hàm để khảo sát hàm số" />
                  <option value="Chương 2: Tọa độ trong không gian Oxyz" />
                  <option value="Chương 3: Nguyên hàm, Tích phân và Ứng dụng" />
                  <option value="Chương 4: Các số đặc trưng đo mức độ phân tán của mẫu số liệu ghép nhóm" />
                  <option value="Chương 5: Xác suất có điều kiện và Công thức Bayes" />
                  <option value="Chuyên đề: Phương pháp tọa độ hóa giải hình không gian" />
                </datalist>
              </div>

              {/* Tên bài học */}
              <div className="space-y-1">
                <label className="font-bold text-slate-700">Tên Bài học *</label>
                <input
                  type="text"
                  value={newLessonTitle}
                  onChange={(e) => setNewLessonTitle(e.target.value)}
                  placeholder="Ví dụ: Bài 1: Tính đơn điệu và cực trị của hàm số"
                  className="w-full h-10 px-3 rounded-xl border border-slate-300 font-semibold focus:border-blue-600 focus:outline-none"
                  required
                />
              </div>

              {/* Mô tả ngắn */}
              <div className="space-y-1">
                <label className="font-bold text-slate-700">Mô tả tóm tắt mục tiêu bài học</label>
                <input
                  type="text"
                  value={newLessonDesc}
                  onChange={(e) => setNewLessonDesc(e.target.value)}
                  placeholder="Tóm tắt trọng tâm kiến thức và mục tiêu rèn luyện..."
                  className="w-full h-10 px-3 rounded-xl border border-slate-300 focus:border-blue-600 focus:outline-none"
                />
              </div>

              {/* KHUNG 1: Ô BÀI HỌC (LÝ THUYẾT & GẮN FILE PDF BÀI HỌC) */}
              <div className="p-4 rounded-2xl bg-blue-50/50 border border-blue-200/90 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 font-extrabold text-blue-900 text-xs">
                    <BookOpen size={16} className="text-blue-600" />
                    <span>Ô BÀI HỌC (Lý thuyết & Trọng tâm kiến thức)</span>
                  </div>
                  <span className="text-[10px] text-blue-600 font-semibold">Hỗ trợ $công thức$ KaTeX</span>
                </div>

                <textarea
                  rows={4}
                  value={newLessonTheory}
                  onChange={(e) => setNewLessonTheory(e.target.value)}
                  placeholder="Nhập kiến thức trọng tâm, định lý, công thức (VD: Cho hàm số y = f(x) có đạo hàm f'(x)...)"
                  className="w-full p-3 rounded-xl border border-slate-300 bg-white font-mono text-xs focus:border-blue-600 focus:outline-none"
                />

                {/* Gắn file PDF cho Ô Bài Học */}
                <div className="space-y-1.5 pt-1">
                  <label className="font-bold text-slate-700 flex items-center justify-between">
                    <span className="flex items-center gap-1 text-slate-800">
                      <Paperclip size={13} className="text-blue-600" />
                      <span>Gắn file PDF cho Ô Bài học:</span>
                    </span>
                    <span className="text-[10px] text-slate-400">File PDF tối đa ~10MB</span>
                  </label>

                  <input
                    type="file"
                    ref={lessonPdfInputRef}
                    accept=".pdf,application/pdf"
                    onChange={handleLessonPdfSelect}
                    className="hidden"
                  />

                  {newLessonPdfFile ? (
                    <div className="p-2.5 rounded-xl bg-white border border-blue-300 flex items-center justify-between gap-3 text-xs shadow-2xs">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center font-bold text-[10px]">
                          PDF
                        </div>
                        <div>
                          <span className="font-bold text-slate-900 block truncate max-w-xs">{newLessonPdfFile.fileName}</span>
                          <span className="text-[10px] text-blue-600 font-semibold">{newLessonPdfFile.fileSize} · File PDF bài học đã sẵn sàng</span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setNewLessonPdfFile(null)}
                        className="p-1 rounded-lg text-rose-500 hover:bg-rose-50 transition-colors"
                        title="Xóa file PDF bài học này"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => lessonPdfInputRef.current?.click()}
                      className="w-full py-2.5 px-3 rounded-xl border-2 border-dashed border-blue-300 hover:border-blue-500 bg-white hover:bg-blue-50/50 text-blue-700 font-bold text-xs flex items-center justify-center gap-2 transition-all"
                    >
                      <Upload size={14} />
                      <span>+ Chọn & Gắn File PDF Bài Học Từ Máy</span>
                    </button>
                  )}
                </div>
              </div>

              {/* KHUNG 2: Ô LUYỆN TẬP (BÀI TẬP RÈN LUYỆN & GẮN FILE PDF LUYỆN TẬP) */}
              <div className="p-4 rounded-2xl bg-amber-50/50 border border-amber-200/90 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 font-extrabold text-amber-900 text-xs">
                    <ListChecks size={16} className="text-amber-600" />
                    <span>Ô LUYỆN TẬP (Hệ thống câu hỏi bài tập rèn luyện)</span>
                  </div>
                  <span className="text-[10px] text-amber-700 font-semibold">Thay thế bài tập giao thêm</span>
                </div>

                <textarea
                  rows={4}
                  value={newLessonPractice}
                  onChange={(e) => setNewLessonPractice(e.target.value)}
                  placeholder="Nhập hệ thống bài tập luyện tập, ví dụ mẫu hoặc câu hỏi rèn luyện cho học sinh..."
                  className="w-full p-3 rounded-xl border border-slate-300 bg-white font-mono text-xs focus:border-amber-600 focus:outline-none"
                />

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  {/* Số câu bài tập luyện tập */}
                  <div className="space-y-1">
                    <label className="font-bold text-slate-700">Số câu bài tập luyện tập</label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={newLessonExercisesCount}
                      onChange={(e) => setNewLessonExercisesCount(parseInt(e.target.value) || 0)}
                      className="w-full h-10 px-3 rounded-xl border border-slate-300 bg-white font-bold focus:border-amber-600 focus:outline-none"
                    />
                  </div>

                  {/* Gắn file PDF cho Ô Luyện Tập */}
                  <div className="space-y-1">
                    <label className="font-bold text-slate-700 flex items-center justify-between">
                      <span className="flex items-center gap-1 text-slate-800">
                        <Paperclip size={13} className="text-amber-600" />
                        <span>Gắn file PDF Luyện tập:</span>
                      </span>
                      <span className="text-[10px] text-slate-400">PDF ~10MB</span>
                    </label>

                    <input
                      type="file"
                      ref={practicePdfInputRef}
                      accept=".pdf,application/pdf"
                      onChange={handlePracticePdfSelect}
                      className="hidden"
                    />

                    {newLessonPracticePdfFile ? (
                      <div className="p-2 rounded-xl bg-white border border-amber-300 flex items-center justify-between gap-2 text-xs shadow-2xs">
                        <div className="flex items-center gap-1.5 overflow-hidden">
                          <div className="w-7 h-7 rounded-lg bg-amber-600 text-white flex items-center justify-center font-bold text-[9px] shrink-0">
                            PDF
                          </div>
                          <span className="font-bold text-slate-900 truncate text-[11px]">{newLessonPracticePdfFile.fileName}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setNewLessonPracticePdfFile(null)}
                          className="p-1 rounded-lg text-rose-500 hover:bg-rose-50 shrink-0"
                          title="Xóa file PDF luyện tập"
                        >
                          <X size={15} />
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => practicePdfInputRef.current?.click()}
                        className="w-full h-10 px-2 rounded-xl border-2 border-dashed border-amber-300 hover:border-amber-500 bg-white hover:bg-amber-50/50 text-amber-700 font-bold text-xs flex items-center justify-center gap-1.5 transition-all"
                      >
                        <Upload size={13} />
                        <span>+ Gắn PDF Luyện Tập</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Link tài liệu trực tuyến */}
              <div className="space-y-1">
                <label className="font-bold text-slate-700">Link tài liệu trực tuyến (Tùy chọn)</label>
                <input
                  type="url"
                  value={newLessonExternalLink}
                  onChange={(e) => setNewLessonExternalLink(e.target.value)}
                  placeholder="https://drive.google.com/... hoặc link video bài giảng"
                  className="w-full h-10 px-3 rounded-xl border border-slate-300 focus:border-blue-600 focus:outline-none"
                />
              </div>

              <div className="flex gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddLessonModal(false)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-300 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-xs transition-colors flex items-center justify-center gap-1.5"
                >
                  <CheckCircle2 size={15} />
                  <span>Đăng Tải Bài Học Lên Lớp</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 5B: GIÁO VIÊN CHỈNH SỬA BÀI HỌC ĐÃ ĐĂNG                              */}
      {/* ========================================================================= */}
      {showEditLessonModal && currentClass && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 sm:p-7 space-y-4 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-amber-100 text-amber-600 flex items-center justify-center shadow-2xs">
                  <Pencil size={20} />
                </div>
                <div>
                  <h4 className="text-base font-extrabold text-slate-900">
                    Chỉnh Sửa Bài Học Đã Đăng
                  </h4>
                  <span className="text-[11px] text-slate-500">
                    Lớp: <strong className="text-blue-600">{currentClass.name}</strong> · Giáo viên có quyền cập nhật lý thuyết, ô luyện tập và file PDF
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowEditLessonModal(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {editLessonError && (
              <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold flex items-center gap-2">
                <AlertTriangle size={15} />
                <span>{editLessonError}</span>
              </div>
            )}

            <form onSubmit={handleEditLessonSubmit} className="space-y-4 text-xs">
              {/* Sửa Chương học */}
              <div className="space-y-1">
                <label className="font-bold text-slate-700">Tên Chương học / Chuyên đề *</label>
                <input
                  type="text"
                  list="suggested-chapters"
                  value={editLessonChapter}
                  onChange={(e) => setEditLessonChapter(e.target.value)}
                  placeholder="Ví dụ: Chương 1: Ứng dụng đạo hàm để khảo sát hàm số"
                  className="w-full h-10 px-3 rounded-xl border border-slate-300 font-semibold focus:border-amber-600 focus:outline-none"
                  required
                />
              </div>

              {/* Sửa Tên bài học */}
              <div className="space-y-1">
                <label className="font-bold text-slate-700">Tên Bài học *</label>
                <input
                  type="text"
                  value={editLessonTitle}
                  onChange={(e) => setEditLessonTitle(e.target.value)}
                  placeholder="Ví dụ: Bài 1: Tính đơn điệu và cực trị của hàm số"
                  className="w-full h-10 px-3 rounded-xl border border-slate-300 font-semibold focus:border-amber-600 focus:outline-none"
                  required
                />
              </div>

              {/* Sửa Mô tả */}
              <div className="space-y-1">
                <label className="font-bold text-slate-700">Mô tả tóm tắt mục tiêu bài học</label>
                <input
                  type="text"
                  value={editLessonDesc}
                  onChange={(e) => setEditLessonDesc(e.target.value)}
                  placeholder="Tóm tắt trọng tâm kiến thức và mục tiêu rèn luyện..."
                  className="w-full h-10 px-3 rounded-xl border border-slate-300 focus:border-amber-600 focus:outline-none"
                />
              </div>

              {/* KHUNG SỬA 1: Ô BÀI HỌC (LÝ THUYẾT & GẮN FILE PDF BÀI HỌC) */}
              <div className="p-4 rounded-2xl bg-blue-50/50 border border-blue-200/90 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 font-extrabold text-blue-900 text-xs">
                    <BookOpen size={16} className="text-blue-600" />
                    <span>Ô BÀI HỌC (Lý thuyết & Trọng tâm kiến thức)</span>
                  </div>
                  <span className="text-[10px] text-blue-600 font-semibold">KaTeX $công thức$</span>
                </div>

                <textarea
                  rows={4}
                  value={editLessonTheory}
                  onChange={(e) => setEditLessonTheory(e.target.value)}
                  placeholder="Nhập kiến thức trọng tâm, định lý, công thức..."
                  className="w-full p-3 rounded-xl border border-slate-300 bg-white font-mono text-xs focus:border-blue-600 focus:outline-none"
                />

                {/* Quản lý file PDF cho Ô Bài Học */}
                <div className="space-y-1.5 pt-1">
                  <label className="font-bold text-slate-700 flex items-center justify-between">
                    <span className="flex items-center gap-1 text-slate-800">
                      <Paperclip size={13} className="text-blue-600" />
                      <span>File PDF cho Ô Bài học:</span>
                    </span>
                    <span className="text-[10px] text-slate-400">PDF tối đa ~10MB</span>
                  </label>

                  <input
                    type="file"
                    ref={editLessonPdfInputRef}
                    accept=".pdf,application/pdf"
                    onChange={handleEditLessonPdfSelect}
                    className="hidden"
                  />

                  {editLessonPdfFile ? (
                    <div className="p-2.5 rounded-xl bg-white border border-blue-300 flex items-center justify-between gap-3 text-xs shadow-2xs">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center font-bold text-[10px]">
                          PDF
                        </div>
                        <div>
                          <span className="font-bold text-slate-900 block truncate max-w-xs">{editLessonPdfFile.fileName}</span>
                          <span className="text-[10px] text-blue-600 font-semibold">{editLessonPdfFile.fileSize} · File PDF bài học hiện tại</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => editLessonPdfInputRef.current?.click()}
                          className="px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 font-bold text-[11px] transition-colors"
                        >
                          Đổi File PDF
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditLessonPdfFile(null)}
                          className="p-1 rounded-lg text-rose-500 hover:bg-rose-50 transition-colors"
                          title="Xóa file PDF này"
                        >
                          <X size={16} />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => editLessonPdfInputRef.current?.click()}
                      className="w-full py-2.5 px-3 rounded-xl border-2 border-dashed border-blue-300 hover:border-blue-500 bg-white hover:bg-blue-50/50 text-blue-700 font-bold text-xs flex items-center justify-center gap-2 transition-all"
                    >
                      <Upload size={14} />
                      <span>+ Gắn File PDF Bài Học Mới</span>
                    </button>
                  )}
                </div>
              </div>

              {/* KHUNG SỬA 2: Ô LUYỆN TẬP (BÀI TẬP RÈN LUYỆN & GẮN FILE PDF LUYỆN TẬP) */}
              <div className="p-4 rounded-2xl bg-amber-50/50 border border-amber-200/90 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 font-extrabold text-amber-900 text-xs">
                    <ListChecks size={16} className="text-amber-600" />
                    <span>Ô LUYỆN TẬP (Bài tập rèn luyện & Hệ thống ví dụ)</span>
                  </div>
                  <span className="text-[10px] text-amber-700 font-semibold">Thay thế bài tập giao thêm</span>
                </div>

                <textarea
                  rows={4}
                  value={editLessonPractice}
                  onChange={(e) => setEditLessonPractice(e.target.value)}
                  placeholder="Nhập hệ thống bài tập luyện tập, ví dụ mẫu hoặc câu hỏi rèn luyện cho học sinh..."
                  className="w-full p-3 rounded-xl border border-slate-300 bg-white font-mono text-xs focus:border-amber-600 focus:outline-none"
                />

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  {/* Sửa Số câu luyện tập */}
                  <div className="space-y-1">
                    <label className="font-bold text-slate-700">Số câu bài tập luyện tập</label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={editLessonExercisesCount}
                      onChange={(e) => setEditLessonExercisesCount(parseInt(e.target.value) || 0)}
                      className="w-full h-10 px-3 rounded-xl border border-slate-300 bg-white font-bold focus:border-amber-600 focus:outline-none"
                    />
                  </div>

                  {/* Quản lý file PDF cho Ô Luyện Tập */}
                  <div className="space-y-1">
                    <label className="font-bold text-slate-700 flex items-center justify-between">
                      <span className="flex items-center gap-1 text-slate-800">
                        <Paperclip size={13} className="text-amber-600" />
                        <span>File PDF Luyện tập:</span>
                      </span>
                      <span className="text-[10px] text-slate-400">PDF ~10MB</span>
                    </label>

                    <input
                      type="file"
                      ref={editPracticePdfInputRef}
                      accept=".pdf,application/pdf"
                      onChange={handleEditPracticePdfSelect}
                      className="hidden"
                    />

                    {editLessonPracticePdfFile ? (
                      <div className="p-2 rounded-xl bg-white border border-amber-300 flex items-center justify-between gap-2 text-xs shadow-2xs">
                        <div className="flex items-center gap-1.5 overflow-hidden">
                          <div className="w-7 h-7 rounded-lg bg-amber-600 text-white flex items-center justify-center font-bold text-[9px] shrink-0">
                            PDF
                          </div>
                          <span className="font-bold text-slate-900 truncate text-[11px]">{editLessonPracticePdfFile.fileName}</span>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => editPracticePdfInputRef.current?.click()}
                            className="px-2 py-0.5 rounded-lg bg-amber-50 text-amber-800 hover:bg-amber-100 font-bold text-[10px]"
                          >
                            Đổi PDF
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditLessonPracticePdfFile(null)}
                            className="p-1 rounded-lg text-rose-500 hover:bg-rose-50"
                            title="Xóa file PDF luyện tập"
                          >
                            <X size={15} />
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => editPracticePdfInputRef.current?.click()}
                        className="w-full h-10 px-2 rounded-xl border-2 border-dashed border-amber-300 hover:border-amber-500 bg-white hover:bg-amber-50/50 text-amber-700 font-bold text-xs flex items-center justify-center gap-1.5 transition-all"
                      >
                        <Upload size={13} />
                        <span>+ Gắn PDF Luyện Tập Mới</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Link tài liệu trực tuyến */}
              <div className="space-y-1">
                <label className="font-bold text-slate-700">Link tài liệu trực tuyến (Tùy chọn)</label>
                <input
                  type="url"
                  value={editLessonExternalLink}
                  onChange={(e) => setEditLessonExternalLink(e.target.value)}
                  placeholder="https://drive.google.com/..."
                  className="w-full h-10 px-3 rounded-xl border border-slate-300 focus:border-amber-600 focus:outline-none"
                />
              </div>

              <div className="flex gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowEditLessonModal(false)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-300 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  Hủy Bỏ
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow-xs transition-colors flex items-center justify-center gap-1.5"
                >
                  <Save size={15} />
                  <span>Lưu Thay Đổi Bài Học</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 6: XEM CHI TIẾT BÀI HỌC & LUYỆN TẬP (HỌC SINH & GIÁO VIÊN)           */}
      {/* ========================================================================= */}
      {selectedLessonDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 sm:p-8 space-y-5 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-start justify-between gap-3 pb-3 border-b border-slate-100">
              <div className="space-y-1 min-w-0">
                <span className="px-2.5 py-0.5 rounded-md bg-blue-50 text-blue-700 font-bold text-[11px] uppercase tracking-wider inline-block">
                  {selectedLessonDetail.chapter}
                </span>
                <h3 className="text-lg font-black text-slate-900 leading-snug">{selectedLessonDetail.title}</h3>
                <div className="flex items-center gap-2 text-xs text-slate-400 flex-wrap">
                  <span>Giáo viên: <strong className="text-slate-700 font-semibold">{selectedLessonDetail.teacherName}</strong></span>
                  <span>·</span>
                  <span>Ngày đăng: {selectedLessonDetail.createdAt}</span>
                  {selectedLessonDetail.updatedAt && (
                    <>
                      <span>·</span>
                      <span className="text-amber-700 font-semibold bg-amber-50 px-2 py-0.2 rounded-md border border-amber-200">
                        Cập nhật: {selectedLessonDetail.updatedAt}
                      </span>
                    </>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {userRole === 'teacher' && (
                  <button
                    type="button"
                    onClick={() => handleOpenEditLesson(selectedLessonDetail)}
                    className="px-3 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 font-bold text-xs flex items-center gap-1.5 shadow-2xs transition-colors"
                    title="Chỉnh sửa bài học này"
                  >
                    <Pencil size={13} />
                    <span>Sửa Bài Học</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setSelectedLessonDetail(null)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Mục tiêu bài học */}
            {selectedLessonDetail.description && (
              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 text-xs text-slate-700 leading-relaxed">
                <span className="font-bold text-slate-900 block mb-0.5">Mục tiêu bài học:</span>
                {selectedLessonDetail.description}
              </div>
            )}

            {/* Tabs chuyển đổi: Ô Bài Học vs Ô Luyện Tập */}
            <div className="flex items-center gap-2 p-1 rounded-2xl bg-slate-100 border border-slate-200">
              <button
                type="button"
                onClick={() => setLessonDetailTab('theory')}
                className={`flex-1 py-2 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all ${
                  lessonDetailTab === 'theory'
                    ? 'bg-white text-blue-700 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <BookOpen size={15} />
                <span>Ô Bài Học (Lý Thuyết)</span>
                {selectedLessonDetail.pdfAttachment && (
                  <span className="w-2 h-2 rounded-full bg-blue-600 inline-block" title="Có file PDF đính kèm" />
                )}
              </button>

              <button
                type="button"
                onClick={() => setLessonDetailTab('practice')}
                className={`flex-1 py-2 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all ${
                  lessonDetailTab === 'practice'
                    ? 'bg-white text-amber-700 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <ListChecks size={15} />
                <span>Ô Luyện Tập ({selectedLessonDetail.exercisesCount || 10} câu)</span>
                {selectedLessonDetail.practicePdfAttachment && (
                  <span className="w-2 h-2 rounded-full bg-amber-600 inline-block" title="Có file PDF luyện tập" />
                )}
              </button>
            </div>

            {/* TAB 1: Ô BÀI HỌC (LÝ THUYẾT & PDF BÀI HỌC) */}
            {lessonDetailTab === 'theory' && (
              <div className="space-y-4 animate-in fade-in duration-150">
                <div className="space-y-2">
                  <h4 className="font-extrabold text-xs text-slate-800 uppercase tracking-wide flex items-center gap-1.5">
                    <BookOpen size={14} className="text-blue-600" />
                    <span>Nội Dung Trọng Tâm & Công Thức Bài Học:</span>
                  </h4>
                  <div className="p-4 sm:p-5 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-3">
                    {renderFormattedMathText(selectedLessonDetail.theoryContent || selectedLessonDetail.content || 'Nội dung lý thuyết chưa được cập nhật.')}
                  </div>
                </div>

                {/* File PDF Bài Học Gắn Kèm */}
                <div className="space-y-2">
                  <h4 className="font-extrabold text-xs text-slate-800 uppercase tracking-wide flex items-center gap-1.5">
                    <Paperclip size={14} className="text-blue-600" />
                    <span>File PDF Gắn Cho Ô Bài Học:</span>
                  </h4>

                  {selectedLessonDetail.pdfAttachment ? (
                    <div className="p-3.5 rounded-2xl bg-blue-50/80 border border-blue-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center font-black text-xs shrink-0 shadow-2xs">
                          PDF
                        </div>
                        <div>
                          <span className="font-bold text-blue-900 block text-sm">
                            {selectedLessonDetail.pdfAttachment.fileName}
                          </span>
                          <span className="text-[11px] text-blue-700 font-medium">
                            Tài liệu bài học · Dung lượng {selectedLessonDetail.pdfAttachment.fileSize}
                          </span>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() =>
                          handleDownloadPdf(
                            selectedLessonDetail.pdfAttachment!.fileName,
                            selectedLessonDetail.pdfAttachment!.fileData
                          )
                        }
                        className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-2xs transition-colors whitespace-nowrap self-end sm:self-auto"
                      >
                        <Download size={14} />
                        <span>Tải PDF Bài Học</span>
                      </button>
                    </div>
                  ) : (
                    <div className="p-4 rounded-2xl border-2 border-dashed border-slate-200 text-center text-slate-400 text-xs">
                      <p>Chưa có file PDF nào được gắn cho ô bài học này.</p>
                      {userRole === 'teacher' && (
                        <button
                          type="button"
                          onClick={() => handleOpenEditLesson(selectedLessonDetail)}
                          className="mt-1.5 text-blue-600 font-bold hover:underline inline-block"
                        >
                          + Bấm vào đây để gắn file PDF bài học
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* TAB 2: Ô LUYỆN TẬP (BÀI TẬP RÈN LUYỆN & PDF LUYỆN TẬP) */}
            {lessonDetailTab === 'practice' && (
              <div className="space-y-4 animate-in fade-in duration-150">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="font-extrabold text-xs text-slate-800 uppercase tracking-wide flex items-center gap-1.5">
                      <ListChecks size={14} className="text-amber-600" />
                      <span>Hệ Thống Bài Tập Luyện Tập:</span>
                    </h4>
                    <span className="px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-bold">
                      {selectedLessonDetail.exercisesCount || 10} câu rèn luyện
                    </span>
                  </div>

                  <div className="p-4 sm:p-5 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-3">
                    {renderFormattedMathText(
                      selectedLessonDetail.practiceContent ||
                        selectedLessonDetail.exercisesContent ||
                        'Hệ thống bài tập luyện tập đang được cập nhật.'
                    )}
                  </div>
                </div>

                {/* File PDF Luyện Tập Gắn Kèm */}
                <div className="space-y-2">
                  <h4 className="font-extrabold text-xs text-slate-800 uppercase tracking-wide flex items-center gap-1.5">
                    <Paperclip size={14} className="text-amber-600" />
                    <span>File PDF Gắn Cho Ô Luyện Tập:</span>
                  </h4>

                  {selectedLessonDetail.practicePdfAttachment ? (
                    <div className="p-3.5 rounded-2xl bg-amber-50/80 border border-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-amber-600 text-white flex items-center justify-center font-black text-xs shrink-0 shadow-2xs">
                          PDF
                        </div>
                        <div>
                          <span className="font-bold text-amber-950 block text-sm">
                            {selectedLessonDetail.practicePdfAttachment.fileName}
                          </span>
                          <span className="text-[11px] text-amber-800 font-medium">
                            Phiếu bài tập luyện tập · Dung lượng {selectedLessonDetail.practicePdfAttachment.fileSize}
                          </span>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() =>
                          handleDownloadPdf(
                            selectedLessonDetail.practicePdfAttachment!.fileName,
                            selectedLessonDetail.practicePdfAttachment!.fileData
                          )
                        }
                        className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-2xs transition-colors whitespace-nowrap self-end sm:self-auto"
                      >
                        <Download size={14} />
                        <span>Tải Phiếu Luyện Tập (PDF)</span>
                      </button>
                    </div>
                  ) : (
                    <div className="p-4 rounded-2xl border-2 border-dashed border-slate-200 text-center text-slate-400 text-xs">
                      <p>Chưa có file PDF nào được gắn cho ô luyện tập này.</p>
                      {userRole === 'teacher' && (
                        <button
                          type="button"
                          onClick={() => handleOpenEditLesson(selectedLessonDetail)}
                          className="mt-1.5 text-amber-600 font-bold hover:underline inline-block"
                        >
                          + Bấm vào đây để gắn file PDF luyện tập
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Link tài liệu trực tuyến nếu có */}
            {selectedLessonDetail.externalLink && (
              <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2 text-slate-700 truncate">
                  <ExternalLink size={14} className="text-blue-600 shrink-0" />
                  <span className="font-bold">Link tham khảo trực tuyến:</span>
                  <span className="text-slate-500 font-mono truncate">{selectedLessonDetail.externalLink}</span>
                </div>
                <a
                  href={selectedLessonDetail.externalLink}
                  target="_blank"
                  rel="noreferrer"
                  className="px-3 py-1.5 rounded-xl bg-white text-blue-700 font-bold border border-slate-200 hover:bg-slate-100 shrink-0 transition-colors"
                >
                  Mở Link
                </a>
              </div>
            )}

            {/* Footer action */}
            <div className="flex items-center justify-between gap-3 pt-3 border-t border-slate-100 flex-wrap">
              {userRole === 'student' ? (
                <button
                  type="button"
                  onClick={() => {
                    handleToggleCompleteLesson(selectedLessonDetail.id);
                    setSelectedLessonDetail((prev) =>
                      prev
                        ? {
                            ...prev,
                            completedStudentIds: prev.completedStudentIds?.includes(currentUserId)
                              ? prev.completedStudentIds.filter((id) => id !== currentUserId)
                              : [...(prev.completedStudentIds || []), currentUserId],
                          }
                        : null
                    );
                  }}
                  className={`px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-1.5 shadow-xs transition-colors ${
                    selectedLessonDetail.completedStudentIds?.includes(currentUserId)
                      ? 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                  }`}
                >
                  <CheckCircle2 size={16} />
                  <span>
                    {selectedLessonDetail.completedStudentIds?.includes(currentUserId)
                      ? 'Đã Đánh Dấu Hoàn Thành'
                      : 'Đánh Dấu Đã Học Xong (+25 XP)'}
                  </span>
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-500 font-semibold">
                    {selectedLessonDetail.completedStudentIds?.length || 0} học sinh đã học bài này
                  </span>
                  <button
                    type="button"
                    onClick={() => handleOpenEditLesson(selectedLessonDetail)}
                    className="px-3 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 font-bold text-xs flex items-center gap-1 transition-colors"
                  >
                    <Pencil size={13} />
                    <span>Chỉnh Sửa</span>
                  </button>
                </div>
              )}

              <button
                type="button"
                onClick={() => setSelectedLessonDetail(null)}
                className="px-5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition-colors ml-auto"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
