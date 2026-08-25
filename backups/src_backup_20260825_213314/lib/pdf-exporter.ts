import html2pdf from 'html2pdf.js';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export interface PDFExportOptions {
  title?: string;
  subtitle?: string;
  filename?: string;
  orientation?: 'portrait' | 'landscape';
  format?: 'a4' | 'a3' | 'letter';
  margin?: [number, number, number, number] | number;
  includeLogo?: boolean;
  includeSignature?: boolean;
  signatureTitle?: string;
  companyName?: string;
}

let colorCanvas: HTMLCanvasElement | null = null;
let colorCtx: CanvasRenderingContext2D | null = null;

export function colorToRgb(colorStr: string): string {
  if (!colorStr) return 'rgb(0,0,0)';
  const trimmed = colorStr.trim();
  if (
    (trimmed.startsWith('rgb(') || trimmed.startsWith('rgba(') || trimmed === 'transparent') &&
    !/(?:oklab|oklch|lab|lch|color)\(/i.test(trimmed)
  ) {
    return trimmed;
  }

  if (!colorCanvas) {
    colorCanvas = document.createElement('canvas');
    colorCanvas.width = 1;
    colorCanvas.height = 1;
    colorCtx = colorCanvas.getContext('2d', { willReadFrequently: true });
  }

  if (!colorCtx) return 'rgb(100, 116, 139)';

  try {
    colorCtx.clearRect(0, 0, 1, 1);
    colorCtx.fillStyle = 'rgba(0,0,0,0)';
    colorCtx.fillStyle = trimmed;
    colorCtx.fillRect(0, 0, 1, 1);
    const [r, g, b, a] = colorCtx.getImageData(0, 0, 1, 1).data;
    if (a === 255) {
      return `rgb(${r}, ${g}, ${b})`;
    } else {
      const alpha = +(a / 255).toFixed(2);
      return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }
  } catch {
    return 'rgb(100, 116, 139)';
  }
}

export function replaceModernColors(cssText: string): string {
  if (!cssText || typeof cssText !== 'string' || !/(?:oklab|oklch|lab|lch|color)\(/i.test(cssText)) {
    return cssText;
  }

  const keywordRegex = /(?:oklab|oklch|lab|lch|color)\(/gi;
  let result = cssText;
  let match: RegExpExecArray | null;

  while ((match = keywordRegex.exec(result)) !== null) {
    const startIndex = match.index;
    let depth = 0;
    let endIndex = -1;

    for (let i = startIndex; i < result.length; i++) {
      if (result[i] === '(') {
        depth++;
      } else if (result[i] === ')') {
        depth--;
        if (depth === 0) {
          endIndex = i;
          break;
        }
      }
    }

    if (endIndex !== -1) {
      const fullColorExpr = result.slice(startIndex, endIndex + 1);
      const rgbConverted = colorToRgb(fullColorExpr);
      result = result.slice(0, startIndex) + rgbConverted + result.slice(endIndex + 1);
      keywordRegex.lastIndex = startIndex + rgbConverted.length;
    } else {
      break;
    }
  }

  return result;
}

export function patchWindowGetComputedStyle(win: Window) {
  if (!win || (win as any).__getComputedStylePatched) return;
  try {
    (win as any).__getComputedStylePatched = true;

    const origGetComputedStyle = win.getComputedStyle.bind(win);

    win.getComputedStyle = function (elt: Element, pseudoElt?: string | null) {
      const style = origGetComputedStyle(elt, pseudoElt);
      if (!style) return style;

      return new Proxy(style, {
        get(target, prop) {
          if (prop === 'getPropertyValue') {
            return (propertyName: string) => {
              const val = target.getPropertyValue(propertyName);
              return replaceModernColors(val);
            };
          }
          let val: any;
          try {
            val = (target as any)[prop];
          } catch {
            return undefined;
          }
          if (typeof val === 'function') {
            return val.bind(target);
          }
          if (typeof val === 'string' && /(?:oklab|oklch|lab|lch|color)\(/i.test(val)) {
            return replaceModernColors(val);
          }
          return val;
        }
      });
    };
  } catch (err) {
    console.warn('Failed to patch getComputedStyle:', err);
  }
}

// Auto-patch main window on module load
if (typeof window !== 'undefined') {
  patchWindowGetComputedStyle(window);
}

/**
 * Sanitizes all styles, style tags, and color attributes in a cloned document for html2canvas
 */
export function sanitizeDocColorsForCanvas(clonedDoc: Document): void {
  const targetWindow = clonedDoc.defaultView || window;
  if (targetWindow) {
    patchWindowGetComputedStyle(targetWindow);
  }

  // 1. Remove animation classes & freeze recharts container dimensions
  const anims = clonedDoc.querySelectorAll('.animate-in, [class*="transition"]');
  anims.forEach((el) => {
    el.classList.remove('animate-in');
    (el as HTMLElement).style.transition = 'none';
    (el as HTMLElement).style.animation = 'none';
  });

  const containers = clonedDoc.querySelectorAll('.recharts-responsive-container');
  containers.forEach((c) => {
    const el = c as HTMLElement;
    el.style.overflow = 'hidden';
    if (el.offsetWidth && el.offsetWidth > 250) {
      el.style.width = `${el.offsetWidth}px`;
    }
    if (el.offsetHeight && el.offsetHeight > 150) {
      el.style.height = `${el.offsetHeight}px`;
    }
  });

  // Prevent cards and containers from overflowing during canvas capture
  clonedDoc.querySelectorAll('.bg-white, .rounded-xl, .border').forEach((card) => {
    if (card instanceof HTMLElement) {
      card.style.overflow = 'hidden';
      card.style.boxSizing = 'border-box';
    }
  });

  // 2. Convert <style> tags (re-creating the style node forces browser CSS re-parse)
  clonedDoc.querySelectorAll('style').forEach((styleEl) => {
    if (styleEl.textContent && /(?:oklab|oklch|lab|lch|color)\(/i.test(styleEl.textContent)) {
      const sanitized = replaceModernColors(styleEl.textContent);
      const newStyle = clonedDoc.createElement('style');
      newStyle.textContent = sanitized;
      if (styleEl.parentNode) {
        styleEl.parentNode.replaceChild(newStyle, styleEl);
      } else {
        styleEl.textContent = sanitized;
      }
    }
  });

  // 3. Convert stylesheet rules
  try {
    Array.from(clonedDoc.styleSheets).forEach((sheet) => {
      try {
        const rules = sheet.cssRules || sheet.rules;
        if (!rules) return;
        for (let rIdx = 0; rIdx < rules.length; rIdx++) {
          const rule = rules[rIdx] as CSSStyleRule;
          if (rule && rule.cssText && /(?:oklab|oklch|lab|lch|color)\(/i.test(rule.cssText)) {
            if (rule.style) {
              for (let sIdx = 0; sIdx < rule.style.length; sIdx++) {
                const propName = rule.style[sIdx];
                const propVal = rule.style.getPropertyValue(propName);
                if (propVal && /(?:oklab|oklch|lab|lch|color)\(/i.test(propVal)) {
                  rule.style.setProperty(propName, replaceModernColors(propVal));
                }
              }
            }
          }
        }
      } catch {
        // Ignore cross-origin stylesheet errors
      }
    });
  } catch {
    // Ignore styleSheets access errors
  }

  // 4. Convert inline styles, SVG attributes
  clonedDoc.querySelectorAll('*').forEach((el) => {
    const htmlEl = el as HTMLElement;
    const styleAttr = htmlEl.getAttribute('style');
    if (styleAttr && /(?:oklab|oklch|lab|lch|color)\(/i.test(styleAttr)) {
      htmlEl.setAttribute('style', replaceModernColors(styleAttr));
    }
    ['fill', 'stroke', 'color', 'background-color', 'stop-color'].forEach((attr) => {
      const attrVal = htmlEl.getAttribute(attr);
      if (attrVal && /(?:oklab|oklch|lab|lch|color)\(/i.test(attrVal)) {
        htmlEl.setAttribute(attr, replaceModernColors(attrVal));
      }
    });
  });
}

/**
 * Direct PDF export from a React DOM element using html2pdf.js with 2x High-DPI canvas
 */
export async function exportElementToPDF(
  element: HTMLElement,
  filenameOrOptions: string | PDFExportOptions = 'Bao_Cao_ERP_Tam_Sen.pdf',
  orientationFallback: 'portrait' | 'landscape' = 'landscape'
): Promise<void> {
  const opts: PDFExportOptions = typeof filenameOrOptions === 'string'
    ? { filename: filenameOrOptions, orientation: orientationFallback }
    : filenameOrOptions;

  const filename = opts.filename || 'Bao_Cao_ERP_Tam_Sen.pdf';
  const orientation = opts.orientation || orientationFallback;
  const isLandscape = orientation === 'landscape';
  const targetWidth = isLandscape ? 1350 : 980;

  // Margin normalization
  let customMargin: [number, number, number, number] = [6, 6, 6, 6];
  if (typeof opts.margin === 'number') {
    customMargin = [opts.margin, opts.margin, opts.margin, opts.margin];
  } else if (Array.isArray(opts.margin) && opts.margin.length === 4) {
    customMargin = opts.margin;
  }

  const includeSignature = opts.includeSignature ?? false;
  const signatureTitle = opts.signatureTitle || 'Đại diện Doanh nghiệp';

  const opt = {
    margin: customMargin,
    filename: filename.endsWith('.pdf') ? filename : `${filename}.pdf`,
    image: { type: 'jpeg' as const, quality: 0.98 },
    html2canvas: {
      scale: 2,
      useCORS: true,
      logging: false,
      allowTaint: true,
      scrollX: 0,
      scrollY: 0,
      windowWidth: targetWidth,
      onclone: (clonedDoc: Document) => {
        const rootExportTarget = clonedDoc.getElementById('dashboard-content') || clonedDoc.body;
        if (rootExportTarget && rootExportTarget instanceof HTMLElement) {
          rootExportTarget.style.maxWidth = `${targetWidth}px`;
          rootExportTarget.style.width = `${targetWidth}px`;
          rootExportTarget.style.margin = '0 auto';
          rootExportTarget.style.padding = '16px';
          rootExportTarget.style.backgroundColor = '#f8fafc';

          // Inject Signature Block if requested
          if (includeSignature && !clonedDoc.getElementById('pdf-signature-block')) {
            const sigDiv = clonedDoc.createElement('div');
            sigDiv.id = 'pdf-signature-block';
            sigDiv.className = 'mt-8 pt-6 border-t border-slate-200 grid grid-cols-2 gap-8 text-slate-700 bg-white p-6 rounded-xl shadow-sm print:break-inside-avoid';
            sigDiv.style.pageBreakInside = 'avoid';
            sigDiv.innerHTML = `
              <div>
                <div style="font-size: 13px; font-weight: bold; color: #1e293b;">Người Lập Báo Cáo</div>
                <div style="font-size: 11px; font-style: italic; color: #64748b; margin-top: 2px;">(Ký, ghi rõ họ tên)</div>
                <div style="height: 50px;"></div>
              </div>
              <div style="text-align: right;">
                <div style="font-size: 11px; font-style: italic; color: #64748b; margin-bottom: 4px;">Ngày ${new Date().getDate()} tháng ${new Date().getMonth() + 1} năm ${new Date().getFullYear()}</div>
                <div style="font-size: 13px; font-weight: bold; color: #1e293b;">${sanitizePdfText(signatureTitle)}</div>
                <div style="font-size: 11px; font-style: italic; color: #64748b; margin-top: 2px;">(Ký, ghi rõ họ tên & đóng dấu)</div>
                <div style="height: 50px;"></div>
              </div>
            `;
            rootExportTarget.appendChild(sigDiv);
          }
        }
        sanitizeDocColorsForCanvas(clonedDoc);
      }
    },
    jsPDF: {
      unit: 'mm',
      format: opts.format || 'a4',
      orientation: orientation
    },
    pagebreak: { mode: ['avoid-all', 'css', 'legacy'] }
  };

  return html2pdf().set(opt).from(element).save();
}

/**
 * Format currency VND for PDF
 */
export function formatVND(val: any): string {
  if (val === null || val === undefined || val === '') return '0 đ';
  const num = typeof val === 'number' ? val : parseFloat(String(val).replace(/[^0-9.-]+/g, ''));
  if (isNaN(num)) return '0 đ';
  return new Intl.NumberFormat('vi-VN').format(Math.round(num)) + ' đ';
}

/**
 * Sanitize and normalize Vietnamese text to ASCII for crisp rendering in jsPDF standard fonts
 */
export function sanitizePdfText(val: any): string {
  if (val === null || val === undefined) return '';
  const str = String(val);
  return str
    .replace(/Đ/g, 'D')
    .replace(/đ/g, 'd')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

export interface ExportTablePDFOptions {
  title: string;
  subtitle?: string;
  filename?: string;
  columns: string[];
  data: any[];
  summaryStats?: Array<{ label: string; value: string | number; color?: number[] }>;
  orientation?: 'portrait' | 'landscape';
  companyName?: string;
  margin?: [number, number, number, number] | number;
  includeLogo?: boolean;
  includeSignature?: boolean;
  signatureTitle?: string;
}

/**
 * Generic professional table exporter using jsPDF and jspdf-autotable
 */
export function exportGenericTableToPDF({
  title,
  subtitle,
  filename,
  columns,
  data,
  summaryStats = [],
  orientation,
  companyName = 'CÔNG TY CỔ PHẦN ERP TÂM SEN',
  margin,
  includeLogo = true,
  includeSignature = false,
  signatureTitle = 'Đại diện Doanh nghiệp / Giám đốc'
}: ExportTablePDFOptions): void {
  if (!columns || columns.length === 0 || !data) {
    throw new Error('Dữ liệu xuất PDF không hợp lệ hoặc rỗng.');
  }

  // Auto detect orientation: landscape for > 5 columns
  const finalOrientation = orientation || (columns.length > 5 ? 'landscape' : 'portrait');

  const doc = new jsPDF({
    orientation: finalOrientation,
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  // Margins setup
  let marginTop = 26;
  let marginBottom = 16;
  let marginLeft = 10;
  let marginRight = 10;

  if (typeof margin === 'number') {
    marginTop = margin;
    marginBottom = margin;
    marginLeft = margin;
    marginRight = margin;
  } else if (Array.isArray(margin)) {
    if (margin.length === 4) {
      [marginTop, marginRight, marginBottom, marginLeft] = margin;
    } else if (margin.length === 2) {
      [marginTop, marginLeft] = margin;
      marginBottom = marginTop;
      marginRight = marginLeft;
    }
  }

  // 1. Draw Company Header Banner (slate-900 background)
  doc.setFillColor(15, 23, 42); // #0F172A
  doc.rect(0, 0, pageWidth, 22, 'F');

  let companyX = marginLeft;
  if (includeLogo) {
    // Draw Logo Badge [TS]
    doc.setFillColor(14, 165, 233); // #0EA5E9
    doc.roundedRect(marginLeft, 4.5, 13, 13, 2.5, 2.5, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('TS', marginLeft + 6.5, 13, { align: 'center' });
    companyX = marginLeft + 17;
  }

  // Company Name
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  doc.text(sanitizePdfText(companyName), companyX, 11);

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(148, 163, 184); // slate-400
  doc.text('He thong Quan tri Doanh nghiep & Chuoi cung ung ERP', companyX, 16);

  // Timestamp
  const nowStr = new Date().toLocaleDateString('vi-VN') + ' ' + new Date().toLocaleTimeString('vi-VN');
  doc.text(`Ngay xuat: ${nowStr}`, pageWidth - marginRight, 13, { align: 'right' });

  // 2. Document Title & Subtitle
  let currentY = marginTop + 4;
  doc.setTextColor(30, 41, 59); // slate-800
  doc.setFontSize(15);
  doc.setFont('helvetica', 'bold');
  doc.text(sanitizePdfText(title.toUpperCase()), marginLeft, currentY);

  currentY += 6;
  const subText = subtitle || `Tong so: ${data.length} ban ghi | Xuat tu He thong ${companyName}`;
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139); // slate-500
  doc.text(sanitizePdfText(subText), marginLeft, currentY);

  currentY += 6;

  // 3. Render Summary KPI Cards if provided
  if (summaryStats.length > 0) {
    const cardGap = 4;
    const cardCount = Math.min(summaryStats.length, 4);
    const availableWidth = pageWidth - marginLeft - marginRight;
    const cardWidth = (availableWidth - (cardGap * (cardCount - 1))) / cardCount;

    summaryStats.slice(0, cardCount).forEach((stat, idx) => {
      const x = marginLeft + idx * (cardWidth + cardGap);
      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(226, 232, 240);
      doc.roundedRect(x, currentY, cardWidth, 14, 2, 2, 'FD');

      doc.setFontSize(7.5);
      doc.setTextColor(100, 116, 139);
      doc.setFont('helvetica', 'bold');
      doc.text(sanitizePdfText(stat.label.toUpperCase()), x + 3, currentY + 5);

      const valColor = stat.color || [14, 165, 233];
      doc.setFontSize(10);
      doc.setTextColor(valColor[0], valColor[1], valColor[2]);
      doc.setFont('helvetica', 'bold');
      doc.text(sanitizePdfText(String(stat.value)), x + 3, currentY + 11);
    });

    currentY += 18;
  }

  // 4. Determine Column Formats & Alignments
  const hasSTTColumn = columns.some(c => c.toLowerCase() === 'stt');
  const finalColumns = hasSTTColumn ? columns : ['STT', ...columns];

  const columnMeta = finalColumns.map((colName) => {
    const lower = colName.toLowerCase();
    const isCurrency = /(doanh thu|lợi nhuận|loi nhuan|đơn giá|don gia|giá trị|gia tri|chi phí|chi phi|thành tiền|thanh tien|doanh số|doanh so|tiền|tien|nợ|no|phí|phi|chênh lệch|chenh lech)/i.test(lower);
    const isNumber = /(số lượng|so luong|khối lượng|khoi luong|tồn kho|ton kho|trọng lượng|trong luong|sản lượng|san luong|qty|quantity|count)/i.test(lower);
    const isCenter = /(stt|mã|ma|ngày|ngay|po|pxk|trạng thái|trang thai|code|date|status)/i.test(lower);

    let align: 'left' | 'center' | 'right' = 'left';
    if (isCurrency || isNumber) align = 'right';
    else if (isCenter) align = 'center';

    return {
      name: colName,
      isCurrency,
      isNumber,
      align
    };
  });

  // Track sums for total row
  const colSums: Record<number, number> = {};
  let hasAnySum = false;

  // 5. Build Body Rows
  const bodyRows = data.map((row, rowIndex) => {
    return finalColumns.map((colName, colIdx) => {
      if (colName === 'STT') {
        return (rowIndex + 1).toString();
      }

      const rawVal = row[colName];
      const meta = columnMeta[colIdx];

      if (meta.isCurrency) {
        const numVal = typeof rawVal === 'number' ? rawVal : parseFloat(String(rawVal || 0).replace(/[^0-9.-]+/g, ''));
        if (!isNaN(numVal)) {
          colSums[colIdx] = (colSums[colIdx] || 0) + numVal;
          hasAnySum = true;
          return formatVND(numVal);
        }
        return '0 đ';
      }

      if (meta.isNumber) {
        const numVal = typeof rawVal === 'number' ? rawVal : parseFloat(String(rawVal || 0).replace(/[^0-9.-]+/g, ''));
        if (!isNaN(numVal)) {
          colSums[colIdx] = (colSums[colIdx] || 0) + numVal;
          hasAnySum = true;
          return numVal.toLocaleString('vi-VN');
        }
        return '0';
      }

      return sanitizePdfText(rawVal ?? '');
    });
  });

  // 6. Append Totals / Summary Row if numbers were aggregated
  if (hasAnySum && data.length > 0) {
    const totalRow = finalColumns.map((colName, colIdx) => {
      if (colIdx === 0) return '';
      if (colIdx === 1 || (colIdx === 0 && finalColumns.length === 1)) return 'TONG CONG';
      
      const meta = columnMeta[colIdx];
      if (colSums[colIdx] !== undefined) {
        if (meta.isCurrency) {
          return formatVND(colSums[colIdx]);
        }
        if (meta.isNumber) {
          return colSums[colIdx].toLocaleString('vi-VN');
        }
      }
      return '';
    });
    bodyRows.push(totalRow);
  }

  // 7. AutoTable Column Styles Setup
  const columnStylesObj: Record<number, any> = {};
  columnMeta.forEach((meta, idx) => {
    columnStylesObj[idx] = { halign: meta.align };
  });

  // 8. Generate AutoTable
  autoTable(doc, {
    startY: currentY,
    head: [finalColumns.map(c => sanitizePdfText(c))],
    body: bodyRows,
    theme: 'grid',
    headStyles: {
      fillColor: [30, 41, 59], // slate-800
      textColor: [255, 255, 255],
      fontSize: 8,
      fontStyle: 'bold',
      halign: 'center',
      valign: 'middle'
    },
    bodyStyles: {
      fontSize: 7.5,
      textColor: [51, 65, 85], // slate-700
      valign: 'middle'
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252] // slate-50
    },
    columnStyles: columnStylesObj,
    margin: { top: marginTop, bottom: marginBottom, left: marginLeft, right: marginRight },
    didParseCell: (dataCell) => {
      // Style total row specially
      if (hasAnySum && dataCell.section === 'body' && dataCell.row.index === bodyRows.length - 1) {
        dataCell.cell.styles.fontStyle = 'bold';
        dataCell.cell.styles.fillColor = [241, 245, 249]; // slate-100
        dataCell.cell.styles.textColor = [15, 23, 42];
      }
    },
    didDrawPage: (dataPage) => {
      // Header on page > 1
      if (dataPage.pageNumber > 1) {
        doc.setFillColor(15, 23, 42);
        doc.rect(0, 0, pageWidth, 12, 'F');

        let subHeaderX = marginLeft;
        if (includeLogo) {
          doc.setFillColor(14, 165, 233);
          doc.roundedRect(marginLeft, 2, 8, 8, 1.5, 1.5, 'F');
          doc.setTextColor(255, 255, 255);
          doc.setFontSize(7);
          doc.setFont('helvetica', 'bold');
          doc.text('TS', marginLeft + 4, 7.5, { align: 'center' });
          subHeaderX = marginLeft + 11;
        }

        doc.setFontSize(8);
        doc.setTextColor(255, 255, 255);
        doc.setFont('helvetica', 'bold');
        doc.text(sanitizePdfText(companyName), subHeaderX, 8);
        doc.text(`Trang ${dataPage.pageNumber}`, pageWidth - marginRight, 8, { align: 'right' });
      }

      // Footer on every page
      doc.setFontSize(7.5);
      doc.setTextColor(148, 163, 184); // slate-400
      doc.setFont('helvetica', 'normal');
      const footerY = pageHeight - Math.max(5, marginBottom / 2);
      doc.text(`${sanitizePdfText(companyName)} - He thong Bao cao & Quan tri Doanh nghiep`, marginLeft, footerY);
      doc.text(`Trang ${dataPage.pageNumber}`, pageWidth - marginRight, footerY, { align: 'right' });
    }
  });

  // 9. Draw Signature Block if includeSignature is enabled
  if (includeSignature) {
    const lastTable = (doc as any).lastAutoTable;
    const finalY = lastTable ? lastTable.finalY + 10 : currentY + 10;

    // Check if signature fits on current page
    let sigY = finalY;
    if (finalY + 35 > pageHeight - marginBottom) {
      doc.addPage();
      sigY = marginTop + 10;
    }

    const today = new Date();
    const dateStr = `Ngay ${today.getDate()} thang ${today.getMonth() + 1} nam ${today.getFullYear()}`;

    // Right Signature (Director / Manager)
    const rightX = pageWidth - marginRight - 25;
    doc.setFontSize(8);
    doc.setFont('helvetica', 'italic');
    doc.setTextColor(100, 116, 139);
    doc.text(dateStr, rightX, sigY, { align: 'center' });

    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 41, 59);
    doc.text(sanitizePdfText(signatureTitle), rightX, sigY + 5, { align: 'center' });

    doc.setFontSize(8);
    doc.setFont('helvetica', 'italic');
    doc.setTextColor(148, 163, 184);
    doc.text('(Ky, ghi ro ho ten & dong dau)', rightX, sigY + 10, { align: 'center' });

    // Left Signature (Creator)
    const leftX = marginLeft + 25;
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 41, 59);
    doc.text('Nguoi lap bao cao', leftX, sigY + 5, { align: 'center' });

    doc.setFontSize(8);
    doc.setFont('helvetica', 'italic');
    doc.setTextColor(148, 163, 184);
    doc.text('(Ky, ghi ro ho ten)', leftX, sigY + 10, { align: 'center' });
  }

  // Save PDF
  const name = filename || `${title.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.pdf`;
  doc.save(name.endsWith('.pdf') ? name : `${name}.pdf`);
}

/**
 * Generate a clean, vector-rendered tabular PDF report with multi-page support
 */
export function generateStructuredPDFReport({
  title = 'BÁO CÁO HOẠT ĐỘNG ERP TÂM SEN',
  subtitle = 'Chi tiết giao hàng và tiến độ thực hiện đơn hàng',
  filename = 'Bao_Cao_ERP_Tam_Sen.pdf',
  deliveryData = [],
  poLinesData = [],
  summaryStats = {},
  orientation = 'landscape',
  margin,
  includeLogo = true,
  includeSignature = false,
  signatureTitle = 'Đại diện Doanh nghiệp / Giám đốc',
  companyName = 'CÔNG TY CỔ PHẦN ERP TÂM SEN'
}: {
  title?: string;
  subtitle?: string;
  filename?: string;
  deliveryData?: any[];
  poLinesData?: any[];
  summaryStats?: {
    totalRevenue?: number;
    totalProfit?: number;
    totalVolume?: number;
    totalDeliveries?: number;
  };
  orientation?: 'portrait' | 'landscape';
  margin?: [number, number, number, number] | number;
  includeLogo?: boolean;
  includeSignature?: boolean;
  signatureTitle?: string;
  companyName?: string;
}) {
  const columns = ['Ngày giao', 'Số PXK', 'Số PO', 'Khách hàng', 'Tên sản phẩm', 'Số lượng giao', 'Đơn giá bán', 'Doanh thu', 'Lợi nhuận'];

  const formattedData = deliveryData.map((d) => ({
    'Ngày giao': d['Ngày giao'] || d['Ngày'] || '',
    'Số PXK': d['Số PXK'] || '',
    'Số PO': d['Đơn hàng'] || d['Số PO'] || '',
    'Khách hàng': d['Khách hàng'] || '',
    'Tên sản phẩm': d['Tên sản phẩm'] || '',
    'Số lượng giao': d['Số lượng giao'] || 0,
    'Đơn giá bán': d['Đơn giá bán'] || 0,
    'Doanh thu': d['Doanh thu'] || 0,
    'Lợi nhuận': d['Lợi nhuận'] || d['Lợi nhuận gộp'] || 0
  }));

  const statsList = [
    { label: 'Tong Doanh Thu', value: formatVND(summaryStats.totalRevenue || 0), color: [59, 130, 246] },
    { label: 'Tong Loi Nhuan', value: formatVND(summaryStats.totalProfit || 0), color: [16, 185, 129] },
    { label: 'Tong San Luong', value: `${(summaryStats.totalVolume || 0).toLocaleString('vi-VN')} sp`, color: [245, 158, 11] },
    { label: 'Tong Luot Giao', value: `${summaryStats.totalDeliveries || deliveryData.length} luot`, color: [139, 92, 246] }
  ];

  exportGenericTableToPDF({
    title,
    subtitle,
    filename,
    columns,
    data: formattedData,
    summaryStats: statsList,
    orientation,
    margin,
    includeLogo,
    includeSignature,
    signatureTitle,
    companyName
  });
}

