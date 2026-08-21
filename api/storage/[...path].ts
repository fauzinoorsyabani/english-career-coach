import type { Request, Response } from "express";
import { ENV } from "../../server/_core/env";

function toStorageKey(req: Request) {
  const value = req.query.path;
  if (Array.isArray(value)) return value.join("/");
  return typeof value === "string" ? value : "";
}

export default async function handler(req: Request, res: Response) {
  const key = toStorageKey(req);
  if (!key) {
    res.status(400).send("Missing storage key");
    return;
  }
  if (!ENV.forgeApiUrl || !ENV.forgeApiKey) {
    res.status(500).send("Storage proxy not configured");
    return;
  }
  try {
    const forgeUrl = new URL("v1/storage/presign/get", `${ENV.forgeApiUrl.replace(/\/+$/, "")}/`);
    forgeUrl.searchParams.set("path", key);
    const response = await fetch(forgeUrl, { headers: { Authorization: `Bearer ${ENV.forgeApiKey}` } });
    if (!response.ok) {
      res.status(502).send("Storage backend error");
      return;
    }
    const payload = await response.json() as { url?: string };
    if (!payload.url) {
      res.status(502).send("Empty signed URL from backend");
      return;
    }
    res.set("Cache-Control", "no-store");
    res.redirect(307, payload.url);
  } catch (error) {
    console.error("[VercelStorageProxy] failed", error);
    res.status(502).send("Storage proxy error");
  }
}
