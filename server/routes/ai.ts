import { Router } from "express";
import { GoogleGenAI, Type } from "@google/genai";
import multer from "multer";

export const aiRouter = Router();

const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 30 * 1024 * 1024 } // 30MB limit
});

let aiClient: GoogleGenAI | null = null;
function getGenAI(): GoogleGenAI {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("Khóa GEMINI_API_KEY chưa được cấu hình trên máy chủ.");
    }
    aiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
  }
  return aiClient;
}

async function generateContentWithRetry(params: any, retries = 2, delay = 500) {
  const ai = getGenAI();
  const modelFallbackList = ["gemini-3.6-flash", "gemini-2.5-flash", "gemini-2.5-pro"];
  const requestedModel = params.model && params.model !== "gemini-3.5-flash" ? params.model : "gemini-3.6-flash";
  const modelsToTry = Array.from(new Set([requestedModel, ...modelFallbackList]));

  let lastError: any = null;
  for (const modelName of modelsToTry) {
    for (let i = 0; i < retries; i++) {
      try {
        console.log(`Calling Gemini with model: ${modelName} (attempt ${i + 1}/${retries})...`);
        const result = await ai.models.generateContent({
          model: modelName,
          contents: params.contents,
          config: {
            ...params.config,
            systemInstruction: params.config?.systemInstruction
          }
        });
        return result;
      } catch (error: any) {
        lastError = error;
        const errorStr = String(error.message || error);
        console.error(`Error with model ${modelName} (attempt ${i + 1}/${retries}):`, errorStr);
        
        const isTransient = errorStr.includes("503") || 
                            errorStr.includes("UNAVAILABLE") || 
                            errorStr.includes("high demand") ||
                            errorStr.includes("429");

        if (isTransient && i < retries - 1) {
          const waitTime = delay * (i + 1);
          console.warn(`Gemini API transient error. Retrying in ${waitTime}ms...`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
          continue;
        }
        break;
      }
    }
  }
  
  throw lastError || new Error("Không thể xử lý dữ liệu với mô hình AI. Vui lòng thử lại.");
}

// Chat endpoint
aiRouter.post("/chat", upload.array("files"), async (req: any, res: any) => {
  console.log("--- START /api/chat ---");
  try {
    const { messages, systemInstruction, model } = req.body;
    const parsedMessages = typeof messages === "string" ? JSON.parse(messages) : messages;
    
    const config: any = {
      systemInstruction: systemInstruction || "You are a helpful assistant.",
      temperature: 0.7,
    };

    const parts: any[] = [];
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        parts.push({
          inlineData: {
            mimeType: file.mimetype,
            data: file.buffer.toString("base64")
          }
        });
      }
    }
    
    const formattedMessages = (parsedMessages || []).map((m: any) => ({
      role: m.role === "assistant" ? "model" : m.role,
      parts: [{ text: m.content || "" }]
    }));

    if (parts.length > 0) {
      const lastUserMsg = [...formattedMessages].reverse().find(m => m.role === "user");
      if (lastUserMsg) {
        lastUserMsg.parts.push(...parts);
      } else {
        formattedMessages.push({ role: "user", parts });
      }
    }

    const cleanMessages: any[] = [];
    for (const msg of formattedMessages) {
      if (cleanMessages.length === 0) {
        if (msg.role === "user") cleanMessages.push(msg);
      } else {
        const lastMsg = cleanMessages[cleanMessages.length - 1];
        if (lastMsg.role === msg.role) {
          lastMsg.parts.push(...msg.parts);
        } else {
          cleanMessages.push(msg);
        }
      }
    }

    if (cleanMessages.length === 0) {
      return res.status(400).json({ error: "No valid messages found to send to the assistant" });
    }

    const response = await generateContentWithRetry({
      model: model && model !== "gemini-3.5-flash" ? model : "gemini-3.6-flash",
      contents: cleanMessages,
      config: config
    });

    let responseText = "";
    try {
      responseText = response.text || "";
    } catch (err) {
      console.error("Error accessing response.text:", err);
      responseText = response.candidates?.[0]?.content?.parts?.find((p: any) => p.text)?.text || "";
    }

    console.log("Chat response text length:", responseText.length);
    res.json({ text: responseText });
  } catch (error: any) {
    console.error("Chat API error:", error);
    res.status(500).json({ error: error.message || "Internal server error" });
  } finally {
    console.log("--- END /api/chat ---");
  }
});

