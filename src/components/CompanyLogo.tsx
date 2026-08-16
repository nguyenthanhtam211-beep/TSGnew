import React, { useState, useEffect } from 'react';
import { 
  Building2, Layers, Compass, Wind, Anchor, Award, Box, 
  Factory, Truck, Printer, Droplets, Sliders, Shield, Sparkles,
  Hexagon, CircleDot, Landmark, Briefcase
} from 'lucide-react';

interface CompanyLogoProps {
  name: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  logoUrl?: string;
  logoFit?: 'cover' | 'contain';
}

/**
 * Intelligent Vietnamese Brand Initials & Core Name Extractor
 * Strips legal boilerplate (Công ty, TNHH, MTV, Cổ phần...) to reveal the iconic enterprise brand
 */
export function extractBrandInfo(companyName: string): {
  initials: string;
  gradient: string;
  subIcon?: any;
} {
  if (!companyName) {
    return {
      initials: 'TS',
      gradient: 'from-[#007AFF] to-[#0051A8]'
    };
  }

  const nameLower = companyName.toLowerCase().trim();

  // 1. Exact TSG Known Enterprise Brand Mappings
  if (nameLower.includes('thăng long')) {
    return {
      initials: 'TL',
      gradient: 'from-[#FF2D55] via-[#E01E44] to-[#C70024]',
      subIcon: Wind
    };
  }
  if (nameLower.includes('thanh hoá') || nameLower.includes('thanh hóa')) {
    return {
      initials: 'TH',
      gradient: 'from-[#30B0C7] via-[#0097A7] to-[#007A8D]',
      subIcon: Compass
    };
  }
  if (nameLower.includes('bắc sơn')) {
    return {
      initials: 'BS',
      gradient: 'from-[#FF9500] via-[#F57C00] to-[#D84315]',
      subIcon: Layers
    };
  }
  if (nameLower.includes('ngân sơn')) {
    return {
      initials: 'NS',
      gradient: 'from-[#5856D6] via-[#4338CA] to-[#312E81]',
      subIcon: Award
    };
  }
  if (nameLower.includes('viện thuốc lá') || nameLower.includes('vien thuoc la')) {
    return {
      initials: 'VTL',
      gradient: 'from-[#007AFF] via-[#0284C7] to-[#0369A1]',
      subIcon: Landmark
    };
  }
  if (nameLower.includes('sài gòn') || nameLower.includes('sai gon')) {
    return {
      initials: 'SG',
      gradient: 'from-[#FF6B22] via-[#EA580C] to-[#C2410C]',
      subIcon: Building2
    };
  }
  if (nameLower.includes('bến tre') || nameLower.includes('ben tre')) {
    return {
      initials: 'BT',
      gradient: 'from-[#E11D48] via-[#BE123C] to-[#881337]',
      subIcon: Hexagon
    };
  }
  if (nameLower.includes('cửu long') || nameLower.includes('cuu long')) {
    return {
      initials: 'CL',
      gradient: 'from-[#AF52DE] via-[#9333EA] to-[#6B21A8]',
      subIcon: Layers
    };
  }
  if (nameLower.includes('đà nẵng') || nameLower.includes('da nang')) {
    return {
      initials: 'ĐN',
      gradient: 'from-[#64748B] via-[#475569] to-[#334155]',
      subIcon: Landmark
    };
  }
  if (nameLower.includes('long an')) {
    return {
      initials: 'LA',
      gradient: 'from-[#0284C7] via-[#0369A1] to-[#075985]',
      subIcon: Compass
    };
  }
  if (nameLower.includes('đồng tháp') || nameLower.includes('dong thap')) {
    return {
      initials: 'ĐT',
      gradient: 'from-[#D97706] via-[#B45309] to-[#78350F]',
      subIcon: Layers
    };
  }
  if (nameLower.includes('tâm sen') || nameLower.includes('tam sen')) {
    return {
      initials: 'TSG',
      gradient: 'from-[#0A60A8] via-[#0071C2] to-[#004B87]',
      subIcon: Anchor
    };
  }
  if (nameLower.includes('tuấn bằng') || nameLower.includes('tuan bang')) {
    return {
      initials: 'TB',
      gradient: 'from-[#8B5CF6] via-[#7C3AED] to-[#5B21B6]',
      subIcon: Printer
    };
  }
  if (nameLower.includes('yfy')) {
    return {
      initials: 'YFY',
      gradient: 'from-[#007AFF] via-[#1D4ED8] to-[#1E40AF]',
      subIcon: Box
    };
  }
  if (nameLower.includes('thp') || nameLower.includes('thuận hòa phát') || nameLower.includes('thuan hoa phat')) {
    return {
      initials: 'THP',
      gradient: 'from-[#F97316] via-[#EA580C] to-[#9A3412]',
      subIcon: Factory
    };
  }
  if (nameLower.includes('vidon') || nameLower.includes('mm vidon')) {
    return {
      initials: 'VID',
      gradient: 'from-[#C026D3] via-[#A21CAF] to-[#701A75]',
      subIcon: Award
    };
  }
  if (nameLower.includes('song dũng') || nameLower.includes('song dung')) {
    return {
      initials: 'SD',
      gradient: 'from-[#3B82F6] via-[#2563EB] to-[#1D4ED8]',
      subIcon: Truck
    };
  }
  if (nameLower.includes('sigwerk') || nameLower.includes('siegwerk') || nameLower.includes('sic')) {
    return {
      initials: 'SIC',
      gradient: 'from-[#F43F5E] via-[#E11D48] to-[#9F1239]',
      subIcon: Droplets
    };
  }
  if (nameLower.includes('đại thành long') || nameLower.includes('dai thanh long')) {
    return {
      initials: 'ĐTL',
      gradient: 'from-[#10B981] via-[#059669] to-[#065F46]',
      subIcon: Factory
    };
  }
  if (nameLower.includes('tân thành đạt') || nameLower.includes('tan thanh dat')) {
    return {
      initials: 'TTĐ',
      gradient: 'from-[#2563EB] via-[#1D4ED8] to-[#1E3A8A]',
      subIcon: Building2
    };
  }
  if (nameLower.includes('ipvn')) {
    return {
      initials: 'IPVN',
      gradient: 'from-[#64748B] via-[#475569] to-[#1E293B]',
      subIcon: Box
    };
  }
  if (nameLower.includes('tri-wall') || nameLower.includes('triwall')) {
    return {
      initials: 'TRI',
      gradient: 'from-[#EAB308] via-[#CA8A04] to-[#854D0E]',
      subIcon: Box
    };
  }

  // 2. Generic Intelligent Fallback: Strip noise boilerplate
  let clean = companyName
    .replace(/^(công ty cổ phần kỹ thuật công nghiệp|cong ty co phan ky thuat cong nghiep)/gi, '')
    .replace(/^(công ty tnhh một thành viên|công ty tnhh mtv|công ty tnhh|công ty cp|công ty cổ phần|công ty)/gi, '')
    .replace(/^(cong ty tnhh mot thanh vien|cong ty tnhh mtv|cong ty tnhh|cong ty cp|cong ty co phan|cong ty)/gi, '')
    .replace(/^(doanh nghiệp tư nhân|dntn|tập đoàn|chi nhánh|nhà máy|xí nghiệp)/gi, '')
    .replace(/^(thuốc lá|bao bì|in ấn|thương mại|dịch vụ|sản xuất|kỹ thuật|công nghệ)/gi, '')
    .replace(/^[-–—/:.\s]+/, '')
    .replace(/\s*\([^)]+\)\s*$/, '')
    .trim();

  if (!clean) clean = companyName.trim();

  // Extract initials from cleaned name words
  const words = clean.split(/\s+/).filter(w => w.length > 0 && !/^(và|va|and|of|the|co|ltd|jsc)$/i.test(w));
  let initials = '';

  if (words.length >= 3) {
    initials = (words[0][0] + words[1][0] + words[2][0]).toUpperCase();
  } else if (words.length === 2) {
    initials = (words[0][0] + words[1][0]).toUpperCase();
  } else if (words.length === 1) {
    initials = words[0].substring(0, Math.min(3, words[0].length)).toUpperCase();
  } else {
    initials = 'TS';
  }

  // Calculate stable hash for curated Apple gradient palette
  let hash = 0;
  for (let i = 0; i < companyName.length; i++) {
    hash = companyName.charCodeAt(i) + ((hash << 5) - hash);
  }

  const appleGradients = [
    'from-[#007AFF] via-[#0066CC] to-[#004C99]', // Apple Sapphire
    'from-[#5856D6] via-[#4338CA] to-[#312E81]', // Apple Indigo
    'from-[#34C759] via-[#28A745] to-[#1E7E34]', // Apple Mint
    'from-[#FF9500] via-[#E67E00] to-[#B36200]', // Apple Amber
    'from-[#FF2D55] via-[#E01E44] to-[#B80028]', // Apple Rose
    'from-[#AF52DE] via-[#9333EA] to-[#6B21A8]', // Apple Plum
    'from-[#30B0C7] via-[#0097A7] to-[#007A8D]', // Apple Cyan
    'from-[#636366] via-[#48484A] to-[#2C2C2E]', // Apple Titanium
    'from-[#FF6B22] via-[#EA580C] to-[#C2410C]', // Apple Orange
    'from-[#0A60A8] via-[#0071C2] to-[#004B87]', // Apple Navy
  ];

  const gradient = appleGradients[Math.abs(hash) % appleGradients.length];

  return {
    initials: initials.substring(0, 4),
    gradient
  };
}

