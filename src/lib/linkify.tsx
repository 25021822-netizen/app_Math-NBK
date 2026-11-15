import React from 'react';

export interface LinkTextSegment {
  type: 'text' | 'link';
  text: string;
  href?: string;
}

/**
 * Chuẩn hóa và kiểm tra tính an toàn của URL trước khi gắn vào thẻ <a href>.
 * - Chấp nhận http://, https://
 * - Tự động bổ sung https:// cho chuỗi bắt đầu bằng www. (hoặc domain trần khi allowBareDomain = true)
 * - Chặn các giao thức nguy hiểm như javascript:, data:, vbscript:
 */
export function normalizeSafeHref(rawUrl: string, allowBareDomain: boolean = false): string | null {
  if (!rawUrl || typeof rawUrl !== 'string') return null;
  const trimmed = rawUrl.trim();
  if (!trimmed) return null;

  // Chặn tuyệt đối các scheme nguy hiểm
  if (/^(?:javascript|data|vbscript|file):/i.test(trimmed)) {
    return null;
  }

  let candidate = trimmed;
  if (/^https?:\/\//i.test(candidate)) {
    // Hợp lệ sẵn
  } else if (/^www\./i.test(candidate)) {
    candidate = `https://${candidate}`;
  } else if (
    allowBareDomain &&
    /^[a-z0-9-]+(\.[a-z0-9-]+)+([/?#][^\s]*)?$/i.test(candidate)
  ) {
    candidate = `https://${candidate}`;
  } else {
    return null;
  }

  try {
    const parsed = new URL(candidate);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return null;
    }
    return candidate;
  } catch {
    return null;
  }
}

/**
 * Tách phần dấu câu thừa ở cuối URL (ví dụ dấu chấm, dấu phẩy, dấu ngoặc đơn đóng ngoài URL).
 */
function splitTrailingPunctuation(rawUrl: string): { url: string; trailing: string } {
  let url = rawUrl;
  let trailing = '';

  while (url.length > 0) {
    const lastChar = url[url.length - 1];
    if (/[.,;:!?'"…]/.test(lastChar)) {
      trailing = lastChar + trailing;
      url = url.slice(0, -1);
      continue;
    }
    if (lastChar === ')') {
      const openCount = (url.match(/\(/g) || []).length;
      const closeCount = (url.match(/\)/g) || []).length;
      if (closeCount > openCount) {
        trailing = lastChar + trailing;
        url = url.slice(0, -1);
        continue;
      }
    }
    if (lastChar === ']') {
      const openCount = (url.match(/\[/g) || []).length;
      const closeCount = (url.match(/\]/g) || []).length;
      if (closeCount > openCount) {
        trailing = lastChar + trailing;
        url = url.slice(0, -1);
        continue;
      }
    }
    break;
  }

  return { url, trailing };
}

/**
 * Tách văn bản chứa Markdown link [tiêu đề](url) hoặc URL trần (https://..., http://..., www....)
 * thành danh sách segment an toàn để render.
 */
export function parseTextWithLinks(input: string): LinkTextSegment[] {
  if (!input) return [];

  // Khớp markdown link [label](url) hoặc URL trần bắt đầu bằng http://, https://, www.
  const tokenRegex =
    /(\[[^\]\n]+\]\((?:https?:\/\/|www\.)[^\s)]+\)|(?:https?:\/\/|www\.)[^\s<>"'`]+)/gi;

  const segments: LinkTextSegment[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = tokenRegex.exec(input)) !== null) {
    const matchIndex = match.index;
    const rawToken = match[0];

    if (matchIndex > lastIndex) {
      segments.push({ type: 'text', text: input.slice(lastIndex, matchIndex) });
    }

    // Kiểm tra dạng Markdown [label](url)
    const mdMatch = rawToken.match(/^\[([^\]\n]+)\]\(((?:https?:\/\/|www\.)[^\s)]+)\)$/i);
    if (mdMatch) {
      const label = mdMatch[1];
      const safeHref = normalizeSafeHref(mdMatch[2]);
      if (safeHref) {
        segments.push({ type: 'link', text: label, href: safeHref });
      } else {
        segments.push({ type: 'text', text: rawToken });
      }
    } else {
      const { url, trailing } = splitTrailingPunctuation(rawToken);
      const safeHref = normalizeSafeHref(url);
      if (safeHref) {
        segments.push({ type: 'link', text: url, href: safeHref });
        if (trailing) {
          segments.push({ type: 'text', text: trailing });
        }
      } else {
        segments.push({ type: 'text', text: rawToken });
      }
    }

    lastIndex = matchIndex + rawToken.length;
  }

  if (lastIndex < input.length) {
    segments.push({ type: 'text', text: input.slice(lastIndex) });
  }

  return segments;
}

/**
 * Render chuỗi văn bản thành các phần tử React với link bấm mở trang trực tiếp trong tab mới.
 */
export function renderTextWithLinks(
  text: string,
  linkClassName: string = 'text-blue-600 hover:text-blue-800 underline decoration-blue-400/70 underline-offset-2 font-medium break-all transition-colors'
): React.ReactNode {
  if (!text) return null;
  const segments = parseTextWithLinks(text);
  if (segments.length === 0) return text;

  return segments.map((seg, idx) => {
    if (seg.type === 'link' && seg.href) {
      return (
        <a
          key={idx}
          href={seg.href}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className={linkClassName}
          title={`Mở liên kết: ${seg.href}`}
        >
          {seg.text}
        </a>
      );
    }
    return <React.Fragment key={idx}>{seg.text}</React.Fragment>;
  });
}
