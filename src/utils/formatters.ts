/**
 * TSG System Formatting & Standardization Utilities
 * Quy chuẩn định dạng Tên, Số điện thoại và Dữ liệu doanh nghiệp Việt Nam
 */

/**
 * Chuẩn hóa số điện thoại theo quy chuẩn Việt Nam
 * Ví dụ:
 * - 0987713899 -> 0987.713.899
 * - 0912345678 -> 0912.345.678
 * - 02437891234 (11 số cố định) -> 024.3789.1234
 * - +84987713899 -> 0987.713.899
 */
export function formatVietnamesePhone(phoneStr: string | null | undefined): string {
  if (!phoneStr) return '';
  
  // Clean all non-digit characters except +
  let cleaned = String(phoneStr).trim().replace(/[^\d+]/g, '');
  if (!cleaned) return String(phoneStr);

  // Convert +84 or 84 prefix to 0
  if (cleaned.startsWith('+84')) {
    cleaned = '0' + cleaned.slice(3);
  } else if (cleaned.startsWith('84') && cleaned.length >= 11) {
    cleaned = '0' + cleaned.slice(2);
  }

  // Remove any remaining non-digits
  const digits = cleaned.replace(/\D/g, '');

  // 10 digits mobile standard (09x, 08x, 07x, 03x, 05x): 0xxx.xxx.xxx
  if (digits.length === 10) {
    return `${digits.slice(0, 4)}.${digits.slice(4, 7)}.${digits.slice(7)}`;
  }

  // 11 digits landline standard (024, 028, etc.): 0xx.xxxx.xxxx
  if (digits.length === 11) {
    return `${digits.slice(0, 3)}.${digits.slice(3, 7)}.${digits.slice(7)}`;
  }

  // 9 digits (missing leading 0): 0xxx.xxx.xxx
  if (digits.length === 9) {
    const padded = '0' + digits;
    return `${padded.slice(0, 4)}.${padded.slice(4, 7)}.${padded.slice(7)}`;
  }

  return phoneStr;
}

/**
 * Lấy số điện thoại sạch để gắn vào thẻ href="tel:..." hoặc zalo.me
 */
export function getRawCallablePhone(phoneStr: string | null | undefined): string {
  if (!phoneStr) return '';
  let digits = String(phoneStr).replace(/\D/g, '');
  if (digits.startsWith('84')) digits = '0' + digits.slice(2);
  return digits;
}

/**
 * Chuẩn hóa tên nhân sự (Title Case, loại bỏ danh xưng lặp lại)
 */
export function formatContactFullName(name: string | null | undefined): string {
  if (!name) return '';
  let cleaned = String(name).trim();

  // Strip repeated title prefixes if accidentally typed in name
  cleaned = cleaned.replace(/^(Mr\.?|Mrs\.?|Ms\.?|Anh|Chị|Ông|Bà)\s+/i, '');

  // Convert to proper Title Case
  return cleaned
    .split(/\s+/)
    .map(word => {
      if (!word) return '';
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(' ');
}

/**
 * Chuẩn hóa tên viết gọn của doanh nghiệp (Bỏ tiền tố CÔNG TY TNHH/CỔ PHẦN khi hiển thị thẻ)
 */
export function formatShortCompanyName(name: string | null | undefined): string {
  if (!name) return '';
  return name
    .replace(/^CÔNG TY (CỔ PHẦN|TNHH MTV|TNHH|TẬP ĐOÀN|DOANH NGHIỆP TƯ NHÂN)\s+/gi, '')
    .replace(/^(CTCP|TNHH|DNTN)\s+/gi, '')
    .trim();
}

/**
 * Chuẩn hóa Mã định danh (ID) chuẩn ERP
 */
export function formatEnterpriseCode(type: 'customer' | 'supplier' | 'contact' | 'po' | 'delivery', rawCode: string): string {
  if (!rawCode) return '';
  const clean = rawCode.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '');
  switch (type) {
    case 'customer':
      return clean.startsWith('KH-') || clean.startsWith('CUST-') ? clean : `KH-${clean}`;
    case 'supplier':
      return clean.startsWith('NCC-') || clean.startsWith('SUPP-') ? clean : `NCC-${clean}`;
    case 'contact':
      return clean.startsWith('NV-') ? clean : `NV-${clean}`;
    case 'po':
      return clean.startsWith('PO-') ? clean : `PO-${clean}`;
    case 'delivery':
      return clean.startsWith('PXK-') ? clean : `PXK-${clean}`;
    default:
      return clean;
  }
}
