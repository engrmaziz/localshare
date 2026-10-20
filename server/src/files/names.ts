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

export function inferMimeType(originalName: string, reportedMime?: string): string {
  const baseMime = (reportedMime ?? "").toLowerCase().split(";")[0]?.trim() ?? "";
  const ext = path.extname(originalBasename(originalName)).toLowerCase();

  if (ext === ".pdf" || baseMime === "application/pdf" || baseMime === "application/x-pdf") {
    return "application/pdf";
  }
  if (!baseMime || baseMime === "application/octet-stream") {
    switch (ext) {
      case ".jpg":
      case ".jpeg":
        return "image/jpeg";
      case ".png":
        return "image/png";
      case ".gif":
        return "image/gif";
      case ".webp":
        return "image/webp";
      case ".svg":
        return "image/svg+xml";
      case ".mp4":
        return "video/mp4";
      case ".webm":
        return "video/webm";
      case ".mp3":
        return "audio/mpeg";
      case ".wav":
        return "audio/wav";
      case ".txt":
        return "text/plain";
      case ".json":
        return "application/json";
      case ".zip":
        return "application/zip";
      default:
        return baseMime || "application/octet-stream";
    }
  }
  return baseMime;
}

export function isPreviewableMime(mimeType: string, filename?: string): boolean {
  const mime = mimeType.toLowerCase().split(";")[0]?.trim() ?? "";
  const ext = filename ? path.extname(originalBasename(filename)).toLowerCase() : "";
  if (
    mime === "image/svg+xml" ||
    mime === "text/html" ||
    mime === "application/xhtml+xml" ||
    mime.startsWith("text/html")
  ) {
    return false;
  }
  if (mime === "application/pdf" || mime === "application/x-pdf" || ext === ".pdf") {
    return true;
  }
  return (
    mime.startsWith("image/") ||
    mime.startsWith("video/") ||
    mime.startsWith("audio/") ||
    mime === "text/plain"
  );
}
