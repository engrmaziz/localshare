export const MAX_CHAT_TEXT = 4000;
export const MAX_SENDER_LEN = 30;
export const MAX_CHAT_HISTORY = 500;
export const MAX_CLIPBOARD_BYTES = 1024 * 1024;

export type Message = {
  id: string;
  sender: string;
  text: string;
  timestamp: number;
};

export type ClipboardState = {
  text: string;
  updatedAt: number;
};

export type ChatSendPayload = {
  text: string;
  sender: string;
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

export type ServerToClientEvents = {
  "clients:count": (count: number) => void;
  "chat:history": (messages: Message[]) => void;
  "chat:message": (message: Message) => void;
  "clipboard:state": (state: ClipboardState) => void;
  "clipboard:changed": (state: ClipboardState) => void;
  "files:added": (files: FileMeta[]) => void;
  "files:removed": (payload: { id: string }) => void;
};

export type ClientToServerEvents = {
  "chat:send": (
    payload: ChatSendPayload,
    ack?: (result: ChatAck) => void,
  ) => void;
  "clipboard:update": (payload: ClipboardUpdatePayload) => void;
};
