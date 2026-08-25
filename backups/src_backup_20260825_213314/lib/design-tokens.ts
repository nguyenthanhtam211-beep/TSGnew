/**
 * TSG Business OS - Enterprise Cockpit Master Design Tokens
 * 
 * Centralized, type-safe token definitions adhering to:
 * - Apple Human Interface Guidelines (macOS Sequoia chrome & tactile feedback)
 * - OKLCH / Slate 4-Tier Surface Elevation System
 * - Vibrant Semantic Accents: #007AFF (Blue), #10B981 (Emerald), #F59E0B (Amber),
 *   #6366F1 (Indigo), #EF4444 (Rose), #8B5CF6 (Purple)
 * - Tabular Typography & Motion Spring Physics
 */

// ============================================================================
// 1. SURFACE ELEVATION TIERS & NEUTRAL OKLCH RAMP
// ============================================================================

export const COCKPIT_SURFACES = {
  /** Canvas background (Lowest ground) */
  canvas: {
    hex: '#F8F9FB',
    oklch: 'oklch(0.978 0.005 240)',
    cssVar: 'var(--cockpit-bg)',
    tailwindClass: 'bg-cockpit-bg',
  },
  /** Card & Content Surface Ground */
  card: {
    hex: '#FFFFFF',
    oklch: 'oklch(1 0 0)',
    cssVar: 'var(--cockpit-surface)',
    tailwindClass: 'bg-cockpit-surface',
  },
  /** Subtle Section Ground (Sidebars, filter bars, table headers) */
  overlay: {
    hex: '#F1F5F9',
    oklch: 'oklch(0.962 0.008 240)',
    cssVar: 'var(--cockpit-surface-subtle)',
    tailwindClass: 'bg-cockpit-subtle',
  },
  /** Raised controls, tooltips, popovers, floating docks */
  elevated: {
    hex: '#FAFAFC',
    oklch: 'oklch(0.992 0.003 240)',
    cssVar: 'var(--cockpit-surface-raised)',
    tailwindClass: 'bg-cockpit-raised',
  },
  /** Hover highlight state */
  hover: {
    hex: '#E2E8F0',
    oklch: 'oklch(0.945 0.012 240)',
    cssVar: 'var(--cockpit-surface-hover)',
    tailwindClass: 'bg-cockpit-hover',
  },
  /** Active / pressed state */
  active: {
    hex: '#CBD5E1',
    oklch: 'oklch(0.925 0.015 240)',
    cssVar: 'var(--cockpit-surface-active)',
    tailwindClass: 'bg-cockpit-active',
  },
} as const;

export type SurfaceLevel = keyof typeof COCKPIT_SURFACES;

// ============================================================================
// 2. NEUTRAL SLATE RAMP & TYPOGRAPHY FOREGROUNDS
// ============================================================================

export const COCKPIT_NEUTRALS = {
  slate50: '#F8FAFC',
  slate100: '#F1F5F9',
  slate200: '#E2E8F0',
  slate300: '#CBD5E1',
  slate400: '#94A3B8',
  slate500: '#64748B',
  slate600: '#475569',
  slate700: '#334155',
  slate800: '#1E293B',
  slate900: '#0F172A',
  slate950: '#020617',
} as const;

export const COCKPIT_TYPOGRAPHY_COLORS = {
  /** Dominant black/slate for primary headlines and heavy values */
  primary: {
    hex: '#0F172A',
    oklch: 'oklch(0.20 0.02 260)',
    cssVar: 'var(--cockpit-text-primary)',
    tailwindClass: 'text-cockpit-text',
  },
  /** Dark slate for column labels, section headers, and data labels */
  secondary: {
    hex: '#334155',
    oklch: 'oklch(0.42 0.025 250)',
    cssVar: 'var(--cockpit-text-secondary)',
    tailwindClass: 'text-cockpit-secondary',
  },
  /** Medium slate for captions, helper text, and timestamps */
  muted: {
    hex: '#64748B',
    oklch: 'oklch(0.58 0.02 250)',
    cssVar: 'var(--cockpit-text-muted)',
    tailwindClass: 'text-cockpit-muted',
  },
  /** Faint slate for inactive placeholders and disabled labels */
  faint: {
    hex: '#94A3B8',
    oklch: 'oklch(0.72 0.015 250)',
    cssVar: 'var(--cockpit-text-faint)',
    tailwindClass: 'text-cockpit-faint',
  },
} as const;

// ============================================================================
// 3. SUB-PIXEL HAIRLINE BORDERS & DIVIDERS
// ============================================================================

