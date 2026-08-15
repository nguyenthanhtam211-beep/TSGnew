import { Router } from "express";
import multer from "multer";
import { google } from "googleapis";
import { Readable } from "stream";

export const googleRouter = Router();

const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 30 * 1024 * 1024 }
});

async function getOrCreateFolder(drive: any, name: string, parentId?: string) {
  const q = `name = '${name.replace(/'/g, "\\'")}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false${parentId ? ` and '${parentId}' in parents` : ""}`;
  const response = await drive.files.list({ q, fields: "files(id, name)" });
  if (response.data.files && response.data.files.length > 0) {
    return response.data.files[0].id;
  }
  const folderMetadata: any = {
    name: name,
    mimeType: "application/vnd.google-apps.folder"
  };
  if (parentId) {
    folderMetadata.parents = [parentId];
  }
  const folder = await drive.files.create({
    requestBody: folderMetadata,
    fields: "id"
  });
  return folder.data.id;
}

function isGoogleAuthError(error: any): boolean {
  if (!error) return false;
  const code = error.code || error.status || error.response?.status;
  const msg = String(error.message || '').toLowerCase();
  const is401 = code === 401 || code === '401';
  const isInvalidCreds = 
    msg.includes('invalid credentials') ||
    msg.includes('invalid authentication credentials') ||
    msg.includes('invalid_token') ||
    msg.includes('unauthorized') ||
    msg.includes('expected oauth 2 access token') ||
    msg.includes('login cookie');
  return is401 || isInvalidCreds;
}

function formatDateToISO(dateStr: any): string {
  if (!dateStr || typeof dateStr !== 'string') return '';
  const trimmed = dateStr.trim();
  if (!trimmed) return '';
  
  const ddmmyyyy = trimmed.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (ddmmyyyy) {
    const day = ddmmyyyy[1].padStart(2, '0');
    const month = ddmmyyyy[2].padStart(2, '0');
    const year = ddmmyyyy[3];
    return `${year}-${month}-${day}`;
  }

  const yyyymmdd = trimmed.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$/);
  if (yyyymmdd) {
    const year = yyyymmdd[1];
    const month = yyyymmdd[2].padStart(2, '0');
    const day = yyyymmdd[3].padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  return trimmed;
}

function parseNum(val: any): number {
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  if (!val) return 0;
  const str = String(val).replace(/[^0-9.-]/g, '');
  const num = parseFloat(str);
  return isNaN(num) ? 0 : num;
}

// Drive Upload
googleRouter.post("/drive/upload", upload.single("file"), async (req: any, res: any) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ error: "Missing authorization header" });
    }

    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const token = authHeader.split(" ")[1];
    if (!token) {
      return res.status(401).json({ error: "Missing authorization token" });
    }

    const oauth2Client = new google.auth.OAuth2();
    oauth2Client.setCredentials({ access_token: token });

    const drive = google.drive({ version: "v3", auth: oauth2Client });
    
    const { fileName, documentType, year, month } = req.body;
    
    const rootFolderId = await getOrCreateFolder(drive, "TSG_Business_Documents");
    const yearFolderId = await getOrCreateFolder(drive, year || new Date().getFullYear().toString(), rootFolderId);
    const typeFolderId = await getOrCreateFolder(drive, documentType || "Others", yearFolderId);
    const monthFolderId = await getOrCreateFolder(drive, month || (new Date().getMonth() + 1).toString().padStart(2, '0'), typeFolderId);
    
    const fileMetadata = {
      name: fileName || req.file.originalname,
      parents: [monthFolderId]
    };
    
    const media = {
      mimeType: req.file.mimetype || "application/octet-stream",
      body: Readable.from(req.file.buffer),
    };
    
    const file = await drive.files.create({
      requestBody: fileMetadata,
      media: media,
      fields: "id, webViewLink, webContentLink",
    });

    res.json({ 
      driveFileId: file.data.id, 
      driveLink: file.data.webViewLink,
      downloadLink: file.data.webContentLink
    });
  } catch (error: any) {
    console.error("Drive upload error:", error);
    const statusCode = isGoogleAuthError(error) ? 401 : 500;
    res.status(statusCode).json({ error: error.message || "Failed to upload to Drive" });
  }
});

// Drive List
googleRouter.get("/drive/files", async (req: any, res: any) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: "Missing auth" });

    const token = authHeader.split(" ")[1];
    const oauth2Client = new google.auth.OAuth2();
    oauth2Client.setCredentials({ access_token: token });
    const drive = google.drive({ version: "v3", auth: oauth2Client });

    const response = await drive.files.list({
      pageSize: 50,
      fields: "nextPageToken, files(id, name, mimeType, webViewLink, createdTime)",
      orderBy: "createdTime desc"
    });
    res.json(response.data.files);
  } catch (error: any) {
    const statusCode = isGoogleAuthError(error) ? 401 : 500;
    res.status(statusCode).json({ error: error.message });
  }
});

