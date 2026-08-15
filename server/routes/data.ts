import { Router } from "express";
import { prisma } from "../db";

export const dataRouter = Router();

// GET /api/data/pos - Retrieve all Purchase Orders with relational Partner & Product Lines
dataRouter.get("/pos", async (req, res) => {
  try {
    const pos = await prisma.purchaseOrder.findMany({
      include: {
        customer: true,
        lines: {
          include: {
            product: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });
    res.json(pos);
  } catch (error: any) {
    console.error("Error fetching POs from database:", error);
    res.status(500).json({ error: error.message || "Failed to fetch POs" });
  }
});

// GET /api/data/deliveries - Retrieve all Delivery Orders with relational PO & Lines
dataRouter.get("/deliveries", async (req, res) => {
  try {
    const deliveries = await prisma.deliveryOrder.findMany({
      include: {
        po: {
          include: {
            customer: true,
          },
        },
        lines: {
          include: {
            product: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });
    res.json(deliveries);
  } catch (error: any) {
    console.error("Error fetching deliveries from database:", error);
    res.status(500).json({ error: error.message || "Failed to fetch deliveries" });
  }
});

// GET /api/data/products - Retrieve all Master Products
dataRouter.get("/products", async (req, res) => {
  try {
    const products = await prisma.product.findMany({
      orderBy: { sku: "asc" },
    });
    res.json(products);
  } catch (error: any) {
    console.error("Error fetching products from database:", error);
    res.status(500).json({ error: error.message || "Failed to fetch products" });
  }
});

// GET /api/data/pricebook - Retrieve Customer Price Book
dataRouter.get("/pricebook", async (req, res) => {
  try {
    const priceBook = await prisma.customerPriceBook.findMany({
      include: {
        customer: true,
        product: true,
      },
    });
    res.json(priceBook);
  } catch (error: any) {
    console.error("Error fetching price book from database:", error);
    res.status(500).json({ error: error.message || "Failed to fetch price book" });
  }
});

// GET /api/data/reconciliations - Retrieve 3-Way Reconciliation Records
dataRouter.get("/reconciliations", async (req, res) => {
  try {
    const reconciliations = await prisma.reconciliation.findMany({
      include: {
        po: {
          include: {
            customer: true,
            lines: {
              include: {
                product: true,
              },
            },
          },
        },
      },
      orderBy: { reconcileDate: "desc" },
    });
    res.json(reconciliations);
  } catch (error: any) {
    console.error("Error fetching reconciliations from database:", error);
    res.status(500).json({ error: error.message || "Failed to fetch reconciliations" });
  }
});

// GET /api/data/customers - Retrieve all Customers
dataRouter.get("/customers", async (req, res) => {
  try {
    const customers = await prisma.partner.findMany({
      where: { type: "CUSTOMER" },
      orderBy: { code: "asc" },
    });
    res.json(customers);
  } catch (error: any) {
    console.error("Error fetching customers from database:", error);
    res.status(500).json({ error: error.message || "Failed to fetch customers" });
  }
});

// POST /api/data/customers - Upsert customer
dataRouter.post("/customers", async (req, res) => {
  try {
    const { code, name, address, phone } = req.body;
    if (!code || !name) {
      return res.status(400).json({ error: "Mã khách hàng và Tên khách hàng là bắt buộc" });
    }

    const customer = await prisma.partner.upsert({
      where: { code },
      update: {
        name,
        address: address || null,
        phone: phone || null,
        type: "CUSTOMER",
      },
      create: {
        code,
        name,
        address: address || null,
        phone: phone || null,
        type: "CUSTOMER",
      },
    });
    res.json(customer);
  } catch (error: any) {
    console.error("Error upserting customer:", error);
    res.status(500).json({ error: error.message || "Failed to save customer" });
  }
});

// DELETE /api/data/customers/:code - Delete customer by code
dataRouter.delete("/customers/:code", async (req, res) => {
  try {
    const { code } = req.params;
    await prisma.partner.delete({
      where: { code },
    });
    res.json({ success: true });
  } catch (error: any) {
    console.error("Error deleting customer:", error);
    res.status(500).json({ error: error.message || "Failed to delete customer" });
  }
});

