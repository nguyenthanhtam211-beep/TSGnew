import { google } from 'googleapis';

export default async function handler(req: any, res: any) {
  if (req.method !== 'GET') {
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
        scopes: ['https://www.googleapis.com/auth/spreadsheets'],
      });
      oauth2Client = auth;
    } else {
      return res.status(401).json({ error: 'Missing Authorization header' });
    }

    const sheets = google.sheets({ version: 'v4', auth: oauth2Client });
    const { spreadsheetId } = req.query;

    if (!spreadsheetId) {
      return res.status(400).json({ error: 'Thiếu spreadsheetId' });
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

    return res.status(200).json({
      success: true,
      count: importedCustomers.length,
      customers: importedCustomers,
    });
  } catch (error: any) {
    console.error("Vercel import customers error:", error);
    return res.status(500).json({ error: error.message || "Không thể đọc dữ liệu từ Google Sheets" });
  }
}
