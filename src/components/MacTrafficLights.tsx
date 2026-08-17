import React from 'react';

interface MacTrafficLightsProps {
  onClose?: () => void;
  onMinimize?: () => void;
  onMaximize?: () => void;
  isMaximized?: boolean;
  className?: string;
  showAllButtons?: boolean;
}

export default function MacTrafficLights({
  onClose,
  onMinimize,
  onMaximize,
  isMaximized = false,
  className = "",
  showAllButtons = false
}: MacTrafficLightsProps) {
  // If user requested only the red button as the close button
  if (!showAllButtons) {
    return (
      <div className={`flex items-center select-none shrink-0 ${className}`}>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            if (onClose) onClose();
          }}
          title="Đóng cửa sổ (Esc / ⌘W)"
          aria-label="Đóng cửa sổ"
          className="group relative w-3.5 h-3.5 rounded-full bg-[#FF5F56] hover:bg-[#FF3B30] active:bg-[#E0443E] border border-[#E0443E]/80 shadow-[0_1px_2px_rgba(0,0,0,0.12)] flex items-center justify-center transition-all cursor-pointer hover:scale-105 active:scale-95"
        >
          <span className="opacity-0 group-hover:opacity-100 text-[10px] leading-none text-[#4D0000] font-bold transition-opacity">
            ×
          </span>
        </button>
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-2 select-none shrink-0 ${className}`}>
      {/* Red: Close / Exit */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          if (onClose) onClose();
        }}
        title="Đóng (⌘W)"
        className="group relative w-3.5 h-3.5 rounded-full bg-[#FF5F56] hover:bg-[#FF3B30] active:bg-[#E0443E] border border-[#E0443E]/70 shadow-2xs flex items-center justify-center transition-all cursor-pointer hover:scale-105 active:scale-95"
      >
        <span className="opacity-0 group-hover:opacity-100 text-[10px] leading-none text-[#4D0000] font-bold transition-opacity">
          ×
        </span>
      </button>

      {/* Yellow: Minimize */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          if (onMinimize) onMinimize();
          else if (onClose) onClose();
        }}
        title="Thu nhỏ"
        className="group relative w-3.5 h-3.5 rounded-full bg-[#FFBD2E] hover:bg-[#FF9500] active:bg-[#DEA123] border border-[#DEA123]/70 shadow-2xs flex items-center justify-center transition-all cursor-pointer hover:scale-105 active:scale-95"
      >
        <span className="opacity-0 group-hover:opacity-100 text-[10px] leading-none text-[#5C3B00] font-bold transition-opacity">
          –
        </span>
      </button>

      {/* Green: Maximize */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          if (onMaximize) onMaximize();
        }}
        title={isMaximized ? "Thu nhỏ (⌃⌘F)" : "Phóng to (⌃⌘F)"}
        className="group relative w-3.5 h-3.5 rounded-full bg-[#27C93F] hover:bg-[#34C759] active:bg-[#1AAB29] border border-[#1AAB29]/70 shadow-2xs flex items-center justify-center transition-all cursor-pointer hover:scale-105 active:scale-95"
      >
        <span className="opacity-0 group-hover:opacity-100 text-[9px] leading-none text-[#0D4D1A] font-bold transition-opacity">
          ⤢
        </span>
      </button>
    </div>
  );
}
