import { io, type Socket } from "socket.io-client";
import { useEffect, useState } from "react";
import type { ClientToServerEvents, ServerToClientEvents } from "@shared/types";
import { notifyUnauthorized } from "./auth.ts";

export const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io({
  autoConnect: false,
  reconnection: true,
  withCredentials: true,
});

export function connectSocket(): void {
  socket.auth = {};
  if (!socket.connected) socket.connect();
}

export function disconnectSocket(): void {
  socket.disconnect();
}

export function useSocket() {
  const [connected, setConnected] = useState(socket.connected);
  const [clientCount, setClientCount] = useState(0);

  useEffect(() => {
    const onConnect = () => setConnected(true);
    const onDisconnect = () => setConnected(false);
    const onCount = (count: number) => setClientCount(count);
    const onError = (err: Error) => {
      if (err.message === "unauthorized") notifyUnauthorized();
    };

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("clients:count", onCount);
    socket.on("connect_error", onError);

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("clients:count", onCount);
      socket.off("connect_error", onError);
    };
  }, []);

  return { connected, clientCount, socket };
}
