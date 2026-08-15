/**
 * TSG Business ERP - Google Drive 2-Way Sync Engine & Master Data Storage
 * Quản lý Kho Dữ Liệu Đồng Bộ 2 Chiều với Google Drive & Google Sheets
 */

import { toast } from 'react-hot-toast';
import { db } from '../firebase';
import { collection, doc, writeBatch } from 'firebase/firestore';
import { getItemKey } from '../hooks/useFirestoreCollection';

export const MASTER_SHEET_TITLE = "[TSG ERP] Kho Dữ Liệu Doanh Nghiệp TSG (Master Data)";
const STORAGE_KEY_SPREADSHEET_ID = 'google_spreadsheet_id';

export function getStoredSpreadsheetId(): string {
  return localStorage.getItem(STORAGE_KEY_SPREADSHEET_ID) || '';
}

export function setStoredSpreadsheetId(id: string): void {
  if (id) {
    localStorage.setItem(STORAGE_KEY_SPREADSHEET_ID, id);
  }
}

export function getDriveFileUrl(spreadsheetId?: string): string {
  const id = spreadsheetId || getStoredSpreadsheetId();
  if (!id) return 'https://drive.google.com/';
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
 * 1. PUSH (ERP ➔ Google Drive): Tạo hoặc cập nhật toàn bộ Master Spreadsheet trên Google Drive
 */
export async function pushMasterDataToDrive(token: string, data: DriveSyncPayload): Promise<{ spreadsheetId: string; url: string }> {
  if (!token) {
    throw new Error("Chưa có mã token xác thực Google.");
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
      data: toSheetMatrix(data.contacts, ["ID", "Danh xưng", "Tên", "Chức vụ", "Phòng ban", "Công ty", "Điện thoại", "Email", "Mức độ quan hệ", "Phụ trách"])
    },
    {
      title: "Khach_Hang",
      data: toSheetMatrix(data.customers, ["Customer_ID", "Tên đầy đủ", "Loại hình", "Phân loại", "Mã số thuế", "Số điện thoại", "Email", "Địa chỉ", "Nhà máy", "Hạn thanh toán", "Hạn mức nợ", "Tài khoản ngân hàng", "Tình trạng"])
    },
    {
      title: "Nha_Cung_Cap",
      data: toSheetMatrix(data.suppliers, ["Mã nhà cung cấp", "Tên Nhà Cung Cấp", "Nhóm hàng", "Loại hình", "Đánh giá", "Mã số thuế", "Số điện thoại", "Email", "Địa chỉ", "Điều khoản thanh toán", "Tài khoản ngân hàng", "Tình trạng"])
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
    const createRes = await fetch("https://sheets.googleapis.com/v4/spreadsheets", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json"
      },
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
    });

    if (!createRes.ok) {
      const err = await createRes.json();
      throw new Error(err.error?.message || "Không thể tạo file trên Google Drive.");
    }

    const created = await createRes.json();
    targetId = created.spreadsheetId;
    setStoredSpreadsheetId(targetId);
  } else {
    // Update existing spreadsheet on Drive
    for (const sheet of sheetsToSync) {
      try {
        await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${targetId}/values/'${sheet.title}'!A1?valueInputOption=USER_ENTERED`, {
          method: "PUT",
          headers: {
            "Authorization": `Bearer ${token}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            range: `'${sheet.title}'!A1`,
            majorDimension: "ROWS",
            values: sheet.data
          })
        });
      } catch (e) {
        console.warn(`Lỗi cập nhật sheet ${sheet.title}:`, e);
      }
    }
  }

  const url = getDriveFileUrl(targetId);
  return { spreadsheetId: targetId, url };
}

/**
 * 2. PULL (Google Drive ➔ ERP): Đọc trực tiếp từ Google Sheets trên Drive và cập nhật Firestore
 */