export const COCKPIT_HAIRLINES = {
  /** Standard delicate sub-pixel card & row divider */
  hairline: 'rgba(203, 213, 225, 0.65)',
  /** Ultra-subtle divider for nested table rows */
  subtle: 'rgba(226, 232, 240, 0.55)',
  /** Active element, selected tab or focused border */
  strong: 'rgba(148, 163, 184, 0.80)',
  /** Blue focus ring */
  focusRing: 'rgba(0, 122, 255, 0.40)',
} as const;

// ============================================================================
// 4. VIBRANT SEMANTIC ACCENTS
// ============================================================================

export interface SemanticAccent {
  name: string;
  primary: string;
  hover: string;
  active: string;
  subtle: string;
  border: string;
  glow: string;
  textClass: string;
  bgClass: string;
  borderClass: string;
}

export const COCKPIT_ACCENTS: Record<string, SemanticAccent> = {
  blue: {
    name: 'Electric Blue',
    primary: '#007AFF',
    hover: '#0066D6',
    active: '#0051A8',
    subtle: 'rgba(0, 122, 255, 0.08)',
    border: 'rgba(0, 122, 255, 0.25)',
    glow: 'rgba(0, 122, 255, 0.15)',
    textClass: 'text-[#007AFF]',
    bgClass: 'bg-[#007AFF]',
    borderClass: 'border-[#007AFF]/30',
  },
  emerald: {
    name: 'Emerald Green',
    primary: '#10B981',
    hover: '#059669',
    active: '#047857',
    subtle: 'rgba(16, 185, 129, 0.08)',
    border: 'rgba(16, 185, 129, 0.25)',
    glow: 'rgba(16, 185, 129, 0.15)',
    textClass: 'text-[#10B981]',
    bgClass: 'bg-[#10B981]',
    borderClass: 'border-[#10B981]/30',
  },
  amber: {
    name: 'Amber Gold',
    primary: '#F59E0B',
    hover: '#D97706',
    active: '#B45309',
    subtle: 'rgba(245, 158, 11, 0.08)',
    border: 'rgba(245, 158, 11, 0.25)',
    glow: 'rgba(245, 158, 11, 0.15)',
    textClass: 'text-[#F59E0B]',
    bgClass: 'bg-[#F59E0B]',
    borderClass: 'border-[#F59E0B]/30',
  },
  indigo: {
    name: 'Indigo / Patina',
    primary: '#6366F1',
    hover: '#4F46E5',
    active: '#4338CA',
    subtle: 'rgba(99, 102, 241, 0.08)',
    border: 'rgba(99, 102, 241, 0.25)',
    glow: 'rgba(99, 102, 241, 0.15)',
    textClass: 'text-[#6366F1]',
    bgClass: 'bg-[#6366F1]',
    borderClass: 'border-[#6366F1]/30',
  },
  rose: {
    name: 'Rose Red',
    primary: '#EF4444',
    hover: '#DC2626',
    active: '#B91C1C',
    subtle: 'rgba(239, 68, 68, 0.08)',
    border: 'rgba(239, 68, 68, 0.25)',
    glow: 'rgba(239, 68, 68, 0.15)',
    textClass: 'text-[#EF4444]',
    bgClass: 'bg-[#EF4444]',
    borderClass: 'border-[#EF4444]/30',
  },
  purple: {
    name: 'AI Purple',
    primary: '#8B5CF6',
    hover: '#7C3AED',
    active: '#6D28D9',
    subtle: 'rgba(139, 92, 246, 0.08)',
    border: 'rgba(139, 92, 246, 0.25)',
    glow: 'rgba(139, 92, 246, 0.15)',
    textClass: 'text-[#8B5CF6]',
    bgClass: 'bg-[#8B5CF6]',
    borderClass: 'border-[#8B5CF6]/30',
  },
} as const;

export type AccentKey = keyof typeof COCKPIT_ACCENTS;

// ============================================================================
// 5. RECHARTS CHART PALETTE & THEME CONFIGURATION
// ============================================================================

export const RECHARTS_PALETTE = {
  blue: '#007AFF',
  emerald: '#10B981',
  amber: '#F59E0B',
  indigo: '#6366F1',
  purple: '#8B5CF6',
  rose: '#EF4444',
  cyan: '#06B6D4',
  slate: '#64748B',
  colors: ['#007AFF', '#10B981', '#F59E0B', '#6366F1', '#8B5CF6', '#EF4444', '#06B6D4', '#64748B'],
} as const;

export const RECHARTS_THEME = {
  grid: {
    stroke: 'rgba(226, 232, 240, 0.7)',
    strokeDasharray: '3 3',
    vertical: false,
  },
  axis: {
    stroke: '#94A3B8',
    tickLine: false,
    fontSize: 11,
    fontFamily: '"Inter", "Roboto", system-ui, sans-serif',
    fill: '#64748B',
  },
  tooltip: {
    backgroundColor: 'rgba(255, 255, 255, 0.94)',
    backdropFilter: 'blur(16px) saturate(180%)',
    borderColor: 'rgba(203, 213, 225, 0.8)',
    borderRadius: 10,
    boxShadow: '0 8px 24px -4px rgba(15, 23, 42, 0.10), 0 2px 6px -1px rgba(15, 23, 42, 0.06)',
    padding: '8px 12px',
    fontSize: 12,
  },
  cursor: {
    stroke: 'rgba(0, 122, 255, 0.3)',
    strokeWidth: 1.5,
    strokeDasharray: '4 4',
  },
} as const;

