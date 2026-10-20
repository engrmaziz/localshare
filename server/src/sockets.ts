import { nanoid } from "nanoid";
import type { Server, Socket } from "socket.io";
import {
  MAX_CHAT_TEXT,
  MAX_SENDER_LEN,
  type ClientToServerEvents,
  type ConnectedDevice,
  type ServerToClientEvents,
} from "@shared/types";
import {
  blockIp,
  getBlockedList,
  isIpBlocked,
  unblockIp,
} from "./auth/blockStore.ts";
import { deleteSession, getSession, getSessionByHash } from "./auth/sessions.ts";
import { clearAllFiles } from "./files/fileStore.ts";
import {
  addMessage,
  clearMessages,
  getClipboard,
  getMessage,
  getMessages,
  setClipboard,
  wipeClipboard,
} from "./store.ts";

const RATE_WINDOW_MS = 5_000;
const RATE_MAX = 10;
const CLEAR_WINDOW_MS = 10_000;
const RESET_WINDOW_MS = 15_000;

type Io = Server<ClientToServerEvents, ServerToClientEvents>;
type ClientSocket = Socket<ClientToServerEvents, ServerToClientEvents>;

type SocketDeviceData = {
  sessionHash: string;
  name: string;
  ip: string;
  userAgent: string;
  deviceType: "desktop" | "mobile" | "tablet" | "unknown";
  browser: string;
  os: string;
  connectedAt: number;
  isHost: boolean;
};

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

