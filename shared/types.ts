export const MAX_CHAT_TEXT = 4000;
export const MAX_SENDER_LEN = 30;
export const MAX_CHAT_HISTORY = 500;
export const MAX_CLIPBOARD_BYTES = 1024 * 1024;

export type MessageReply = {
  id: string;
  sender: string;
  text: string;
};

export type Message = {
  id: string;
  sender: string;
  text: string;
  timestamp: number;
  replyTo?: MessageReply;
};

export type ClipboardState = {
  text: string;
  updatedAt: number;
};

export type ChatSendPayload = {
  text: string;
  sender: string;
  replyToId?: string;
};

export type ClipboardUpdatePayload = {
  text: string;
};

export type ChatAck = { ok: true } | { ok: false; error: string };

export type FileMeta = {
  id: string;
  originalName: string;
  storedName: string;
  size: number;
  mimeType: string;
  uploadedAt: number;
  uploader: string;
};

export type ConnectedDevice = {
  id: string;
  name: string;
  ip: string;
  userAgent: string;
  deviceType: "desktop" | "mobile" | "tablet" | "unknown";
  browser: string;
  os: string;
  connectedAt: number;
  isHost: boolean;
};

export type BlockedEntry = {
  ip: string;
  blockedAt: number;
  reason?: string;
};

export type DeviceActionAck = { ok: true } | { ok: false; error: string };

export type ServerToClientEvents = {
  "clients:count": (count: number) => void;
  "devices:list": (devices: ConnectedDevice[]) => void;
  "devices:blocked": (blocked: BlockedEntry[]) => void;
  "auth:kicked": (payload: { reason: string }) => void;
  "auth:blocked": (payload: { reason: string }) => void;
  "chat:history": (messages: Message[]) => void;
  "chat:message": (message: Message) => void;
  "chat:cleared": () => void;
  "clipboard:state": (state: ClipboardState) => void;
  "clipboard:changed": (state: ClipboardState) => void;
  "files:added": (files: FileMeta[]) => void;
  "files:removed": (payload: { id: string }) => void;
  "files:cleared": () => void;
  "share:reset": (payload: { clipboard: ClipboardState }) => void;
};

export type ClientToServerEvents = {
  "chat:send": (
    payload: ChatSendPayload,
    ack?: (result: ChatAck) => void,
  ) => void;
  "chat:clear": (ack?: (result: ChatAck) => void) => void;
  "share:reset": (ack?: (result: ChatAck) => void) => void;
  "clipboard:update": (payload: ClipboardUpdatePayload) => void;
  "device:identify": (payload: { name: string }) => void;
  "device:disconnect": (
    payload: { deviceId: string },
    ack?: (result: DeviceActionAck) => void,
  ) => void;
  "device:block": (
    payload: { ip: string; reason?: string },
    ack?: (result: DeviceActionAck) => void,
  ) => void;
  "device:unblock": (
    payload: { ip: string },
    ack?: (result: DeviceActionAck) => void,
  ) => void;
};
