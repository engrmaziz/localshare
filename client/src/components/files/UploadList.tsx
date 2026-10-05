import {
  File as FileIcon,
  FileArchive,
  FileAudio,
  FileCode2,
  FileImage,
  FileSpreadsheet,
  FileText,
  FileVideo,
  RotateCcw,
  X,
} from "lucide-react";
import type { FileKind } from "../../lib/fileKind.ts";
import { fileKind } from "../../lib/fileKind.ts";
import { formatBytes, formatEta } from "../../lib/formatBytes.ts";
import type { UploadItem } from "../../lib/upload.ts";

function KindIcon({ kind, className }: { kind: FileKind; className?: string }) {
  const cls = className ?? "size-4";
  switch (kind) {
    case "pdf":
    case "doc":
      return <FileText className={cls} />;
    case "sheet":
      return <FileSpreadsheet className={cls} />;
    case "zip":
      return <FileArchive className={cls} />;
    case "code":
      return <FileCode2 className={cls} />;
    case "image":
      return <FileImage className={cls} />;
    case "video":
      return <FileVideo className={cls} />;
    case "audio":
      return <FileAudio className={cls} />;
    default:
      return <FileIcon className={cls} />;
  }
}

export function FileTypeIcon({
  mimeType,
  name,
  className,
}: {
  mimeType: string;
  name: string;
  className?: string;
}) {
  return <KindIcon kind={fileKind(mimeType, name)} className={className} />;
}

type UploadListProps = {
  items: UploadItem[];
  onCancel: (id: string) => void;
  onRetry: (id: string) => void;
  onDismiss: (id: string) => void;
};

export function UploadList({ items, onCancel, onRetry, onDismiss }: UploadListProps) {
  if (items.length === 0) return null;

  return (
    <ul className="flex flex-col gap-2">
      {items.map((item) => {
        const { progress } = item;
        const percent = Math.round(progress.percent);
        const busy = item.status === "uploading" || item.status === "queued";
        return (
          <li
            key={item.id}
            className="rounded-xl border border-line bg-canvas/70 px-3 py-2 dark:border-line-dark dark:bg-canvas-dark/50"
          >
            <div className="flex items-center gap-2">
              <FileTypeIcon
                mimeType={item.file.type}
                name={item.file.name}
                className="size-4 shrink-0 text-brand dark:text-brand-glow"
              />
              <span className="min-w-0 flex-1 truncate text-sm" title={item.file.name}>
                {item.file.name}
              </span>
              <span className="shrink-0 text-[11px] text-quiet dark:text-quiet-dark">
                {formatBytes(item.file.size)}
              </span>
              {busy ? (
                <button
                  type="button"
                  onClick={() => onCancel(item.id)}
                  className="rounded p-1 text-quiet hover:text-down dark:text-quiet-dark"
                  aria-label="Cancel upload"
                >
                  <X className="size-4" />
                </button>
              ) : null}
              {item.status === "error" || item.status === "cancelled" ? (
                <>
                  <button
                    type="button"
                    onClick={() => onRetry(item.id)}
                    className="rounded p-1 text-quiet hover:text-ink dark:text-quiet-dark dark:hover:text-ink-dark"
                    aria-label="Retry upload"
                  >
                    <RotateCcw className="size-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onDismiss(item.id)}
                    className="rounded p-1 text-quiet hover:text-down dark:text-quiet-dark"
                    aria-label="Dismiss"
                  >
                    <X className="size-4" />
                  </button>
                </>
              ) : null}
            </div>
            <div
              className="mt-2 h-1.5 overflow-hidden rounded-full bg-line dark:bg-line-dark"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={percent}
              aria-label={`${item.file.name} upload progress`}
            >
              <div
                className={`h-full rounded-full transition-[width] duration-200 ${
                  item.status === "error"
                    ? "bg-down"
                    : item.status === "done"
                      ? "bg-live"
                      : "bg-brand"
                }`}
                style={{ width: `${item.status === "queued" ? 4 : percent}%` }}
              />
            </div>
            <p className="mt-1 text-[11px] text-quiet dark:text-quiet-dark">
              {item.status === "queued"
                ? "Waiting…"
                : item.status === "cancelled"
                  ? "Cancelled"
                  : item.status === "error"
                    ? item.error ?? "Failed"
                    : item.status === "done"
                      ? "Shared"
                      : `${percent}% · ${formatBytes(progress.bytesPerSecond)}/s · ${formatEta(progress.etaSeconds)} left`}
            </p>
          </li>
        );
      })}
    </ul>
  );
}
