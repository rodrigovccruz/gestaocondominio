import type { RequestHandler } from "express";

export const rpcPrivacyHeaders: RequestHandler = (_req, res, next) => {
  res.setHeader("Cache-Control", "private, no-store, max-age=0");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  res.vary("Cookie");
  next();
};
