import { Check, Copy, QrCode } from "lucide-react";
import { useEffect, useState } from "react";
import { writeClipboard } from "../lib/clipboard.ts";

type InfoResponse = {
  ips: { address: string; iface: string }[];
  primaryIp: string;
  port: number;
  url: string;
};

export function ConnectCard() {
  const [url, setUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    fetch("/api/info")
      .then(async (res) => {
        if (!res.ok) throw new Error("Could not load network info");
        return res.json() as Promise<InfoResponse>;
      })
      .then((info) => {
        if (!cancelled) setUrl(info.url);
      })
      .catch(() => {
        if (!cancelled) {
          setError("Waiting for the LocalShare server…");
          setUrl(window.location.origin);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  async function handleCopy() {
    if (!url) return;
    const ok = await writeClipboard(url);
    if (!ok) return;
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  return (
    <section className="rounded-2xl border border-line bg-panel p-4 shadow-sm dark:border-line-dark dark:bg-panel-dark sm:p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-stretch">
        <div
          className="flex aspect-square w-full max-w-[148px] shrink-0 items-center justify-center self-center rounded-xl border border-dashed border-line bg-canvas/70 text-quiet dark:border-line-dark dark:bg-canvas-dark/50 dark:text-quiet-dark sm:self-auto"
          aria-label="QR code placeholder"
        >
          <div className="flex flex-col items-center gap-2">
            <QrCode className="size-10 opacity-50" strokeWidth={1.5} />
            <span className="text-[11px] font-medium uppercase tracking-wider">
              QR soon
            </span>
          </div>
        </div>

        <div className="flex min-w-0 flex-1 flex-col justify-center gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand dark:text-brand-glow">
              Connect
            </p>
            <h2 className="mt-1 font-display text-xl font-bold tracking-tight">
              Open this on another device
            </h2>
            <p className="mt-1 text-sm text-quiet dark:text-quiet-dark">
              Same Wi-Fi, no account. Scan the QR in a later phase, or copy the
              network URL now.
            </p>
          </div>

          <div className="flex min-w-0 items-center gap-2">
            <code className="min-w-0 flex-1 truncate rounded-lg border border-line bg-canvas px-3 py-2 text-sm dark:border-line-dark dark:bg-canvas-dark">
              {url ?? "Loading…"}
            </code>
            <button
              type="button"
              onClick={handleCopy}
              disabled={!url}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-brand px-3 py-2 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-50"
            >
              {copied ? (
                <Check className="size-4" />
              ) : (
                <Copy className="size-4" />
              )}
              {copied ? "Copied" : "Copy"}
            </button>
          </div>

          {error ? (
            <p className="text-xs text-quiet dark:text-quiet-dark">{error}</p>
          ) : null}
        </div>
      </div>
    </section>
  );
}
