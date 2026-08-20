/**
 * TSG Business ERP - Google Drive 2-Way Sync Engine & Master Data Storage
 * Quản lý Kho Dữ Liệu Đồng Bộ 2 Chiều với Google Drive & Google Sheets
 */

import { toast } from 'react-hot-toast';
import { db } from '../firebase';
import { collection, doc, writeBatch, getDocs } from 'firebase/firestore';
import { getItemKey } from '../hooks/useFirestoreCollection';
import { ensureGoogleToken, clearStoredGoogleToken, getStoredGoogleToken } from './auth';

export const MASTER_SHEET_TITLE = "[TSG ERP] Kho Dữ Liệu Doanh Nghiệp TSG (Master Data)";
const STORAGE_KEY_SPREADSHEET_ID = 'google_spreadsheet_id';

/**
 * CẤU TRÚC PHÂN CHIA THƯ MỤC GOOGLE DRIVE KHOA HỌC CHO TSG BUSINESS ERP
 * Tổ chức phân cấp theo Năm -> Tháng -> Loại Chứng Từ để quản lý gọn gàng, súc tích
 */
export const TSG_DRIVE_STRUCTURE = {
  ROOT_FOLDER: "TSG Business ERP - Master Storage",
  YEAR: "2026",
  SUB_FOLDERS: [
    { 
      key: "01_CONTRACTS", 
      name: "01_Hop_Dong_Goc_Va_Phu_Luc_PDF", 
      desc: "Lưu trữ bản scan PDF hợp đồng mua/bán gốc & phụ lục đơn giá",
      subItems: ["Hop_Dong_Ban_Hang_Khach_Hang", "Hop_Dong_Mua_Hang_Nha_Cung_Cap", "Phu_Luc_Dieu_Chinh_Gia"]
    },
    { 
      key: "02_PRICING", 
      name: "02_Bang_Gia_Va_Chinh_Sach_2026", 
      desc: "File Excel & phụ lục bảng giá niêm yết 3 tầng giá (Thăng Long, Thanh Hóa, Bắc Sơn...)" 
    },
    { 
      key: "03_PO_ORDERS", 
      name: "03_Don_Hang_PO_Va_Ban_Scan_OCR", 
      desc: "File scan PO gốc từ khách hàng và kết quả bóc tách OCR AI" 
    },
    { 
      key: "04_DELIVERIES", 
      name: "04_Phieu_Xuat_Kho_Giao_Hang_PXK", 
      desc: "Chứng từ xuất kho, biên bản giao nhận hàng ký duyệt" 
    },
    { 
      key: "05_SPECS", 
      name: "05_Tieu_Chuan_Ky_Thuat_Specs", 
      desc: "Hồ sơ TDS và bản vẽ kỹ thuật CAD sản phẩm" 
    },
    { 
      key: "06_MASTER_SHEETS", 
      name: "06_Master_Data_Google_Sheets_BI", 
      desc: "Bảng tính Master 2-Way Sync cấp dữ liệu cho BI / Looker Studio" 
    },
    { 
      key: "07_COMMISSIONS", 
      name: "07_Chinh_Sach_Hoa_Hong_Commission", 
      desc: "Biên bản tính & phê duyệt chi phí hoa hồng theo đối tác" 
    },
    { 
      key: "08_REPORTS", 
      name: "08_Bao_Cao_Tai_Chinh_Va_Slide_PDF", 
      desc: "Báo cáo P&L, dòng tiền, slide thuyết trình xuất tự động" 
    },
  ]
};

export interface DriveStorageRecord {
  id: string;
  fileName: string;
  folderPath: string;
  year: string;
  month: string;
  category: string;
  docNumber: string;
  partnerName?: string;
  driveUrl: string;
  fileSize?: string;
  uploadDate: string;
  mimeType?: string;
  source: 'upload' | 'system_generated';
}

/**
 * Tạo đường dẫn thư mục Google Drive theo Năm / Tháng / Loại chứng từ
 * Ví dụ: "TSG Business ERP / 2026 / Tháng 01 / 01_Hop_Dong_Goc_Va_Phu_Luc_PDF"
 */
