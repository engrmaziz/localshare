import { Check, Copy, Download, ExternalLink, Trash2 } from "lucide-react";
import { useState } from "react";
import type { FileMeta } from "@shared/types";
import { writeClipboard } from "../../lib/clipboard.ts";
import { apiFetch } from "../../lib/auth.ts";
import { isImagePreview, isPreviewable } from "../../lib/fileKind.ts";
import { formatBytes } from "../../lib/formatBytes.ts";
import { formatRelativeTime } from "../../lib/time.ts";
import { FileTypeIcon } from "./UploadList.tsx";

type FileCardProps = {
  file: FileMeta;
  now: number;
  onPreview?: () => void;
  onDeleted: (id: string) => void;
  onError: (message: string) => void;
};

export function FileCard({ file, now, onPreview, onDeleted, onError }: FileCardProps) {
  const [copied, setCopied] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const downloadUrl = `/files/${file.id}/download`;
  const rawUrl = `/files/${file.id}/raw`;
  const previewable = isPreviewable(file.mimeType);
  const image = isImagePreview(file.mimeType);
  const name = file.originalName.trim() || file.storedName || "Untitled file";

  async function copyLink() {
    const absolute = `${window.location.origin}${downloadUrl}`;
    const ok = await writeClipboard(absolute);
    if (!ok) {
      onError("Couldn't copy the link");
      return;
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  }

  async function remove() {
    if (!confirming) {
      setConfirming(true);
      return;
    }
    setBusy(true);
    try {
      const res = await apiFetch(`/api/files/${file.id}`, {
        method: "DELETE",
      });
      if (res.status === 401) return;
      if (!res.ok && res.status !== 204) {
        throw new Error("Delete failed");
      }
      onDeleted(file.id);
    } catch {
      onError(`Couldn't delete ${name}`);
      setBusy(false);
      setConfirming(false);
    }
  }

  return (
    <article className="flex min-w-0 gap-3 rounded-xl border border-line bg-canvas/70 p-3 dark:border-line-dark dark:bg-canvas-dark/50">
      {image ? (
        <button
          type="button"
          onClick={onPreview}
          className="size-14 shrink-0 overflow-hidden rounded-lg bg-canvas dark:bg-canvas-dark"
          aria-label={`Preview ${name}`}
          title="Open preview"
        >
          <img src={rawUrl} alt="" className="size-full object-cover" loading="lazy" />
        </button>
      ) : (
        <div className="flex size-14 shrink-0 items-center justify-center rounded-lg bg-canvas dark:bg-canvas-dark">
          <FileTypeIcon
            mimeType={file.mimeType}
            name={name}
            className="size-7 text-brand dark:text-brand-glow"
          />
        </div>
      )}

      <div className="min-w-0 flex-1">
        <h3 className="text-sm font-semibold leading-snug [overflow-wrap:anywhere]" title={name}>
          {name}
        </h3>
        <p className="mt-0.5 text-[11px] text-quiet dark:text-quiet-dark">
          {formatBytes(file.size)} · {file.uploader} · {formatRelativeTime(file.uploadedAt, now)}
        </p>
        <div className="mt-2 flex flex-wrap gap-1">
          <a
            href={downloadUrl}
            download={name}
            className="inline-flex min-h-11 items-center gap-1 rounded-lg border border-line px-2 py-1 text-[11px] font-medium hover:bg-panel dark:border-line-dark dark:hover:bg-panel-dark"
          >
            <Download className="size-3 shrink-0" />
            Download
          </a>
          <button
            type="button"
            onClick={copyLink}
            className="inline-flex min-h-11 items-center gap-1 rounded-lg border border-line px-2 py-1 text-[11px] font-medium hover:bg-panel dark:border-line-dark dark:hover:bg-panel-dark"
          >
            {copied ? <Check className="size-3 shrink-0" /> : <Copy className="size-3 shrink-0" />}
            {copied ? "Copied" : "Copy"}
          </button>
          {previewable ? (
            <a
              href={rawUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-11 items-center gap-1 rounded-lg border border-line px-2 py-1 text-[11px] font-medium hover:bg-panel dark:border-line-dark dark:hover:bg-panel-dark"
            >
              <ExternalLink className="size-3 shrink-0" />
              Open
            </a>
          ) : null}
          <button
            type="button"
            disabled={busy}
            onClick={remove}
            onBlur={() => {
              if (!busy) setConfirming(false);
            }}
            className={`inline-flex min-h-11 items-center gap-1 rounded-lg border px-2 py-1 text-[11px] font-medium ${
              confirming
                ? "border-down bg-down text-white"
                : "border-line hover:bg-panel dark:border-line-dark dark:hover:bg-panel-dark"
            }`}
          >
            <Trash2 className="size-3 shrink-0" />
            {confirming ? "Confirm?" : "Delete"}
          </button>
        </div>
      </div>
    </article>
  );
}
