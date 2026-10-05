import { Check, Copy, MessageCircle, Pencil, Send } from "lucide-react";
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
    setDraft(name);
  }, [name]);

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
        onClick={() => setEditing(true)}
        className="inline-flex max-w-[11rem] items-center gap-1 truncate rounded-full border border-line px-2 py-0.5 text-[11px] text-quiet hover:text-ink dark:border-line-dark dark:text-quiet-dark dark:hover:text-ink-dark"
        title="Rename this device"
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
      className="w-36 rounded-full border border-brand bg-canvas px-2 py-0.5 text-[11px] outline-none dark:bg-canvas-dark"
      aria-label="Device name"
    />
  );
}

function ChatBubble({
  message,
  own,
  now,
}: {
  message: Message;
  own: boolean;
  now: number;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    const ok = await writeClipboard(message.text);
    if (!ok) return;
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  }

  return (
    <div className={`flex ${own ? "justify-end" : "justify-start"}`}>
      <div
        className={`group max-w-[85%] rounded-2xl px-3 py-2 text-sm shadow-sm ${
          own
            ? "rounded-br-md bg-brand text-white"
            : "rounded-bl-md border border-line bg-canvas dark:border-line-dark dark:bg-canvas-dark"
        }`}
      >
        <div className="mb-0.5 flex items-center gap-2">
          {!own ? (
            <span className="truncate text-[11px] font-semibold text-brand dark:text-brand-glow">
              {message.sender}
            </span>
          ) : (
            <span className="text-[11px] font-medium text-white/80">You</span>
          )}
          <span
            className={`ml-auto text-[10px] ${own ? "text-white/70" : "text-quiet dark:text-quiet-dark"}`}
          >
            {formatRelativeTime(message.timestamp, now)}
          </span>
          <button
            type="button"
            onClick={copy}
            className={`rounded p-0.5 opacity-70 hover:opacity-100 ${own ? "text-white" : "text-quiet dark:text-quiet-dark"}`}
            title="Copy message"
          >
            {copied ? <Check className="size-3" /> : <Copy className="size-3" />}
          </button>
        </div>
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
  const [now, setNow] = useState(() => Date.now());
  const scrollerRef = useRef<HTMLDivElement>(null);
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
    socket.on("chat:history", onHistory);
    socket.on("chat:message", onMessage);
    return () => {
      socket.off("chat:history", onHistory);
      socket.off("chat:message", onMessage);
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

  function send() {
    const text = draft.trim();
    if (!text || !connected) return;
    if (text.length > MAX_CHAT_TEXT) {
      toast("Message too long");
      return;
    }
    const outgoing = text;
    setDraft("");
    socket.emit("chat:send", { text: outgoing, sender: name }, (result) => {
      if (result && !result.ok) {
        toast(result.error);
        setDraft((current) => current || outgoing);
      }
    });
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
  }

  return (
    <section className="flex min-h-[280px] flex-1 flex-col rounded-2xl border border-line bg-panel p-5 shadow-sm dark:border-line-dark dark:bg-panel-dark">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <MessageCircle className="size-4 text-brand dark:text-brand-glow" />
            <h2 className="font-display text-lg font-bold">Chat</h2>
          </div>
          <p className="mt-1 text-sm text-quiet dark:text-quiet-dark">
            Everyone on this network, no rooms.
          </p>
        </div>
        <DeviceNameEditor name={name} onRename={rename} />
      </div>

      <div
        ref={scrollerRef}
        onScroll={onScroll}
        className="mt-4 flex min-h-[180px] flex-1 flex-col gap-2 overflow-y-auto rounded-xl border border-line bg-canvas/60 p-3 dark:border-line-dark dark:bg-canvas-dark/40"
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
            />
          ))
        )}
      </div>

      <form onSubmit={onSubmit} className="mt-3 flex items-end gap-2">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKeyDown}
          disabled={!connected}
          rows={1}
          maxLength={MAX_CHAT_TEXT}
          placeholder={connected ? "Message… Enter to send" : "Disconnected"}
          className="max-h-28 min-h-[42px] flex-1 resize-none rounded-xl border border-line bg-canvas px-3 py-2.5 text-sm outline-none focus:border-brand disabled:opacity-60 dark:border-line-dark dark:bg-canvas-dark dark:focus:border-brand-glow"
        />
        <button
          type="submit"
          disabled={!connected || !draft.trim()}
          className="inline-flex size-[42px] shrink-0 items-center justify-center rounded-xl bg-brand text-white transition hover:opacity-90 disabled:opacity-40"
          aria-label="Send"
        >
          <Send className="size-4" />
        </button>
      </form>
    </section>
  );
}
