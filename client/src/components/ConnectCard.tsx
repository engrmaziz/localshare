import { ChevronsDown, ChevronsUp, Copy, Check, Eye, EyeOff, Share2 } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "./AuthGate.tsx";
import { apiFetch } from "../lib/auth.ts";
import { writeClipboard } from "../lib/clipboard.ts";

type InfoResponse = {
  ips: { address: string; iface: string }[];
  primaryIp: string;
  port: number;
  url: string;
};

const IP_KEY = "localshare.preferredIp";
const QR_KEY_TOGGLE = "localshare.qrIncludeKey";

function pagePort(): string {
  return window.location.port || "80";
}

function shareUrl(ip: string): string {
  return `http://${ip}:${pagePort()}`;
}

function isLoopback(host: string): boolean {
  return host === "localhost" || host === "127.0.0.1" || host === "[::1]";
}

function defaultOpen(): boolean {
  if (window.matchMedia("(min-width: 1024px)").matches) return true;
  return isLoopback(window.location.hostname);
}

export function ConnectCard() {
  const { isHost } = useAuth();
  const [info, setInfo] = useState<InfoResponse | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(defaultOpen);
  const [hostKey, setHostKey] = useState<string | null>(null);
  const [keyVisible, setKeyVisible] = useState(false);
  const [keyCopied, setKeyCopied] = useState(false);
  const [includeKey, setIncludeKey] = useState(() => {
    try {
      return localStorage.getItem(QR_KEY_TOGGLE) === "1";
    } catch {
      return false;
    }
  });
  const canShare = typeof navigator !== "undefined" && typeof navigator.share === "function";

  useEffect(() => {
    if (!isHost || hostKey) return;
    if (!includeKey) return;
    let cancelled = false;
    void apiFetch("/api/auth/key").then(async (res) => {
      if (!res.ok || cancelled) return;
      const body = (await res.json()) as { key?: string };
      if (typeof body.key === "string") setHostKey(body.key);
    });
    return () => {
      cancelled = true;
    };
  }, [isHost, includeKey, hostKey]);

  useEffect(() => {
    let cancelled = false;
    apiFetch("/api/info")
      .then(async (res) => {
        if (!res.ok) throw new Error("info");
        return res.json() as Promise<InfoResponse>;
      })
      .then((body) => {
        if (cancelled) return;
        setInfo(body);
        let preferred: string | null = null;
        try {
          preferred = localStorage.getItem(IP_KEY);
        } catch {
          /* private mode */
        }
        const addresses = body.ips.map((row) => row.address);
        if (preferred && addresses.includes(preferred)) setSelected(preferred);
        else setSelected(body.primaryIp === "localhost" ? null : body.primaryIp);
      })
      .catch(() => {
        if (!cancelled) setError("Waiting for the LocalShare server…");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const ip = selected && selected !== "localhost" ? selected : null;
  const url = useMemo(() => (ip ? shareUrl(ip) : null), [ip]);
  const hasLan = Boolean(ip);
  const qrValue =
    url && includeKey && hostKey ? `${url}/#k=${hostKey}` : url;

  async function handleCopy() {
    if (!qrValue) return;
    const ok = await writeClipboard(qrValue);
    if (!ok) return;
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  async function handleShare() {
    if (!qrValue || !navigator.share) return;
    try {
      await navigator.share({
        title: "LocalShare",
        text: "Join this LAN share",
        url: qrValue,
      });
    } catch {
      /* user cancelled */
    }
  }

  function chooseIp(next: string) {
    setSelected(next);
    try {
      localStorage.setItem(IP_KEY, next);
    } catch {
      /* ignore */
    }
  }

  async function revealKey() {
    const res = await apiFetch("/api/auth/key");
    if (!res.ok) return;
    const body = (await res.json()) as { key?: string };
    if (typeof body.key === "string") setHostKey(body.key);
  }

  async function copyKey() {
    let value = hostKey;
    if (!value) {
      const res = await apiFetch("/api/auth/key");
      if (!res.ok) return;
      const body = (await res.json()) as { key?: string };
      if (typeof body.key !== "string") return;
      value = body.key;
      setHostKey(value);
    }
    const ok = await writeClipboard(value);
    if (!ok) return;
    setKeyCopied(true);
    window.setTimeout(() => setKeyCopied(false), 1600);
  }

  function toggleIncludeKey(next: boolean) {
    setIncludeKey(next);
    try {
      localStorage.setItem(QR_KEY_TOGGLE, next ? "1" : "0");
    } catch {
      /* ignore */
    }
    if (next && !hostKey) void revealKey();
  }

  const masked =
    hostKey && !keyVisible
      ? `${hostKey.slice(0, 4)}${"•".repeat(24)}${hostKey.slice(-4)}`
      : hostKey;

  return (
    <section className="rounded-2xl border border-line bg-panel p-4 shadow-sm dark:border-line-dark dark:bg-panel-dark sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand dark:text-brand-glow">
            Connect
          </p>
          <h2 className="mt-1 font-display text-xl font-bold tracking-tight">
            Open this on another device
          </h2>
        </div>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="inline-flex size-11 items-center justify-center rounded-full border border-line dark:border-line-dark"
          aria-expanded={open}
          aria-label={open ? "Collapse connect card" : "Expand connect card"}
        >
          {open ? <ChevronsUp className="size-4" /> : <ChevronsDown className="size-4" />}
        </button>
      </div>

      {open ? (
        <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-stretch">
          <div className="flex size-[176px] shrink-0 items-center justify-center self-center rounded-xl bg-white p-3 sm:self-auto">
            {qrValue ? (
              <QRCodeSVG
                value={qrValue}
                size={152}
                level="M"
                marginSize={4}
                bgColor="#ffffff"
                fgColor="#111111"
                title="QR code for this LocalShare URL"
              />
            ) : (
              <p className="px-2 text-center text-xs text-quiet">No LAN address yet</p>
            )}
          </div>

          <div className="flex min-w-0 flex-1 flex-col justify-center gap-3">
            {hasLan && url ? (
              <>
                <p className="text-sm text-quiet dark:text-quiet-dark">
                  Same Wi-Fi. Scan the QR or copy the address — it uses this
                  page&apos;s port so phones hit the UI, not just the API.
                </p>
                <p className="break-all font-display text-lg font-bold sm:text-xl">
                  {url}
                </p>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={handleCopy}
                    className="inline-flex min-h-11 items-center gap-1.5 rounded-lg bg-brand px-3 text-sm font-medium text-white"
                  >
                    {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
                    {copied ? "Copied" : "Copy"}
                  </button>
                  {canShare ? (
                    <button
                      type="button"
                      onClick={handleShare}
                      className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-line px-3 text-sm font-medium dark:border-line-dark"
                    >
                      <Share2 className="size-4" />
                      Share
                    </button>
                  ) : null}
                </div>
                {info && info.ips.length > 1 ? (
                  <label className="block text-xs text-quiet dark:text-quiet-dark">
                    Not working? Try another network address
                    <select
                      value={selected ?? ""}
                      onChange={(e) => chooseIp(e.target.value)}
                      className="mt-1 min-h-11 w-full rounded-lg border border-line bg-canvas px-2 py-2 text-base text-ink dark:border-line-dark dark:bg-canvas-dark dark:text-ink-dark"
                    >
                      {info.ips.map((row) => (
                        <option key={`${row.iface}-${row.address}`} value={row.address}>
                          {row.address} ({row.iface})
                        </option>
                      ))}
                    </select>
                  </label>
                ) : null}

                {isHost ? (
                  <div className="rounded-xl border border-line p-3 dark:border-line-dark">
                    <p className="text-xs font-semibold uppercase tracking-wide text-quiet dark:text-quiet-dark">
                      Host controls
                    </p>
                    {hostKey ? (
                      <p className="mt-2 break-all font-mono text-sm">{masked}</p>
                    ) : (
                      <button
                        type="button"
                        onClick={() => void revealKey()}
                        className="mt-2 inline-flex min-h-11 items-center rounded-lg border border-line px-3 text-sm font-medium dark:border-line-dark"
                      >
                        Reveal access key
                      </button>
                    )}
                    {hostKey ? (
                      <div className="mt-2 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => setKeyVisible((v) => !v)}
                          className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-line px-3 text-sm dark:border-line-dark"
                        >
                          {keyVisible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                          {keyVisible ? "Hide" : "Reveal"}
                        </button>
                        <button
                          type="button"
                          onClick={() => void copyKey()}
                          className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-line px-3 text-sm dark:border-line-dark"
                        >
                          {keyCopied ? <Check className="size-4" /> : <Copy className="size-4" />}
                          {keyCopied ? "Copied" : "Copy"}
                        </button>
                      </div>
                    ) : null}
                    <label className="mt-3 flex items-start gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={includeKey}
                        onChange={(e) => toggleIncludeKey(e.target.checked)}
                        className="mt-1 size-4"
                      />
                      <span>
                        Include access key in QR code
                        {includeKey ? (
                          <span className="mt-1 block text-xs text-down">
                            Anyone who sees this QR can join.
                          </span>
                        ) : null}
                      </span>
                    </label>
                  </div>
                ) : (
                  <p className="text-sm text-quiet dark:text-quiet-dark">
                    Ask the host for the access key.
                  </p>
                )}
              </>
            ) : (
              <div className="text-sm text-quiet dark:text-quiet-dark">
                <p className="font-medium text-ink dark:text-ink-dark">
                  No LAN IP detected
                </p>
                <ul className="mt-2 list-disc space-y-1 pl-4">
                  <li>Connect this computer to Wi-Fi (not only a VPN or virtual adapter).</li>
                  <li>
                    Allow Node.js through the OS firewall on private networks, and open the
                    page port.
                  </li>
                  <li>
                    Turn off AP/client isolation on the router if phones cannot see the PC.
                  </li>
                </ul>
                {error ? <p className="mt-2">{error}</p> : null}
              </div>
            )}
          </div>
        </div>
      ) : null}
    </section>
  );
}
