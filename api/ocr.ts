import { GoogleGenAI, Type } from '@google/genai';

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '30mb',
    },
  },
};

export default async function handler(req: any, res: any) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Chỉ chấp nhận phương thức POST' });
  }

  try {
    let base64Data = '';
    let mimeType = 'image/jpeg';

    if (req.body?.base64) {
      base64Data = req.body.base64;
      mimeType = req.body.mimeType || 'image/jpeg';
    } else if (typeof req.body === 'string' && req.body.startsWith('{')) {
      try {
        const parsed = JSON.parse(req.body);
        base64Data = parsed.base64;
        mimeType = parsed.mimeType || 'image/jpeg';
      } catch (_) {}
    }

    if (!base64Data) {
      return res.status(400).json({ error: 'Không tìm thấy dữ liệu tệp tin base64 để xử lý OCR.' });
    }

    // Clean base64 if it has data URL prefix
    if (base64Data.includes(',')) {
      const parts = base64Data.split(',');
      base64Data = parts[1];
      const match = parts[0].match(/:(.*?);/);
      if (match) {
        mimeType = match[1];
      }
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(400).json({ 
        error: 'Chưa cấu hình GEMINI_API_KEY trên môi trường Vercel. Bạn cũng có thể nhập API Key trực tiếp trong tab Cài đặt.' 
      });
    }

    const ai = new GoogleGenAI({ apiKey });

    const filePart = {
      inlineData: {
        data: base64Data,
        mimeType: mimeType,
      },
    };

    const prompt = `Bạn là một chuyên gia OCR tài liệu doanh nghiệp hàng đầu của Tập đoàn Tâm Sen (TSG). Hãy phân tích kỹ lưỡng tài liệu đính kèm (hình ảnh hoặc PDF) và trích xuất thông tin chính xác.

ĐẶC BIỆT LƯU Ý VỀ SỐ ĐƠN HÀNG (PO):
1. Nếu là "BIÊN BẢN GIAO HÀNG" hoặc "PHIẾU XUẤT KHO" (PXK): 
   - Số hiệu ở góc trên bên phải là "documentNumber" (Số PXK).
   - BẮT BUỘC tìm số ĐƠN ĐẶT HÀNG (Số PO) nằm trong văn bản (ví dụ: "Theo đơn đặt hàng số...", "Căn cứ PO số...", "06/TS/26", v.v.) và điền vào trường "documentReference".
2. Nếu là "ĐƠN ĐẶT HÀNG": Số đơn hàng là "documentNumber", trường "documentReference" để trống.

QUAN TRỌNG VỀ BẢNG KÊ SẢN PHẨM / HÀNG HÓA (items):
1. BẮT BUỘC đọc tất cả các cột trong bảng kê hàng hóa (Tên hàng hóa, Quy cách, Ký hiệu, Mã vật tư, ĐVT, Số lượng, Đơn giá, Thành tiền).
2. Tên sản phẩm (name): Điền tên sản phẩm ĐẦY ĐỦ NGUYÊN VĂN bao gồm chủng loại, nhãn hiệu, thông số kỹ thuật.
3. Mã sản phẩm (code): Trích xuất mã sản phẩm, ký hiệu mã vật tư nếu có.
4. Quy cách (specs): Kích thước, định lượng (gsm), quy cách đóng gói.
5. Số lượng (quantity), Đơn giá (price), Thành tiền (amount), ĐVT (unit).

Hãy xuất kết quả chính xác theo định dạng JSON với cấu trúc:
{
  "documentType": "PO" | "PXK" | "Invoice" | "Unknown",
  "documentTypeName": "Phiếu xuất kho" | "Đơn đặt hàng" | "Biên bản giao hàng",
  "documentNumber": string,
  "documentReference": string,
  "documentDate": "DD/MM/YYYY",
  "deliveryDate": "DD/MM/YYYY",
  "buyerName": string,
  "buyerAddress": string,
  "sellerName": string,
  "sellerAddress": string,
  "items": [
    {
      "index": number,
      "code": string,
      "name": string,
      "specs": string,
      "unit": string,
      "quantity": number,
      "price": number,
      "amount": number,
      "notes": string
    }
  ]
}`;

    const models = ["gemini-2.5-flash", "gemini-2.0-flash"];
    let lastError: any = null;

    for (const model of models) {
      try {
        const response = await ai.models.generateContent({
          model,
          contents: [filePart, prompt],
          config: {
            responseMimeType: "application/json",
          },
        });

        const textRes = response.text;
        if (!textRes) continue;

        const data = JSON.parse(textRes);
        return res.status(200).json(data);
      } catch (err: any) {
        lastError = err;
        console.warn(`OCR model ${model} failed, trying next...`, err.message);
      }
    }

    throw lastError || new Error("Không thể xử lý trích xuất văn bản từ chứng từ.");
  } catch (error: any) {
    console.error("Vercel OCR error:", error);
    return res.status(500).json({ error: error.message || "Lỗi xử lý OCR tài liệu" });
  }
}
