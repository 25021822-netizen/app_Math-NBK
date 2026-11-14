import { doc, getDoc, setDoc, collection, query, where, getDocs, deleteDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Exam } from '../types/math';

const resolvedImageCache = new Map<string, string>();
const inFlightImageFetches = new Map<string, Promise<string | null>>();

function hashStringDeterministic(str: string): string {
  let h1 = 0x811c9dc5;
  let h2 = 0x9e3779b9;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 ^= ch;
    h1 = Math.imul(h1, 0x01000193);
    h2 ^= ch + ((i & 0xff) << 3);
    h2 = Math.imul(h2, 0x85ebca6b);
  }
  return `${(h1 >>> 0).toString(36)}${(h2 >>> 0).toString(36)}_${str.length.toString(36)}`;
}

export function extractFsImgId(url?: string): string | null {
  if (!url || typeof url !== 'string') return null;
  if (url.startsWith('fsimg://')) {
    const id = url.slice('fsimg://'.length).trim();
    return id || null;
  }
  const match = url.match(/[?&]fsImg=([^&#]+)/);
  if (match && match[1]) {
    try {
      return decodeURIComponent(match[1]);
    } catch {
      return match[1];
    }
  }
  return null;
}

export function pickPreferredImageUrl(primary?: string, secondary?: string): string | undefined {
  if (!primary) return secondary;
  if (!secondary) return primary;
  if (!extractFsImgId(primary) && extractFsImgId(secondary)) {
    return secondary;
  }
  return primary;
}

export function getCachedExamImage(assetId: string): string | null {
  return resolvedImageCache.get(assetId) || null;
}

export async function fetchExamImageFromFirestore(assetId: string): Promise<string | null> {
  if (!assetId) return null;
  const cached = resolvedImageCache.get(assetId);
  if (cached) return cached;

  const existingPromise = inFlightImageFetches.get(assetId);
  if (existingPromise) return existingPromise;

  const promise = (async (): Promise<string | null> => {
    try {
      const snap = await getDoc(doc(db, 'exam_images', assetId));
      if (snap.exists()) {
        const dataUrl = snap.data()?.dataUrl;
        if (typeof dataUrl === 'string' && dataUrl.startsWith('data:image/')) {
          resolvedImageCache.set(assetId, dataUrl);
          return dataUrl;
        }
      }
    } catch (err) {
      console.warn('[examImageService] Lỗi đọc exam_images:', err);
    }

    // Dự phòng đọc từ collection meta nếu trước đó ghi vào meta
    try {
      const metaSnap = await getDoc(doc(db, 'meta', `img_${assetId}`));
      if (metaSnap.exists()) {
        const dataUrl = metaSnap.data()?.dataUrl;
        if (typeof dataUrl === 'string' && dataUrl.startsWith('data:image/')) {
          resolvedImageCache.set(assetId, dataUrl);
          return dataUrl;
        }
      }
    } catch {}

    return null;
  })().finally(() => {
    inFlightImageFetches.delete(assetId);
  });

  inFlightImageFetches.set(assetId, promise);
  return promise;
}

export async function compressImageDataUrl(dataUrl: string, maxChars = 700_000): Promise<string> {
  if (!dataUrl || !dataUrl.startsWith('data:image/') || dataUrl.length <= maxChars) {
    return dataUrl;
  }
  if (typeof document === 'undefined') return dataUrl;

  return new Promise<string>((resolve) => {
    const img = new Image();
    img.onload = () => {
      try {
        const maxWidth = 1200;
        let outW = img.naturalWidth || img.width || 800;
        let outH = img.naturalHeight || img.height || 600;
        if (outW > maxWidth) {
          outH = Math.round((outH * maxWidth) / outW);
          outW = maxWidth;
        }

        const canvas = document.createElement('canvas');
        canvas.width = outW;
        canvas.height = outH;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(dataUrl);
          return;
        }
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, outW, outH);
        ctx.drawImage(img, 0, 0, outW, outH);

        for (const q of [0.85, 0.72, 0.58, 0.45]) {
          const candidate = canvas.toDataURL('image/jpeg', q);
          if (candidate.length <= maxChars || q === 0.45) {
            resolve(candidate);
            return;
          }
        }
        resolve(dataUrl);
      } catch {
        resolve(dataUrl);
      }
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

async function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

async function uploadToServerEndpoint(fileName: string, fileData: string): Promise<string | null> {
  try {
    const res = await fetch('/api/upload/file', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fileName, fileData }),
    });
    if (res.ok) {
      const json = await res.json();
      if (json?.success && json?.fileUrl) {
        return json.fileUrl as string;
      }
    }
  } catch {}
  return null;
}

/**
 * Lưu ảnh cắt lên cả Cloud Firestore (để mọi thiết bị/điện thoại đều đọc được)
 * lẫn Server /api/files/... (để tải nhanh cùng máy chủ nếu có).
 */
export async function uploadImageToCloudAndServer(
  rawInputUrl: string,
  fileNameHint: string,
  examId: string
): Promise<{ url: string; changed: boolean }> {
  if (!rawInputUrl || typeof rawInputUrl !== 'string') {
    return { url: rawInputUrl, changed: false };
  }

  // Đã có liên kết Firestore fsImg rồi thì giữ nguyên
  if (extractFsImgId(rawInputUrl)) {
    return { url: rawInputUrl, changed: false };
  }

  let dataUrl = '';
  let existingServerUrl: string | null = null;

  if (rawInputUrl.startsWith('data:image/')) {
    dataUrl = rawInputUrl;
  } else if (rawInputUrl.startsWith('/api/files/')) {
    existingServerUrl = rawInputUrl;
    try {
      const res = await fetch(rawInputUrl, { cache: 'no-cache' });
      const contentType = res.headers.get('content-type') || '';
      if (res.ok && contentType.startsWith('image/')) {
        const blob = await res.blob();
        if (blob && blob.size > 0) {
          const converted = await blobToDataUrl(blob);
          if (converted.startsWith('data:image/')) {
            dataUrl = converted;
          }
        }
      }
    } catch {}
  } else {
    return { url: rawInputUrl, changed: false };
  }

  if (!dataUrl) {
    return { url: rawInputUrl, changed: false };
  }

  const compressedDataUrl = await compressImageDataUrl(dataUrl);
  const safeExamId = (examId || 'exam').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 40);
  const assetId = `img_${safeExamId}_${hashStringDeterministic(compressedDataUrl)}`;
  resolvedImageCache.set(assetId, compressedDataUrl);

  let cloudSaved = false;
  const firestorePayload = {
    id: assetId,
    examId: examId || '',
    dataUrl: compressedDataUrl,
    updatedAt: new Date().toISOString(),
  };

  try {
    await setDoc(doc(db, 'exam_images', assetId), firestorePayload, { merge: true });
    cloudSaved = true;
  } catch (err) {
    console.warn('[examImageService] Lỗi ghi exam_images, chuyển sang dự phòng meta:', err);
    try {
      await setDoc(doc(db, 'meta', `img_${assetId}`), firestorePayload, { merge: true });
      cloudSaved = true;
    } catch {}
  }

  let serverUrl = existingServerUrl;
  if (!serverUrl) {
    serverUrl = await uploadToServerEndpoint(fileNameHint, compressedDataUrl);
  }

  if (serverUrl && cloudSaved) {
    const sep = serverUrl.includes('?') ? '&' : '?';
    return { url: `${serverUrl}${sep}fsImg=${encodeURIComponent(assetId)}`, changed: true };
  }

  if (cloudSaved) {
    return { url: `fsimg://${assetId}`, changed: true };
  }

  if (serverUrl) {
    return { url: serverUrl, changed: serverUrl !== rawInputUrl };
  }

  return { url: compressedDataUrl, changed: compressedDataUrl !== rawInputUrl };
}

export function isImageNeedingCloudSync(url?: string): boolean {
  if (!url || typeof url !== 'string') return false;
  if (extractFsImgId(url)) return false;
  return url.startsWith('data:image/') || url.startsWith('/api/files/');
}

export function examNeedsImageCloudSync(exam: Exam): boolean {
  if (!exam || !Array.isArray(exam.questions)) return false;
  return exam.questions.some((q: any) => {
    if (isImageNeedingCloudSync(q.pdfAttachmentUrl)) return true;
    if (isImageNeedingCloudSync(q.imageAttachment)) return true;
    if (isImageNeedingCloudSync(q.optionsAttachmentUrl)) return true;
    if (Array.isArray(q.options) && q.options.some((o: any) => isImageNeedingCloudSync(o?.imageUrl))) return true;
    if (Array.isArray(q.items) && q.items.some((i: any) => isImageNeedingCloudSync(i?.imageUrl))) return true;
    return false;
  });
}

export async function persistExamImagesEverywhere(exam: Exam): Promise<{ exam: Exam; changed: boolean }> {
  if (!exam || !Array.isArray(exam.questions)) return { exam, changed: false };
  let anyChanged = false;

  const updatedQuestions = await Promise.all(
    exam.questions.map(async (q: any, qIdx: number) => {
      const qCopy: any = { ...q };

      const promptImg = q.pdfAttachmentUrl || q.imageAttachment;
      if (promptImg && isImageNeedingCloudSync(promptImg)) {
        const ext = promptImg.startsWith('data:image/png') ? '.png' : '.jpg';
        const res = await uploadImageToCloudAndServer(
          promptImg,
          `crop_q${qIdx + 1}_prompt_${Date.now()}${ext}`,
          exam.id
        );
        if (res.changed) {
          qCopy.pdfAttachmentUrl = res.url;
          qCopy.imageAttachment = res.url;
          anyChanged = true;
        }
      }

      if (q.optionsAttachmentUrl && isImageNeedingCloudSync(q.optionsAttachmentUrl)) {
        const ext = q.optionsAttachmentUrl.startsWith('data:image/png') ? '.png' : '.jpg';
        const res = await uploadImageToCloudAndServer(
          q.optionsAttachmentUrl,
          `crop_q${qIdx + 1}_opts_${Date.now()}${ext}`,
          exam.id
        );
        if (res.changed) {
          qCopy.optionsAttachmentUrl = res.url;
          anyChanged = true;
        }
      }

      if (q.part === 'part_1_mcq' && Array.isArray(q.options)) {
        qCopy.options = await Promise.all(
          q.options.map(async (opt: any) => {
            if (opt?.imageUrl && isImageNeedingCloudSync(opt.imageUrl)) {
              const ext = opt.imageUrl.startsWith('data:image/png') ? '.png' : '.jpg';
              const res = await uploadImageToCloudAndServer(
                opt.imageUrl,
                `crop_q${qIdx + 1}_opt_${opt.key}_${Date.now()}${ext}`,
                exam.id
              );
              if (res.changed) {
                anyChanged = true;
                return { ...opt, imageUrl: res.url };
              }
            }
            return opt;
          })
        );
      }

      if (q.part === 'part_2_true_false' && Array.isArray(q.items)) {
        qCopy.items = await Promise.all(
          q.items.map(async (item: any) => {
            if (item?.imageUrl && isImageNeedingCloudSync(item.imageUrl)) {
              const ext = item.imageUrl.startsWith('data:image/png') ? '.png' : '.jpg';
              const res = await uploadImageToCloudAndServer(
                item.imageUrl,
                `crop_q${qIdx + 1}_item_${item.subKey}_${Date.now()}${ext}`,
                exam.id
              );
              if (res.changed) {
                anyChanged = true;
                return { ...item, imageUrl: res.url };
              }
            }
            return item;
          })
        );
      }

      return qCopy;
    })
  );

  if (!anyChanged) return { exam, changed: false };
  return {
    exam: {
      ...exam,
      questions: updatedQuestions,
    },
    changed: true,
  };
}

export async function deleteExamImagesFromFirestore(examId: string): Promise<void> {
  if (!examId) return;
  try {
    const q = query(collection(db, 'exam_images'), where('examId', '==', examId));
    const snap = await getDocs(q);
    await Promise.allSettled(snap.docs.map((d) => deleteDoc(d.ref)));
  } catch (err) {
    console.warn('[examImageService] Lỗi dọn dẹp ảnh đề thi đã xóa:', err);
  }
}
