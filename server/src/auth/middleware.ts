import type { NextFunction, Request, Response } from "express";
import { getSession } from "./sessions.ts";

function isPublic(req: Request): boolean {
  const urlPath = req.path;
  if (req.method === "GET" && (urlPath === "/api/health" || urlPath === "/api/auth/status")) {
    return true;
  }
  if (req.method === "POST" && urlPath === "/api/auth/login") {
    return true;
  }
  if (req.method === "GET" || req.method === "HEAD") {
    if (
      urlPath.startsWith("/api") ||
      urlPath.startsWith("/files") ||
      urlPath.startsWith("/socket.io")
    ) {
      return false;
    }
    return true;
  }
  return false;
}

function wantsHtml(req: Request): boolean {
  const accept = req.headers.accept ?? "";
  return accept.includes("text/html");
}

export function isHostRequest(req: Request): boolean {
  const addr = req.socket.remoteAddress;
  const loopback =
    addr === "127.0.0.1" || addr === "::1" || addr === "::ffff:127.0.0.1";
  if (!loopback) return false;
  const host = (req.headers.host ?? "").split(":")[0]?.toLowerCase() ?? "";
  // Vite proxies phones from loopback; their Host is the LAN IP, not localhost.
  return (
    host === "localhost" ||
    host === "127.0.0.1" ||
    host === "[::1]" ||
    host === "::1" ||
    host === ""
  );
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (isPublic(req)) {
    next();
    return;
  }
  const session = getSession(req);
  if (session) {
    next();
    return;
  }
  if (
    urlIsFiles(req.path) &&
    (req.method === "GET" || req.method === "HEAD") &&
    wantsHtml(req)
  ) {
    const target = req.originalUrl.split("?")[0] ?? req.path;
    res.redirect(302, `/?next=${encodeURIComponent(target)}`);
    return;
  }
  res.setHeader("Cache-Control", "no-store");
  res.status(401).json({ error: "Unauthorized" });
}

function urlIsFiles(urlPath: string): boolean {
  return urlPath.startsWith("/files");
}
