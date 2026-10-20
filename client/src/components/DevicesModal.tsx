import {
  Ban,
  Check,
  Laptop,
  LogOut,
  Shield,
  ShieldCheck,
  Smartphone,
  Tablet,
  Users,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import type { BlockedEntry, ConnectedDevice } from "@shared/types";
import { socket } from "../lib/socket.ts";
import { formatRelativeTime } from "../lib/time.ts";
import { useToast } from "../lib/toast.tsx";

type DevicesModalProps = {
  isOpen: boolean;
  onClose: () => void;
  devices: ConnectedDevice[];
  blocked: BlockedEntry[];
};

export function DevicesModal({
  isOpen,
  onClose,
  devices,
  blocked,
}: DevicesModalProps) {
  const { toast } = useToast();
  const [tab, setTab] = useState<"active" | "blocked">("active");
  const [confirmKick, setConfirmKick] = useState<string | null>(null);
  const [confirmBlock, setConfirmBlock] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  function handleClose() {
    setConfirmKick(null);
    setConfirmBlock(null);
    onClose();
  }

  useEffect(() => {
    if (!isOpen) return;
    const id = window.setInterval(() => setNow(Date.now()), 10_000);
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setConfirmKick(null);
        setConfirmBlock(null);
        onClose();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.clearInterval(id);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  function handleKick(device: ConnectedDevice) {
    if (confirmKick !== device.id) {
      setConfirmKick(device.id);
      setConfirmBlock(null);
      return;
    }
    setConfirmKick(null);
    socket.emit("device:disconnect", { deviceId: device.id }, (res) => {
      if (res && !res.ok) {
        toast(res.error, "error");
      } else {
        toast(`Removed ${device.name}`, "info");
      }
    });
  }

  function handleBlock(device: ConnectedDevice) {
    if (confirmBlock !== device.id) {
      setConfirmBlock(device.id);
      setConfirmKick(null);
      return;
    }
    setConfirmBlock(null);
    socket.emit("device:block", { ip: device.ip }, (res) => {
      if (res && !res.ok) {
        toast(res.error, "error");
      } else {
        toast(`Blocked ${device.name} (${device.ip})`, "info");
      }
    });
  }

  function handleUnblock(ip: string) {
    socket.emit("device:unblock", { ip }, (res) => {
      if (res && !res.ok) {
        toast(res.error, "error");
      } else {
        toast(`Unblocked ${ip}`, "success");
      }
    });
  }

  function DeviceIcon({ type }: { type: ConnectedDevice["deviceType"] }) {
    if (type === "mobile") {
      return <Smartphone className="size-5 shrink-0 text-brand dark:text-brand-glow" />;
    }
    if (type === "tablet") {
      return <Tablet className="size-5 shrink-0 text-brand dark:text-brand-glow" />;
    }
    return <Laptop className="size-5 shrink-0 text-brand dark:text-brand-glow" />;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Connected Devices"
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
    >
      <div className="flex max-h-[85vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-line bg-panel shadow-2xl dark:border-line-dark dark:bg-panel-dark">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-line px-5 py-4 dark:border-line-dark">
          <div className="flex items-center gap-2.5">
            <span className="flex size-9 items-center justify-center rounded-xl bg-brand/10 text-brand dark:bg-brand-glow/10 dark:text-brand-glow">
              <Users className="size-5" />
            </span>
            <div>
              <h2 className="font-display text-lg font-bold">Network Devices</h2>
              <p className="text-xs text-quiet dark:text-quiet-dark">
                Connected devices on this LAN session
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="inline-flex size-9 items-center justify-center rounded-lg text-quiet hover:bg-canvas hover:text-ink dark:text-quiet-dark dark:hover:bg-canvas-dark dark:hover:text-ink-dark"
            aria-label="Close dialog"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-line bg-canvas/40 px-5 dark:border-line-dark dark:bg-canvas-dark/20">
          <button
            type="button"
            onClick={() => setTab("active")}
            className={`border-b-2 px-3 py-2.5 text-xs font-semibold transition ${
              tab === "active"
                ? "border-brand text-brand dark:border-brand-glow dark:text-brand-glow"
                : "border-transparent text-quiet hover:text-ink dark:text-quiet-dark dark:hover:text-ink-dark"
            }`}
          >
            Connected ({devices.length})
          </button>
          <button
            type="button"
            onClick={() => setTab("blocked")}
            className={`flex items-center gap-1.5 border-b-2 px-3 py-2.5 text-xs font-semibold transition ${
              tab === "blocked"
                ? "border-brand text-brand dark:border-brand-glow dark:text-brand-glow"
                : "border-transparent text-quiet hover:text-ink dark:text-quiet-dark dark:hover:text-ink-dark"
            }`}
          >
            <Shield className="size-3.5" />
            Blocked ({blocked.length})
          </button>
        </div>

        {/* Content list */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5">
          {tab === "active" ? (
            devices.length === 0 ? (
              <p className="py-8 text-center text-sm text-quiet dark:text-quiet-dark">
                No active devices detected.
              </p>
            ) : (
              <ul className="flex flex-col gap-2.5">
                {devices.map((device) => {
                  const isSelf = device.id === socket.id;
                  const isConfirmingKick = confirmKick === device.id;
                  const isConfirmingBlock = confirmBlock === device.id;

                  return (
                    <li
                      key={device.id}
                      className={`flex flex-col gap-2 rounded-xl border p-3 sm:flex-row sm:items-center sm:justify-between ${
                        isSelf
                          ? "border-brand/40 bg-brand/5 dark:border-brand-glow/40 dark:bg-brand-glow/5"
                          : "border-line bg-canvas/50 dark:border-line-dark dark:bg-canvas-dark/30"
                      }`}
                    >
                      <div className="flex min-w-0 items-start gap-3">
                        <div className="mt-0.5 rounded-lg border border-line bg-panel p-2 dark:border-line-dark dark:bg-panel-dark">
                          <DeviceIcon type={device.deviceType} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="truncate text-sm font-semibold text-ink dark:text-ink-dark">
                              {device.name}
                            </span>
                            {isSelf ? (
                              <span className="rounded-full bg-brand/15 px-2 py-0.2 text-[10px] font-semibold text-brand dark:bg-brand-glow/15 dark:text-brand-glow">
                                You
                              </span>
                            ) : null}
                            {device.isHost ? (
                              <span className="rounded-full bg-live/15 px-2 py-0.2 text-[10px] font-semibold text-live dark:bg-live-dark/15 dark:text-live-dark">
                                Host
                              </span>
                            ) : null}
                          </div>
                          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-quiet dark:text-quiet-dark">
                            <span>{device.ip}</span>
                            <span>•</span>
                            <span>
                              {device.browser} on {device.os}
                            </span>
                            <span>•</span>
                            <span>
                              Joined {formatRelativeTime(device.connectedAt, now)}
                            </span>
                          </div>
                        </div>
                      </div>

                      {!isSelf ? (
                        <div className="mt-2 flex shrink-0 items-center justify-end gap-1.5 border-t border-line/60 pt-2 sm:mt-0 sm:border-t-0 sm:pt-0">
                          {/* Kick/Disconnect button */}
                          <button
                            type="button"
                            onClick={() => handleKick(device)}
                            onBlur={() => setConfirmKick(null)}
                            className={`inline-flex min-h-9 items-center gap-1 rounded-lg border px-2.5 text-xs font-medium transition ${
                              isConfirmingKick
                                ? "border-down bg-down text-white"
                                : "border-line bg-panel text-quiet hover:border-down hover:text-down dark:border-line-dark dark:bg-panel-dark dark:text-quiet-dark dark:hover:text-down"
                            }`}
                            title="Disconnect this device and revoke its session"
                          >
                            <LogOut className="size-3.5" />
                            <span>{isConfirmingKick ? "Remove?" : "Remove"}</span>
                          </button>

                          {/* Block IP button */}
                          <button
                            type="button"
                            onClick={() => handleBlock(device)}
                            onBlur={() => setConfirmBlock(null)}
                            className={`inline-flex min-h-9 items-center gap-1 rounded-lg border px-2.5 text-xs font-medium transition ${
                              isConfirmingBlock
                                ? "border-down bg-down text-white"
                                : "border-line bg-panel text-quiet hover:border-down hover:text-down dark:border-line-dark dark:bg-panel-dark dark:text-quiet-dark dark:hover:text-down"
                            }`}
                            title="Block this device IP address from connecting"
                          >
                            <Ban className="size-3.5" />
                            <span>{isConfirmingBlock ? "Block IP?" : "Block"}</span>
                          </button>
                        </div>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            )
          ) : blocked.length === 0 ? (
            <div className="py-8 text-center text-sm text-quiet dark:text-quiet-dark">
              <ShieldCheck className="mx-auto mb-2 size-8 text-live dark:text-live-dark" />
              <p className="font-semibold">No blocked devices</p>
              <p className="mt-1 text-xs">
                Devices on this Wi-Fi with the access key can freely connect.
              </p>
            </div>
          ) : (
            <ul className="flex flex-col gap-2.5">
              {blocked.map((entry) => (
                <li
                  key={entry.ip}
                  className="flex flex-col gap-2 rounded-xl border border-line bg-canvas/50 p-3 dark:border-line-dark dark:bg-canvas-dark/30 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex items-center gap-3">
                    <div className="rounded-lg border border-down/30 bg-down/10 p-2 text-down">
                      <Ban className="size-5" />
                    </div>
                    <div>
                      <p className="font-mono text-sm font-semibold">{entry.ip}</p>
                      <p className="text-xs text-quiet dark:text-quiet-dark">
                        Blocked {formatRelativeTime(entry.blockedAt, now)}
                        {entry.reason ? ` · ${entry.reason}` : ""}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleUnblock(entry.ip)}
                    className="inline-flex min-h-9 items-center justify-center gap-1 rounded-lg border border-line bg-panel px-3 text-xs font-medium text-ink hover:border-brand hover:text-brand dark:border-line-dark dark:bg-panel-dark dark:text-ink-dark dark:hover:border-brand-glow dark:hover:text-brand-glow"
                  >
                    <Check className="size-3.5" />
                    <span>Unblock</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