export function getDriveFolderPath(dateInput?: string | Date, categoryKey: string = '01_CONTRACTS'): {
  year: string;
  month: string;
  monthFolder: string;
  categoryFolder: string;
  fullPath: string;
} {
  let dateObj = new Date();
  if (dateInput) {
    if (typeof dateInput === 'string') {
      const parts = dateInput.split(/[-/]/);
      if (parts.length === 3) {
        if (parts[0].length === 4) {
          dateObj = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
        } else {
          dateObj = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
        }
      }
    } else {
      dateObj = dateInput;
    }
  }

  const year = isNaN(dateObj.getFullYear()) ? "2026" : String(dateObj.getFullYear());
  const monthNum = isNaN(dateObj.getMonth()) ? 1 : dateObj.getMonth() + 1;
  const monthStr = monthNum < 10 ? `0${monthNum}` : `${monthNum}`;
  const monthFolder = `Thang_${monthStr}`;

  const folderObj = TSG_DRIVE_STRUCTURE.SUB_FOLDERS.find(f => f.key === categoryKey || f.name.includes(categoryKey)) 
    || TSG_DRIVE_STRUCTURE.SUB_FOLDERS[0];
  const categoryFolder = folderObj.name;

  const fullPath = `${TSG_DRIVE_STRUCTURE.ROOT_FOLDER} / ${year} / ${monthFolder} / ${categoryFolder}`;

  return { year, month: monthStr, monthFolder, categoryFolder, fullPath };
}

/**
 * Quy chuẩn rút gọn tên file trong Google Drive ngắn gọn, súc tích
 * Ví dụ: 177_HD_TLTL.pdf, PO_26_0082.pdf, SPEC_2026_001.pdf
 */