// OCR endpoint
aiRouter.post("/ocr", upload.single("file"), async (req: any, res: any) => {
  console.log("--- START /api/ocr ---");
  try {
    if (!req.file) {
      console.error("OCR Error: No file uploaded");
      return res.status(400).json({ error: "No file uploaded" });
    }

    console.log(`OCR processing file: ${req.file.originalname} (${req.file.mimetype}, ${req.file.size} bytes)`);

    const filePart = {
      inlineData: {
        data: req.file.buffer.toString("base64"),
        mimeType: req.file.mimetype,
      },
    };

    const prompt = `Bạn là một chuyên gia OCR tài liệu doanh nghiệp hàng đầu của Tập đoàn Tâm Sen (TSG). Hãy phân tích kỹ lưỡng tài liệu đính kèm (hình ảnh hoặc PDF) và trích xuất thông tin chính xác.

ĐẶC BIỆT LƯU Ý VỀ SỐ ĐƠN HÀNG (PO):
1. Nếu là "BIÊN BẢN GIAO HÀNG" hoặc "PHIẾU XUẤT KHO" (PXK): 
   - Số hiệu ở góc trên bên phải là "documentNumber" (Số PXK).
   - BẮT BUỘC tìm số ĐƠN ĐẶT HÀNG (Số PO) nằm trong văn bản. Nó thường đi sau các cụm từ: "Theo đơn đặt hàng số...", "Căn cứ PO số...", "Hợp đồng số...", hoặc nằm trong bảng kê hàng hóa. 
   - Ví dụ: Nếu thấy "06/TS/26" đi kèm chữ "Đơn hàng" hoặc "PO", hãy điền nó vào trường "documentReference".
2. Nếu là "ĐƠN ĐẶT HÀNG": Số đơn hàng là "documentNumber", trường "documentReference" để trống.

QUAN TRỌNG VỀ BẢNG KÊ SẢN PHẨM / HÀNG HÓA (items):
1. BẮT BUỘC đọc tất cả các cột trong bảng kê hàng hóa (Tên hàng hóa, Quy cách, Ký hiệu, Mã vật tư, ĐVT, Số lượng, Đơn giá, Thành tiền).
2. Tên sản phẩm (name): Điền tên sản phẩm ĐẦY ĐỦ NGUYÊN VĂN bao gồm chủng loại, nhãn hiệu, thông số kỹ thuật (Ví dụ: "Lưỡi gà trắng 95mm x 800m x 230gsm", "Nhãn V5 (Red-XK)", "Thùng Laguna (Red-XK)", "Thùng C48 5 lớp 1070x350x541", "Bao bì Cây Thuốc Bắc Sơn", "Thùng carton Bao cứng Thăng Long").
3. Mã sản phẩm (code): Trích xuất mã sản phẩm, ký hiệu mã vật tư hoặc mã hiệu tương ứng trên dòng bảng (Ví dụ: LGTTS-002-95, TH130/07, TH25/07, C5-15, D_019, 232/TLBS-KHVT, 26/KHVT/0309, 301/TLBS-KHVT, LGTTS-002-95...). Nếu không có cột mã riêng, hãy lấy từ các ký hiệu nhận diện ở tên.
4. Quy cách (specs): Kích thước, định lượng (gsm), quy cách đóng gói (nếu có).
5. Số lượng (quantity), Đơn giá (price), Thành tiền (amount), ĐVT (unit).

Các trường dữ liệu cần trích xuất:
1. documentType: Loại chứng từ viết tắt (PO, PXK, Invoice, Unknown)
2. documentTypeName: Tên đầy đủ tiếng Việt của loại tài liệu (Ví dụ: Phiếu xuất kho, Đơn đặt hàng)
3. documentNumber: Số hiệu CHÍNH của chứng từ (Số PXK hoặc Số PO tùy loại tài liệu)
4. documentReference: Số tham chiếu QUAN TRỌNG (BẮT BUỘC tìm Số đơn hàng PO nếu tài liệu gốc là PXK/BBGH)
5. documentDate: Ngày lập tài liệu (DD/MM/YYYY)
6. deliveryDate: Thời gian giao nhận hàng hóa (DD/MM/YYYY)
7. buyerName: Tên đơn vị mua/nhận hàng (VD: Thuốc lá Thăng Long, Bắc Sơn, Thanh Hóa, Ngân Sơn...)
8. sellerName: Tên đơn vị bán/giao hàng
9. items: Danh sách mặt hàng (index, code, name, specs, unit, quantity, price, amount, deliveryDate, notes)`;

    const response = await generateContentWithRetry({
      model: "gemini-3.6-flash",
      contents: [filePart, prompt],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            documentType: { type: Type.STRING },
            documentTypeName: { type: Type.STRING },
            documentNumber: { type: Type.STRING },
            documentReference: { type: Type.STRING, description: "Số đơn đặt hàng PO nếu đây là phiếu xuất kho" },
            documentDate: { type: Type.STRING },
            deliveryDate: { type: Type.STRING },
            buyerName: { type: Type.STRING },
            buyerAddress: { type: Type.STRING },
            sellerName: { type: Type.STRING },
            sellerAddress: { type: Type.STRING },
            items: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  index: { type: Type.INTEGER },
                  code: { type: Type.STRING },
                  name: { type: Type.STRING },
                  specs: { type: Type.STRING },
                  unit: { type: Type.STRING },
                  quantity: { type: Type.NUMBER },
                  price: { type: Type.NUMBER },
                  amount: { type: Type.NUMBER },
                  deliveryDate: { type: Type.STRING, description: "Ngày giao hàng yêu cầu của từng mặt hàng (DD/MM/YYYY)" },
                  notes: { type: Type.STRING }
                }
              }
            }
          }
        },
        temperature: 0.1,
      }
    });

    let resultText = "";
    try {
      resultText = response.text || "";
    } catch (err) {
      console.error("Error accessing response.text in OCR:", err);
      resultText = response.candidates?.[0]?.content?.parts?.find((p: any) => p.text)?.text || "";
    }

    console.log("Gemini OCR raw response:", resultText);
    
    if (!resultText) {
      console.error("Gemini returned empty response for OCR. Full response:", JSON.stringify(response));
      throw new Error("Mô hình không trả về dữ liệu văn bản.");
    }

    let parsedResult;
    try {
      let jsonStr = resultText.trim();
      if (jsonStr.includes("```json")) {
        jsonStr = jsonStr.split("```json")[1].split("```")[0];
      } else if (jsonStr.includes("```")) {
        jsonStr = jsonStr.split("```")[1].split("```")[0];
      }
      
      parsedResult = JSON.parse(jsonStr.trim());
    } catch (parseError) {
      console.error("Failed to parse Gemini OCR response as JSON. Content:", resultText);
      const jsonMatch = resultText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          parsedResult = JSON.parse(jsonMatch[0]);
        } catch (innerError) {
          throw new Error("Không thể phân tích dữ liệu JSON từ phản hồi của mô hình.");
        }
      } else {
        throw new Error("Phản hồi từ mô hình không chứa dữ liệu JSON hợp lệ.");
      }
    }
    
    if (!parsedResult || !parsedResult.items) {
      console.error("Parsed result missing items:", parsedResult);
      throw new Error("Dữ liệu trích xuất thiếu danh sách mặt hàng (items).");
    }

    res.json(parsedResult);
  } catch (error: any) {
    console.error("OCR API error:", error);
    res.status(500).json({ error: error.message || "Failed to process OCR" });
  } finally {
    console.log("--- END /api/ocr ---");
  }
});
