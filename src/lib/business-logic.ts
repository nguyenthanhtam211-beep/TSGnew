
/**
 * TSG Business OS - Centralized Business Logic
 * Source of Truth for all financial and logistical calculations
 */

export const parseNumber = (val: any): number => {
  if (val === null || val === undefined || val === '') return 0;
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  let str = String(val).trim();
  if (!str) return 0;

  // Handle accounting parentheses negative: (100) -> -100
  let isNegative = false;
  if (str.startsWith('(') && str.endsWith(')')) {
    isNegative = true;
    str = str.slice(1, -1).trim();
  } else if (str.startsWith('-')) {
    isNegative = true;
    str = str.slice(1).trim();
  }

  // Remove currency signs, percentage signs and words
  str = str.replace(/[₫đ$VNDvnd%\s]/gi, '');

  // If both dot and comma exist:
  if (str.includes('.') && str.includes(',')) {
    if (str.indexOf('.') < str.indexOf(',')) {
      // Format "1.234.567,89" (VN standard: dot is thousand, comma is decimal)
      str = str.replace(/\./g, '').replace(',', '.');
    } else {
      // Format "1,234,567.89" (US standard: comma is thousand, dot is decimal)
      str = str.replace(/,/g, '');
    }
  } else if (str.includes(',')) {
    // Only commas exist: e.g. "9,008" or "2,316" or "10,861" or "2,5" or "35,63"
    const parts = str.split(',');
    if (parts.length > 2 || (parts.length === 2 && parts[1].length === 3)) {
      str = str.replace(/,/g, '');
    } else {
      str = str.replace(',', '.');
    }
  } else if (str.includes('.')) {
    // Only dots exist: e.g. "10.861" or "9.008" or "718.062.120" vs "35.63" or "2.5"
    const parts = str.split('.');
    if (parts.length > 2 || (parts.length === 2 && parts[1].length === 3)) {
      str = str.replace(/\./g, '');
    }
  }

  const cleaned = str.replace(/[^0-9.-]+/g, '');
  const num = parseFloat(cleaned);
  if (isNaN(num)) return 0;
  return isNegative ? -Math.abs(num) : num;
};

export const formatVND = (amount: number) => {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
  }).format(amount);
};

export interface PriceLookupParams {
  sku?: string;
  name?: string;
  code?: string;
  customer?: string;
  location?: string;
}

/**
 * Normalizes Vietnamese text by removing accents, special characters, and converting to lowercase
 */
export const normalizeString = (str: any): string => {
  if (str === null || str === undefined) return '';
  return String(str)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
};

/**
 * Calculates match similarity score between OCR query text and a pricing record
 */
export const scoreProductMatch = (ocrQuery: string, priceRecord: any, customer?: string): number => {
  if (!ocrQuery || !priceRecord) return 0;

  const normQuery = normalizeString(ocrQuery);
  if (!normQuery) return 0;

  const recordCode = normalizeString(priceRecord["Mã giá bán"] || priceRecord["Mã giá"] || priceRecord["Mã sản phẩm"] || priceRecord["Mã hàng"] || priceRecord["SKU"] || "");
  const recordName = normalizeString(priceRecord["Tên sản phẩm"] || priceRecord["Tên hàng hóa"] || "");
  const recordCust = normalizeString(priceRecord["RP_Khách hàng"] || priceRecord["Khách hàng"] || priceRecord["Tên khách hàng"] || priceRecord["Giao đến"] || "");

  let score = 0;

  // 1. Customer match bonus
  if (customer) {
    const normCust = normalizeString(customer);
    if (normCust && recordCust && (recordCust.includes(normCust) || normCust.includes(recordCust))) {
      score += 25;
    }
  }

  // 2. Exact code match
  if (recordCode && (normQuery === recordCode || normQuery.includes(recordCode) || recordCode.includes(normQuery))) {
    score += 50;
  }

  // 3. Exact name match
  if (recordName && (normQuery === recordName || normQuery.includes(recordName) || recordName.includes(normQuery))) {
    score += 40;
  }

  // 4. Token overlap scoring
  const queryTokens = normQuery.split(" ").filter(t => t.length > 1);
  const targetTokens = `${recordCode} ${recordName}`.split(" ").filter(t => t.length > 1);

  if (queryTokens.length > 0 && targetTokens.length > 0) {
    let matchCount = 0;
    queryTokens.forEach(qToken => {
      if (targetTokens.some(tToken => tToken === qToken || tToken.includes(qToken) || qToken.includes(tToken))) {
        matchCount++;
      }
    });
    score += (matchCount / Math.max(queryTokens.length, 1)) * 35;
  }

  return score;
};

