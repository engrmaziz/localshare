import {
  Check,
  Copy,
  Eraser,
  MessageCircle,
  Pencil,
  Reply,
  Send,
  Smile,
  X,
} from "lucide-react";
import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import { MAX_CHAT_TEXT, type Message } from "@shared/types";
import { writeClipboard } from "../lib/clipboard.ts";
import { splitLinks } from "../lib/linkify.ts";
import { socket, useSocket } from "../lib/socket.ts";
import { formatRelativeTime } from "../lib/time.ts";
import { useToast } from "../lib/toast.tsx";
import { useDeviceName } from "../lib/identity.ts";
import { EmojiPicker } from "./EmojiPicker.tsx";

function LinkifiedText({ text }: { text: string }) {
  const parts = splitLinks(text);
  return (
    <>
      {parts.map((part, i) =>
        part.type === "link" ? (
          <a
            key={i}
            href={part.value}
            target="_blank"
            rel="noopener noreferrer"
            className="underline decoration-white/50 underline-offset-2 break-all hover:decoration-white"
          >
            {part.value}
          </a>
        ) : (
          <span key={i}>{part.value}</span>
        ),
      )}
    </>
  );
}

function DeviceNameEditor({
  name,
  onRename,
}: {
  name: string;
  onRename: (next: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(name);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

  function commit() {
    onRename(draft);
    setEditing(false);
  }

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => {
          setDraft(name);
          setEditing(true);
        }}
        className="inline-flex min-h-11 max-w-[11rem] items-center gap-1 truncate rounded-full border border-line px-2 py-0.5 text-[11px] text-quiet hover:text-ink dark:border-line-dark dark:text-quiet-dark dark:hover:text-ink-dark"
        title="Rename this device"
        aria-label={`Rename this device, currently ${name}`}
      >
        <Pencil className="size-3 shrink-0" />
        <span className="truncate">{name}</span>
      </button>
    );
  }

  return (
    <input
      ref={inputRef}
      value={draft}
      maxLength={30}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          commit();
        }
        if (e.key === "Escape") {
          setDraft(name);
          setEditing(false);
        }
      }}
      className="h-11 w-36 rounded-full border border-brand bg-canvas px-2 text-base outline-none dark:bg-canvas-dark"
      aria-label="Device name"
    />
  );
}

function ChatBubble({
  message,
  own,
  now,
  onReply,
}: {
  message: Message;
  own: boolean;
  now: number;
  onReply: (message: Message) => void;
}) {
  const [copied, setCopied] = useState(false);
  const quoted = message.replyTo;

  async function copy() {
    const ok = await writeClipboard(message.text);
    if (!ok) return;
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  }

  return (
    <div className={`flex ${own ? "justify-end" : "justify-start"}`}>
      <div
        className={`group min-w-0 max-w-[85%] rounded-2xl px-3 py-2 text-sm shadow-sm [overflow-wrap:anywhere] ${
          own
            ? "rounded-br-md bg-brand text-white"
            : "rounded-bl-md border border-line bg-canvas dark:border-line-dark dark:bg-canvas-dark"
        }`}
      >
        <div className="mb-0.5 flex items-center gap-2">
          {!own ? (
            <span className="min-w-0 truncate text-[11px] font-semibold text-brand dark:text-brand-glow">
              {message.sender}
            </span>
          ) : (
            <span className="text-[11px] font-medium text-white/80">You</span>
          )}
          <span
            className={`ml-auto shrink-0 text-[10px] ${own ? "text-white/70" : "text-quiet dark:text-quiet-dark"}`}
          >
            {formatRelativeTime(message.timestamp, now)}
          </span>
          <button
            type="button"
            onClick={() => onReply(message)}
            className={`inline-flex size-8 items-center justify-center rounded p-0.5 opacity-70 hover:opacity-100 ${own ? "text-white" : "text-quiet dark:text-quiet-dark"}`}
            aria-label={`Reply to ${own ? "yourself" : message.sender}`}
          >
            <Reply className="size-3" />
          </button>
          <button
            type="button"
            onClick={() => void copy()}
            className={`inline-flex size-8 items-center justify-center rounded p-0.5 opacity-70 hover:opacity-100 ${own ? "text-white" : "text-quiet dark:text-quiet-dark"}`}
            aria-label={copied ? "Copied" : "Copy message"}
          >
            {copied ? <Check className="size-3" /> : <Copy className="size-3" />}
          </button>
        </div>
        {quoted ? (
          <div
            className={`mb-1.5 rounded-lg border-l-2 px-2 py-1 text-[11px] ${
              own
                ? "border-white/70 bg-white/15 text-white/90"
                : "border-brand bg-brand/10 text-quiet dark:border-brand-glow dark:text-quiet-dark"
            }`}
          >
            <p className="truncate font-semibold">{quoted.sender}</p>
            <p className="line-clamp-2 [overflow-wrap:anywhere]">{quoted.text}</p>
          </div>
        ) : null}
        <p className="whitespace-pre-wrap break-words">
          {own ? (
            <LinkifiedText text={message.text} />
          ) : (
            <OtherLinks text={message.text} />
          )}
        </p>
      </div>
    </div>
  );
}

