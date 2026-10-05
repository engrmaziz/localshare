import { useCallback, useEffect, useRef, useState } from "react";
import type { FileMeta } from "@shared/types";

export type UploadProgress = {
  loaded: number;
  total: number;
  percent: number;
  bytesPerSecond: number;
  etaSeconds: number;
};

export type UploadStatus = "queued" | "uploading" | "done" | "error" | "cancelled";

export type UploadItem = {
  id: string;
  file: File;
  status: UploadStatus;
  progress: UploadProgress;
  error?: string;
};

const SPEED_ALPHA = 0.25;
const CONCURRENCY = 2;

export class UploadError extends Error {
  status: number | null;

  constructor(message: string, status: number | null = null) {
    super(message);
    this.name = "UploadError";
    this.status = status;
  }
}

function emptyProgress(total: number): UploadProgress {
  return { loaded: 0, total, percent: 0, bytesPerSecond: 0, etaSeconds: 0 };
}

function messageForStatus(status: number): string {
  if (status === 413) return "File too large";
  if (status === 507) return "Disk full";
  if (status === 0) return "Network error";
  return `Upload failed (${status})`;
}

export function uploadFile(
  file: File,
  options: {
    deviceName: string;
    onProgress?: (progress: UploadProgress) => void;
    signal?: AbortSignal;
  },
): Promise<FileMeta[]> {
  const { deviceName, onProgress, signal } = options;

  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new UploadError("Upload cancelled"));
      return;
    }

    const xhr = new XMLHttpRequest();
    const form = new FormData();
    form.append("files", file, file.name);

    let lastAt = Date.now();
    let lastLoaded = 0;
    let speed = 0;

    const onAbort = () => {
      xhr.abort();
    };
    signal?.addEventListener("abort", onAbort);

    xhr.upload.onprogress = (event) => {
      const now = Date.now();
      const dt = (now - lastAt) / 1000;
      const loaded = event.loaded;
      const total = event.lengthComputable ? event.total : file.size;
      if (dt > 0.05) {
        const inst = Math.max(0, (loaded - lastLoaded) / dt);
        speed = speed === 0 ? inst : speed * (1 - SPEED_ALPHA) + inst * SPEED_ALPHA;
        lastAt = now;
        lastLoaded = loaded;
      }
      const percent = total > 0 ? Math.min(100, (loaded / total) * 100) : 0;
      const remaining = Math.max(0, total - loaded);
      onProgress?.({
        loaded,
        total,
        percent,
        bytesPerSecond: speed,
        etaSeconds: speed > 0 ? remaining / speed : 0,
      });
    };

    xhr.onload = () => {
      signal?.removeEventListener("abort", onAbort);
      if (xhr.status === 201) {
        try {
          const body: unknown = JSON.parse(xhr.responseText || "[]");
          resolve(Array.isArray(body) ? (body as FileMeta[]) : []);
        } catch {
          reject(new UploadError("Could not read the server response", xhr.status));
        }
        return;
      }
      let detail = messageForStatus(xhr.status);
      try {
        const body: unknown = JSON.parse(xhr.responseText);
        if (body && typeof body === "object" && "error" in body) {
          const err = (body as { error: unknown }).error;
          if (typeof err === "string" && err.trim()) detail = err;
        }
      } catch {
        /* keep detail */
      }
      reject(new UploadError(detail, xhr.status));
    };

    xhr.onerror = () => {
      signal?.removeEventListener("abort", onAbort);
      reject(new UploadError("Network error", 0));
    };

    xhr.onabort = () => {
      signal?.removeEventListener("abort", onAbort);
      reject(new UploadError("Upload cancelled"));
    };

    xhr.open("POST", "/api/files");
    xhr.setRequestHeader("x-device-name", deviceName);
    xhr.send(form);
  });
}

export function useUploadQueue(deviceName: string) {
  const [items, setItems] = useState<UploadItem[]>([]);
  const itemsRef = useRef<UploadItem[]>([]);
  const controllers = useRef(new Map<string, AbortController>());
  const inflight = useRef(0);

  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  const patch = useCallback((id: string, update: Partial<UploadItem>) => {
    setItems((current) =>
      current.map((row) => (row.id === id ? { ...row, ...update } : row)),
    );
  }, []);

  const pump = useCallback(() => {
    const list = itemsRef.current;
    if (inflight.current >= CONCURRENCY) return;
    const next = list.find(
      (row) => row.status === "queued" && !controllers.current.has(row.id),
    );
    if (!next) return;

    inflight.current += 1;
    const controller = new AbortController();
    controllers.current.set(next.id, controller);
    itemsRef.current = itemsRef.current.map((row) =>
      row.id === next.id ? { ...row, status: "uploading" as const } : row,
    );
    patch(next.id, { status: "uploading", error: undefined });
    queueMicrotask(pump);

    void uploadFile(next.file, {
      deviceName,
      signal: controller.signal,
      onProgress: (progress) => patch(next.id, { progress }),
    })
      .then(() => {
        patch(next.id, {
          status: "done",
          progress: { ...emptyProgress(next.file.size), loaded: next.file.size, percent: 100 },
        });
        window.setTimeout(() => {
          setItems((current) =>
            current.filter((row) => !(row.id === next.id && row.status === "done")),
          );
        }, 3000);
      })
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : "Upload failed";
        const cancelled = message === "Upload cancelled";
        patch(next.id, {
          status: cancelled ? "cancelled" : "error",
          error: cancelled ? undefined : message,
        });
      })
      .finally(() => {
        controllers.current.delete(next.id);
        inflight.current = Math.max(0, inflight.current - 1);
        queueMicrotask(pump);
      });
  }, [deviceName, patch]);

  useEffect(() => {
    pump();
  }, [items, pump]);

  useEffect(() => {
    const onLeave = (event: BeforeUnloadEvent) => {
      const busy = itemsRef.current.some(
        (row) => row.status === "queued" || row.status === "uploading",
      );
      if (!busy) return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", onLeave);
    return () => window.removeEventListener("beforeunload", onLeave);
  }, []);

  const enqueue = useCallback((files: File[]) => {
    if (files.length === 0) return [] as string[];
    const added: UploadItem[] = files.map((file) => ({
      id: crypto.randomUUID(),
      file,
      status: "queued",
      progress: emptyProgress(file.size),
    }));
    setItems((current) => [...current, ...added]);
    return added.map((row) => row.id);
  }, []);

  const cancel = useCallback((id: string) => {
    controllers.current.get(id)?.abort();
    setItems((current) =>
      current.map((row) =>
        row.id === id && (row.status === "queued" || row.status === "uploading")
          ? { ...row, status: "cancelled" }
          : row,
      ),
    );
  }, []);

  const retry = useCallback((id: string) => {
    setItems((current) =>
      current.map((row) =>
        row.id === id && (row.status === "error" || row.status === "cancelled")
          ? { ...row, status: "queued", error: undefined, progress: emptyProgress(row.file.size) }
          : row,
      ),
    );
  }, []);

  const dismiss = useCallback((id: string) => {
    controllers.current.get(id)?.abort();
    setItems((current) => current.filter((row) => row.id !== id));
  }, []);

  const clearFinished = useCallback(() => {
    setItems((current) =>
      current.filter((row) => row.status !== "done" && row.status !== "cancelled"),
    );
  }, []);

  const activeCount = items.filter(
    (row) => row.status === "queued" || row.status === "uploading",
  ).length;

  return { items, enqueue, cancel, retry, dismiss, clearFinished, activeCount };
}
