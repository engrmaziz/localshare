import { AlignLeft, FolderUp, Lock, MessageCircle, Radio } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import type { FileMeta, Message } from "@shared/types";
import { ChatPanel } from "./components/ChatPanel.tsx";
import { ConnectCard } from "./components/ConnectCard.tsx";
import { FilesPanel } from "./components/FilesPanel.tsx";
import { SharedText } from "./components/SharedText.tsx";
import { ThemeToggle } from "./components/ThemeToggle.tsx";
import { useAuth } from "./components/AuthGate.tsx";
import { socket, useSocket } from "./lib/socket.ts";

type Tab = "text" | "chat" | "files";

function useKeyboardInset(): number {
  const [inset, setInset] = useState(0);

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const sync = () => {
      const next = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
      document.documentElement.style.setProperty("--kb-inset", `${next}px`);
      setInset(next);
    };
    sync();
    vv.addEventListener("resize", sync);
    vv.addEventListener("scroll", sync);
    return () => {
      vv.removeEventListener("resize", sync);
      vv.removeEventListener("scroll", sync);
      document.documentElement.style.removeProperty("--kb-inset");
    };
  }, []);

  return inset;
}

function TabButton({
  label,
  icon,
  active,
  badge,
  onSelect,
}: {
  label: string;
  icon: ReactNode;
  active: boolean;
  badge: number;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`relative inline-flex min-h-11 min-w-11 flex-1 flex-col items-center justify-center gap-0.5 rounded-xl text-xs font-medium ${
        active
          ? "text-brand dark:text-brand-glow"
          : "text-quiet dark:text-quiet-dark"
      }`}
      aria-current={active ? "page" : undefined}
    >
      {icon}
      {label}
      {badge > 0 ? (
        <span className="absolute right-[18%] top-0 min-w-4 rounded-full bg-down px-1 text-[10px] font-semibold leading-4 text-white">
          {badge > 9 ? "9+" : badge}
        </span>
      ) : null}
    </button>
  );
}

export default function App() {
  const { connected, clientCount } = useSocket();
  const { logout } = useAuth();
  const kbInset = useKeyboardInset();
  const [tab, setTab] = useState<Tab>("text");
  const [chatUnread, setChatUnread] = useState(0);
  const [fileBadge, setFileBadge] = useState(0);
  const tabRef = useRef<Tab>(tab);
  const keyboardOpen = kbInset > 60;

  useEffect(() => {
    tabRef.current = tab;
  }, [tab]);

  useEffect(() => {
    const onMessage = (_message: Message) => {
      if (tabRef.current !== "chat") setChatUnread((n) => n + 1);
    };
    const onFiles = (added: FileMeta[]) => {
      if (tabRef.current !== "files" && added.length > 0) {
        setFileBadge((n) => n + added.length);
      }
    };
    socket.on("chat:message", onMessage);
    socket.on("files:added", onFiles);
    return () => {
      socket.off("chat:message", onMessage);
      socket.off("files:added", onFiles);
    };
  }, []);

  function selectTab(next: Tab) {
    setTab(next);
    if (next === "chat") setChatUnread(0);
    if (next === "files") setFileBadge(0);
  }

  const deviceLabel =
    clientCount === 1 ? "1 device connected" : `${clientCount} devices connected`;

  return (
    <div className="bg-dot-grid flex min-h-dvh flex-col pt-[env(safe-area-inset-top)]">
      <header className="sticky top-0 z-10 border-b border-line/80 bg-canvas/85 backdrop-blur-md dark:border-line-dark/80 dark:bg-canvas-dark/80">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-2.5">
            <span className="flex size-8 items-center justify-center rounded-lg bg-brand text-white">
              <Radio className="size-4" aria-hidden />
            </span>
            <div>
              <p className="font-display text-lg font-extrabold leading-none tracking-tight">
                LocalShare
              </p>
              <p className="mt-0.5 text-[11px] uppercase tracking-[0.14em] text-quiet dark:text-quiet-dark">
                LAN only
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <span
              className="inline-flex min-h-8 items-center gap-2 rounded-full border border-line bg-panel px-2.5 py-1 text-xs font-medium dark:border-line-dark dark:bg-panel-dark"
              role="status"
            >
              <span
                className={`size-2 rounded-full ${
                  connected ? "bg-live dark:bg-live-dark" : "bg-down"
                }`}
                aria-hidden
              />
              {connected ? "Connected" : "Offline"}
            </span>
            <span className="hidden text-xs text-quiet dark:text-quiet-dark sm:inline">
              {deviceLabel}
            </span>
            <ThemeToggle />
            <button
              type="button"
              onClick={() => void logout()}
              className="inline-flex size-11 items-center justify-center rounded-full border border-line bg-panel dark:border-line-dark dark:bg-panel-dark"
              aria-label="Lock / Log out"
            >
              <Lock className="size-4" />
            </button>
          </div>
        </div>
        <p className="px-4 pb-3 text-xs text-quiet dark:text-quiet-dark sm:hidden">
          {deviceLabel}
        </p>
      </header>

      {!connected ? (
        <div
          className="border-b border-down/30 bg-down/10 px-4 py-2 text-center text-sm font-medium text-down"
          role="status"
        >
          Reconnecting…
        </div>
      ) : null}

      <main
        className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-4 px-4 py-5 sm:px-6 sm:py-8 lg:pb-8"
        style={{
          paddingBottom: `calc(1.25rem + env(safe-area-inset-bottom) + ${
            keyboardOpen ? kbInset : 72
          }px)`,
        }}
      >
        <ConnectCard />

        <div className="grid flex-1 grid-cols-1 gap-4 lg:grid-cols-2 lg:items-stretch">
          <div className="flex min-h-0 flex-col gap-4">
            <div className={`${tab === "text" ? "flex" : "hidden"} min-h-0 flex-1 flex-col lg:flex`}>
              <SharedText />
            </div>
            <div
              className={`${tab === "chat" ? "flex" : "hidden"} min-h-0 flex-1 flex-col lg:flex`}
            >
              <ChatPanel />
            </div>
          </div>
          <div className={`${tab === "files" ? "flex" : "hidden"} min-h-0 flex-1 flex-col lg:flex`}>
            <FilesPanel />
          </div>
        </div>
      </main>

      <nav
        aria-label="Primary"
        className={`fixed inset-x-0 z-20 border-t border-line bg-panel/95 px-2 pt-1 backdrop-blur-md dark:border-line-dark dark:bg-panel-dark/95 lg:hidden ${
          keyboardOpen ? "hidden" : ""
        }`}
        style={{ bottom: 0, paddingBottom: "max(0.35rem, env(safe-area-inset-bottom))" }}
      >
        <div className="mx-auto flex max-w-lg">
          <TabButton
            label="Text"
            icon={<AlignLeft className="size-5" aria-hidden />}
            active={tab === "text"}
            badge={0}
            onSelect={() => selectTab("text")}
          />
          <TabButton
            label="Chat"
            icon={<MessageCircle className="size-5" aria-hidden />}
            active={tab === "chat"}
            badge={chatUnread}
            onSelect={() => selectTab("chat")}
          />
          <TabButton
            label="Files"
            icon={<FolderUp className="size-5" aria-hidden />}
            active={tab === "files"}
            badge={fileBadge}
            onSelect={() => selectTab("files")}
          />
        </div>
      </nav>
    </div>
  );
}