// Calendar Event
googleRouter.post("/calendar/events", async (req: any, res: any) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ error: "Missing authorization header" });
    }

    const token = authHeader.split(" ")[1];
    const oauth2Client = new google.auth.OAuth2();
    oauth2Client.setCredentials({ access_token: token });

    const calendar = google.calendar({ version: "v3", auth: oauth2Client });
    
    const { summary, description, start, end, location } = req.body;
    
    const event = {
      summary,
      description,
      location,
      start: {
        dateTime: start,
        timeZone: 'Asia/Ho_Chi_Minh',
      },
      end: {
        dateTime: end,
        timeZone: 'Asia/Ho_Chi_Minh',
      },
    };

    const result = await calendar.events.insert({
      calendarId: 'primary',
      requestBody: event,
    });

    res.json(result.data);
  } catch (error: any) {
    console.error("Calendar event error:", error);
    const statusCode = isGoogleAuthError(error) ? 401 : 500;
    res.status(statusCode).json({ error: error.message || "Failed to create calendar event" });
  }
});

// Sheets Sync
googleRouter.post("/sheets/sync", async (req: any, res: any) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ error: "Missing authorization header" });
    }

    const token = authHeader.split(" ")[1];
    const oauth2Client = new google.auth.OAuth2();
    oauth2Client.setCredentials({ access_token: token });

    const sheets = google.sheets({ version: "v4", auth: oauth2Client });
    
    const { spreadsheetId, deliveries = [], poLines = [], poHeaders = [], customers = [] } = req.body;
    const syncedAt = new Date().toISOString();

    let targetSpreadsheetId = spreadsheetId;

    const sheetNames = ["Daily_Deliveries_LookerStudio", "Daily_Summary_Aggregated", "PO_Lines_LookerStudio", "Customers_Directory"];

    if (!targetSpreadsheetId) {
      const createRes = await sheets.spreadsheets.create({
        requestBody: {
          properties: {
            title: "Báo Cáo ERP Tâm Sen - Looker Studio & BigQuery Ready",
          },
          sheets: sheetNames.map(name => ({ properties: { title: name } }))
        }
      });
      targetSpreadsheetId = createRes.data.spreadsheetId;
    } else {
      try {
        const sheetInfo = await sheets.spreadsheets.get({ spreadsheetId: targetSpreadsheetId });
        const existingTitles = sheetInfo.data.sheets?.map(s => s.properties?.title) || [];
        const missingTitles = sheetNames.filter(name => !existingTitles.includes(name));

        if (missingTitles.length > 0) {
          await sheets.spreadsheets.batchUpdate({
            spreadsheetId: targetSpreadsheetId,
            requestBody: {
              requests: missingTitles.map(title => ({
                addSheet: { properties: { title } }
              }))
            }
          });
        }
      } catch (e: any) {
        console.warn("Could not check/add sheets in existing spreadsheet:", e.message);
      }
    }

    const deliveryHeader = [
      "delivery_date", "delivery_month", "delivery_year", "pxk_number", "po_number", "stt",
      "customer_name", "supplier_name", "product_code", "product_name", "unit", "quantity_delivered",
      "quantity_ordered", "unit_buy_price", "unit_sell_price", "revenue", "cogs", "profit",
      "margin_pct", "status", "synced_at"
    ];

    const deliveryRows = deliveries.map((d: any) => {
      const rawDate = d["Ngày giao"] || d["Ngày"] || d["createdAt"] || "";
      const isoDate = formatDateToISO(rawDate);
      const [y, m] = isoDate ? isoDate.split("-") : ["", ""];

      const qtyDelivered = parseNum(d["Số lượng giao"] || d["Số lượng"] || 0);
      const qtyOrdered = parseNum(d["Số lượng đặt"] || d["Số lượng PO"] || 0);
      const buyPrice = parseNum(d["Đơn giá nhập"] || 0);
      const sellPrice = parseNum(d["Đơn giá bán"] || 0);

      const revenue = parseNum(d["Doanh thu"]) || (sellPrice * qtyDelivered);
      const cogs = buyPrice * qtyDelivered;
      const profit = parseNum(d["Lợi nhuận"]) || (revenue - cogs);
      const marginPct = revenue > 0 ? Number(((profit / revenue) * 100).toFixed(2)) : 0;

      return [
        isoDate, m ? parseInt(m) : "", y ? parseInt(y) : "", d["Số PXK"] || "",
        d["Đơn hàng"] || d["Số PO"] || "", d["STT"] || "", d["Khách hàng"] || "",
        d["Nhà cung cấp"] || "", d["Mã sản phẩm"] || "", d["Tên sản phẩm"] || "",
        d["ĐVT"] || "Cái", qtyDelivered, qtyOrdered, buyPrice, sellPrice, revenue,
        cogs, profit, marginPct, d["Status"] || d["Trạng thái"] || "Hoàn thành", syncedAt
      ];
    });

    const summaryByDate = new Map<string, { count: number; qty: number; rev: number; cogs: number; profit: number }>();
    
    deliveries.forEach((d: any) => {
      const rawDate = d["Ngày giao"] || d["Ngày"] || d["createdAt"] || "";
      const isoDate = formatDateToISO(rawDate) || "Không xác định";

      const qtyDelivered = parseNum(d["Số lượng giao"] || d["Số lượng"] || 0);
      const buyPrice = parseNum(d["Đơn giá nhập"] || 0);
      const sellPrice = parseNum(d["Đơn giá bán"] || 0);

      const rev = parseNum(d["Doanh thu"]) || (sellPrice * qtyDelivered);
      const cost = buyPrice * qtyDelivered;
      const prof = parseNum(d["Lợi nhuận"]) || (rev - cost);

      const current = summaryByDate.get(isoDate) || { count: 0, qty: 0, rev: 0, cogs: 0, profit: 0 };
      current.count += 1;
      current.qty += qtyDelivered;
      current.rev += rev;
      current.cogs += cost;
      current.profit += prof;
      summaryByDate.set(isoDate, current);
    });

    const summaryHeader = [
      "report_date", "total_deliveries_count", "total_units_delivered", "total_revenue",
      "total_cogs", "total_profit", "average_margin_pct", "synced_at"
    ];

    const sortedDates = Array.from(summaryByDate.keys()).sort();
    const summaryRows = sortedDates.map(dateKey => {
      const s = summaryByDate.get(dateKey)!;
      const margin = s.rev > 0 ? Number(((s.profit / s.rev) * 100).toFixed(2)) : 0;
      return [
        dateKey, s.count, s.qty, s.rev, s.cogs, s.profit, margin, syncedAt
      ];
    });

    const poHeader = [
      "po_number", "customer_name", "supplier_name", "product_code", "product_name",
      "order_date", "delivery_deadline", "quantity_ordered", "quantity_delivered",
      "quantity_remaining", "unit_buy_price", "unit_sell_price", "total_po_value",
      "completion_pct", "po_status", "synced_at"
    ];

    const poRows = poLines.map((po: any) => {
      const orderDate = formatDateToISO(po["Ngày đặt"] || po["Ngày đơn hàng"] || po["Ngày PO"] || "");
      const deadline = formatDateToISO(po["Hạn giao hàng"] || po["Thời gian giao"] || "");

      const qtyOrdered = parseNum(po["Số lượng"] || po["Số lượng PO"] || 0);
      const qtyDelivered = parseNum(po["Đã giao"] || po["Số lượng đã giao"] || 0);
      const qtyRemaining = parseNum(po["Còn lại"] || Math.max(0, qtyOrdered - qtyDelivered));

      const buyPrice = parseNum(po["Đơn giá nhập"] || 0);
      const sellPrice = parseNum(po["Đơn giá bán"] || 0);
      const poValue = parseNum(po["Thành tiền bán"]) || (sellPrice * qtyOrdered);
      const pct = qtyOrdered > 0 ? Number(((qtyDelivered / qtyOrdered) * 100).toFixed(2)) : 0;

      return [
        po["Đơn hàng"] || po["Số PO"] || po["Số đơn hàng"] || "",
        po["Khách hàng"] || "", po["Nhà cung cấp"] || "",
        po["Mã sản phẩm"] || po["Mã của khách"] || "", po["Tên sản phẩm"] || "",
        orderDate, deadline, qtyOrdered, qtyDelivered, qtyRemaining,
        buyPrice, sellPrice, poValue, pct,
        po["Trạng thái"] || po["Status"] || "Đang tiến hành", syncedAt
      ];
    });

    const customerHeader = [
      "customer_id", "customer_name", "category", "status", "address",
      "factory_address", "phone", "tax_code", "logo_url", "linked_contacts", "synced_at"
    ];

    const customerRows = customers.map((c: any) => [
      c["Customer_ID"] || c.id || c.code || "",
      c["Tên đầy đủ"] || c.name || "",
      c["Phân loại"] || c.category || "",
      c["Tình trạng"] || c.status || "Đang mua",
      c["Địa chỉ"] || c.address || "",
      c["Nhà máy"] || c.factory || "",
      c["Số điện thoại"] || c.phone || "",
      c["Mã số thuế"] || c.taxCode || "",
      c.logoUrl || c.LogoUrl || "",
      c["Liên hệ liên kết"] || "",
      syncedAt
    ]);

    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId: targetSpreadsheetId,
      requestBody: {
        valueInputOption: "USER_ENTERED",
        data: [
          { range: "'Daily_Deliveries_LookerStudio'!A1", values: [deliveryHeader, ...deliveryRows] },
          { range: "'Daily_Summary_Aggregated'!A1", values: [summaryHeader, ...summaryRows] },
          { range: "'PO_Lines_LookerStudio'!A1", values: [poHeader, ...poRows] },
          { range: "'Customers_Directory'!A1", values: [customerHeader, ...customerRows] }
        ]
      }
    });

    const spreadsheetUrl = `https://docs.google.com/spreadsheets/d/${targetSpreadsheetId}/edit`;
    const lookerStudioUrl = `https://lookerstudio.google.com/navigation/datasources/create?connectorId=googleSheets&spreadsheetId=${targetSpreadsheetId}`;

    res.json({
      success: true,
      spreadsheetId: targetSpreadsheetId,
      spreadsheetUrl,
      lookerStudioUrl,
      summary: {
        deliveriesCount: deliveries.length,
        dailySummariesCount: summaryRows.length,
        poLinesCount: poLines.length,
        customersCount: customers.length,
        syncedAt
      }
    });
  } catch (error: any) {
    console.error("Sheets sync error:", error);
    const statusCode = isGoogleAuthError(error) ? 401 : 500;
    res.status(statusCode).json({ error: error.message || "Failed to sync data to Google Sheets" });
  }
});

