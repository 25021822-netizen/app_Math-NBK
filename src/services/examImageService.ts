import { doc, getDoc, getDocFromServer, setDoc, collection, query, where, getDocs, deleteDoc } from 'firebase/firestore';
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

function getImageUrlQualityRank(url?: string): number {
  if (!url || typeof url !== 'string' || !url.trim()) return 0;
  if (extractFsImgId(url)) return 3; // Đã đồng bộ Cloud Firestore -> luôn ưu tiên cao nhất
  if (url.startsWith('data:image/')) return 2; // Dữ liệu ảnh gốc nội tuyến -> ưu tiên hơn URL cục bộ chưa đồng bộ
  return 1; // URL máy chủ cục bộ /api/files/... chưa có fsImg hoặc URL ngoài
}

export function pickPreferredImageUrl(primary?: string, secondary?: string): string | undefined {
  const rankPrimary = getImageUrlQualityRank(primary);
  const rankSecondary = getImageUrlQualityRank(secondary);
  if (rankPrimary === 0 && rankSecondary === 0) return undefined;
  if (rankSecondary > rankPrimary) return secondary;
  return primary || secondary;
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
    const readDocDataUrl = async (colName: string, docId: string): Promise<string | null> => {
      const ref = doc(db, colName, docId);
      try {
        const snap = await getDoc(ref);
        if (snap.exists()) {
          const dataUrl = snap.data()?.dataUrl;
          if (typeof dataUrl === 'string' && dataUrl.startsWith('data:image/')) {
            return dataUrl;
          }
        }
      } catch (err) {
        console.warn(`[examImageService] Lỗi getDoc(${colName}/${docId}):`, err);
      }

      // Thử đọc trực tiếp từ server nếu cache IndexedDB cục bộ trả về rỗng
      try {
        const serverSnap = await getDocFromServer(ref);
        if (serverSnap.exists()) {
          const dataUrl = serverSnap.data()?.dataUrl;
          if (typeof dataUrl === 'string' && dataUrl.startsWith('data:image/')) {
            return dataUrl;
          }
        }
      } catch {}

      return null;
    };

    const fromExamImages = await readDocDataUrl('exam_images', assetId);
    if (fromExamImages) {
      resolvedImageCache.set(assetId, fromExamImages);
      return fromExamImages;
    }

    const fromMeta = await readDocDataUrl('meta', `img_${assetId}`);
    if (fromMeta) {
      resolvedImageCache.set(assetId, fromMeta);
      return fromMeta;
    }

    return null;
  })().finally(() => {
    inFlightImageFetches.delete(assetId);
  });

  inFlightImageFetches.set(assetId, promise);
  return promise;
}

