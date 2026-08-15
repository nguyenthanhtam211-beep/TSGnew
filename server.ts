import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { aiRouter } from "./server/routes/ai";
import { googleRouter } from "./server/routes/google";
import { dataRouter } from "./server/routes/data";
import { seedDatabaseIfEmpty } from "./server/db";

async function startServer() {
  // Initialize Prisma Relational Database & Seed initial data
  await seedDatabaseIfEmpty();

  const app = express();
  const PORT = process.env.PORT || 3000;

  app.use(express.json({ limit: "50mb" }));

  // Mount API Routers
  app.use("/api", aiRouter);
  app.use("/api", googleRouter);
  app.use("/api/data", dataRouter);

  // Health check endpoint
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Catch-all for unhandled /api/* requests
  app.all('/api/*', (req, res) => {
    console.error(`Unhandled API request: ${req.method} ${req.path}`);
    res.status(404).json({ error: `API route ${req.method} ${req.path} not found` });
  });

  // Express error handler middleware specifically for API routes
  app.use((err: any, req: any, res: any, next: any) => {
    console.error("API error handler caught error:", err);
    if (res.headersSent) {
      return next(err);
    }
    const statusCode = err.status || err.statusCode || 500;
    if (req.path && req.path.startsWith('/api')) {
      return res.status(statusCode).json({ 
        error: err.message || "Internal Server Error" 
      });
    }
    next(err);
  });

  // Vite middleware for development or static serving for production
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req: any, res: any) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  // Global fallback error handler
  app.use((err: any, req: any, res: any, next: any) => {
    console.error("Express global fallback error handler:", err);
    if (res.headersSent) {
      return next(err);
    }
    res.status(err.status || 500).send("Internal Server Error");
  });

  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer().catch(console.error);
