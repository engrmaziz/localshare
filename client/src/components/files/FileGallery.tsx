import { FolderOpen, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { FileMeta } from "@shared/types";
import { apiFetch } from "../../lib/auth.ts";
import { isImagePreview } from "../../lib/fileKind.ts";
import { formatBytes } from "../../lib/formatBytes.ts";
import { socket } from "../../lib/socket.ts";
import { FileCard } from "./FileCard.tsx";
import { Lightbox } from "./Lightbox.tsx";

type SortKey = "newest" | "oldest" | "name" | "size";

type FileGalleryProps = {
  onError: (message: string) => void;
};

export function FileGallery({ onError }: FileGalleryProps) {
  const [files, setFiles] = useState<FileMeta[]>([]);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("newest");
  const [now, setNow] = useState(() => Date.now());
  const [lightbox, setLightbox] = useState<number | null>(null);

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 15_000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const res = await apiFetch("/api/files");
        if (res.status === 401) return;
        if (!res.ok) throw new Error("list failed");
        const body = (await res.json()) as FileMeta[];
        if (!cancelled) setFiles(Array.isArray(body) ? body : []);
      } catch {
        if (!cancelled) onError("Couldn't load shared files");
      }
    }

    void load();

    const onAdded = (added: FileMeta[]) => {
      setFiles((current) => {
        const seen = new Set(current.map((row) => row.id));
        const fresh = added.filter((row) => !seen.has(row.id));
        return fresh.length ? [...fresh, ...current] : current;
      });
    };
    const onRemoved = ({ id }: { id: string }) => {
      setFiles((current) => current.filter((row) => row.id !== id));
    };

    socket.on("files:added", onAdded);
    socket.on("files:removed", onRemoved);
    socket.on("connect", load);
    return () => {
      cancelled = true;
      socket.off("files:added", onAdded);
      socket.off("files:removed", onRemoved);
      socket.off("connect", load);
    };
  }, [onError]);

  const images = useMemo(
    () => files.filter((row) => isImagePreview(row.mimeType)),
    [files],
  );

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = q
      ? files.filter((row) => row.originalName.toLowerCase().includes(q))
      : files.slice();
    filtered.sort((a, b) => {
      if (sort === "oldest") return a.uploadedAt - b.uploadedAt;
      if (sort === "name") return a.originalName.localeCompare(b.originalName);
      if (sort === "size") return b.size - a.size;
      return b.uploadedAt - a.uploadedAt;
    });
    return filtered;
  }, [files, query, sort]);

  const totalBytes = files.reduce((sum, row) => sum + row.size, 0);

  function openLightbox(id: string) {
    const index = images.findIndex((row) => row.id === id);
    if (index >= 0) setLightbox(index);
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-xs text-quiet dark:text-quiet-dark">
          {files.length} {files.length === 1 ? "file" : "files"} · {formatBytes(totalBytes)}
        </p>
        <label className="relative min-w-[8rem] flex-1">
          <Search className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-quiet dark:text-quiet-dark" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter by name"
            className="w-full min-h-11 rounded-lg border border-line bg-canvas py-2 pl-7 pr-2 text-base outline-none focus:border-brand dark:border-line-dark dark:bg-canvas-dark dark:focus:border-brand-glow sm:min-h-0 sm:py-1.5 sm:text-xs"
          />
        </label>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as SortKey)}
          className="min-h-11 rounded-lg border border-line bg-canvas px-2 py-1.5 text-base outline-none dark:border-line-dark dark:bg-canvas-dark sm:min-h-0 sm:text-xs"
          aria-label="Sort files"
        >
          <option value="newest">Newest</option>
          <option value="oldest">Oldest</option>
          <option value="name">Name</option>
          <option value="size">Size</option>
        </select>
      </div>

      {visible.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center rounded-xl border border-dashed border-line px-4 py-10 text-center dark:border-line-dark">
          <FolderOpen className="size-10 text-brand/70 dark:text-brand-glow/70" />
          <p className="mt-2 font-display font-bold">Nothing shared yet</p>
          <p className="mt-1 max-w-xs text-sm text-quiet dark:text-quiet-dark">
            {query
              ? "No files match that name."
              : "Drop a photo, video, or document above. Everyone on this Wi-Fi will see it."}
          </p>
        </div>
      ) : (
        <div className="grid max-h-[28rem] grid-cols-1 gap-3 overflow-y-auto sm:grid-cols-2">
          {visible.map((file) => (
            <FileCard
              key={file.id}
              file={file}
              now={now}
              onPreview={
                isImagePreview(file.mimeType) ? () => openLightbox(file.id) : undefined
              }
              onDeleted={(id) => setFiles((current) => current.filter((row) => row.id !== id))}
              onError={onError}
            />
          ))}
        </div>
      )}

      {lightbox != null ? (
        <Lightbox
          images={images}
          index={lightbox}
          onClose={() => setLightbox(null)}
          onIndex={setLightbox}
        />
      ) : null}
    </div>
  );
}