/**
 * Finds the correct pricing record (Gsp_XXX) based on smart fuzzy keyword matching
 */
export const findPriceRecord = (pricingData: any[], params: PriceLookupParams | string) => {
  if (!pricingData || pricingData.length === 0) return null;

  let sku = "";
  let name = "";
  let customer = "";
  let location = "";

  if (typeof params === 'string') {
    sku = params;
  } else if (params) {
    sku = params.sku || params.code || "";
    name = params.name || "";
    customer = params.customer || "";
    location = params.location || "";
  }

  const normSku = normalizeString(sku);
  const normName = normalizeString(name);
  const combinedQuery = `${sku} ${name}`.trim();
  if (!combinedQuery && !normSku && !normName) return null;

  // 0. Direct exact match by Price Code (Mã giá bán / Mã giá) or Product Code across whole pricing table
  if (normSku) {
    const directPriceMatch = pricingData.find(p => {
      const pPriceCode = normalizeString(p["Mã giá bán"] || p["Mã giá"] || "");
      const pProdCode = normalizeString(p["Mã sản phẩm"] || p["Mã hàng"] || p["SKU"] || "");
      return (pPriceCode && pPriceCode === normSku) || (pProdCode && pProdCode === normSku);
    });
    if (directPriceMatch) return directPriceMatch;
  }

  // 1. Filter by customer if provided and matches exist
  let candidates = pricingData;
  if (customer) {
    const normCust = normalizeString(customer);
    const customerFiltered = pricingData.filter(p => {
      const c = normalizeString(p["RP_Khách hàng"] || p["Khách hàng"] || p["Tên khách hàng"] || p["Giao đến"] || "");
      return c.includes(normCust) || normCust.includes(c);
    });
    if (customerFiltered.length > 0) {
      candidates = customerFiltered;
    }
  }

  // 2. Priority match with destination / location if provided
  if (location) {
    const normLoc = normalizeString(location);
    const matchedLoc = candidates.find(p => {
      const pLoc = normalizeString(p["Giao đến"] || p["Địa điểm giao hàng"] || p["Địa chỉ giao hàng"] || "");
      const pPriceCode = normalizeString(p["Mã giá bán"] || p["Mã giá"] || "");
      const pProdCode = normalizeString(p["Mã sản phẩm"] || p["Mã hàng"] || "");
      const pName = normalizeString(p["Tên sản phẩm"] || p["Tên hàng hóa"] || "");
      const isLocMatch = pLoc && (pLoc.includes(normLoc) || normLoc.includes(pLoc));
      const isCodeMatch = (normSku && (pPriceCode === normSku || pProdCode === normSku || pPriceCode.includes(normSku) || normSku.includes(pPriceCode) || pProdCode.includes(normSku) || normSku.includes(pProdCode)));
      const isNameMatch = (normName && (pName.includes(normName) || normName.includes(pName)));
      return isLocMatch && (isCodeMatch || isNameMatch);
    });
    if (matchedLoc) return matchedLoc;
  }

  // 3. Exact Code Match in candidates (Mã giá bán, Mã giá, Mã sản phẩm, Mã hàng)
  if (normSku) {
    const exactCodeMatch = candidates.find(p => {
      const pPriceCode = normalizeString(p["Mã giá bán"] || p["Mã giá"] || "");
      const pProdCode = normalizeString(p["Mã sản phẩm"] || p["Mã hàng"] || "");
      return (pPriceCode && (pPriceCode === normSku || normSku.includes(pPriceCode) || pPriceCode.includes(normSku))) ||
             (pProdCode && (pProdCode === normSku || normSku.includes(pProdCode) || pProdCode.includes(normSku)));
    });
    if (exactCodeMatch) return exactCodeMatch;
  }

  // 4. Fallback search on whole pricing data if candidates had no exact match
  if (normSku && candidates !== pricingData) {
    const globalCodeMatch = pricingData.find(p => {
      const pPriceCode = normalizeString(p["Mã giá bán"] || p["Mã giá"] || "");
      const pProdCode = normalizeString(p["Mã sản phẩm"] || p["Mã hàng"] || "");
      return (pPriceCode && (pPriceCode === normSku || normSku.includes(pPriceCode) || pPriceCode.includes(normSku))) ||
             (pProdCode && (pProdCode === normSku || normSku.includes(pProdCode) || pProdCode.includes(normSku)));
    });
    if (globalCodeMatch) return globalCodeMatch;
  }

  // 5. Fuzzy score all candidates
  let bestRecord: any = null;
  let maxScore = 0;

  for (const record of candidates) {
    const score = scoreProductMatch(combinedQuery || sku || name, record, customer);
    if (score > maxScore) {
      maxScore = score;
      bestRecord = record;
    }
  }

  // If score not enough and candidates was filtered, try entire pricingData
  if (maxScore < 10 && candidates !== pricingData) {
    for (const record of pricingData) {
      const score = scoreProductMatch(combinedQuery || sku || name, record, customer);
      if (score > maxScore) {
        maxScore = score;
        bestRecord = record;
      }
    }
  }

  // Require minimum score threshold (10)
  return maxScore >= 10 ? bestRecord : null;
};

