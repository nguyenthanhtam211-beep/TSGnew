import React, { useState, useEffect } from 'react';
import { Building2, Layers, Compass, Wind, Anchor, Award, Box, Factory, Truck, Printer, Droplets, Sliders } from 'lucide-react';

interface CompanyLogoProps {
  name: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  logoUrl?: string;
  logoFit?: 'cover' | 'contain';
}

export default function CompanyLogo({ name, size = 'md', className = '', logoUrl, logoFit = 'contain' }: CompanyLogoProps) {
  const [imageError, setImageError] = useState(false);
  const normalizedName = name ? name.trim() : '';
  
  const sizeClasses = {
    xs: 'w-7 h-7 text-[10px]',
    sm: 'w-12 h-12 text-xs',
    md: 'w-14 h-14 text-sm',
    lg: 'w-18 h-18 text-lg',
    xl: 'w-24 h-24 text-2xl'
  };

  if (logoUrl && !imageError) {
    return (
      <img 
        src={logoUrl} 
        alt={normalizedName} 
        className={`${logoFit === 'contain' ? 'object-contain bg-white p-1' : 'object-cover'} rounded-xl border border-slate-200/80 shadow-sm shrink-0 ${sizeClasses[size]} ${className}`}
        referrerPolicy="no-referrer"
        onError={() => setImageError(true)}
      />
    );
  }
  
  // Custom design configurations for major companies
  const getLogoConfig = (compName: string) => {
    const nameLower = compName.toLowerCase();
    
    if (nameLower.includes('thăng long')) {
      return {
        initials: 'TL',
        gradient: 'from-red-600 via-rose-700 to-crimson-800',
        textColor: 'text-rose-100',
        icon: Wind,
        accentColor: 'border-rose-200'
      };
    }
    if (nameLower.includes('thanh hoá')) {
      return {
        initials: 'TH',
        gradient: 'from-emerald-600 to-teal-800',
        textColor: 'text-emerald-50',
        icon: Compass,
        accentColor: 'border-emerald-200'
      };
    }
    if (nameLower.includes('bắc sơn')) {
      return {
        initials: 'BS',
        gradient: 'from-amber-500 to-orange-700',
        textColor: 'text-amber-50',
        icon: Layers,
        accentColor: 'border-amber-200'
      };
    }
    if (nameLower.includes('tâm sen')) {
      return {
        initials: 'TS',
        gradient: 'from-cyan-500 via-teal-600 to-blue-700',
        textColor: 'text-cyan-50',
        icon: Anchor,
        accentColor: 'border-cyan-200'
      };
    }
    if (nameLower.includes('tuấn bằng')) {
      return {
        initials: 'TB',
        gradient: 'from-purple-600 to-indigo-800',
        textColor: 'text-purple-50',
        icon: Printer,
        accentColor: 'border-purple-200'
      };
    }
    if (nameLower.includes('yfy')) {
      return {
        initials: 'YF',
        gradient: 'from-blue-600 to-sky-800',
        textColor: 'text-blue-50',
        icon: Box,
        accentColor: 'border-blue-200'
      };
    }
    if (nameLower.includes('thp') || nameLower.includes('thuận hòa phát')) {
      return {
        initials: 'HP',
        gradient: 'from-orange-500 to-red-700',
        textColor: 'text-orange-50',
        icon: Factory,
        accentColor: 'border-orange-200'
      };
    }
    if (nameLower.includes('mm vidon') || nameLower.includes('vidon')) {
      return {
        initials: 'MM',
        gradient: 'from-violet-600 to-fuchsia-800',
        textColor: 'text-violet-50',
        icon: Award,
        accentColor: 'border-violet-200'
      };
    }
    if (nameLower.includes('song dũng')) {
      return {
        initials: 'SD',
        gradient: 'from-blue-500 to-indigo-600',
        textColor: 'text-blue-50',
        icon: Truck,
        accentColor: 'border-blue-200'
      };
    }
    if (nameLower.includes('sigwerk') || nameLower.includes('siegwerk') || nameLower.includes('sic')) {
      return {
        initials: 'SW',
        gradient: 'from-pink-600 to-rose-800',
        textColor: 'text-pink-50',
        icon: Droplets,
        accentColor: 'border-pink-200'
      };
    }

    // Default auto-generated based on string hashing
    let hash = 0;
    for (let i = 0; i < compName.length; i++) {
      hash = compName.charCodeAt(i) + ((hash << 5) - hash);
    }
    
    const gradients = [
      'from-blue-600 to-indigo-700',
      'from-purple-600 to-pink-700',
      'from-emerald-500 to-teal-700',
      'from-amber-500 to-orange-600',
      'from-red-500 to-rose-700',
      'from-cyan-500 to-blue-600',
      'from-fuchsia-500 to-purple-700',
      'from-sky-500 to-indigo-600'
    ];
    const icons = [Building2, Layers, Box, Factory, Sliders, Award];
    
    const gradientIdx = Math.abs(hash) % gradients.length;
    const iconIdx = Math.abs(hash) % icons.length;
    
    const words = compName.split(/\s+/).filter(w => w.length > 0);
    let initials = '';
    if (words.length >= 2) {
      initials = (words[0][0] + words[1][0]).toUpperCase();
    } else if (words.length === 1) {
      initials = words[0].substring(0, 2).toUpperCase();
    } else {
      initials = 'CO';
    }

    return {
      initials: initials.substring(0, 2),
      gradient: gradients[gradientIdx],
      textColor: 'text-white',
      icon: icons[iconIdx],
      accentColor: 'border-gray-100'
    };
  };

  const config = getLogoConfig(normalizedName);
  const IconComponent = config.icon;

  const iconSizes = {
    xs: 10,
    sm: 12,
    md: 14,
    lg: 18,
    xl: 24
  };

  return (
    <div className={`relative flex items-center justify-center rounded-xl bg-gradient-to-br ${config.gradient} shadow-sm border border-black/5 ${sizeClasses[size]} ${className} shrink-0 select-none overflow-hidden group`}>
      {/* Background soft element */}
      <div className="absolute inset-0 bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity" />
      
      {/* Visual content: initials and a small floating indicator icon */}
      <div className="flex flex-col items-center justify-center font-bold tracking-wider leading-none text-white z-10">
        <span className="drop-shadow-sm">{config.initials}</span>
      </div>
      
      {/* Micro floating icon */}
      {size !== 'xs' && (
        <div className="absolute bottom-1 right-1 p-0.5 rounded-full bg-black/10 text-white/80">
          <IconComponent size={iconSizes[size] - 2} />
        </div>
      )}
    </div>
  );
}

