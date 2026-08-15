/**
 * Utilities for processing and cleaning Vietnamese company names.
 * Helps to strip long standard legal prefixes to reveal the core brand name
 * for better scanning and cleaner UI layout.
 */

export function cleanCompanyName(fullName: string): string {
  if (!fullName) return '';
  
  let name = fullName.trim();
  
  // 1. Common Vietnamese business entity prefixes (ordered by length/specificity)
  const prefixes = [
    // Long specific combinations
    /^(CÔNG TY CỔ PHẦN KỸ THUẬT CÔNG NGHIỆP|CONG TY CO PHAN KY THUAT CONG NGHIEP)/i,
    /^(CÔNG TY TNHH BAO BÌ CÔNG NGHIỆP|CONG TY TNHH BAO BI CONG NGHIEP)/i,
    /^(CÔNG TY CỔ PHẦN THIẾT BỊ|CONG TY CO PHAN THIET BI)/i,
    /^(CÔNG TY TNHH THƯƠNG MẠI DỊCH VỤ|CONG TY TNHH THUONG MAI DICH VU)/i,
    /^(CÔNG TY TNHH SẢN XUẤT THƯƠNG MẠI|CONG TY TNHH SAN XUAT THUONG MAI)/i,
    /^(CÔNG TY CỔ PHẦN SẢN XUẤT|CONG TY CO PHAN SAN XUAT)/i,
    /^(CÔNG TY TNHH BAO BÌ|CONG TY TNHH BAO BI)/i,
    /^(CÔNG TY CỔ PHẦN IN|CONG TY CO PHAN IN)/i,
    
    // Standard prefixes
    /^(CÔNG TY TRÁCH NHIỆM HỮU HẠN|CONG TY TRACH NIEM HUU HAN)/i,
    /^(CÔNG TY CỔ PHẦN|CÔNG TY CO PHAN|CÔNG TY TNHH|CONG TY TNHH|CÔNG TY CP|CONG TY CP)/i,
    /^(CÔNG TY|CONG TY)/i,
    
    // Title Case variations
    /^(Công ty Cổ phần Kỹ thuật Công nghiệp)/i,
    /^(Công ty TNHH Bao bì Công nghiệp)/i,
    /^(Công ty Cổ phần Thiết bị)/i,
    /^(Công ty TNHH Thương mại Dịch vụ)/i,
    /^(Công ty TNHH Sản xuất Thương mại)/i,
    /^(Công ty Cổ phần Sản xuất)/i,
    /^(Công ty TNHH Bao bì)/i,
    /^(Công ty Cổ phần In)/i,
    /^(Công ty Trách nhiệm hữu hạn)/i,
    /^(Công ty Cổ phần|Công ty TNHH|Công ty CP)/i,
    /^(Công ty)/i,
    
    // Private enterprises
    /^(DNTN|Doanh nghiệp tư nhân)/i
  ];
  
  for (const regex of prefixes) {
    const prev = name;
    name = name.replace(regex, '');
    if (name.trim() !== prev.trim()) {
      break; // stop at the first matched prefix
    }
  }
  
  name = name.trim();
  
  // If the string starts with a hyphen, slash, or dot after removing prefix, clean it up
  name = name.replace(/^[-–—/:.\s]+/, '');
  
  // Remove any trailing parentheses with abbreviations or English/alternative names (e.g. "(PTP)", "(SIC)", "(SIC Primex JSC)")
  name = name.replace(/\s*\([^)]+\)\s*$/, '');
  
  // If we ended up with an empty string, fallback to original
  if (!name) return fullName;
  
  return name.trim();
}

/**
 * Checks if the clean name is highly repetitive compared to the full name.
 * Useful to avoid displaying redundant name subtitles in UI.
 */
export function isNameRepetitive(cleanName: string, fullName: string): boolean {
  if (!cleanName || !fullName) return false;
  const c = cleanName.toLowerCase().trim();
  const f = fullName.toLowerCase().trim();
  
  if (c === f) return true;
  
  // Strip common business prefixes from full name to see if it becomes the clean name
  const prefixes = [
    'công ty cổ phần kỹ thuật công nghiệp', 'cong ty co phan ky thuat cong nghiep',
    'công ty tnhh bao bì công nghiệp', 'cong ty tnhh bao bi cong nghiep',
    'công ty cổ phần thiết bị', 'cong ty co phan thiet bi',
    'công ty tnhh thương mại dịch vụ', 'cong ty tnhh thuong mai dich vu',
    'công ty tnhh sản xuất thương mại', 'cong ty tnhh san xuat thuong mai',
    'công ty cổ phần sản xuất', 'cong ty co phan san xuat',
    'công ty tnhh bao bì', 'cong ty tnhh bao bi',
    'công ty cổ phần in', 'cong ty co phan in',
    'công ty trách nhiệm hữu hạn', 'cong ty trach niem huu han',
    'công ty cổ phần', 'công ty co phan', 'công ty tnhh', 'cong ty tnhh', 'công ty cp', 'cong ty cp',
    'công ty', 'cong ty',
    'công ty tnhh một thành viên', 'công ty tnhh mtv',
    'doanh nghiệp tư nhân', 'dntn'
  ];
  
  let strippedFull = f;
  for (const prefix of prefixes) {
    if (strippedFull.startsWith(prefix)) {
      strippedFull = strippedFull.substring(prefix.length).trim();
      break;
    }
  }
  
  // Strip common punctuation dividers
  strippedFull = strippedFull.replace(/^[-–—/:.\s]+/, '').trim();
  
  // Remove trailing parentheses
  strippedFull = strippedFull.replace(/\s*\([^)]+\)\s*$/, '').trim();
  
  if (strippedFull === c) return true;
  
  // Also if one contains the other and they are short or similar
  if (f.includes(c) && (f.length - c.length < 20)) {
    return true;
  }
  
  return false;
}