export default function CompanyLogo({ 
  name, 
  size = 'md', 
  className = '', 
  logoUrl, 
  logoFit = 'contain' 
}: CompanyLogoProps) {
  const [imageError, setImageError] = useState(false);
  const normalizedName = name ? name.trim() : '';
  
  const sizeClasses = {
    xs: 'w-7 h-7 rounded-[8px]',
    sm: 'w-10 h-10 rounded-[12px]',
    md: 'w-12 h-12 rounded-[14px]',
    lg: 'w-16 h-16 rounded-[18px]',
    xl: 'w-20 h-20 rounded-[22px]'
  };

  const textSizes = {
    xs: 'text-[9px]',
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-lg',
    xl: 'text-2xl'
  };

  if (logoUrl && !imageError) {
    return (
      <div className={`relative bg-white border border-black/[0.08] shadow-[0_1px_3px_rgba(0,0,0,0.04)] shrink-0 overflow-hidden flex items-center justify-center ${sizeClasses[size]} ${className}`}>
        <img 
          src={logoUrl} 
          alt={normalizedName} 
          className={`w-full h-full ${logoFit === 'contain' ? 'object-contain p-1' : 'object-cover'}`}
          referrerPolicy="no-referrer"
          onError={() => setImageError(true)}
        />
      </div>
    );
  }

  const { initials, gradient } = extractBrandInfo(normalizedName);
  const isLongInitials = initials.length >= 3;

  return (
    <div 
      className={`relative flex items-center justify-center bg-gradient-to-br ${gradient} border border-black/[0.08] dark:border-white/10 shadow-[0_2px_6px_rgba(0,0,0,0.06),0_1px_2px_rgba(0,0,0,0.04)] shrink-0 select-none overflow-hidden group transition-transform duration-150 active:scale-95 ${sizeClasses[size]} ${className}`}
    >
      {/* Apple Subtle Specular Glass Highlight */}
      <div className="absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/25 to-transparent pointer-events-none" />
      
      {/* Monogram Acronym */}
      <span 
        className={`font-bold tracking-tight text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.3)] z-10 font-sans ${textSizes[size]} ${isLongInitials ? 'tracking-tighter scale-90' : ''}`}
      >
        {initials}
      </span>
    </div>
  );
}

