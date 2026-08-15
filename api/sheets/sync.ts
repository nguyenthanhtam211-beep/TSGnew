import { google } from 'googleapis';

function isGoogleAuthError(error: any): boolean {
  if (!error) return false;
  const code = error.code || error.status || error.response?.status;
  const msg = String(error.message || '').toLowerCase();
  return code === 401 || code === '401' || msg.includes('unauthorized') || msg.includes('invalid_token');
}

function formatDateToISO(dateStr: any): string {
  if (!dateStr || typeof dateStr !== 'string') return '';
  const trimmed = dateStr.trim();
  if (!trimmed) return '';

  const ddmmyyyy = trimmed.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (ddmmyyyy) {
    return `${ddmmyyyy[3]}-${ddmmyyyy[2].padStart(2, '0')}-${ddmmyyyy[1].padStart(2, '0')}`;
  }
  const yyyymmdd = trimmed.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$/);
  if (yyyymmdd) {
    return `${yyyymmdd[1]}-${yyyymmdd[2].padStart(2, '0')}-${yyyymmdd[3].padStart(2, '0')}`;
  }
  return trimmed;
}

function parseNum(val: any): number {
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  if (!val) return 0;
  const num = parseFloat(String(val).replace(/[^0-9.-]/g, ''));
  return isNaN(num) ? 0 : num;
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const authHeader = req.headers.authorization;
    let oauth2Client;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      oauth2Client = new google.auth.OAuth2();
      oauth2Client.setCredentials({ access_token: token });
    } else if (process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL && process.env.GOOGLE_PRIVATE_KEY) {
      const auth = new google.auth.GoogleAuth({
        credentials: {
          client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
          private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
        },
        scopes: ['https://www.googleapis.com/auth/spreadsheets', 'https://www.googleapis.com/auth/drive.file'],
      });
      oauth2Client = auth;
    } else {
      return res.status(401).json({ error: 'Missing Google Authorization Token or Service Account Config' });
    }

    const sheets = google.sheets({ version: 'v4', auth: oauth2Client });
    const { spreadsheetId, deliveries = [], poLines = [], customers = [] } = req.body || {};
    const syncedAt = new Date().toISOString();
    let targetSpreadsheetId = spreadsheetId;

    const sheetNames = ["Daily_Deliveries_LookerStudio", "Daily_Summary_Aggregated", "PO_Lines_LookerStudio", "Customers_Directory"];

    if (!targetSpreadsheetId) {
      const createRes = await sheets.spreadsheets.create({
        requestBody: {
          properties: { title: "Báo Cáo ERP Tâm Sen - Looker Studio & BigQuery Ready" },
          sheets: sheetNames.map(name => ({ properties: { title: name } }))
        }
      });
      targetSpreadsheetId = createRes.data.spreadsheetId;
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
          { range: "'PO_Lines_LookerStudio'!A1", values: [poHeader, ...poRows] },
          { range: "'Customers_Directory'!A1", values: [customerHeader, ...customerRows] }
        ]
      }
    });

    const spreadsheetUrl = `https://docs.google.com/spreadsheets/d/${targetSpreadsheetId}/edit`;
    const lookerStudioUrl = `https://lookerstudio.google.com/navigation/datasources/create?connectorId=googleSheets&spreadsheetId=${targetSpreadsheetId}`;

    return res.status(200).json({
      success: true,
      spreadsheetId: targetSpreadsheetId,
      spreadsheetUrl,
      lookerStudioUrl,
      summary: {
        deliveriesCount: deliveries.length,
        poLinesCount: poLines.length,
        customersCount: customers.length,
        syncedAt
      }
    });
  } catch (error: any) {
    console.error("Vercel Sheets sync error:", error);
    const statusCode = isGoogleAuthError(error) ? 401 : 500;
    return res.status(statusCode).json({ error: error.message || "Failed to sync to Google Sheets" });
  }
}
