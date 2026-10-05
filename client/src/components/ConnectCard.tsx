import { ChevronsDown, ChevronsUp, Copy, Check, Share2 } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { useEffect, useMemo, useState } from "react";
import { writeClipboard } from "../lib/clipboard.ts";

type InfoResponse = {
  ips: { address: string; iface: string }[];
  primaryIp: string;
  port: number;
  url: string;
};

const IP_KEY = "localshare.preferredIp";

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
  const [info, setInfo] = useState<InfoResponse | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(defaultOpen);
  const canShare = typeof navigator !== "undefined" && typeof navigator.share === "function";

  useEffect(() => {
    let cancelled = false;
    fetch("/api/info", { credentials: "include" })
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

  async function handleCopy() {
    if (!url) return;
    const ok = await writeClipboard(url);
    if (!ok) return;
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  async function handleShare() {
    if (!url || !navigator.share) return;
    try {
      await navigator.share({
        title: "LocalShare",
        text: "Join this LAN share",
        url,
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
            {url ? (
              <QRCodeSVG
                value={url}
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
