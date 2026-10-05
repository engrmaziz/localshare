export function mimeBase(mimeType: string): string {
  return mimeType.toLowerCase().split(";")[0]?.trim() ?? "";
}

export function isImagePreview(mimeType: string): boolean {
  const mime = mimeBase(mimeType);
  return mime.startsWith("image/") && mime !== "image/svg+xml";
}

export function isVideoPreview(mimeType: string): boolean {
  return mimeBase(mimeType).startsWith("video/");
}

export function isAudioPreview(mimeType: string): boolean {
  return mimeBase(mimeType).startsWith("audio/");
}

export function isPreviewable(mimeType: string): boolean {
  const mime = mimeBase(mimeType);
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

export type FileKind = "pdf" | "doc" | "sheet" | "zip" | "code" | "image" | "video" | "audio" | "generic";

export function fileKind(mimeType: string, name: string): FileKind {
  const mime = mimeBase(mimeType);
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("video/")) return "video";
  if (mime.startsWith("audio/")) return "audio";
  if (mime === "application/pdf" || ext === "pdf") return "pdf";
  if (
    mime.includes("spreadsheet") ||
    mime.includes("excel") ||
    ["xls", "xlsx", "csv", "ods"].includes(ext)
  ) {
    return "sheet";
  }
  if (
    mime.includes("zip") ||
    mime.includes("compressed") ||
    mime.includes("tar") ||
    ["zip", "rar", "7z", "tar", "gz", "tgz"].includes(ext)
  ) {
    return "zip";
  }
  if (
    mime.includes("javascript") ||
    mime.includes("json") ||
    mime.startsWith("text/") ||
    ["js", "ts", "tsx", "jsx", "py", "go", "rs", "java", "c", "cpp", "h", "json", "html", "css", "md", "sh"].includes(ext)
  ) {
    return "code";
  }
  if (
    mime.includes("word") ||
    mime.includes("document") ||
    ["doc", "docx", "rtf", "odt", "txt"].includes(ext)
  ) {
    return "doc";
  }
  return "generic";
}
