import { Upload } from "lucide-react";
import { useCallback, useEffect, useId, useRef, useState, type DragEvent } from "react";

type DropZoneProps = {
  disabled?: boolean;
  onFiles: (files: File[]) => void;
};

const SKIP = new Set([".ds_store", "thumbs.db", "desktop.ini"]);

function shouldKeep(file: File): boolean {
  return file.size >= 0 && !SKIP.has(file.name.toLowerCase());
}

function readFileEntry(entry: FileSystemFileEntry): Promise<File> {
  return new Promise((resolve, reject) => {
    entry.file(resolve, reject);
  });
}

function readAllDirectoryEntries(
  reader: FileSystemDirectoryReader,
): Promise<FileSystemEntry[]> {
  return new Promise((resolve, reject) => {
    const collected: FileSystemEntry[] = [];
    const readBatch = () => {
      reader.readEntries((batch) => {
        if (batch.length === 0) {
          resolve(collected);
          return;
        }
        collected.push(...batch);
        readBatch();
      }, reject);
    };
    readBatch();
  });
}

async function flattenEntry(entry: FileSystemEntry): Promise<File[]> {
  if (entry.isFile) {
    const file = await readFileEntry(entry as FileSystemFileEntry);
    return shouldKeep(file) ? [file] : [];
  }
  if (!entry.isDirectory) return [];
  const children = await readAllDirectoryEntries(
    (entry as FileSystemDirectoryEntry).createReader(),
  );
  const nested = await Promise.all(children.map(flattenEntry));
  return nested.flat();
}

async function filesFromDataTransfer(data: DataTransfer): Promise<File[]> {
  const items = [...data.items];
  if (items.some((item) => typeof item.webkitGetAsEntry === "function")) {
    const entries = items
      .map((item) => item.webkitGetAsEntry())
      .filter((entry): entry is FileSystemEntry => Boolean(entry));
    if (entries.length > 0) {
      const nested = await Promise.all(entries.map(flattenEntry));
      const flat = nested.flat();
      if (flat.length > 0) return flat;
    }
  }
  return [...data.files].filter(shouldKeep);
}

export function DropZone({ disabled, onFiles }: DropZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const inputId = useId();
  const dragDepth = useRef(0);
  const [over, setOver] = useState(false);

  const emit = useCallback(
    (files: File[]) => {
      if (disabled || files.length === 0) return;
      onFiles(files);
    },
    [disabled, onFiles],
  );

  const onDragEnter = (event: DragEvent) => {
    event.preventDefault();
    dragDepth.current += 1;
    if (dragDepth.current === 1) setOver(true);
  };

  const onDragLeave = (event: DragEvent) => {
    event.preventDefault();
    dragDepth.current = Math.max(0, dragDepth.current - 1);
    if (dragDepth.current === 0) setOver(false);
  };

  const onDragOver = (event: DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = disabled ? "none" : "copy";
  };

  const onDrop = async (event: DragEvent) => {
    event.preventDefault();
    dragDepth.current = 0;
    setOver(false);
    if (disabled) return;
    try {
      emit(await filesFromDataTransfer(event.dataTransfer));
    } catch {
      emit([...event.dataTransfer.files].filter(shouldKeep));
    }
  };

  useEffect(() => {
    const onPaste = (event: ClipboardEvent) => {
      if (disabled) return;
      const files = event.clipboardData?.files;
      if (!files || files.length === 0) return;
      const list = [...files].filter(shouldKeep);
      if (list.length === 0) return;
      event.preventDefault();
      emit(list);
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [disabled, emit]);

  return (
    <div
      role="region"
      tabIndex={disabled ? -1 : 0}
      aria-disabled={disabled}
      aria-label="Drop files here, or press Enter or Space to choose files"
      onKeyDown={(event) => {
        if (disabled) return;
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          inputRef.current?.click();
        }
      }}
      onDragEnter={onDragEnter}
      onDragLeave={onDragLeave}
      onDragOver={onDragOver}
      onDrop={onDrop}
      className={`flex min-h-[9.5rem] min-w-0 flex-col items-center justify-center rounded-xl border-2 border-dashed px-4 py-6 text-center transition sm:min-h-[8rem] ${
        over
          ? "border-brand bg-brand/10 dark:border-brand-glow dark:bg-brand/15"
          : "border-line bg-canvas/60 dark:border-line-dark dark:bg-canvas-dark/40"
      } ${disabled ? "opacity-50" : ""}`}
    >
      <input
        id={inputId}
        ref={inputRef}
        type="file"
        multiple
        className="sr-only"
        disabled={disabled}
        onChange={(event) => {
          emit([...event.target.files ?? []].filter(shouldKeep));
          event.target.value = "";
        }}
      />
      <Upload className="size-8 text-brand dark:text-brand-glow" />
      <p className="mt-2 font-display text-base font-bold">
        {over ? "Drop to share" : "Drop files here"}
      </p>
      <p className="mt-1 text-xs text-quiet dark:text-quiet-dark">
        Any type, including folders. Paste images with Ctrl+V / ⌘V.
      </p>
      <label
        htmlFor={inputId}
        className={`mt-3 inline-flex min-h-11 items-center justify-center rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:opacity-90 ${
          disabled ? "pointer-events-none opacity-50" : "cursor-pointer"
        }`}
      >
        Choose files
      </label>
    </div>
  );
}
