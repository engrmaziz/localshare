import { nanoid } from "nanoid";
import type { Server, Socket } from "socket.io";
import {
  MAX_CHAT_TEXT,
  MAX_SENDER_LEN,
  type ChatAck,
  type ClientToServerEvents,
  type ServerToClientEvents,
} from "@shared/types";
import { addMessage, getClipboard, getMessages, setClipboard } from "./store.ts";

const RATE_WINDOW_MS = 5_000;
const RATE_MAX = 10;

type Io = Server<ClientToServerEvents, ServerToClientEvents>;
type ClientSocket = Socket<ClientToServerEvents, ServerToClientEvents>;

const sendTimes = new Map<string, number[]>();

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

export function attachSockets(io: Io): void {
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

      const message = addMessage({
        id: nanoid(),
        sender: sanitizeSender(payload.sender),
        text,
        timestamp: Date.now(),
      });
      io.emit("chat:message", message);
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
      broadcastClientCount(io);
    });
  });
}