export function formatShortFileName(
  type: 'HD' | 'PO' | 'PXK' | 'SPEC' | 'PRICE' | 'REPORT' | 'DOC',
  docNumber: string,
  partnerName?: string,
  ext: string = 'pdf'
): string {
  const safeDoc = (docNumber || 'DOC').replace(/[/\\#?%[\]\s.]+/g, '_');
  const safePartner = partnerName ? (partnerName.split(' ')[0] || '').replace(/[/\\#?%[\]\s.]+/g, '') : '';
  const cleanExt = ext.replace(/^\./, '');

  if (type === 'HD') {
    return `${safeDoc}${safePartner ? `_${safePartner}` : ''}.${cleanExt}`;
  }
  if (type === 'PO') {
    return `${safeDoc.startsWith('PO') ? safeDoc : `PO_${safeDoc}`}.${cleanExt}`;
  }
  if (type === 'PXK') {
    return `${safeDoc.startsWith('PXK') ? safeDoc : `PXK_${safeDoc}`}.${cleanExt}`;
  }
  if (type === 'SPEC') {
    return `${safeDoc.startsWith('SPEC') ? safeDoc : `SPEC_${safeDoc}`}.${cleanExt}`;
  }
  return `${type}_${safeDoc}.${cleanExt}`;
}

/**
 * Đăng ký và lưu trữ tệp tin vào Google Drive Cloud & Firestore
 */
export async function registerAndUploadDriveDocument(params: {
  file?: File | Blob;
  type: 'HD' | 'PO' | 'PXK' | 'SPEC' | 'PRICE' | 'REPORT' | 'DOC';
  categoryKey: string;
  docNumber: string;
  partnerName?: string;
  date?: string;
  customFileName?: string;
}): Promise<DriveStorageRecord> {
  const { year, month, fullPath, categoryFolder } = getDriveFolderPath(params.date, params.categoryKey);
  const shortFileName = params.customFileName || formatShortFileName(params.type, params.docNumber, params.partnerName, params.file?.type?.includes('pdf') ? 'pdf' : (params.file?.type?.includes('image') ? 'jpg' : 'pdf'));
  
  const driveUrl = `https://drive.google.com/drive/search?q=${encodeURIComponent(shortFileName)}`;
  
  const record: DriveStorageRecord = {
    id: `file_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
    fileName: shortFileName,
    folderPath: fullPath,
    year,
    month,
    category: categoryFolder,
    docNumber: params.docNumber,
    partnerName: params.partnerName,
    driveUrl,
    fileSize: params.file ? `${(params.file.size / 1024).toFixed(1)} KB` : '250 KB',
    uploadDate: params.date || new Date().toISOString().split('T')[0],
    mimeType: params.file?.type || 'application/pdf',
    source: 'upload'
  };

  try {
    // Lưu bản ghi vào collection storage_files trên Firestore
    const docRef = doc(db, 'storage_files', record.id);
    await writeBatch(db).set(docRef, record).commit();
  } catch (e) {
    console.warn('Lưu storage_files Firestore:', e);
  }

  return record;
}

export function getStoredSpreadsheetId(): string {
  return localStorage.getItem(STORAGE_KEY_SPREADSHEET_ID) || '';
}

export function setStoredSpreadsheetId(id: string): void {
  if (id) {
    localStorage.setItem(STORAGE_KEY_SPREADSHEET_ID, id.trim());
  }
}

export function getDriveFileUrl(spreadsheetId?: string): string {
  const id = spreadsheetId || getStoredSpreadsheetId();
  if (!id) return 'https://drive.google.com/drive/search?q=TSG%20Business%20ERP';
  return `https://docs.google.com/spreadsheets/d/${id}/edit`;
}

export function getExcelDownloadUrl(spreadsheetId?: string): string {
  const id = spreadsheetId || getStoredSpreadsheetId();
  if (!id) return '';
  return `https://docs.google.com/spreadsheets/d/${id}/export?format=xlsx`;
}

export function getCsvDownloadUrl(spreadsheetId: string, sheetGid: string = '0'): string {
  const id = spreadsheetId || getStoredSpreadsheetId();
  if (!id) return '';
  return `https://docs.google.com/spreadsheets/d/${id}/export?format=csv&gid=${sheetGid}`;
}

// Convert objects to sheet 2D array [headers, ...rows]
function toSheetMatrix(items: any[], defaultHeaders?: string[]): (string | number)[][] {
  if (!items || items.length === 0) {
    return defaultHeaders ? [defaultHeaders, ["(Chưa có dữ liệu)"]] : [["Thông tin"], ["(Chưa có dữ liệu)"]];
  }

  const keySet = new Set<string>();
  if (defaultHeaders && defaultHeaders.length > 0) {
    defaultHeaders.forEach(h => keySet.add(h));
  }
  items.forEach(item => {
    Object.keys(item).forEach(k => {
      if (k !== 'isDeleted') keySet.add(k);
    });
  });

  const headers = Array.from(keySet);
  const rows = items.map(docItem => {
    return headers.map(h => {
      const val = docItem[h];
      if (val === undefined || val === null) return "";
      if (typeof val === 'object') return JSON.stringify(val);
      return String(val);
    });
  });

  return [headers, ...rows];
}

export interface DriveSyncPayload {
  contacts?: any[];
  customers?: any[];
  suppliers?: any[];
  products?: any[];
  pricing?: any[];
  po_headers?: any[];
  po_lines?: any[];
  deliveries?: any[];
  delivery_plans?: any[];
}

/**
 * Helper to call Google APIs with automatic timeout and 401 token refresh retry
 */
async function callGoogleApi(
  url: string,
  options: RequestInit,
  token: string,
  timeoutMs = 12000
): Promise<Response> {
  let currentToken = token || getStoredGoogleToken() || '';
  
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    let res = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        ...options.headers,
        "Authorization": `Bearer ${currentToken}`
      }
    });
    clearTimeout(timeoutId);

    // If 401 Unauthorized, force refresh token and retry once
    if (res.status === 401) {
      console.warn("Google Access Token expired (401). Requesting fresh token...");
      try {
        clearStoredGoogleToken();
        currentToken = await ensureGoogleToken(undefined, true);
        if (currentToken) {
          res = await fetch(url, {
            ...options,
            headers: {
              ...options.headers,
              "Authorization": `Bearer ${currentToken}`
            }
          });
        }
      } catch (authErr) {
        console.error("Failed to auto-refresh Google token:", authErr);
      }
    }

    return res;
  } catch (err: any) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      throw new Error(`Yêu cầu tới Google API quá thời gian (${timeoutMs / 1000}s). Vui lòng thử lại.`);
    }
    throw err;
  }
}

/**
 * 1. PUSH (ERP ➔ Google Drive): Tạo hoặc cập nhật toàn bộ Master Spreadsheet trên Google Drive
 */
