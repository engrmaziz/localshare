import { AlignLeft, ClipboardPaste, Copy, Eraser } from "lucide-react";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { MAX_CLIPBOARD_BYTES, type ClipboardState } from "@shared/types";
import { pasteShortcutHint, readClipboard, writeClipboard } from "../lib/clipboard.ts";
import { socket, useSocket } from "../lib/socket.ts";
import { useToast } from "../lib/toast.tsx";

const EMIT_MS = 300;
const TYPING_GRACE_MS = 1000;

function utf8Bytes(text: string): number {
  return new TextEncoder().encode(text).length;
}

function truncateUtf8(text: string, maxBytes: number): string {
  if (utf8Bytes(text) <= maxBytes) return text;
  let lo = 0;
  let hi = text.length;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (utf8Bytes(text.slice(0, mid)) <= maxBytes) lo = mid;
    else hi = mid - 1;
  }
  return text.slice(0, lo);
}

function syncedLabel(at: number | null, now: number): string {
  if (!at) return "Waiting for sync";
  if (now - at < 4000) return "Synced just now";
  return "Synced";
}

export function SharedText() {
  const { toast } = useToast();
  const { connected } = useSocket();
  const [text, setText] = useState("");
  const [copied, setCopied] = useState(false);
  const [syncedAt, setSyncedAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const textRef = useRef("");
  const focusedRef = useRef(false);
  const lastTypedAt = useRef(0);
  const appliedAt = useRef(0);
  const pendingRemote = useRef<ClipboardState | null>(null);
  const emitTimer = useRef<number | null>(null);
  const flushTimer = useRef<number | null>(null);
  const selectionRef = useRef<{ start: number; end: number } | null>(null);
  const scheduleQueuedApplyRef = useRef<() => void>(() => undefined);

  const markSynced = useCallback((at = Date.now()) => {
    setSyncedAt(at);
  }, []);

  const applyRemote = useCallback(
    (state: ClipboardState) => {
      if (state.updatedAt <= appliedAt.current) {
        pendingRemote.current = null;
        return;
      }
      const el = textareaRef.current;
      if (el) {
        selectionRef.current = {
          start: el.selectionStart,
          end: el.selectionEnd,
        };
      }
      appliedAt.current = state.updatedAt;
      pendingRemote.current = null;
      textRef.current = state.text;
      setText(state.text);
      markSynced(state.updatedAt);
    },
    [markSynced],
  );

  const scheduleQueuedApply = useCallback(() => {
    if (flushTimer.current) window.clearTimeout(flushTimer.current);
    const wait = Math.max(0, TYPING_GRACE_MS - (Date.now() - lastTypedAt.current));
    flushTimer.current = window.setTimeout(() => {
      const busy =
        focusedRef.current && Date.now() - lastTypedAt.current < TYPING_GRACE_MS;
      if (busy) {
        scheduleQueuedApplyRef.current();
        return;
      }
      const pending = pendingRemote.current;
      if (pending) applyRemote(pending);
    }, wait + 16);
  }, [applyRemote]);

  useEffect(() => {
    scheduleQueuedApplyRef.current = scheduleQueuedApply;
  }, [scheduleQueuedApply]);

  const emitUpdate = useCallback(
    (next: string, immediate = false) => {
      const send = () => {
        socket.emit("clipboard:update", { text: next });
        appliedAt.current = Math.max(appliedAt.current, Date.now());
        markSynced();
      };
      if (emitTimer.current) window.clearTimeout(emitTimer.current);
      if (immediate) {
        send();
        return;
      }
      emitTimer.current = window.setTimeout(send, EMIT_MS);
    },
    [markSynced],
  );

  const setLocalText = useCallback(
    (next: string, immediate = false) => {
      const clipped = truncateUtf8(next, MAX_CLIPBOARD_BYTES);
      if (clipped !== next) toast("Shared text was trimmed to 1 MB");
      lastTypedAt.current = Date.now();
      textRef.current = clipped;
      setText(clipped);
      emitUpdate(clipped, immediate);
    },
    [emitUpdate, toast],
  );

  useLayoutEffect(() => {
    const el = textareaRef.current;
    const sel = selectionRef.current;
    if (!el || !sel) return;
    const max = el.value.length;
    el.setSelectionRange(Math.min(sel.start, max), Math.min(sel.end, max));
    selectionRef.current = null;
  }, [text]);

  useEffect(() => {
    const onState = (state: ClipboardState) => {
      pendingRemote.current = null;
      applyRemote(state);
    };
    const onChanged = (state: ClipboardState) => {
      if (state.updatedAt <= appliedAt.current) return;
      const typing =
        focusedRef.current && Date.now() - lastTypedAt.current < TYPING_GRACE_MS;
      if (typing) {
        pendingRemote.current = state;
        scheduleQueuedApply();
        return;
      }
      applyRemote(state);
    };

    socket.on("clipboard:state", onState);
    socket.on("clipboard:changed", onChanged);
    return () => {
      socket.off("clipboard:state", onState);
      socket.off("clipboard:changed", onChanged);
      if (emitTimer.current) window.clearTimeout(emitTimer.current);
      if (flushTimer.current) window.clearTimeout(flushTimer.current);
    };
  }, [applyRemote, scheduleQueuedApply]);

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 2000);
    return () => window.clearInterval(id);
  }, []);

  async function handleCopy() {
    if (!text) return;
    const ok = await writeClipboard(text);
    if (!ok) {
      toast("Couldn't copy. Select the text and copy manually.");
      return;
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  async function handlePaste() {
    const pasted = await readClipboard();
    if (pasted == null) {
      toast(pasteShortcutHint());
      textareaRef.current?.focus();
      return;
    }
    setLocalText(pasted, true);
  }

  function handleClear() {
    setLocalText("", true);
    textareaRef.current?.focus();
  }

  const bytes = utf8Bytes(text);

  return (
    <section className="flex min-h-[260px] flex-col rounded-2xl border border-line bg-panel p-5 shadow-sm dark:border-line-dark dark:bg-panel-dark">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <AlignLeft className="size-4 text-brand dark:text-brand-glow" />
            <h2 className="font-display text-lg font-bold">Shared text</h2>
          </div>
          <p className="mt-1 text-sm text-quiet dark:text-quiet-dark">
            One live pad for every device on this LAN.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={handleCopy}
            disabled={!connected}
            className="inline-flex min-h-11 items-center gap-1 rounded-lg border border-line px-2.5 py-1.5 text-xs font-medium hover:bg-canvas disabled:opacity-50 dark:border-line-dark dark:hover:bg-canvas-dark"
          >
            <Copy className="size-3.5" />
            {copied ? "Copied" : "Copy"}
          </button>
          <button
            type="button"
            onClick={handlePaste}
            disabled={!connected}
            className="inline-flex min-h-11 items-center gap-1 rounded-lg border border-line px-2.5 py-1.5 text-xs font-medium hover:bg-canvas disabled:opacity-50 dark:border-line-dark dark:hover:bg-canvas-dark"
          >
            <ClipboardPaste className="size-3.5" />
            Paste
          </button>
          <button
            type="button"
            onClick={handleClear}
            disabled={!connected}
            className="inline-flex min-h-11 items-center gap-1 rounded-lg border border-line px-2.5 py-1.5 text-xs font-medium hover:bg-canvas disabled:opacity-50 dark:border-line-dark dark:hover:bg-canvas-dark"
          >
            <Eraser className="size-3.5" />
            Clear
          </button>
        </div>
      </div>

      <textarea
        ref={textareaRef}
        value={text}
        onFocus={() => {
          focusedRef.current = true;
        }}
        onBlur={() => {
          focusedRef.current = false;
          const pending = pendingRemote.current;
          if (pending) applyRemote(pending);
          if (emitTimer.current) {
            window.clearTimeout(emitTimer.current);
            emitTimer.current = null;
            socket.emit("clipboard:update", { text: textRef.current });
            appliedAt.current = Math.max(appliedAt.current, Date.now());
            markSynced();
          }
        }}
        onChange={(e) => setLocalText(e.target.value)}
        disabled={!connected}
        placeholder={
          connected
            ? "Type here — it appears on every connected device."
            : "Disconnected — reconnecting…"
        }
        className="mt-4 min-h-[160px] flex-1 resize-y rounded-xl border border-line bg-canvas px-3 py-2.5 font-sans text-base leading-relaxed outline-none focus:border-brand disabled:opacity-60 dark:border-line-dark dark:bg-canvas-dark dark:focus:border-brand-glow"
      />

      <div className="mt-2 flex items-center justify-between text-[11px] text-quiet dark:text-quiet-dark">
        <span>{syncedLabel(syncedAt, now)}</span>
        <span>
          {text.length.toLocaleString()} chars
          {bytes > 0 ? ` · ${bytes.toLocaleString()} bytes` : ""}
        </span>
      </div>
    </section>
  );
}
