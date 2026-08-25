export const config = {
  api: {
    bodyParser: {
      sizeLimit: '30mb',
    },
  },
};

async function getRequestBody(req: any): Promise<any> {
  if (req.body) {
    if (typeof req.body === 'object' && !Buffer.isBuffer(req.body)) {
      return req.body;
    }
    if (typeof req.body === 'string') {
      try {
        return JSON.parse(req.body);
      } catch (_) {
        return req.body;
      }
    }
    if (Buffer.isBuffer(req.body)) {
      try {
        return JSON.parse(req.body.toString('utf-8'));
      } catch (_) {
        return req.body.toString('utf-8');
      }
    }
  }

  // If req.body is undefined, read stream manually
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk: any) => {
      data += chunk;
    });
    req.on('end', () => {
      if (!data) {
        resolve({});
        return;
      }
      try {
        const parsed = JSON.parse(data);
        resolve(parsed);
      } catch (_) {
        resolve(data);
      }
    });
    req.on('error', (err: any) => {
      reject(err);
    });
  });
}

export default async function handler(req: any, res: any) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization, x-gemini-key'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Chỉ chấp nhận phương thức POST' });
  }

  try {
    const body = await getRequestBody(req);

    let base64Data = '';
    let mimeType = 'image/jpeg';
    let customPrompt = body?.prompt || '';

    if (body?.base64) {
      base64Data = body.base64;
      mimeType = body.mimeType || 'image/jpeg';
    } else if (body?.data) {
      base64Data = body.data;
      mimeType = body.mimeType || 'image/jpeg';
    } else if (body?.image) {
      base64Data = body.image;
      mimeType = body.mimeType || 'image/jpeg';
    } else if (typeof body === 'string') {
      try {
        const parsed = JSON.parse(body);
        base64Data = parsed.base64 || parsed.data || parsed.image || '';
        mimeType = parsed.mimeType || 'image/jpeg';
        customPrompt = parsed.prompt || customPrompt;
      } catch (_) {}
    }

    if (!base64Data) {
      return res.status(400).json({ error: 'Không tìm thấy dữ liệu tệp tin base64 để xử lý OCR.' });
    }

    // Clean base64 if it has data URL prefix (e.g. data:image/png;base64,...)
    if (base64Data.includes(',')) {
      const parts = base64Data.split(',');
      base64Data = parts[1];
      const match = parts[0].match(/:(.*?);/);
      if (match) {
        mimeType = match[1];
      }
    }

    const apiKey = (req.headers['x-gemini-key'] as string) || 
                   body?.apiKey || 
                   process.env.GEMINI_API_KEY || 
                   process.env.VITE_GEMINI_API_KEY || 
                   process.env.GOOGLE_API_KEY ||
                   '';

    if (!apiKey) {
      return res.status(400).json({ 
        error: 'Chưa cấu hình GEMINI_API_KEY. Vui lòng nhập Gemini API Key trong tab Cài đặt & Quản lý dữ liệu.' 
      });
    }

    const defaultPrompt = `Bạn là một chuyên gia OCR tài liệu doanh nghiệp hàng đầu của Tập đoàn Tâm Sen (TSG). Hãy phân tích kỹ lưỡng tài liệu đính kèm (hình ảnh hoặc PDF) và trích xuất thông tin chính xác.

ĐẶC BIỆT LƯU Ý VỀ SỐ ĐƠN HÀNG (PO):
1. Nếu là "BIÊN BẢN GIAO HÀNG" hoặc "PHIẾU XUẤT KHO" (PXK): 
   - Số hiệu ở góc trên bên phải là "documentNumber" (Số PXK).
   - BẮT BUỘC tìm số ĐƠN ĐẶT HÀNG (Số PO) nằm trong văn bản (ví dụ: "Theo đơn đặt hàng số...", "Căn cứ PO số...", "06/TS/26", v.v.) và điền vào trường "documentReference".
2. Nếu là "ĐƠN ĐẶT HÀNG": Số đơn hàng là "documentNumber", trường "documentReference" để trống.

QUAN TRỌNG VỀ THUẾ & MÃ SỐ THUẾ (Tax & VAT):
- buyerTaxCode: Mã số thuế bên mua / khách hàng
- sellerTaxCode: Mã số thuế bên bán / nhà cung cấp
- vatRate: Thuế suất VAT (% hoặc số, ví dụ "8%", "10%", 0, 8, 10)
- vatAmount: Tiền thuế GTGT / VAT bằng số
- totalAmountWithVat: Tổng cộng tiền thanh toán đã bao gồm thuế VAT

QUAN TRỌNG VỀ BẢNG KÊ SẢN PHẨM / HÀNG HÓA (items):
1. BẮT BUỘC đọc tất cả các cột trong bảng kê hàng hóa (Tên hàng hóa, Quy cách, Ký hiệu, Mã vật tư, ĐVT, Số lượng, Đơn giá, Thành tiền).
2. Tên sản phẩm (name): Điền tên sản phẩm ĐẦY ĐỦ NGUYÊN VĂN bao gồm chủng loại, nhãn hiệu, thông số kỹ thuật.
3. Mã sản phẩm (code): Trích xuất mã sản phẩm, ký hiệu mã vật tư nếu có.
4. Quy cách (specs): Kích thước, định lượng (gsm), quy cách đóng gói.
5. Số lượng (quantity), Đơn giá (price), Thành tiền (amount), ĐVT (unit).

Hãy xuất kết quả chính xác theo định dạng JSON với cấu trúc:
{
  "documentType": "PO" | "PXK" | "Invoice" | "Unknown",
  "documentTypeName": "Phiếu xuất kho" | "Đơn đặt hàng" | "Biên bản giao hàng" | "Hóa đơn giá trị gia tăng",
  "documentNumber": string,
  "documentReference": string,
  "documentDate": "DD/MM/YYYY",
  "deliveryDate": "DD/MM/YYYY",
  "buyerName": string,
  "buyerTaxCode": string,
  "buyerAddress": string,
  "sellerName": string,
  "sellerTaxCode": string,
  "sellerAddress": string,
  "vatRate": string | number,
  "vatAmount": number,
  "totalAmountWithVat": number,
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

    const prompt = customPrompt || defaultPrompt;

    const models = ["gemini-2.5-flash", "gemini-2.0-flash"];
    let lastError: any = null;

    for (const model of models) {
      try {
        const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  {
                    inline_data: {
                      mime_type: mimeType,
                      data: base64Data
                    }
                  },
                  { text: prompt }
                ]
              }
            ],
            generation_config: {
              response_mime_type: 'application/json',
              temperature: 0.1,
              max_output_tokens: 8192
            }
          })
        });

        if (response.ok) {
          const json = await response.json();
          const textRes = json.candidates?.[0]?.content?.parts?.[0]?.text;
          if (textRes) {
            const data = JSON.parse(textRes);
            return res.status(200).json(data);
          }
        } else {
          const errData = await response.json().catch(() => ({}));
          lastError = new Error(errData.error?.message || `HTTP ${response.status} from Google AI`);
        }
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
