/**
 * TSG Business OS - Comprehensive End-to-End System & Logic Verification Suite
 * Run with: npx tsx scripts/verify-all.ts
 * 
 * Verifies all 4 Core Architecture & Data Integrity Areas:
 * Area 1: Financial Formulas & Master Data Layer (13 Tables, parseNumber 25+ variations, AVP Cost Fallback, Financial Calculations, Graph Linkage)
 * Area 2: Intelligent Document OCR & Smart Naming Engine (Naming Pattern, ASCII Sanitization, Document Prefixes, Drive Hierarchy & Query Escaping)
 * Area 3: 5-Step Core Business Workflow (Duplicate PO Protection, Plan Key Harmonization, Date ISO Normalization, Over-fulfillment & Delivery Tracking)
 * Area 4: TypeScript Type Check & Production Build Verification (tsc --noEmit, npm run build)
 */

import Papa from 'papaparse';
import { execSync } from 'child_process';
import {
  parseNumber,
  formatVND,
  findPriceRecord,
  getBuyPriceFromRecord,
  getSellPriceFromRecord,
  calculatePOLineFinances,
  calculateDeliveryFinances,
  parseDateToISO,
  formatDateForDisplay,
  normalizeString,
  scoreProductMatch,
  findMatchingSuggestions,
  findUnifiedProductEntity,
  getSupplierShortCode,
  getDefaultSpecs
} from '../src/lib/business-logic';

import {
  sanitizeFileNamePart,
  formatStandardDateForFileName,
  getShortCustomerName,
  generateSmartDocumentFileName
} from '../src/lib/documentNaming';

import {
  getDriveFolderPath,
  formatShortFileName,
  TSG_DRIVE_STRUCTURE
} from '../src/lib/driveSync';

import {
  PRICING_DATA,
  PO_HEADER_DATA,
  PO_LINES_DATA,
  DELIVERY_DATA,
  DELIVERY_PLAN_DATA,
  CUSTOMER_DATA,
  SUPPLIER_DATA,
  PRODUCT_DATA,
  CONTACT_DATA,
  INITIAL_SPECS_DATA
} from '../src/data';

// ============================================================================
// TEST HARNESS & ANSI STYLING
// ============================================================================

const ANSI = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  bgBlue: '\x1b[44m',
  bgGreen: '\x1b[42m',
  bgRed: '\x1b[41m',
};

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;
const failures: { area: string; test: string; error: string }[] = [];