export async function pullMasterDataFromDrive(token: string, spreadsheetId?: string): Promise<{
  contactsCount: number;
  customersCount: number;
  suppliersCount: number;
}> {
  const id = spreadsheetId || getStoredSpreadsheetId();
  if (!id) {
    throw new Error("Chưa tìm thấy ID bảng tính trên Google Drive. Vui lòng thực hiện 'Đẩy lên Drive' lần đầu trước.");
  }

  if (!token) {
    throw new Error("Chưa có mã token xác thực Google.");
  }

  let contactsCount = 0;
  let customersCount = 0;
  let suppliersCount = 0;

  // Helper to read a tab and convert to Array of Objects
  const readSheet = async (tabName: string): Promise<any[]> => {
    try {
      const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${id}/values/'${tabName}'!A1:Z500`, {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (!res.ok) return [];
      const json = await res.json();
      const rows: string[][] = json.values || [];
      if (rows.length < 2) return [];

      const headers = rows[0].map(h => String(h).trim());
      const dataRows = rows.slice(1);

      return dataRows
        .filter(r => r.some(cell => String(cell).trim() !== ''))
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
      console.warn(`Không thể đọc tab ${tabName}:`, e);
      return [];
    }
  };

  // 1. Pull Contacts
  const rawContacts = await readSheet('Danh_Ba_Nhan_Su');
  if (rawContacts.length > 0) {
    let batch = writeBatch(db);
    let count = 0;
    for (const c of rawContacts) {
      if (c["Tên"] && c["Công ty"]) {
        const targetId = c.id || c.ID || getItemKey(c, 'contacts');
        const docId = String(targetId).replace(/[/\\#?%[\]\s.]+/g, '_');
        const docRef = doc(db, 'contacts', docId);
        batch.set(docRef, { ...c, id: docId, ID: c.ID || docId, updatedAt: new Date().toISOString() }, { merge: true });
        count++;
        contactsCount++;
        if (count >= 400) {
          await batch.commit();
          batch = writeBatch(db);
          count = 0;
        }
      }
    }
    if (count > 0) await batch.commit();
  }

  // 2. Pull Customers
  const rawCustomers = await readSheet('Khach_Hang');
  if (rawCustomers.length > 0) {
    let batch = writeBatch(db);
    let count = 0;
    for (const cust of rawCustomers) {
      if (cust["Customer_ID"] || cust["Tên đầy đủ"]) {
        const targetId = cust.Customer_ID || cust.id || getItemKey(cust, 'customers');
        const docId = String(targetId).replace(/[/\\#?%[\]\s.]+/g, '_');
        const docRef = doc(db, 'customers', docId);
        batch.set(docRef, { ...cust, id: docId, Customer_ID: cust.Customer_ID || docId, updatedAt: new Date().toISOString() }, { merge: true });
        count++;
        customersCount++;
        if (count >= 400) {
          await batch.commit();
          batch = writeBatch(db);
          count = 0;
        }
      }
    }
    if (count > 0) await batch.commit();
  }

  // 3. Pull Suppliers
  const rawSuppliers = await readSheet('Nha_Cung_Cap');
  if (rawSuppliers.length > 0) {
    let batch = writeBatch(db);
    let count = 0;
    for (const supp of rawSuppliers) {
      if (supp["Mã nhà cung cấp"] || supp["Tên Nhà Cung Cấp"]) {
        const targetId = supp["Mã nhà cung cấp"] || supp.id || getItemKey(supp, 'suppliers');
        const docId = String(targetId).replace(/[/\\#?%[\]\s.]+/g, '_');
        const docRef = doc(db, 'suppliers', docId);
        batch.set(docRef, { ...supp, id: docId, "Mã nhà cung cấp": supp["Mã nhà cung cấp"] || docId, updatedAt: new Date().toISOString() }, { merge: true });
        count++;
        suppliersCount++;
        if (count >= 400) {
          await batch.commit();
          batch = writeBatch(db);
          count = 0;
        }
      }
    }
    if (count > 0) await batch.commit();
  }

  return { contactsCount, customersCount, suppliersCount };
}
