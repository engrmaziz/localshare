import { Check, Copy, Download, ExternalLink, Trash2 } from "lucide-react";
import { useState } from "react";
import type { FileMeta } from "@shared/types";
import { writeClipboard } from "../../lib/clipboard.ts";
import {
  isAudioPreview,
  isImagePreview,
  isPreviewable,
  isVideoPreview,
} from "../../lib/fileKind.ts";
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
      const res = await fetch(`/api/files/${file.id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok && res.status !== 204) {
        throw new Error("Delete failed");
      }
      onDeleted(file.id);
    } catch {
      onError(`Couldn't delete ${file.originalName}`);
      setBusy(false);
      setConfirming(false);
    }
  }

  return (
    <article className="flex flex-col overflow-hidden rounded-xl border border-line bg-canvas/70 dark:border-line-dark dark:bg-canvas-dark/50">
      <div className="relative flex aspect-video items-center justify-center bg-canvas dark:bg-canvas-dark">
        {image ? (
          <button
            type="button"
            onClick={onPreview}
            className="size-full"
            aria-label={`Preview ${file.originalName}`}
            title="Open preview"
          >
            <img
              src={rawUrl}
              alt={file.originalName}
              loading="lazy"
              className="size-full object-cover"
            />
          </button>
        ) : isVideoPreview(file.mimeType) ? (
          <video
            src={`${rawUrl}#t=0.1`}
            preload="metadata"
            controls
            className="size-full object-contain"
          />
        ) : isAudioPreview(file.mimeType) ? (
          <audio src={rawUrl} controls className="w-full px-3" />
        ) : (
          <FileTypeIcon
            mimeType={file.mimeType}
            name={file.originalName}
            className="size-10 text-brand dark:text-brand-glow"
          />
        )}
      </div>

      <div className="flex flex-1 flex-col gap-1 p-3">
        <h3 className="truncate text-sm font-medium" title={file.originalName}>
          {file.originalName}
        </h3>
        <p className="text-[11px] text-quiet dark:text-quiet-dark">
          {formatBytes(file.size)} · {file.uploader} · {formatRelativeTime(file.uploadedAt, now)}
        </p>
        <div className="mt-2 flex flex-wrap gap-1">
          <a
            href={downloadUrl}
            download={file.originalName}
            className="inline-flex min-h-11 items-center gap-1 rounded-lg border border-line px-2 py-1 text-[11px] font-medium hover:bg-panel dark:border-line-dark dark:hover:bg-panel-dark"
          >
            <Download className="size-3" />
            Download
          </a>
          <button
            type="button"
            onClick={copyLink}
            className="inline-flex min-h-11 items-center gap-1 rounded-lg border border-line px-2 py-1 text-[11px] font-medium hover:bg-panel dark:border-line-dark dark:hover:bg-panel-dark"
          >
            {copied ? <Check className="size-3" /> : <Copy className="size-3" />}
            {copied ? "Copied" : "Copy link"}
          </button>
          {previewable ? (
            <a
              href={rawUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-11 items-center gap-1 rounded-lg border border-line px-2 py-1 text-[11px] font-medium hover:bg-panel dark:border-line-dark dark:hover:bg-panel-dark"
            >
              <ExternalLink className="size-3" />
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
            <Trash2 className="size-3" />
            {confirming ? "Confirm?" : "Delete"}
          </button>
        </div>
      </div>
    </article>
  );
}
