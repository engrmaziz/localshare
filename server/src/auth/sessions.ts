import { createHash, randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { rename, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { DATA_DIR, SESSION_TTL_MS, ensureDataDirs } from "../config.ts";
import { SESSION_COOKIE, cookieHeaderFrom, parseCookie } from "./cookie.ts";

const SESSIONS_PATH = path.join(DATA_DIR, "sessions.json");
const SAVE_DEBOUNCE_MS = 500;

export type SessionRecord = {
  hash: string;
  createdAt: number;
  expiresAt: number;
  ip: string;
  userAgent: string;
};

type Persisted = {
  sessions: Record<
    string,
    { createdAt: number; expiresAt: number; ip: string; userAgent: string }
  >;
};

function sha256Hex(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function empty(): Persisted {
  return { sessions: {} };
}

function load(): Persisted {
  try {
    const raw = readFileSync(SESSIONS_PATH, "utf8");
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return empty();
    }
    const bag = (parsed as { sessions?: unknown }).sessions;
    if (!bag || typeof bag !== "object" || Array.isArray(bag)) return empty();
    const sessions: Persisted["sessions"] = {};
    for (const [hash, value] of Object.entries(
      bag as Record<string, unknown>,
    )) {
      if (!value || typeof value !== "object") continue;
      const row = value as Record<string, unknown>;
      if (
        typeof row.createdAt !== "number" ||
        typeof row.expiresAt !== "number" ||
        typeof row.ip !== "string" ||
        typeof row.userAgent !== "string"
      ) {
        continue;
      }
      sessions[hash] = {
        createdAt: row.createdAt,
        expiresAt: row.expiresAt,
        ip: row.ip,
        userAgent: row.userAgent,
      };
    }
    return { sessions };
  } catch {
    return empty();
  }
}

ensureDataDirs();

const state = load();
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
  const snapshot = JSON.stringify(state);
  writing = writing.then(async () => {
    try {
      await atomicWrite(SESSIONS_PATH, snapshot);
    } catch (err) {
      console.error("Failed to persist sessions.json", err);
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

function toRecord(
  hash: string,
  row: Persisted["sessions"][string],
): SessionRecord {
  return { hash, ...row };
}

export function sweepExpiredSessions(now = Date.now()): void {
  let changed = false;
  for (const [hash, row] of Object.entries(state.sessions)) {
    if (row.expiresAt <= now) {
      delete state.sessions[hash];
      changed = true;
    }
  }
  if (changed) scheduleSave();
}

export function getSessionByHash(hash: string): SessionRecord | null {
  const row = state.sessions[hash];
  if (!row) return null;
  if (row.expiresAt <= Date.now()) {
    delete state.sessions[hash];
    scheduleSave();
    return null;
  }
  return toRecord(hash, row);
}

export function getSessionByToken(token: string | undefined): SessionRecord | null {
  if (!token) return null;
  return getSessionByHash(sha256Hex(token));
}

export function getSession(req: {
  headers?: { cookie?: string | string[] };
}): SessionRecord | null {
  const token = parseCookie(cookieHeaderFrom(req), SESSION_COOKIE);
  return getSessionByToken(token);
}

export function createSession(
  ip: string,
  userAgent: string,
): { token: string; session: SessionRecord } {
  const token = randomBytes(32).toString("base64url");
  const hash = sha256Hex(token);
  const now = Date.now();
  const row = {
    createdAt: now,
    expiresAt: now + SESSION_TTL_MS,
    ip,
    userAgent: userAgent.slice(0, 120),
  };
  state.sessions[hash] = row;
  scheduleSave();
  return { token, session: toRecord(hash, row) };
}

export function deleteSession(hash: string): void {
  if (!state.sessions[hash]) return;
  delete state.sessions[hash];
  scheduleSave();
}

export function deleteSessionByToken(token: string | undefined): SessionRecord | null {
  if (!token) return null;
  const hash = sha256Hex(token);
  const current = getSessionByHash(hash);
  deleteSession(hash);
  return current;
}

export function clearAllSessions(): void {
  state.sessions = {};
  scheduleSave();
}

export async function flushSessions(): Promise<void> {
  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }
  await persistNow();
}

export function startSessionMaintenance(): void {
  sweepExpiredSessions();
  setInterval(() => sweepExpiredSessions(), 10 * 60 * 1000).unref();
}
