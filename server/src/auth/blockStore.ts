import { readFileSync } from "node:fs";
import { rename, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import type { BlockedEntry } from "@shared/types";
import { DATA_DIR, ensureDataDirs } from "../config.ts";

const BLOCKED_PATH = path.join(DATA_DIR, "blocked.json");
const SAVE_DEBOUNCE_MS = 500;

type PersistedBlocked = {
  blocked: BlockedEntry[];
};

function normalizeIp(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.startsWith("::ffff:")) return trimmed.slice(7);
  return trimmed;
}

export function isLoopbackIp(ip: string): boolean {
  const norm = normalizeIp(ip);
  return (
    norm === "127.0.0.1" ||
    norm === "::1" ||
    norm === "localhost" ||
    norm === "" ||
    norm === "unknown"
  );
}

function loadBlocked(): Map<string, BlockedEntry> {
  const map = new Map<string, BlockedEntry>();
  try {
    const raw = readFileSync(BLOCKED_PATH, "utf8");
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return map;
    const list = (parsed as { blocked?: unknown }).blocked;
    if (Array.isArray(list)) {
      for (const item of list) {
        if (
          item &&
          typeof item === "object" &&
          typeof item.ip === "string" &&
          typeof item.blockedAt === "number"
        ) {
          map.set(normalizeIp(item.ip), {
            ip: normalizeIp(item.ip),
            blockedAt: item.blockedAt,
            reason: typeof item.reason === "string" ? item.reason : undefined,
          });
        }
      }
    }
  } catch {
    /* file may not exist yet */
  }
  return map;
}

ensureDataDirs();

const blockedMap = loadBlocked();
let saveTimer: ReturnType<typeof setTimeout> | null = null;
let writing: Promise<void> = Promise.resolve();

async function atomicWrite(filePath: string, contents: string): Promise<void> {
  const tmp = `${filePath}.${process.pid}.tmp`;
  await writeFile(tmp, contents, "utf8");
  try {
    await rename(tmp, filePath);
  } catch {
    await unlink(filePath).catch(() => undefined);
    await rename(tmp, filePath);
  }
}

function persistNow(): Promise<void> {
  const snapshot: PersistedBlocked = {
    blocked: Array.from(blockedMap.values()),
  };
  writing = writing.then(async () => {
    try {
      await atomicWrite(BLOCKED_PATH, JSON.stringify(snapshot, null, 2));
    } catch (err) {
      console.error("Failed to persist blocked.json", err);
    }
  });
  return writing;
}

function scheduleSave(): void {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    saveTimer = null;
    void persistNow();
  }, SAVE_DEBOUNCE_MS);
}

export function isIpBlocked(rawIp: string): boolean {
  const ip = normalizeIp(rawIp);
  if (isLoopbackIp(ip)) return false;
  return blockedMap.has(ip);
}

export function blockIp(
  rawIp: string,
  reason?: string,
): { ok: true } | { ok: false; error: string } {
  const ip = normalizeIp(rawIp);
  if (isLoopbackIp(ip)) {
    return { ok: false, error: "The host machine (loopback) cannot be blocked." };
  }
  const entry: BlockedEntry = {
    ip,
    blockedAt: Date.now(),
    reason: reason?.trim() || "Blocked by host",
  };
  blockedMap.set(ip, entry);
  scheduleSave();
  return { ok: true };
}

export function unblockIp(rawIp: string): boolean {
  const ip = normalizeIp(rawIp);
  const deleted = blockedMap.delete(ip);
  if (deleted) scheduleSave();
  return deleted;
}

export function getBlockedList(): BlockedEntry[] {
  return Array.from(blockedMap.values()).sort(
    (a, b) => b.blockedAt - a.blockedAt,
  );
}

export async function flushBlocked(): Promise<void> {
  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }
  await persistNow();
}
