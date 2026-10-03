import React, { useState, useRef, useEffect } from "react";
import { Bot, FileText, Send } from "lucide-react";
import clsx from "clsx";
import { SYSTEM_PROMPT } from "../prompt";
import { sendGeminiPrompt } from "../lib/gemini";
import { PRICING_DATA, PO_HEADER_DATA, PO_LINES_DATA, DELIVERY_DATA } from "../data";

const FULL_SYSTEM_PROMPT = `${SYSTEM_PROMPT}

=== DỮ LIỆU HỆ THỐNG HIỆN TẠI ===
[BẢNG GIÁ 2026]
${PRICING_DATA}

[PO HEADER]
${PO_HEADER_DATA}

[PO LINES]
${PO_LINES_DATA}

[GIAO HÀNG]
${DELIVERY_DATA}
=== KẾT THÚC ===`;

export default function AssistantView() {
  const INITIAL_MESSAGE = {
    role: "model",
    content: "Xin chào! Tôi là TSG Business Assistant. Bạn có thể tra cứu giá, xem báo cáo tổng quan, phân tích lợi nhuận hoặc gửi ảnh/PDF Đơn hàng PO, Phiếu xuất kho để tôi xử lý giúp bạn."
  };
  
  const [messages, setMessages] = useState<{role: string, content: string, file?: File}[]>([
    INITIAL_MESSAGE
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const handleSendPrompt = async (promptText: string, fileAttachment?: File) => {
    if ((!promptText.trim() && !fileAttachment) || isLoading) return;

    const newMessages = [...messages, { role: "user", content: promptText, file: fileAttachment || undefined }];
    setMessages(newMessages);
    setInput("");
    const fileToSend = fileAttachment || selectedFile;
    setSelectedFile(null);
    setIsLoading(true);

    try {
      const responseText = await sendGeminiPrompt({
        prompt: promptText,
        systemInstruction: FULL_SYSTEM_PROMPT,
        history: newMessages.slice(0, -1).map(m => ({ role: m.role, content: m.content })),
        file: fileToSend || undefined
      });
      
      setMessages(prev => [...prev, { role: "model", content: responseText }]);
    } catch (err: any) {
      setMessages(prev => [...prev, { role: "model", content: `❌ Lỗi xử lý Trợ lý AI: ${err.message}` }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSendPrompt(input, selectedFile || undefined);
  };

  const handleClearChat = () => {
    setMessages([INITIAL_MESSAGE]);
    setSelectedFile(null);
    setInput("");
  };

  const quickPrompts = [
    "📊 Báo cáo tổng quan",
    "💰 Tra giá TH130/07 cho Thăng Long",
    "📦 Trạng thái đơn 26/KHVT/0600",
    "⚠️ Sự cố giao hàng",
    "💰 Phân tích lợi nhuận theo NCC"
  ];

  return (
    <div className="flex flex-col h-full bg-slate-50 relative">
      {/* Header */}
      <div className="p-4 bg-white border-b border-slate-200 flex items-center justify-between shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-xs">
            <Bot size={20} />
          </div>
          <div>
            <h2 className="font-semibold text-slate-800 text-base leading-tight">Trợ lý Vận hành TSG</h2>
            <p className="text-xs text-slate-500">Được hỗ trợ bởi Gemini 3.6 Flash</p>
          </div>
        </div>
        <button
          onClick={handleClearChat}
          className="px-3 py-1.5 text-xs text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg border border-slate-200 transition-all font-medium"
          title="Xóa lịch sử trò chuyện"
        >
          Xóa trò chuyện
        </button>
      </div>
      
      {/* Messages Feed */}
      <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
        {messages.map((msg, idx) => (
          <div key={idx} className={clsx("flex gap-3 md:gap-4 max-w-4xl mx-auto", msg.role === "user" ? "flex-row-reverse" : "")}>
            <div className={clsx("w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold shadow-xs", msg.role === "user" ? "bg-blue-600 text-white" : "bg-slate-800 text-white")}>
              {msg.role === "user" ? "BẠN" : <Bot size={18} />}
            </div>
            <div className={clsx("flex flex-col gap-2 max-w-[85%] md:max-w-[80%]", msg.role === "user" ? "items-end" : "items-start")}>
              {msg.file && (
                <div className="bg-slate-100 text-slate-700 rounded-lg p-2.5 text-xs flex items-center gap-2 border border-slate-200 shadow-2xs">
                  <FileText size={15} className="text-blue-600" />
                  <span className="truncate max-w-xs font-medium">{msg.file.name}</span>
                </div>
              )}
              <div className={clsx(
                "p-4 rounded-2xl text-xs sm:text-sm leading-relaxed whitespace-pre-line shadow-2xs",
                msg.role === "user" 
                  ? "bg-blue-600 text-white rounded-tr-none" 
                  : "bg-white text-slate-800 border border-slate-200/80 rounded-tl-none"
              )}>
                {msg.content}
              </div>
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex gap-3 max-w-4xl mx-auto">
            <div className="w-8 h-8 rounded-full bg-slate-800 text-white flex items-center justify-center flex-shrink-0 text-xs font-bold shadow-xs">
              <Bot size={18} />
            </div>
            <div className="bg-white border border-slate-200/80 p-4 rounded-2xl rounded-tl-none shadow-2xs flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse" />
              <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse [animation-delay:0.2s]" />
              <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse [animation-delay:0.4s]" />
              <span className="text-xs text-slate-500 font-medium ml-2">Đang xử lý dữ liệu...</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Quick Prompts Bar */}
      <div className="px-4 py-2 bg-slate-100 border-t border-slate-200/60 overflow-x-auto flex gap-2 no-scrollbar">
        {quickPrompts.map((qp, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => handleSendPrompt(qp)}
            className="px-3 py-1 bg-white hover:bg-slate-50 text-slate-700 text-xs rounded-full border border-slate-200 shrink-0 shadow-2xs transition-all font-medium"
          >
            {qp}
          </button>
        ))}
      </div>

      {/* Chat Input Area */}
      <div className="p-3 sm:p-4 bg-white border-t border-slate-200">
        <form onSubmit={handleSubmit} className="flex gap-2 max-w-4xl mx-auto items-center">
          <label className="p-2.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl cursor-pointer transition-colors border border-transparent hover:border-slate-200">
            <FileText size={18} />
            <input
              type="file"
              className="hidden"
              accept=".pdf,.png,.jpg,.jpeg"
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  setSelectedFile(e.target.files[0]);
                }
              }}
            />
          </label>
          {selectedFile && (
            <div className="flex items-center gap-1.5 bg-blue-50 text-blue-700 px-2.5 py-1 rounded-lg text-xs border border-blue-200 font-medium">
              <span className="truncate max-w-[120px]">{selectedFile.name}</span>
              <button type="button" onClick={() => setSelectedFile(null)} className="hover:text-blue-900 font-bold ml-1">×</button>
            </div>
          )}
          <div className="flex-1 relative">
            <input
              type="text"
              placeholder="Nhập câu hỏi hoặc yêu cầu (VD: Tra cứu giá, PO...)"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              className="w-full px-4 py-2.5 bg-slate-100 focus:bg-white border border-transparent focus:border-blue-500 rounded-xl text-xs sm:text-sm outline-none transition-all"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit(e);
                }
              }}
            />
          </div>
          <button
            type="submit"
            disabled={(!input.trim() && !selectedFile) || isLoading}
            className="p-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex-shrink-0 shadow-xs flex items-center justify-center cursor-pointer"
          >
            <Send size={18} />
          </button>
        </form>
      </div>
    </div>
  );
}
