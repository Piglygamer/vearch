import express, { type Express } from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { registerStorageProxy } from "./storageProxy";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { handleStripeWebhook } from "./stripeWebhook";

// Only keep applet routes for hardware compatibility
import appletRouter from "../api/applet";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  const app = express();
  const server = createServer(app);

  // Stripe webhook must use raw body parsing BEFORE express.json()
  app.post(
    "/api/stripe/webhook",
    express.raw({ type: "application/json" }),
    handleStripeWebhook
  );

  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  registerStorageProxy(app);
  registerOAuthRoutes(app);

  // Health check endpoint
  app.get("/health", (req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  // tRPC API — the primary data layer for frontend and backend
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );

  // Minimal REST routes — applet hardware compatibility only
  app.use("/api/applet", appletRouter);

  // Development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    console.log("[Server] Running in development mode with Vite");
    await setupVite(app, server);
  } else {
    console.log("[Server] Running in production mode with static files");
    serveStatic(app);
  }

  // 404 handler — MUST be last
  app.use((req, res) => {
    res.status(404).json({ error: "Not found" });
  });

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`[Server] Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    console.log(`[Server] Running on http://localhost:${port}/`);
    console.log(`[Stripe Webhook] Ready at /api/stripe/webhook`);
  });
}

startServer().catch((err) => {
  console.error("[Server] Failed to start:", err);
  process.exit(1);
});
