import { io, type Socket } from "socket.io-client";
import { useEffect, useState } from "react";
import type { ClientToServerEvents, ServerToClientEvents } from "@shared/types";

export const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io({
  autoConnect: true,
  reconnection: true,
});

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
    setConnected(socket.connected);

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("clients:count", onCount);
    };
  }, []);

  return { connected, clientCount, socket };
}
