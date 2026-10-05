import { readFileSync } from "node:fs";
import { rename, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  MAX_CHAT_HISTORY,
  MAX_CLIPBOARD_BYTES,
  type ClipboardState,
  type Message,
} from "@shared/types";
import { DATA_DIR, ensureDataDirs } from "./config.ts";

const STATE_PATH = path.join(DATA_DIR, "state.json");
const SAVE_DEBOUNCE_MS = 500;

type PersistedState = {
  clipboard: ClipboardState;
  messages: Message[];
};

const emptyState = (): PersistedState => ({
  clipboard: { text: "", updatedAt: 0 },
  messages: [],
});

function isMessage(value: unknown): value is Message {
  if (!value || typeof value !== "object") return false;
  const row = value as Record<string, unknown>;
  return (
    typeof row.id === "string" &&
    typeof row.sender === "string" &&
    typeof row.text === "string" &&
    typeof row.timestamp === "number" &&
    Number.isFinite(row.timestamp)
  );
}

function loadState(): PersistedState {
  try {
    const raw = readFileSync(STATE_PATH, "utf8");
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return emptyState();
    const row = parsed as Record<string, unknown>;
    const clip = row.clipboard;
    let clipboard = emptyState().clipboard;
    if (clip && typeof clip === "object") {
      const c = clip as Record<string, unknown>;
      if (typeof c.text === "string" && typeof c.updatedAt === "number") {
        clipboard = {
          text: truncateUtf8(c.text, MAX_CLIPBOARD_BYTES),
          updatedAt: Number.isFinite(c.updatedAt) ? c.updatedAt : 0,
        };
      }
    }
    const messages = Array.isArray(row.messages)
      ? row.messages.filter(isMessage).slice(-MAX_CHAT_HISTORY)
      : [];
    return { clipboard, messages };
  } catch {
    return emptyState();
  }
}

export function utf8ByteLength(text: string): number {
  return Buffer.byteLength(text, "utf8");
}

export function truncateUtf8(text: string, maxBytes: number): string {
  if (utf8ByteLength(text) <= maxBytes) return text;
  let lo = 0;
  let hi = text.length;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (utf8ByteLength(text.slice(0, mid)) <= maxBytes) lo = mid;
    else hi = mid - 1;
  }
  return text.slice(0, lo);
}

ensureDataDirs();

const state = loadState();
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
      await atomicWrite(STATE_PATH, snapshot);
    } catch (err) {
      console.error("Failed to persist state.json", err);
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

export function getClipboard(): ClipboardState {
  return { ...state.clipboard };
}

export function getMessages(): Message[] {
  return state.messages.slice();
}

export function setClipboard(text: string): ClipboardState | null {
  const next = truncateUtf8(text, MAX_CLIPBOARD_BYTES);
  if (next === state.clipboard.text) return null;
  state.clipboard = { text: next, updatedAt: Date.now() };
  scheduleSave();
  return getClipboard();
}

export function addMessage(message: Message): Message {
  state.messages.push(message);
  if (state.messages.length > MAX_CHAT_HISTORY) {
    state.messages = state.messages.slice(-MAX_CHAT_HISTORY);
  }
  scheduleSave();
  return message;
}

export async function flushStore(): Promise<void> {
  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }
  await persistNow();
}
