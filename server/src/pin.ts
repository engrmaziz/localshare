import { createHmac, timingSafeEqual } from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import type { Socket } from "socket.io";
import { ACCESS_PIN } from "./config.ts";

export const PIN_COOKIE = "localshare_auth";

export function pinRequired(): boolean {
  return Boolean(ACCESS_PIN);
}

export function pinToken(): string {
  if (!ACCESS_PIN) return "";
  return createHmac("sha256", ACCESS_PIN).update("localshare-gate").digest("hex");
}

export function tokenMatches(token: string | undefined): boolean {
  if (!ACCESS_PIN || !token) return false;
  const expected = Buffer.from(pinToken());
  const got = Buffer.from(token);
  return expected.length === got.length && timingSafeEqual(expected, got);
}

export function pinMatches(pin: string): boolean {
  if (!ACCESS_PIN) return true;
  const a = Buffer.from(pin);
  const b = Buffer.from(ACCESS_PIN);
  return a.length === b.length && timingSafeEqual(a, b);
}

function cookieValue(req: Request): string | undefined {
  const raw = req.cookies?.[PIN_COOKIE];
  return typeof raw === "string" ? raw : undefined;
}

function bearerToken(req: Request): string | undefined {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) return undefined;
  return header.slice(7);
}

export function isAuthed(req: Request): boolean {
  if (!pinRequired()) return true;
  return tokenMatches(cookieValue(req)) || tokenMatches(bearerToken(req));
}

function parseCookieHeader(header: string | undefined, name: string): string | undefined {
  if (!header) return undefined;
  for (const part of header.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return decodeURIComponent(rest.join("="));
  }
  return undefined;
}

export function socketAuthed(socket: Socket): boolean {
  if (!pinRequired()) return true;
  const auth = socket.handshake.auth as { pin?: unknown; token?: unknown };
  if (typeof auth.token === "string" && tokenMatches(auth.token)) return true;
  if (typeof auth.pin === "string" && pinMatches(auth.pin)) return true;
  const cookie = parseCookieHeader(socket.handshake.headers.cookie, PIN_COOKIE);
  return tokenMatches(cookie);
}

const PUBLIC_PATHS = new Set(["/api/health", "/api/auth"]);

export function pinGuard(req: Request, res: Response, next: NextFunction): void {
  if (!pinRequired() || PUBLIC_PATHS.has(req.path)) {
    next();
    return;
  }
  const gated = req.path.startsWith("/api") || req.path.startsWith("/files");
  if (!gated || isAuthed(req)) {
    next();
    return;
  }
  res.status(401).json({ error: "PIN required" });
}

export function registerAuthRoutes(app: {
  get: (path: string, handler: (req: Request, res: Response) => void) => void;
  post: (path: string, handler: (req: Request, res: Response) => void) => void;
}): void {
  app.get("/api/auth", (req, res) => {
    res.json({
      required: pinRequired(),
      ok: isAuthed(req),
      token: pinRequired() && isAuthed(req) ? pinToken() : undefined,
    });
  });

  app.post("/api/auth", (req, res) => {
    if (!pinRequired()) {
      res.json({ ok: true, required: false });
      return;
    }
    const pin =
      req.body && typeof req.body === "object" && typeof (req.body as { pin?: unknown }).pin === "string"
        ? (req.body as { pin: string }).pin
        : "";
    if (!pinMatches(pin)) {
      res.status(403).json({ error: "Wrong PIN" });
      return;
    }
    const token = pinToken();
    res.cookie(PIN_COOKIE, token, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });
    res.json({ ok: true, required: true, token });
  });
}
