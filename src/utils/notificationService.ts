/**
 * Math&NBK - Push Notification & Sound Service
 * Quản lý thông báo đẩy (Web Push Notifications API) và âm thanh báo hiệu
 */

export interface PushNotificationItem {
  id: string;
  title: string;
  message: string;
  type: 'exam_published' | 'exam_graded' | 'chat_message' | 'system';
  timestamp: string;
  isRead: boolean;
  targetTab?: string;
  examId?: string;
  score?: number;
}

// Phát âm thanh báo hiệu bằng Web Audio API (không cần tải file ngoài)
export const playNotificationChime = (type: 'published' | 'graded' | 'general' = 'general') => {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();

    if (type === 'graded') {
      // Âm thanh chúc mừng điểm số (2 nốt vui tươi C5 -> E5 -> G5)
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
      // Âm thanh thông báo bài thi mới (nốt cao vui F5 -> A5)
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
    type: 'exam_published' | 'exam_graded' | 'chat_message' | 'system';
    targetTab?: string;
    examId?: string;
    score?: number;
  }
): Promise<PushNotificationItem> => {
  const newNotification: PushNotificationItem = {
    id: `notif_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
    title,
    message: options.message,
    type: options.type,
    timestamp: new Date().toISOString(),
    isRead: false,
    targetTab: options.targetTab,
    examId: options.examId,
    score: options.score,
  };

  // 1. Phát âm thanh chuông báo
  playNotificationChime(options.type === 'exam_graded' ? 'graded' : options.type === 'exam_published' ? 'published' : 'general');

  // 2. Gửi Web Push Notification nếu được cấp quyền
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

  // 3. Dispatch Custom Event để các component UI (Toast, Bell) phản hồi tức thì
  try {
    const event = new CustomEvent('math_nbk_push_notification', { detail: newNotification });
    window.dispatchEvent(event);
  } catch (e) {
    // ignore
  }

  return newNotification;
};
