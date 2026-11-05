/**
 * Bộ xác thực định dạng và tính toàn vẹn của tệp PDF (PDF File Validator & Integrity Checker)
 * Tuân thủ tiêu chuẩn ISO 32000-1 (PDF Standard)
 * Ngăn ngừa lỗi xử lý tệp hỏng, tệp rỗng, file đổi đuôi giả mạo hoặc file bị cắt xén trước khi đưa vào OCR Scanner.
 */

export interface PdfValidationResult {
  isValid: boolean;
  fileName: string;
  fileSizeBytes: number;
  fileSizeFormatted: string;
  version?: string;
  estimatedPages?: number;
  isEncrypted?: boolean;
  headerVerified: boolean;
  eofVerified: boolean;
  errorMessage?: string;
  detectedMimeType?: string;
  warnings: string[];
}

/**
 * Định dạng kích thước tệp hiển thị thân thiện (B, KB, MB)
 */
export function formatBytes(bytes: number, decimals: number = 2): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

/**
 * Kiểm tra các chữ ký nhị phân (Magic Bytes) phổ biến để phát hiện tệp bị đổi tên sai
 */
function detectDisguisedFileType(bytes: Uint8Array): string | null {
  if (bytes.length < 4) return null;

  // PK (ZIP, DOCX, XLSX, JAR)
  if (bytes[0] === 0x50 && bytes[1] === 0x4b) {
    return 'Tệp nén ZIP / Office DOCX bị đổi phần mở rộng thành .pdf';
  }
  // JPEG (\xFF\xD8\xFF)
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return 'Tệp ảnh JPEG bị đổi phần mở rộng thành .pdf';
  }
  // PNG (\x89PNG)
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
    return 'Tệp ảnh PNG bị đổi phần mở rộng thành .pdf';
  }
  // GIF (GIF87a / GIF89a)
  if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46) {
    return 'Tệp ảnh GIF bị đổi phần mở rộng thành .pdf';
  }
  // HTML / XML
  const startStr = new TextDecoder('ascii', { fatal: false }).decode(bytes.slice(0, 32)).toLowerCase();
  if (startStr.includes('<!doctype') || startStr.includes('<html') || startStr.includes('<?xml')) {
    return 'Trang web HTML hoặc tệp XML lưu sai dưới dạng .pdf';
  }

  return null;
}

/**
 * Xác thực ArrayBuffer chứa dữ liệu PDF
 */
