import { io, type Socket } from "socket.io-client";
import { useEffect, useState } from "react";
import type { ClientToServerEvents, ServerToClientEvents } from "@shared/types";
import { readPinToken } from "./auth.ts";

export const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io({
  autoConnect: false,
  reconnection: true,
  withCredentials: true,
});

export function connectSocket(): void {
  const token = readPinToken();
  socket.auth = token ? { token } : {};
  if (!socket.connected) socket.connect();
}

export function useSocket() {
  const [connected, setConnected] = useState(socket.connected);
  const [clientCount, setClientCount] = useState(0);

  useEffect(() => {
    const onConnect = () => setConnected(true);
    const onDisconnect = () => setConnected(false);
    const onCount = (count: number) => setClientCount(count);

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("clients:count", onCount);

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("clients:count", onCount);
    };
  }, []);

  return { connected, clientCount, socket };
}
