/**
 * TSG Smart Document Naming Engine
 * Chuẩn hóa tên file chứng từ khoa học, dễ tìm kiếm và phân loại trên Google Drive
 * Định dạng: [LOẠI_CHỨNG_TỪ]_[SỐ_CHỨNG_TỪ]_[NGÀY]_[KHÁCH_HÀNG]_[PO_LIÊN_KẾT].[EXT]
 */

/**
 * Xóa dấu tiếng Việt và ký tự đặc biệt không hợp lệ trên hệ thống tệp và URL
 */
export function sanitizeFileNamePart(str: string): string {
  if (!str) return '';
  return str
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Bỏ dấu tiếng Việt
    .replace(/[đĐ]/g, (m) => (m === 'đ' ? 'd' : 'D'))
    .replace(/[\/\\:*?"<>|#%&{}\\<>*?/$!'":@+`|=]/g, '-') // Đổi ký tự cấm thành dấu gạch ngang
    .replace(/\s+/g, '') // Bỏ khoảng trắng
    .replace(/-+/g, '-') // Gộp nhiều dấu gạch ngang liên tiếp
    .replace(/^-|-$/g, ''); // Cắt gạch ngang ở đầu và cuối
}

/**
 * Chuẩn hóa ngày thành định dạng YYYY-MM-DD
 */
export function formatStandardDateForFileName(dateStr?: string): string {
  if (!dateStr) {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  }

  const clean = dateStr.trim();

  // Khớp dạng DD/MM/YYYY hoặc DD-MM-YYYY hoặc DD.MM.YYYY
  const dmy = clean.match(/^(\d{1,2})[\/\.-](\d{1,2})[\/\.-](\d{4})/);
  if (dmy) {
    const d = dmy[1].padStart(2, '0');
    const m = dmy[2].padStart(2, '0');
    const y = dmy[3];
    return `${y}-${m}-${d}`;
  }

  // Khớp dạng YYYY/MM/DD hoặc YYYY-MM-DD
  const ymd = clean.match(/^(\d{4})[\/\.-](\d{1,2})[\/\.-](\d{1,2})/);
  if (ymd) {
    const y = ymd[1];
    const m = ymd[2].padStart(2, '0');
    const d = ymd[3].padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  return sanitizeFileNamePart(clean);
}

/**
 * Rút gọn tên Khách hàng quen thuộc để tên file ngắn gọn, dễ đọc
 */
export function getShortCustomerName(fullName?: string): string {
  if (!fullName) return '';
  const clean = fullName.trim();
  const lower = clean.toLowerCase();

  if (lower.includes('thanh hóa') || lower.includes('thanh hoa')) return 'ThuocLaThanhHoa';
  if (lower.includes('bắc sơn') || lower.includes('bac son')) return 'ThuocLaBacSon';
  if (lower.includes('long an')) return 'ThuocLaLongAn';
  if (lower.includes('đà nẵng') || lower.includes('da nang')) return 'ThuocLaDaNang';
  if (lower.includes('sài gòn') || lower.includes('sai gon')) return 'ThuocLaSaiGon';
  if (lower.includes('an việt phát') || lower.includes('an viet phat') || lower.includes('avp')) return 'AnVietPhat';
  if (lower.includes('tâm sen') || lower.includes('tam sen')) return 'TamSen';

  // Rút gọn các tiền tố công ty dài
  const stripped = clean
    .replace(/^CÔNG TY (TNHH MTV|TNHH|CỔ PHẦN|CP|TẬP ĐOÀN)\s*/i, '')
    .replace(/^CONG TY (TNHH MTV|TNHH|CO PHAN|CP|TAP DOAN)\s*/i, '');

  return sanitizeFileNamePart(stripped);
}

/**
 * Tạo tên file thông minh hoàn chỉnh
 */
export function generateSmartDocumentFileName(params: {
  documentType?: string;
  documentNumber?: string;
  documentDate?: string;
  deliveryDate?: string;
  documentReference?: string; // Số PO liên kết
  buyerName?: string;
  originalFileName?: string;
}): string {
  const {
    documentType = 'PXK',
    documentNumber = '',
    documentDate = '',
    deliveryDate = '',
    documentReference = '',
    buyerName = '',
    originalFileName = 'document.pdf'
  } = params;

  // Lấy phần mở rộng file (.pdf, .jpg, .png...)
  const ext = originalFileName && originalFileName.includes('.')
    ? originalFileName.substring(originalFileName.lastIndexOf('.')).toLowerCase()
    : '.pdf';

  // Chuẩn hóa tiền tố loại chứng từ
  let prefix = 'PXK';
  const typeUpper = (documentType || '').toUpperCase();
  if (typeUpper.includes('BBGH') || typeUpper.includes('BIÊN BẢN')) {
    prefix = 'BBGH';
  } else if (typeUpper.includes('PO') || typeUpper.includes('ĐƠN HÀNG') || typeUpper.includes('ĐẶT HÀNG')) {
    prefix = 'PO';
  } else if (typeUpper.includes('HD') || typeUpper.includes('HỢP ĐỒNG')) {
    prefix = 'HDMB';
  } else if (typeUpper.includes('INVOICE') || typeUpper.includes('HÓA ĐƠN') || typeUpper.includes('VAT')) {
    prefix = 'HD-VAT';
  } else {
    prefix = 'PXK';
  }

  // Làm sạch các trường thông tin
  const cleanDocNum = sanitizeFileNamePart(documentNumber);
  const dateToUse = deliveryDate || documentDate;
  const cleanDate = formatStandardDateForFileName(dateToUse);
  const cleanCust = getShortCustomerName(buyerName);
  const cleanRef = sanitizeFileNamePart(documentReference);

  // Xây dựng mảng tên file
  const parts: string[] = [prefix];

  if (cleanDocNum) {
    parts.push(cleanDocNum);
  }

  if (cleanDate) {
    parts.push(cleanDate);
  }

  if (cleanCust) {
    parts.push(cleanCust);
  }

  if (cleanRef && cleanRef !== cleanDocNum && prefix !== 'PO') {
    parts.push(`PO-${cleanRef}`);
  }

  return `${parts.join('_')}${ext}`;
}
