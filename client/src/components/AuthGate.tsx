import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import {
  fetchAuthStatus,
  logoutSession,
  onUnauthorized,
  safeNextPath,
  takeFragmentKey,
  loginWithKey,
  type AuthStatus,
} from "../lib/auth.ts";
import { connectSocket, disconnectSocket } from "../lib/socket.ts";
import { useToast } from "../lib/toast.tsx";
import { LoginScreen } from "./LoginScreen.tsx";

type AuthContextValue = {
  authenticated: boolean;
  isHost: boolean;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthGate");
  return ctx;
}

function followNextPath(): void {
  const next = safeNextPath(new URLSearchParams(window.location.search).get("next"));
  if (next === "/" || next === window.location.pathname) return;
  window.location.assign(next);
}

export function AuthGate({ children }: { children: ReactNode }) {
  const { toast } = useToast();
  const [status, setStatus] = useState<AuthStatus | null>(null);
  const [booted, setBooted] = useState(false);
  const [wasAuthed, setWasAuthed] = useState(false);

  const applyAuthed = useCallback((next: AuthStatus) => {
    setStatus(next);
    if (next.authenticated) {
      setWasAuthed(true);
      connectSocket();
    } else {
      disconnectSocket();
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const fragmentKey = takeFragmentKey();
      if (fragmentKey) {
        await loginWithKey(fragmentKey);
      }
      try {
        const next = await fetchAuthStatus();
        if (cancelled) return;
        applyAuthed(next);
        if (next.authenticated) followNextPath();
      } catch {
        if (!cancelled) applyAuthed({ authenticated: false, isHost: false });
      } finally {
        if (!cancelled) setBooted(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [applyAuthed]);

  useEffect(() => {
    return onUnauthorized(() => {
      setStatus((current) => {
        if (current?.authenticated) {
          toast("Session expired. Please enter the access key again.");
        }
        return { authenticated: false, isHost: current?.isHost ?? false };
      });
      disconnectSocket();
    });
  }, [toast]);

  async function logout(): Promise<void> {
    await logoutSession();
    disconnectSocket();
    setStatus({ authenticated: false, isHost: status?.isHost ?? false });
  }

  if (!booted || !status) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-canvas text-sm text-quiet dark:bg-canvas-dark dark:text-quiet-dark">
        Connecting…
      </div>
    );
  }

  const value: AuthContextValue = {
    authenticated: status.authenticated,
    isHost: status.isHost,
    logout,
  };

  if (!status.authenticated && !wasAuthed) {
    return (
      <AuthContext.Provider value={value}>
        <LoginScreen
          onUnlocked={() => {
            void fetchAuthStatus().then((next) => {
              applyAuthed(next);
              followNextPath();
            });
          }}
        />
      </AuthContext.Provider>
    );
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
      {!status.authenticated ? (
        <LoginScreen
          overlay
          onUnlocked={() => {
            void fetchAuthStatus().then((next) => {
              applyAuthed(next);
              followNextPath();
            });
          }}
        />
      ) : null}
    </AuthContext.Provider>
  );
}
