import { Radio } from "lucide-react";
import { useEffect, useRef } from "react";
import { ChatPanel } from "./components/ChatPanel.tsx";
import { ConnectCard } from "./components/ConnectCard.tsx";
import { FilesPanel } from "./components/FilesPanel.tsx";
import { SharedText } from "./components/SharedText.tsx";
import { socket, useSocket } from "./lib/socket.ts";
import { useToast } from "./lib/toast.tsx";

export default function App() {
  const { connected, clientCount } = useSocket();
  const { toast } = useToast();
  const seenConnection = useRef(socket.connected);

  useEffect(() => {
    const onConnect = () => {
      seenConnection.current = true;
    };
    const onDisconnect = () => {
      if (seenConnection.current) toast("Disconnected");
    };
    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
    };
  }, [toast]);

  const deviceLabel =
    clientCount === 1 ? "1 device connected" : `${clientCount} devices connected`;

  return (
    <div className="bg-dot-grid min-h-dvh">
      <header className="sticky top-0 z-10 border-b border-line/80 bg-canvas/85 backdrop-blur-md dark:border-line-dark/80 dark:bg-canvas-dark/80">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-2.5">
            <span className="flex size-8 items-center justify-center rounded-lg bg-brand text-white">
              <Radio className="size-4" />
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
              className="inline-flex items-center gap-2 rounded-full border border-line bg-panel px-2.5 py-1 text-xs font-medium dark:border-line-dark dark:bg-panel-dark"
              role="status"
            >
              <span
                className={`size-2 rounded-full ${
                  connected
                    ? "bg-live dark:bg-live-dark"
                    : "bg-down"
                }`}
                aria-hidden
              />
              {connected ? "Connected" : "Disconnected"}
            </span>
            <span className="hidden text-xs text-quiet dark:text-quiet-dark sm:inline">
              {deviceLabel}
            </span>
          </div>
        </div>
        <p className="px-4 pb-3 text-xs text-quiet dark:text-quiet-dark sm:hidden">
          {deviceLabel}
        </p>
      </header>

      <main className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-5 sm:px-6 sm:py-8">
        <ConnectCard />

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:items-stretch">
          <div className="flex flex-col gap-4">
            <SharedText />
            <ChatPanel />
          </div>
          <FilesPanel />
        </div>
      </main>
    </div>
  );
}
