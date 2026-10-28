import express from "express";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { isLocalAuthEnabled, registerLocalAuthRoutes } from "./localAuth";
import { registerOAuthRoutes } from "./oauth";
import { registerStorageProxy } from "./storageProxy";
import { appRouter } from "../routers";
import { createContext } from "./context";

export function createApp() {
  const app = express();
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  app.get("/api/health", (_req, res) => {
    res.json({
      status: "ok",
      auth: isLocalAuthEnabled() ? "local" : "oauth",
      time: new Date().toISOString(),
    });
  });
  registerStorageProxy(app);
  registerLocalAuthRoutes(app);
  registerOAuthRoutes(app);
  app.use("/api/trpc", createExpressMiddleware({ router: appRouter, createContext }));
  return app;
}
