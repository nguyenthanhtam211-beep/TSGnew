/**
 * TSG Business ERP - Gemini AI Integration Client & Manager
 * Quản trị & Kết nối Gemini AI (Google AI Studio) cho TSG Business OS
 */

import { GoogleGenAI } from '@google/genai';

const STORAGE_KEY_GEMINI = 'gemini_api_key';

export function getStoredGeminiKey(): string {
  return localStorage.getItem(STORAGE_KEY_GEMINI) || (import.meta as any).env?.VITE_GEMINI_API_KEY || '';
}

export function setStoredGeminiKey(key: string): void {
  if (key) {
    localStorage.setItem(STORAGE_KEY_GEMINI, key.trim());
  } else {
    localStorage.removeItem(STORAGE_KEY_GEMINI);
  }
}

export function clearStoredGeminiKey(): void {
  localStorage.removeItem(STORAGE_KEY_GEMINI);
}

export interface GeminiTestResult {
  success: boolean;
  text?: string;
  model?: string;
  error?: string;
}

/**
 * Kiểm tra và xác thực kết nối với Gemini AI (Google AI Studio)
 */
export async function testGeminiConnection(customKey?: string): Promise<GeminiTestResult> {
  const apiKey = customKey || getStoredGeminiKey();

  // Test 1: Direct Google AI Studio REST Endpoint
  if (apiKey) {
    try {
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [{ text: 'Xin chào! Hãy xác nhận trong 1 câu ngắn bạn là Gemini AI sẵn sàng hỗ trợ TSG Business OS.' }]
          }]
        })
      });

      if (res.ok) {
        const json = await res.json();
        const text = json.candidates?.[0]?.content?.parts?.[0]?.text || "Kết nối thành công!";
        return { success: true, text: text.trim(), model: 'gemini-2.5-flash' };
      }

      // If gemini-2.5-flash fails, fallback to gemini-2.0-flash
      const fallbackEndpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
      const fallbackRes = await fetch(fallbackEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [{ text: 'Xin chào! Hãy xác nhận trong 1 câu ngắn bạn là Gemini AI sẵn sàng hỗ trợ TSG Business OS.' }]
          }]
        })
      });

      if (fallbackRes.ok) {
        const json = await fallbackRes.json();
        const text = json.candidates?.[0]?.content?.parts?.[0]?.text || "Kết nối thành công!";
        return { success: true, text: text.trim(), model: 'gemini-2.0-flash' };
      }

      const errJson = await res.json().catch(() => ({}));
      return { 
        success: false, 
        error: errJson.error?.message || `Lỗi HTTP ${res.status}: Không thể xác thực API Key với Google AI Studio.` 
      };
    } catch (e: any) {
      console.warn("Direct Gemini test error:", e);
    }
  }

  // Test 2: Via Backend /api/chat or /api/ai/chat
  try {
    const res = await fetch('/api/ai/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: 'Xác nhận trạng thái kết nối Gemini AI cho hệ thống TSG Business OS.'
      })
    });

    if (res.ok) {
      const data = await res.json();
      return { success: true, text: data.text || "Kết nối máy chủ AI thành công!", model: 'Server AI' };
    }
  } catch (e) {
    // Ignore server error and return general prompt
  }

  return {
    success: false,
    error: "Chưa cấu hình API Key. Vui lòng nhập khóa Gemini API Key từ Google AI Studio (aistudio.google.com)."
  };
}

/**
 * Thực hiện yêu cầu Chat / OCR / Phân tích dữ liệu với Gemini AI
 */
export async function sendGeminiPrompt(params: {
  prompt: string;
  systemInstruction?: string;
  history?: { role: string; content: string }[];
  file?: File;
  apiKey?: string;
}): Promise<string> {
  const { prompt, systemInstruction, history = [], file, apiKey } = params;
  const keyToUse = apiKey || getStoredGeminiKey();

  // Try 1: Server endpoint
  try {
    const formData = new FormData();
    formData.append("model", "gemini-2.5-flash");
    if (systemInstruction) formData.append("systemInstruction", systemInstruction);
    formData.append("messages", JSON.stringify([...history, { role: "user", content: prompt }]));
    if (file) formData.append("files", file);

    const res = await fetch("/api/chat", {
      method: "POST",
      body: formData,
    });

    if (res.ok) {
      const data = await res.json();
      if (data && data.text) return data.text;
    }
  } catch (serverErr) {
    console.warn("Server /api/chat unreachable, falling back to direct client API call", serverErr);
  }

  // Try 2: Direct Client-Side Google AI Call with API Key
  if (!keyToUse) {
    throw new Error("Chưa có khóa Gemini API Key. Vui lòng cấu hình tại Cài đặt (Settings) -> Kết nối Gemini AI.");
  }

  try {
    let inlineData: any = null;
    if (file) {
      const base64Data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result as string;
          const base64 = result.split(',')[1];
          resolve(base64);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      inlineData = {
        mime_type: file.type || 'image/jpeg',
        data: base64Data
      };
    }

    const contents: any[] = [];
    history.forEach(m => {
      contents.push({
        role: m.role === 'model' || m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }]
      });
    });

    const userParts: any[] = [{ text: prompt }];
    if (inlineData) {
      userParts.unshift({ inline_data: inlineData });
    }
    contents.push({ role: 'user', parts: userParts });

    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${keyToUse}`;
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents,
        system_instruction: systemInstruction ? {
          parts: [{ text: systemInstruction }]
        } : undefined,
        generation_config: {
          temperature: 0.2,
          max_output_tokens: 8192
        }
      })
    });

    if (!response.ok) {
      const errJson = await response.json().catch(() => ({}));
      throw new Error(errJson.error?.message || `Lỗi Google AI (${response.status})`);
    }

    const json = await response.json();
    const resultText = json.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!resultText) throw new Error("Gemini AI không trả về phản hồi.");
    return resultText;
  } catch (clientErr: any) {
    console.error("Direct Gemini call error:", clientErr);
    throw new Error(`Lỗi gọi Gemini AI: ${clientErr.message || clientErr}`);
  }
}
