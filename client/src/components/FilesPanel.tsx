import { FolderUp } from "lucide-react";

export function FilesPanel() {
  return (
    <section className="flex min-h-[280px] flex-col rounded-2xl border border-line bg-panel p-5 shadow-sm dark:border-line-dark dark:bg-panel-dark lg:min-h-full">
      <div className="flex items-center gap-2">
        <FolderUp className="size-4 text-brand dark:text-brand-glow" />
        <h2 className="font-display text-lg font-bold">Files</h2>
      </div>
      <p className="mt-1 text-sm text-quiet dark:text-quiet-dark">
        Phases 3–4 — drop files here, download them from any device.
      </p>
      <div className="mt-4 flex flex-1 items-center justify-center rounded-xl border border-dashed border-line bg-canvas/60 text-sm text-quiet dark:border-line-dark dark:bg-canvas-dark/40 dark:text-quiet-dark">
        Uploads not wired yet
      </div>
    </section>
  );
}