/**
 * Returns top matching pricing candidates based on query text and customer
 */
export const findMatchingSuggestions = (pricingData: any[], query: string, customer?: string, limit = 4) => {
  if (!pricingData || !query) return [];

  let candidates = pricingData;
  if (customer) {
    const normCust = normalizeString(customer);
    const customerFiltered = pricingData.filter(p => {
      const c = normalizeString(p["RP_Khách hàng"] || p["Khách hàng"] || p["Tên khách hàng"] || p["Giao đến"] || "");
      return c.includes(normCust) || normCust.includes(c);
    });
    if (customerFiltered.length > 0) candidates = customerFiltered;
  }

  const scored = candidates.map(record => ({
    record,
    score: scoreProductMatch(query, record, customer)
  })).filter(item => item.score > 5);

  scored.sort((a, b) => b.score - a.score);

  // Return unique product codes
  const seenCodes = new Set();
  const uniqueSuggestions: any[] = [];

  for (const item of scored) {
    const code = item.record["Mã giá bán"] || item.record["Mã giá"] || item.record["Mã sản phẩm"] || item.record["Mã hàng"];
    if (code && !seenCodes.has(code)) {
      seenCodes.add(code);
      uniqueSuggestions.push(item.record);
    }
    if (uniqueSuggestions.length >= limit) break;
  }

  return uniqueSuggestions;
};

export const getSellPriceFromRecord = (record: any): number => {
  if (!record) return 0;
  return parseNumber(record['Đơn giá bán mới']) ||
         parseNumber(record['Đơn giá bán']) ||
         parseNumber(record['Giá bán']) ||
         0;
};

export const getBuyPriceFromRecord = (record: any): number => {
  if (!record) return 0;
  return parseNumber(record['Đơn giá mua mới']) ||
         parseNumber(record['Đơn giá mua']) ||
         parseNumber(record['Giá nhập']) ||
         parseNumber(record['Giá mua']) ||
         parseNumber(record['Giá AVP']) ||
         parseNumber(record['Giá vốn']) ||
         parseNumber(record['Giá trị vốn']) ||
         0;
};

/**
 * Standard calculation for a delivery row
 */
