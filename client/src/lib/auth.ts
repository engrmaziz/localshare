export type AuthStatus = {
  authenticated: boolean;
  isHost: boolean;
};

const unauthorizedListeners = new Set<() => void>();

export function onUnauthorized(listener: () => void): () => void {
  unauthorizedListeners.add(listener);
  return () => {
    unauthorizedListeners.delete(listener);
  };
}

export function notifyUnauthorized(): void {
  for (const listener of unauthorizedListeners) listener();
}

export function safeNextPath(raw: string | null | undefined): string {
  if (!raw) return "/";
  let value: string;
  try {
    value = decodeURIComponent(raw);
  } catch {
    return "/";
  }
  if (!value.startsWith("/") || value.startsWith("//")) return "/";
  if (value.includes("://") || /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(value)) return "/";
  if (value.includes("\\")) return "/";
  return value;
}

export async function apiFetch(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  const res = await fetch(input, { credentials: "include", ...init });
  if (res.status === 401) notifyUnauthorized();
  return res;
}

export async function fetchAuthStatus(): Promise<AuthStatus> {
  const res = await fetch("/api/auth/status", { credentials: "include" });
  if (!res.ok) return { authenticated: false, isHost: false };
  const body = (await res.json()) as Partial<AuthStatus>;
  return {
    authenticated: Boolean(body.authenticated),
    isHost: Boolean(body.isHost),
  };
}

export async function loginWithKey(key: string): Promise<
  | { ok: true }
  | { ok: false; status: number; error: string; retryAfterSeconds?: number }
> {
  const res = await fetch("/api/auth/login", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ key }),
  });
  if (res.ok) return { ok: true };
  let error = "Invalid access key";
  let retryAfterSeconds: number | undefined;
  try {
    const body = (await res.json()) as {
      error?: unknown;
      retryAfterSeconds?: unknown;
    };
    if (typeof body.error === "string" && body.error.trim()) error = body.error;
    if (typeof body.retryAfterSeconds === "number" && body.retryAfterSeconds > 0) {
      retryAfterSeconds = Math.ceil(body.retryAfterSeconds);
    }
  } catch {
    /* keep defaults */
  }
  if (res.status === 429 && retryAfterSeconds == null) {
    const header = res.headers.get("Retry-After");
    const parsed = header ? Number(header) : NaN;
    if (Number.isFinite(parsed) && parsed > 0) retryAfterSeconds = Math.ceil(parsed);
  }
  return { ok: false, status: res.status, error, retryAfterSeconds };
}

export async function logoutSession(): Promise<void> {
  try {
    await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
  } catch {
    /* still clear local session */
  }
}

export function takeFragmentKey(): string | null {
  const hash = window.location.hash;
  if (!hash.startsWith("#k=")) return null;
  const key = hash.slice(3);
  history.replaceState(
    null,
    "",
    `${window.location.pathname}${window.location.search}`,
  );
  return key.length === 32 ? key : null;
}

export function formatCountdown(seconds: number): string {
  const total = Math.max(0, Math.ceil(seconds));
  const mm = Math.floor(total / 60);
  const ss = total % 60;
  return `${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
}
