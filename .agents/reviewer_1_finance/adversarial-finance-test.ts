import Papa from 'papaparse';
import { 
  parseNumber, 
  formatVND,
  findPriceRecord, 
  getBuyPriceFromRecord, 
  getSellPriceFromRecord, 
  calculatePOLineFinances, 
  calculateDeliveryFinances,
  scoreProductMatch,
  normalizeString,
  parseDateToISO,
  formatDateForDisplay,
  parseProductNameAndSpecs,
  findUnifiedProductEntity
} from '../../src/lib/business-logic';
import { 
  CUSTOMER_DATA, 
  SUPPLIER_DATA, 
  CONTACTS_DATA, 
  PRICING_DATA, 
  PRODUCT_DATA, 
  SPECS_DATA, 
  PO_HEADER_DATA, 
  PO_LINES_DATA, 
  DELIVERY_PLAN_DATA, 
  DELIVERY_DATA 
} from '../../src/data';

console.log('====================================================');
console.log(' ADVERSARIAL FINANCIAL & DATA INTEGRITY TEST SUITE  ');
console.log('====================================================\n');

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function assert(condition: boolean, testName: string, detail?: any) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  [PASS] ${testName}`);
  } else {
    failedTests++;
    console.error(`  [FAIL] ${testName}`, detail !== undefined ? `-> Got: ${JSON.stringify(detail)}` : '');
  }
}

// ==========================================
// TEST SUITE 1: ADVERSARIAL NUMBER PARSING
// ==========================================
console.log('--- TEST SUITE 1: Adversarial parseNumber ---');

const numberCases: { input: any; expected: number; desc: string }[] = [
  // Standard Vietnamese thousand dots
  { input: '718.062.120,00', expected: 718062120, desc: 'VN currency format with decimal comma' },
  { input: '1.800', expected: 1800, desc: 'VN 3-digit thousand dot' },
  { input: '10.861', expected: 10861, desc: 'VN 3-digit thousand dot' },
  { input: '99.000.000', expected: 99000000, desc: 'VN millions with dots' },

  // International format
  { input: '718,062,120.00', expected: 718062120, desc: 'US currency format with decimal dot' },
  { input: '1,800', expected: 1800, desc: 'US thousand comma' },
  { input: '10,861', expected: 10861, desc: 'US thousand comma' },

  // Decimals
  { input: '35.63', expected: 35.63, desc: 'Float decimal dot' },
  { input: '35,63', expected: 35.63, desc: 'Float decimal comma' },
  { input: '2.5', expected: 2.5, desc: '1 decimal place dot' },
  { input: '2,5', expected: 2.5, desc: '1 decimal place comma' },
  { input: '77,313.60', expected: 77313.6, desc: 'Mixed comma thousand and dot decimal' },
  { input: '77.313,60', expected: 77313.6, desc: 'Mixed dot thousand and comma decimal' },

  // Percentages
  { input: '35.63%', expected: 35.63, desc: 'Percentage with dot' },
  { input: '35,63%', expected: 35.63, desc: 'Percentage with comma' },
  { input: '100%', expected: 100, desc: '100%' },
  { input: '0%', expected: 0, desc: '0%' },
  { input: '-15%', expected: -15, desc: 'Negative percentage' },
  { input: '(-15%)', expected: -15, desc: 'Parentheses negative percentage' },

  // Negative accounting parentheses & minus
  { input: '(100)', expected: -100, desc: 'Accounting parentheses (100)' },
  { input: '(50.000)', expected: -50000, desc: 'Accounting parentheses (50.000)' },
  { input: '(1.234.567,89)', expected: -1234567.89, desc: 'Accounting parentheses with VN format' },
  { input: '(1,234,567.89)', expected: -1234567.89, desc: 'Accounting parentheses with US format' },
  { input: '-1.800', expected: -1800, desc: 'Minus with thousand dot' },
  { input: '-1,800', expected: -1800, desc: 'Minus with thousand comma' },
  { input: '- 250.000', expected: -250000, desc: 'Minus with space' },

  // Currency symbols & whitespace
  { input: ' 250.000 ₫ ', expected: 250000, desc: 'VND symbol ₫ with spaces' },
  { input: '250.000 đ', expected: 250000, desc: 'VND symbol đ' },
  { input: '$ 1,234.50', expected: 1234.5, desc: 'Dollar symbol' },
  { input: '1000000 VND', expected: 1000000, desc: 'VND text suffix' },
  { input: ' 233,395.00 ', expected: 233395, desc: 'Leading/trailing whitespace' },
  { input: '( 99.000,50 ₫ )', expected: -99000.5, desc: 'Negative parentheses with currency symbol' },

  // Falsy, null, undefined, invalid
  { input: null, expected: 0, desc: 'null value' },
  { input: undefined, expected: 0, desc: 'undefined value' },
  { input: '', expected: 0, desc: 'Empty string' },
  { input: '   ', expected: 0, desc: 'Whitespace-only string' },
  { input: 'N/A', expected: 0, desc: 'N/A text' },
  { input: 'Unknown', expected: 0, desc: 'Unknown text' },
  { input: NaN, expected: 0, desc: 'NaN literal' },
  { input: 0, expected: 0, desc: 'Numeric 0' },
  { input: -0, expected: 0, desc: 'Numeric -0' },
  { input: 123456, expected: 123456, desc: 'Numeric positive integer' },
  { input: -987.65, expected: -987.65, desc: 'Numeric negative float' }
];

for (const c of numberCases) {
  const res = parseNumber(c.input);
  const isMatch = Math.abs(res - c.expected) < 0.0001 && !isNaN(res);
  assert(isMatch, `parseNumber: ${c.desc} [${String(c.input)}] -> ${res}`, res);
}

// ==========================================
// TEST SUITE 2: PRICING RECORD MATCHING & COGS FALLBACK
// ==========================================
console.log('\n--- TEST SUITE 2: Pricing Lookup & COGS Priority ---');

const pricingRows = Papa.parse(PRICING_DATA.trim(), { header: true }).data as any[];
const poLineRows = Papa.parse(PO_LINES_DATA.trim(), { header: true }).data as any[];
const deliveryRows = Papa.parse(DELIVERY_DATA.trim(), { header: true }).data as any[];

assert(pricingRows.length > 0, `Loaded ${pricingRows.length} pricing records`);
assert(poLineRows.length > 0, `Loaded ${poLineRows.length} PO Line records`);
assert(deliveryRows.length > 0, `Loaded ${deliveryRows.length} Delivery records`);

// 1. Direct SKU Matching on Gsp_XXX
const gspList = ['Gsp_082', 'Gsp_090', 'Gsp_091', 'Gsp_092', 'Gsp_093', 'Gsp_094', 'Gsp_117', 'Gsp_118', 'Gsp_142', 'Gsp_148'];
for (const gsp of gspList) {
  const record = findPriceRecord(pricingRows, gsp);
  assert(record !== null && (record['Mã giá bán'] === gsp || record['Mã giá'] === gsp), `findPriceRecord finds exact code ${gsp}`, record?.['Mã giá bán']);
}

// 2. Critical Fallback Test: Gsp_094, Gsp_142, Gsp_148 (Preventing 100% false margin)
const gsp094 = findPriceRecord(pricingRows, 'Gsp_094');
const buy094 = getBuyPriceFromRecord(gsp094);
const sell094 = getSellPriceFromRecord(gsp094);
assert(buy094 === 99000, `Gsp_094 Buy Price fallback to Giá AVP (99,000)`, buy094);
assert(sell094 === 497322 || sell094 === 495000, `Gsp_094 Sell Price parsed correctly`, sell094);

const gsp142 = findPriceRecord(pricingRows, 'Gsp_142');
const buy142 = getBuyPriceFromRecord(gsp142);
const sell142 = getSellPriceFromRecord(gsp142);
assert(Math.abs(buy142 - 77313.6) < 0.01, `Gsp_142 Buy Price fallback to Giá AVP (77,313.60)`, buy142);
assert(sell142 === 386568, `Gsp_142 Sell Price parsed correctly`, sell142);

const gsp148 = findPriceRecord(pricingRows, 'Gsp_148');
const buy148 = getBuyPriceFromRecord(gsp148);
const sell148 = getSellPriceFromRecord(gsp148);
assert(Math.abs(buy148 - 80381.6) < 0.01, `Gsp_148 Buy Price fallback to Giá AVP (80,381.60)`, buy148);
assert(sell148 === 401908, `Gsp_148 Sell Price parsed correctly`, sell148);

// 3. Location-based differentiation (TH130/07 at Thăng Long vs Thanh Hóa)
const th130ThangLong = findPriceRecord(pricingRows, { sku: 'TH130/07', location: 'Thăng Long', customer: 'Thăng Long' });
assert(th130ThangLong?.['Mã giá bán'] === 'Gsp_082', `TH130/07 at Thăng Long resolves to Gsp_082`, th130ThangLong?.['Mã giá bán']);

const th130ThanhHoa = findPriceRecord(pricingRows, { sku: 'TH130/07', location: 'Thanh Hoá', customer: 'Thăng Long' });
assert(th130ThanhHoa?.['Mã giá bán'] === 'Gsp_131', `TH130/07 at Thanh Hoá resolves to Gsp_131`, th130ThanhHoa?.['Mã giá bán']);

// ==========================================
// TEST SUITE 3: PO LINE & DELIVERY FINANCIAL CALCULATIONS
// ==========================================
console.log('\n--- TEST SUITE 3: Financial Calculations & Zero NaN Guarantee ---');

let nanFound = 0;

// Test calculatePOLineFinances for ALL PO lines
for (const line of poLineRows) {
  const calc = calculatePOLineFinances(line, pricingRows);
  
  if (isNaN(calc.sellPrice) || isNaN(calc.buyPrice) || isNaN(calc.revenue) || isNaN(calc.profit) || isNaN(calc.margin)) {
    nanFound++;
    console.error(`  NaN detected in PO Line STT ${line['STT']}:`, calc);
  }

  // Mathematical integrity checks:
  const qty = parseNumber(line['Số lượng']);
  if (qty > 0) {
    const expectedRev = calc.sellPrice * qty;
    const expectedProfit = (calc.sellPrice - calc.buyPrice) * qty;
    const isRevCorrect = Math.abs(calc.revenue - expectedRev) < 0.01;
    const isProfitCorrect = Math.abs(calc.profit - expectedProfit) < 0.01;
    if (!isRevCorrect || !isProfitCorrect) {
      console.error(`  Math mismatch in PO line ${line['STT']}: Rev=${calc.revenue} (expected ${expectedRev}), Profit=${calc.profit} (expected ${expectedProfit})`);
      nanFound++;
    }
  }
}
assert(nanFound === 0, `Zero NaN or math errors across all ${poLineRows.length} PO Lines`, nanFound);

// Test calculateDeliveryFinances for ALL deliveries
let delNanFound = 0;
for (const del of deliveryRows) {
  const calc = calculateDeliveryFinances(del, pricingRows, poLineRows);

  if (isNaN(calc.sellPrice) || isNaN(calc.buyPrice) || isNaN(calc.revenue) || isNaN(calc.profit) || isNaN(calc.margin)) {
    delNanFound++;
    console.error(`  NaN detected in Delivery STT ${del['STT']}:`, calc);
  }

  const qty = parseNumber(del['Số lượng giao'] ?? del['Số lượng']);
  if (qty > 0) {
    const expectedRev = calc.sellPrice * qty;
    const expectedProfit = (calc.sellPrice - calc.buyPrice) * qty;
    const isRevCorrect = Math.abs(calc.revenue - expectedRev) < 0.01;
    const isProfitCorrect = Math.abs(calc.profit - expectedProfit) < 0.01;
    if (!isRevCorrect || !isProfitCorrect) {
      console.error(`  Math mismatch in Delivery ${del['STT']}: Rev=${calc.revenue} (expected ${expectedRev}), Profit=${calc.profit} (expected ${expectedProfit})`);
      delNanFound++;
    }
  }
}
assert(delNanFound === 0, `Zero NaN or math errors across all ${deliveryRows.length} Deliveries`, delNanFound);

// ==========================================
// TEST SUITE 4: ADVERSARIAL BOUNDARY & CORNER CASES
// ==========================================
console.log('\n--- TEST SUITE 4: Boundary & Adversarial Inputs ---');

// 1. Line with 0 quantity
const zeroQtyLine = { 'STT': 'TEST_ZERO', 'Số lượng': 0, 'Đơn giá bán': 100000, 'Đơn giá nhập': 50000 };
const zeroCalc = calculatePOLineFinances(zeroQtyLine, pricingRows);
assert(zeroCalc.revenue === 0 && zeroCalc.profit === 0 && !isNaN(zeroCalc.margin), 'Zero quantity yields 0 revenue & 0 profit without NaN');

// 2. Line with null/undefined values
const emptyLine = { 'STT': 'TEST_EMPTY' };
const emptyCalc = calculatePOLineFinances(emptyLine, pricingRows);
assert(emptyCalc.revenue === 0 && emptyCalc.profit === 0 && emptyCalc.margin === 0 && !isNaN(emptyCalc.sellPrice), 'Empty PO line handles safely without NaN');

// 3. Delivery with missing pricing record but explicit unit prices
const customDelivery = {
  'STT': 'TEST_DEL',
  'Mã sản phẩm': 'NON_EXISTENT_SKU',
  'Số lượng giao': 100,
  'Đơn giá bán': '500.000 ₫',
  'Đơn giá nhập': '300.000 ₫'
};
const customDelCalc = calculateDeliveryFinances(customDelivery, pricingRows, poLineRows);
assert(customDelCalc.sellPrice === 500000 && customDelCalc.buyPrice === 300000 && customDelCalc.revenue === 50000000 && customDelCalc.profit === 20000000 && customDelCalc.margin === 40, 'Non-existent SKU falls back to row unit prices with Vietnamese currency format', customDelCalc);

// 4. Inferred unit price from total / qty when unit price is 0
const inferredDelivery = {
  'STT': 'TEST_INFERRED',
  'Mã sản phẩm': 'NON_EXISTENT_SKU_2',
  'Số lượng giao': 50,
  'Doanh thu': '10.000.000',
  'Giá vốn': '6.000.000'
};
const inferredDelCalc = calculateDeliveryFinances(inferredDelivery, pricingRows, []);
assert(inferredDelCalc.sellPrice === 200000 && inferredDelCalc.buyPrice === 120000 && inferredDelCalc.revenue === 10000000 && inferredDelCalc.profit === 4000000 && inferredDelCalc.margin === 40, 'Inferred unit price from total / qty when unit prices are empty', inferredDelCalc);

// ==========================================
// TEST SUITE 5: 13 DATA TABLES GRAPH CONNECTIVITY
// ==========================================
console.log('\n--- TEST SUITE 5: 13 Data Tables Graph Connectivity ---');

const poHeaderRows = Papa.parse(PO_HEADER_DATA.trim(), { header: true }).data as any[];
const deliveryPlanRows = Papa.parse(DELIVERY_PLAN_DATA.trim(), { header: true }).data as any[];

assert(poHeaderRows.length > 0, `Loaded ${poHeaderRows.length} PO Headers`);
assert(deliveryPlanRows.length > 0, `Loaded ${deliveryPlanRows.length} Delivery Plans`);

// Check whitespace stripping on PO 26/KHVT/0547 and 26/KHVT/0600
const po547Header = poHeaderRows.find(h => h['Đơn hàng'] === '26/KHVT/0547');
const po547Lines = poLineRows.filter(l => l['Số đơn hàng'] === '26/KHVT/0547');
const po547Deliv = deliveryRows.filter(d => d['Đơn hàng'] === '26/KHVT/0547');

assert(po547Header !== undefined, 'PO 26/KHVT/0547 Header exists without leading whitespace');
assert(po547Lines.length === 3, `PO 26/KHVT/0547 has exactly 3 lines (found ${po547Lines.length})`);
assert(po547Deliv.length === 1, `PO 26/KHVT/0547 has exactly 1 delivery (found ${po547Deliv.length})`);

const po600Header = poHeaderRows.find(h => h['Đơn hàng'] === '26/KHVT/0600');
const po600Lines = poLineRows.filter(l => l['Số đơn hàng'] === '26/KHVT/0600');
const po600Deliv = deliveryRows.filter(d => d['Đơn hàng'] === '26/KHVT/0600');

assert(po600Header !== undefined, 'PO 26/KHVT/0600 Header exists without leading whitespace');
assert(po600Lines.length === 1, `PO 26/KHVT/0600 has exactly 1 line (found ${po600Lines.length})`);
assert(po600Deliv.length === 4, `PO 26/KHVT/0600 has exactly 4 deliveries (found ${po600Deliv.length})`);

// Total summary
console.log('\n====================================================');
console.log(` SUMMARY: ${passedTests}/${totalTests} TESTS PASSED (${failedTests} FAILED)`);
console.log('====================================================\n');

if (failedTests > 0) {
  process.exit(1);
}
