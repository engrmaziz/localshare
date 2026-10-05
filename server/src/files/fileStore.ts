import { existsSync, readdirSync, readFileSync } from "node:fs";
import { rename, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import type { FileMeta } from "@shared/types";
import { DATA_DIR, UPLOAD_DIR, ensureDataDirs } from "../config.ts";

const REGISTRY_PATH = path.join(DATA_DIR, "files.json");
const SAVE_DEBOUNCE_MS = 500;

function isFileMeta(value: unknown): value is FileMeta {
  if (!value || typeof value !== "object") return false;
  const row = value as Record<string, unknown>;
  return (
    typeof row.id === "string" &&
    typeof row.originalName === "string" &&
    typeof row.storedName === "string" &&
    typeof row.size === "number" &&
    Number.isFinite(row.size) &&
    typeof row.mimeType === "string" &&
    typeof row.uploadedAt === "number" &&
    Number.isFinite(row.uploadedAt) &&
    typeof row.uploader === "string"
  );
}

function loadRegistry(): FileMeta[] {
  try {
    const raw = readFileSync(REGISTRY_PATH, "utf8");
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isFileMeta);
  } catch {
    return [];
  }
}

ensureDataDirs();

let files: FileMeta[] = loadRegistry();
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
  const snapshot = JSON.stringify(files);
  writing = writing.then(async () => {
    try {
      await atomicWrite(REGISTRY_PATH, snapshot);
    } catch (err) {
      console.error("Failed to persist files.json", err);
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

export function resolveStoredPath(storedName: string): string | null {
  const base = path.basename(storedName);
  if (!base || base !== storedName) return null;
  const resolved = path.resolve(UPLOAD_DIR, base);
  const root = path.resolve(UPLOAD_DIR);
  const rel = path.relative(root, resolved);
  if (rel === "" || rel.startsWith("..") || path.isAbsolute(rel)) return null;
  return resolved;
}

function reconcile(): void {
  ensureDataDirs();
  let dropped = false;
  const next: FileMeta[] = [];
  const known = new Set<string>();

  for (const meta of files) {
    const diskPath = resolveStoredPath(meta.storedName);
    if (!diskPath || !existsSync(diskPath)) {
      console.warn(
        `Dropping metadata for missing file ${meta.id} (${meta.storedName})`,
      );
      dropped = true;
      continue;
    }
    known.add(meta.storedName);
    next.push(meta);
  }
  files = next;

  let orphans: string[] = [];
  try {
    orphans = readdirSync(UPLOAD_DIR);
  } catch {
    orphans = [];
  }
  for (const name of orphans) {
    if (name.endsWith(".tmp")) continue;
    if (!known.has(name)) {
      console.warn(`Ignoring orphan file in uploads: ${name}`);
    }
  }

  if (dropped) scheduleSave();
}

reconcile();

export function list(): FileMeta[] {
  return files.slice();
}

export function get(id: string): FileMeta | undefined {
  return files.find((row) => row.id === id);
}

export function add(meta: FileMeta): FileMeta {
  files.push(meta);
  scheduleSave();
  return meta;
}

export function remove(id: string): FileMeta | undefined {
  const index = files.findIndex((row) => row.id === id);
  if (index === -1) return undefined;
  const [meta] = files.splice(index, 1);
  scheduleSave();
  return meta;
}

export function storageStats(): { usedBytes: number; fileCount: number } {
  return {
    usedBytes: files.reduce((sum, row) => sum + row.size, 0),
    fileCount: files.length,
  };
}

export async function flushFileStore(): Promise<void> {
  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }
  await persistNow();
}