// GET /api/sheets/import-customers - Import Customers from Google Sheet
googleRouter.get("/sheets/import-customers", async (req: any, res: any) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ error: "Missing authorization header" });
    }

    const token = authHeader.split(" ")[1];
    const oauth2Client = new google.auth.OAuth2();
    oauth2Client.setCredentials({ access_token: token });

    const sheets = google.sheets({ version: "v4", auth: oauth2Client });
    const { spreadsheetId } = req.query;

    if (!spreadsheetId) {
      return res.status(400).json({ error: "Thiếu spreadsheetId" });
    }

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: String(spreadsheetId),
      range: "'Customers_Directory'!A2:K1000",
    });

    const rows = response.data.values || [];
    const importedCustomers = rows
      .filter((r: any) => r[0] && r[1])
      .map((r: any) => ({
        Customer_ID: String(r[0]).trim(),
        "Tên đầy đủ": String(r[1]).trim(),
        "Phân loại": r[2] ? String(r[2]).trim() : "",
        "Tình trạng": r[3] ? String(r[3]).trim() : "Đang mua",
        "Địa chỉ": r[4] ? String(r[4]).trim() : "",
        "Nhà máy": r[5] ? String(r[5]).trim() : "",
        "Số điện thoại": r[6] ? String(r[6]).trim() : "",
        "Mã số thuế": r[7] ? String(r[7]).trim() : "",
        logoUrl: r[8] ? String(r[8]).trim() : "",
        "Liên hệ liên kết": r[9] ? String(r[9]).trim() : "",
        updatedAt: new Date().toISOString(),
      }));

    res.json({
      success: true,
      count: importedCustomers.length,
      customers: importedCustomers,
    });
  } catch (error: any) {
    console.error("Sheets import customers error:", error);
    const statusCode = isGoogleAuthError(error) ? 401 : 500;
    res.status(statusCode).json({ error: error.message || "Không thể đọc dữ liệu từ Google Sheets" });
  }
});

