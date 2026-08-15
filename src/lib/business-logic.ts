
/**
 * TSG Business OS - Centralized Business Logic
 * Source of Truth for all financial and logistical calculations
 */

export const parseNumber = (val: any): number => {
  if (val === null || val === undefined || val === '') return 0;
  if (typeof val === 'number') return val;
  const str = String(val).replace(/[^0-9.-]+/g, "");
  const num = parseFloat(str);
  return isNaN(num) ? 0 : num;
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

  const recordCode = normalizeString(priceRecord["Mã sản phẩm"] || priceRecord["Mã hàng"] || priceRecord["Mã giá"] || priceRecord["Mã giá bán"] || "");
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
  if (recordCode && (normQuery.includes(recordCode) || recordCode.includes(normQuery))) {
    score += 50;
  }

  // 3. Exact name match
  if (recordName && (normQuery.includes(recordName) || recordName.includes(normQuery))) {
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

  const combinedQuery = `${sku} ${name}`.trim();
  if (!combinedQuery) return null;

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

  // 2. Priority match with location if location provided
  if (location) {
    const normLoc = normalizeString(location);
    const matchedLoc = candidates.find(p => {
      const pLoc = normalizeString(p["Địa điểm giao hàng"] || p["Địa chỉ giao hàng"] || "");
      const pCode = normalizeString(p["Mã sản phẩm"] || p["Mã hàng"] || "");
      return pLoc.includes(normLoc) && (pCode === normalizeString(sku) || combinedQuery.includes(pCode));
    });
    if (matchedLoc) return matchedLoc;
  }

  // 3. Exact SKU / Code match
  if (sku) {
    const normSku = normalizeString(sku);
    const exactCodeMatch = candidates.find(p => {
      const pCode = normalizeString(p["Mã sản phẩm"] || p["Mã hàng"] || "");
      return pCode && (pCode === normSku || normSku.includes(pCode) || pCode.includes(normSku));
    });
    if (exactCodeMatch) return exactCodeMatch;
  }

  // 4. Fuzzy score all candidates
  let bestRecord: any = null;
  let maxScore = 0;

  for (const record of candidates) {
    const score = scoreProductMatch(combinedQuery, record, customer);
    if (score > maxScore) {
      maxScore = score;
      bestRecord = record;
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
    const code = item.record["Mã sản phẩm"] || item.record["Mã hàng"] || item.record["Mã giá"];
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
  return parseNumber(record['Đơn giá bán']) || parseNumber(record['Giá bán']) || parseNumber(record['Đơn giá bán mới']) || 0;
};

export const getBuyPriceFromRecord = (record: any): number => {
  if (!record) return 0;
  return parseNumber(record['Đơn giá mua']) || parseNumber(record['Giá nhập']) || parseNumber(record['Đơn giá mua mới']) || 0;
};

/**
 * Standard calculation for a delivery row
 */
export const calculateDeliveryFinances = (
  delivery: any, 
  pricingData: any[], 
  poLinesData: any[]
) => {
  const sku = delivery["Mã sản phẩm"] || delivery["Mã hàng"] || delivery["Tên sản phẩm"];
  const customer = delivery["Khách hàng"] || delivery["Tên khách hàng"];
  const location = delivery["Địa điểm giao hàng"] || delivery["Địa chỉ giao hàng"];
  const qty = parseNumber(delivery["Số lượng giao"]);

  // Lookup source prices
  const priceRecord = findPriceRecord(pricingData, { sku, customer, location });
  
  // Find associated PO Line for secondary lookup
  const poLine = poLinesData.find(l => 
    !l.isDeleted && (
      (delivery["Chi tiết đơn hàng"] && String(l["STT"] || l.id) === String(delivery["Chi tiết đơn hàng"])) ||
      (l["Số đơn hàng"] && delivery["Đơn hàng"] && String(l["Số đơn hàng"]).trim().toLowerCase() === String(delivery["Đơn hàng"]).trim().toLowerCase() && (l["Tên sản phẩm"] === delivery["Tên sản phẩm"] || l["Mã sản phẩm"] === sku))
    )
  );

  const priceRecSell = getSellPriceFromRecord(priceRecord);
  const priceRecBuy = getBuyPriceFromRecord(priceRecord);

  // Determine Prices (Priority: Price Table -> PO Line -> Delivery Row)
  const sellPrice = priceRecSell > 0 ? priceRecSell : 
                    (poLine ? parseNumber(poLine['Đơn giá bán']) : parseNumber(delivery['Đơn giá bán']));
  
  const buyPrice = priceRecBuy > 0 ? priceRecBuy : 
                   (poLine ? parseNumber(poLine['Đơn giá nhập']) : parseNumber(delivery['Đơn giá nhập']));

  const revenue = sellPrice * qty;
  const profit = (sellPrice - buyPrice) * qty;
  const margin = sellPrice > 0 ? ((sellPrice - buyPrice) / sellPrice) * 100 : 0;

  return {
    sellPrice,
    buyPrice,
    revenue,
    profit,
    margin,
    priceCode: priceRecord ? (priceRecord['Mã giá bán'] || priceRecord['Mã giá'] || priceRecord['Mã sản phẩm']) : 'N/A',
    isDiscrepancy: parseNumber(delivery["Doanh thu"]) !== revenue || parseNumber(delivery["Lợi nhuận gộp"]) !== profit
  };
};

/**
 * Standard calculation for a PO Line row (Header aggregation source)
 */
export const calculatePOLineFinances = (
  poLine: any,
  pricingData: any[]
) => {
  const sku = poLine["Mã của khách"] || poLine["Mã sản phẩm"] || poLine["Tên sản phẩm"];
  const customer = poLine["Khách hàng"];
  const qty = parseNumber(poLine["Số lượng"]);

  // Lookup source prices
  const priceRecord = findPriceRecord(pricingData, { sku, customer });

  const priceRecSell = getSellPriceFromRecord(priceRecord);
  const priceRecBuy = getBuyPriceFromRecord(priceRecord);

  const sellPrice = priceRecSell > 0 ? priceRecSell : parseNumber(poLine['Đơn giá bán']);
  const buyPrice = priceRecBuy > 0 ? priceRecBuy : parseNumber(poLine['Đơn giá nhập']);

  const revenue = sellPrice * qty;
  const profit = (sellPrice - buyPrice) * qty;
  const margin = sellPrice > 0 ? ((sellPrice - buyPrice) / sellPrice) * 100 : 0;

  return {
    sellPrice,
    buyPrice,
    revenue,
    profit,
    margin,
    priceCode: priceRecord ? (priceRecord['Mã giá bán'] || priceRecord['Mã giá'] || priceRecord['Mã sản phẩm']) : (poLine['Mã giá bán'] || 'N/A')
  };
};
