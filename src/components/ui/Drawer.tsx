import React, { useEffect } from 'react';
import clsx from 'clsx';
import { X } from 'lucide-react';
import IconButton from './IconButton';

export type DrawerWidth = 'sm' | 'md' | 'lg' | 'xl';

export interface DrawerProps {
  open: boolean;
  onClose: () => void;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  icon?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  width?: DrawerWidth;
  className?: string;
  bodyClassName?: string;
}

export function Drawer({
  open,
  onClose,
  title,
  subtitle,
  icon,
  children,
  footer,
  width = 'md',
  className,
  bodyClassName,
}: DrawerProps) {
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

  const widthStyles = {
    sm: "max-w-sm",
    md: "max-w-md",
    lg: "max-w-lg",
    xl: "max-w-xl",
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex justify-end bg-ink/50 backdrop-blur-xs animate-fade-in"
      onClick={onClose}
    >
      <div
        className={clsx(
          "bg-surface border-l border-line shadow-pop w-full h-full flex flex-col animate-in slide-in-from-right duration-200",
          widthStyles[width],
          className
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drawer Header */}
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

          <IconButton
            icon={<X size={16} />}
            label="Đóng"
            size="sm"
            variant="ghost"
            onClick={onClose}
          />
        </div>

        {/* Drawer Content */}
        <div className={clsx("flex-1 overflow-y-auto p-5 space-y-4", bodyClassName)}>
          {children}
        </div>

        {/* Drawer Footer */}
        {footer && (
          <div className="px-5 py-3.5 border-t border-line bg-subtle/50 flex items-center justify-end gap-2.5 shrink-0">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

export default Drawer;
