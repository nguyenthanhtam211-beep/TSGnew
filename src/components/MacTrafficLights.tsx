import React from 'react';

interface MacTrafficLightsProps {
  onClose?: () => void;
  onMinimize?: () => void;
  onMaximize?: () => void;
  isMaximized?: boolean;
  className?: string;
  disabledMinimize?: boolean;
}

export default function MacTrafficLights({
  onClose,
  onMinimize,
  onMaximize,
  isMaximized = false,
  className = '',
  disabledMinimize = true,
}: MacTrafficLightsProps) {
  return (
    <div className={`flex items-center gap-2 select-none shrink-0 ${className}`}>
      {/* Red: Close */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          if (onClose) onClose();
        }}
        title="Đóng (Esc)"
        aria-label="Đóng"
        className="group relative w-3.5 h-3.5 rounded-full bg-[#FF5F56] hover:bg-[#FF3B30] active:bg-[#E0443E] border border-[#E0443E]/80 shadow-[0_0.5px_1px_rgba(0,0,0,0.12)] flex items-center justify-center transition-transform cursor-pointer hover:scale-105 active:scale-95"
      >
        <svg 
          className="w-2 h-2 text-[#4D0000] opacity-0 group-hover:opacity-100 transition-opacity stroke-[2.5] stroke-current" 
          viewBox="0 0 24 24" 
          fill="none"
        >
          <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {/* Gray / Yellow: Minimize (Disabled/Gray as requested when inactive) */}
      {disabledMinimize || !onMinimize ? (
        <div
          title="Thu nhỏ (Không khả dụng)"
          aria-label="Thu nhỏ không khả dụng"
          className="w-3.5 h-3.5 rounded-full bg-[#D1D5DB] border border-[#9CA3AF]/50 shadow-[0_0.5px_1px_rgba(0,0,0,0.06)] flex items-center justify-center cursor-default opacity-80"
        />
      ) : (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            if (onMinimize) onMinimize();
          }}
          title="Thu nhỏ"
          aria-label="Thu nhỏ"
          className="group relative w-3.5 h-3.5 rounded-full bg-[#FFBD2E] hover:bg-[#FF9500] active:bg-[#DEA123] border border-[#DEA123]/80 shadow-[0_0.5px_1px_rgba(0,0,0,0.12)] flex items-center justify-center transition-transform cursor-pointer hover:scale-105 active:scale-95"
        >
          <svg 
            className="w-2 h-2 text-[#5C3B00] opacity-0 group-hover:opacity-100 transition-opacity stroke-[2.5] stroke-current" 
            viewBox="0 0 24 24" 
            fill="none"
          >
            <path d="M5 12h14" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      )}

      {/* Green: Maximize / Restore */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          if (onMaximize) onMaximize();
        }}
        title={isMaximized ? "Thu nhỏ kích thước (⌘F)" : "Phóng to toàn màn hình (⌘F)"}
        aria-label={isMaximized ? "Thu nhỏ kích thước" : "Phóng to toàn màn hình"}
        className="group relative w-3.5 h-3.5 rounded-full bg-[#27C93F] hover:bg-[#34C759] active:bg-[#1AAB29] border border-[#1AAB29]/80 shadow-[0_0.5px_1px_rgba(0,0,0,0.12)] flex items-center justify-center transition-transform cursor-pointer hover:scale-105 active:scale-95"
      >
        <svg 
          className="w-2 h-2 text-[#0D4D1A] opacity-0 group-hover:opacity-100 transition-opacity fill-current" 
          viewBox="0 0 24 24"
        >
          {isMaximized ? (
            <path d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-14v3h3v2h-5V5h2z" />
          ) : (
            <path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z" />
          )}
        </svg>
      </button>
    </div>
  );
}