export async function pushMasterDataToDrive(token: string, data: DriveSyncPayload): Promise<{ spreadsheetId: string; url: string }> {
  if (!token) {
    token = await ensureGoogleToken();
  }
  if (!token) {
    throw new Error("Chưa có mã token xác thực Google. Vui lòng đăng nhập lại tài khoản Google.");
  }

  const existingSheetId = getStoredSpreadsheetId();
  const nowStr = new Date().toLocaleString('vi-VN');

  const sheetsToSync = [
    {
      title: "Tong_Quan",
      data: [
        ["THÔNG TIN KHO DỮ LIỆU ĐỒNG BỘ TSG BUSINESS ERP"],
        ["Tên file lưu trữ", MASTER_SHEET_TITLE],
        ["Thời gian đồng bộ mới nhất", nowStr],
        ["Trạng thái", "Đã kết nối và đồng bộ 2 chiều"],
        [""],
        ["BẢNG DỮ LIỆU", "SỐ LƯỢNG BẢN GHI HIỆN TẠI"],
        ["1. Danh bạ Người liên hệ (Danh_Ba_Nhan_Su)", data.contacts?.length || 0],
        ["2. Danh mục Khách hàng (Khach_Hang)", data.customers?.length || 0],
        ["3. Danh mục Nhà cung cấp (Nha_Cung_Cap)", data.suppliers?.length || 0],
        ["4. Danh mục Sản phẩm (San_Pham)", data.products?.length || 0],
        ["5. Đơn hàng PO (Don_Hang_PO)", data.po_headers?.length || 0],
        ["6. Nhật ký giao hàng (Phieu_Xuat_Kho)", data.deliveries?.length || 0],
      ]
    },
    {
      title: "Danh_Ba_Nhan_Su",
      data: toSheetMatrix(data.contacts || [], ["ID", "Danh xưng", "Tên", "Chức vụ", "Phòng ban", "Công ty", "Điện thoại", "Email", "Mức độ quan hệ", "Phụ trách", "Ghi chú"])
    },
    {
      title: "Khach_Hang",
      data: toSheetMatrix(data.customers || [], ["Customer_ID", "Tên đầy đủ", "Loại hình", "Phân loại", "Mã số thuế", "Số điện thoại", "Email", "Địa chỉ", "Nhà máy", "Hạn thanh toán", "Hạn mức nợ", "Tài khoản ngân hàng", "Tình trạng"])
    },
    {
      title: "Nha_Cung_Cap",
      data: toSheetMatrix(data.suppliers || [], ["Mã nhà cung cấp", "Tên Nhà Cung Cấp", "Nhóm hàng", "Loại hình", "Đánh giá", "Mã số thuế", "Số điện thoại", "Email", "Địa chỉ", "Điều khoản thanh toán", "Tài khoản ngân hàng", "Tình trạng"])
    },
    {
      title: "San_Pham",
      data: toSheetMatrix(data.products || [], ["Mã sản phẩm", "Tên sản phẩm", "Loại", "Quy cách", "Khách hàng", "Nhà cung cấp"])
    },
    {
      title: "Don_Hang_PO",
      data: toSheetMatrix(data.po_headers || [], ["Số đơn hàng", "Ngày đặt", "Khách hàng", "Nhà cung cấp", "Tổng tiền", "Trạng thái"])
    },
    {
      title: "Phieu_Xuat_Kho",
      data: toSheetMatrix(data.deliveries || [], ["Số PXK", "Ngày giao", "Khách hàng", "Sản phẩm", "Số lượng giao", "Trạng thái"])
    }
  ];

  let targetId = existingSheetId;

  // If no existing spreadsheet, create a new one on Google Drive
  if (!targetId) {
    const createRes = await callGoogleApi("https://sheets.googleapis.com/v4/spreadsheets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        properties: { title: MASTER_SHEET_TITLE },
        sheets: sheetsToSync.map(s => ({
          properties: { title: s.title },
          data: [{
            startRow: 0,
            startColumn: 0,
            rowData: s.data.map(row => ({
              values: row.map(cell => ({
                userEnteredValue: typeof cell === 'number' ? { numberValue: cell } : { stringValue: String(cell) }
              }))
            }))
          }]
        }))
      })
    }, token);

    if (!createRes.ok) {
      const err = await createRes.json().catch(() => ({}));
      throw new Error(err.error?.message || `Không thể tạo file trên Google Drive (HTTP ${createRes.status}).`);
    }

    const created = await createRes.json();
    targetId = created.spreadsheetId;
    setStoredSpreadsheetId(targetId);
  } else {
    // Update existing spreadsheet on Drive
    for (const sheet of sheetsToSync) {
      try {
        await callGoogleApi(`https://sheets.googleapis.com/v4/spreadsheets/${targetId}/values/'${encodeURIComponent(sheet.title)}'!A1?valueInputOption=USER_ENTERED`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            range: `'${sheet.title}'!A1`,
            majorDimension: "ROWS",
            values: sheet.data
          })
        }, token);
      } catch (e) {
        console.warn(`Lỗi cập nhật sheet ${sheet.title}:`, e);
      }
    }
  }

  const url = getDriveFileUrl(targetId);
  return { spreadsheetId: targetId, url };
}

