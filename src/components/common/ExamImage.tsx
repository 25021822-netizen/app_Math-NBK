import React, { useState, useEffect } from 'react';
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
    if (src.startsWith('fsimg://') && fsImgId && !getCachedExamImage(fsImgId)) {
      return true;
    }
    return false;
  });
  const [hasError, setHasError] = useState<boolean>(false);
  const [triedFirestore, setTriedFirestore] = useState<boolean>(false);

  useEffect(() => {
    if (!src) {
      setDisplaySrc('');
      setIsLoadingCloud(false);
      setHasError(false);
      setTriedFirestore(false);
      return;
    }

    const id = extractFsImgId(src);
    if (id) {
      const cached = getCachedExamImage(id);
      if (cached) {
        setDisplaySrc(cached);
        setIsLoadingCloud(false);
        setHasError(false);
        setTriedFirestore(true);
        return;
      }
      if (src.startsWith('fsimg://')) {
        let active = true;
        setDisplaySrc('');
        setIsLoadingCloud(true);
        setHasError(false);
        setTriedFirestore(true);
        fetchExamImageFromFirestore(id)
          .then((dataUrl) => {
            if (!active) return;
            if (dataUrl) {
              setDisplaySrc(dataUrl);
              setHasError(false);
            } else {
              setHasError(true);
            }
          })
          .finally(() => {
            if (active) setIsLoadingCloud(false);
          });
        return () => {
          active = false;
        };
      }
    }

    setDisplaySrc(src);
    setIsLoadingCloud(false);
    setHasError(false);
    setTriedFirestore(false);
  }, [src]);

  const handleImageError = async () => {
    if (fsImgId && !triedFirestore) {
      setTriedFirestore(true);
      setIsLoadingCloud(true);
      const dataUrl = await fetchExamImageFromFirestore(fsImgId);
      setIsLoadingCloud(false);
      if (dataUrl) {
        setDisplaySrc(dataUrl);
        setHasError(false);
        return;
      }
    }
    setHasError(true);
  };

  const handleManualRetry = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!src) return;
    setHasError(false);
    if (fsImgId) {
      setIsLoadingCloud(true);
      const dataUrl = await fetchExamImageFromFirestore(fsImgId);
      setIsLoadingCloud(false);
      if (dataUrl) {
        setDisplaySrc(dataUrl);
        return;
      }
    }
    const cacheBust = src.includes('?') ? `&t=${Date.now()}` : `?t=${Date.now()}`;
    setDisplaySrc(src.startsWith('data:') || src.startsWith('fsimg://') ? src : `${src}${cacheBust}`);
  };

  if (!src) return null;

  if (isLoadingCloud) {
    return (
      <div className="w-48 h-24 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center gap-2 text-xs text-slate-400 animate-pulse">
        <ImageIcon size={16} />
        <span>Đang tải ảnh đề...</span>
      </div>
    );
  }

  if (hasError || !displaySrc) {
    return (
      <div className="px-3 py-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs flex items-center gap-2">
        <ImageIcon size={15} className="shrink-0 text-amber-600" />
        <span>Không tải được ảnh câu hỏi.</span>
        <button
          type="button"
          onClick={handleManualRetry}
          className="px-2 py-1 rounded-lg bg-white border border-amber-300 text-amber-700 font-bold text-[11px] hover:bg-amber-100 flex items-center gap-1 cursor-pointer"
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