function OtherLinks({ text }: { text: string }) {
  const parts = splitLinks(text);
  return (
    <>
      {parts.map((part, i) =>
        part.type === "link" ? (
          <a
            key={i}
            href={part.value}
            target="_blank"
            rel="noopener noreferrer"
            className="break-all text-brand underline underline-offset-2 dark:text-brand-glow"
          >
            {part.value}
          </a>
        ) : (
          <span key={i}>{part.value}</span>
        ),
      )}
    </>
  );
}

export function ChatPanel() {
  const { toast } = useToast();
  const { connected } = useSocket();
  const { name, rename } = useDeviceName();
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const scrollerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const nearBottom = useRef(true);

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 15_000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    const onHistory = (history: Message[]) => setMessages(history);
    const onMessage = (message: Message) => {
      setMessages((current) =>
        current.some((row) => row.id === message.id)
          ? current
          : [...current, message],
      );
    };
    const onCleared = () => {
      setMessages([]);
      setReplyTo(null);
    };
    socket.on("chat:history", onHistory);
    socket.on("chat:message", onMessage);
    socket.on("chat:cleared", onCleared);
    socket.on("share:reset", onCleared);
    return () => {
      socket.off("chat:history", onHistory);
      socket.off("chat:message", onMessage);
      socket.off("chat:cleared", onCleared);
      socket.off("share:reset", onCleared);
    };
  }, []);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el || !nearBottom.current) return;
    el.scrollTop = el.scrollHeight;
  }, [messages]);

  function onScroll() {
    const el = scrollerRef.current;
    if (!el) return;
    nearBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  }

  function insertEmoji(emoji: string) {
    const el = inputRef.current;
    if (!el) {
      setDraft((current) => `${current}${emoji}`);
      return;
    }
    const start = el.selectionStart ?? draft.length;
    const end = el.selectionEnd ?? draft.length;
    const next = `${draft.slice(0, start)}${emoji}${draft.slice(end)}`;
    if (next.length > MAX_CHAT_TEXT) return;
    setDraft(next);
    window.requestAnimationFrame(() => {
      const cursor = start + emoji.length;
      el.focus();
      el.setSelectionRange(cursor, cursor);
    });
  }

  function send() {
    const text = draft.trim();
    if (!text || !connected) return;
    if (text.length > MAX_CHAT_TEXT) {
      toast("Message too long");
      return;
    }
    const outgoing = text;
    const replyToId = replyTo?.id;
    setDraft("");
    setReplyTo(null);
    setEmojiOpen(false);
    socket.emit(
      "chat:send",
      { text: outgoing, sender: name, ...(replyToId ? { replyToId } : {}) },
      (result) => {
        if (result && !result.ok) {
          toast(result.error);
          setDraft((current) => current || outgoing);
        }
      },
    );
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    send();
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
    if (e.key === "Escape" && replyTo) {
      setReplyTo(null);
    }
  }

  function startReply(message: Message) {
    setReplyTo(message);
    setEmojiOpen(false);
    window.requestAnimationFrame(() => inputRef.current?.focus());
  }

  function clearChat() {
    if (!connected) return;
    if (!confirmClear) {
      setConfirmClear(true);
      return;
    }
    setConfirmClear(false);
    socket.emit("chat:clear", (result) => {
      if (result && !result.ok) toast(result.error);
      else toast("Chat cleared on every device", "success");
    });
  }

  return (
    <section className="flex h-full min-h-[22rem] min-w-0 flex-1 flex-col overflow-hidden rounded-2xl border border-line bg-panel p-4 shadow-sm dark:border-line-dark dark:bg-panel-dark sm:min-h-[26rem] sm:p-5 lg:min-h-[32rem]">
      <div className="flex min-w-0 items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <MessageCircle className="size-4 shrink-0 text-brand dark:text-brand-glow" />
            <h2 className="font-display text-lg font-bold">Chat</h2>
          </div>
          <p className="mt-1 text-sm text-quiet dark:text-quiet-dark">
            Everyone on this network, no rooms.
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1 sm:flex-row sm:items-center">
          <DeviceNameEditor name={name} onRename={rename} />
          <button
            type="button"
            disabled={!connected || messages.length === 0}
            onClick={clearChat}
            onBlur={() => setConfirmClear(false)}
            className={`inline-flex min-h-11 items-center gap-1 rounded-lg border px-2 text-[11px] font-medium disabled:opacity-40 ${
              confirmClear
                ? "border-down bg-down text-white"
                : "border-line hover:bg-canvas dark:border-line-dark dark:hover:bg-canvas-dark"
            }`}
            aria-label="Clear chat for everyone"
          >
            <Eraser className="size-3.5 shrink-0" />
            {confirmClear ? "Clear all?" : "Clear"}
          </button>
        </div>
      </div>

      <div
        ref={scrollerRef}
        onScroll={onScroll}
        aria-live="polite"
        aria-label="Chat messages"
        className="mt-4 flex min-h-[12rem] min-w-0 flex-1 flex-col gap-2 overflow-y-auto rounded-xl border border-line bg-canvas/60 p-3 dark:border-line-dark dark:bg-canvas-dark/40"
      >
        {messages.length === 0 ? (
          <p className="m-auto text-sm text-quiet dark:text-quiet-dark">
            No messages yet. Say hi.
          </p>
        ) : (
          messages.map((message) => (
            <ChatBubble
              key={message.id}
              message={message}
              own={message.sender === name}
              now={now}
              onReply={startReply}
            />
          ))
        )}
      </div>

      {replyTo ? (
        <div className="mt-3 flex min-w-0 items-start gap-2 rounded-xl border border-brand/40 bg-brand/10 px-3 py-2 dark:border-brand-glow/40 dark:bg-brand/15">
          <Reply className="mt-0.5 size-3.5 shrink-0 text-brand dark:text-brand-glow" />
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold text-brand dark:text-brand-glow">
              Replying to {replyTo.sender === name ? "yourself" : replyTo.sender}
            </p>
            <p className="line-clamp-2 text-xs text-quiet dark:text-quiet-dark [overflow-wrap:anywhere]">
              {replyTo.text}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setReplyTo(null)}
            className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg text-quiet hover:text-ink dark:text-quiet-dark dark:hover:text-ink-dark"
            aria-label="Cancel reply"
          >
            <X className="size-4" />
          </button>
        </div>
      ) : null}

      {emojiOpen ? (
        <div className="mt-2 min-w-0">
          <EmojiPicker onPick={insertEmoji} />
        </div>
      ) : null}

      <form onSubmit={onSubmit} className="mt-3 flex min-w-0 items-end gap-2">
        <button
          type="button"
          disabled={!connected}
          onClick={() => setEmojiOpen((open) => !open)}
          className={`inline-flex size-11 shrink-0 items-center justify-center rounded-xl border border-line disabled:opacity-40 dark:border-line-dark ${
            emojiOpen ? "bg-brand/15 text-brand dark:text-brand-glow" : "bg-canvas dark:bg-canvas-dark"
          }`}
          aria-pressed={emojiOpen}
          aria-label={emojiOpen ? "Hide emojis" : "Show emojis"}
        >
          <Smile className="size-4" />
        </button>
        <textarea
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKeyDown}
          disabled={!connected}
          rows={1}
          maxLength={MAX_CHAT_TEXT}
          placeholder={
            !connected
              ? "Disconnected"
              : replyTo
                ? `Reply to ${replyTo.sender === name ? "yourself" : replyTo.sender}…`
                : "Message… Enter to send"
          }
          className="max-h-28 min-h-11 min-w-0 flex-1 resize-none rounded-xl border border-line bg-canvas px-3 py-2.5 text-base outline-none focus:border-brand disabled:opacity-60 dark:border-line-dark dark:bg-canvas-dark dark:focus:border-brand-glow"
        />
        <button
          type="submit"
          disabled={!connected || !draft.trim()}
          className="inline-flex size-11 shrink-0 items-center justify-center rounded-xl bg-brand text-white transition hover:opacity-90 disabled:opacity-40"
          aria-label="Send"
        >
          <Send className="size-4" />
        </button>
      </form>
    </section>
  );
}
