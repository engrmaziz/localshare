import { createServer } from "node:http";
import path from "node:path";
import cors from "cors";
import express from "express";
import { Server as SocketIOServer } from "socket.io";
import type { ClientToServerEvents, ServerToClientEvents } from "@shared/types";
import {
  CLIENT_DIST,
  PORT,
  ensureDataDirs,
  isProduction,
} from "./config.ts";
import { getLanAddresses, getPrimaryIp } from "./network.ts";
import { attachSockets } from "./sockets.ts";
import { flushStore } from "./store.ts";
import { registerFileRoutes, startFileRetention } from "./files/routes.ts";
import { flushFileStore } from "./files/fileStore.ts";

ensureDataDirs();

const app = express();
const httpServer = createServer(app);

httpServer.requestTimeout = 0;
httpServer.headersTimeout = 65_000;
httpServer.keepAliveTimeout = 65_000;

const io = new SocketIOServer<ClientToServerEvents, ServerToClientEvents>(
  httpServer,
  {
    cors: { origin: true },
  },
);

app.use(cors({ origin: true }));
app.use(express.json({ limit: "2mb" }));

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

app.get("/api/info", (_req, res) => {
  const ips = getLanAddresses();
  const primaryIp = getPrimaryIp();
  res.json({
    ips,
    primaryIp,
    port: PORT,
    url: `http://${primaryIp}:${PORT}`,
  });
});

function shouldSkipSpa(urlPath: string): boolean {
  return (
    urlPath.startsWith("/api") ||
    urlPath.startsWith("/files") ||
    urlPath.startsWith("/socket.io")
  );
}

attachSockets(io);
registerFileRoutes(app, io);
startFileRetention(io);

if (isProduction) {
  app.use(express.static(CLIENT_DIST));
  app.use((req, res, next) => {
    if (req.method !== "GET" && req.method !== "HEAD") {
      next();
      return;
    }
    if (shouldSkipSpa(req.path)) {
      next();
      return;
    }
    res.sendFile(path.join(CLIENT_DIST, "index.html"), (err) => {
      if (err) next(err);
    });
  });
}

function printBanner(): void {
  const primaryIp = getPrimaryIp();
  const ips = getLanAddresses();
  const line = "─".repeat(52);

  console.log(`\n${line}`);
  console.log("  LocalShare");
  console.log(`  Local:    http://localhost:${PORT}`);
  console.log(`  Network:  http://${primaryIp}:${PORT}`);
  if (ips.length > 1) {
    console.log("  Other addresses:");
    for (const { address, iface } of ips) {
      if (address === primaryIp) continue;
      console.log(`    • http://${address}:${PORT}  (${iface})`);
    }
  }
  console.log(line);
  console.log("");
}

httpServer.on("error", (err: NodeJS.ErrnoException) => {
  if (err.code === "EADDRINUSE") {
    console.error(`Port ${PORT} is busy. Set PORT in .env`);
    process.exit(1);
  }
  console.error(err);
  process.exit(1);
});

httpServer.listen(PORT, "0.0.0.0", () => {
  printBanner();
});

let shuttingDown = false;

function shutdown(signal: string): void {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`\n${signal} received, shutting down…`);
  void Promise.all([flushStore(), flushFileStore()])
    .catch(() => undefined)
    .finally(() => {
      void io.close();
      httpServer.close(() => {
        process.exit(0);
      });
    });
  setTimeout(() => process.exit(1), 5_000).unref();
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
