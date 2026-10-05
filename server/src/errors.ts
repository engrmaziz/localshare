import type { NextFunction, Request, Response } from "express";

export function jsonErrorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (res.headersSent) {
    next(err);
    return;
  }
  const code =
    err && typeof err === "object" && "status" in err
      ? Number((err as { status: unknown }).status)
      : 500;
  const status = Number.isFinite(code) && code >= 400 ? code : 500;
  const message =
    err instanceof Error && status < 500 ? err.message : "Internal server error";
  if (status >= 500) {
    console.error(err);
  }
  res.status(status).json({ error: message });
}

const BENIGN = new Set([
  "ECONNRESET",
  "EPIPE",
  "ECANCELED",
  "ECONNABORTED",
  "ERR_STREAM_PREMATURE_CLOSE",
]);

function errorCode(err: unknown): string | undefined {
  if (err && typeof err === "object" && "code" in err) {
    const code = (err as { code: unknown }).code;
    return typeof code === "string" ? code : undefined;
  }
  return undefined;
}

export function installProcessGuards(): void {
  process.on("unhandledRejection", (reason) => {
    const code = errorCode(reason);
    if (code && BENIGN.has(code)) return;
    console.error("unhandledRejection", reason);
  });
  process.on("uncaughtException", (err) => {
    const code = errorCode(err);
    if (code && BENIGN.has(code)) {
      console.error("uncaughtException (benign)", err.message);
      return;
    }
    console.error("uncaughtException", err);
  });
}