const processUploadedImage = (file: File, callback: (dataUrl: string) => void) => {
  const reader = new FileReader();
  reader.onload = (event) => {
    const rawData = event.target?.result as string;
    if (!rawData) return;

    if (file.type === "image/svg+xml" || file.size < 500 * 1024) {
      callback(rawData);
      return;
    }

    const img = new Image();
    img.onload = () => {
      const maxDim = 1000;
      let width = img.width;
      let height = img.height;
      if (width > maxDim || height > maxDim) {
        if (width > height) {
          height = Math.round((height * maxDim) / width);
          width = maxDim;
        } else {
          width = Math.round((width * maxDim) / height);
          height = maxDim;
        }
      }
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(img, 0, 0, width, height);
        const compressedData = canvas.toDataURL("image/png");
        callback(compressedData);
      } else {
        callback(rawData);
      }
    };
    img.onerror = () => callback(rawData);
    img.src = rawData;
  };
  reader.readAsDataURL(file);
};

export function TamSenGroupHeaderLogo({ 
  className = "", 
  logoUrl 
}: { 
  className?: string; 
  logoUrl?: string; 
}) {
  const [activeLogo, setActiveLogo] = useState<string | null>(null);

  useEffect(() => {
    if (logoUrl) {
      setActiveLogo(logoUrl);
    } else {
      const saved = localStorage.getItem("tamsen_logo_file");
      if (saved) setActiveLogo(saved);
    }
  }, [logoUrl]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processUploadedImage(file, (dataUrl) => {
        setActiveLogo(dataUrl);
        try {
          localStorage.setItem("tamsen_logo_file", dataUrl);
        } catch (err) {
          console.warn("Storage quota exceeded", err);
        }
      });
    }
  };

  const handleReset = (e: React.MouseEvent) => {
    e.stopPropagation();
    setActiveLogo(null);
    localStorage.removeItem("tamsen_logo_file");
  };

  if (activeLogo) {
    return (
      <div className={`relative group inline-flex items-center select-none ${className}`}>
        <img 
          src={activeLogo} 
          alt="Tâm Sen Group Logo" 
          className="h-12 sm:h-16 max-w-[320px] object-contain"
          referrerPolicy="no-referrer"
        />
        <div className="absolute -bottom-6 left-0 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1.5 bg-slate-900/90 text-white p-1 px-2 rounded-lg shadow-lg text-[10px] z-30">
          <label className="text-sky-300 hover:text-white font-bold cursor-pointer">
            Thay logo file gốc
            <input type="file" accept="image/*" className="hidden" onChange={handleFileUpload} />
          </label>
          <span className="text-slate-500">|</span>
          <button onClick={handleReset} className="text-rose-400 hover:text-rose-200 font-bold">
            Xóa file
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`relative group cursor-pointer flex items-center gap-3.5 select-none ${className}`}>
      <label className="flex items-center gap-3.5 cursor-pointer">
        <input type="file" accept="image/*" className="hidden" onChange={handleFileUpload} />
        
        {/* Precision Lotus Emblem SVG matching Tâm Sen official logo image */}
        <svg className="w-14 h-14 sm:w-16 sm:h-16 shrink-0" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="tsGrad" x1="0%" y1="100%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#0A60A8" />
              <stop offset="100%" stopColor="#009FE3" />
            </linearGradient>
          </defs>

          {/* Top Arc of 5 Dots */}
          <circle cx="50" cy="8" r="4" fill="url(#tsGrad)" />
          <circle cx="37" cy="12" r="3.2" fill="url(#tsGrad)" />
          <circle cx="63" cy="12" r="3.2" fill="url(#tsGrad)" />
          <circle cx="26" cy="19" r="2.3" fill="url(#tsGrad)" />
          <circle cx="74" cy="19" r="2.3" fill="url(#tsGrad)" />

          {/* Top-Left Tilted Leaf & Stem */}
          <path d="M 17 28 C 11 18, 19 8, 25 7 C 23 13, 24 23, 28 27 Z" fill="url(#tsGrad)" />
          <path d="M 19 19 L 23 23 M 20 15 L 23 18" stroke="#FFFFFF" strokeWidth="1" strokeLinecap="round" />

          {/* Outer Circular Arcs */}
          <path d="M 14 34 C 7 52, 14 76, 32 86 C 21 76, 16 57, 18 38 Z" fill="url(#tsGrad)" />
          <path d="M 86 34 C 93 52, 86 76, 68 86 C 79 76, 84 57, 82 38 Z" fill="url(#tsGrad)" />

          {/* Center Lotus Petals Structure */}
          <path d="M 50 20 C 58 36, 56 64, 50 82 C 44 64, 42 36, 50 20 Z" fill="none" stroke="url(#tsGrad)" strokeWidth="4" strokeLinejoin="round" />
          <path d="M 50 28 C 53 42, 52 58, 50 72 C 48 58, 47 42, 50 28 Z" fill="url(#tsGrad)" />

          <path d="M 50 28 C 32 40, 31 66, 45 82 C 38 70, 37 50, 50 28 Z" fill="none" stroke="url(#tsGrad)" strokeWidth="4" strokeLinejoin="round" />
          <path d="M 50 28 C 68 40, 69 66, 55 82 C 62 70, 63 50, 50 28 Z" fill="none" stroke="url(#tsGrad)" strokeWidth="4" strokeLinejoin="round" />

          <path d="M 45 82 C 24 78, 16 62, 27 44 C 24 58, 30 74, 45 82 Z" fill="none" stroke="url(#tsGrad)" strokeWidth="3.6" strokeLinejoin="round" />
          <path d="M 55 82 C 76 78, 84 62, 73 44 C 76 58, 70 74, 55 82 Z" fill="none" stroke="url(#tsGrad)" strokeWidth="3.6" strokeLinejoin="round" />

          {/* Bottom Base Bowl Petals */}
          <path d="M 24 80 C 38 92, 62 92, 76 80 C 64 87, 36 87, 24 80 Z" fill="url(#tsGrad)" />
        </svg>

        {/* Official Typography Layout matching Tâm Sen Group Logo */}
        <div className="flex flex-col justify-center">
          <div className="flex items-center text-2xl sm:text-3xl font-black tracking-tight leading-none uppercase font-sans">
            <span className="text-[#0A60A8]">TÂM SEN</span>
            <span className="text-[#009FE3] ml-2">GROUP</span>
          </div>
          <p className="text-[10px] sm:text-[11px] font-bold text-[#0A60A8] tracking-widest uppercase mt-1 leading-none">
            KẾT NỐI HIỆN TẠI - VỮNG CHÃI TƯƠNG LAI
          </p>
        </div>
      </label>
      <div className="absolute -bottom-5 left-0 opacity-0 group-hover:opacity-100 transition-opacity bg-blue-600 text-white text-[9px] font-bold px-2 py-0.5 rounded shadow pointer-events-none z-20 whitespace-nowrap">
        Click để tải file ảnh logo gốc
      </div>
    </div>
  );
}

