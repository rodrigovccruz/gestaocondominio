import type { IncomingMessage, ServerResponse } from "node:http";
import path from "node:path";
import { createApp } from "./_core/app";
import { ensureDatabaseReady } from "./bootstrap";

const app = createApp();
const migrations = path.join(__dirname, "drizzle");

/** Função da Vercel: recebe /api/* (o caminho vem em __path pela rota). */
export default async function handler(
  req: IncomingMessage,
  res: ServerResponse
) {
  const url = new URL(req.url ?? "/", "http://localhost");
  const forwarded = url.searchParams.get("__path");
  if (forwarded !== null) {
    url.searchParams.delete("__path");
    req.url = `/api/${forwarded}${url.search}`;
  }
  try {
    await ensureDatabaseReady(migrations);
  } catch (error) {
    console.error("[setup] Falha ao preparar o banco:", error);
  }
  app(req as never, res as never);
}
