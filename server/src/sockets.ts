import { nanoid } from "nanoid";
import type { Server, Socket } from "socket.io";
import {
  MAX_CHAT_TEXT,
  MAX_SENDER_LEN,
  type ChatAck,
  type ClientToServerEvents,
  type ServerToClientEvents,
} from "@shared/types";
import { getSession, getSessionByHash } from "./auth/sessions.ts";
import { addMessage, clearMessages, getClipboard, getMessage, getMessages, setClipboard, wipeClipboard } from "./store.ts";
import { clearAllFiles } from "./files/fileStore.ts";

const RATE_WINDOW_MS = 5_000;
const RATE_MAX = 10;
const CLEAR_WINDOW_MS = 10_000;
const RESET_WINDOW_MS = 15_000;

type Io = Server<ClientToServerEvents, ServerToClientEvents>;
type ClientSocket = Socket<ClientToServerEvents, ServerToClientEvents>;

const sendTimes = new Map<string, number[]>();
const lastClear = new Map<string, number>();
const lastReset = new Map<string, number>();

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function sanitizeSender(raw: unknown): string {
  if (typeof raw !== "string") return "Anonymous";
  const trimmed = raw.trim().slice(0, MAX_SENDER_LEN);
  return trimmed || "Anonymous";
}

function allowChatSend(socketId: string): boolean {
  const now = Date.now();
  const recent = (sendTimes.get(socketId) ?? []).filter(
    (t) => now - t < RATE_WINDOW_MS,
  );
  if (recent.length >= RATE_MAX) {
    sendTimes.set(socketId, recent);
    return false;
  }
  recent.push(now);
  sendTimes.set(socketId, recent);
  return true;
}

function broadcastClientCount(io: Io): void {
  io.emit("clients:count", io.engine.clientsCount);
}

function ackResult(ack: ((result: ChatAck) => void) | undefined, result: ChatAck) {
  ack?.(result);
}

function snippet(text: string): string {
  const trimmed = text.trim().replace(/\s+/g, " ");
  if (trimmed.length <= 140) return trimmed;
  return `${trimmed.slice(0, 137)}…`;
}

function sessionHashOf(socket: ClientSocket): string | undefined {
  return (socket.data as { sessionHash?: string }).sessionHash;
}

export function attachSockets(io: Io): void {
  io.use((socket, next) => {
    const session = getSession(socket.handshake);
    if (!session) {
      next(new Error("unauthorized"));
      return;
    }
    (socket.data as { sessionHash: string }).sessionHash = session.hash;
    next();
  });

  io.on("connection", (socket: ClientSocket) => {
    socket.emit("chat:history", getMessages());
    socket.emit("clipboard:state", getClipboard());
    broadcastClientCount(io);

    socket.on("chat:send", (raw, ack) => {
      const payload = asRecord(raw);
      if (!payload || typeof payload.text !== "string") return;

      const text = payload.text.trim();
      if (!text) return;
      if (text.length > MAX_CHAT_TEXT) {
        ackResult(ack, { ok: false, error: "Message too long" });
        return;
      }
      if (!allowChatSend(socket.id)) {
        ackResult(ack, { ok: false, error: "You're sending too fast" });
        return;
      }

      const replyToId =
        typeof payload.replyToId === "string" ? payload.replyToId : "";
      const quoted = replyToId ? getMessage(replyToId) : undefined;

      const message = addMessage({
        id: nanoid(),
        sender: sanitizeSender(payload.sender),
        text,
        timestamp: Date.now(),
        ...(quoted
          ? {
              replyTo: {
                id: quoted.id,
                sender: quoted.sender,
                text: snippet(quoted.text),
              },
            }
          : {}),
      });
      io.emit("chat:message", message);
      ackResult(ack, { ok: true });
    });

    socket.on("chat:clear", (ack) => {
      const now = Date.now();
      const previous = lastClear.get(socket.id) ?? 0;
      if (now - previous < CLEAR_WINDOW_MS) {
        ackResult(ack, { ok: false, error: "Wait a moment before clearing again" });
        return;
      }
      lastClear.set(socket.id, now);
      clearMessages();
      io.emit("chat:cleared");
      ackResult(ack, { ok: true });
    });

    socket.on("share:reset", async (ack) => {
      const now = Date.now();
      const previous = lastReset.get(socket.id) ?? 0;
      if (now - previous < RESET_WINDOW_MS) {
        ackResult(ack, { ok: false, error: "Wait a moment before resetting again" });
        return;
      }
      lastReset.set(socket.id, now);
      clearMessages();
      const clipboard = wipeClipboard();
      try {
        await clearAllFiles();
      } catch {
        ackResult(ack, { ok: false, error: "Could not delete shared files" });
        return;
      }
      io.emit("share:reset", { clipboard });
      io.emit("chat:cleared");
      io.emit("files:cleared");
      io.emit("clipboard:changed", clipboard);
      ackResult(ack, { ok: true });
    });

    socket.on("clipboard:update", (raw) => {
      const payload = asRecord(raw);
      if (!payload || typeof payload.text !== "string") return;
      const changed = setClipboard(payload.text);
      if (changed) {
        socket.broadcast.emit("clipboard:changed", changed);
      }
    });

    socket.on("disconnect", () => {
      sendTimes.delete(socket.id);
      lastClear.delete(socket.id);
      lastReset.delete(socket.id);
      broadcastClientCount(io);
    });
  });

  setInterval(() => {
    for (const socket of io.sockets.sockets.values()) {
      const hash = sessionHashOf(socket as ClientSocket);
      if (!hash || !getSessionByHash(hash)) {
        socket.disconnect(true);
      }
    }
  }, 60_000).unref();
}
