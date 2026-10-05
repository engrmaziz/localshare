import type { Express, Request, Response } from "express";
import type { Server } from "socket.io";
import type { ClientToServerEvents, ServerToClientEvents } from "@shared/types";
import { COOKIE_SECURE, SESSION_TTL_MS } from "../config.ts";
import { readRawKeyForHost, verifyKey } from "./accessKey.ts";
import { SESSION_COOKIE, cookieHeaderFrom, parseCookie } from "./cookie.ts";
import {
  LOGIN_FAIL_DELAY_MS,
  clientIp,
  inspectLoginLimit,
  noteLoginAttempt,
  noteLoginFailure,
  noteLoginSuccess,
  sleep,
} from "./loginLimit.ts";
import { isHostRequest } from "./middleware.ts";
import { createSession, deleteSessionByToken, getSession } from "./sessions.ts";

type Io = Server<ClientToServerEvents, ServerToClientEvents>;

function noStore(res: Response): void {
  res.setHeader("Cache-Control", "no-store");
}

function cookieOptions(): {
  httpOnly: boolean;
  sameSite: "lax";
  path: string;
  maxAge: number;
  secure: boolean;
} {
  return {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_MS,
    // Do not set Secure by default: the app runs on plain HTTP over the LAN,
    // so Secure cookies would never be sent. Enable COOKIE_SECURE=true after
    // terminating HTTPS (for example with mkcert).
    secure: COOKIE_SECURE,
  };
}

function sendLocked(res: Response, retryAfterSeconds: number): void {
  noStore(res);
  res.setHeader("Retry-After", String(retryAfterSeconds));
  res.status(429).json({
    error: "Too many attempts",
    retryAfterSeconds,
  });
}

async function sendInvalid(res: Response): Promise<void> {
  await sleep(LOGIN_FAIL_DELAY_MS);
  noStore(res);
  res.status(401).json({ error: "Invalid access key" });
}

function disconnectSession(io: Io, hash: string): void {
  for (const socket of io.sockets.sockets.values()) {
    const data = socket.data as { sessionHash?: string };
    if (data.sessionHash === hash) {
      socket.disconnect(true);
    }
  }
}

export function registerAuthRoutes(app: Express, io: Io): void {
  app.post("/api/auth/login", async (req: Request, res: Response) => {
    const ip = clientIp(req);
    noteLoginAttempt();
    const limited = inspectLoginLimit(ip);
    if (limited.blocked) {
      await sleep(LOGIN_FAIL_DELAY_MS);
      sendLocked(res, limited.retryAfterSeconds);
      return;
    }

    const key =
      req.body && typeof req.body === "object" && typeof (req.body as { key?: unknown }).key === "string"
        ? (req.body as { key: string }).key
        : "";

    if (!verifyKey(key)) {
      const failure = noteLoginFailure(ip);
      if (failure.locked) {
        await sleep(LOGIN_FAIL_DELAY_MS);
        sendLocked(res, failure.retryAfterSeconds);
        return;
      }
      await sendInvalid(res);
      return;
    }

    noteLoginSuccess(ip);
    const ua = typeof req.headers["user-agent"] === "string" ? req.headers["user-agent"] : "";
    const { token } = createSession(ip, ua);
    res.cookie(SESSION_COOKIE, token, cookieOptions());
    noStore(res);
    res.json({ ok: true });
  });

  app.post("/api/auth/logout", (req: Request, res: Response) => {
    const token = parseCookie(cookieHeaderFrom(req), SESSION_COOKIE);
    const session = deleteSessionByToken(token);
    if (session) disconnectSession(io, session.hash);
    res.clearCookie(SESSION_COOKIE, { path: "/", sameSite: "lax", httpOnly: true, secure: COOKIE_SECURE });
    noStore(res);
    res.json({ ok: true });
  });

  app.get("/api/auth/status", (req: Request, res: Response) => {
    noStore(res);
    res.json({
      authenticated: Boolean(getSession(req)),
      isHost: isHostRequest(req),
    });
  });

  app.get("/api/auth/key", (req: Request, res: Response) => {
    noStore(res);
    if (!getSession(req) || !isHostRequest(req)) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    const key = readRawKeyForHost();
    if (!key) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    res.json({ key });
  });
}

export { disconnectSession };