export function AnVietPhatGroupHeaderLogo({ 
  className = "", 
  logoUrl 
}: { 
  className?: string; 
  logoUrl?: string; 
}) {
  const [activeLogo, setActiveLogo] = useState<string | null>(null);

  useEffect(() => {
    if (logoUrl) {
      setActiveLogo(logoUrl);
    } else {
      const saved = localStorage.getItem("anvietphat_logo_file");
      if (saved) setActiveLogo(saved);
    }
  }, [logoUrl]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processUploadedImage(file, (dataUrl) => {
        setActiveLogo(dataUrl);
        try {
          localStorage.setItem("anvietphat_logo_file", dataUrl);
        } catch (err) {
          console.warn("Storage quota exceeded", err);
        }
      });
    }
  };

  const handleReset = (e: React.MouseEvent) => {
    e.stopPropagation();
    setActiveLogo(null);
    localStorage.removeItem("anvietphat_logo_file");
  };

  if (activeLogo) {
    return (
      <div className={`relative group inline-flex items-center select-none ${className}`}>
        <img 
          src={activeLogo} 
          alt="An Việt Phát Group Logo" 
          className="h-12 sm:h-16 max-w-[320px] object-contain"
          referrerPolicy="no-referrer"
        />
        <div className="absolute -bottom-6 left-0 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1.5 bg-slate-900/90 text-white p-1 px-2 rounded-lg shadow-lg text-[10px] z-30">
          <label className="text-amber-300 hover:text-white font-bold cursor-pointer">
            Thay logo file gốc
            <input type="file" accept="image/*" className="hidden" onChange={handleFileUpload} />
          </label>
          <span className="text-slate-500">|</span>
          <button onClick={handleReset} className="text-rose-400 hover:text-rose-200 font-bold">
            Xóa file
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`relative group cursor-pointer flex items-center gap-3 select-none ${className}`}>
      <label className="flex items-center gap-3 cursor-pointer">
        <input type="file" accept="image/*" className="hidden" onChange={handleFileUpload} />
        
        {/* Gold Emblem SVG */}
        <svg className="w-14 h-14 shrink-0" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="60" cy="34" r="28" fill="#FCEECB" />
          <circle cx="60" cy="18" r="5" fill="#FFFFFF" />
          <path d="M 55 26 C 50 34, 52 44, 60 50 C 66 54, 68 60, 62 64 C 54 60, 48 50, 52 34 Z" fill="#FFFFFF" />
          <path d="M 60 28 C 68 30, 74 26, 78 20 C 74 30, 66 40, 60 28 Z" fill="#FFFFFF" />

          <path d="M 36 86 L 56 50 L 68 50 L 48 86 Z" fill="#E2C785" />
          <path d="M 68 50 L 84 86 L 72 86 L 58 60 Z" fill="#E2C785" />
          <path d="M 28 74 L 62 74 L 58 80 L 34 80 Z" fill="#E2C785" />
        </svg>

        {/* Typography */}
        <div className="flex flex-col justify-center">
          <h1 className="text-xl font-black text-[#D4AF37] tracking-wider font-sans leading-none uppercase drop-shadow-sm">
            AN VIET PHAT GROUP
          </h1>
          <p className="text-[9.5px] font-semibold text-[#C5A059] tracking-widest uppercase mt-1">
            AN VIET PHAT ENERGY JOINT STOCK COMPANY
          </p>
        </div>
      </label>
      <div className="absolute -bottom-5 left-0 opacity-0 group-hover:opacity-100 transition-opacity bg-amber-600 text-white text-[9px] font-bold px-2 py-0.5 rounded shadow pointer-events-none z-20 whitespace-nowrap">
        Click để tải file ảnh logo gốc
      </div>
    </div>
  );
}
