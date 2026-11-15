/**
 * Math&NBK - Push Notification & Sound Service
 * Quản lý thông báo đẩy (Web Push Notifications API) và âm thanh báo hiệu
 */

export interface PushNotificationItem {
  id: string;
  title: string;
  message: string;
  type: 'exam_published' | 'lesson_published' | 'exam_graded' | 'chat_message' | 'system' | 'error';
  timestamp: string;
  isRead: boolean;
  targetTab?: string;
  targetClassId?: string;
  lessonId?: string;
  examId?: string;
  actionLabel?: string;
  score?: number;
  isMuted?: boolean;
}

const NOTIFICATION_ENABLED_STORAGE_KEY = 'math_nbk_notifications_enabled';
const NOTIFICATION_SOUND_ENABLED_STORAGE_KEY = 'math_nbk_notification_sound_enabled';

// Kiểm tra trạng thái cần gạt BẬT / TẮT thông báo (mặc định BẬT - true)
export const isNotificationsEnabled = (): boolean => {
  try {
    const val = localStorage.getItem(NOTIFICATION_ENABLED_STORAGE_KEY);
    return val === null ? true : val === 'true';
  } catch {
    return true;
  }
};

// Thiết lập trạng thái cần gạt BẬT / TẮT thông báo
export const setNotificationsEnabled = (enabled: boolean): void => {
  try {
    localStorage.setItem(NOTIFICATION_ENABLED_STORAGE_KEY, String(enabled));
    window.dispatchEvent(new CustomEvent('math_nbk_notifications_toggle', { detail: { enabled } }));
  } catch {}
};

// Kiểm tra trạng thái âm thanh chuông báo
export const isNotificationSoundEnabled = (): boolean => {
  try {
    const val = localStorage.getItem(NOTIFICATION_SOUND_ENABLED_STORAGE_KEY);
    return val === null ? true : val === 'true';
  } catch {
    return true;
  }
};

// Thiết lập trạng thái âm thanh chuông báo
export const setNotificationSoundEnabled = (enabled: boolean): void => {
  try {
    localStorage.setItem(NOTIFICATION_SOUND_ENABLED_STORAGE_KEY, String(enabled));
    window.dispatchEvent(new CustomEvent('math_nbk_sound_toggle', { detail: { enabled } }));
  } catch {}
};

// Phát âm thanh báo hiệu bằng Web Audio API (không cần tải file ngoài)
export const playNotificationChime = (
  type: 'published' | 'graded' | 'chat' | 'error' | 'general' = 'general'
) => {
  if (!isNotificationsEnabled() || !isNotificationSoundEnabled()) {
    return;
  }

  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();

    if (type === 'chat') {
      // Âm thanh chuông báo tin nhắn chat & tag tên @mention (2 nốt trong trẻo E5 -> A5)
      const now = ctx.currentTime;
      [659.25, 880.0].forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.12, now + idx * 0.1);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.1 + 0.22);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + idx * 0.1);
        osc.stop(now + idx * 0.1 + 0.26);
      });
    } else if (type === 'graded') {
      // Âm thanh chúc mừng điểm số (3 nốt vui tươi C5 -> E5 -> G5)
      const now = ctx.currentTime;
      [523.25, 659.25, 783.99].forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.12, now + idx * 0.12);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.12 + 0.3);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + idx * 0.12);
        osc.stop(now + idx * 0.12 + 0.35);
      });
    } else if (type === 'published') {
      // Âm thanh thông báo bài thi mới / bài học mới (nốt cao vui F5 -> A5)
      const now = ctx.currentTime;
      [698.46, 880.0].forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.15, now + idx * 0.1);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.1 + 0.25);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + idx * 0.1);
        osc.stop(now + idx * 0.1 + 0.3);
      });
    } else {
      // Ting nhẹ
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = 800;
      gain.gain.setValueAtTime(0.1, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.3);
    }
  } catch (err) {
    // Ignore audio autoplay restrictions
  }
};

// Xin quyền thông báo trình duyệt (Browser Push Notification Permission)
export const requestNotificationPermission = async (): Promise<boolean> => {
  if (!('Notification' in window)) {
    return false;
  }
  if (Notification.permission === 'granted') {
    return true;
  }
  if (Notification.permission !== 'denied') {
    const permission = await Notification.requestPermission();
    return permission === 'granted';
  }
  return false;
};

// Gửi thông báo đẩy hệ thống và trình duyệt
export const triggerPushNotification = async (
  title: string,
  options: {
    message: string;
    type: 'exam_published' | 'lesson_published' | 'exam_graded' | 'chat_message' | 'system' | 'error';
    targetTab?: string;
    targetClassId?: string;
    lessonId?: string;
    examId?: string;
    actionLabel?: string;
    score?: number;
  }
): Promise<PushNotificationItem> => {
  const enabled = isNotificationsEnabled();

  const newNotification: PushNotificationItem = {
    id: `notif_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
    title,
    message: options.message,
    type: options.type,
    timestamp: new Date().toISOString(),
    isRead: false,
    targetTab: options.targetTab,
    targetClassId: options.targetClassId,
    lessonId: options.lessonId,
    examId: options.examId,
    actionLabel: options.actionLabel,
    score: options.score,
    isMuted: !enabled,
  };

  // 1. Chỉ phát âm thanh chuông báo khi cần gạt thông báo đang BẬT (ON)
  if (enabled) {
    playNotificationChime(
      options.type === 'chat_message'
        ? 'chat'
        : options.type === 'exam_graded'
        ? 'graded'
        : options.type === 'exam_published' || options.type === 'lesson_published'
        ? 'published'
        : options.type === 'error'
        ? 'error'
        : 'general'
    );
  }

  // 2. Chỉ gửi Web Push Notification lên trình duyệt khi cần gạt thông báo đang BẬT (ON)
  if (enabled) {
    try {
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification(title, {
          body: options.message,
          icon: 'https://api.dicebear.com/7.x/bottts/svg?seed=MathNBK',
          badge: 'https://api.dicebear.com/7.x/bottts/svg?seed=MathNBK',
          tag: newNotification.id,
        });
      }
    } catch (e) {
      // Fallback in iframe or unsupported browsers
    }
  }

  // 3. Dispatch Custom Event để các component UI (Toast, Bell) phản hồi
  try {
    const event = new CustomEvent('math_nbk_push_notification', { detail: newNotification });
    window.dispatchEvent(event);
  } catch (e) {
    // ignore
  }

  return newNotification;
};
