import { unlink } from "node:fs/promises";
import path from "node:path";
import type { Express, NextFunction, Request, Response } from "express";
import multer, { MulterError } from "multer";
import { nanoid } from "nanoid";
import type { Server } from "socket.io";
import type {
  ClientToServerEvents,
  FileMeta,
  ServerToClientEvents,
} from "@shared/types";
import {
  AUTO_DELETE_HOURS,
  MAX_FILE_SIZE_BYTES,
  UPLOAD_DIR,
} from "../config.ts";
import {
  add,
  get,
  list,
  remove,
  resolveStoredPath,
  storageStats,
} from "./fileStore.ts";
import {
  contentDispositionHeader,
  decodeOriginalName,
  isPreviewableMime,
  originalBasename,
  safeExtension,
  sanitizeUploader,
} from "./names.ts";

type Io = Server<ClientToServerEvents, ServerToClientEvents>;

type UploadRequest = Request & {
  _uploadPaths?: string[];
  _disarmAbort?: () => void;
};

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, UPLOAD_DIR);
  },
  filename: (req, file, cb) => {
    const original = decodeOriginalName(file.originalname);
    file.originalname = original;
    const storedName = `${nanoid()}${safeExtension(original)}`;
    const fullPath = path.join(UPLOAD_DIR, storedName);
    const bag = ((req as UploadRequest)._uploadPaths ??= []);
    bag.push(fullPath);
    cb(null, storedName);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: MAX_FILE_SIZE_BYTES ?? Infinity,
  },
});

function uploadPaths(req: Request): string[] {
  const tracked = (req as UploadRequest)._uploadPaths ?? [];
  const fromMulter = Array.isArray(req.files)
    ? req.files.map((file) => file.path)
    : [];
  return [...new Set([...tracked, ...fromMulter])];
}

async function deletePaths(paths: string[]): Promise<void> {
  await Promise.all(paths.map((p) => unlink(p).catch(() => undefined)));
}

function errnoCode(err: unknown): string | undefined {
  if (err && typeof err === "object" && "code" in err) {
    const code = (err as { code: unknown }).code;
    return typeof code === "string" ? code : undefined;
  }
  return undefined;
}

function sendUploadError(res: Response, err: unknown): void {
  const code = errnoCode(err);
  if (code === "ENOSPC") {
    res.status(507).json({ error: "Disk full" });
    return;
  }
  if (err instanceof MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      res.status(413).json({ error: "File too large" });
      return;
    }
    res.status(400).json({ error: err.message });
    return;
  }
  res.status(500).json({ error: "Upload failed" });
}

function keepSocketAlive(req: Request, _res: Response, next: NextFunction): void {
  req.socket.setTimeout(0);
  next();
}

function attachAbortCleanup(req: Request): () => void {
  let active = true;
  const cleanup = () => {
    if (!active) return;
    void deletePaths(uploadPaths(req));
  };
  req.once("aborted", cleanup);
  return () => {
    active = false;
    req.off("aborted", cleanup);
  };
}

function toMeta(
  file: Express.Multer.File,
  uploader: string,
): FileMeta | null {
  const storedName = path.basename(file.filename || file.path);
  const diskPath = resolveStoredPath(storedName);
  if (!diskPath) return null;
  return {
    id: nanoid(),
    originalName: originalBasename(file.originalname),
    storedName,
    size: file.size,
    mimeType: file.mimetype || "application/octet-stream",
    uploadedAt: Date.now(),
    uploader,
  };
}

function applyFileHeaders(
  res: Response,
  meta: FileMeta,
  disposition: "inline" | "attachment",
  extra: { sandbox?: boolean } = {},
): void {
  res.setHeader(
    "Content-Type",
    meta.mimeType || "application/octet-stream",
  );
  res.setHeader(
    "Content-Disposition",
    contentDispositionHeader(disposition, meta.originalName),
  );
  res.setHeader("Cache-Control", "private, max-age=3600");
  res.setHeader("X-Content-Type-Options", "nosniff");
  if (extra.sandbox) {
    res.setHeader("Content-Security-Policy", "sandbox");
  }
}

