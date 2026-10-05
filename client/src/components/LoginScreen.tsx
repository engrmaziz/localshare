import { Eye, EyeOff } from "lucide-react";
import { useEffect, useId, useState, type FormEvent } from "react";
import { formatCountdown, loginWithKey } from "../lib/auth.ts";

type LoginScreenProps = {
  onUnlocked: () => void;
  overlay?: boolean;
};

export function LoginScreen({ onUnlocked, overlay = false }: LoginScreenProps) {
  const inputId = useId();
  const errorId = useId();
  const [key, setKey] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [retryAfter, setRetryAfter] = useState(0);

  useEffect(() => {
    if (retryAfter <= 0) return;
    const id = window.setInterval(() => {
      setRetryAfter((current) => Math.max(0, current - 1));
    }, 1000);
    return () => window.clearInterval(id);
  }, [retryAfter]);

  async function submit(event?: FormEvent) {
    event?.preventDefault();
    if (key.length !== 32 || busy || retryAfter > 0) return;
    setBusy(true);
    setError(null);
    try {
      const result = await loginWithKey(key);
      if (result.ok) {
        onUnlocked();
        return;
      }
      if (result.status === 429 && result.retryAfterSeconds) {
        setRetryAfter(result.retryAfterSeconds);
        setError(
          `Too many attempts. Try again in ${formatCountdown(result.retryAfterSeconds)}`,
        );
      } else if (result.status === 401) {
        setError("Invalid access key");
      } else {
        setError("Could not reach the LocalShare server.");
      }
    } catch {
      setError("Could not reach the LocalShare server.");
    } finally {
      setBusy(false);
    }
  }

  const locked = retryAfter > 0;
  const canSubmit = key.length === 32 && !busy && !locked;
  const liveError =
    locked
      ? `Too many attempts. Try again in ${formatCountdown(retryAfter)}`
      : error;

  return (
    <div
      className={`flex min-h-dvh flex-col items-center justify-center bg-canvas px-6 dark:bg-canvas-dark ${
        overlay ? "fixed inset-0 z-40 bg-canvas/95 dark:bg-canvas-dark/95" : ""
      }`}
    >
      <form
        onSubmit={submit}
        className="w-full max-w-sm rounded-2xl border border-line bg-panel p-6 shadow-sm dark:border-line-dark dark:bg-panel-dark"
      >
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand dark:text-brand-glow">
          LocalShare
        </p>
        <h1 className="mt-1 font-display text-2xl font-bold">Enter access key</h1>
        <p className="mt-1 text-sm text-quiet dark:text-quiet-dark">
          Ask the host for the 32-character key printed in the server console.
        </p>

        <label className="mt-4 block text-sm font-medium" htmlFor={inputId}>
          Access key
        </label>
        <div className="mt-1 flex gap-2">
          <input
            id={inputId}
            type={show ? "text" : "password"}
            value={key}
            onChange={(e) => setKey(e.target.value.slice(0, 32))}
            autoComplete="current-password"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            maxLength={32}
            aria-invalid={Boolean(liveError)}
            aria-describedby={liveError ? errorId : undefined}
            className="min-h-11 w-full rounded-xl border border-line bg-canvas px-3 py-3 font-mono text-base tracking-wide outline-none focus:border-brand dark:border-line-dark dark:bg-canvas-dark"
          />
          <button
            type="button"
            onClick={() => setShow((v) => !v)}
            className="inline-flex size-11 shrink-0 items-center justify-center rounded-xl border border-line dark:border-line-dark"
            aria-label={show ? "Hide access key" : "Show access key"}
          >
            {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        </div>
        <p className="mt-1 text-xs tabular-nums text-quiet dark:text-quiet-dark">
          {key.length} / 32
        </p>
        <div id={errorId} className="mt-2 min-h-5 text-sm text-down" aria-live="polite">
          {liveError}
        </div>
        <button
          type="submit"
          disabled={!canSubmit}
          className="mt-3 inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-brand text-sm font-medium text-white disabled:opacity-50"
        >
          Unlock
        </button>
      </form>
    </div>
  );
}