// ============================================================================
// 6. MOTION SPRING PHYSICS CONFIGURATIONS
// ============================================================================

export const SPRING_PRESETS = {
  /** Standard Apple tactile spring for UI buttons, chips, and modal sheets */
  cockpitSpring: {
    type: 'spring' as const,
    stiffness: 400,
    damping: 30,
    mass: 0.8,
  },
  /** Playful bouncy spring for icon interactions, badges, success celebrations */
  cockpitBouncy: {
    type: 'spring' as const,
    stiffness: 500,
    damping: 20,
    mass: 0.6,
  },
  /** Snappy fast spring for tab transitions, dropdowns, and instant hover lifts */
  cockpitSnappy: {
    type: 'spring' as const,
    stiffness: 600,
    damping: 35,
    mass: 0.5,
  },
  /** Gentle spring for larger modal dialogs and bottom sheets */
  cockpitGentle: {
    type: 'spring' as const,
    stiffness: 280,
    damping: 26,
    mass: 1.0,
  },
} as const;

export const SPRING_EASINGS = {
  /** Smooth Apple spring cubic-bezier curve */
  spring: 'cubic-bezier(0.16, 1, 0.3, 1)',
  /** Bouncy micro-interaction curve */
  bounce: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
  /** Fast exit curve */
  snappy: 'cubic-bezier(0.2, 0.8, 0.2, 1)',
  /** Standard decelerate curve */
  easeOut: 'cubic-bezier(0.25, 1, 0.5, 1)',
} as const;

// ============================================================================
// 7. STATUS BADGE & VARIANT MAPPINGS
// ============================================================================

export interface StatusBadgeConfig {
  label: string;
  variant: 'success' | 'warning' | 'danger' | 'info' | 'ai' | 'neutral';
  bgClass: string;
  textClass: string;
  borderClass: string;
  dotColor: string;
}