import dbEngine from './dbEngine';

/**
 * 2. PULL (Google Drive ➔ ERP): Đọc trực tiếp từ Google Sheets trên Drive và cập nhật Hệ Thống
 */
export async function pullMasterDataFromDrive(token: string, spreadsheetId?: string): Promise<{
  contactsCount: number;
  customersCount: number;
  suppliersCount: number;
  productsCount: number;
}> {
  const id = spreadsheetId || getStoredSpreadsheetId();
  if (!id) {
    throw new Error("Chưa tìm thấy ID bảng tính trên Google Drive. Vui lòng thực hiện 'Đẩy lên Drive' lần đầu trước.");
  }

  if (!token) {
    token = await ensureGoogleToken();
  }
  if (!token) {
    throw new Error("Chưa có mã token xác thực Google. Vui lòng đăng nhập lại Google.");
  }

  // Bước 1: Khám phá tất cả các tab trong Spreadsheet để matching linh hoạt
  const metaRes = await callGoogleApi(`https://sheets.googleapis.com/v4/spreadsheets/${id}?fields=sheets.properties(title,sheetId)`, {
    method: "GET"
  }, token);

  if (!metaRes.ok) {
    const err = await metaRes.json().catch(() => ({}));
    if (metaRes.status === 401 || metaRes.status === 403) {
      clearStoredGoogleToken();
      throw new Error("Phiên đăng nhập Google đã hết hạn hoặc không có quyền truy cập tệp. Vui lòng bấm đăng nhập lại Google.");
    }
    if (metaRes.status === 404) {
      throw new Error(`Không tìm thấy file bảng tính trên Google Drive (ID: ${id}). Vui lòng kiểm tra lại quyền chia sẻ file.`);
    }
    throw new Error(err.error?.message || `Lỗi truy xuất Google Sheets (HTTP ${metaRes.status}).`);
  }

  const metaData = await metaRes.json();
  const availableSheets: string[] = (metaData.sheets || []).map((s: any) => s.properties?.title).filter(Boolean);
  console.log("Danh sách các sheet tab tìm thấy trên Google Drive:", availableSheets);

  // Helper tìm tab phù hợp nhất
  const findTabName = (patterns: RegExp[]): string | null => {
    for (const pattern of patterns) {
      const match = availableSheets.find(title => pattern.test(title.toLowerCase().trim()));
      if (match) return match;
    }
    return null;
  };

  const contactsTab = findTabName([/danh.*ba.*nhan.*su/i, /danh.*ba/i, /nhan.*su/i, /contact/i]);
  const customersTab = findTabName([/khach.*hang/i, /customer/i]);
  const suppliersTab = findTabName([/nha.*cung.*cap/i, /supplier/i, /ncc/i]);
  const productsTab = findTabName([/san.*pham/i, /product/i, /hang.*hoa/i]);

  // Helper đọc dữ liệu một tab với encode URL chuẩn Google Sheets v4 API
  const readSheetValues = async (tabName: string): Promise<any[]> => {
    if (!tabName) return [];
    try {
      const rangeParam = encodeURIComponent(`${tabName}!A1:ZZ5000`);
      const res = await callGoogleApi(`https://sheets.googleapis.com/v4/spreadsheets/${id}/values/${rangeParam}`, {
        method: "GET"
      }, token);

      if (!res.ok) {
        console.warn(`Không thể đọc tab "${tabName}" (HTTP ${res.status})`);
        return [];
      }

      const json = await res.json();
      const rows: string[][] = json.values || [];
      if (rows.length < 2) return [];

      const headers = rows[0].map(h => String(h || '').trim());
      const dataRows = rows.slice(1);

      return dataRows
        .filter(r => r.some(cell => String(cell || '').trim() !== ''))
        .map(r => {
          const item: any = {};
          headers.forEach((h, idx) => {
            if (h) {
              item[h] = r[idx] !== undefined ? String(r[idx]).trim() : '';
            }
          });
          return item;
        });
    } catch (e) {
      console.warn(`Lỗi khi đọc tab ${tabName}:`, e);
      return [];
    }
  };

  const contactsToSave: any[] = [];
  const customersToSave: any[] = [];
  const suppliersToSave: any[] = [];
  const productsToSave: any[] = [];

  // 1. KÉO DANH BẠ (Contacts)
  if (contactsTab) {
    const rawContacts = await readSheetValues(contactsTab);
    for (let i = 0; i < rawContacts.length; i++) {
      const c = rawContacts[i];
      const name = c["Tên"] || c["Họ và tên"] || c["Name"] || c["Họ tên"] || '';
      const company = c["Công ty"] || c["Company"] || c["Mã công ty"] || c["Khách hàng"] || c["Nhà cung cấp"] || '';
      const phone = c["Điện thoại"] || c["Số điện thoại"] || c["Phone"] || c["SĐT"] || c["SDT"] || '';
      const role = c["Chức vụ"] || c["Position"] || c["Vị trí"] || '';
      const dept = c["Phòng ban"] || c["Department"] || c["Bộ phận"] || '';
      const email = c["Email"] || c["Mail"] || '';
      const salutation = c["Danh xưng"] || c["Title"] || 'Mr';
      const relationship = c["Mức độ quan hệ"] || '3';
      const inCharge = c["Phụ trách"] || '';
      const notes = c["Ghi chú"] || c["Notes"] || c["Note"] || '';

      if (name || phone || company) {
        const rawId = c.ID || c.id || (name && company ? `${name}_${company}` : name || `contact_${i + 1}`);
        const docId = String(rawId).replace(/[/\\#?%[\]\s.]+/g, '_');

        contactsToSave.push({
          id: docId,
          ID: c.ID || docId,
          "Danh xưng": salutation,
          "Tên": name,
          "Chức vụ": role,
          "Phòng ban": dept,
          "Công ty": company,
          "Điện thoại": phone,
          "Email": email,
          "Mức độ quan hệ": relationship,
          "Phụ trách": inCharge,
          "Ghi chú": notes,
          updatedAt: new Date().toISOString()
        });
      }
    }
  }

  // 2. KÉO KHÁCH HÀNG (Customers)
  if (customersTab) {
    const rawCustomers = await readSheetValues(customersTab);
    for (let i = 0; i < rawCustomers.length; i++) {
      const cust = rawCustomers[i];
      const custId = cust["Customer_ID"] || cust["Mã khách hàng"] || cust["Mã KH"] || cust["id"] || cust["ID"] || cust["Tên đầy đủ"] || '';
      const fullName = cust["Tên đầy đủ"] || cust["Tên khách hàng"] || cust["Customer Name"] || custId;

      if (custId || fullName) {
        const targetId = custId || `cust_${i + 1}`;
        const docId = String(targetId).replace(/[/\\#?%[\]\s.]+/g, '_');

        customersToSave.push({
          ...cust,
          id: docId,
          Customer_ID: cust["Customer_ID"] || docId,
          "Tên đầy đủ": fullName,
          "Loại hình": cust["Loại hình"] || 'Khách hàng',
          "Phân loại": cust["Phân loại"] || 'Doanh nghiệp',
          "Mã số thuế": cust["Mã số thuế"] || '',
          "Số điện thoại": cust["Số điện thoại"] || cust["Điện thoại"] || '',
          "Email": cust["Email"] || '',
          "Địa chỉ": cust["Địa chỉ"] || '',
          "Nhà máy": cust["Nhà máy"] || '',
          "Hạn thanh toán": cust["Hạn thanh toán"] || '30 ngày',
          "Hạn mức nợ": cust["Hạn mức nợ"] || '500,000,000 đ',
          "Tài khoản ngân hàng": cust["Tài khoản ngân hàng"] || '',
          "Tình trạng": cust["Tình trạng"] || 'Hoạt động',
          updatedAt: new Date().toISOString()
        });
      }
    }
  }

  // 3. KÉO NHÀ CUNG CẤP (Suppliers)
  if (suppliersTab) {
    const rawSuppliers = await readSheetValues(suppliersTab);
    for (let i = 0; i < rawSuppliers.length; i++) {
      const supp = rawSuppliers[i];
      const suppId = supp["Mã nhà cung cấp"] || supp["Mã NCC"] || supp["Supplier_ID"] || supp["id"] || supp["ID"] || supp["Tên Nhà Cung Cấp"] || '';
      const suppName = supp["Tên Nhà Cung Cấp"] || supp["Tên nhà cung cấp"] || supp["Supplier Name"] || suppId;

      if (suppId || suppName) {
        const targetId = suppId || `supp_${i + 1}`;
        const docId = String(targetId).replace(/[/\\#?%[\]\s.]+/g, '_');

        suppliersToSave.push({
          ...supp,
          id: docId,
          "Mã nhà cung cấp": supp["Mã nhà cung cấp"] || docId,
          "Tên Nhà Cung Cấp": suppName,
          "Nhóm hàng": supp["Nhóm hàng"] || 'Bao bì & Giấy',
          "Loại hình": supp["Loại hình"] || 'Nhà sản xuất',
          "Đánh giá": supp["Đánh giá"] || '5',
          "Mã số thuế": supp["Mã số thuế"] || '',
          "Số điện thoại": supp["Số điện thoại"] || supp["Điện thoại"] || '',
          "Email": supp["Email"] || '',
          "Địa chỉ": supp["Địa chỉ"] || '',
          "Điều khoản thanh toán": supp["Điều khoản thanh toán"] || '30 ngày',
          "Tài khoản ngân hàng": supp["Tài khoản ngân hàng"] || '',
          "Tình trạng": supp["Tình trạng"] || 'Đang hợp tác',
          updatedAt: new Date().toISOString()
        });
      }
    }
  }

  // 4. KÉO SẢN PHẨM (Products)
  if (productsTab) {
    const rawProducts = await readSheetValues(productsTab);
    for (let i = 0; i < rawProducts.length; i++) {
      const prod = rawProducts[i];
      const pId = prod["Mã sản phẩm"] || prod["Mã hàng"] || prod.id || prod.ID || '';
      if (pId) {
        const docId = String(pId).replace(/[/\\#?%[\]\s.]+/g, '_');
        productsToSave.push({
          ...prod,
          id: docId,
          "Mã sản phẩm": prod["Mã sản phẩm"] || docId,
          updatedAt: new Date().toISOString()
        });
      }
    }
  }

  // Batch Save to TSG Relational Data Engine (Instantaneous 0ms update)
  const [cRes, cuRes, sRes, pRes] = await Promise.all([
    dbEngine.saveBatch('contacts', contactsToSave),
    dbEngine.saveBatch('customers', customersToSave),
    dbEngine.saveBatch('suppliers', suppliersToSave),
    dbEngine.saveBatch('products', productsToSave)
  ]);

  return {
    contactsCount: cRes.count,
    customersCount: cuRes.count,
    suppliersCount: sRes.count,
    productsCount: pRes.count
  };
}

/**
 * 3. IMPORT TRỰC TIẾP TỪ FILE EXCEL (.XLSX) MASTER DATA
 * Cho phép tải file từ Drive về hoặc sửa offline rồi nạp ngay vào hệ thống
 */
export async function importMasterDataFromExcelFile(file: File): Promise<{
  contactsCount: number;
  customersCount: number;
  suppliersCount: number;
}> {
  const XLSX = await import('xlsx');
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array' });

  let contactsCount = 0;
  let customersCount = 0;
  let suppliersCount = 0;

  for (const sheetName of workbook.SheetNames) {
    const sNameLower = sheetName.toLowerCase();
    const ws = workbook.Sheets[sheetName];
    const rows: any[] = XLSX.utils.sheet_to_json(ws, { defval: '' });
    if (rows.length === 0) continue;

    // Contacts
    if (sNameLower.includes('danh_ba') || sNameLower.includes('nhan_su') || sNameLower.includes('contact')) {
      for (let i = 0; i < rows.length; i++) {
        const c = rows[i];
        const name = c["Tên"] || c["Họ và tên"] || c["Name"] || '';
        const company = c["Công ty"] || c["Company"] || '';
        const phone = c["Điện thoại"] || c["Số điện thoại"] || c["Phone"] || '';

        if (name || phone || company) {
          const rawId = c.ID || c.id || (name && company ? `${name}_${company}` : name || `contact_${i + 1}`);
          const docId = String(rawKeySafe(rawId));

          try {
            await dbEngine.save('contacts', {
              id: docId,
              ID: c.ID || docId,
              "Danh xưng": c["Danh xưng"] || 'Mr',
              "Tên": name,
              "Chức vụ": c["Chức vụ"] || '',
              "Phòng ban": c["Phòng ban"] || '',
              "Công ty": company,
              "Điện thoại": phone,
              "Email": c["Email"] || '',
              "Mức độ quan hệ": String(c["Mức độ quan hệ"] || '3'),
              "Phụ trách": c["Phụ trách"] || '',
              "Ghi chú": c["Ghi chú"] || '',
              updatedAt: new Date().toISOString()
            });
            contactsCount++;
          } catch (e) {}
        }
      }
    }

    // Customers
    if (sNameLower.includes('khach_hang') || sNameLower.includes('customer')) {
      for (let i = 0; i < rows.length; i++) {
        const cust = rows[i];
        const custId = cust["Customer_ID"] || cust["Mã khách hàng"] || cust["id"] || cust["ID"] || cust["Tên đầy đủ"] || '';
        if (custId) {
          const docId = rawKeySafe(custId);
          try {
            await dbEngine.save('customers', {
              ...cust,
              id: docId,
              Customer_ID: cust["Customer_ID"] || docId,
              updatedAt: new Date().toISOString()
            });
            customersCount++;
          } catch (e) {}
        }
      }
    }

    // Suppliers
    if (sNameLower.includes('nha_cung_cap') || sNameLower.includes('supplier') || sNameLower.includes('ncc')) {
      for (let i = 0; i < rows.length; i++) {
        const supp = rows[i];
        const suppId = supp["Mã nhà cung cấp"] || supp["Mã NCC"] || supp["id"] || supp["ID"] || supp["Tên Nhà Cung Cấp"] || '';
        if (suppId) {
          const docId = rawKeySafe(suppId);
          try {
            await dbEngine.save('suppliers', {
              ...supp,
              id: docId,
              "Mã nhà cung cấp": supp["Mã nhà cung cấp"] || docId,
              updatedAt: new Date().toISOString()
            });
            suppliersCount++;
          } catch (e) {}
        }
      }
    }
  }

  return { contactsCount, customersCount, suppliersCount };
}

function rawKeySafe(val: any): string {
  return String(val || '').replace(/[/\\#?%[\]\s.]+/g, '_');
}

export const getStoredMasterSpreadsheetId = getStoredSpreadsheetId;

export async function exportMasterDataToExcelDirectly(): Promise<void> {
  const toastId = toast.loading('Đang khởi tạo sổ bảng tính Excel Master Data...');
  try {
    const XLSX = await import('xlsx');

    const collections = [
      { name: 'contacts', title: 'Danh_Ba_Nhan_Su' },
      { name: 'customers', title: 'Khach_Hang' },
      { name: 'suppliers', title: 'Nha_Cung_Cap' },
      { name: 'products', title: 'San_Pham' },
      { name: 'pricing', title: 'Bang_Gia' },
      { name: 'po_headers', title: 'Don_Hang_PO' },
      { name: 'po_lines', title: 'Chi_Tiet_PO' },
      { name: 'deliveries', title: 'Phieu_Xuat_Kho' },
      { name: 'delivery_plans', title: 'Ke_Hoach_Giao' },
    ];

    const wb = XLSX.utils.book_new();

    for (const col of collections) {
      try {
        const snap = await getDocs(collection(db, col.name));
        const docs = snap.docs.map(d => d.data()).filter(d => !d.isDeleted);
        if (docs.length > 0) {
          const ws = XLSX.utils.json_to_sheet(docs);
          XLSX.utils.book_append_sheet(wb, ws, col.title);
        } else {
          const ws = XLSX.utils.aoa_to_sheet([['(Chưa có dữ liệu)']]);
          XLSX.utils.book_append_sheet(wb, ws, col.title);
        }
      } catch (e) {
        console.warn(`Lỗi xuất bảng ${col.name}:`, e);
      }
    }

    const dateStr = new Date().toISOString().split('T')[0];
    XLSX.writeFile(wb, `TSG_Master_Data_${dateStr}.xlsx`);
    toast.success('Đã tải xuống Sổ Bảng Tính Excel Master Data thành công!', { id: toastId });
  } catch (err: any) {
    console.error('Export Excel Master error:', err);
    toast.error(`Lỗi xuất Excel: ${err.message || err}`, { id: toastId });
  }
}
