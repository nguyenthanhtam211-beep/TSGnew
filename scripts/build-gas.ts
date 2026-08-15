import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const rootDir = process.cwd();
const gasDir = path.join(rootDir, 'gas');
const tempDistDir = path.join(rootDir, 'dist-gas');

console.log('🚀 Starting Scientific Google Apps Script Modular Bundle Build...');

// Clean and recreate gas directory
if (fs.existsSync(gasDir)) {
  fs.rmSync(gasDir, { recursive: true, force: true });
}
fs.mkdirSync(gasDir, { recursive: true });

// Step 1: Run Vite Build with GAS config
console.log('📦 Step 1: Running Vite build with vite.gas.config.ts...');
try {
  execSync(`npx vite build --config vite.gas.config.ts`, { stdio: 'inherit', cwd: rootDir });
} catch (err) {
  console.error('❌ Vite build failed:', err);
  process.exit(1);
}

// Step 2: Read generated app.js and style.css
const appJsPath = path.join(tempDistDir, 'assets', 'app.js');
const appCssPath = path.join(tempDistDir, 'assets', 'style.css');

if (!fs.existsSync(appJsPath)) {
  console.error('❌ Could not find dist-gas/assets/app.js after build!');
  process.exit(1);
}

const jsCode = fs.readFileSync(appJsPath, 'utf-8');
const cssCode = fs.existsSync(appCssPath) ? fs.readFileSync(appCssPath, 'utf-8') : '';

// Step 3: Write AppCss.html
console.log('🎨 Step 2: Creating gas/AppCss.html...');
fs.writeFileSync(path.join(gasDir, 'AppCss.html'), `<style>\n${cssCode}\n</style>`, 'utf-8');

// Step 4: Split JavaScript into safe ~1.2 MB chunks for Apps Script Editor (AppJs1.html, AppJs2.html, etc.)
console.log('⚡ Step 3: Splitting JavaScript into safe modular Apps Script files...');
const CHUNK_SIZE = 1.2 * 1024 * 1024; // 1.2 MB per file
const jsChunks: string[] = [];

for (let i = 0; i < jsCode.length; i += CHUNK_SIZE) {
  jsChunks.push(jsCode.slice(i, i + CHUNK_SIZE));
}

const includeJsTags: string[] = [];

jsChunks.forEach((chunk, index) => {
  const fileName = `AppJs${index + 1}`;
  const filePath = path.join(gasDir, `${fileName}.html`);
  
  // Format code safely with max 500 chars per line to prevent editor paste truncation
  const lines: string[] = [];
  for (let j = 0; j < chunk.length; j += 500) {
    lines.push(chunk.slice(j, j + 500));
  }
  
  fs.writeFileSync(filePath, `<script>\n${lines.join('\n')}\n</script>`, 'utf-8');
  includeJsTags.push(`  <?!= include('${fileName}'); ?>`);
  console.log(`   └─ Generated gas/${fileName}.html (${(chunk.length / 1024 / 1024).toFixed(2)} MB)`);
});

// Step 5: Construct index.html using Apps Script Template syntax
console.log('📄 Step 4: Constructing gas/index.html template...');
const indexHtmlContent = `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Hệ Thống Quản Lý Doanh Nghiệp TSG Business</title>
  <?!= include('AppCss'); ?>
</head>
<body class="bg-slate-900 text-slate-100 antialiased selection:bg-blue-500 selection:text-white">
  <div id="root"></div>

${includeJsTags.join('\n')}
</body>
</html>`;

fs.writeFileSync(path.join(gasDir, 'index.html'), indexHtmlContent, 'utf-8');

// Copy Code.js and appsscript.json if they exist in root or recreate
const sourceCodeJs = path.join(rootDir, 'server-gas-code.js');
const sourceManifest = path.join(rootDir, 'server-gas-manifest.json');

