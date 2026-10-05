import path from "node:path";
import { MAX_SENDER_LEN } from "@shared/types";

export function decodeOriginalName(name: string): string {
  const recoded = Buffer.from(name, "latin1").toString("utf8");
  // Multer 1.x stores UTF-8 bytes as latin1. Multer 2 / busboy may already
  // give a real Unicode string; recoding that would produce U+FFFD.
  if (recoded.includes("\uFFFD")) return name;
  return recoded;
}

export function originalBasename(name: string): string {
  const decoded = decodeOriginalName(name);
  const base = path.posix.basename(decoded.replace(/\\/g, "/"));
  return base || "file";
}

export function safeExtension(originalName: string): string {
  const ext = path.extname(originalBasename(originalName)).toLowerCase();
  if (/^\.[a-z0-9]{1,15}$/.test(ext)) return ext;
  return "";
}

export function sanitizeUploader(raw: string | undefined): string {
  if (!raw) return "Anonymous";
  const trimmed = raw.trim().slice(0, MAX_SENDER_LEN);
  return trimmed || "Anonymous";
}

export function contentDispositionHeader(
  kind: "inline" | "attachment",
  filename: string,
): string {
  const fallback =
    filename
      .replace(/[^\x20-\x7E]+/g, "_")
      .replace(/["\\]/g, "_")
      .replace(/;/g, "_")
      .trim() || "file";
  const encoded = encodeURIComponent(filename).replace(
    /[!'()*]/g,
    (ch) => `%${ch.charCodeAt(0).toString(16).toUpperCase()}`,
  );
  return `${kind}; filename="${fallback}"; filename*=UTF-8''${encoded}`;
}

export function isPreviewableMime(mimeType: string): boolean {
  const mime = mimeType.toLowerCase().split(";")[0]?.trim() ?? "";
  if (
    mime === "image/svg+xml" ||
    mime === "text/html" ||
    mime === "application/xhtml+xml" ||
    mime.startsWith("text/html")
  ) {
    return false;
  }
  return (
    mime.startsWith("image/") ||
    mime.startsWith("video/") ||
    mime.startsWith("audio/") ||
    mime === "application/pdf" ||
    mime === "text/plain"
  );
}