export async function compressImageDataUrl(dataUrl: string, maxChars = 480_000): Promise<string> {
  if (!dataUrl || !dataUrl.startsWith('data:image/') || dataUrl.length <= maxChars) {
    return dataUrl;
  }
  if (typeof document === 'undefined') return dataUrl;

  return new Promise<string>((resolve) => {
    const img = new Image();
    img.onload = () => {
      try {
        const origW = img.naturalWidth || img.width || 800;
        const origH = img.naturalHeight || img.height || 600;
        const widthSteps = [1200, 960, 720, 520];
        const qualitySteps = [0.84, 0.7, 0.56, 0.42];
        let bestCandidate = '';

        for (const maxW of widthSteps) {
          let outW = origW;
          let outH = origH;
          if (outW > maxW) {
            outH = Math.max(1, Math.round((outH * maxW) / outW));
            outW = maxW;
          }

          const canvas = document.createElement('canvas');
          canvas.width = outW;
          canvas.height = outH;
          const ctx = canvas.getContext('2d');
          if (!ctx) continue;

          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, outW, outH);
          ctx.drawImage(img, 0, 0, outW, outH);

          for (const q of qualitySteps) {
            const candidate = canvas.toDataURL('image/jpeg', q);
            bestCandidate = candidate;
            if (candidate.length <= maxChars) {
              resolve(candidate);
              return;
            }
          }
        }

        resolve(bestCandidate || dataUrl);
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

async function readImageViaImgCanvas(url: string): Promise<string> {
  if (typeof document === 'undefined') return '';
  return new Promise<string>((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    const timer = setTimeout(() => resolve(''), 6000);
    img.onload = () => {
      clearTimeout(timer);
      try {
        const w = img.naturalWidth || img.width;
        const h = img.naturalHeight || img.height;
        if (!w || !h) {
          resolve('');
          return;
        }
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve('');
          return;
        }
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, w, h);
        ctx.drawImage(img, 0, 0, w, h);
        const out = canvas.toDataURL('image/jpeg', 0.9);
        resolve(out.startsWith('data:image/') ? out : '');
      } catch {
        resolve('');
      }
    };
    img.onerror = () => {
      clearTimeout(timer);
      resolve('');
    };
    img.src = url;
  });
}

async function recoverImageDataUrlFromLocalUrl(rawUrl: string): Promise<string> {
  try {
    // Dùng force-cache để nếu máy tính đã từng tải ảnh này (dù server container vừa khởi động lại) vẫn lấy được từ cache trình duyệt
    const res = await fetch(rawUrl, { cache: 'force-cache' });
    const contentType = res.headers.get('content-type') || '';
    if (res.ok && contentType.startsWith('image/')) {
      const blob = await res.blob();
      if (blob && blob.size > 0) {
        const converted = await blobToDataUrl(blob);
        if (converted.startsWith('data:image/')) {
          return converted;
        }
      }
    }
  } catch {}

  // Dự phòng đọc qua thẻ <img> + Canvas nếu fetch gặp cache/CORS
  return readImageViaImgCanvas(rawUrl);
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

async function writeImageDocWithRetry(colName: string, docId: string, payload: Record<string, any>): Promise<boolean> {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      await setDoc(doc(db, colName, docId), payload, { merge: true });
      return true;
    } catch (err) {
      if (attempt === 0) {
        await new Promise((r) => setTimeout(r, 350));
      } else {
        console.warn(`[examImageService] Thất bại ghi ${colName}/${docId}:`, err);
      }
    }
  }
  return false;
}

/**
 * Lưu ảnh cắt lên Cloud Firestore (để mọi thiết bị/điện thoại đều đọc được đồng nhất)
 * và lưu song song lên Server /api/files/... nếu khả dụng.
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
    dataUrl = await recoverImageDataUrlFromLocalUrl(rawInputUrl);
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

  const firestorePayload = {
    id: assetId,
    examId: examId || '',
    dataUrl: compressedDataUrl,
    updatedAt: new Date().toISOString(),
  };

  let cloudSaved = await writeImageDocWithRetry('exam_images', assetId, firestorePayload);
  if (!cloudSaved) {
    cloudSaved = await writeImageDocWithRetry('meta', `img_${assetId}`, firestorePayload);
  }

  let serverUrl = existingServerUrl;
  if (!serverUrl) {
    serverUrl = await uploadToServerEndpoint(fileNameHint, compressedDataUrl);
  }

  if (cloudSaved) {
    if (serverUrl) {
      const sep = serverUrl.includes('?') ? '&' : '?';
      return { url: `${serverUrl}${sep}fsImg=${encodeURIComponent(assetId)}`, changed: true };
    }
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

async function runWithConcurrency<T>(tasks: Array<() => Promise<T>>, limit = 4): Promise<T[]> {
  const results: T[] = new Array(tasks.length);
  let nextIdx = 0;

  const worker = async () => {
    while (nextIdx < tasks.length) {
      const idx = nextIdx++;
      results[idx] = await tasks[idx]();
    }
  };

  const workers = Array.from({ length: Math.min(limit, tasks.length) }, () => worker());
  await Promise.all(workers);
  return results;
}

export async function persistExamImagesEverywhere(exam: Exam): Promise<{ exam: Exam; changed: boolean }> {
  if (!exam || !Array.isArray(exam.questions)) return { exam, changed: false };
  let anyChanged = false;

  const updatedQuestions = await runWithConcurrency(
    exam.questions.map((q: any, qIdx: number) => async () => {
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
        qCopy.options = await runWithConcurrency(
          q.options.map((opt: any) => async () => {
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
          }),
          3
        );
      }

      if (q.part === 'part_2_true_false' && Array.isArray(q.items)) {
        qCopy.items = await runWithConcurrency(
          q.items.map((item: any) => async () => {
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
          }),
          3
        );
      }

      return qCopy;
    }),
    4
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
