import React, { useEffect, useState } from 'react';
import clsx from 'clsx';
import { X, Maximize2, Minimize2 } from 'lucide-react';
import IconButton from './IconButton';

export type ModalSize = 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full';

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  icon?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: ModalSize;
  maximizable?: boolean;
  className?: string;
  bodyClassName?: string;
}

export function Modal({
  open,
  onClose,
  title,
  subtitle,
  icon,
  children,
  footer,
  size = 'md',
  maximizable = false,
  className,
  bodyClassName,
}: ModalProps) {
  const [isMaximized, setIsMaximized] = useState(false);

  // Close on Escape & Lock body scroll
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = originalOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  const sizeStyles = {
    sm: "max-w-md",
    md: "max-w-xl",
    lg: "max-w-3xl",
    xl: "max-w-5xl",
    '2xl': "max-w-6xl",
    full: "max-w-[96vw] h-[92vh]",
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-ink/60 backdrop-blur-xs animate-fade-in"
      onClick={onClose}
    >
      <div
        className={clsx(
          "bg-surface rounded-modal border border-line shadow-modal flex flex-col w-full overflow-hidden transition-all duration-200 animate-in zoom-in-95",
          isMaximized ? "max-w-[98vw] h-[96vh]" : [sizeStyles[size], "max-h-[92vh]"],
          className
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header: Left icon/titles, Right single close (and optional maximize) */}
        <div className="px-5 py-4 border-b border-line flex items-center justify-between bg-surface shrink-0">
          <div className="flex items-center gap-3 min-w-0 pr-4">
            {icon && (
              <div className="w-8 h-8 rounded-control bg-brand-soft text-brand flex items-center justify-center shrink-0 border border-brand/20">
                {icon}
              </div>
            )}
            <div className="min-w-0">
              <h3 className="text-sm sm:text-base font-bold text-ink truncate font-display">
                {title}
              </h3>
              {subtitle && (
                <p className="text-xs text-ink-3 truncate mt-0.5">
                  {subtitle}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {maximizable && (
              <IconButton
                icon={isMaximized ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
                label={isMaximized ? "Thu nhỏ" : "Phóng to"}
                size="sm"
                variant="ghost"
                onClick={() => setIsMaximized(!isMaximized)}
              />
            )}
            <IconButton
              icon={<X size={16} />}
              label="Đóng"
              size="sm"
              variant="ghost"
              onClick={onClose}
            />
          </div>
        </div>

        {/* Modal Body */}
        <div className={clsx("flex-1 overflow-y-auto p-5 sm:p-6", bodyClassName)}>
          {children}
        </div>

        {/* Modal Footer */}
        {footer && (
          <div className="px-5 py-3.5 border-t border-line bg-subtle/50 flex items-center justify-end gap-2.5 shrink-0">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

export default Modal;