export const calculateDeliveryFinances = (
  delivery: any, 
  pricingData: any[], 
  poLinesData: any[]
) => {
  const explicitRev = parseNumber(delivery["Doanh thu"] || delivery["Thành tiền"]);
  const explicitProf = parseNumber(delivery["Lợi nhuận gộp"] || delivery["Lợi nhuận dòng"]);
  const explicitSell = parseNumber(delivery["Đơn giá bán"] || delivery["Đơn giá"]);
  const explicitBuy = parseNumber(delivery["Đơn giá nhập"] || delivery["Đơn giá mua"] || delivery["Đơn giá COGS"]);
  const qty = parseNumber(delivery["Số lượng giao"] ?? delivery["Số lượng"]);

  // If explicit revenue is already recorded (e.g. from invoices / actual sales ledger), prioritize it!
  if (explicitRev > 0) {
    const sellPrice = explicitSell > 0 ? explicitSell : (qty > 0 ? explicitRev / qty : 0);
    const buyPrice = explicitBuy > 0 ? explicitBuy : (qty > 0 && explicitProf > 0 ? Math.max(0, explicitRev - explicitProf) / qty : 0);
    const profit = explicitProf > 0 ? explicitProf : Math.max(0, explicitRev - (buyPrice * qty));
    const margin = explicitRev > 0 ? (profit / explicitRev) * 100 : 0;

    return {
      sellPrice: isNaN(sellPrice) ? 0 : sellPrice,
      buyPrice: isNaN(buyPrice) ? 0 : buyPrice,
      revenue: explicitRev,
      profit: isNaN(profit) ? 0 : profit,
      margin: isNaN(margin) ? 0 : margin,
      priceCode: delivery["Mã giá bán"] || delivery["Mã giá"] || delivery["Mã sản phẩm"] || "N/A",
      isDiscrepancy: false
    };
  }

  const sku = delivery["Mã sản phẩm"] || delivery["Mã hàng"] || delivery["Mã giá"] || delivery["Mã giá bán"] || delivery["Tên sản phẩm"];
  const customer = delivery["Khách hàng"] || delivery["Tên khách hàng"];
  const location = delivery["Địa điểm giao hàng"] || delivery["Địa chỉ giao hàng"] || delivery["Giao đến"];

  // Lookup source prices
  const priceRecord = findPriceRecord(pricingData, { sku, name: delivery["Tên sản phẩm"], customer, location });
  
  // Find associated PO Line for secondary lookup
  const poLine = (poLinesData || []).find(l => 
    !l.isDeleted && (
      (delivery["Chi tiết đơn hàng"] && String(l["STT"] || l.id) === String(delivery["Chi tiết đơn hàng"])) ||
      (l["Số đơn hàng"] && delivery["Đơn hàng"] && String(l["Số đơn hàng"]).trim().toLowerCase() === String(delivery["Đơn hàng"]).trim().toLowerCase() && (
        l["Tên sản phẩm"] === delivery["Tên sản phẩm"] || 
        l["Mã sản phẩm"] === sku || 
        l["Mã của khách"] === sku || 
        l["Mã giá bán"] === sku
      ))
    )
  );

  const priceRecSell = getSellPriceFromRecord(priceRecord);
  const priceRecBuy = getBuyPriceFromRecord(priceRecord);

  // Determine Prices (Priority: Price Table -> PO Line -> Delivery Row -> Inferred from Total / Qty)
  let sellPrice = priceRecSell > 0 ? priceRecSell : 
                  (poLine && parseNumber(poLine['Đơn giá bán']) > 0 ? parseNumber(poLine['Đơn giá bán']) : parseNumber(delivery['Đơn giá bán'] || delivery['Đơn giá']));
  
  if (sellPrice <= 0 && poLine && parseNumber(poLine['Thành tiền dòng'] || poLine['Thành tiền']) > 0 && parseNumber(poLine['Số lượng']) > 0) {
    sellPrice = parseNumber(poLine['Thành tiền dòng'] || poLine['Thành tiền']) / parseNumber(poLine['Số lượng']);
  }

  let buyPrice = priceRecBuy > 0 ? priceRecBuy : 
                 (poLine && parseNumber(poLine['Đơn giá nhập'] || poLine['Đơn giá mua']) > 0 ? parseNumber(poLine['Đơn giá nhập'] || poLine['Đơn giá mua']) : parseNumber(delivery['Đơn giá nhập'] || delivery['Đơn giá mua'] || delivery['Giá vốn']));

  if (buyPrice <= 0 && poLine && parseNumber(poLine['Thành tiền mua'] || poLine['Giá trị vốn']) > 0 && parseNumber(poLine['Số lượng']) > 0) {
    buyPrice = parseNumber(poLine['Thành tiền mua'] || poLine['Giá trị vốn']) / parseNumber(poLine['Số lượng']);
  }

  const revenue = sellPrice * qty;
  const profit = (sellPrice - buyPrice) * qty;
  const margin = sellPrice > 0 ? ((sellPrice - buyPrice) / sellPrice) * 100 : 0;

  return {
    sellPrice: isNaN(sellPrice) ? 0 : sellPrice,
    buyPrice: isNaN(buyPrice) ? 0 : buyPrice,
    revenue: isNaN(revenue) ? 0 : revenue,
    profit: isNaN(profit) ? 0 : profit,
    margin: isNaN(margin) ? 0 : margin,
    priceCode: priceRecord ? (priceRecord['Mã giá bán'] || priceRecord['Mã giá'] || priceRecord['Mã sản phẩm']) : (poLine?.['Mã giá bán'] || 'N/A'),
    isDiscrepancy: false
  };
};

