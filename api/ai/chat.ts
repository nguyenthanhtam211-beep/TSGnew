import { GoogleGenAI } from '@google/genai';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { prompt, systemInstruction } = req.body || {};
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return res.status(400).json({ error: 'Chưa cấu hình GEMINI_API_KEY trong Vercel Environment Variables' });
    }

    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        systemInstruction: systemInstruction || 'Bạn là trợ lý AI thông minh quản lý doanh nghiệp TSG Business.',
      },
    });

    return res.status(200).json({ text: response.text });
  } catch (error: any) {
    console.error("Vercel Gemini AI error:", error);
    return res.status(500).json({ error: error.message || "Failed to generate AI content" });
  }
}
