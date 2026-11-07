import express from "express";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { publicPlatformScript } from "./publicConfig";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { rpcPrivacyHeaders } from "./privacy";

/** App Express com a API. Usado pelo servidor local e pela função da Vercel. */
export function createApp() {
  const app = express();
  app.use(express.json({ limit: "4mb" }));
  app.use(express.urlencoded({ limit: "4mb", extended: true }));
  app.get("/api/health", (_req, res) => res.json({ status: "ok" }));
  app.get("/api/platform/config.js", (_req, res) => {
    res
      .set("Cache-Control", "no-store")
      .type("application/javascript")
      .send(publicPlatformScript());
  });
  app.use(
    "/api/trpc",
    rpcPrivacyHeaders,
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  return app;
}
