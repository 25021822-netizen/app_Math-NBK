import React, { useState, useEffect, useRef } from 'react';
import { RefreshCw, Image as ImageIcon } from 'lucide-react';
import {
  extractFsImgId,
  fetchExamImageFromFirestore,
  getCachedExamImage,
} from '../../services/examImageService';

interface ExamImageProps {
  src?: string;
  alt: string;
  className?: string;
  onClick?: React.MouseEventHandler<HTMLImageElement>;
}

export const ExamImage: React.FC<ExamImageProps> = ({ src, alt, className = '', onClick }) => {
  const fsImgId = extractFsImgId(src);

  const [displaySrc, setDisplaySrc] = useState<string>(() => {
    if (!src) return '';
    if (fsImgId) {
      const cached = getCachedExamImage(fsImgId);
      if (cached) return cached;
      if (src.startsWith('fsimg://')) return '';
    }
    return src;
  });
  const [isLoadingCloud, setIsLoadingCloud] = useState<boolean>(() => {
    if (!src) return false;
    if (fsImgId && !getCachedExamImage(fsImgId) && src.startsWith('fsimg://')) {
      return true;
    }
    return false;
  });
  const [hasError, setHasError] = useState<boolean>(false);

  const cloudFetchDoneRef = useRef<boolean>(false);
  const cloudFetchInFlightRef = useRef<boolean>(false);
  const imgErroredRef = useRef<boolean>(false);

  useEffect(() => {
    if (!src) {
      setDisplaySrc('');
      setIsLoadingCloud(false);
      setHasError(false);
      cloudFetchDoneRef.current = false;
      cloudFetchInFlightRef.current = false;
      imgErroredRef.current = false;
      return;
    }

    let cancelled = false;
    const id = extractFsImgId(src);
    imgErroredRef.current = false;
    setHasError(false);

    if (id) {
      const cached = getCachedExamImage(id);
      if (cached) {
        setDisplaySrc(cached);
        setIsLoadingCloud(false);
        cloudFetchDoneRef.current = true;
        cloudFetchInFlightRef.current = false;
        return;
      }

      // Luôn tải song song từ Cloud Firestore ngay lập tức khi có fsImgId
      // (tránh chờ /api/files/... lỗi 404 hoặc treo mạng trên điện thoại/domain chia sẻ)
      cloudFetchDoneRef.current = false;
      cloudFetchInFlightRef.current = true;

      if (src.startsWith('fsimg://')) {
        setDisplaySrc('');
        setIsLoadingCloud(true);
      } else {
        setDisplaySrc(src);
        setIsLoadingCloud(false);
      }

      fetchExamImageFromFirestore(id)
        .then((dataUrl) => {
          if (cancelled) return;
          cloudFetchDoneRef.current = true;
          cloudFetchInFlightRef.current = false;
          if (dataUrl) {
            setDisplaySrc(dataUrl);
            setIsLoadingCloud(false);
            setHasError(false);
          } else if (src.startsWith('fsimg://') || imgErroredRef.current) {
            setIsLoadingCloud(false);
            setHasError(true);
          }
        })
        .catch(() => {
          if (cancelled) return;
          cloudFetchDoneRef.current = true;
          cloudFetchInFlightRef.current = false;
          if (src.startsWith('fsimg://') || imgErroredRef.current) {
            setIsLoadingCloud(false);
            setHasError(true);
          }
        });

      return () => {
        cancelled = true;
      };
    }

    cloudFetchDoneRef.current = true;
    cloudFetchInFlightRef.current = false;
    setDisplaySrc(src);
    setIsLoadingCloud(false);
  }, [src]);

  const handleImageError = async () => {
    imgErroredRef.current = true;

    if (fsImgId) {
      const cached = getCachedExamImage(fsImgId);
      if (cached) {
        setDisplaySrc(cached);
        setIsLoadingCloud(false);
        setHasError(false);
        return;
      }

      // Nếu Cloud Firestore vẫn đang tải song song, chờ hiển thị kết quả từ cloud thay vì báo lỗi sớm
      if (cloudFetchInFlightRef.current) {
        setIsLoadingCloud(true);
        setHasError(false);
        return;
      }

      if (!cloudFetchDoneRef.current) {
        setIsLoadingCloud(true);
        cloudFetchInFlightRef.current = true;
        const dataUrl = await fetchExamImageFromFirestore(fsImgId);
        cloudFetchInFlightRef.current = false;
        cloudFetchDoneRef.current = true;
        setIsLoadingCloud(false);
        if (dataUrl) {
          setDisplaySrc(dataUrl);
          setHasError(false);
          return;
        }
      }
    }

    setIsLoadingCloud(false);
    setHasError(true);
  };

  const handleManualRetry = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!src) return;
    imgErroredRef.current = false;
    setHasError(false);

    if (fsImgId) {
      setIsLoadingCloud(true);
      const dataUrl = await fetchExamImageFromFirestore(fsImgId);
      setIsLoadingCloud(false);
      if (dataUrl) {
        setDisplaySrc(dataUrl);
        setHasError(false);
        return;
      }
    }

    if (!src.startsWith('fsimg://')) {
      const cacheBust = src.includes('?') ? `&t=${Date.now()}` : `?t=${Date.now()}`;
      setDisplaySrc(src.startsWith('data:') ? src : `${src}${cacheBust}`);
    } else {
      setHasError(true);
    }
  };

  if (!src) return null;

  if (isLoadingCloud) {
    return (
      <div className="w-52 h-24 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center gap-2 text-xs text-slate-500 animate-pulse">
        <ImageIcon size={16} />
        <span>Đang tải ảnh đề...</span>
      </div>
    );
  }

  if (hasError || !displaySrc) {
    const isUnmigratedLocalUrl = src.startsWith('/api/files/') && !fsImgId;
    return (
      <div className="px-3 py-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs flex flex-wrap items-center gap-2 max-w-full">
        <ImageIcon size={15} className="shrink-0 text-amber-600" />
        <span className="leading-snug">
          {isUnmigratedLocalUrl
            ? 'Ảnh đề cũ chưa kịp đồng bộ lên đám mây. Hãy mở lại trang trên máy tính đã cắt đề rồi nhấn Thử lại.'
            : 'Không tải được ảnh câu hỏi.'}
        </span>
        <button
          type="button"
          onClick={handleManualRetry}
          className="px-2.5 py-1 rounded-lg bg-white border border-amber-300 text-amber-700 font-bold text-[11px] hover:bg-amber-100 flex items-center gap-1 cursor-pointer shrink-0"
        >
          <RefreshCw size={11} />
          <span>Thử lại</span>
        </button>
      </div>
    );
  }

  return (
    <img
      src={displaySrc}
      alt={alt}
      className={className}
      onClick={onClick}
      onError={handleImageError}
    />
  );
};
