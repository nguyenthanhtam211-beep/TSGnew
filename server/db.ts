import { PrismaClient } from "@prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import Database from "better-sqlite3";
import Papa from "papaparse";
import {
  PRICING_DATA,
  PO_HEADER_DATA,
  PO_LINES_DATA,
  DELIVERY_DATA,
  CUSTOMER_DATA,
  SUPPLIER_DATA,
  PRODUCT_DATA,
} from "../src/data";

const adapter = new PrismaBetterSqlite3({ url: "file:./dev.db" });
export const prisma = new PrismaClient({ adapter });

function parseCSV(csvText: string): any[] {
  return Papa.parse(csvText.trim(), { header: true, skipEmptyLines: true }).data;
}

/**
 * Automatically seeds SQLite relational database if empty
 */
export async function seedDatabaseIfEmpty() {
  try {
    const productCount = await prisma.product.count();
    if (productCount > 0) {
      console.log(`[Database] Database already initialized with ${productCount} products.`);
      return;
    }

    console.log("[Database] Seeding initial data into SQLite Relational Database...");

    const rawProducts = parseCSV(PRODUCT_DATA);
    const rawCustomers = parseCSV(CUSTOMER_DATA);
    const rawSuppliers = parseCSV(SUPPLIER_DATA);
    const rawPricing = parseCSV(PRICING_DATA);
    const rawPOHeaders = parseCSV(PO_HEADER_DATA);
    const rawPOLines = parseCSV(PO_LINES_DATA);
    const rawDeliveries = parseCSV(DELIVERY_DATA);

    // 1. Seed Products
    const createdProducts = new Map<string, string>();
    for (const p of rawProducts) {
      const sku = p["Mã sản phẩm"] || p["Mã hàng"];
      if (!sku) continue;
      const created = await prisma.product.upsert({
        where: { sku },
        update: {},
        create: {
          sku,
          name: p["Tên sản phẩm"] || sku,
          spec: p["Thông Số Sản Phẩm"] || p["Quy cách"] || "Quy cách chuẩn",
          unit: p["Đơn Vị Tính"] || p["ĐVT"] || "Thùng",
          category: p["Nhóm hàng"] || "Hóa chất công nghiệp",
        },
      });
      createdProducts.set(sku, created.id);
    }
    console.log(`[Database] Seeded ${createdProducts.size} products.`);

    // 2. Seed Partners (Customers & Suppliers)
    const partnerMap = new Map<string, string>();

    for (let index = 0; index < rawCustomers.length; index++) {
      const c = rawCustomers[index];
      const custName = c["Tên đầy đủ"] || c["Customer_ID"] || `Khách hàng ${index + 1}`;
      const code = c["Customer_ID"] || `CUST-${index + 1}`;
      const partner = await prisma.partner.upsert({
        where: { code },
        update: {},
        create: {
          code,
          name: custName,
          type: "CUSTOMER",
          address: c["Địa chỉ"] || null,
        },
      });
      partnerMap.set(custName, partner.id);
      partnerMap.set(code, partner.id);
    }

    for (let index = 0; index < rawSuppliers.length; index++) {
      const s = rawSuppliers[index];
      const suppName = s["Tên Nhà Cung Cấp"] || s["Mã nhà cung cấp"] || `Nhà cung cấp ${index + 1}`;
      const code = s["Mã nhà cung cấp"] || `SUPP-${index + 1}`;
      const partner = await prisma.partner.upsert({
        where: { code },
        update: {},
        create: {
          code,
          name: suppName,
          type: "SUPPLIER",
          address: s["Địa chỉ"] || null,
        },
      });
      partnerMap.set(suppName, partner.id);
      partnerMap.set(code, partner.id);
    }
    console.log(`[Database] Seeded ${partnerMap.size} partners.`);

    // 3. Seed Price Book
    let priceCount = 0;
    for (let index = 0; index < rawPricing.length; index++) {
      const item = rawPricing[index];
      const sku = item["Mã sản phẩm"] || item["Mã hàng"];
      const priceCode = item["Mã giá bán"] || `PRICE-${index + 1}`;
      const custName = item["RP_Khách hàng"] || item["Khách hàng"] || "";
      const unitPrice = parseFloat(String(item["Đơn giá bán mới"] || item["Đơn giá bán"] || item["Giá chưa VAT"] || 0).replace(/[^0-9.-]+/g, "")) || 0;
      
      let productId = createdProducts.get(sku);
      if (!productId && sku) {
        const newProd = await prisma.product.create({
          data: {
            sku,
            name: item["Tên sản phẩm"] || sku,
            unit: item["ĐVT"] || "Thùng",
            category: item["Nhóm sản phẩm"] || "Hóa chất công nghiệp",
          },
        });
        productId = newProd.id;
        createdProducts.set(sku, newProd.id);
      }

      let partnerId = partnerMap.get(custName) || partnerMap.get(item["Giao đến"] || "");
      if (!partnerId) {
        const defaultPartner = await prisma.partner.findFirst();
        partnerId = defaultPartner?.id;
      }

      if (productId && partnerId) {
        priceCount++;
        await prisma.customerPriceBook.upsert({
          where: { priceCode },
          update: {},
          create: {
            priceCode,
            customerId: partnerId,
            productId: productId,
            unitPrice: unitPrice,
          },
        });
      }
    }
    console.log(`[Database] Seeded ${priceCount} price book records.`);

    // 4. Seed Purchase Orders & Lines
    for (let index = 0; index < rawPOHeaders.length; index++) {
      const po = rawPOHeaders[index];
      const poNumber = po["Đơn hàng"] || `PO-2026-${100 + index}`;
      const custName = po["Khách hàng"] || "";
      const totalValue = parseFloat(String(po["Tổng giá trị đơn hàng"] || 0).replace(/[^0-9.-]+/g, "")) || 0;

      let partnerId = partnerMap.get(custName);
      if (!partnerId) {
        const defaultPartner = await prisma.partner.findFirst();
        partnerId = defaultPartner?.id || "";
      }

      const matchingLines = rawPOLines.filter((l) => l["Số đơn hàng"] === poNumber);

      const createdPO = await prisma.purchaseOrder.upsert({
        where: { poNumber },
        update: {},
        create: {
          poNumber,
          customerId: partnerId,
          receiveDate: po["Ngày đặt hàng"] || new Date().toISOString().split("T")[0],
          deliveryAddress: "Kho trung tâm TSG",
          totalValue,
          status: po["Trạng Thái"] || "Mới nhận",
          lines: {
            create: matchingLines.map((line: any) => {
              const lineSku = line["Mã sản phẩm"] || line["Mã giá bán"] || "UNKNOWN";
              let prodId = createdProducts.get(lineSku);
              if (!prodId) {
                prodId = Array.from(createdProducts.values())[0];
              }
              const qty = parseFloat(String(line["Số lượng"] || 0).replace(/[^0-9.-]+/g, "")) || 0;
              const uPrice = parseFloat(String(line["Đơn giá bán"] || 0).replace(/[^0-9.-]+/g, "")) || 0;
              const tPrice = parseFloat(String(line["Thành tiền dòng"] || qty * uPrice).replace(/[^0-9.-]+/g, "")) || (qty * uPrice);

              return {
                productId: prodId,
                quantity: qty,
                deliveredQty: qty,
                unitPrice: uPrice,
                totalPrice: tPrice,
                supplier: line["Nhà cung cấp"] || null,
              };
            }),
          },
        },
      });

      // Seed Reconciliation record
      await prisma.reconciliation.create({
        data: {
          poId: createdPO.id,
          poTotalValue: totalValue,
          actualDelivered: totalValue,
          discrepancyAmount: 0,
          status: "Khớp 100%",
          notes: "Tự động đối soát 3 bên PO - PXK - Báo cáo kế toán",
        },
      });
    }
    console.log(`[Database] Seeded ${rawPOHeaders.length} purchase orders.`);

    // 5. Seed Delivery Orders & Lines
    const groupedDeliveries = new Map<string, any[]>();
    rawDeliveries.forEach((d) => {
      const pxkNumber = d["Số PXK"] || `PXK-${d["Đơn hàng"] || "DEFAULT"}`;
      if (!groupedDeliveries.has(pxkNumber)) {
        groupedDeliveries.set(pxkNumber, []);
      }
      groupedDeliveries.get(pxkNumber)?.push(d);
    });

    for (const [pxkNumber, dLines] of groupedDeliveries.entries()) {
      const firstLine = dLines[0];
      const poNumber = firstLine["Đơn hàng"];
      const poRecord = await prisma.purchaseOrder.findUnique({
        where: { poNumber },
        include: { lines: true },
      });

      if (poRecord) {
        await prisma.deliveryOrder.upsert({
          where: { pxkNumber },
          update: {},
          create: {
            pxkNumber,
            poId: poRecord.id,
            deliveryDate: firstLine["Ngày giao"] || new Date().toISOString().split("T")[0],
            deliverer: "Đội Vận Tải TSG",
            receiver: firstLine["Khách hàng"] || "Đại diện nhận hàng",
            status: firstLine["Status"] || "Đã phê duyệt",
            lines: {
              create: dLines.map((line: any) => {
                const lineSku = line["Mã sản phẩm"] || "UNKNOWN";
                const prodId = createdProducts.get(lineSku) || poRecord.lines[0]?.productId;
                const delQty = parseFloat(String(line["Số lượng giao"] || line["Đã giao"] || 0).replace(/[^0-9.-]+/g, "")) || 0;
                const recQty = parseFloat(String(line["Số lượng đặt"] || delQty).replace(/[^0-9.-]+/g, "")) || delQty;

                return {
                  poLineId: poRecord.lines.find((pl) => pl.productId === prodId)?.id,
                  productId: prodId,
                  deliveredQuantity: delQty,
                  receivedQuantity: recQty,
                  discrepancy: delQty - recQty,
                };
              }),
            },
          },
        });
      }
    }
    console.log(`[Database] Seeded ${groupedDeliveries.size} delivery orders.`);

    console.log("[Database] Relational Database Seeding Completed Successfully! 🎉");
  } catch (error) {
    console.error("[Database] Error seeding relational database:", error);
  }
}