/**
 * Standard calculation for a PO Line row (Header aggregation source)
 */
export const calculatePOLineFinances = (
  poLine: any,
  pricingData: any[]
) => {
  const sku = poLine["Mã của khách"] || poLine["Mã sản phẩm"] || poLine["Mã giá bán"] || poLine["Mã hàng"] || poLine["Tên sản phẩm"];
  const customer = poLine["Khách hàng"] || poLine["Tên khách hàng"];
  const location = poLine["Địa điểm giao hàng"] || poLine["Đơn vị nhận hàng"] || poLine["Giao đến"];
  const qty = parseNumber(poLine["Số lượng"]);

  // Lookup source prices
  const priceRecord = findPriceRecord(pricingData, { sku, name: poLine["Tên sản phẩm"], customer, location });

  const priceRecSell = getSellPriceFromRecord(priceRecord);
  const priceRecBuy = getBuyPriceFromRecord(priceRecord);

  let sellPrice = priceRecSell > 0 ? priceRecSell : parseNumber(poLine['Đơn giá bán'] || poLine['Đơn giá']);
  if (sellPrice <= 0 && qty > 0) {
    const lineTotal = parseNumber(poLine['Thành tiền dòng'] || poLine['Thành tiền'] || poLine['Tổng tiền']);
    if (lineTotal > 0) {
      sellPrice = lineTotal / qty;
    }
  }

  let buyPrice = priceRecBuy > 0 ? priceRecBuy : parseNumber(poLine['Đơn giá nhập'] || poLine['Đơn giá mua'] || poLine['Giá vốn']);
  if (buyPrice <= 0 && qty > 0) {
    const cogsTotal = parseNumber(poLine['Thành tiền mua'] || poLine['Tổng tiền mua'] || poLine['Giá trị vốn']);
    if (cogsTotal > 0) {
      buyPrice = cogsTotal / qty;
    }
  }

  const revenue = sellPrice * qty;
  const profit = (sellPrice - buyPrice) * qty;
  const margin = sellPrice > 0 ? ((sellPrice - buyPrice) / sellPrice) * 100 : 0;

  return {
    sellPrice: isNaN(sellPrice) ? 0 : sellPrice,
    buyPrice: isNaN(buyPrice) ? 0 : buyPrice,
    revenue: isNaN(revenue) ? 0 : revenue,
    profit: isNaN(profit) ? 0 : profit,
    margin: isNaN(margin) ? 0 : margin,
    priceCode: priceRecord ? (priceRecord['Mã giá bán'] || priceRecord['Mã giá'] || priceRecord['Mã sản phẩm']) : (poLine['Mã giá bán'] || 'N/A')
  };
};

/**
 * Safely parses any date string (dd/mm/yyyy, yyyy-mm-dd, dd-mm-yyyy, ISO timestamp) into 'YYYY-MM-DD'
 * for HTML <input type="date" value={...} />
 */