function sendStoredFile(
  req: Request,
  res: Response,
  meta: FileMeta,
  disposition: "inline" | "attachment",
  extra: { sandbox?: boolean } = {},
): void {
  const diskPath = resolveStoredPath(meta.storedName);
  if (!diskPath) {
    res.status(404).json({ error: "File not found" });
    return;
  }
  applyFileHeaders(res, meta, disposition, extra);
  res.sendFile(
    diskPath,
    {
      maxAge: 3600_000,
      lastModified: true,
      etag: true,
      acceptRanges: true,
      cacheControl: false,
      headers: {
        "Cache-Control": "private, max-age=3600",
      },
    },
    (err) => {
      if (!err || res.headersSent) return;
      if (errnoCode(err) === "ENOENT") {
        res.status(404).json({ error: "File not found" });
        return;
      }
      res.status(500).json({ error: "Failed to send file" });
    },
  );
}

export function registerFileRoutes(app: Express, io: Io): void {
  app.get("/api/storage", (_req, res) => {
    res.json(storageStats());
  });

  app.get("/api/files", (_req, res) => {
    const rows = list().sort((a, b) => b.uploadedAt - a.uploadedAt);
    res.json(rows);
  });

  app.post(
    "/api/files",
    keepSocketAlive,
    (req, res, next) => {
      const disarmAbort = attachAbortCleanup(req);
      upload.array("files")(req, res, (err: unknown) => {
        if (err) {
          void deletePaths(uploadPaths(req)).finally(() => {
            disarmAbort();
            if (!res.headersSent) sendUploadError(res, err);
          });
          return;
        }
        (req as UploadRequest)._disarmAbort = disarmAbort;
        next();
      });
    },
    async (req, res) => {
      const disarmAbort =
        (req as UploadRequest)._disarmAbort ?? (() => undefined);
      if (req.aborted) {
        await deletePaths(uploadPaths(req));
        disarmAbort();
        return;
      }

      const incoming = Array.isArray(req.files) ? req.files : [];
      if (incoming.length === 0) {
        await deletePaths(uploadPaths(req));
        disarmAbort();
        res.status(400).json({ error: "No files uploaded" });
        return;
      }

      const uploader = sanitizeUploader(
        typeof req.headers["x-device-name"] === "string"
          ? req.headers["x-device-name"]
          : undefined,
      );

      const added: FileMeta[] = [];
      try {
        for (const file of incoming) {
          const meta = toMeta(file, uploader);
          if (!meta) {
            throw new Error("Invalid stored path");
          }
          added.push(add(meta));
        }
      } catch (err) {
        for (const meta of added) {
          remove(meta.id);
        }
        await deletePaths(uploadPaths(req));
        disarmAbort();
        sendUploadError(res, err);
        return;
      }

      io.emit("files:added", added);
      disarmAbort();
      res.status(201).json(added);
    },
  );

  app.delete("/api/files/:id", async (req, res) => {
    const id = typeof req.params.id === "string" ? req.params.id : "";
    const meta = get(id);
    if (!meta) {
      res.status(404).json({ error: "File not found" });
      return;
    }

    const diskPath = resolveStoredPath(meta.storedName);
    if (!diskPath) {
      res.status(400).json({ error: "Invalid file path" });
      return;
    }

    remove(id);
    try {
      await unlink(diskPath);
    } catch (err: unknown) {
      if (errnoCode(err) !== "ENOENT") {
        add(meta);
        res.status(500).json({ error: "Failed to delete file" });
        return;
      }
    }
    io.emit("files:removed", { id });
    res.status(204).end();
  });

  app.get("/files/:id/download", (req, res) => {
    const meta = get(typeof req.params.id === "string" ? req.params.id : "");
    if (!meta) {
      res.status(404).json({ error: "File not found" });
      return;
    }
    sendStoredFile(req, res, meta, "attachment");
  });

  app.get("/files/:id/raw", (req, res) => {
    const meta = get(typeof req.params.id === "string" ? req.params.id : "");
    if (!meta) {
      res.status(404).json({ error: "File not found" });
      return;
    }
    if (isPreviewableMime(meta.mimeType)) {
      sendStoredFile(req, res, meta, "inline");
      return;
    }
    sendStoredFile(req, res, meta, "attachment", { sandbox: true });
  });
}

export function startFileRetention(io: Io): void {
  if (AUTO_DELETE_HOURS == null) return;
  const maxAgeMs = AUTO_DELETE_HOURS * 60 * 60 * 1000;

  const sweep = () => {
    const cutoff = Date.now() - maxAgeMs;
    for (const meta of list()) {
      if (meta.uploadedAt >= cutoff) continue;
      const diskPath = resolveStoredPath(meta.storedName);
      remove(meta.id);
      if (diskPath) {
        void unlink(diskPath).catch(() => undefined);
      }
      io.emit("files:removed", { id: meta.id });
    }
  };

  sweep();
  setInterval(sweep, 10 * 60 * 1000).unref();
}
