import { useEffect, useState, type ReactNode } from "react";
import { savePinToken } from "../lib/auth.ts";
import { connectSocket } from "../lib/socket.ts";
import { PinScreen } from "./PinScreen.tsx";

export function AuthGate({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [needsPin, setNeedsPin] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/auth", { credentials: "include" })
      .then(async (res) => {
        if (!res.ok) throw new Error("auth");
        return res.json() as Promise<{ required: boolean; ok: boolean; token?: string }>;
      })
      .then((data) => {
        if (cancelled) return;
        if (data.token) savePinToken(data.token);
        if (data.required && !data.ok) {
          setNeedsPin(true);
          return;
        }
        connectSocket();
        setReady(true);
      })
      .catch(() => {
        if (cancelled) return;
        connectSocket();
        setReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (needsPin && !ready) {
    return (
      <PinScreen
        onUnlocked={() => {
          connectSocket();
          setNeedsPin(false);
          setReady(true);
        }}
      />
    );
  }

  if (!ready) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-canvas text-sm text-quiet dark:bg-canvas-dark dark:text-quiet-dark">
        Connecting…
      </div>
    );
  }

  return children;
}