const processUploadedImage = (file: File, callback: (dataUrl: string) => void) => {
  const reader = new FileReader();
  reader.onload = (event) => {
    const rawData = event.target?.result as string;
    if (!rawData) return;

    // SVG or small files use rawData directly
    if (file.type === "image/svg+xml" || file.size < 500 * 1024) {
      callback(rawData);
      return;
    }

    // Resize raster images to prevent out-of-memory errors in PDF generator
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
          {/* Leaf veins */}
          <path d="M 19 19 L 23 23 M 20 15 L 23 18" stroke="#FFFFFF" strokeWidth="1" strokeLinecap="round" />

          {/* Outer Circular Arcs */}
          <path d="M 14 34 C 7 52, 14 76, 32 86 C 21 76, 16 57, 18 38 Z" fill="url(#tsGrad)" />
          <path d="M 86 34 C 93 52, 86 76, 68 86 C 79 76, 84 57, 82 38 Z" fill="url(#tsGrad)" />

          {/* Center Lotus Petals Structure */}
          {/* Main Central Petal */}
          <path d="M 50 20 C 58 36, 56 64, 50 82 C 44 64, 42 36, 50 20 Z" fill="none" stroke="url(#tsGrad)" strokeWidth="4" strokeLinejoin="round" />
          <path d="M 50 28 C 53 42, 52 58, 50 72 C 48 58, 47 42, 50 28 Z" fill="url(#tsGrad)" />

          {/* Inner Side Petals */}
          <path d="M 50 28 C 32 40, 31 66, 45 82 C 38 70, 37 50, 50 28 Z" fill="none" stroke="url(#tsGrad)" strokeWidth="4" strokeLinejoin="round" />
          <path d="M 50 28 C 68 40, 69 66, 55 82 C 62 70, 63 50, 50 28 Z" fill="none" stroke="url(#tsGrad)" strokeWidth="4" strokeLinejoin="round" />

          {/* Outer Side Petals */}
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
        
        {/* Gold Emblem SVG matching An Việt Phát logo */}
        <svg className="w-14 h-14 shrink-0" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
          {/* Circle Emblem Background */}
          <circle cx="60" cy="34" r="28" fill="#FCEECB" />
          {/* White Stylized Leaf motif */}
          <circle cx="60" cy="18" r="5" fill="#FFFFFF" />
          <path d="M 55 26 C 50 34, 52 44, 60 50 C 66 54, 68 60, 62 64 C 54 60, 48 50, 52 34 Z" fill="#FFFFFF" />
          <path d="M 60 28 C 68 30, 74 26, 78 20 C 74 30, 66 40, 60 28 Z" fill="#FFFFFF" />

          {/* Gold AV Wing Shape */}
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

