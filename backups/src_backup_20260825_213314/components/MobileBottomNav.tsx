import React from 'react';
import { LayoutDashboard, Truck, FileText, Camera, Bot, Menu } from 'lucide-react';
import { motion } from 'motion/react';
import clsx from 'clsx';
import { SPRING_PRESETS } from '../lib/design-tokens';

export interface MobileBottomNavProps {
  activeTab: string;
  onNavigate: (tabId: string) => void;
  onOpenMenu: () => void;
  isMenuOpen?: boolean;
  deliveryCount?: number;
  poCount?: number;
  className?: string;
}

interface NavButtonConfig {
  id: string;
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  badge?: number;
  badgeColor?: string;
  isSpecial?: boolean;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  activeTab,
  onNavigate,
  onOpenMenu,
  isMenuOpen = false,
  deliveryCount = 0,
  poCount = 0,
  className
}) => {
  const NAV_ITEMS: NavButtonConfig[] = [
    {
      id: 'dashboard',
      label: 'Tổng quan',
      icon: LayoutDashboard,
    },
    {
      id: 'logistics',
      label: 'Giao hàng',
      icon: Truck,
      badge: deliveryCount > 0 ? deliveryCount : undefined,
      badgeColor: 'bg-orange-500 text-white',
    },
    {
      id: 'po',
      label: 'Đơn PO',
      icon: FileText,
      badge: poCount > 0 ? poCount : undefined,
      badgeColor: 'bg-blue-600 text-white',
    },
    {
      id: 'ocr',
      label: 'Quét OCR',
      icon: Camera,
    },
    {
      id: 'assistant',
      label: 'Trợ lý AI',
      icon: Bot,
      isSpecial: true,
    },
    {
      id: 'menu',
      label: 'Menu',
      icon: Menu,
    },
  ];

  return (
    <div 
      className={clsx(
        "lg:hidden fixed bottom-2.5 inset-x-3 sm:inset-x-8 max-w-lg mx-auto z-40 cockpit-glass border border-white/60 dark:border-slate-700/60 rounded-2xl shadow-[0_8px_32px_rgba(15,23,42,0.14)] px-1.5 py-1 flex items-center justify-around pointer-events-auto select-none transition-all duration-200 print:hidden",
        className
      )}
      style={{
        paddingBottom: 'max(env(safe-area-inset-bottom), 6px)',
        paddingLeft: 'max(env(safe-area-inset-left), 8px)',
        paddingRight: 'max(env(safe-area-inset-right), 8px)',
      }}
    >
      {NAV_ITEMS.map(item => {
        const isMenuButton = item.id === 'menu';
        const isActive = isMenuButton ? isMenuOpen : activeTab === item.id;
        const Icon = item.icon;

        return (
          <motion.button
            key={item.id}
            type="button"
            whileTap={{ scale: 0.88 }}
            transition={SPRING_PRESETS.cockpitBouncy}
            onClick={() => {
              if (isMenuButton) {
                onOpenMenu();
              } else {
                onNavigate(item.id);
              }
            }}
            className={clsx(
              "relative flex-1 flex flex-col items-center justify-center py-1 px-1 rounded-xl transition-all duration-150 min-h-[44px] landscape:min-h-[38px] cursor-pointer touch-manipulation group",
              isActive 
                ? "text-[#007AFF] dark:text-blue-400 font-bold" 
                : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
            )}
            title={item.label}
          >
            {/* Sliding Active Pill Background via Motion layoutId */}
            {isActive && (
              <motion.div
                layoutId="mobile-dock-pill"
                className="absolute inset-0 bg-blue-500/12 dark:bg-blue-500/25 border border-blue-500/25 dark:border-blue-400/30 rounded-xl -z-10 shadow-2xs"
                transition={SPRING_PRESETS.cockpitSpring}
              />
            )}

            {/* Icon Container with Badge */}
            <div className="relative flex items-center justify-center">
              <Icon 
                size={19} 
                className={clsx(
                  "transition-transform duration-150 group-hover:scale-110",
                  isActive ? "stroke-[2.5]" : "stroke-[1.75]",
                  item.isSpecial && !isActive ? "text-purple-600 dark:text-purple-400" : ""
                )} 
              />

              {/* Notification Badge with Tabular Numbers */}
              {item.badge !== undefined && (
                <motion.span 
                  initial={{ scale: 0.8 }}
                  animate={{ scale: 1 }}
                  className={clsx(
                    "absolute -top-1.5 -right-2.5 min-w-[15px] h-[15px] px-1 rounded-full text-[9px] font-mono font-bold flex items-center justify-center tabular-nums shadow-2xs",
                    item.badgeColor || "bg-blue-600 text-white"
                  )}
                >
                  {item.badge > 99 ? '99+' : item.badge}
                </motion.span>
              )}
            </div>

            {/* Micro Tab Label */}
            <span className={clsx(
              "text-[9.5px] tracking-tight leading-tight mt-0.5 truncate max-w-[48px]",
              isActive ? "font-bold text-[#007AFF] dark:text-blue-400" : "font-medium"
            )}>
              {item.label}
            </span>
          </motion.button>
        );
      })}
    </div>
  );
};

export default MobileBottomNav;