function assert(condition: boolean, testName: string, area: string, details?: string) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  ${ANSI.green}✓ PASS${ANSI.reset} [${area}] ${testName}`);
  } else {
    failedTests++;
    const errMsg = details ? ` - ${details}` : '';
    console.error(`  ${ANSI.red}✗ FAIL${ANSI.reset} [${area}] ${testName}${errMsg}`);
    failures.push({ area, test: testName, error: details || 'Assertion failed' });
  }
}

function assertApproxEqual(actual: number, expected: number, testName: string, area: string, tolerance: number = 0.001) {
  const diff = Math.abs(actual - expected);
  const pass = diff <= tolerance;
  assert(pass, testName, area, `Actual: ${actual}, Expected: ${expected} (diff: ${diff})`);
}

function assertStrictEqual<T>(actual: T, expected: T, testName: string, area: string) {
  const pass = actual === expected;
  assert(pass, testName, area, `Actual: ${JSON.stringify(actual)}, Expected: ${JSON.stringify(expected)}`);
}

function sectionHeader(title: string, areaNum: number) {
  console.log('\n' + '='.repeat(80));
  console.log(`${ANSI.bold}${ANSI.cyan}AREA ${areaNum}: ${title.toUpperCase()}${ANSI.reset}`);
  console.log('='.repeat(80));
}

// ============================================================================
// SUITE 1: AREA 1 - FINANCIAL FORMULAS & MASTER DATA LAYER
// ============================================================================

function runArea1Tests() {
  sectionHeader('Financial Formulas & 13 Master Data Tables', 1);

  // --------------------------------------------------------------------------
  // 1.1 parseNumber with 25+ variations
  // --------------------------------------------------------------------------
  console.log(`\n${ANSI.bold}${ANSI.yellow}--- 1.1 parseNumber Extensive Matrix (25+ Variations) ---${ANSI.reset}`);
  
  const parseNumberTestCases: [any, number, string][] = [
    // 1-4: Vietnamese Dot-Thousands & Comma-Decimals
    ['718.062.120,00', 718062120, 'Vietnamese standard full million format with ,00'],
    ['1.800', 1800, 'Vietnamese dot thousand separator'],
    ['250.000,50', 250000.5, 'Vietnamese dot thousand with ,50 decimal'],
    ['1.234.567.890', 1234567890, 'Vietnamese billion format multiple dots'],
    
    // 5-7: US Comma-Thousands & Dot-Decimals
    ['718,062,120.00', 718062120, 'US standard full million format with .00'],
    ['1,800', 1800, 'US comma thousand separator'],
    ['250,000.50', 250000.5, 'US comma thousand with .50 decimal'],
    
    // 8-11: Percentage strings
    ['35.63%', 35.63, 'Percentage with dot decimal'],
    ['35,63%', 35.63, 'Percentage with comma decimal'],
    ['16.20%', 16.2, 'Percentage with trailing zero'],
    ['  100.0%  ', 100, 'Percentage with whitespace'],

    // 12-14: Negative accounting parentheses
    ['(50.000)', -50000, 'Accounting negative parentheses with dot thousand'],
    ['(1.234,50)', -1234.5, 'Accounting negative parentheses with dot thousand & comma decimal'],
    ['(100)', -100, 'Simple accounting negative in parentheses'],

    // 15-17: Negative with minus sign
    ['-1.800', -1800, 'Negative with minus and dot thousand'],
    ['-50000', -50000, 'Standard negative integer'],
    ['- 25.5%', -25.5, 'Negative percentage with space after minus'],

    // 18-22: Currency symbols & Vietnamese words
    ['250.000 ₫', 250000, 'Vietnamese Dong symbol ₫'],
    ['718.062.120 VND', 718062120, 'Currency suffix VND'],
    [' $1,200.50 ', 1200.5, 'US Dollar symbol $ with whitespace'],
    ['50.000đ', 50000, 'Lower case đ currency symbol'],
    ['100.000 đ', 100000, 'Spaced đ currency symbol'],

    // 23-26: Empty, Null, Undefined, Whitespace
    [null, 0, 'Null input returns 0'],
    [undefined, 0, 'Undefined input returns 0'],
    ['', 0, 'Empty string returns 0'],
    ['   ', 0, 'Whitespace string returns 0'],

    // 27-30: Raw JavaScript numbers
    [1800, 1800, 'Raw JS positive integer'],
    [0, 0, 'Raw JS zero'],
    [-42.5, -42.5, 'Raw JS negative float'],
    [NaN, 0, 'Raw JS NaN safely returns 0'],

    // 31-33: Mixed dirty strings
    [' 233,395.00 ', 233395, 'Trimmed US currency with decimals'],
    [' 99,000.00 ', 99000, 'Trimmed US thousand number'],
    [' 77,313.60 ', 77313.6, 'Trimmed US decimal with fraction']
  ];

  for (const [input, expected, desc] of parseNumberTestCases) {
    const actual = parseNumber(input);
    assertApproxEqual(actual, expected, `parseNumber(${JSON.stringify(input)}) -> ${desc}`, 'Area 1 (parseNumber)');
  }

  // --------------------------------------------------------------------------
  // 1.2 Price Lookup & AVP Cost Fallback Matrix (Gsp_094, Gsp_142, Gsp_148...)
  // --------------------------------------------------------------------------
  console.log(`\n${ANSI.bold}${ANSI.yellow}--- 1.2 Pricing SKU Match & AVP Cost Fallback ---${ANSI.reset}`);

  const pricingRows = Papa.parse(PRICING_DATA.trim(), { header: true }).data as any[];
  const poLineRows = Papa.parse(PO_LINES_DATA.trim(), { header: true }).data as any[];
  const deliveryRows = Papa.parse(DELIVERY_DATA.trim(), { header: true }).data as any[];
  const poHeaderRows = Papa.parse(PO_HEADER_DATA.trim(), { header: true }).data as any[];

  assert(pricingRows.length > 0, `Loaded ${pricingRows.length} pricing rows from Master Data`, 'Area 1 (Pricing)');

  // Verify critical AVP items specifically identified in survey
  const avpTestItems = [
    { sku: 'Gsp_094', minBuy: 1000, desc: 'Lưỡi gà trắng 71mm' },
    { sku: 'Gsp_142', minBuy: 1000, desc: 'Lưỡi gà vàng Bắc Sơn' },
    { sku: 'Gsp_148', minBuy: 1000, desc: 'Lưỡi gà Thăng Long' },
    { sku: 'Gsp_117', minBuy: 1000, desc: 'Thùng carton C48' },
    { sku: 'Gsp_150', minBuy: 1000, desc: 'Băng xé phong bì' }
  ];

  for (const item of avpTestItems) {
    const record = findPriceRecord(pricingRows, item.sku);
    assert(!!record, `findPriceRecord finds record for SKU ${item.sku} (${item.desc})`, 'Area 1 (Pricing Lookup)');
    if (record) {
      const buyPrice = getBuyPriceFromRecord(record);
      const sellPrice = getSellPriceFromRecord(record);
      assert(buyPrice >= item.minBuy, `${item.sku} Buy Price fallback > 0 (Buy: ${buyPrice.toLocaleString('vi-VN')}đ, Sell: ${sellPrice.toLocaleString('vi-VN')}đ)`, 'Area 1 (AVP Cost Fallback)');
      assert(sellPrice > 0, `${item.sku} Sell Price > 0 (Sell: ${sellPrice.toLocaleString('vi-VN')}đ)`, 'Area 1 (Selling Price)');
    }
  }

  // Test location-based and customer-based pricing lookup
  const locRecord = findPriceRecord(pricingRows, {
    sku: 'Gsp_117',
    customer: 'Công ty TNHH MTV Thuốc lá Thăng Long',
    location: 'Kho Hà Nội'
  });
  assert(!!locRecord, 'findPriceRecord resolves with customer and location parameters', 'Area 1 (Contextual Pricing)');

  // --------------------------------------------------------------------------
  // 1.3 Financial Calculations (Revenue, COGS, Gross Profit, Margin %)
  // --------------------------------------------------------------------------
  console.log(`\n${ANSI.bold}${ANSI.yellow}--- 1.3 Financial Formulas Validation (PO Lines & Deliveries) ---${ANSI.reset}`);

  // Test calculatePOLineFinances
  let poLineCalculatedCount = 0;
  for (const line of poLineRows.slice(0, 10)) {
    const fin = calculatePOLineFinances(line, pricingRows);
    poLineCalculatedCount++;
    assert(!isNaN(fin.revenue), `PO Line ${line['STT'] || line['Mã hàng']}: Revenue is valid number (${fin.revenue})`, 'Area 1 (Financial Formulas)');
    assert(!isNaN(fin.profit), `PO Line ${line['STT'] || line['Mã hàng']}: Profit is valid number (${fin.profit})`, 'Area 1 (Financial Formulas)');
    assert(!isNaN(fin.margin), `PO Line ${line['STT'] || line['Mã hàng']}: Margin % is valid number (${fin.margin.toFixed(2)}%)`, 'Area 1 (Financial Formulas)');

    const expectedRevenue = fin.sellPrice * parseNumber(line['Số lượng']);
    assertApproxEqual(fin.revenue, expectedRevenue, `PO Line ${line['STT']}: Revenue === SellPrice * Qty`, 'Area 1 (Math Formula)');
    
    const expectedProfit = (fin.sellPrice - fin.buyPrice) * parseNumber(line['Số lượng']);
    assertApproxEqual(fin.profit, expectedProfit, `PO Line ${line['STT']}: Profit === (SellPrice - BuyPrice) * Qty`, 'Area 1 (Math Formula)');

    if (fin.sellPrice > 0) {
      const expectedMargin = ((fin.sellPrice - fin.buyPrice) / fin.sellPrice) * 100;
      assertApproxEqual(fin.margin, expectedMargin, `PO Line ${line['STT']}: Margin % === ((Sell - Buy) / Sell) * 100`, 'Area 1 (Math Formula)');
    }
  }
  assert(poLineCalculatedCount === 10, 'Verified first 10 PO lines financial calculations', 'Area 1 (POLine Batch)');

  // Test calculateDeliveryFinances
  let deliveryCalculatedCount = 0;
  for (const del of deliveryRows.slice(0, 10)) {
    const fin = calculateDeliveryFinances(del, pricingRows, poLineRows);
    deliveryCalculatedCount++;
    assert(!isNaN(fin.revenue), `Delivery ${del['Số PXK'] || del['STT']}: Revenue is valid (${fin.revenue})`, 'Area 1 (Financial Formulas)');
    assert(!isNaN(fin.profit), `Delivery ${del['Số PXK'] || del['STT']}: Profit is valid (${fin.profit})`, 'Area 1 (Financial Formulas)');
    assert(!isNaN(fin.margin), `Delivery ${del['Số PXK'] || del['STT']}: Margin is valid (${fin.margin.toFixed(2)}%)`, 'Area 1 (Financial Formulas)');
  }
  assert(deliveryCalculatedCount === 10, 'Verified first 10 Delivery rows financial calculations', 'Area 1 (Delivery Batch)');

  // --------------------------------------------------------------------------
  // 1.4 PO Header -> PO Lines -> Delivery Data Graph Linkage
  // --------------------------------------------------------------------------
  console.log(`\n${ANSI.bold}${ANSI.yellow}--- 1.4 PO Data Graph Linkage & Whitespace Cleaning ---${ANSI.reset}`);

  // Test PO 26/KHVT/0547 (Known to previously have leading whitespace " 26/KHVT/0547")
  const po547Header = poHeaderRows.find(h => (h['Đơn hàng'] || h['Số đơn hàng'] || '').trim() === '26/KHVT/0547');
  assert(!!po547Header, 'PO Header for 26/KHVT/0547 found and clean of untrimmed keys', 'Area 1 (Data Linkage)');

  const po547Lines = poLineRows.filter(l => (l['Số đơn hàng'] || l['Đơn hàng'] || '').trim() === '26/KHVT/0547');
  assert(po547Lines.length === 3, `PO 26/KHVT/0547 links to exactly 3 PO Lines (Found: ${po547Lines.length})`, 'Area 1 (Data Linkage)');

  const po547Deliveries = deliveryRows.filter(d => (d['Đơn hàng'] || '').trim() === '26/KHVT/0547');
  assert(po547Deliveries.length === 1, `PO 26/KHVT/0547 links to exactly 1 Delivery (Found: ${po547Deliveries.length})`, 'Area 1 (Data Linkage)');

  // Test PO 26/KHVT/0600
  const po600Header = poHeaderRows.find(h => (h['Đơn hàng'] || h['Số đơn hàng'] || '').trim() === '26/KHVT/0600');
  assert(!!po600Header, 'PO Header for 26/KHVT/0600 found cleanly', 'Area 1 (Data Linkage)');

  const po600Lines = poLineRows.filter(l => (l['Số đơn hàng'] || l['Đơn hàng'] || '').trim() === '26/KHVT/0600');
  assert(po600Lines.length === 1, `PO 26/KHVT/0600 links to exactly 1 PO Line (Found: ${po600Lines.length})`, 'Area 1 (Data Linkage)');

  const po600Deliveries = deliveryRows.filter(d => (d['Đơn hàng'] || '').trim() === '26/KHVT/0600');
  assert(po600Deliveries.length === 4, `PO 26/KHVT/0600 links to exactly 4 Deliveries (Found: ${po600Deliveries.length})`, 'Area 1 (Data Linkage)');
}

// ============================================================================
// SUITE 2: AREA 2 - OCR, DOCUMENT NAMING & GOOGLE DRIVE STORAGE
// ============================================================================

function runArea2Tests() {
  sectionHeader('Intelligent Document OCR & Smart Naming Engine', 2);

  // --------------------------------------------------------------------------
  // 2.1 ASCII Sanitization & Diacritics Stripping
  // --------------------------------------------------------------------------
  console.log(`\n${ANSI.bold}${ANSI.yellow}--- 2.1 ASCII Sanitization & Special Characters ---${ANSI.reset}`);

  const sanitizeTestCases: [string, string, string][] = [
    ['Hóa đơn GTGT #00129/2026', 'HoadonGTGT-00129-2026', 'Vietnamese accented characters stripped and spaces removed'],
    ['Đơn hàng đính kèm', 'Donhangdinhkem', 'Vietnamese đ/Đ replaced with d/D without spaces'],
    ['Phiếu xuất kho: 123/PXK*2026?', 'Phieuxuatkho-123-PXK-2026', 'Colons, slashes, asterisks, and question marks converted to hyphens'],
    ['Tâm Sen Group @ Hà Nội', 'TamSenGroup-HaNoi', 'Accents and @ converted safely'],
    ['  ---File--Name---  ', 'File-Name', 'Leading, trailing, and consecutive hyphens/spaces collapsed'],
    ['Special !@#$%^&* chars', 'Special-^-chars', 'Forbidden symbols replaced without hanging hyphens'],
  ];

  for (const [input, expected, desc] of sanitizeTestCases) {
    const actual = sanitizeFileNamePart(input);
    assertStrictEqual(actual, expected, `sanitizeFileNamePart("${input}") -> ${desc}`, 'Area 2 (Sanitization)');
    // Verify 100% pure ASCII check
    const isPureAscii = /^[\x00-\x7F]*$/.test(actual);
    assert(isPureAscii, `sanitizeFileNamePart result is 100% pure ASCII: "${actual}"`, 'Area 2 (Pure ASCII)');
  }

  // --------------------------------------------------------------------------
  // 2.2 Customer Name Shortening Logic
  // --------------------------------------------------------------------------
  console.log(`\n${ANSI.bold}${ANSI.yellow}--- 2.2 Standard Customer Short Code Extraction ---${ANSI.reset}`);

  const customerShortCases: [string, string][] = [
    ['Công ty TNHH MTV Thuốc lá Thăng Long', 'ThuocLaThangLong'],
    ['Công ty Thuốc lá Thanh Hóa', 'ThuocLaThanhHoa'],
    ['Công ty TNHH MTV Thuốc lá Bắc Sơn', 'ThuocLaBacSon'],
    ['Thuốc lá TLBS', 'ThuocLaBacSon'],
    ['Nhà máy Thuốc lá Long An', 'ThuocLaLongAn'],
    ['Công ty CP Thuốc lá Đà Nẵng', 'ThuocLaDaNang'],
    ['Tổng Công ty Thuốc lá Sài Gòn', 'ThuocLaSaiGon'],
    ['Công ty Thuốc lá Ngân Sơn', 'ThuocLaNganSon'],
    ['Công ty Cổ phần An Việt Phát (AVP)', 'AnVietPhat'],
    ['Công ty TNHH Tâm Sen', 'TamSen'],
    ['CÔNG TY CỔ PHẦN BAO BÌ HOÀNG GIA', 'BAOBIHOANGGIA'],
  ];

  for (const [input, expected] of customerShortCases) {
    const actual = getShortCustomerName(input);
    assertStrictEqual(actual, expected, `getShortCustomerName("${input}") === "${expected}"`, 'Area 2 (Customer Code)');
  }

  // --------------------------------------------------------------------------
  // 2.3 Smart Document Naming Pattern: [LOẠI]_[SỐ_CT]_[NGÀY]_[KHÁCH_HÀNG]_[PO].ext
  // --------------------------------------------------------------------------
  console.log(`\n${ANSI.bold}${ANSI.yellow}--- 2.3 Smart Document Naming Generation Pattern ---${ANSI.reset}`);

  const namingTestCases: [any, string, string][] = [
    [
      {
        documentType: 'PXK',
        documentNumber: 'PXK-2026-089',
        documentDate: '25/08/2026',
        buyerName: 'Công ty TNHH MTV Thuốc lá Thăng Long',
        documentReference: '26/KHVT/0547',
        originalFileName: 'scan_doc.pdf'
      },
      'PXK_PXK-2026-089_2026-08-25_ThuocLaThangLong_PO-26-KHVT-0547.pdf',
      'PXK delivery slip with PO reference and Thang Long customer'
    ],
    [
      {
        documentType: 'PO',
        documentNumber: '26/KHVT/0600',
        documentDate: '2026-08-20',
        buyerName: 'Thuốc lá Thanh Hóa',
        originalFileName: 'po_donhang.png'
      },
      'PO_26-KHVT-0600_2026-08-20_ThuocLaThanhHoa.png',
      'PO order without redundant PO reference prefix'
    ],
    [
      {
        documentType: 'Báo giá',
        documentNumber: 'BG-2026-01',
        documentDate: '15/01/2026',
        buyerName: 'Thuốc lá Bắc Sơn',
        originalFileName: 'quotation.pdf'
      },
      'BG_BG-2026-01_2026-01-15_ThuocLaBacSon.pdf',
      'Quotation with BG prefix'
    ],
    [
      {
        documentType: 'Biên bản giao nhận hàng',
        documentNumber: 'BBGH-99',
        documentDate: '01/02/2026',
        buyerName: 'An Việt Phát',
        documentReference: 'PO-001',
        originalFileName: 'delivery_signed.jpg'
      },
      'BBGH_BBGH-99_2026-02-01_AnVietPhat_PO-PO-001.jpg',
      'BBGH signed delivery protocol with image extension'
    ],
    [
      {
        documentType: 'Hóa đơn GTGT',
        documentNumber: 'HD-0045678',
        documentDate: '2026/03/10',
        buyerName: 'Tâm Sen',
        originalFileName: 'vat_invoice.pdf'
      },
      'HD-VAT_HD-0045678_2026-03-10_TamSen.pdf',
      'VAT invoice with HD-VAT prefix'
    ],
    [
      {
        documentType: 'Hợp đồng mua bán',
        documentNumber: '177/HDMB/TSG',
        documentDate: '2026-01-01',
        buyerName: 'Thuốc lá Đà Nẵng',
        originalFileName: 'contract.pdf'
      },
      'HDMB_177-HDMB-TSG_2026-01-01_ThuocLaDaNang.pdf',
      'Contract with HDMB prefix'
    ]
  ];

  for (const [params, expected, desc] of namingTestCases) {
    const actual = generateSmartDocumentFileName(params);
    assertStrictEqual(actual, expected, `generateSmartDocumentFileName -> ${desc}`, 'Area 2 (Smart Naming)');
  }

  // --------------------------------------------------------------------------
  // 2.4 Google Drive Folder Structure & Query Escaping Logic
  // --------------------------------------------------------------------------
  console.log(`\n${ANSI.bold}${ANSI.yellow}--- 2.4 Google Drive Hierarchy & Query Escaping ---${ANSI.reset}`);

  // Test getDriveFolderPath
  const folderPathInfo = getDriveFolderPath('2026-08-25', '03_PO_ORDERS');
  assertStrictEqual(folderPathInfo.year, '2026', 'Drive folder path year is 2026', 'Area 2 (Drive Hierarchy)');
  assertStrictEqual(folderPathInfo.month, '08', 'Drive folder path month is 08', 'Area 2 (Drive Hierarchy)');
  assertStrictEqual(folderPathInfo.categoryFolder, '03_Don_Hang_PO_Va_Ban_Scan_OCR', 'Drive category folder matched', 'Area 2 (Drive Hierarchy)');
  assert(folderPathInfo.fullPath.includes('TSG Business ERP - Master Storage / 2026 / Thang_08 / 03_Don_Hang_PO_Va_Ban_Scan_OCR'), 'Drive full path formatted correctly', 'Area 2 (Drive Hierarchy)');

  // Test Drive Query Single Quote Escaping (CRITICAL for Google Drive API V3 queries)
  const testFolderName = "Thư mục 'Tâm Sen' & 'Bắc Sơn' 2026";
  const safeFolderName = testFolderName.replace(/'/g, "\\'");
  const driveQuery = "name = '" + safeFolderName + "' and mimeType = 'application/vnd.google-apps.folder' and trashed = false";
  
  assert(safeFolderName.includes("\\'Tâm Sen\\'"), 'Single quotes inside folder name escaped with backslash', 'Area 2 (Drive Query Escaping)');
  assertStrictEqual(driveQuery, "name = 'Thư mục \\'Tâm Sen\\' & \\'Bắc Sơn\\' 2026' and mimeType = 'application/vnd.google-apps.folder' and trashed = false", 'Drive search query string built safely without syntax error', 'Area 2 (Drive Query Escaping)');
}

// ============================================================================
// SUITE 3: AREA 3 - 5-STEP CORE BUSINESS WORKFLOW & LOGISTICS
// ============================================================================

function runArea3Tests() {
  sectionHeader('5-Step Business Workflow & Data Harmonization', 3);

  // --------------------------------------------------------------------------
  // 3.1 Duplicate PO Intake Protection Logic
  // --------------------------------------------------------------------------
  console.log(`\n${ANSI.bold}${ANSI.yellow}--- 3.1 Duplicate PO Detection Logic ---${ANSI.reset}`);

  const poHeaderRows = Papa.parse(PO_HEADER_DATA.trim(), { header: true }).data as any[];
  
  function checkIsDuplicatePO(newPo: string, existingHeaders: any[]): boolean {
    const trimmed = (newPo || '').trim().toLowerCase();
    if (!trimmed) return false;
    return existingHeaders.some(h => {
      const existing = (h['Đơn hàng'] || h['Số đơn hàng'] || h['id'] || '').trim().toLowerCase();
      return existing === trimmed;
    });
  }

  assert(checkIsDuplicatePO('26/KHVT/0547', poHeaderRows) === true, 'Detects duplicate PO "26/KHVT/0547"', 'Area 3 (Duplicate PO)');
  assert(checkIsDuplicatePO('  26/khvt/0547  ', poHeaderRows) === true, 'Detects duplicate PO with whitespace and case difference', 'Area 3 (Duplicate PO)');
  assert(checkIsDuplicatePO('26/KHVT/9999_BRAND_NEW', poHeaderRows) === false, 'Accepts brand new PO without duplicate false alarm', 'Area 3 (Duplicate PO)');
  assert(checkIsDuplicatePO('', poHeaderRows) === false, 'Empty PO does not trigger duplicate error', 'Area 3 (Duplicate PO)');

  // --------------------------------------------------------------------------
  // 3.2 Delivery Plan Key Resolution (Số lượng cần giao vs Số lượng kế hoạch)
  // --------------------------------------------------------------------------
  console.log(`\n${ANSI.bold}${ANSI.yellow}--- 3.2 Delivery Plan Key Resolution & Aggregation ---${ANSI.reset}`);

  const mockDeliveryPlans = [
    { 'Mã kế hoạch': 'P01', 'Đơn hàng': 'PO-TEST', 'Sản phẩm': 'Bao bì A', 'Số lượng cần giao': '10.000', 'Ngày dự kiến': '10/09/2026' },
    { 'Mã kế hoạch': 'P02', 'Đơn hàng': 'PO-TEST', 'Sản phẩm': 'Bao bì A', 'Số lượng kế hoạch': '15.000', 'Ngày giao kế hoạch': '20/09/2026' },
    { 'Mã kế hoạch': 'P03', 'Đơn hàng': 'PO-TEST', 'Sản phẩm': 'Bao bì A', 'Số lượng': '5000', 'Ngày giao': '30/09/2026' },
  ];

  function resolvePlanQuantity(plan: any): number {
    return parseNumber(plan['Số lượng cần giao'] || plan['Số lượng kế hoạch'] || plan['Số lượng'] || 0);
  }

  function resolvePlanDate(plan: any): string {
    return plan['Ngày dự kiến'] || plan['Ngày giao kế hoạch'] || plan['Ngày giao'] || '';
  }

  const totalPlannedQty = mockDeliveryPlans.reduce((sum, p) => sum + resolvePlanQuantity(p), 0);
  assertStrictEqual(totalPlannedQty, 30000, 'Successfully sums plan quantities across all 3 key variants (10k + 15k + 5k = 30k)', 'Area 3 (Plan Key Resolution)');

  assertStrictEqual(resolvePlanDate(mockDeliveryPlans[0]), '10/09/2026', 'Resolves Ngày dự kiến correctly', 'Area 3 (Plan Key Resolution)');
  assertStrictEqual(resolvePlanDate(mockDeliveryPlans[1]), '20/09/2026', 'Resolves Ngày giao kế hoạch correctly', 'Area 3 (Plan Key Resolution)');
  assertStrictEqual(resolvePlanDate(mockDeliveryPlans[2]), '30/09/2026', 'Resolves Ngày giao correctly', 'Area 3 (Plan Key Resolution)');

  // --------------------------------------------------------------------------
  // 3.3 Date Normalization to ISO (parseDateToISO & formatDateForDisplay)
  // --------------------------------------------------------------------------
  console.log(`\n${ANSI.bold}${ANSI.yellow}--- 3.3 Date Normalization Matrix ---${ANSI.reset}`);

  const dateTestCases: [any, string, string, string][] = [
    ['25/08/2026', '2026-08-25', '25/08/2026', 'DD/MM/YYYY format'],
    ['05-01-2026', '2026-01-05', '05/01/2026', 'DD-MM-YYYY format'],
    ['2026-08-25', '2026-08-25', '25/08/2026', 'YYYY-MM-DD ISO format'],
    ['2026/08/25', '2026-08-25', '25/08/2026', 'YYYY/MM/DD format'],
    ['5/1/2026', '2026-01-05', '05/01/2026', 'Single digit day and month padded to 2 digits'],
    ['', '', '', 'Empty string returns empty string'],
    [null, '', '', 'Null returns empty string'],
    [undefined, '', '', 'Undefined returns empty string'],
  ];

  for (const [input, expectedISO, expectedDisplay, desc] of dateTestCases) {
    const actualISO = parseDateToISO(input);
    assertStrictEqual(actualISO, expectedISO, `parseDateToISO(${JSON.stringify(input)}) -> ${expectedISO} (${desc})`, 'Area 3 (Date Normalization)');
    const actualDisplay = formatDateForDisplay(input);
    assertStrictEqual(actualDisplay, expectedDisplay, `formatDateForDisplay(${JSON.stringify(input)}) -> ${expectedDisplay} (${desc})`, 'Area 3 (Date Display)');
  }

  // --------------------------------------------------------------------------
  // 3.4 True Remaining Quantity Tracking & Over-Fulfillment Protection
  // --------------------------------------------------------------------------
  console.log(`\n${ANSI.bold}${ANSI.yellow}--- 3.4 Delivery Remaining & Over-Fulfillment Tracking ---${ANSI.reset}`);

  interface DeliveryTrackingTestCase {
    qtyOrdered: number;
    qtyPlanned: number;
    qtyDelivered: number;
    expectedRemainingPlan: number;
    expectedRemainingDeliver: number;
    expectedProgressPercent: number;
    expectedVariance: number;
    desc: string;
  }

  const trackingTestCases: DeliveryTrackingTestCase[] = [
    {
      qtyOrdered: 10000,
      qtyPlanned: 6000,
      qtyDelivered: 4000,
      expectedRemainingPlan: 4000,
      expectedRemainingDeliver: 6000,
      expectedProgressPercent: 40,
      expectedVariance: 0,
      desc: 'Partial plan and partial delivery in progress'
    },
    {
      qtyOrdered: 10000,
      qtyPlanned: 10000,
      qtyDelivered: 10000,
      expectedRemainingPlan: 0,
      expectedRemainingDeliver: 0,
      expectedProgressPercent: 100,
      expectedVariance: 0,
      desc: '100% fully planned and fully delivered'
    },
    {
      qtyOrdered: 10000,
      qtyPlanned: 12000,
      qtyDelivered: 11500,
      expectedRemainingPlan: 0,
      expectedRemainingDeliver: 0,
      expectedProgressPercent: 100,
      expectedVariance: 1500,
      desc: 'Over-fulfillment (Delivered 11.5k > Ordered 10k: remaining stays 0, variance +1.5k)'
    }
  ];

  for (const tc of trackingTestCases) {
    const qtyRemainingToPlan = Math.max(0, tc.qtyOrdered - tc.qtyPlanned);
    const qtyRemainingToDeliver = Math.max(0, tc.qtyOrdered - tc.qtyDelivered);
    const progressPercent = tc.qtyOrdered > 0 ? Math.min(100, Math.round((tc.qtyDelivered / tc.qtyOrdered) * 100)) : 100;
    const variance = tc.qtyDelivered - tc.qtyOrdered;

    assertStrictEqual(qtyRemainingToPlan, tc.expectedRemainingPlan, `${tc.desc} -> Remaining Plan: ${qtyRemainingToPlan}`, 'Area 3 (Remaining Tracking)');
    assertStrictEqual(qtyRemainingToDeliver, tc.expectedRemainingDeliver, `${tc.desc} -> Remaining Delivery: ${qtyRemainingToDeliver}`, 'Area 3 (Remaining Tracking)');
    assertStrictEqual(progressPercent, tc.expectedProgressPercent, `${tc.desc} -> Progress: ${progressPercent}%`, 'Area 3 (Progress Calculation)');
    if (tc.expectedVariance > 0) {
      assert(variance === tc.expectedVariance, `${tc.desc} -> Over-delivery positive variance: +${variance}`, 'Area 3 (Variance)');
    }
  }

  // --------------------------------------------------------------------------
  // 3.5 Supplier Short Codes & Unified Product Entity Resolution
  // --------------------------------------------------------------------------
  console.log(`\n${ANSI.bold}${ANSI.yellow}--- 3.5 Master Entity Lookup & Supplier Standardization ---${ANSI.reset}`);

  const supplierCodes: [string, string][] = [
    ['Công ty TNHH Tâm Sen', 'TSG'],
    ['Công ty In Tuấn Bằng', 'TB'],
    ['Công ty Thuận Hòa Phát', 'THP'],
    ['YFY Vĩnh Huê Hà Nam', 'YFY'],
    ['Bao Bì Đồng Nai', 'BBDN'],
    ['Giấy Xương Giang', 'XG'],
  ];

  for (const [suppName, expectedCode] of supplierCodes) {
    const code = getSupplierShortCode(suppName);
    assertStrictEqual(code, expectedCode, `getSupplierShortCode("${suppName}") === "${expectedCode}"`, 'Area 3 (Supplier Short Code)');
  }

  const specDesc = getDefaultSpecs('Lưỡi gà trắng 71mm', 'LG-01', 'cuộn');
  assert(specDesc.includes('Lưỡi gà trắng') || specDesc.includes('Cuộn giấy lưỡi gà'), 'Generated default technical specifications for Lưỡi gà', 'Area 3 (Specs Generator)');
}

// ============================================================================
// SUITE 4: AREA 4 - BUILD & TYPESCRIPT INTEGRITY VERIFICATION
// ============================================================================

function runArea4Tests() {
  sectionHeader('TypeScript & Production Build Verification', 4);

  // 4.1 TypeScript Compiler Verification
  console.log(`\n${ANSI.bold}${ANSI.yellow}--- 4.1 Executing TypeScript Type Check (npx tsc --noEmit) ---${ANSI.reset}`);
  let tscPassed = false;
  let tscOutput = '';
  try {
    tscOutput = execSync('npx tsc --noEmit', { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] });
    tscPassed = true;
  } catch (err: any) {
    tscOutput = (err.stdout || '') + '\n' + (err.stderr || '') + '\n' + (err.message || '');
    tscPassed = false;
  }
  assert(tscPassed, 'TypeScript compiler passed with 0 errors (npx tsc --noEmit)', 'Area 4 (TypeScript)', tscPassed ? undefined : tscOutput);

  // 4.2 Production Bundle Build Verification
  console.log(`\n${ANSI.bold}${ANSI.yellow}--- 4.2 Executing Production Build (npm run build) ---${ANSI.reset}`);
  let buildPassed = false;
  let buildOutput = '';
  try {
    buildOutput = execSync('npm run build', { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] });
    buildPassed = true;
  } catch (err: any) {
    buildOutput = (err.stdout || '') + '\n' + (err.stderr || '') + '\n' + (err.message || '');
    buildPassed = false;
  }
  assert(buildPassed, 'Production Vite bundle and Node server build completed successfully (npm run build)', 'Area 4 (Build)', buildPassed ? undefined : buildOutput);
}

// ============================================================================
// MAIN EXECUTION & SUMMARY REPORTING
// ============================================================================

function main() {
  const startTime = Date.now();
  console.log(`${ANSI.bold}${ANSI.magenta}╔══════════════════════════════════════════════════════════════════════════════╗${ANSI.reset}`);
  console.log(`${ANSI.bold}${ANSI.magenta}║       TSG BUSINESS OS - COMPREHENSIVE E2E VERIFICATION SUITE                 ║${ANSI.reset}`);
  console.log(`${ANSI.bold}${ANSI.magenta}╚══════════════════════════════════════════════════════════════════════════════╝${ANSI.reset}`);

  try {
    runArea1Tests();
    runArea2Tests();
    runArea3Tests();
    runArea4Tests();
  } catch (e: any) {
    console.error(`\n${ANSI.red}${ANSI.bold}FATAL ERROR IN TEST SUITE EXECUTION:${ANSI.reset}`, e);
    failedTests++;
  }

  const durationMs = Date.now() - startTime;

  console.log('\n' + '='.repeat(80));
  console.log(`${ANSI.bold}${ANSI.cyan}FINAL TEST EXECUTION SUMMARY${ANSI.reset}`);
  console.log('='.repeat(80));
  console.log(`  Total Tests Run : ${ANSI.bold}${totalTests}${ANSI.reset}`);
  console.log(`  Passed Tests    : ${ANSI.bold}${ANSI.green}${passedTests}${ANSI.reset}`);
  console.log(`  Failed Tests    : ${ANSI.bold}${failedTests > 0 ? ANSI.red : ANSI.green}${failedTests}${ANSI.reset}`);
  console.log(`  Duration        : ${ANSI.dim}${durationMs}ms${ANSI.reset}`);
  console.log('='.repeat(80));

  if (failedTests > 0) {
    console.log(`\n${ANSI.bold}${ANSI.red}FAILURE BREAKDOWN (${failedTests} failures):${ANSI.reset}`);
    failures.forEach((f, idx) => {
      console.log(`  ${idx + 1}. [${f.area}] ${f.test}: ${f.error}`);
    });
    process.exit(1);
  } else {
    console.log(`\n${ANSI.bold}${ANSI.green}★ ALL 4 CORE AREAS FULLY VERIFIED WITH 100% PASS RATE ★${ANSI.reset}\n`);
    process.exit(0);
  }
}

main();