// Re-write gas/Code.js with include helper
const codeJsContent = `/**
 * TSG Business ERP - Google Apps Script Backend Engine
 * Automatic Google Sheets DB, Native Google Drive & Google Calendar Integration
 */

// 1. Web App Server Entry Point
function doGet(e) {
  var template = HtmlService.createTemplateFromFile('index');
  return template.evaluate()
    .setTitle('Hệ Thống Quản Lý Doanh Nghiệp TSG Business')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1.0')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

// 2. Helper to include modular HTML files (AppCss, AppJs1, AppJs2...)
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

// 3. Get or Initialize Database Spreadsheet
function getDatabaseSpreadsheet() {
  const props = PropertiesService.getScriptProperties();
  let spreadsheetId = props.getProperty('TSG_SPREADSHEET_ID');
  let ss;

  if (spreadsheetId) {
    try {
      ss = SpreadsheetApp.openById(spreadsheetId);
    } catch (e) {
      console.warn("Stored Spreadsheet ID invalid, creating new one:", e);
    }
  }

  if (!ss) {
    const files = DriveApp.getFilesByName("Báo Cáo ERP Tâm Sen - Looker Studio & BigQuery Ready");
    if (files.hasNext()) {
      const file = files.next();
      ss = SpreadsheetApp.openById(file.getId());
      props.setProperty('TSG_SPREADSHEET_ID', file.getId());
    } else {
      ss = SpreadsheetApp.create("Báo Cáo ERP Tâm Sen - Looker Studio & BigQuery Ready");
      props.setProperty('TSG_SPREADSHEET_ID', ss.getId());
    }
  }

  const sheetNames = ["Daily_Deliveries_LookerStudio", "Daily_Summary_Aggregated", "PO_Lines_LookerStudio", "Customers_Directory", "Suppliers_Directory", "Tasks_Directory"];
  sheetNames.forEach(function(name) {
    if (!ss.getSheetByName(name)) {
      ss.insertSheet(name);
    }
  });

  return ss;
}

// 4. Fetch Full Database Data
function getDatabaseData() {
  const ss = getDatabaseSpreadsheet();
  const result = {
    spreadsheetId: ss.getId(),
    spreadsheetUrl: ss.getUrl(),
    customers: getSheetDataAsObjects(ss.getSheetByName("Customers_Directory")),
    suppliers: getSheetDataAsObjects(ss.getSheetByName("Suppliers_Directory")),
    deliveries: getSheetDataAsObjects(ss.getSheetByName("Daily_Deliveries_LookerStudio")),
    poLines: getSheetDataAsObjects(ss.getSheetByName("PO_Lines_LookerStudio")),
    tasks: getSheetDataAsObjects(ss.getSheetByName("Tasks_Directory"))
  };
  return JSON.stringify(result);
}

function getSheetDataAsObjects(sheet) {
  if (!sheet) return [];
  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return [];

  const headers = values[0];
  const rows = values.slice(1);

  return rows.filter(function(row) {
    return row.some(function(cell) { return cell !== "" && cell !== null; });
  }).map(function(row) {
    const obj = {};
    headers.forEach(function(header, idx) {
      if (header) obj[header] = row[idx];
    });
    return obj;
  });
}

// 5. Save Customer Row
function saveCustomer(customerData) {
  const ss = getDatabaseSpreadsheet();
  const sheet = ss.getSheetByName("Customers_Directory");

  const headers = ["Customer_ID", "Tên đầy đủ", "Phân loại", "Tình trạng", "Địa chỉ", "Nhà máy", "Số điện thoại", "Mã số thuế", "logoUrl", "Liên hệ liên kết", "updatedAt"];

  let values = sheet.getDataRange().getValues();
  if (values.length === 0 || values[0].length === 0) {
    sheet.appendRow(headers);
    values = [headers];
  }

  const custId = String(customerData.Customer_ID || customerData.id || '').trim();
  let rowIndex = -1;

  for (let i = 1; i < values.length; i++) {
    if (String(values[i][0]).trim() === custId) {
      rowIndex = i + 1;
      break;
    }
  }

  const rowData = [
    custId,
    customerData["Tên đầy đủ"] || customerData.name || "",
    customerData["Phân loại"] || customerData.category || "",
    customerData["Tình trạng"] || customerData.status || "Đang mua",
    customerData["Địa chỉ"] || customerData.address || "",
    customerData["Nhà máy"] || customerData.factory || "",
    customerData["Số điện thoại"] || customerData.phone || "",
    customerData["Mã số thuế"] || customerData.taxCode || "",
    customerData.logoUrl || "",
    customerData["Liên hệ liên kết"] || "",
    new Date().toISOString()
  ];

  if (rowIndex > 0) {
    sheet.getRange(rowIndex, 1, 1, rowData.length).setValues([rowData]);
  } else {
    sheet.appendRow(rowData);
  }

  return JSON.stringify({ success: true, customerId: custId });
}

// 6. Batch Sync Deliveries & POs
function syncAllData(payloadJson) {
  const payload = typeof payloadJson === 'string' ? JSON.parse(payloadJson) : payloadJson;
  const ss = getDatabaseSpreadsheet();

  const deliveries = payload.deliveries || [];
  const poLines = payload.poLines || [];
  const customers = payload.customers || [];
  const syncedAt = new Date().toISOString();

  const delSheet = ss.getSheetByName("Daily_Deliveries_LookerStudio");
  const delHeaders = [
    "delivery_date", "delivery_month", "delivery_year", "pxk_number", "po_number", "stt",
    "customer_name", "supplier_name", "product_code", "product_name", "unit", "quantity_delivered",
    "quantity_ordered", "unit_buy_price", "unit_sell_price", "revenue", "cogs", "profit",
    "margin_pct", "status", "synced_at"
  ];
  const delRows = deliveries.map(function(d) {
    return [
      d["Ngày giao"] || d["Ngày"] || "", d["delivery_month"] || "", d["delivery_year"] || "",
      d["Số PXK"] || "", d["Đơn hàng"] || d["Số PO"] || "", d["STT"] || "",
      d["Khách hàng"] || "", d["Nhà cung cấp"] || "", d["Mã sản phẩm"] || "",
      d["Tên sản phẩm"] || "", d["ĐVT"] || "Cái", d["Số lượng giao"] || d["Số lượng"] || 0,
      d["Số lượng đặt"] || 0, d["Đơn giá nhập"] || 0, d["Đơn giá bán"] || 0,
      d["Doanh thu"] || 0, d["cogs"] || 0, d["Lợi nhuận"] || 0, d["margin_pct"] || 0,
      d["Status"] || d["Trạng thái"] || "Hoàn thành", syncedAt
    ];
  });
  delSheet.clearContents();
  delSheet.getRange(1, 1, 1, delHeaders.length).setValues([delHeaders]);
  if (delRows.length > 0) {
    delSheet.getRange(2, 1, delRows.length, delHeaders.length).setValues(delRows);
  }

  const poSheet = ss.getSheetByName("PO_Lines_LookerStudio");
  const poHeaders = [
    "po_number", "customer_name", "supplier_name", "product_code", "product_name",
    "order_date", "delivery_deadline", "quantity_ordered", "quantity_delivered",
    "quantity_remaining", "unit_buy_price", "unit_sell_price", "total_po_value",
    "completion_pct", "po_status", "synced_at"
  ];
  const poRows = poLines.map(function(po) {
    return [
      po["Đơn hàng"] || po["Số PO"] || "", po["Khách hàng"] || "", po["Nhà cung cấp"] || "",
      po["Mã sản phẩm"] || "", po["Tên sản phẩm"] || "", po["Ngày đặt"] || "",
      po["Hạn giao hàng"] || "", po["Số lượng"] || 0, po["Đã giao"] || 0,
      po["Còn lại"] || 0, po["Đơn giá nhập"] || 0, po["Đơn giá bán"] || 0,
      po["Thành tiền bán"] || 0, po["completion_pct"] || 0, po["Trạng thái"] || "Đang tiến hành", syncedAt
    ];
  });
  poSheet.clearContents();
  poSheet.getRange(1, 1, 1, poHeaders.length).setValues([poHeaders]);
  if (poRows.length > 0) {
    poSheet.getRange(2, 1, poRows.length, poHeaders.length).setValues(poRows);
  }

  if (customers.length > 0) {
    const custSheet = ss.getSheetByName("Customers_Directory");
    const custHeaders = ["Customer_ID", "Tên đầy đủ", "Phân loại", "Tình trạng", "Địa chỉ", "Nhà máy", "Số điện thoại", "Mã số thuế", "logoUrl", "Liên hệ liên kết", "updatedAt"];
    const custRows = customers.map(function(c) {
      return [
        c["Customer_ID"] || c.id || "", c["Tên đầy đủ"] || c.name || "", c["Phân loại"] || "",
        c["Tình trạng"] || "Đang mua", c["Địa chỉ"] || "", c["Nhà máy"] || "",
        c["Số điện thoại"] || "", c["Mã số thuế"] || "", c.logoUrl || "", c["Liên hệ liên kết"] || "", syncedAt
      ];
    });
    custSheet.clearContents();
    custSheet.getRange(1, 1, 1, custHeaders.length).setValues([custHeaders]);
    custSheet.getRange(2, 1, custRows.length, custHeaders.length).setValues(custRows);
  }

  return JSON.stringify({
    success: true,
    spreadsheetId: ss.getId(),
    spreadsheetUrl: ss.getUrl(),
    syncedAt: syncedAt
  });
}

function createCalendarEvent(eventJson) {
  const event = typeof eventJson === 'string' ? JSON.parse(eventJson) : eventJson;
  const cal = CalendarApp.getDefaultCalendar();

  const title = event.summary || "Sự kiện TSG Business";
  const startTime = new Date(event.start);
  const endTime = new Date(event.end);
  const options = {
    description: event.description || "",
    location: event.location || ""
  };

  const createdEvent = cal.createEvent(title, startTime, endTime, options);
  return JSON.stringify({ success: true, eventId: createdEvent.getId() });
}

function saveDriveFile(fileDataJson) {
  const data = typeof fileDataJson === 'string' ? JSON.parse(fileDataJson) : fileDataJson;
  const fileName = data.fileName || "TSG_Document.json";
  const content = data.content || "";
  const mimeType = data.mimeType || "application/json";

  const rootFolder = DriveApp.getFoldersByName("TSG_Business_Documents");
  let folder;
  if (rootFolder.hasNext()) {
    folder = rootFolder.next();
  } else {
    folder = DriveApp.createFolder("TSG_Business_Documents");
  }

  const file = folder.createFile(fileName, content, mimeType);
  return JSON.stringify({
    success: true,
    fileId: file.getId(),
    fileUrl: file.getUrl()
  });
}

function askGeminiAI(prompt, apiKey) {
  const key = apiKey || PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
  if (!key) {
    return JSON.stringify({ error: "Chưa cấu hình GEMINI_API_KEY trong Script Properties." });
  }

  const url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=" + key;
  const payload = { contents: [{ parts: [{ text: prompt }] }] };
  const options = {
    method: "post",
    contentType: "application/json",
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };

  try {
    const response = UrlFetchApp.fetch(url, options);
    const json = JSON.parse(response.getContentText());
    const reply = json.candidates && json.candidates[0] && json.candidates[0].content && json.candidates[0].content.parts[0] ? json.candidates[0].content.parts[0].text : "Không có phản hồi từ AI";
    return JSON.stringify({ reply: reply });
  } catch (e) {
    return JSON.stringify({ error: e.toString() });
  }
}
`;

fs.writeFileSync(path.join(gasDir, 'Code.js'), codeJsContent, 'utf-8');

const appsscriptJson = `{
  "timeZone": "Asia/Ho_Chi_Minh",
  "dependencies": {},
  "webapp": {
    "access": "ANYONE_ANONYMOUS",
    "executeAs": "USER_DEPLOYING"
  },
  "exceptionLogging": "STACKDRIVER",
  "runtimeVersion": "V8"
}`;
fs.writeFileSync(path.join(gasDir, 'appsscript.json'), appsscriptJson, 'utf-8');

console.log('🎉 Google Apps Script Modular Bundle Complete! All files are in the "gas/" folder.');
