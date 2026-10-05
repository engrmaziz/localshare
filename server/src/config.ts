import { existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const SRC_DIR = path.dirname(fileURLToPath(import.meta.url));
export const SERVER_ROOT = path.resolve(SRC_DIR, "..");
export const REPO_ROOT = path.resolve(SERVER_ROOT, "..");

dotenv.config({ path: path.join(REPO_ROOT, ".env") });

const DEFAULT_PORT = 7421;

export const PORT = Number(process.env.PORT) || DEFAULT_PORT;
export const DATA_DIR = path.resolve(
  SERVER_ROOT,
  process.env.DATA_DIR ?? "../data",
);
export const UPLOAD_DIR = path.resolve(
  SERVER_ROOT,
  process.env.UPLOAD_DIR ?? "../data/uploads",
);
export const CLIENT_DIST = path.resolve(REPO_ROOT, "client/dist");

function optionalPositiveNumber(raw: string | undefined): number | undefined {
  if (raw == null || raw.trim() === "") return undefined;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return undefined;
  return n;
}

/** Bytes, or undefined for unlimited. */
export const MAX_FILE_SIZE_BYTES = (() => {
  const mb = optionalPositiveNumber(process.env.MAX_FILE_SIZE_MB);
  return mb == null ? undefined : mb * 1024 * 1024;
})();

/** Hours, or undefined to disable auto-delete. */
export const AUTO_DELETE_HOURS = optionalPositiveNumber(
  process.env.AUTO_DELETE_HOURS,
);

export const SESSION_TTL_HOURS =
  optionalPositiveNumber(process.env.SESSION_TTL_HOURS) ?? 168;
export const SESSION_TTL_MS = SESSION_TTL_HOURS * 60 * 60 * 1000;

/** Set true after terminating HTTPS (mkcert). Default false: LAN HTTP. */
export const COOKIE_SECURE = process.env.COOKIE_SECURE === "true";

export const PRINT_KEY = process.env.PRINT_KEY !== "false";

export const isProduction =
  process.env.NODE_ENV === "production" || existsSync(CLIENT_DIST);

export function ensureDataDirs(): void {
  mkdirSync(DATA_DIR, { recursive: true });
  mkdirSync(UPLOAD_DIR, { recursive: true });
}