export function validatePdfArrayBuffer(
  buffer: ArrayBuffer,
  fileName: string = 'document.pdf',
  maxSizeBytes: number = 50 * 1024 * 1024 // Tối đa 50MB cho đề thi
): PdfValidationResult {
  const fileSizeBytes = buffer.byteLength;
  const fileSizeFormatted = formatBytes(fileSizeBytes);
  const warnings: string[] = [];

  // 1. Kiểm tra kích thước tệp rỗng hoặc quá nhỏ
  if (fileSizeBytes === 0) {
    return {
      isValid: false,
      fileName,
      fileSizeBytes: 0,
      fileSizeFormatted: '0 Bytes',
      headerVerified: false,
      eofVerified: false,
      errorMessage: 'Tệp PDF hoàn toàn rỗng (0 Bytes). Vui lòng kiểm tra lại tệp nguồn.',
      warnings,
    };
  }

  // Một file PDF tối thiểu hợp lệ phải có ít nhất ~32 bytes
  if (fileSizeBytes < 32) {
    return {
      isValid: false,
      fileName,
      fileSizeBytes,
      fileSizeFormatted,
      headerVerified: false,
      eofVerified: false,
      errorMessage: `Tệp quá nhỏ (${fileSizeFormatted}) để là một tệp PDF hợp lệ theo chuẩn ISO 32000.`,
      warnings,
    };
  }

  // 2. Kiểm tra giới hạn kích thước tối đa
  if (fileSizeBytes > maxSizeBytes) {
    return {
      isValid: false,
      fileName,
      fileSizeBytes,
      fileSizeFormatted,
      headerVerified: false,
      eofVerified: false,
      errorMessage: `Dung lượng tệp (${fileSizeFormatted}) vượt quá giới hạn tối đa cho phép (${formatBytes(maxSizeBytes)}).`,
      warnings,
    };
  }

  const bytes = new Uint8Array(buffer);

  // 3. Phát hiện tệp giả mạo (đổi đuôi từ file ảnh, file Word, file ZIP hoặc trang HTML)
  const disguisedType = detectDisguisedFileType(bytes);
  if (disguisedType) {
    return {
      isValid: false,
      fileName,
      fileSizeBytes,
      fileSizeFormatted,
      headerVerified: false,
      eofVerified: false,
      errorMessage: `Tệp không đúng định dạng: ${disguisedType}. Vui lòng chọn tệp PDF nguyên bản.`,
      warnings,
    };
  }

  // 4. Kiểm tra Header Magic Bytes: %PDF-x.y
  // Theo chuẩn ISO 32000-1 §7.5.2, %PDF- phải xuất hiện trong 1024 bytes đầu tiên
  const headerSearchLimit = Math.min(1024, fileSizeBytes);
  const headerSlice = bytes.slice(0, headerSearchLimit);
  const headerText = new TextDecoder('latin1', { fatal: false }).decode(headerSlice);

  const headerMatch = headerText.match(/%PDF-(\d+\.\d+)/);
  const headerVerified = !!headerMatch;

  if (!headerVerified) {
    return {
      isValid: false,
      fileName,
      fileSizeBytes,
      fileSizeFormatted,
      headerVerified: false,
      eofVerified: false,
      errorMessage: 'Tệp không chứa chữ ký chuẩn "%PDF-". Tệp này đã bị hỏng hoặc không phải là định dạng PDF.',
      warnings,
    };
  }

  const version = headerMatch ? `PDF ${headerMatch[1]}` : undefined;

  // 5. Kiểm tra Trailer & EOF Marker: %%EOF
  // Theo chuẩn ISO 32000-1 §7.5.5, mã kết thúc %%EOF phải nằm trong 1024 bytes cuối cùng
  const footerSearchLength = Math.min(1024, fileSizeBytes);
  const footerSlice = bytes.slice(fileSizeBytes - footerSearchLength);
  const footerText = new TextDecoder('latin1', { fatal: false }).decode(footerSlice);

  const eofVerified = footerText.includes('%%EOF');
  if (!eofVerified) {
    warnings.push('Không tìm thấy ký hiệu kết thúc chuẩn %%EOF ở cuối tệp (có thể do tải chưa xong hoặc tệp bị cắt xén).');
  }

  // 6. Kiểm tra các thành phần cấu trúc PDF cơ bản (Objects / xref / Catalog)
  // Lấy mẫu đầu và đuôi để kiểm tra cấu trúc
  const sampleText = headerText + ' ' + footerText;
  const hasBasicStructure = sampleText.includes('obj') || sampleText.includes('xref') || sampleText.includes('trailer') || sampleText.includes('startxref');

  if (!hasBasicStructure && !eofVerified) {
    return {
      isValid: false,
      fileName,
      fileSizeBytes,
      fileSizeFormatted,
      version,
      headerVerified: true,
      eofVerified: false,
      errorMessage: 'Cấu trúc tệp PDF bị hỏng nghiêm trọng (không tìm thấy các đối tượng nội dung hợp lệ).',
      warnings,
    };
  }

  // 7. Kiểm tra trạng thái mã hóa / đặt mật khẩu (/Encrypt)
  const isEncrypted = sampleText.includes('/Encrypt');
  if (isEncrypted) {
    warnings.push('Tệp PDF này có thể đã được cài mật khẩu hoặc mã hóa bảo mật.');
  }

  // 8. Ước tính số trang nhanh
  let estimatedPages: number | undefined;
  // Tìm từ khóa /Count trong /Pages
  const pagesCountMatch = sampleText.match(/\/Type\s*\/Pages[\s\S]*?\/Count\s+(\d+)/);
  if (pagesCountMatch) {
    estimatedPages = parseInt(pagesCountMatch[1], 10);
  }

  return {
    isValid: true,
    fileName,
    fileSizeBytes,
    fileSizeFormatted,
    version,
    estimatedPages,
    isEncrypted,
    headerVerified: true,
    eofVerified,
    detectedMimeType: 'application/pdf',
    warnings,
  };
}

/**
 * Hàm xác thực tệp File PDF từ trình duyệt (Web File API)
 */
export async function validatePdfFile(
  file: File,
  maxSizeBytes: number = 50 * 1024 * 1024
): Promise<PdfValidationResult> {
  // 1. Kiểm tra đối tượng File
  if (!file) {
    return {
      isValid: false,
      fileName: 'unknown',
      fileSizeBytes: 0,
      fileSizeFormatted: '0 Bytes',
      headerVerified: false,
      eofVerified: false,
      errorMessage: 'Không tìm thấy tệp được chọn.',
      warnings: [],
    };
  }

  const fileName = file.name || 'document.pdf';
  const isPdfExtension = fileName.toLowerCase().endsWith('.pdf');
  const isPdfMime = file.type === 'application/pdf';

  if (!isPdfExtension && !isPdfMime) {
    return {
      isValid: false,
      fileName,
      fileSizeBytes: file.size,
      fileSizeFormatted: formatBytes(file.size),
      headerVerified: false,
      eofVerified: false,
      errorMessage: `Định dạng tệp không được hỗ trợ (phát hiện: ${file.type || 'không rõ'}). Vui lòng chọn tệp có đuôi .pdf.`,
      warnings: [],
    };
  }

  // 2. Đọc ArrayBuffer từ File
  try {
    const arrayBuffer = await file.arrayBuffer();
    return validatePdfArrayBuffer(arrayBuffer, fileName, maxSizeBytes);
  } catch (err: any) {
    return {
      isValid: false,
      fileName,
      fileSizeBytes: file.size,
      fileSizeFormatted: formatBytes(file.size),
      headerVerified: false,
      eofVerified: false,
      errorMessage: `Không thể đọc dữ liệu từ tệp: ${err?.message || 'Lỗi đọc tệp bộ nhớ'}. Tệp có thể đã bị khóa hoặc hư hại.`,
      warnings: [],
    };
  }
}