export const STATUS_BADGE_VARIANTS: Record<string, StatusBadgeConfig> = {
  // Completed / Success / Paid
  completed: {
    label: 'Đã hoàn thành',
    variant: 'success',
    bgClass: 'bg-emerald-50/90 dark:bg-emerald-950/40',
    textClass: 'text-emerald-700 dark:text-emerald-300',
    borderClass: 'border-emerald-200/80 dark:border-emerald-800/60',
    dotColor: '#10B981',
  },
  delivered: {
    label: 'Đã giao hàng',
    variant: 'success',
    bgClass: 'bg-emerald-50/90 dark:bg-emerald-950/40',
    textClass: 'text-emerald-700 dark:text-emerald-300',
    borderClass: 'border-emerald-200/80 dark:border-emerald-800/60',
    dotColor: '#10B981',
  },
  reconciled: {
    label: 'Đã khớp 100%',
    variant: 'success',
    bgClass: 'bg-emerald-50/90 dark:bg-emerald-950/40',
    textClass: 'text-emerald-700 dark:text-emerald-300',
    borderClass: 'border-emerald-200/80 dark:border-emerald-800/60',
    dotColor: '#10B981',
  },
  paid: {
    label: 'Đã thanh toán',
    variant: 'success',
    bgClass: 'bg-emerald-50/90 dark:bg-emerald-950/40',
    textClass: 'text-emerald-700 dark:text-emerald-300',
    borderClass: 'border-emerald-200/80 dark:border-emerald-800/60',
    dotColor: '#10B981',
  },

  // Warning / In-Progress / Delivering / Pending
  in_progress: {
    label: 'Đang xử lý',
    variant: 'warning',
    bgClass: 'bg-amber-50/90 dark:bg-amber-950/40',
    textClass: 'text-amber-700 dark:text-amber-300',
    borderClass: 'border-amber-200/80 dark:border-amber-800/60',
    dotColor: '#F59E0B',
  },
  delivering: {
    label: 'Đang giao hàng',
    variant: 'warning',
    bgClass: 'bg-amber-50/90 dark:bg-amber-950/40',
    textClass: 'text-amber-700 dark:text-amber-300',
    borderClass: 'border-amber-200/80 dark:border-amber-800/60',
    dotColor: '#F59E0B',
  },
  pending: {
    label: 'Chờ duyệt / Chờ giao',
    variant: 'warning',
    bgClass: 'bg-amber-50/90 dark:bg-amber-950/40',
    textClass: 'text-amber-700 dark:text-amber-300',
    borderClass: 'border-amber-200/80 dark:border-amber-800/60',
    dotColor: '#F59E0B',
  },
  scheduled: {
    label: 'Đã lên lịch',
    variant: 'warning',
    bgClass: 'bg-amber-50/90 dark:bg-amber-950/40',
    textClass: 'text-amber-700 dark:text-amber-300',
    borderClass: 'border-amber-200/80 dark:border-amber-800/60',
    dotColor: '#F59E0B',
  },

  // Danger / Overdue / Cancelled / Error
  overdue: {
    label: 'Quá hạn',
    variant: 'danger',
    bgClass: 'bg-rose-50/90 dark:bg-rose-950/40',
    textClass: 'text-rose-700 dark:text-rose-300',
    borderClass: 'border-rose-200/80 dark:border-rose-800/60',
    dotColor: '#EF4444',
  },
  cancelled: {
    label: 'Đã hủy',
    variant: 'danger',
    bgClass: 'bg-rose-50/90 dark:bg-rose-950/40',
    textClass: 'text-rose-700 dark:text-rose-300',
    borderClass: 'border-rose-200/80 dark:border-rose-800/60',
    dotColor: '#EF4444',
  },
  error: {
    label: 'Lỗi',
    variant: 'danger',
    bgClass: 'bg-rose-50/90 dark:bg-rose-950/40',
    textClass: 'text-rose-700 dark:text-rose-300',
    borderClass: 'border-rose-200/80 dark:border-rose-800/60',
    dotColor: '#EF4444',
  },

  // Info / Active / Draft / Blueprint
  active: {
    label: 'Đang hoạt động',
    variant: 'info',
    bgClass: 'bg-blue-50/90 dark:bg-blue-950/40',
    textClass: 'text-[#007AFF] dark:text-blue-300',
    borderClass: 'border-blue-200/80 dark:border-blue-800/60',
    dotColor: '#007AFF',
  },
  draft: {
    label: 'Bản nháp',
    variant: 'info',
    bgClass: 'bg-blue-50/90 dark:bg-blue-950/40',
    textClass: 'text-[#007AFF] dark:text-blue-300',
    borderClass: 'border-blue-200/80 dark:border-blue-800/60',
    dotColor: '#007AFF',
  },
  processing: {
    label: 'Hệ thống xử lý',
    variant: 'info',
    bgClass: 'bg-blue-50/90 dark:bg-blue-950/40',
    textClass: 'text-[#007AFF] dark:text-blue-300',
    borderClass: 'border-blue-200/80 dark:border-blue-800/60',
    dotColor: '#007AFF',
  },

  // AI / OCR / Intelligence
  ai_processed: {
    label: 'AI Trích xuất',
    variant: 'ai',
    bgClass: 'bg-purple-50/90 dark:bg-purple-950/40',
    textClass: 'text-purple-700 dark:text-purple-300',
    borderClass: 'border-purple-200/80 dark:border-purple-800/60',
    dotColor: '#8B5CF6',
  },
  contract_active: {
    label: 'Hợp đồng hiệu lực',
    variant: 'ai',
    bgClass: 'bg-indigo-50/90 dark:bg-indigo-950/40',
    textClass: 'text-indigo-700 dark:text-indigo-300',
    borderClass: 'border-indigo-200/80 dark:border-indigo-800/60',
    dotColor: '#6366F1',
  },

  // Neutral / Archived / Default
  neutral: {
    label: 'Mặc định',
    variant: 'neutral',
    bgClass: 'bg-slate-100/90 dark:bg-slate-800/50',
    textClass: 'text-slate-600 dark:text-slate-300',
    borderClass: 'border-slate-200/80 dark:border-slate-700/60',
    dotColor: '#94A3B8',
  },
  archived: {
    label: 'Đã lưu trữ',
    variant: 'neutral',
    bgClass: 'bg-slate-100/90 dark:bg-slate-800/50',
    textClass: 'text-slate-600 dark:text-slate-300',
    borderClass: 'border-slate-200/80 dark:border-slate-700/60',
    dotColor: '#94A3B8',
  },
};

/**
 * Helper to retrieve badge configuration by status string safely
 */
export function getStatusBadgeConfig(status: string = ''): StatusBadgeConfig {
  const normalized = status.toLowerCase().trim().replace(/[\s-]+/g, '_');
  return STATUS_BADGE_VARIANTS[normalized] || STATUS_BADGE_VARIANTS.neutral;
}

/**
 * Helper to retrieve accent token details safely
 */
export function getAccentColor(name: AccentKey | string): SemanticAccent {
  return COCKPIT_ACCENTS[name] || COCKPIT_ACCENTS.blue;
}