function ackResult<T>(ack: ((result: T) => void) | undefined, result: T) {
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

function socketClientIp(socket: Socket): string {
  const forwarded = socket.handshake.headers["x-forwarded-for"];
  const address = socket.handshake.address;
  const loopback =
    address === "127.0.0.1" ||
    address === "::1" ||
    address === "::ffff:127.0.0.1";
  if (loopback) {
    const first =
      typeof forwarded === "string"
        ? forwarded.split(",")[0]?.trim()
        : Array.isArray(forwarded)
          ? forwarded[0]?.split(",")[0]?.trim()
          : undefined;
    if (first) return first.replace(/^::ffff:/, "");
  }
  return (address || "unknown").replace(/^::ffff:/, "");
}

function isSocketHost(socket: Socket): boolean {
  const addr = socket.handshake.address;
  const loopback =
    addr === "127.0.0.1" || addr === "::1" || addr === "::ffff:127.0.0.1";
  if (!loopback) return false;
  const host =
    (typeof socket.handshake.headers.host === "string"
      ? socket.handshake.headers.host
      : ""
    )
      .split(":")[0]
      ?.toLowerCase() ?? "";
  return (
    host === "localhost" ||
    host === "127.0.0.1" ||
    host === "[::1]" ||
    host === "::1" ||
    host === ""
  );
}

function parseUserAgent(ua: string): {
  deviceType: "desktop" | "mobile" | "tablet" | "unknown";
  browser: string;
  os: string;
} {
  let os = "Other";
  if (/windows phone/i.test(ua)) os = "Windows Phone";
  else if (/win(dows|98|nt|2000)/i.test(ua)) os = "Windows";
  else if (/iphone|ipad|ipod/i.test(ua)) os = "iOS";
  else if (/macintosh|mac os x/i.test(ua)) os = "macOS";
  else if (/android/i.test(ua)) os = "Android";
  else if (/linux/i.test(ua)) os = "Linux";
  else if (/cros/i.test(ua)) os = "ChromeOS";

  let deviceType: "desktop" | "mobile" | "tablet" | "unknown" = "desktop";
  if (
    /tablet|ipad|playbook|silk/i.test(ua) ||
    (/android/i.test(ua) && !/mobile/i.test(ua))
  ) {
    deviceType = "tablet";
  } else if (
    /mobile|iphone|ipod|blackberry|opera mini|iemobile|wpdesktop/i.test(ua) ||
    /android.*mobile/i.test(ua)
  ) {
    deviceType = "mobile";
  }

  let browser = "Browser";
  if (/edg\//i.test(ua)) browser = "Edge";
  else if (/opr\/|opera/i.test(ua)) browser = "Opera";
  else if (/chrome|crios/i.test(ua)) browser = "Chrome";
  else if (/firefox|fxios/i.test(ua)) browser = "Firefox";
  else if (/safari/i.test(ua)) browser = "Safari";

  return { deviceType, browser, os };
}

function getConnectedDevices(io: Io): ConnectedDevice[] {
  const devices: ConnectedDevice[] = [];
  for (const s of io.sockets.sockets.values()) {
    const data = (s.data as { deviceData?: SocketDeviceData }).deviceData;
    if (data) {
      devices.push({
        id: s.id,
        name: data.name,
        ip: data.ip,
        userAgent: data.userAgent,
        deviceType: data.deviceType,
        browser: data.browser,
        os: data.os,
        connectedAt: data.connectedAt,
        isHost: data.isHost,
      });
    }
  }
  devices.sort((a, b) => {
    if (a.isHost && !b.isHost) return -1;
    if (!a.isHost && b.isHost) return 1;
    return a.connectedAt - b.connectedAt;
  });
  return devices;
}

function broadcastDevices(io: Io): void {
  io.emit("devices:list", getConnectedDevices(io));
  io.emit("devices:blocked", getBlockedList());
  io.emit("clients:count", io.engine.clientsCount);
}

export function attachSockets(io: Io): void {
  io.use((socket, next) => {
    const ip = socketClientIp(socket);
    if (isIpBlocked(ip)) {
      next(new Error("blocked"));
      return;
    }
    const session = getSession(socket.handshake);
    if (!session) {
      next(new Error("unauthorized"));
      return;
    }
    (socket.data as { sessionHash: string }).sessionHash = session.hash;
    next();
  });

  io.on("connection", (socket: ClientSocket) => {
    const ip = socketClientIp(socket);
    const ua =
      typeof socket.handshake.headers["user-agent"] === "string"
        ? socket.handshake.headers["user-agent"]
        : "";
    const parsed = parseUserAgent(ua);
    const isHost = isSocketHost(socket);

    const authName = (socket.handshake.auth as { deviceName?: unknown })
      ?.deviceName;
    const initialName =
      typeof authName === "string" && authName.trim()
        ? sanitizeSender(authName)
        : "Anonymous Device";

    (socket.data as { deviceData: SocketDeviceData }).deviceData = {
      sessionHash: (socket.data as { sessionHash: string }).sessionHash,
      name: initialName,
      ip,
      userAgent: ua,
      deviceType: parsed.deviceType,
      browser: parsed.browser,
      os: parsed.os,
      connectedAt: Date.now(),
      isHost,
    };

    socket.emit("chat:history", getMessages());
    socket.emit("clipboard:state", getClipboard());
    socket.emit("devices:list", getConnectedDevices(io));
    socket.emit("devices:blocked", getBlockedList());
    broadcastDevices(io);

    socket.on("device:identify", (raw) => {
      const payload = asRecord(raw);
      if (!payload || typeof payload.name !== "string") return;
      const cleanName = sanitizeSender(payload.name);
      const dev = (socket.data as { deviceData?: SocketDeviceData }).deviceData;
      if (dev) {
        dev.name = cleanName;
        broadcastDevices(io);
      }
    });

    socket.on("device:disconnect", (raw, ack) => {
      const payload = asRecord(raw);
      if (!payload || typeof payload.deviceId !== "string") {
        ackResult(ack, { ok: false, error: "Invalid device ID" });
        return;
      }
      const targetId = payload.deviceId;
      const targetSocket = io.sockets.sockets.get(targetId);
      if (!targetSocket) {
        ackResult(ack, { ok: false, error: "Device is no longer connected" });
        return;
      }
      if (targetSocket.id === socket.id) {
        ackResult(ack, {
          ok: false,
          error: "Cannot remove your own device from here. Use Log out instead.",
        });
        return;
      }

      const hash = sessionHashOf(targetSocket as ClientSocket);
      if (hash) {
        deleteSession(hash);
      }
      targetSocket.emit("auth:kicked", {
        reason: "You have been removed by the host.",
      });
      targetSocket.disconnect(true);
      broadcastDevices(io);
      ackResult(ack, { ok: true });
    });

    socket.on("device:block", (raw, ack) => {
      const payload = asRecord(raw);
      if (!payload || typeof payload.ip !== "string") {
        ackResult(ack, { ok: false, error: "Invalid IP address" });
        return;
      }
      const targetIp = payload.ip.trim();
      const myIp = socketClientIp(socket);
      if (targetIp === myIp) {
        ackResult(ack, {
          ok: false,
          error: "You cannot block your own device IP.",
        });
        return;
      }

      const reason =
        typeof payload.reason === "string" ? payload.reason : undefined;
      const result = blockIp(targetIp, reason);
      if (!result.ok) {
        ackResult(ack, { ok: false, error: result.error });
        return;
      }

      for (const s of io.sockets.sockets.values()) {
        const sIp = socketClientIp(s);
        if (sIp === targetIp) {
          const hash = sessionHashOf(s as ClientSocket);
          if (hash) deleteSession(hash);
          s.emit("auth:blocked", {
            reason: "This device has been blocked by the host.",
          });
          s.disconnect(true);
        }
      }

      broadcastDevices(io);
      ackResult(ack, { ok: true });
    });

    socket.on("device:unblock", (raw, ack) => {
      const payload = asRecord(raw);
      if (!payload || typeof payload.ip !== "string") {
        ackResult(ack, { ok: false, error: "Invalid IP address" });
        return;
      }
      unblockIp(payload.ip);
      broadcastDevices(io);
      ackResult(ack, { ok: true });
    });

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

      const senderName = sanitizeSender(payload.sender);
      const dev = (socket.data as { deviceData?: SocketDeviceData }).deviceData;
      if (dev && dev.name !== senderName) {
        dev.name = senderName;
        broadcastDevices(io);
      }

      const replyToId =
        typeof payload.replyToId === "string" ? payload.replyToId : "";
      const quoted = replyToId ? getMessage(replyToId) : undefined;

      const message = addMessage({
        id: nanoid(),
        sender: senderName,
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
        ackResult(ack, {
          ok: false,
          error: "Wait a moment before clearing again",
        });
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
        ackResult(ack, {
          ok: false,
          error: "Wait a moment before resetting again",
        });
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
      broadcastDevices(io);
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
