import { FolderUp } from "lucide-react";
import { useCallback, useEffect, useRef } from "react";
import { useDeviceName } from "../lib/identity.ts";
import { useSocket } from "../lib/socket.ts";
import { useToast } from "../lib/toast.tsx";
import { useUploadQueue } from "../lib/upload.ts";
import { DropZone } from "./files/DropZone.tsx";
import { FileGallery } from "./files/FileGallery.tsx";
import { UploadList } from "./files/UploadList.tsx";

export function FilesPanel() {
  const { toast } = useToast();
  const { connected } = useSocket();
  const { name } = useDeviceName();
  const { items, enqueue, cancel, retry, dismiss } = useUploadQueue(name);
  const pendingIds = useRef(new Set<string>());
  const successCount = useRef(0);
  const prevStatus = useRef(new Map<string, string>());

  const onError = useCallback(
    (message: string) => toast(message, "error"),
    [toast],
  );

  const onFiles = useCallback(
    (files: File[]) => {
      if (!connected) {
        toast("Disconnected");
        return;
      }
      const ids = enqueue(files);
      for (const id of ids) pendingIds.current.add(id);
    },
    [connected, enqueue, toast],
  );

  useEffect(() => {
    let newlyDone = 0;
    for (const item of items) {
      const prev = prevStatus.current.get(item.id);
      if (prev === item.status) continue;
      prevStatus.current.set(item.id, item.status);
      if (!pendingIds.current.has(item.id)) continue;
      if (item.status === "done") {
        newlyDone += 1;
        pendingIds.current.delete(item.id);
      } else if (item.status === "error" || item.status === "cancelled") {
        pendingIds.current.delete(item.id);
        if (item.status === "error" && item.error) toast(item.error);
      }
    }
    if (newlyDone) successCount.current += newlyDone;
    if (pendingIds.current.size === 0 && successCount.current > 0) {
      const n = successCount.current;
      successCount.current = 0;
      toast(n === 1 ? "1 file shared" : `${n} files shared`, "success");
    }
  }, [items, toast]);

  return (
    <section className="flex min-h-[320px] flex-col rounded-2xl border border-line bg-panel p-5 shadow-sm dark:border-line-dark dark:bg-panel-dark lg:min-h-full">
      <div className="flex items-center gap-2">
        <FolderUp className="size-4 text-brand dark:text-brand-glow" />
        <h2 className="font-display text-lg font-bold">Files</h2>
      </div>
      <p className="mt-1 text-sm text-quiet dark:text-quiet-dark">
        Drop anything — photos, videos, zips. Stays on this LAN.
      </p>

      <div className="mt-4">
        <DropZone disabled={!connected} onFiles={onFiles} />
      </div>

      <div className="mt-3">
        <UploadList
          items={items}
          onCancel={cancel}
          onRetry={retry}
          onDismiss={dismiss}
        />
      </div>

      <div className="mt-4 flex min-h-0 flex-1 flex-col">
        <FileGallery onError={onError} />
      </div>
    </section>
  );
}
