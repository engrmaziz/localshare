import { AlignLeft, FolderUp, Lock, Radio } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import type { FileMeta } from "@shared/types";
import { ChatPanel } from "./components/ChatPanel.tsx";
import { ConnectCard } from "./components/ConnectCard.tsx";
import { FilesPanel } from "./components/FilesPanel.tsx";
import { SharedText } from "./components/SharedText.tsx";
import { ThemeToggle } from "./components/ThemeToggle.tsx";
import { ResetShareButton } from "./components/ResetShareButton.tsx";
import { useAuth } from "./components/AuthGate.tsx";
import { socket, useSocket } from "./lib/socket.ts";

type Tab = "text" | "files";

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
  const [fileBadge, setFileBadge] = useState(0);
  const tabRef = useRef<Tab>(tab);
  const keyboardOpen = kbInset > 60;

  useEffect(() => {
    tabRef.current = tab;
  }, [tab]);

  useEffect(() => {
    const onFiles = (added: FileMeta[]) => {
      if (tabRef.current !== "files" && added.length > 0) {
        setFileBadge((n) => n + added.length);
      }
    };
    const onReset = () => setFileBadge(0);
    socket.on("files:added", onFiles);
    socket.on("share:reset", onReset);
    socket.on("files:cleared", onReset);
    return () => {
      socket.off("files:added", onFiles);
      socket.off("share:reset", onReset);
      socket.off("files:cleared", onReset);
    };
  }, []);

  function selectTab(next: Tab) {
    setTab(next);
    if (next === "files") setFileBadge(0);
  }

  useEffect(() => {
    const onFocusFiles = () => selectTab("files");
    window.addEventListener("localshare:focus-files", onFocusFiles);
    return () => window.removeEventListener("localshare:focus-files", onFocusFiles);
  }, []);

  const deviceLabel =
    clientCount === 1 ? "1 device connected" : `${clientCount} devices connected`;

  return (
    <div className="bg-dot-grid flex min-h-dvh w-full max-w-full min-w-0 flex-col overflow-x-hidden pt-[env(safe-area-inset-top)]">
      <header className="sticky top-0 z-30 w-full max-w-full border-b border-line/80 bg-canvas/95 dark:border-line-dark/80 dark:bg-canvas-dark/95">
        <div className="mx-auto flex w-full min-w-0 max-w-6xl items-center gap-2 px-3 py-2 sm:gap-3 sm:px-6 sm:py-3">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-brand text-white">
              <Radio className="size-4" aria-hidden />
            </span>
            <div className="min-w-0">
              <p className="truncate font-display text-base font-extrabold leading-none tracking-tight sm:text-lg">
                LocalShare
              </p>
              <p className="mt-0.5 hidden text-[11px] uppercase tracking-[0.14em] text-quiet dark:text-quiet-dark sm:block">
                LAN only
              </p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-1 sm:gap-2">
            <span
              className="inline-flex size-11 items-center justify-center rounded-full border border-line bg-panel dark:border-line-dark dark:bg-panel-dark sm:h-8 sm:w-auto sm:px-2.5"
              role="status"
              aria-label={connected ? "Connected" : "Offline"}
              title={connected ? "Connected" : "Offline"}
            >
              <span
                className={`size-2.5 rounded-full ${
                  connected ? "bg-live dark:bg-live-dark" : "bg-down"
                }`}
                aria-hidden
              />
              <span className="ml-2 hidden text-xs font-medium sm:inline">
                {connected ? "Connected" : "Offline"}
              </span>
            </span>
            <span className="hidden text-xs text-quiet dark:text-quiet-dark lg:inline">
              {deviceLabel}
            </span>
            <ThemeToggle />
            <ResetShareButton />
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
        <p className="px-3 pb-2 text-xs text-quiet dark:text-quiet-dark sm:hidden">
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
        className="mx-auto flex w-full min-w-0 max-w-6xl flex-1 flex-col gap-4 px-3 py-4 sm:px-6 sm:py-8 lg:pb-8"
        style={{
          paddingBottom: `calc(1.25rem + env(safe-area-inset-bottom) + ${
            keyboardOpen ? kbInset : 72
          }px)`,
        }}
      >
        <ConnectCard />

        <div className="flex min-h-[22rem] min-w-0 w-full flex-[1.7] flex-col sm:min-h-[26rem] lg:min-h-[32rem]">
          <ChatPanel />
        </div>

        <div className="grid min-w-0 flex-1 grid-cols-1 gap-4 md:grid-cols-2 md:items-stretch">
          <div
            className={`${
              tab === "text" ? "flex" : "max-md:hidden flex"
            } min-h-0 min-w-0 flex-1 flex-col`}
          >
            <SharedText />
          </div>
          <div
            className={`${
              tab === "files" ? "flex" : "max-md:hidden flex"
            } min-h-0 min-w-0 flex-1 flex-col`}
          >
            <FilesPanel />
          </div>
        </div>
      </main>

      <nav
        aria-label="Primary"
        className={`fixed bottom-0 left-0 right-0 z-40 w-full max-w-full border-t border-line bg-panel px-1 pt-1 dark:border-line-dark dark:bg-panel-dark md:hidden ${
          keyboardOpen ? "hidden" : ""
        }`}
        style={{ paddingBottom: "max(0.35rem, env(safe-area-inset-bottom))" }}
      >
        <div className="mx-auto flex w-full max-w-lg min-w-0">
          <TabButton
            label="Text"
            icon={<AlignLeft className="size-5" aria-hidden />}
            active={tab === "text"}
            badge={0}
            onSelect={() => selectTab("text")}
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
