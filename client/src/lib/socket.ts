import { io, type Socket } from "socket.io-client";
import { useEffect, useState } from "react";
import type {
  BlockedEntry,
  ClientToServerEvents,
  ConnectedDevice,
  ServerToClientEvents,
} from "@shared/types";
import { notifyUnauthorized } from "./auth.ts";
import { readDeviceName } from "./identity.ts";

export const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io({
  autoConnect: false,
  reconnection: true,
  withCredentials: true,
});

export function connectSocket(): void {
  socket.auth = { deviceName: readDeviceName() };
  if (!socket.connected) {
    socket.connect();
  } else {
    socket.emit("device:identify", { name: readDeviceName() });
  }
}

export function disconnectSocket(): void {
  socket.disconnect();
}

export function useSocket() {
  const [connected, setConnected] = useState(socket.connected);
  const [clientCount, setClientCount] = useState(0);
  const [devices, setDevices] = useState<ConnectedDevice[]>([]);
  const [blocked, setBlocked] = useState<BlockedEntry[]>([]);

  useEffect(() => {
    const onConnect = () => {
      setConnected(true);
      socket.emit("device:identify", { name: readDeviceName() });
    };
    const onDisconnect = () => setConnected(false);
    const onCount = (count: number) => setClientCount(count);
    const onDevices = (list: ConnectedDevice[]) => setDevices(list);
    const onBlocked = (list: BlockedEntry[]) => setBlocked(list);
    const onKicked = () => {
      disconnectSocket();
      notifyUnauthorized();
    };
    const onBlockedEvent = () => {
      disconnectSocket();
      notifyUnauthorized();
    };
    const onError = (err: Error) => {
      if (err.message === "unauthorized" || err.message === "blocked") {
        notifyUnauthorized();
      }
    };

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("clients:count", onCount);
    socket.on("devices:list", onDevices);
    socket.on("devices:blocked", onBlocked);
    socket.on("auth:kicked", onKicked);
    socket.on("auth:blocked", onBlockedEvent);
    socket.on("connect_error", onError);

    if (socket.connected) {
      socket.emit("device:identify", { name: readDeviceName() });
    }

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("clients:count", onCount);
      socket.off("devices:list", onDevices);
      socket.off("devices:blocked", onBlocked);
      socket.off("auth:kicked", onKicked);
      socket.off("auth:blocked", onBlockedEvent);
      socket.off("connect_error", onError);
    };
  }, []);

  return { connected, clientCount, devices, blocked, socket };
}