// POST /api/drive/sync-customers - Backup Customer Directory JSON to Google Drive
googleRouter.post("/drive/sync-customers", async (req: any, res: any) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ error: "Missing authorization header" });
    }

    const token = authHeader.split(" ")[1];
    const oauth2Client = new google.auth.OAuth2();
    oauth2Client.setCredentials({ access_token: token });

    const drive = google.drive({ version: "v3", auth: oauth2Client });
    const { customers = [] } = req.body;

    const rootFolderId = await getOrCreateFolder(drive, "TSG_Business_Documents");
    const customerFolderId = await getOrCreateFolder(drive, "Customers", rootFolderId);

    const jsonContent = JSON.stringify(customers, null, 2);
    const fileName = `TSG_Customers_Directory_${new Date().toISOString().slice(0, 10)}.json`;

    const fileMetadata = {
      name: fileName,
      parents: [customerFolderId],
    };

    const media = {
      mimeType: "application/json",
      body: Readable.from([jsonContent]),
    };

    const file = await drive.files.create({
      requestBody: fileMetadata,
      media: media,
      fields: "id, webViewLink, webContentLink",
    });

    res.json({
      success: true,
      driveFileId: file.data.id,
      driveLink: file.data.webViewLink,
      count: customers.length,
    });
  } catch (error: any) {
    console.error("Drive sync customers error:", error);
    const statusCode = isGoogleAuthError(error) ? 401 : 500;
    res.status(statusCode).json({ error: error.message || "Failed to sync customers to Drive" });
  }
});

