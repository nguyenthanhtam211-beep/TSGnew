import React from 'react';

interface MacTrafficLightsProps {
  onClose?: () => void;
  onMinimize?: () => void;
  onMaximize?: () => void;
  isMaximized?: boolean;
  className?: string;
}

export default function MacTrafficLights({
  onClose,
  onMinimize,
  onMaximize,
  isMaximized = false,
  className = ""
}: MacTrafficLightsProps) {
  return (
    <div className={`flex items-center gap-2 select-none shrink-0 ${className}`}>
      {/* Red: Close / Exit */}
      <button
        type="button"
        onClick={onClose}
        title="Đóng (⌘W)"
        className="w-3.5 h-3.5 rounded-full bg-[#FF5F56] hover:bg-[#FF3B30] active:bg-[#E0443E] border border-[#E0443E]/70 shadow-2xs flex items-center justify-center text-[10px] text-red-950/0 hover:text-red-950 font-bold transition-all cursor-pointer"
      >
        ×
      </button>

      {/* Yellow: Minimize / Collapse */}
      <button
        type="button"
        onClick={onMinimize || onClose}
        title="Thu nhỏ / Đóng"
        className="w-3.5 h-3.5 rounded-full bg-[#FFBD2E] hover:bg-[#FF9500] active:bg-[#DEA123] border border-[#DEA123]/70 shadow-2xs flex items-center justify-center text-[10px] text-amber-950/0 hover:text-amber-950 font-bold transition-all cursor-pointer"
      >
        –
      </button>

      {/* Green: Fullscreen / Expand */}
      <button
        type="button"
        onClick={onMaximize}
        title={isMaximized ? "Thu nhỏ (⌃⌘F)" : "Phóng to tối đa (⌃⌘F)"}
        className="w-3.5 h-3.5 rounded-full bg-[#27C93F] hover:bg-[#34C759] active:bg-[#1AAB29] border border-[#1AAB29]/70 shadow-2xs flex items-center justify-center text-[9px] text-green-950/0 hover:text-green-950 font-bold transition-all cursor-pointer"
      >
        ⤢
      </button>
    </div>
  );
}
