/**
 * Centralised .env.local loader.
 * Next.js does NOT inject .env.local into process.env at runtime for
 * server-side code paths that run outside the Next.js dev server (e.g. when
 * modules are imported before the lifecycle), so we manually parse the file
 * here and make the keys available synchronously.
 */
import fs from "fs";
import path from "path";

function loadEnvLocal(): Record<string, string> {
  const result: Record<string, string> = {};
  try {
    const envPath = path.join(process.cwd(), ".env.local");
    if (!fs.existsSync(envPath)) return result;
    const content = fs.readFileSync(envPath, "utf8");
    for (const line of content.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eqIdx = trimmed.indexOf("=");
      if (eqIdx === -1) continue;
      const key = trimmed.slice(0, eqIdx).trim();
      const val = trimmed.slice(eqIdx + 1).trim();
      result[key] = val;
    }
  } catch {
    // fail silently — env.local is optional
  }
  return result;
}

const _local = loadEnvLocal();

export function getEnv(key: string): string {
  // Prefer explicit process.env (set by CI/Vercel), then fall back to .env.local
  return process.env[key] || _local[key] || "";
}
