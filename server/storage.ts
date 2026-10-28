// Storage helpers. Manus Forge + S3 is used when configured; otherwise files are
// kept in the local `.data/storage` folder so demo mode works without cloud keys.

import fs from "node:fs";
import path from "node:path";
import { ENV } from "./_core/env";

const LOCAL_STORAGE_DIR = path.resolve(process.cwd(), ".data", "storage");

function getForgeConfig() {
  const forgeUrl = ENV.forgeApiUrl;
  const forgeKey = ENV.forgeApiKey;

  if (!forgeUrl || !forgeKey) return null;

  return { forgeUrl: forgeUrl.replace(/\/+$/, ""), forgeKey };
}

function normalizeKey(relKey: string): string {
  return relKey.replace(/^\/+/, "").replace(/\.\.(\/|\\|$)/g, "");
}

function appendHashSuffix(relKey: string): string {
  const hash = crypto.randomUUID().replace(/-/g, "").slice(0, 8);
  const lastDot = relKey.lastIndexOf(".");
  if (lastDot === -1) return `${relKey}_${hash}`;
  return `${relKey.slice(0, lastDot)}_${hash}${relKey.slice(lastDot)}`;
}

function localPath(key: string) {
  return path.join(LOCAL_STORAGE_DIR, key);
}

function mimeFromKey(key: string) {
  const extension = path.extname(key).toLowerCase();
  return (
    {
      ".webm": "audio/webm",
      ".ogg": "audio/ogg",
      ".wav": "audio/wav",
      ".mp3": "audio/mpeg",
      ".m4a": "audio/mp4",
      ".mp4": "audio/mp4",
    }[extension] ?? "application/octet-stream"
  );
}

export async function storagePut(
  relKey: string,
  data: Buffer | Uint8Array | string,
  contentType = "application/octet-stream",
): Promise<{ key: string; url: string }> {
  const key = appendHashSuffix(normalizeKey(relKey));
  const forge = getForgeConfig();

  if (!forge) {
    const file = localPath(key);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, typeof data === "string" ? Buffer.from(data) : data);
    return { key, url: `/manus-storage/${key}` };
  }

  // 1. Get presigned PUT URL from Forge
  const presignUrl = new URL("v1/storage/presign/put", forge.forgeUrl + "/");
  presignUrl.searchParams.set("path", key);

  const presignResp = await fetch(presignUrl, {
    headers: { Authorization: `Bearer ${forge.forgeKey}` },
  });

  if (!presignResp.ok) {
    const msg = await presignResp.text().catch(() => presignResp.statusText);
    throw new Error(`Storage presign failed (${presignResp.status}): ${msg}`);
  }

  const { url: s3Url } = (await presignResp.json()) as { url: string };
  if (!s3Url) throw new Error("Forge returned empty presign URL");

  // 2. PUT file directly to S3
  const blob =
    typeof data === "string"
      ? new Blob([data], { type: contentType })
      : new Blob([data as any], { type: contentType });

  const uploadResp = await fetch(s3Url, {
    method: "PUT",
    headers: { "Content-Type": contentType },
    body: blob,
  });

  if (!uploadResp.ok) {
    throw new Error(`Storage upload to S3 failed (${uploadResp.status})`);
  }

  return { key, url: `/manus-storage/${key}` };
}

export async function storageGet(relKey: string): Promise<{ key: string; url: string }> {
  const key = normalizeKey(relKey);
  return { key, url: `/manus-storage/${key}` };
}

export async function storageGetSignedUrl(relKey: string): Promise<string> {
  const key = normalizeKey(relKey);
  const forge = getForgeConfig();

  if (!forge) {
    const file = localPath(key);
    if (!fs.existsSync(file)) throw new Error("Local storage file not found");
    const mime = mimeFromKey(key);
    return `data:${mime};base64,${fs.readFileSync(file).toString("base64")}`;
  }

  const getUrl = new URL("v1/storage/presign/get", forge.forgeUrl + "/");
  getUrl.searchParams.set("path", key);

  const resp = await fetch(getUrl, {
    headers: { Authorization: `Bearer ${forge.forgeKey}` },
  });

  if (!resp.ok) {
    const msg = await resp.text().catch(() => resp.statusText);
    throw new Error(`Storage signed URL failed (${resp.status}): ${msg}`);
  }

  const { url } = (await resp.json()) as { url: string };
  return url;
}