export const parseDateToISO = (val: any): string => {
  if (!val) return '';
  const str = String(val).trim();
  if (!str) return '';

  // Already YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    return str;
  }

  // DD/MM/YYYY or DD-MM-YYYY
  const dmyMatch = str.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
  if (dmyMatch) {
    const day = dmyMatch[1].padStart(2, '0');
    const month = dmyMatch[2].padStart(2, '0');
    const year = dmyMatch[3];
    return `${year}-${month}-${day}`;
  }

  // YYYY/MM/DD
  const ymdMatch = str.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})/);
  if (ymdMatch) {
    const year = ymdMatch[1];
    const month = ymdMatch[2].padStart(2, '0');
    const day = ymdMatch[3].padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  // Date object or timestamp
  const dateObj = new Date(str);
  if (!isNaN(dateObj.getTime())) {
    const year = dateObj.getFullYear();
    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
    const day = String(dateObj.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  return '';
};

/**
 * Formats any date string into standard display format 'DD/MM/YYYY'
 */
export const formatDateForDisplay = (val: any): string => {
  if (!val) return '';
  const iso = parseDateToISO(val);
  if (!iso) return String(val);
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
};

/**
 * Trích xuất tên ngắn gọn & quy cách chi tiết của sản phẩm để tránh tên quá dài
 * Ví dụ: "Lưỡi gà trắng 71mm x 800m x 210gsm" -> { shortName: "Lưỡi gà trắng 71mm", specDetail: "800m x 210gsm" }
 */
export const parseProductNameAndSpecs = (fullName: string): { shortName: string; specDetail: string } => {
  if (!fullName) return { shortName: '', specDetail: '' };
  const raw = fullName.trim();
  
  // Kiểm tra các mẫu phân tách phổ biến
  if (raw.includes(' x ') || raw.includes(' - ')) {
    const parts = raw.split(/ [x\-] /);
    if (parts.length >= 2) {
      return {
        shortName: parts[0].trim(),
        specDetail: parts.slice(1).join(' x ').trim()
      };
    }
  }

  return { shortName: raw, specDetail: '' };
};

/**
 * Tra cứu thực thể Sản phẩm hợp nhất (Single Source of Truth) xuyên suốt các bảng:
 * Products, Specs, Pricing, Contracts, PO_Lines, Deliveries
 */
export const findUnifiedProductEntity = (params: {
  productData: any[];
  specsData?: any[];
  pricingData?: any[];
  contractsData?: any[];
  poLines?: any[];
  query: string;
}) => {
  const { productData, specsData = [], pricingData = [], contractsData = [], poLines = [], query } = params;
  if (!query) return null;

  const normQuery = normalizeString(query);

  // 1. Tìm trong danh mục Master Products
  const matchedProduct = productData.find(p => {
    const code = normalizeString(p['Mã sản phẩm'] || p['SKU'] || '');
    const name = normalizeString(p['Tên sản phẩm'] || '');
    return code === normQuery || name.includes(normQuery) || normQuery.includes(code);
  });

  const matchedSpec = specsData.find(s => {
    const specCode = normalizeString(s['Mã Spec'] || '');
    const prodLink = normalizeString(s['Sản phẩm liên kết'] || s['Tên tiêu chuẩn'] || '');
    return specCode === normQuery || prodLink.includes(normQuery) || normQuery.includes(prodLink);
  });

  const matchedPricings = pricingData.filter(pr => {
    const prCode = normalizeString(pr['Mã sản phẩm'] || '');
    const prName = normalizeString(pr['Tên sản phẩm'] || '');
    return prCode === normQuery || prName.includes(normQuery) || normQuery.includes(prCode);
  });

  const matchedContracts = contractsData.filter(c => {
    return (c.products || []).some((cp: any) => {
      const cpCode = normalizeString(cp.productCode || '');
      const cpName = normalizeString(cp.productName || '');
      return cpCode === normQuery || cpName.includes(normQuery);
    });
  });

  const matchedPOLines = poLines.filter(po => {
    const poName = normalizeString(po['Tên sản phẩm'] || '');
    const poCode = normalizeString(po['Mã của khách'] || po['Mã giá bán'] || '');
    return poName.includes(normQuery) || poCode === normQuery;
  });

  return {
    matchedProduct,
    matchedSpec,
    matchedPricings,
    matchedContracts,
    matchedPOLines
  };
};

/**
 * Standardize Supplier Abbreviated Short Code
 * Tâm Sen -> TSG
 * Tuấn Bằng -> TB
 * Thuận Hòa Phát -> THP
 * YFY Hà Nam -> YFY
 * Bao Bì Đồng Nai -> BBDN
 * Xương Giang -> XG
 */
export function getSupplierShortCode(suppName: string): string {
  if (!suppName) return "TSG";
  const s = suppName.toLowerCase().trim();
  if (s.includes("tâm sen") || s.includes("tam sen") || s === "tsg" || s === "ts") return "TSG";
  if (s.includes("tuấn bằng") || s.includes("tuan bang") || s === "tb") return "TB";
  if (s.includes("thuận hoà phát") || s.includes("thuận hòa phát") || s.includes("thp")) return "THP";
  if (s.includes("yfy") || s.includes("vĩnh huê") || s.includes("vinh hue") || s.includes("yong feng yu")) return "YFY";
  if (s.includes("đồng nai") || s.includes("dong nai") || s.includes("bbdn")) return "BBDN";
  if (s.includes("xương giang") || s.includes("xuong giang")) return "XG";
  return suppName.toUpperCase().replace(/\s+/g, "");
}

/**
 * Intelligent default Technical Specification generator
 */
export function getDefaultSpecs(name: string = "", code: string = "", unit: string = ""): string {
  const n = (name || "").toLowerCase();
  const c = (code || "").toLowerCase();
  const u = (unit || "").toLowerCase();

  // 1. Lưỡi gà trắng, lưỡi gà vàng, giấy cuộn lưỡi gà (Tâm Sen TSG, Bắc Sơn, Thăng Long...)
  if (n.includes("lưỡi gà") || n.includes("luoi ga") || c.includes("lg") || c.includes("lgtts")) {
    return "Cuộn giấy lưỡi gà trắng khổ rộng 95mm x dài 800m, định lượng 230gsm (±5%), quấn lõi chuyên dụng cho máy đóng bao thuốc lá, đạt TCKT đã duyệt.";
  }

  // 2. Băng xé, Màng BOPP, Màng co
  if (n.includes("băng xé") || n.includes("bang xe") || n.includes("bopp") || n.includes("màng") || n.includes("mang")) {
    return "Băng xé / Màng BOPP cuộn chuyên dụng cho bao bì thuốc lá, độ bám dính và độ bền kéo đạt tiêu chuẩn kỹ thuật (TCKT) đã duyệt.";
  }

  // 3. Giấy nhôm, Giấy lót, Giấy thiếc
  if (n.includes("nhôm") || n.includes("nhom") || n.includes("lót") || n.includes("lot") || n.includes("thiếc")) {
    return "Giấy nhôm/giấy lót cuộn dập nổi, tráng phủ chuyên dụng bao gói thuốc lá theo tiêu chuẩn kỹ thuật (TCKT) đã duyệt.";
  }

  // 4. Cây đầu lọc thuốc lá
  if (n.includes("đầu lọc") || n.includes("dau loc") || n.includes("acetate") || n.includes("filter")) {
    return "Cây đầu lọc Acetate chuyên dụng cho sản xuất điếu thuốc lá theo kích thước và TCKT đã duyệt.";
  }

  // 5. Nhãn in, tờ in thuốc lá (Tuấn Bằng, Bắc Sơn, Thăng Long...)
  if (n.includes("nhãn") || n.includes("tờ") || n.includes("decal") || n.includes("label") || u === "tờ" || c.startsWith("nh") || c.startsWith("tu") || c.startsWith("tsbs")) {
    if (n.includes("tút") || c.startsWith("tu")) {
      return "Nhãn tút thuốc lá in Offset nhiều màu trên giấy Couche chuyên dụng, cán màng bóng, bế định hình theo TCKT và Ma-két đã duyệt.";
    }
    return "Nhãn bao thuốc lá in Offset nhiều màu trên giấy Couche chuyên dụng, phủ vecni/cán bóng, bế định hình theo TCKT và Ma-két đã duyệt.";
  }

  // 6. Thùng carton, bao bì sóng (YFY, THP, Đồng Nai...)
  if (n.includes("thùng") || n.includes("carton") || n.includes("hộp") || c.startsWith("th") || c.startsWith("ps-15") || c.startsWith("c48")) {
    if (n.includes("c48") || n.includes("15kg") || n.includes("xuất khẩu")) {
      return "Thùng nâu 5 lớp sóng AB (KP250/3M330/KP250). KT trong: 1.140x700x715 (±5mm), 1.120x680x705 (±5mm). Trọng lượng 15kg (±0.4kg). Dập ghim, TCKT đã duyệt.";
    }
    return "Thùng carton 5 lớp sóng AB/BC chịu lực cao, in Flexo theo mẫu ma-két, dập ghim tiêu chuẩn TCKT đã duyệt.";
  }

  return "Sản xuất theo đúng bản vẽ ma-két, quy cách đóng gói và tiêu chuẩn kỹ thuật (TCKT) đã được phê duyệt.";
}

