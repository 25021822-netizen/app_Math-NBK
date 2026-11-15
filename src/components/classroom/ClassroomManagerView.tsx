import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Classroom, ClassroomLesson, UserProfile, UserRole, Exam, ClassroomChatMessage, ChatMention, ScoreVisibilityMode, getExamScoreVisibilityLabel } from '../../types/math';
import { SAMPLE_STUDENTS, SAMPLE_CLASSROOM_LESSONS } from '../../data/mockData';
import { dbFetchClassMessages, dbFetchLessons, dbUploadPdfFile, dbSaveExam, dbSaveClassrooms } from '../../services/dbSyncService';
import { MathView } from '../MathView';
import { DeleteConfirmationModal } from '../common/DeleteConfirmationModal';
import { isNotificationsEnabled, setNotificationsEnabled } from '../../utils/notificationService';
import { normalizeSafeHref, renderTextWithLinks } from '../../lib/linkify';
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
  RefreshCw,
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
  BellOff,
  Volume2,
  VolumeX,
  Minimize2,
  Maximize2,
  MessageCircle,
  Loader2,
  Lock,
  Unlock,
  Clock,
  KeyRound,
  Shield,
  Globe,
  EyeOff,
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
  onSaveExam?: (exam: Exam) => void;
  onSelectExamToTake?: (examId: string) => void;
  onViewClassGradebook?: (classId: string) => void;
  allUsers?: UserProfile[];
  classroomMessages?: Record<string, ClassroomChatMessage[]>;
  onSendChatMessage?: (message: ClassroomChatMessage) => void;
  onToggleReaction?: (messageId: string, emoji: string, classId: string) => void;
  onQuickAddFriend?: (targetUserId: string) => void;
  friendIds?: string[];
  classroomLessons?: ClassroomLesson[];
  onUpdateLessons?: (updated: ClassroomLesson[]) => void;
  onSaveLesson?: (lesson: ClassroomLesson) => void;
  onDeleteLesson?: (lessonId: string) => void;
  onDeleteExam?: (examId: string) => void;
  currentUserEmail?: string;
  onDeleteChatMessage?: (messageId: string, classId: string) => void;
  onDisbandClassroom?: (classId: string) => void | Promise<void>;
  externalClassJump?: {
    classId: string;
    tab?: 'curriculum' | 'chat';
    lessonId?: string;
    nonce: number;
  } | null;
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
  onSaveExam,
  onSelectExamToTake,
  onViewClassGradebook,
  allUsers = SAMPLE_STUDENTS,
  classroomMessages = {},
  onSendChatMessage,
  onToggleReaction,
  onQuickAddFriend,
  friendIds = [],
  classroomLessons = SAMPLE_CLASSROOM_LESSONS,
  onUpdateLessons,
  onSaveLesson,
  onDeleteLesson,
  onDeleteExam,
  currentUserEmail,
  onDeleteChatMessage,
  onDisbandClassroom,
  externalClassJump,
}) => {
  // 1. Kiểm tra quyền thành viên chính thức của nhóm lớp
  const isMemberOfClass = (cls: Classroom | undefined | null): boolean => {
    if (!cls) return false;
    const lowerUserId = (currentUserId || '').toLowerCase().trim();
    const lowerEmail = (currentUserEmail || '').toLowerCase().trim();
    const isOwnerTeacher = Boolean(lowerUserId && (cls.teacherId || '').toLowerCase().trim() === lowerUserId);
    const isEnrolledStudent = Boolean(
      cls.studentIds &&
      cls.studentIds.some((sId) => {
        const lowerS = (sId || '').toLowerCase().trim();
        return (lowerUserId && lowerS === lowerUserId) || (lowerEmail && lowerS === lowerEmail);
      })
    );

    // Nhóm lớp cá nhân: CHỈ thành viên trong nhóm (giáo viên tạo nhóm hoặc học sinh đã vào nhóm) mới có quyền xem
    if (cls.visibility === 'private') {
      return isOwnerTeacher || isEnrolledStudent;
    }

    if (userRole === 'admin' || userRole === 'teacher') return true;
    return isEnrolledStudent;
  };

  // 1b. Kiểm tra quyền nhìn thấy nhóm lớp trong danh sách (nhóm cá nhân chỉ thành viên trong nhóm mới nhìn thấy)
  const canSeeClassroom = (cls: Classroom | undefined | null): boolean => {
    if (!cls) return false;
    if (cls.visibility !== 'private') return true;
    return isMemberOfClass(cls);
  };

  const visibleClassrooms = useMemo(
    () => classrooms.filter((cls) => canSeeClassroom(cls)),
    [classrooms, currentUserId, currentUserEmail, userRole]
  );

  // 2. Kiểm tra học sinh đang ở trạng thái chờ duyệt vào lớp
  const isPendingApprovalInClass = (cls: Classroom | undefined | null): boolean => {
    if (!cls || userRole !== 'student') return false;
    const lowerUserId = (currentUserId || '').toLowerCase().trim();
    return Boolean(
      cls.pendingStudentIds &&
      cls.pendingStudentIds.some((sId) => (sId || '').toLowerCase().trim() === lowerUserId)
    );
  };

  // Khởi tạo selectedClassId: ưu tiên lớp mà người dùng thực sự là thành viên / được phép nhìn thấy
  const [selectedClassId, setSelectedClassId] = useState<string>(() => {
    if (userRole === 'student') {
      const myClasses = visibleClassrooms.filter((cls) => isMemberOfClass(cls));
      return myClasses[0]?.id || '';
    }
    if (userRole === 'teacher') {
      const myClasses = visibleClassrooms.filter((cls) => cls.teacherId === currentUserId);
      return myClasses[0]?.id || visibleClassrooms[0]?.id || '';
    }
    return visibleClassrooms[0]?.id || '';
  });
  const [activeRightTab, setActiveRightTab] = useState<'curriculum' | 'chat' | 'students' | 'approvals'>('curriculum');
  const [approvalActionSuccess, setApprovalActionSuccess] = useState<string | null>(null);
  const [localLessons, setLocalLessons] = useState<ClassroomLesson[]>(classroomLessons || SAMPLE_CLASSROOM_LESSONS);
  const [showAddLessonModal, setShowAddLessonModal] = useState<boolean>(false);
  const [selectedLessonDetail, setSelectedLessonDetail] = useState<ClassroomLesson | null>(null);
  const [lessonActionSuccess, setLessonActionSuccess] = useState<string | null>(null);

  // Modal xác nhận xóa bài học & xóa đề thi vĩnh viễn (kèm cảnh báo dữ liệu liên quan bị xóa)
  const [lessonToDelete, setLessonToDelete] = useState<ClassroomLesson | null>(null);
  const [examToDeletePermanently, setExamToDeletePermanently] = useState<Exam | null>(null);
  const [isDeletingItem, setIsDeletingItem] = useState<boolean>(false);
  const [deletedMessageIds, setDeletedMessageIds] = useState<Set<string>>(() => new Set());
  const [pdfPreviewError, setPdfPreviewError] = useState<string | null>(null);

  // Tự động chọn lớp đầu tiên thuộc quyền truy cập của người dùng (trong danh sách được phép nhìn thấy)
  useEffect(() => {
    if (visibleClassrooms.length > 0) {
      if (userRole === 'student') {
        const enrolled = visibleClassrooms.filter((cls) => isMemberOfClass(cls));
        if (enrolled.length > 0) {
          if (!selectedClassId || !visibleClassrooms.some((c) => c.id === selectedClassId)) {
            setSelectedClassId(enrolled[0].id);
          }
        } else {
          if (!selectedClassId || !visibleClassrooms.some((c) => c.id === selectedClassId)) {
            setSelectedClassId('');
          }
        }
      } else if (userRole === 'teacher') {
        const myClasses = visibleClassrooms.filter((cls) => cls.teacherId === currentUserId);
        if (myClasses.length > 0) {
          if (!selectedClassId || !myClasses.some((c) => c.id === selectedClassId)) {
            setSelectedClassId(myClasses[0].id);
          }
        } else {
          if (!selectedClassId || !visibleClassrooms.some((c) => c.id === selectedClassId)) {
            setSelectedClassId(visibleClassrooms[0].id);
          }
        }
      } else {
        if (!selectedClassId || !visibleClassrooms.some((c) => c.id === selectedClassId)) {
          setSelectedClassId(visibleClassrooms[0].id);
        }
      }
    } else if (selectedClassId) {
      setSelectedClassId('');
    }
  }, [visibleClassrooms, selectedClassId, currentUserId, userRole]);

  // Đồng bộ Real-Time danh sách bài học chuyên đề từ máy khác qua Firestore
  useEffect(() => {
    if (classroomLessons) {
      setLocalLessons(classroomLessons);
    }
  }, [classroomLessons]);

  // Đồng bộ Real-Time tin nhắn chat nhóm lớp từ máy khác qua Firestore & Server
  useEffect(() => {
    if (classroomMessages && typeof classroomMessages === 'object') {
      setLocalMessages((prev) => {
        const next = { ...prev };
        for (const [cId, msgs] of Object.entries(classroomMessages)) {
          if (Array.isArray(msgs)) {
            next[cId] = [...msgs].sort(
              (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
            );
          }
        }
        return next;
      });
    }
  }, [classroomMessages]);

  // Tự động tải tin nhắn khi chuyển sang tab Thảo Luận hoặc đổi lớp học
  useEffect(() => {
    if (activeRightTab === 'chat' && currentClass) {
      dbFetchClassMessages(currentClass.id).then((serverList) => {
        if (serverList && serverList.length > 0) {
          setLocalMessages((prev) => {
            const existing = prev[currentClass.id] || [];
            const msgMap = new Map<string, ClassroomChatMessage>();
            existing.forEach((m) => msgMap.set(m.id, m));
            serverList.forEach((m) => msgMap.set(m.id, m));
            return {
              ...prev,
              [currentClass.id]: Array.from(msgMap.values()).sort(
                (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
              ),
            };
          });
        }
      });
    }
  }, [activeRightTab, selectedClassId]);
  // Trạng thái thu gọn/mở rộng các chương học: Tự động mở rộng khi có bài học để học sinh thấy ngay
  const [expandedChapters, setExpandedChapters] = useState<string[]>([]);
  const [isRefreshingLessons, setIsRefreshingLessons] = useState<boolean>(false);

  const toggleChapter = (chapterTitle: string) => {
    setExpandedChapters((prev) =>
      prev.includes(chapterTitle) ? prev.filter((c) => c !== chapterTitle) : [...prev, chapterTitle]
    );
  };

  // Điều hướng trực tiếp từ thông báo nổi (mở đúng lớp, đúng tab và mở ngay bài học mới)
  useEffect(() => {
    if (!externalClassJump || !externalClassJump.classId) return;
    const targetCls = visibleClassrooms.find((c) => c.id === externalClassJump.classId);
    if (targetCls) {
      setSelectedClassId(targetCls.id);
    }
    setActiveRightTab(externalClassJump.tab || 'curriculum');
    if (externalClassJump.lessonId) {
      const targetLesson =
        localLessons.find((l) => l.id === externalClassJump.lessonId) ||
        classroomLessons.find((l) => l.id === externalClassJump.lessonId);
      if (targetLesson) {
        if (targetLesson.chapter) {
          setExpandedChapters((prev) =>
            prev.includes(targetLesson.chapter) ? prev : [...prev, targetLesson.chapter]
          );
        }
        setSelectedLessonDetail(targetLesson);
        setLessonDetailTab('theory');
      }
    }
  }, [externalClassJump?.nonce]);

  const handleManualRefreshLessons = async () => {
    setIsRefreshingLessons(true);
    try {
      const fresh = await dbFetchLessons();
      if (fresh && fresh.length > 0) {
        setLocalLessons(fresh);
        if (onUpdateLessons) onUpdateLessons(fresh);
      }
    } finally {
      setTimeout(() => setIsRefreshingLessons(false), 500);
    }
  };

  // Form thêm chương / bài học mới (Chương -> Bài học -> Ô Bài học & Ô Luyện tập)
  const [chapterInputMode, setChapterInputMode] = useState<'existing' | 'new'>('existing');
  const [newLessonChapter, setNewLessonChapter] = useState('');
  const [newLessonTitle, setNewLessonTitle] = useState('');
  const [newLessonDesc, setNewLessonDesc] = useState('');
  const [newLessonTheory, setNewLessonTheory] = useState('');
  const [newLessonPractice, setNewLessonPractice] = useState('');
  const [newLessonExercisesCount, setNewLessonExercisesCount] = useState<string>('10');
  const [newLessonExternalLink, setNewLessonExternalLink] = useState('');
  const [newLessonPdfFile, setNewLessonPdfFile] = useState<{ fileName: string; fileSize: string; fileData?: string; fileUrl?: string } | null>(null);
  const [newLessonPracticePdfFile, setNewLessonPracticePdfFile] = useState<{ fileName: string; fileSize: string; fileData?: string; fileUrl?: string } | null>(null);
  const [newLessonAttachmentName, setNewLessonAttachmentName] = useState('');
  const [newLessonError, setNewLessonError] = useState<string | null>(null);
  const [isSubmittingLesson, setIsSubmittingLesson] = useState<boolean>(false);

  // Form chỉnh sửa bài học đã đăng (Giáo viên)
  const [showEditLessonModal, setShowEditLessonModal] = useState<boolean>(false);
  const [editingLessonId, setEditingLessonId] = useState<string>('');
  const [editLessonChapter, setEditLessonChapter] = useState('');
  const [editLessonTitle, setEditLessonTitle] = useState('');
  const [editLessonDesc, setEditLessonDesc] = useState('');
  const [editLessonTheory, setEditLessonTheory] = useState('');
  const [editLessonPractice, setEditLessonPractice] = useState('');
  const [editLessonExercisesCount, setEditLessonExercisesCount] = useState<string>('10');
  const [editLessonExternalLink, setEditLessonExternalLink] = useState('');
  const [editLessonPdfFile, setEditLessonPdfFile] = useState<{ fileName: string; fileSize: string; fileData?: string; fileUrl?: string } | null>(null);
  const [editLessonPracticePdfFile, setEditLessonPracticePdfFile] = useState<{ fileName: string; fileSize: string; fileData?: string; fileUrl?: string } | null>(null);
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
  const [newClassVisibility, setNewClassVisibility] = useState<'public' | 'private'>('public');

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
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Trạng thái cần gạt BẬT / TẮT thông báo (Bài đăng giáo viên & Nhắc tên trong chat)
  const [chatNotifsEnabled, setChatNotifsEnabled] = useState<boolean>(() => isNotificationsEnabled());

  useEffect(() => {
    const handleToggle = (e: Event) => {
      const customEvent = e as CustomEvent<{ enabled: boolean }>;
      if (customEvent.detail && typeof customEvent.detail.enabled === 'boolean') {
        setChatNotifsEnabled(customEvent.detail.enabled);
      } else {
        setChatNotifsEnabled(isNotificationsEnabled());
      }
    };
    window.addEventListener('math_nbk_notifications_toggle', handleToggle);
    return () => window.removeEventListener('math_nbk_notifications_toggle', handleToggle);
  }, []);

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

  // Tự động cuộn xuống tin nhắn mới nhất
  useEffect(() => {
    if (activeRightTab === 'chat') {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [localMessages, classroomMessages, activeRightTab]);

  // Lớp học đang chọn (chỉ trả về nếu người dùng được phép nhìn thấy)
  const currentClass = selectedClassId ? (visibleClassrooms.find((c) => c.id === selectedClassId) || null) : null;
  const isCurrentClassMember = isMemberOfClass(currentClass);
  const isCurrentClassPending = isPendingApprovalInClass(currentClass);

  // Danh sách tin nhắn lớp học hiện tại (Chỉ tải khi là thành viên hợp lệ)
  const currentClassMessages = useMemo(() => {
    if (!currentClass || !isCurrentClassMember) return [];
    const local = localMessages[currentClass.id] || [];
    const localByCode = (currentClass.code && localMessages[currentClass.code]) || [];
    const remote = classroomMessages?.[currentClass.id] || [];
    const remoteByCode = (currentClass.code && classroomMessages?.[currentClass.code]) || [];
    const map = new Map<string, ClassroomChatMessage>();
    [...local, ...localByCode, ...remote, ...remoteByCode].forEach((m) => {
      if (m && m.id && !deletedMessageIds.has(m.id)) {
        map.set(m.id, m);
      }
    });
    return Array.from(map.values()).sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
  }, [currentClass, isCurrentClassMember, localMessages, classroomMessages, deletedMessageIds]);

  // Danh sách bài học và chương học thuộc lớp đang chọn (Mục lục lớp)
  // Chỉ tải khi người dùng là thành viên chính thức, và CHỈ hiển thị đúng bài học của lớp này (không dùng loose filter classId === 'all')
  const currentClassLessons = useMemo(() => {
    if (!currentClass || !isCurrentClassMember) return [];
    const all = [...(classroomLessons || []), ...localLessons];
    const uniqueMap = new Map<string, ClassroomLesson>();
    all.forEach((l) => {
      if (l && l.id) uniqueMap.set(l.id, l);
    });
    return Array.from(uniqueMap.values()).filter(
      (l) =>
        l.classId === currentClass.id ||
        (currentClass.code && l.classId === currentClass.code)
    );
  }, [currentClass, isCurrentClassMember, localLessons, classroomLessons]);

  // Tự động mở rộng các chương khi có bài học mới xuất hiện để học sinh thấy ngay trước mắt
  useEffect(() => {
    if (currentClassLessons.length > 0) {
      const allChapters = Array.from(new Set(currentClassLessons.map((l) => l.chapter || 'Chuyên đề chung')));
      setExpandedChapters((prev) => {
        const set = new Set([...prev, ...allChapters]);
        return Array.from(set);
      });
    }
  }, [currentClassLessons]);

  // Nhóm các bài học theo Chương học (Mục lục chuyên đề)
  const groupedLessons = useMemo(() => {
    return currentClassLessons.reduce((acc, lesson) => {
      const ch = lesson.chapter || 'Chuyên đề chung';
      if (!acc[ch]) acc[ch] = [];
      acc[ch].push(lesson);
      return acc;
    }, {} as Record<string, ClassroomLesson[]>);
  }, [currentClassLessons]);

  // Danh sách các chương đang có sẵn trong lớp hiện tại
  const existingClassChapters = useMemo(() => {
    return Object.keys(groupedLessons);
  }, [groupedLessons]);

  const openAddLessonModal = (presetChapter?: string) => {
    if (presetChapter) {
      setChapterInputMode('existing');
      setNewLessonChapter(presetChapter);
    } else if (existingClassChapters.length > 0) {
      setChapterInputMode('existing');
      setNewLessonChapter(existingClassChapters[0]);
    } else {
      setChapterInputMode('new');
      setNewLessonChapter(
        currentClass?.grade === 12
          ? 'Chương 1: Ứng dụng đạo hàm để khảo sát hàm số'
          : 'Chương 1: Hàm số và phương trình lượng giác'
      );
    }
    setNewLessonTitle('');
    setNewLessonDesc('');
    setNewLessonTheory('');
    setNewLessonPractice('');
    setNewLessonExercisesCount('10');
    setNewLessonExternalLink('');
    setNewLessonPdfFile(null);
    setNewLessonPracticePdfFile(null);
    setNewLessonAttachmentName('');
    setNewLessonError(null);
    setShowAddLessonModal(true);
  };

  // Danh sách toàn bộ học sinh đăng ký trong hệ thống
  const registeredStudents: UserProfile[] = (allUsers || []).filter((u) => u.role === 'student');

  // Danh sách học sinh thuộc lớp đang chọn (chỉ trả về danh sách nếu người dùng là thành viên hợp lệ)
  const enrolledStudents: UserProfile[] = useMemo(() => {
    if (!currentClass || !isCurrentClassMember) return [];
    return (currentClass.studentIds || []).map((id) => {
      const user = allUsers.find((u) => u.id === id);
      if (user) return user;
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
  }, [currentClass, isCurrentClassMember, allUsers]);

  // Danh sách học sinh chờ giáo viên phê duyệt vào lớp (chỉ giáo viên và admin mới xem)
  const pendingStudents: UserProfile[] = useMemo(() => {
    if (!currentClass || (userRole === 'student' && !isCurrentClassMember)) return [];
    return (currentClass.pendingStudentIds || []).map((id) => {
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
  }, [currentClass, userRole, isCurrentClassMember, allUsers]);

  // Tất cả thành viên trong lớp (giáo viên + học sinh) để tag tên (@mention)
  const classTeacherUser = allUsers.find((u) => u.id === currentClass?.teacherId) || {
    id: currentClass?.teacherId || 'usr_teacher_01',
    name: currentClass?.teacherName || 'ThS. Trần Văn Minh',
    role: 'teacher' as UserRole,
    avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=TeacherMinh',
  };

  const classMembersForMention = useMemo(() => {
    if (!currentClass || !isCurrentClassMember) return [];
    return [
      {
        id: 'all',
        name: 'Cả Lớp',
        role: 'student' as UserRole,
        avatar: '',
      },
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
  }, [currentClass, isCurrentClassMember, classTeacherUser, enrolledStudents]);

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
      assignedExamIds: [],
      requiresApproval: true,
      visibility: newClassVisibility,
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
    setNewClassVisibility('public');
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
        setStudentLookupError(`Không tìm thấy tài khoản học sinh mang ID "${trimmedId}".`);
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

    // 1. Cập nhật danh sách đề thi giao trong Classroom (onUpdateClassrooms đã tự đồng bộ dbSaveClassrooms)
    const updatedClassrooms = classrooms.map((cls) => {
      if (cls.id === currentClass.id) {
        return {
          ...cls,
          assignedExamIds: (cls.assignedExamIds || []).filter((id) => id !== examIdToRemove),
        };
      }
      return cls;
    });

    onUpdateClassrooms(updatedClassrooms);

    // 2. Gỡ ID lớp này khỏi targetClassIds của đề thi và chỉ lưu đúng đề thi vừa sửa
    const targetExam = examsList.find((e) => e.id === examIdToRemove);
    if (targetExam) {
      const nextTargetIds = (targetExam.targetClassIds || []).filter((cid) => cid !== currentClass.id);
      const updatedExam: Exam = {
        ...targetExam,
        targetClassIds: nextTargetIds,
        distributionType:
          nextTargetIds.length === 0 && targetExam.distributionType !== 'repository'
            ? ('repository' as const)
            : targetExam.distributionType,
      };
      if (onSaveExam) {
        onSaveExam(updatedExam);
      } else {
        if (onUpdateExamsList) {
          onUpdateExamsList(examsList.map((ex) => (ex.id === examIdToRemove ? updatedExam : ex)));
        }
        dbSaveExam(updatedExam).catch(console.error);
      }
    }

    setExamActionSuccess(`Đã xóa đề "${examToRemoveFromClass.title}" khỏi danh sách giao cho lớp ${currentClass.name}!`);
    setTimeout(() => setExamActionSuccess(null), 4000);
    setExamToRemoveFromClass(null);
  };

  // Tạo file PDF hợp chuẩn PDF-1.4 để đảm bảo mở được 100% trên mọi ứng dụng (Acrobat, Chrome, Edge, Safari, Android)
  const generateValidSamplePdf = (title: string): Blob => {
    const safeTitle = (title || 'Tai_Lieu_Toan').replace(/[()\\]/g, '');
    const dateStr = new Date().toLocaleDateString('vi-VN');

    const streamContent = `BT\n/F1 18 Tf\n50 770 Td\n(HE THONG TOAN HOC LIKI - TAI LIEU CHINH THUC) Tj\n/F1 14 Tf\n0 -35 Td\n(Tai lieu: ${safeTitle}) Tj\n/F1 11 Tf\n0 -25 Td\n(Ngay cap nhat: ${dateStr}) Tj\n0 -22 Td\n(He Thong Toan Hoc LIKI) Tj\n0 -35 Td\n(Chuc cac em hoc sinh hoc tap tot va dat ket qua cao nhat!) Tj\nET`;

    const streamLength = streamContent.length;

    let pdf = `%PDF-1.4\n`;
    const offsets: number[] = [];

    offsets[1] = pdf.length;
    pdf += `1 0 obj\n<< /Type /Catalog /Pages 3 0 R /Outlines 2 0 R >>\nendobj\n`;

    offsets[2] = pdf.length;
    pdf += `2 0 obj\n<< /Type /Outlines /Count 0 >>\nendobj\n`;

    offsets[3] = pdf.length;
    pdf += `3 0 obj\n<< /Type /Pages /Kids [4 0 R] /Count 1 >>\nendobj\n`;

    offsets[4] = pdf.length;
    pdf += `4 0 obj\n<< /Type /Page /Parent 3 0 R /MediaBox [0 0 595 842] /Contents 6 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj\n`;

    offsets[5] = pdf.length;
    pdf += `5 0 obj\n<< /Type /Font /Subtype /Type1 /Name /F1 /BaseFont /Helvetica >>\nendobj\n`;

    offsets[6] = pdf.length;
    pdf += `6 0 obj\n<< /Length ${streamLength} >>\nstream\n${streamContent}\nendstream\nendobj\n`;

    const xrefOffset = pdf.length;
    pdf += `xref\n0 7\n0000000000 65535 f \n`;
    for (let i = 1; i <= 6; i++) {
      pdf += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
    }
    pdf += `trailer\n<< /Size 7 /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

    return new Blob([pdf], { type: 'application/pdf' });
  };

  // Tải file PDF an toàn về máy tính hoặc điện thoại
  const handleDownloadPdf = async (fileName: string, fileData?: string, fileUrl?: string) => {
    const finalFileName = fileName.toLowerCase().endsWith('.pdf') ? fileName : `${fileName}.pdf`;

    try {
      // Ưu tiên 1: Tải trực tiếp từ fileUrl máy chủ nếu có
      if (fileUrl) {
        try {
          const res = await fetch(fileUrl);
          if (res.ok) {
            const blob = await res.blob();
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = finalFileName;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            setTimeout(() => URL.revokeObjectURL(url), 2000);
            return;
          }
        } catch (fetchErr) {
          console.warn('Không thể tải từ fileUrl, chuyển sang xử lý dữ liệu nội bộ:', fetchErr);
        }
      }

      // Ưu tiên 2: Giải mã Base64 Data URL thành Blob nhị phân chuẩn PDF
      if (fileData && fileData.includes('base64,')) {
        const base64Content = fileData.split('base64,')[1];
        const binaryString = atob(base64Content);
        const len = binaryString.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        const blob = new Blob([bytes], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = finalFileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setTimeout(() => URL.revokeObjectURL(url), 2000);
        return;
      }

      // Ưu tiên 3: Nếu là link HTTP/HTTPS
      if (fileData && (fileData.startsWith('http://') || fileData.startsWith('https://'))) {
        const link = document.createElement('a');
        link.href = fileData;
        link.download = finalFileName;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        return;
      }

      // Fallback: Tạo file PDF hợp chuẩn PDF-1.4 hoàn chỉnh để không bao giờ bị báo hỏng file
      const validPdfBlob = generateValidSamplePdf(fileName);
      const url = URL.createObjectURL(validPdfBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = finalFileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    } catch (err) {
      console.error('Lỗi khi tải PDF:', err);
      const validPdfBlob = generateValidSamplePdf(fileName);
      const url = URL.createObjectURL(validPdfBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = finalFileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    }
  };

  // Mở xem trước PDF trực tiếp trong tab mới (Học sinh & Giáo viên có thể đọc ngay)
  const handlePreviewPdf = async (fileName: string, fileData?: string, fileUrl?: string) => {
    setPdfPreviewError(null);
    const openOrWarn = (targetUrl: string) => {
      const opened = window.open(targetUrl, '_blank', 'noopener,noreferrer');
      if (!opened) {
        setPdfPreviewError('Trình duyệt đã chặn cửa sổ xem trước PDF. Vui lòng nhấn nút "Tải PDF" để mở tài liệu!');
      }
    };
    try {
      if (fileUrl) {
        openOrWarn(fileUrl);
        return;
      }

      if (fileData && fileData.includes('base64,')) {
        const base64Content = fileData.split('base64,')[1];
        const binaryString = atob(base64Content);
        const len = binaryString.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        const blob = new Blob([bytes], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        openOrWarn(url);
        return;
      }

      if (fileData && (fileData.startsWith('http://') || fileData.startsWith('https://'))) {
        openOrWarn(fileData);
        return;
      }

      const validPdfBlob = generateValidSamplePdf(fileName);
      const url = URL.createObjectURL(validPdfBlob);
      openOrWarn(url);
    } catch (err) {
      console.error('Lỗi khi mở xem trước PDF:', err);
      setPdfPreviewError('Không thể mở xem trước file PDF này. Vui lòng dùng nút "Tải PDF"!');
    }
  };

  // Hàm xử lý đọc file PDF tổng quát (giới hạn dung lượng ~15MB) và tự động đồng bộ máy chủ
  const processPdfFile = (
    file: File,
    onSuccess: (data: { fileName: string; fileSize: string; fileData?: string; fileUrl?: string }) => void,
    onError: (msg: string | null) => void
  ) => {
    const MAX_SIZE = 15 * 1024 * 1024; // 15 MB
    if (file.size > MAX_SIZE) {
      onError(`Dung lượng file vượt quá giới hạn 15MB (hiện tại: ${(file.size / (1024 * 1024)).toFixed(2)} MB). Vui lòng chọn file PDF nhỏ hơn 15MB!`);
      return;
    }

    if (!file.name.toLowerCase().endsWith('.pdf') && file.type !== 'application/pdf') {
      onError('Vui lòng chọn file có định dạng PDF!');
      return;
    }

    onError(null);
    const sizeStr = (file.size / (1024 * 1024)).toFixed(2) + ' MB';
    const reader = new FileReader();

    reader.onload = async () => {
      const base64Result = reader.result as string;

      // Cập nhật trạng thái tức thời với base64 để người dùng thấy ngay trên UI
      const fileDataObj = {
        fileName: file.name,
        fileSize: sizeStr,
        fileData: base64Result,
      };
      onSuccess(fileDataObj);

      // Tự động tải lên máy chủ để tạo file nhị phân vĩnh viễn và fileUrl siêu nhẹ
      try {
        const uploadRes = await dbUploadPdfFile(file.name, base64Result);
        if (uploadRes.success && uploadRes.fileUrl) {
          onSuccess({
            fileName: file.name,
            fileSize: uploadRes.fileSize || sizeStr,
            fileData: base64Result,
            fileUrl: uploadRes.fileUrl,
          });
        }
      } catch (err) {
        console.warn('Lỗi đồng bộ file lên máy chủ:', err);
      }
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
  const handleCreateLessonSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentClass) return;

    if (!newLessonChapter.trim() || !newLessonTitle.trim()) {
      setNewLessonError('Vui lòng nhập đầy đủ tên Chương học và tên Bài học!');
      return;
    }

    setIsSubmittingLesson(true);
    setNewLessonError(null);
    const newLessonId = `les_${Date.now()}`;

    try {
      let finalLessonPdf = newLessonPdfFile ? { ...newLessonPdfFile } : null;
      let finalPracticePdf = newLessonPracticePdfFile ? { ...newLessonPracticePdfFile } : null;

      // 1. Tải lên máy chủ nếu có file PDF bài học mà chưa có URL máy chủ
      if (finalLessonPdf && !finalLessonPdf.fileUrl && finalLessonPdf.fileData) {
        try {
          const uploadRes = await dbUploadPdfFile(finalLessonPdf.fileName, finalLessonPdf.fileData);
          if (uploadRes.success && uploadRes.fileUrl) {
            finalLessonPdf.fileUrl = uploadRes.fileUrl;
            finalLessonPdf.fileSize = uploadRes.fileSize || finalLessonPdf.fileSize;
          }
        } catch (uploadErr) {
          console.warn('Không thể tải file PDF bài học lên máy chủ:', uploadErr);
        }
      }

      // 2. Tải lên máy chủ nếu có file PDF luyện tập mà chưa có URL máy chủ
      if (finalPracticePdf && !finalPracticePdf.fileUrl && finalPracticePdf.fileData) {
        try {
          const uploadRes = await dbUploadPdfFile(finalPracticePdf.fileName, finalPracticePdf.fileData);
          if (uploadRes.success && uploadRes.fileUrl) {
            finalPracticePdf.fileUrl = uploadRes.fileUrl;
            finalPracticePdf.fileSize = uploadRes.fileSize || finalPracticePdf.fileSize;
          }
        } catch (uploadErr) {
          console.warn('Không thể tải file PDF luyện tập lên máy chủ:', uploadErr);
        }
      }

      // 3. Làm nhẹ fileAttachment trước khi lưu vào database (không bao giờ lưu chuỗi base64 khổng lồ)
      const cleanLessonPdf = finalLessonPdf
        ? {
            fileName: finalLessonPdf.fileName,
            fileSize: finalLessonPdf.fileSize,
            fileUrl: finalLessonPdf.fileUrl || '',
            fileData: '',
          }
        : undefined;

      const cleanPracticePdf = finalPracticePdf
        ? {
            fileName: finalPracticePdf.fileName,
            fileSize: finalPracticePdf.fileSize,
            fileUrl: finalPracticePdf.fileUrl || '',
            fileData: '',
          }
        : undefined;

      const attachmentsList: { name: string; type: 'pdf' | 'image' | 'link'; url: string; size?: string }[] = [];
      if (cleanLessonPdf && cleanLessonPdf.fileUrl) {
        attachmentsList.push({
          name: cleanLessonPdf.fileName,
          type: 'pdf' as const,
          url: cleanLessonPdf.fileUrl,
          size: cleanLessonPdf.fileSize,
        });
      }
      if (cleanPracticePdf && cleanPracticePdf.fileUrl) {
        attachmentsList.push({
          name: cleanPracticePdf.fileName,
          type: 'pdf' as const,
          url: cleanPracticePdf.fileUrl,
          size: cleanPracticePdf.fileSize,
        });
      }

      const normalizedExternalLink = newLessonExternalLink.trim()
        ? normalizeSafeHref(newLessonExternalLink.trim(), true) || newLessonExternalLink.trim()
        : '';

      if (normalizedExternalLink) {
        attachmentsList.push({
          name: 'Link tài liệu trực tuyến',
          type: 'link' as const,
          url: normalizedExternalLink,
          size: 'Web',
        });
      }

      const newLessonObj: ClassroomLesson = {
        id: newLessonId,
        classId: currentClass.id,
        chapter: newLessonChapter.trim(),
        title: newLessonTitle.trim(),
        description: newLessonDesc.trim() || 'Tài liệu lý thuyết và bài tập luyện tập.',
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
        publishedAt: new Date().toISOString(),
        exercisesCount:
          newLessonExercisesCount.trim() === ''
            ? 10
            : Math.max(0, parseInt(newLessonExercisesCount, 10) || 0),
        completedStudentIds: [],
        externalLink: normalizedExternalLink || undefined,
        pdfAttachment: cleanLessonPdf,
        practicePdfAttachment: cleanPracticePdf,
        attachments: attachmentsList.length > 0 ? attachmentsList : undefined,
      };

      setLocalLessons((prev) => [newLessonObj, ...prev]);

      if (onSaveLesson) {
        await onSaveLesson(newLessonObj);
      }

      // Reset form sau khi đăng tải thành công
      setNewLessonChapter('');
      setNewLessonTitle('');
      setNewLessonDesc('');
      setNewLessonTheory('');
      setNewLessonPractice('');
      setNewLessonExercisesCount('10');
      setNewLessonPdfFile(null);
      setNewLessonPracticePdfFile(null);
      setNewLessonExternalLink('');
      setNewLessonAttachmentName('');

      setShowAddLessonModal(false);
      setLessonActionSuccess(`Đã đăng tải bài học "${newLessonObj.title}" thành công!`);
      setTimeout(() => setLessonActionSuccess(null), 3500);
    } catch (err: any) {
      console.error('Lỗi khi đăng bài học:', err);
      // Hoàn tác đúng bài học vừa tạo khỏi state cục bộ nếu đồng bộ thất bại
      setLocalLessons((prev) => prev.filter((l) => l.id !== newLessonId));
      let errMsg = 'Có lỗi xảy ra khi lưu bài học, vui lòng thử lại!';
      if (err?.message) {
        try {
          const parsed = JSON.parse(err.message);
          if (parsed && (parsed.error || parsed.operationType)) {
            errMsg = `Lỗi Firestore [${parsed.operationType} ${parsed.path || ''}]: ${parsed.error}`;
          } else {
            errMsg = err.message;
          }
        } catch {
          errMsg = err.message;
        }
      }
      setNewLessonError(errMsg);
    } finally {
      setIsSubmittingLesson(false);
    }
  };

  // 3c-2. Giáo viên MỞ modal chỉnh sửa bài học đã đăng
  const handleOpenEditLesson = (lesson: ClassroomLesson) => {
    setEditingLessonId(lesson.id);
    setEditLessonChapter(lesson.chapter || '');
    setEditLessonTitle(lesson.title || '');
    setEditLessonDesc(lesson.description || '');
    setEditLessonTheory(lesson.theoryContent || lesson.content || '');
    setEditLessonPractice(lesson.practiceContent || lesson.exercisesContent || '');
    setEditLessonExercisesCount(String(lesson.exercisesCount ?? 10));
    setEditLessonExternalLink(lesson.externalLink || '');
    setEditLessonPdfFile(
      lesson.pdfAttachment
        ? {
            fileName: lesson.pdfAttachment.fileName,
            fileSize: lesson.pdfAttachment.fileSize,
            fileData: lesson.pdfAttachment.fileData || '',
            fileUrl: lesson.pdfAttachment.fileUrl,
          }
        : null
    );
    setEditLessonPracticePdfFile(
      lesson.practicePdfAttachment
        ? {
            fileName: lesson.practicePdfAttachment.fileName,
            fileSize: lesson.practicePdfAttachment.fileSize,
            fileData: lesson.practicePdfAttachment.fileData || '',
            fileUrl: lesson.practicePdfAttachment.fileUrl,
          }
        : null
    );
    setEditLessonError(null);
    setShowEditLessonModal(true);
  };

  // 3c-3. Giáo viên LƯU chỉnh sửa bài học
  const handleEditLessonSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editLessonTitle.trim() || !editLessonChapter.trim()) {
      setEditLessonError('Vui lòng nhập đầy đủ tên Chương học và tên Bài học!');
      return;
    }

    setIsSubmittingLesson(true);
    setEditLessonError(null);

    try {
      let finalLessonPdf = editLessonPdfFile ? { ...editLessonPdfFile } : null;
      let finalPracticePdf = editLessonPracticePdfFile ? { ...editLessonPracticePdfFile } : null;

      // 1. Tải lên máy chủ nếu có file PDF bài học mà chưa có URL máy chủ
      if (finalLessonPdf && !finalLessonPdf.fileUrl && finalLessonPdf.fileData) {
        try {
          const uploadRes = await dbUploadPdfFile(finalLessonPdf.fileName, finalLessonPdf.fileData);
          if (uploadRes.success && uploadRes.fileUrl) {
            finalLessonPdf.fileUrl = uploadRes.fileUrl;
            finalLessonPdf.fileSize = uploadRes.fileSize || finalLessonPdf.fileSize;
          }
        } catch (uploadErr) {
          console.warn('Không thể tải file PDF bài học lên máy chủ:', uploadErr);
        }
      }

      // 2. Tải lên máy chủ nếu có file PDF luyện tập mà chưa có URL máy chủ
      if (finalPracticePdf && !finalPracticePdf.fileUrl && finalPracticePdf.fileData) {
        try {
          const uploadRes = await dbUploadPdfFile(finalPracticePdf.fileName, finalPracticePdf.fileData);
          if (uploadRes.success && uploadRes.fileUrl) {
            finalPracticePdf.fileUrl = uploadRes.fileUrl;
            finalPracticePdf.fileSize = uploadRes.fileSize || finalPracticePdf.fileSize;
          }
        } catch (uploadErr) {
          console.warn('Không thể tải file PDF luyện tập lên máy chủ:', uploadErr);
        }
      }

      // 3. Làm sạch fileAttachment không chứa chuỗi base64 khổng lồ
      const cleanLessonPdf = finalLessonPdf
        ? {
            fileName: finalLessonPdf.fileName,
            fileSize: finalLessonPdf.fileSize,
            fileUrl: finalLessonPdf.fileUrl || '',
            fileData: '',
          }
        : undefined;

      const cleanPracticePdf = finalPracticePdf
        ? {
            fileName: finalPracticePdf.fileName,
            fileSize: finalPracticePdf.fileSize,
            fileUrl: finalPracticePdf.fileUrl || '',
            fileData: '',
          }
        : undefined;

      const attachmentsList: { name: string; type: 'pdf' | 'image' | 'link'; url: string; size?: string }[] = [];
      if (cleanLessonPdf && cleanLessonPdf.fileUrl) {
        attachmentsList.push({
          name: cleanLessonPdf.fileName,
          type: 'pdf' as const,
          url: cleanLessonPdf.fileUrl,
          size: cleanLessonPdf.fileSize,
        });
      }
      if (cleanPracticePdf && cleanPracticePdf.fileUrl) {
        attachmentsList.push({
          name: cleanPracticePdf.fileName,
          type: 'pdf' as const,
          url: cleanPracticePdf.fileUrl,
          size: cleanPracticePdf.fileSize,
        });
      }
      const normalizedEditLink = editLessonExternalLink.trim()
        ? normalizeSafeHref(editLessonExternalLink.trim(), true) || editLessonExternalLink.trim()
        : '';

      if (normalizedEditLink) {
        attachmentsList.push({
          name: 'Link tài liệu trực tuyến',
          type: 'link' as const,
          url: normalizedEditLink,
          size: 'Web',
        });
      }

      const existingLesson = localLessons.find((l) => l.id === editingLessonId);
      const updatedLesson: ClassroomLesson = {
        ...(existingLesson || ({} as any)),
        id: editingLessonId,
        classId: existingLesson?.classId || currentClass?.id || '',
        chapter: editLessonChapter.trim(),
        title: editLessonTitle.trim(),
        description: editLessonDesc.trim(),
        theoryContent: editLessonTheory.trim(),
        practiceContent: editLessonPractice.trim(),
        exercisesContent: editLessonPractice.trim(),
        content: editLessonTheory.trim(),
        updatedAt: new Date().toISOString().split('T')[0],
        exercisesCount:
          editLessonExercisesCount.trim() === ''
            ? 10
            : Math.max(0, parseInt(editLessonExercisesCount, 10) || 0),
        externalLink: normalizedEditLink || undefined,
        pdfAttachment: cleanLessonPdf,
        practicePdfAttachment: cleanPracticePdf,
        attachments: attachmentsList.length > 0 ? attachmentsList : undefined,
      };

      setLocalLessons((prev) => prev.map((l) => (l.id === editingLessonId ? updatedLesson : l)));
      if (selectedLessonDetail?.id === editingLessonId) {
        setSelectedLessonDetail(updatedLesson);
      }

      if (onSaveLesson) {
        await onSaveLesson(updatedLesson);
      }

      setShowEditLessonModal(false);
      setLessonActionSuccess(`Đã cập nhật bài học "${updatedLesson.title}" thành công!`);
      setTimeout(() => setLessonActionSuccess(null), 3500);
    } catch (err: any) {
      console.error('Lỗi khi cập nhật bài học:', err);
      let errMsg = 'Có lỗi xảy ra khi cập nhật bài học!';
      if (err?.message) {
        try {
          const parsed = JSON.parse(err.message);
          if (parsed && (parsed.error || parsed.operationType)) {
            errMsg = `Lỗi Firestore [${parsed.operationType} ${parsed.path || ''}]: ${parsed.error}`;
          } else {
            errMsg = err.message;
          }
        } catch {
          errMsg = err.message;
        }
      }
      setEditLessonError(errMsg);
    } finally {
      setIsSubmittingLesson(false);
    }
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
                <span className="w-1.5 h-3.5 bg-blue-600 rounded-full inline-block shrink-0"></span>
                <span>{renderTextWithLinks(trimmed.replace('### ', ''))}</span>
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
                    return (
                      <strong key={bIdx} className="font-bold text-slate-900">
                        {renderTextWithLinks(bPart.slice(2, -2))}
                      </strong>
                    );
                  }
                  return <span key={bIdx}>{renderTextWithLinks(bPart)}</span>;
                });
              })}
            </p>
          );
        })}
      </div>
    );
  };

  // 3d. Xác nhận xóa bài học và TOÀN BỘ dữ liệu liên quan (Lý thuyết, bài tập, file PDF, tiến độ học sinh)
  const handleConfirmDeleteLesson = async () => {
    if (!lessonToDelete) return;
    setIsDeletingItem(true);
    try {
      const id = lessonToDelete.id;
      const title = lessonToDelete.title;
      const updated = localLessons.filter((l) => l.id !== id);
      setLocalLessons(updated);
      if (onDeleteLesson) {
        await onDeleteLesson(id);
      }
      if (onUpdateLessons) {
        onUpdateLessons(updated);
      }
      setLessonActionSuccess(`Đã xóa vĩnh viễn bài học "${title}" và toàn bộ tài liệu liên quan thành công!`);
      setTimeout(() => setLessonActionSuccess(null), 3500);
      setLessonToDelete(null);
    } catch (err) {
      console.error('Lỗi khi xóa bài học:', err);
    } finally {
      setIsDeletingItem(false);
    }
  };

  // 3d-2. Xác nhận xóa vĩnh viễn đề thi và TOÀN BỘ dữ liệu liên quan (Bài nộp, Bảng điểm, Cheat Logs, Giao đề)
  const handleConfirmDeleteExamPermanently = async () => {
    if (!examToDeletePermanently) return;
    setIsDeletingItem(true);
    try {
      const id = examToDeletePermanently.id;
      const title = examToDeletePermanently.title;
      if (onDeleteExam) {
        // onDeleteExam đã tự cập nhật examsList, classrooms, submissions, cheatLogs, localStorage và xóa trên Firestore/Server
        await onDeleteExam(id);
      } else {
        const updatedClassrooms = classrooms.map((cls) => ({
          ...cls,
          assignedExamIds: (cls.assignedExamIds || []).filter((eid) => eid !== id),
        }));
        onUpdateClassrooms(updatedClassrooms);
        if (onUpdateExamsList) {
          onUpdateExamsList(examsList.filter((e) => e.id !== id));
        }
      }

      setExamActionSuccess(`Đã xóa vĩnh viễn đề thi "${title}" cùng toàn bộ kết quả nộp bài của học sinh!`);
      setTimeout(() => setExamActionSuccess(null), 4000);
      setExamToDeletePermanently(null);
      setExamToRemoveFromClass(null);
    } catch (err) {
      console.error('Lỗi khi xóa đề thi:', err);
    } finally {
      setIsDeletingItem(false);
    }
  };

  // 3d-3. Quản trị viên / Giáo viên giải tán nhóm lớp và toàn bộ bài học, tin nhắn liên quan
  const [classToDisband, setClassToDisband] = useState<Classroom | null>(null);
  const [isDisbandingClass, setIsDisbandingClass] = useState<boolean>(false);

  const handleConfirmDisbandClass = async () => {
    if (!classToDisband || !onDisbandClassroom) return;
    setIsDisbandingClass(true);
    try {
      const disbandedName = classToDisband.name;
      await onDisbandClassroom(classToDisband.id);
      setClassToDisband(null);
      setSelectedClassId('');
      setExamActionSuccess(`Đã giải tán thành công nhóm lớp "${disbandedName}" cùng toàn bộ dữ liệu liên quan!`);
      setTimeout(() => setExamActionSuccess(null), 4000);
    } catch (err) {
      console.error('Lỗi khi giải tán nhóm lớp:', err);
    } finally {
      setIsDisbandingClass(false);
    }
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
      if (foundClass.visibility !== 'private') {
        setSelectedClassId(foundClass.id);
      }
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

  // 4a. Học sinh gửi yêu cầu xin vào lớp trực tiếp từ nút bấm
  const handleRequestJoinClassById = (classId: string) => {
    const target = classrooms.find((c) => c.id === classId);
    if (!target) return;
    if (target.studentIds.includes(currentUserId)) return;

    if (target.pendingStudentIds?.includes(currentUserId)) {
      setJoinMessage({
        text: `Bạn đã gửi yêu cầu tham gia "${target.name}" trước đó. Vui lòng chờ thầy cô duyệt nhé!`,
        type: 'error',
      });
      setTimeout(() => setJoinMessage(null), 4000);
      return;
    }

    if (target.requiresApproval !== false) {
      const updated = classrooms.map((c) => {
        if (c.id === target.id) {
          const nextPending = Array.from(new Set([...(c.pendingStudentIds || []), currentUserId]));
          return { ...c, pendingStudentIds: nextPending };
        }
        return c;
      });
      onUpdateClassrooms(updated);
      setJoinMessage({
        text: `Đã gửi yêu cầu tham gia "${target.name}". Vui lòng chờ giáo viên duyệt!`,
        type: 'success',
      });
      setTimeout(() => setJoinMessage(null), 4500);
    } else {
      const updated = classrooms.map((c) => {
        if (c.id === target.id) {
          return { ...c, studentIds: [...c.studentIds, currentUserId] };
        }
        return c;
      });
      onUpdateClassrooms(updated);
      setJoinMessage({
        text: `Bạn đã tham gia thành công vào lớp "${target.name}"!`,
        type: 'success',
      });
      setTimeout(() => setJoinMessage(null), 4000);
    }
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

  // 4f. Giáo viên chuyển đổi chế độ hiển thị nhóm lớp (Công khai <-> Cá nhân)
  const handleToggleClassVisibility = () => {
    if (!currentClass) return;
    const isCurrentlyPrivate = currentClass.visibility === 'private';
    const nextVisibility: 'public' | 'private' = isCurrentlyPrivate ? 'public' : 'private';

    const updatedClassrooms = classrooms.map((cls) => {
      if (cls.id === currentClass.id) {
        return {
          ...cls,
          visibility: nextVisibility,
        };
      }
      return cls;
    });

    onUpdateClassrooms(updatedClassrooms);
    setApprovalActionSuccess(
      nextVisibility === 'private'
        ? 'Đã chuyển sang Nhóm lớp cá nhân: Chỉ thành viên trong nhóm mới nhìn thấy!'
        : 'Đã chuyển sang Nhóm lớp công khai: Mọi thành viên hệ thống đều có thể nhìn thấy!'
    );
    setTimeout(() => setApprovalActionSuccess(null), 4000);
  };

  // 5. Giao đề thi cho cả lớp
  const handleAssignExamToClass = async (examId: string) => {
    if (!currentClass) return;

    // 1. Cập nhật assignedExamIds của nhóm lớp (onUpdateClassrooms tự lưu dbSaveClassrooms)
    const updated = classrooms.map((cls) => {
      if (cls.id === currentClass.id) {
        const currentAssigned = cls.assignedExamIds || [];
        if (!currentAssigned.includes(examId)) {
          return { ...cls, assignedExamIds: [...currentAssigned, examId] };
        }
      }
      return cls;
    });

    onUpdateClassrooms(updated);

    // 2. Cập nhật targetClassIds của đề thi và đồng bộ lên Firestore & Server DB
    const targetExam = examsList.find((e) => e.id === examId);
    if (targetExam) {
      const currentTargets = targetExam.targetClassIds || [];
      const nextTargets = currentTargets.includes(currentClass.id)
        ? currentTargets
        : [...currentTargets, currentClass.id];
      const updatedExam: Exam = {
        ...targetExam,
        targetClassIds: nextTargets,
        distributionType: targetExam.distributionType === 'repository' ? 'both' : (targetExam.distributionType || 'classroom'),
      };
      if (onSaveExam) {
        onSaveExam(updatedExam);
      } else {
        if (onUpdateExamsList) {
          onUpdateExamsList(examsList.map((ex) => (ex.id === examId ? updatedExam : ex)));
        }
        dbSaveExam(updatedExam).catch(console.error);
      }
    }
  };

  // ==========================================
  // XỬ LÝ CHAT TRONG NHÓM LỚP (GỬI ẢNH, TAG TÊN, EMOJI)
  // ==========================================
  const handleSendChatMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatMessageText.trim() && !attachedImage) return;
    if (!currentClass || !isCurrentClassMember) return;

    // Tìm các tag @tên trong nội dung
    const mentions: ChatMention[] = [];
    classMembersForMention.forEach((member) => {
      if (chatMessageText.includes(`@${member.name}`)) {
        mentions.push({ userId: member.id, userName: member.name });
      }
    });

    if (
      chatMessageText.includes('@Cả Lớp') ||
      chatMessageText.toLowerCase().includes('@all') ||
      chatMessageText.toLowerCase().includes('@everyone')
    ) {
      if (!mentions.some((m) => m.userId === 'all')) {
        mentions.push({ userId: 'all', userName: 'Cả Lớp' });
      }
    }

    const newMsg: ClassroomChatMessage = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      classId: currentClass.id,
      senderId: currentUserId,
      senderName: currentUserName || 'Thành viên',
      senderRole: userRole,
      senderAvatar: currentUserAvatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(currentUserId || 'student')}`,
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

  // Xóa tin nhắn trong lớp học (Dành cho người gửi hoặc Giáo viên / Admin)
  const handleDeleteChatMessage = (messageId: string) => {
    if (!currentClass) return;
    setDeletedMessageIds((prev) => {
      const next = new Set(prev);
      next.add(messageId);
      return next;
    });
    setLocalMessages((prev) => {
      const next = {
        ...prev,
        [currentClass.id]: (prev[currentClass.id] || []).filter((m) => m.id !== messageId),
      };
      if (currentClass.code && next[currentClass.code]) {
        next[currentClass.code] = next[currentClass.code].filter((m) => m.id !== messageId);
      }
      return next;
    });
    if (onDeleteChatMessage) {
      onDeleteChatMessage(messageId, currentClass.id);
    }
  };

  // Xử lý thả / hủy phản ứng Emoji trên từng tin nhắn
  const handleToggleReaction = (msgId: string, emoji: string) => {
    if (!currentClass || !isCurrentClassMember) return;
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
    if (onToggleReaction && currentClass) {
      onToggleReaction(msgId, emoji, currentClass.id);
    }
    setActiveReactionMessageId(null);
  };

  // Chèn emoji vào ô soạn tin nhắn
  const handleInsertEmoji = (emoji: string) => {
    setChatMessageText((prev) => prev + emoji);
  };

  // Xử lý nén tự động và đính kèm ảnh bài tập từ máy/điện thoại (Tối ưu hóa dưới 150KB để Firestore truyền tức thời)
  const [imageUploadError, setImageUploadError] = useState<string | null>(null);

  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 20 * 1024 * 1024) {
        setImageUploadError('Dung lượng tệp ảnh quá lớn (>20MB). Vui lòng chọn ảnh nhỏ hơn!');
        setTimeout(() => setImageUploadError(null), 4000);
        return;
      }
      const reader = new FileReader();
      reader.onload = (event) => {
        const rawUrl = event.target?.result as string;
        if (!rawUrl) return;

        const img = new Image();
        img.onload = () => {
          const maxDim = 1200;
          let width = img.width;
          let height = img.height;
          if (width > maxDim || height > maxDim) {
            if (width > height) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            } else {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0, width, height);
            const compressed = canvas.toDataURL('image/jpeg', 0.8);
            setAttachedImage(compressed);
          } else {
            setAttachedImage(rawUrl);
          }
        };
        img.onerror = () => {
          setAttachedImage(rawUrl);
        };
        img.src = rawUrl;
      };
      reader.readAsDataURL(file);
    }
    if (e.target) {
      e.target.value = '';
    }
  };

  // Chèn tag tên vào nội dung tin nhắn
  const handleInsertMention = (memberName: string) => {
    setChatMessageText((prev) => `${prev}@${memberName} `);
    setShowMentionPicker(false);
  };

  // Hàm render nội dung tin nhắn kèm định dạng highlight cho @tag và tự động nhận diện link
  const renderMessageContent = (content: string, isMe: boolean = false) => {
    const mentionPattern = /(@[A-Za-z0-9À-ỹ\s\.]+?)(?=\s|$)/g;
    const parts = content.split(mentionPattern);
    const linkClass = isMe
      ? 'text-white hover:text-blue-100 underline decoration-white/80 underline-offset-2 font-semibold break-all'
      : 'text-blue-600 hover:text-blue-800 underline decoration-blue-400/70 underline-offset-2 font-medium break-all';

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
      return <span key={i}>{renderTextWithLinks(part, linkClass)}</span>;
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
        {visibleClassrooms.map((cls) => {
          const isSelected = cls.id === currentClass?.id;
          const isMember = isMemberOfClass(cls);
          const isPending = isPendingApprovalInClass(cls);
          const isPrivate = cls.visibility === 'private';
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
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-1.5">
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
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full inline-flex items-center gap-1 ${
                      isPrivate
                        ? isSelected
                          ? 'bg-indigo-800 text-indigo-100'
                          : 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                        : isSelected
                        ? 'bg-sky-700/70 text-sky-100'
                        : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    }`}
                  >
                    {isPrivate ? <EyeOff size={10} /> : <Globe size={10} />}
                    <span>{isPrivate ? 'Cá nhân' : 'Công khai'}</span>
                  </span>
                </div>

                {userRole === 'student' && (
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full inline-flex items-center gap-1 ${
                      isMember
                        ? isSelected
                          ? 'bg-emerald-500/30 text-emerald-100'
                          : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : isPending
                        ? isSelected
                          ? 'bg-amber-500/30 text-amber-100'
                          : 'bg-amber-50 text-amber-700 border border-amber-200'
                        : isSelected
                        ? 'bg-slate-800/40 text-slate-200'
                        : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    {isMember ? (
                      <>
                        <Unlock size={10} /> Đã vào
                      </>
                    ) : isPending ? (
                      <>
                        <Clock size={10} /> Chờ duyệt
                      </>
                    ) : (
                      <>
                        <Lock size={10} /> Khóa
                      </>
                    )}
                  </span>
                )}
              </div>
              <h4 className="font-bold text-sm mt-1">{cls.name}</h4>
              <span className={`text-[11px] mt-0.5 block ${isSelected ? 'text-blue-100' : 'text-slate-500'}`}>
                {cls.studentIds.length} học sinh ·{' '}
                {
                  Array.from(
                    new Set([
                      ...(cls.assignedExamIds || []),
                      ...examsList
                        .filter((e) => e.targetClassIds && e.targetClassIds.includes(cls.id))
                        .map((e) => e.id),
                    ])
                  ).filter((examId) => examsList.some((e) => e.id === examId)).length
                }{' '}
                đề thi
              </span>
            </button>
          );
        })}
      </div>

      {/* Selected Classroom Details (Chỉ hiển thị khi đã là thành viên chính thức của nhóm lớp) */}
      {currentClass && isCurrentClassMember && (
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
                <div className="flex items-center gap-1.5">
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold inline-flex items-center gap-1 ${
                      currentClass.visibility === 'private'
                        ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                        : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    }`}
                  >
                    {currentClass.visibility === 'private' ? <EyeOff size={11} /> : <Globe size={11} />}
                    <span>{currentClass.visibility === 'private' ? 'Cá nhân' : 'Công khai'}</span>
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 text-[11px] font-bold">
                    Khối {currentClass.grade}
                  </span>
                </div>
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

                {(userRole === 'teacher' || userRole === 'admin') && (
                  <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-2">
                    <div>
                      <span className="text-[11px] font-bold text-slate-800 block">Quyền hiển thị nhóm lớp</span>
                      <span className="text-[10px] text-slate-500">
                        {currentClass.visibility === 'private'
                          ? 'Cá nhân: Chỉ thành viên trong nhóm mới thấy'
                          : 'Công khai: Mọi người đều thấy trong danh sách'}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={handleToggleClassVisibility}
                      className={`px-3 py-1.5 rounded-xl font-bold text-[11px] flex items-center gap-1.5 border transition-colors shrink-0 ${
                        currentClass.visibility === 'private'
                          ? 'bg-indigo-600 text-white border-indigo-600 hover:bg-indigo-700'
                          : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                      }`}
                    >
                      {currentClass.visibility === 'private' ? <EyeOff size={12} /> : <Globe size={12} />}
                      <span>{currentClass.visibility === 'private' ? 'Cá nhân' : 'Công khai'}</span>
                    </button>
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

              {/* Nút Giải Tán Nhóm Lớp dành cho Giáo Viên / Quản Trị Viên */}
              {(userRole === 'teacher' || userRole === 'admin') && onDisbandClassroom && (
                <div className="pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setClassToDisband(currentClass)}
                    className="w-full py-2.5 rounded-2xl bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs flex items-center justify-center gap-2 border border-rose-200 transition-colors shadow-2xs group"
                  >
                    <Trash2 size={15} className="text-rose-500 group-hover:scale-110 transition-transform" />
                    <span>Giải Tán Nhóm Lớp</span>
                  </button>
                </div>
              )}
            </div>

            {/* Assigned Exams Card */}
            <div className="bg-white rounded-3xl border border-slate-200 p-6 space-y-4 shadow-xs">
              {(() => {
                const combinedExamIds = Array.from(
                  new Set([
                    ...(currentClass.assignedExamIds || []),
                    ...examsList
                      .filter((e) => e.targetClassIds && e.targetClassIds.includes(currentClass.id))
                      .map((e) => e.id),
                  ])
                ).filter((examId) => {
                  const ex = examsList.find((e) => e.id === examId);
                  if (!ex) return false;
                  const isAssigned = (currentClass.assignedExamIds || []).includes(examId);
                  const isTargeted = Boolean(ex.targetClassIds && ex.targetClassIds.includes(currentClass.id));
                  return isAssigned || isTargeted;
                });

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

                          const scoreMode: ScoreVisibilityMode = examObj.scoreVisibility || 'immediate';
                          const handleChangeExamScoreVisibility = (nextMode: ScoreVisibilityMode) => {
                            if (scoreMode === nextMode) return;
                            const updatedExam: Exam = { ...examObj, scoreVisibility: nextMode };
                            if (onSaveExam) {
                              onSaveExam(updatedExam);
                            } else if (onUpdateExamsList) {
                              onUpdateExamsList(examsList.map((e) => (e.id === updatedExam.id ? updatedExam : e)));
                              dbSaveExam(updatedExam).catch(console.error);
                            }
                            setExamActionSuccess(
                              `Đã cập nhật chế độ hiển thị điểm cho "${examObj.title}": ${getExamScoreVisibilityLabel(nextMode)}`
                            );
                            setTimeout(() => setExamActionSuccess(null), 3500);
                          };

                          return (
                            <div
                              key={examId}
                              className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col gap-2.5 text-xs"
                            >
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
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
                                    <span
                                      className={`px-2 py-0.5 rounded text-[10px] font-bold inline-flex items-center gap-1 ${
                                        scoreMode === 'immediate'
                                          ? 'bg-emerald-100 text-emerald-800'
                                          : scoreMode === 'after_close'
                                          ? 'bg-amber-100 text-amber-800'
                                          : 'bg-rose-100 text-rose-800'
                                      }`}
                                    >
                                      {scoreMode === 'immediate' ? (
                                        <Eye size={10} />
                                      ) : scoreMode === 'after_close' ? (
                                        <Clock size={10} />
                                      ) : (
                                        <EyeOff size={10} />
                                      )}
                                      <span>{getExamScoreVisibilityLabel(scoreMode)}</span>
                                    </span>
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
                                        className="px-2 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 font-bold text-[11px] flex items-center gap-1 shadow-xs transition-colors whitespace-nowrap"
                                        title="Gỡ đề thi này khỏi danh sách đề đã giao cho nhóm lớp"
                                      >
                                        <X size={12} />
                                        <span>Gỡ khỏi lớp</span>
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => setExamToDeletePermanently(examObj)}
                                        className="px-2 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 font-bold text-[11px] flex items-center gap-1 shadow-xs transition-colors whitespace-nowrap"
                                        title="Xóa vĩnh viễn đề thi và toàn bộ dữ liệu bài nộp liên quan"
                                      >
                                        <Trash2 size={12} />
                                        <span>Xóa đề thi</span>
                                      </button>
                                    </div>
                                  )}
                                </div>
                              </div>

                              {userRole === 'teacher' && (
                                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-200/80">
                                  <span className="text-[11px] font-bold text-slate-500">
                                    Chế độ xem điểm của học sinh:
                                  </span>
                                  <div className="inline-flex rounded-xl border border-slate-200 bg-white p-0.5 gap-0.5">
                                    {(
                                      [
                                        { mode: 'immediate', label: 'Biết điểm ngay' },
                                        { mode: 'after_close', label: 'Biết điểm sau' },
                                        { mode: 'hidden', label: 'Không cho biết' },
                                      ] as const
                                    ).map((opt) => (
                                      <button
                                        key={opt.mode}
                                        type="button"
                                        onClick={() => handleChangeExamScoreVisibility(opt.mode)}
                                        className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-colors cursor-pointer ${
                                          scoreMode === opt.mode
                                            ? opt.mode === 'immediate'
                                              ? 'bg-emerald-600 text-white'
                                              : opt.mode === 'after_close'
                                              ? 'bg-amber-600 text-white'
                                              : 'bg-rose-600 text-white'
                                            : 'text-slate-600 hover:bg-slate-100'
                                        }`}
                                      >
                                        {opt.label}
                                      </button>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })
                      )}
                    </div>

                    {userRole === 'teacher' && examsList.some((e) => !combinedExamIds.includes(e.id)) && (
                      <div className="pt-2">
                        <label className="text-xs font-bold text-slate-600 block mb-1.5">Giao thêm đề thi khác:</label>
                        <div className="flex gap-2">
                          <select
                            id="assignExamSelect"
                            className="flex-1 h-10 px-3 rounded-xl border border-slate-300 text-xs bg-white focus:outline-none"
                          >
                            {examsList
                              .filter((e) => !combinedExamIds.includes(e.id))
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
                  </>
                );
              })()}
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
                    onClick={() => openAddLessonModal()}
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
                  </div>

                  <div className="flex items-center gap-2 shrink-0 flex-wrap">
                    <button
                      type="button"
                      onClick={handleManualRefreshLessons}
                      className="px-2.5 py-1 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-[11px] font-bold flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer"
                      title="Tải lại danh sách bài học"
                    >
                      <RefreshCw size={13} className={isRefreshingLessons ? 'animate-spin text-blue-600' : 'text-slate-500'} />
                      <span>{isRefreshingLessons ? 'Đang tải...' : 'Làm mới'}</span>
                    </button>
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
                    {userRole === 'teacher' && (
                      <button
                        type="button"
                        onClick={() => openAddLessonModal()}
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
                          {/* Tiêu đề chương học - Nhấp để mở rộng / thu gọn các bài học */}
                          <div
                            className={`w-full p-4 flex items-center justify-between gap-3 transition-colors ${
                              isExpanded ? 'bg-blue-50/70 border-b border-blue-100' : 'hover:bg-slate-50/80'
                            }`}
                          >
                            <button
                              type="button"
                              onClick={() => toggleChapter(chapterTitle)}
                              className="flex items-center gap-3 min-w-0 flex-1 text-left cursor-pointer"
                            >
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
                            </button>

                            <div className="flex items-center gap-2 shrink-0">
                              {userRole === 'teacher' && (
                                <button
                                  type="button"
                                  onClick={() => openAddLessonModal(chapterTitle)}
                                  className="px-2.5 py-1 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-bold flex items-center gap-1 shadow-2xs transition-colors cursor-pointer"
                                  title={`Thêm bài học mới vào "${chapterTitle}"`}
                                >
                                  <Plus size={13} />
                                  <span className="hidden sm:inline">Thêm bài</span>
                                </button>
                              )}
                              <span className="px-2.5 py-1 rounded-xl bg-white border border-slate-200 text-slate-700 text-[11px] font-bold shadow-2xs">
                                {lessons.length} bài
                              </span>
                              <button
                                type="button"
                                onClick={() => toggleChapter(chapterTitle)}
                                className="w-7 h-7 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-slate-500 shadow-2xs cursor-pointer"
                                aria-label={isExpanded ? 'Thu gọn chương' : 'Mở rộng chương'}
                              >
                                {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                              </button>
                            </div>
                          </div>

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
                                          {renderTextWithLinks(lesson.description)}
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
                                              onClick={() => setLessonToDelete(lesson)}
                                              className="p-1.5 rounded-xl text-rose-500 hover:bg-rose-50 hover:text-rose-700 transition-colors"
                                              title="Xóa bài học này và toàn bộ dữ liệu liên quan"
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
                                        <span>Ô Luyện tập ({lesson.exercisesCount ?? 10} câu)</span>
                                      </span>

                                      {hasPracticePdf && (
                                        <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 font-semibold border border-emerald-200 flex items-center gap-1">
                                          <Paperclip size={11} />
                                          <span>PDF Luyện tập</span>
                                        </span>
                                      )}

                                      {hasLink && (() => {
                                        const rawLinkUrl =
                                          lesson.externalLink ||
                                          lesson.attachments?.find((a) => a.type === 'link')?.url ||
                                          '';
                                        const safeHref = normalizeSafeHref(rawLinkUrl, true);
                                        return safeHref ? (
                                          <a
                                            href={safeHref}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            onClick={(e) => e.stopPropagation()}
                                            className="px-2 py-0.5 rounded-md bg-blue-50 hover:bg-blue-100 text-blue-700 font-semibold border border-blue-200 flex items-center gap-1 transition-colors"
                                            title={`Mở liên kết: ${safeHref}`}
                                          >
                                            <ExternalLink size={11} />
                                            <span>Mở link</span>
                                          </a>
                                        ) : (
                                          <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-semibold border border-slate-200 flex items-center gap-1">
                                            <ExternalLink size={11} />
                                            <span>Link trực tuyến</span>
                                          </span>
                                        );
                                      })()}

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
                {/* Header trạng thái thảo luận nhóm với huy hiệu đồng bộ Real-Time */}
                <div className="flex items-center justify-between pb-2.5 border-b border-slate-100 text-xs flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <span className="font-extrabold text-slate-800">Thảo Luận {currentClass.name}</span>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    {/* Cần gạt ON/OFF thông báo ngay tại Header Chat */}
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-slate-100 border border-slate-200">
                      <div className="flex items-center gap-1 text-[11px] font-bold text-slate-700">
                        {chatNotifsEnabled ? (
                          <BellRing size={13} className="text-blue-600 animate-pulse" />
                        ) : (
                          <BellOff size={13} className="text-slate-400" />
                        )}
                        <span className="hidden sm:inline">Thông báo:</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          const next = !chatNotifsEnabled;
                          setChatNotifsEnabled(next);
                          setNotificationsEnabled(next);
                        }}
                        role="switch"
                        aria-checked={chatNotifsEnabled}
                        title={chatNotifsEnabled ? 'Nhấp để TẮT thông báo bài đăng và nhắc tên' : 'Nhấp để BẬT thông báo bài đăng và nhắc tên'}
                        className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full transition-colors duration-200 ease-in-out focus:outline-hidden ${
                          chatNotifsEnabled ? 'bg-blue-600' : 'bg-slate-300'
                        }`}
                      >
                        <span
                          className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-xs transition duration-200 ease-in-out mt-0.5 ${
                            chatNotifsEnabled ? 'translate-x-4 ml-0.5' : 'translate-x-0.5'
                          }`}
                        />
                      </button>
                      <span
                        className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded ${
                          chatNotifsEnabled ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'
                        }`}
                      >
                        {chatNotifsEnabled ? 'BẬT' : 'TẮT'}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        if (currentClass) {
                          dbFetchClassMessages(currentClass.id).then((serverList) => {
                            if (serverList && serverList.length > 0) {
                              setLocalMessages((prev) => {
                                const existing = prev[currentClass.id] || [];
                                const msgMap = new Map<string, ClassroomChatMessage>();
                                existing.forEach((m) => msgMap.set(m.id, m));
                                serverList.forEach((m) => msgMap.set(m.id, m));
                                return {
                                  ...prev,
                                  [currentClass.id]: Array.from(msgMap.values()).sort(
                                    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
                                  ),
                                };
                              });
                            }
                          });
                        }
                      }}
                      className="px-2.5 py-1 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-semibold transition-colors flex items-center gap-1 border border-slate-200"
                      title="Làm mới tin nhắn tức thời"
                    >
                      <RefreshCw size={12} />
                      <span>Làm mới</span>
                    </button>
                    <span className="text-[11px] text-slate-400 font-medium">
                      {currentClassMessages.length} tin nhắn
                    </span>
                  </div>
                </div>

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
                              <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5 bg-white/95 shadow-xs border border-slate-200 rounded-full px-1.5 py-0.5 ml-1">
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
                                {(isMe || userRole === 'teacher' || userRole === 'admin') && (
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteChatMessage(msg.id)}
                                    className="hover:scale-125 transition-transform text-xs p-1 text-slate-400 hover:text-rose-600 rounded-full ml-0.5"
                                    title="Xóa tin nhắn này"
                                  >
                                    <Trash2 size={12} />
                                  </button>
                                )}
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
                              <div className="whitespace-pre-wrap">{renderMessageContent(msg.content, isMe)}</div>

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
                  <div ref={messagesEndRef} />
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
                            {member.id === 'all' ? (
                              <span className="text-[10px] text-blue-600 font-semibold">(Toàn bộ lớp học)</span>
                            ) : (
                              <span className="text-[10px] text-slate-400 font-mono">({member.id})</span>
                            )}
                          </div>
                          <span
                            className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                              member.id === 'all'
                                ? 'bg-emerald-100 text-emerald-800'
                                : member.role === 'teacher'
                                ? 'bg-purple-100 text-purple-700'
                                : 'bg-blue-100 text-blue-700'
                            }`}
                          >
                            {member.id === 'all' ? 'Tất cả' : member.role === 'teacher' ? 'Giáo viên' : 'Học sinh'}
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

                  {/* Image Upload Warning */}
                  {imageUploadError && (
                    <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2 animate-in fade-in">
                      <AlertTriangle size={15} className="shrink-0 text-rose-600" />
                      <span>{imageUploadError}</span>
                    </div>
                  )}

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
                        onPaste={(e) => {
                          const items = e.clipboardData?.items;
                          if (items) {
                            for (let i = 0; i < items.length; i++) {
                              if (items[i].type.indexOf('image') !== -1) {
                                const file = items[i].getAsFile();
                                if (file) {
                                  const reader = new FileReader();
                                  reader.onload = (event) => {
                                    if (event.target?.result) {
                                      setAttachedImage(event.target.result as string);
                                    }
                                  };
                                  reader.readAsDataURL(file);
                                  e.preventDefault();
                                  break;
                                }
                              }
                            }
                          }
                        }}
                        placeholder={`Nhắn tin thảo luận trong ${currentClass?.name || 'nhóm lớp'} (Nhấn Enter để gửi, dán ảnh Ctrl+V, Shift+Enter xuống dòng)...`}
                        className="flex-1 w-full bg-transparent text-xs text-slate-800 placeholder-slate-400 focus:outline-none resize-none min-h-[46px] max-h-32"
                      />

                      {/* Tool Buttons & Send Button */}
                      <div className="flex items-center justify-between sm:justify-end gap-1.5 pt-1 sm:pt-0 shrink-0">
                        {/* Attach Image button (chỉ để icon theo yêu cầu) */}
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          title="Gửi ảnh bài tập từ máy"
                          className="p-2.5 rounded-xl text-slate-500 hover:text-blue-600 hover:bg-blue-50 border border-slate-200 transition-colors flex items-center justify-center"
                        >
                          <ImageIcon size={17} />
                        </button>

                        {/* Tag Member button (chỉ để icon theo yêu cầu) */}
                        <button
                          type="button"
                          onClick={() => setShowMentionPicker((prev) => !prev)}
                          title="Tag tên thành viên (@tên)"
                          className={`p-2.5 rounded-xl border transition-colors flex items-center justify-center ${
                            showMentionPicker
                              ? 'bg-blue-100 text-blue-700 border-blue-300'
                              : 'text-slate-500 hover:text-blue-600 hover:bg-blue-50 border-slate-200'
                          }`}
                        >
                          <AtSign size={17} />
                        </button>

                        {/* Send button (chỉ để icon theo yêu cầu) */}
                        <button
                          type="submit"
                          disabled={!chatMessageText.trim() && !attachedImage}
                          title="Gửi tin nhắn (Enter)"
                          className="p-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-xs shadow-xs flex items-center justify-center transition-all"
                        >
                          <Send size={17} />
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

                {/* Thẻ Giáo Viên Phụ Trách Lớp */}
                <div className="p-4 rounded-2xl bg-linear-to-r from-blue-50 via-indigo-50/50 to-white border border-blue-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
                  <div className="flex items-center gap-3.5">
                    <div className="w-11 h-11 rounded-2xl bg-blue-600 text-white overflow-hidden flex items-center justify-center font-bold text-sm shadow-xs shrink-0">
                      {classTeacherUser.avatar ? (
                        <img src={classTeacherUser.avatar} alt={classTeacherUser.name} className="w-full h-full object-cover" />
                      ) : (
                        <GraduationCap size={22} />
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="font-extrabold text-sm text-slate-900">{classTeacherUser.name}</h4>
                        <span className="px-2 py-0.5 rounded-full bg-blue-600 text-white font-extrabold text-[10px] flex items-center gap-1 shadow-2xs">
                          <GraduationCap size={11} />
                          <span>Giáo Viên Phụ Trách</span>
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 font-mono mt-0.5">
                        ID: <strong className="text-slate-700">{classTeacherUser.id}</strong> · {currentClass?.name || 'Lớp học'}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between pb-3 border-b border-slate-100 flex-wrap gap-2">
                  <div>
                    <h3 className="font-extrabold text-sm text-slate-900">
                      Danh Sách Học Sinh ({enrolledStudents.length} học sinh)
                    </h3>
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

      {/* Màn hình bảo mật khóa lớp học khi người dùng chưa là thành viên */}
      {currentClass && !isCurrentClassMember && (
        <div className="bg-white rounded-3xl border border-slate-200 p-8 sm:p-12 shadow-sm text-center max-w-2xl mx-auto space-y-6 animate-in fade-in">
          <div className="w-20 h-20 mx-auto rounded-3xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600 shadow-xs">
            {isCurrentClassPending ? <Clock size={38} className="animate-pulse" /> : <Lock size={38} />}
          </div>

          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-100 text-slate-700 text-xs font-bold font-mono">
              <span>Mã Lớp: {currentClass.code}</span>
              <span>·</span>
              <span>Khối {currentClass.grade}</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900">
              Lớp {currentClass.name}
            </h2>
            <p className="text-slate-500 text-sm max-w-lg mx-auto">
              {isCurrentClassPending
                ? 'Yêu cầu gia nhập lớp học của bạn đã được gửi tới giáo viên. Vui lòng chờ thầy cô phê duyệt để truy cập toàn bộ bài học, tài liệu PDF và trao đổi thảo luận!'
                : 'Nội dung nhóm lớp này được bảo mật riêng tư. Chỉ những học sinh là thành viên chính thức mới có quyền xem bài học, đề thi và tham gia trao đổi thảo luận.'}
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-left max-w-md mx-auto space-y-2 text-xs">
            <div className="flex justify-between items-center pb-2 border-b border-slate-200">
              <span className="text-slate-500">Giáo viên phụ trách:</span>
              <span className="font-bold text-slate-800">{currentClass.teacherName}</span>
            </div>
            <div className="flex justify-between items-center pb-2 border-b border-slate-200">
              <span className="text-slate-500">Sĩ số lớp hiện tại:</span>
              <span className="font-bold text-slate-800">{currentClass.studentIds.length} học sinh</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-500">Trạng thái của bạn:</span>
              <span
                className={`font-bold px-2.5 py-0.5 rounded-full inline-flex items-center gap-1 ${
                  isCurrentClassPending
                    ? 'bg-amber-100 text-amber-800'
                    : 'bg-rose-100 text-rose-800'
                }`}
              >
                {isCurrentClassPending ? (
                  <>
                    <Clock size={12} /> Đang chờ giáo viên duyệt
                  </>
                ) : (
                  <>
                    <Lock size={12} /> Chưa là thành viên
                  </>
                )}
              </span>
            </div>
          </div>

          {/* Hành động xin vào lớp */}
          <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
            {isCurrentClassPending ? (
              <div className="px-6 py-3 rounded-2xl bg-amber-50 text-amber-800 font-bold text-sm border border-amber-200 flex items-center gap-2">
                <Clock size={16} />
                <span>Yêu cầu đang chờ xét duyệt — Vui lòng quay lại sau!</span>
              </div>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => handleRequestJoinClassById(currentClass.id)}
                  className="w-full sm:w-auto px-6 py-3 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm shadow-md flex items-center justify-center gap-2 transition-all"
                >
                  <KeyRound size={16} />
                  <span>Gửi Yêu Cầu Xin Vào Lớp</span>
                </button>
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <input
                    type="text"
                    value={joinCodeInput}
                    onChange={(e) => setJoinCodeInput(e.target.value)}
                    placeholder="Hoặc nhập mã lớp..."
                    className="h-11 px-3.5 rounded-xl border border-slate-300 text-xs font-mono font-bold uppercase focus:border-blue-600 focus:outline-none w-full sm:w-44"
                  />
                  <button
                    type="button"
                    onClick={handleJoinClassByCode}
                    className="h-11 px-4 rounded-xl bg-slate-900 hover:bg-black text-white font-bold text-xs shrink-0 shadow-xs transition-colors"
                  >
                    Vào Ngay
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Màn hình khi học sinh chưa tham gia lớp nào (hoặc chưa chọn lớp) */}
      {!currentClass && (
        <div className="bg-white rounded-3xl border border-slate-200 p-8 sm:p-12 shadow-sm text-center max-w-2xl mx-auto space-y-6 animate-in fade-in">
          <div className="w-20 h-20 mx-auto rounded-3xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600 shadow-xs">
            <GraduationCap size={40} />
          </div>

          <div className="space-y-2">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900">
              Chào Mừng Bạn Đến Với Không Gian Lớp Học
            </h2>
            <p className="text-slate-500 text-sm max-w-md mx-auto">
              Bạn hiện chưa tham gia nhóm lớp nào. Vui lòng nhập mã lớp do thầy cô cung cấp để vào lớp và bắt đầu học tập.
            </p>
          </div>

          <div className="max-w-md mx-auto p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
            <label className="text-xs font-bold text-slate-700 block text-left">
              Nhập mã tham gia lớp học:
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={joinCodeInput}
                onChange={(e) => setJoinCodeInput(e.target.value)}
                placeholder="Ví dụ: NBK-12A1"
                className="h-11 flex-1 px-4 rounded-xl border border-slate-300 text-sm font-mono font-bold uppercase focus:border-blue-600 focus:outline-none"
              />
              <button
                type="button"
                onClick={handleJoinClassByCode}
                className="h-11 px-6 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm shadow-xs transition-colors shrink-0"
              >
                Vào Lớp
              </button>
            </div>

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
                <label className="font-bold text-slate-700 block">Chế độ hiển thị nhóm lớp</label>
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => setNewClassVisibility('public')}
                    className={`p-3 rounded-2xl border text-left transition-all flex flex-col gap-1 ${
                      newClassVisibility === 'public'
                        ? 'bg-blue-50 border-blue-600 text-blue-900 ring-1 ring-blue-600'
                        : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 font-extrabold text-xs">
                      <Globe size={14} className={newClassVisibility === 'public' ? 'text-blue-600' : 'text-slate-500'} />
                      <span>Nhóm lớp công khai</span>
                    </div>
                    <span className="text-[10px] text-slate-500 leading-snug">
                      Hiển thị công khai trong danh sách lớp để học sinh xin vào.
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setNewClassVisibility('private')}
                    className={`p-3 rounded-2xl border text-left transition-all flex flex-col gap-1 ${
                      newClassVisibility === 'private'
                        ? 'bg-indigo-50 border-indigo-600 text-indigo-900 ring-1 ring-indigo-600'
                        : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 font-extrabold text-xs">
                      <EyeOff size={14} className={newClassVisibility === 'private' ? 'text-indigo-600' : 'text-slate-500'} />
                      <span>Nhóm lớp cá nhân</span>
                    </div>
                    <span className="text-[10px] text-slate-500 leading-snug">
                      Chỉ thành viên trong nhóm mới nhìn thấy nhóm lớp này.
                    </span>
                  </button>
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

            </div>

            <div className="flex flex-col sm:flex-row gap-2 pt-2">
              <button
                type="button"
                onClick={() => setExamToRemoveFromClass(null)}
                className="py-2.5 px-4 rounded-xl border border-slate-300 text-xs font-bold text-slate-700 hover:bg-slate-50 order-3 sm:order-1"
              >
                Hủy Bỏ
              </button>
              <button
                type="button"
                onClick={handleConfirmRemoveExamFromClass}
                className="flex-1 py-2.5 px-3 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow-xs order-1 sm:order-2 flex items-center justify-center gap-1"
              >
                <X size={13} />
                <span>Chỉ Gỡ Khỏi Lớp Này</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  const target = examToRemoveFromClass;
                  setExamToRemoveFromClass(null);
                  setExamToDeletePermanently(target);
                }}
                className="py-2.5 px-3 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-xs order-2 sm:order-3 flex items-center justify-center gap-1"
                title="Xóa đề thi vĩnh viễn khỏi toàn bộ hệ thống"
              >
                <Trash2 size={13} />
                <span>Xóa Vĩnh Viễn Đề</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL HỎI LẠI KHI XÓA BÀI HỌC VÀ TOÀN BỘ DỮ LIỆU LIÊN QUAN                */}
      {/* ========================================================================= */}
      <DeleteConfirmationModal
        isOpen={Boolean(lessonToDelete)}
        itemType="lesson"
        title="Xác Nhận Xóa Bài Học"
        itemName={lessonToDelete?.title || ''}
        itemSubtitle={`Chuyên đề: ${lessonToDelete?.chapter || ''} · Lớp ${currentClass?.name || ''}`}
        isDeleting={isDeletingItem}
        onConfirm={handleConfirmDeleteLesson}
        onCancel={() => setLessonToDelete(null)}
      />

      {/* ========================================================================= */}
      {/* MODAL HỎI LẠI KHI XÓA ĐỀ THI VÀ TOÀN BỘ DỮ LIỆU LIÊN QUAN                */}
      {/* ========================================================================= */}
      <DeleteConfirmationModal
        isOpen={Boolean(examToDeletePermanently)}
        itemType="exam"
        title="Xác Nhận Xóa Đề Thi Vĩnh Viễn"
        itemName={examToDeletePermanently?.title || ''}
        itemSubtitle={`Khối ${examToDeletePermanently?.grade || 12} · ${examToDeletePermanently?.durationMinutes || 90} phút · ${examToDeletePermanently?.questions?.length || 0} câu hỏi`}
        isDeleting={isDeletingItem}
        onConfirm={handleConfirmDeleteExamPermanently}
        onCancel={() => setExamToDeletePermanently(null)}
      />

      {/* ========================================================================= */}
      {/* MODAL HỎI LẠI KHI GIẢI TÁN NHÓM LỚP VÀ TOÀN BỘ DỮ LIỆU LIÊN QUAN          */}
      {/* ========================================================================= */}
      <DeleteConfirmationModal
        isOpen={Boolean(classToDisband)}
        itemType="custom"
        title="Xác Nhận Giải Tán Nhóm Lớp Học"
        itemName={classToDisband?.name || ''}
        itemSubtitle={`Mã lớp: ${classToDisband?.code || ''} · Khối ${classToDisband?.grade || ''} (${classToDisband?.studentIds.length || 0} học sinh)`}
        impactDetails={[
          'Toàn bộ nhóm lớp học sẽ bị giải tán và xóa vĩnh viễn khỏi hệ thống.',
          'Toàn bộ bài học chuyên đề, bài tập và tài liệu PDF đính kèm của lớp này sẽ bị xóa sạch.',
          'Toàn bộ tin nhắn trao đổi, biểu cảm và thảo luận giữa các thành viên trong lớp sẽ bị dọn dẹp sạch sẽ.',
          'Học sinh sẽ không còn truy cập hoặc tìm thấy nhóm lớp này trong danh sách lớp học nữa.',
          'Dữ liệu sẽ bị xóa hoàn toàn khỏi cơ sở dữ liệu và không thể khôi phục sau khi giải tán.',
        ]}
        isDeleting={isDisbandingClass}
        onConfirm={handleConfirmDisbandClass}
        onCancel={() => setClassToDisband(null)}
      />
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
              {/* Chọn chương có sẵn hoặc tạo chương mới */}
              <div className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label className="font-bold text-slate-700">Chương học / Chuyên đề *</label>
                  {existingClassChapters.length > 0 ? (
                    <div className="inline-flex rounded-xl bg-slate-100 p-0.5 border border-slate-200">
                      <button
                        type="button"
                        onClick={() => {
                          setChapterInputMode('existing');
                          if (!existingClassChapters.includes(newLessonChapter)) {
                            setNewLessonChapter(existingClassChapters[0]);
                          }
                        }}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors cursor-pointer ${
                          chapterInputMode === 'existing'
                            ? 'bg-white text-blue-700 shadow-2xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        Chọn chương có sẵn ({existingClassChapters.length})
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setChapterInputMode('new');
                          if (existingClassChapters.includes(newLessonChapter)) {
                            setNewLessonChapter('');
                          }
                        }}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors cursor-pointer ${
                          chapterInputMode === 'new'
                            ? 'bg-white text-blue-700 shadow-2xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        + Tạo chương mới
                      </button>
                    </div>
                  ) : null}
                </div>

                {existingClassChapters.length > 0 && chapterInputMode === 'existing' ? (
                  <div className="space-y-1.5">
                    <select
                      value={existingClassChapters.includes(newLessonChapter) ? newLessonChapter : existingClassChapters[0]}
                      onChange={(e) => setNewLessonChapter(e.target.value)}
                      className="w-full h-10 px-3 rounded-xl border border-blue-300 bg-blue-50/40 font-semibold text-slate-800 focus:border-blue-600 focus:outline-none cursor-pointer"
                      required
                    >
                      {existingClassChapters.map((ch) => (
                        <option key={ch} value={ch}>
                          {ch} ({groupedLessons[ch]?.length || 0} bài học)
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <input
                    type="text"
                    list="suggested-chapters"
                    value={newLessonChapter}
                    onChange={(e) => setNewLessonChapter(e.target.value)}
                    placeholder="Ví dụ: Chương 1: Ứng dụng đạo hàm để khảo sát hàm số"
                    className="w-full h-10 px-3 rounded-xl border border-slate-300 font-semibold focus:border-blue-600 focus:outline-none"
                    required
                  />
                )}

                <datalist id="suggested-chapters">
                  {existingClassChapters.map((ch) => (
                    <option key={ch} value={ch} />
                  ))}
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
                    <label className="font-bold text-slate-700">Số câu hỏi ôn tập</label>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          const cur = parseInt(newLessonExercisesCount, 10);
                          setNewLessonExercisesCount(String(Math.max(0, (Number.isNaN(cur) ? 10 : cur) - 1)));
                        }}
                        className="w-10 h-10 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 font-black text-slate-700 flex items-center justify-center shrink-0 transition-colors cursor-pointer"
                        title="Giảm 1 câu"
                      >
                        -
                      </button>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={newLessonExercisesCount}
                        onChange={(e) => {
                          const digitsOnly = e.target.value.replace(/[^0-9]/g, '');
                          if (digitsOnly === '') {
                            setNewLessonExercisesCount('');
                            return;
                          }
                          const num = Math.min(500, parseInt(digitsOnly, 10));
                          setNewLessonExercisesCount(String(num));
                        }}
                        onBlur={() => {
                          if (newLessonExercisesCount.trim() === '') {
                            setNewLessonExercisesCount('0');
                          }
                        }}
                        placeholder="Nhập số câu..."
                        className="w-full h-10 px-3 rounded-xl border border-slate-300 bg-white font-bold text-center focus:border-amber-600 focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const cur = parseInt(newLessonExercisesCount, 10);
                          setNewLessonExercisesCount(String(Math.min(500, (Number.isNaN(cur) ? 0 : cur) + 1)));
                        }}
                        className="w-10 h-10 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 font-black text-slate-700 flex items-center justify-center shrink-0 transition-colors cursor-pointer"
                        title="Tăng 1 câu"
                      >
                        +
                      </button>
                    </div>
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
                  type="text"
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
                  disabled={isSubmittingLesson}
                  className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold text-xs shadow-xs transition-colors flex items-center justify-center gap-1.5"
                >
                  {isSubmittingLesson ? (
                    <>
                      <Loader2 size={15} className="animate-spin" />
                      <span>Đang Tải & Đăng Bài...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 size={15} />
                      <span>Đăng Tải Bài Học Lên Lớp</span>
                    </>
                  )}
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
              <div className="space-y-1.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label className="font-bold text-slate-700">Tên Chương học / Chuyên đề *</label>
                  {existingClassChapters.length > 0 && (
                    <select
                      value={existingClassChapters.includes(editLessonChapter) ? editLessonChapter : ''}
                      onChange={(e) => {
                        if (e.target.value) setEditLessonChapter(e.target.value);
                      }}
                      className="h-7 px-2 rounded-lg border border-slate-300 bg-slate-50 text-[11px] font-semibold text-slate-700 focus:border-amber-600 focus:outline-none max-w-[240px]"
                      title="Chọn nhanh chương có sẵn trong lớp"
                    >
                      <option value="">-- Chọn nhanh chương có sẵn --</option>
                      {existingClassChapters.map((ch) => (
                        <option key={ch} value={ch}>
                          {ch}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
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
                    <label className="font-bold text-slate-700">Số câu hỏi ôn tập</label>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          const cur = parseInt(editLessonExercisesCount, 10);
                          setEditLessonExercisesCount(String(Math.max(0, (Number.isNaN(cur) ? 10 : cur) - 1)));
                        }}
                        className="w-10 h-10 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 font-black text-slate-700 flex items-center justify-center shrink-0 transition-colors cursor-pointer"
                        title="Giảm 1 câu"
                      >
                        -
                      </button>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={editLessonExercisesCount}
                        onChange={(e) => {
                          const digitsOnly = e.target.value.replace(/[^0-9]/g, '');
                          if (digitsOnly === '') {
                            setEditLessonExercisesCount('');
                            return;
                          }
                          const num = Math.min(500, parseInt(digitsOnly, 10));
                          setEditLessonExercisesCount(String(num));
                        }}
                        onBlur={() => {
                          if (editLessonExercisesCount.trim() === '') {
                            setEditLessonExercisesCount('0');
                          }
                        }}
                        placeholder="Nhập số câu..."
                        className="w-full h-10 px-3 rounded-xl border border-slate-300 bg-white font-bold text-center focus:border-amber-600 focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const cur = parseInt(editLessonExercisesCount, 10);
                          setEditLessonExercisesCount(String(Math.min(500, (Number.isNaN(cur) ? 0 : cur) + 1)));
                        }}
                        className="w-10 h-10 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 font-black text-slate-700 flex items-center justify-center shrink-0 transition-colors cursor-pointer"
                        title="Tăng 1 câu"
                      >
                        +
                      </button>
                    </div>
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
                  type="text"
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
                  disabled={isSubmittingLesson}
                  className="flex-1 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white font-bold text-xs shadow-xs transition-colors flex items-center justify-center gap-1.5"
                >
                  {isSubmittingLesson ? (
                    <>
                      <Loader2 size={15} className="animate-spin" />
                      <span>Đang Lưu Thay Đổi...</span>
                    </>
                  ) : (
                    <>
                      <Save size={15} />
                      <span>Lưu Thay Đổi Bài Học</span>
                    </>
                  )}
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
                {renderTextWithLinks(selectedLessonDetail.description)}
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
                <span>Ô Luyện Tập ({selectedLessonDetail.exercisesCount ?? 10} câu)</span>
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

                  {pdfPreviewError && (
                    <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold flex items-center justify-between gap-2">
                      <span>{pdfPreviewError}</span>
                      <button type="button" onClick={() => setPdfPreviewError(null)} className="text-rose-600 hover:text-rose-900">
                        <X size={14} />
                      </button>
                    </div>
                  )}

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

                      <div className="flex items-center gap-2 self-end sm:self-auto flex-wrap">
                        <button
                          type="button"
                          onClick={() =>
                            handlePreviewPdf(
                              selectedLessonDetail.pdfAttachment!.fileName,
                              selectedLessonDetail.pdfAttachment!.fileData,
                              selectedLessonDetail.pdfAttachment!.fileUrl
                            )
                          }
                          className="px-3 py-2 rounded-xl bg-white hover:bg-blue-100/60 text-blue-700 border border-blue-200 font-bold text-xs flex items-center justify-center gap-1.5 shadow-2xs transition-colors whitespace-nowrap"
                          title="Xem trực tiếp trên trình duyệt"
                        >
                          <Eye size={14} />
                          <span>Xem Trực Tiếp</span>
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            handleDownloadPdf(
                              selectedLessonDetail.pdfAttachment!.fileName,
                              selectedLessonDetail.pdfAttachment!.fileData,
                              selectedLessonDetail.pdfAttachment!.fileUrl
                            )
                          }
                          className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-2xs transition-colors whitespace-nowrap"
                        >
                          <Download size={14} />
                          <span>Tải PDF Bài Học</span>
                        </button>
                      </div>
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
                      {selectedLessonDetail.exercisesCount ?? 10} câu rèn luyện
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

                      <div className="flex items-center gap-2 self-end sm:self-auto flex-wrap">
                        <button
                          type="button"
                          onClick={() =>
                            handlePreviewPdf(
                              selectedLessonDetail.practicePdfAttachment!.fileName,
                              selectedLessonDetail.practicePdfAttachment!.fileData,
                              selectedLessonDetail.practicePdfAttachment!.fileUrl
                            )
                          }
                          className="px-3 py-2 rounded-xl bg-white hover:bg-amber-100/60 text-amber-800 border border-amber-200 font-bold text-xs flex items-center justify-center gap-1.5 shadow-2xs transition-colors whitespace-nowrap"
                          title="Xem trực tiếp trên trình duyệt"
                        >
                          <Eye size={14} />
                          <span>Xem Trực Tiếp</span>
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            handleDownloadPdf(
                              selectedLessonDetail.practicePdfAttachment!.fileName,
                              selectedLessonDetail.practicePdfAttachment!.fileData,
                              selectedLessonDetail.practicePdfAttachment!.fileUrl
                            )
                          }
                          className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-2xs transition-colors whitespace-nowrap"
                        >
                          <Download size={14} />
                          <span>Tải Phiếu Luyện Tập (PDF)</span>
                        </button>
                      </div>
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
            {selectedLessonDetail.externalLink && (() => {
              const safeExternalHref =
                normalizeSafeHref(selectedLessonDetail.externalLink, true) ||
                selectedLessonDetail.externalLink;
              return (
                <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-2 text-slate-700 truncate min-w-0">
                    <ExternalLink size={14} className="text-blue-600 shrink-0" />
                    <span className="font-bold shrink-0">Link tài liệu:</span>
                    <a
                      href={safeExternalHref}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:text-blue-800 underline font-mono truncate"
                      title={`Mở liên kết: ${safeExternalHref}`}
                    >
                      {selectedLessonDetail.externalLink}
                    </a>
                  </div>
                  <a
                    href={safeExternalHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold shrink-0 transition-colors"
                  >
                    Mở Link
                  </a>
                </div>
              );
            })()}

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
