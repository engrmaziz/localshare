import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { useEffect, useRef } from "react";
import type { FileMeta } from "@shared/types";

type LightboxProps = {
  images: FileMeta[];
  index: number;
  onClose: () => void;
  onIndex: (index: number) => void;
};

export function Lightbox({ images, index, onClose, onIndex }: LightboxProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const current = images[index];

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    dialogRef.current?.focus();

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        onIndex((index - 1 + images.length) % images.length);
        return;
      }
      if (event.key === "ArrowRight") {
        event.preventDefault();
        onIndex((index + 1) % images.length);
        return;
      }
      if (event.key !== "Tab" || !dialogRef.current) return;
      const focusable = [
        ...dialogRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        ),
      ].filter((el) => !el.hasAttribute("disabled"));
      if (focusable.length === 0) {
        event.preventDefault();
        return;
      }
      const first = focusable[0]!;
      const last = focusable[focusable.length - 1]!;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      previouslyFocused?.focus();
    };
  }, [images.length, index, onClose, onIndex]);

  if (!current) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={current.originalName}
        tabIndex={-1}
        className="relative flex max-h-full max-w-5xl flex-col outline-none"
        onClick={(event) => event.stopPropagation()}
      >
        <img
          src={`/files/${current.id}/raw`}
          alt={current.originalName}
          className="max-h-[80vh] max-w-full rounded-lg object-contain"
        />
        <p className="mt-2 truncate text-center text-sm text-white/80" title={current.originalName}>
          {current.originalName}
        </p>
        <button
          type="button"
          onClick={onClose}
          className="absolute -right-2 -top-2 rounded-full bg-black/70 p-2 text-white"
          aria-label="Close preview"
        >
          <X className="size-4" />
        </button>
        {images.length > 1 ? (
          <>
            <button
              type="button"
              onClick={() => onIndex((index - 1 + images.length) % images.length)}
              className="absolute left-0 top-1/2 -translate-y-1/2 rounded-full bg-black/70 p-2 text-white"
              aria-label="Previous image"
            >
              <ChevronLeft className="size-5" />
            </button>
            <button
              type="button"
              onClick={() => onIndex((index + 1) % images.length)}
              className="absolute right-0 top-1/2 -translate-y-1/2 rounded-full bg-black/70 p-2 text-white"
              aria-label="Next image"
            >
              <ChevronRight className="size-5" />
            </button>
          </>
        ) : null}
      </div>
    </div>
  );
}
