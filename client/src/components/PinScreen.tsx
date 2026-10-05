import { useState, type FormEvent } from "react";
import { savePinToken } from "../lib/auth.ts";

type PinScreenProps = {
  onUnlocked: () => void;
};

export function PinScreen({ onUnlocked }: PinScreenProps) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ pin }),
      });
        if (!res.ok) {
        setError("That PIN is not right.");
        setBusy(false);
        return;
      }
      const body = (await res.json()) as { token?: string };
      if (body.token) savePinToken(body.token);
      onUnlocked();
    } catch {
      setError("Could not reach the LocalShare server.");
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-canvas px-6 dark:bg-canvas-dark">
      <form
        onSubmit={submit}
        className="w-full max-w-sm rounded-2xl border border-line bg-panel p-6 shadow-sm dark:border-line-dark dark:bg-panel-dark"
      >
        <h1 className="font-display text-2xl font-bold">Enter PIN</h1>
        <p className="mt-1 text-sm text-quiet dark:text-quiet-dark">
          This LocalShare instance is locked. Ask the host for the access PIN.
        </p>
        <label className="mt-4 block text-sm font-medium" htmlFor="pin">
          PIN
        </label>
        <input
          id="pin"
          value={pin}
          onChange={(e) => setPin(e.target.value)}
          autoComplete="one-time-code"
          inputMode="numeric"
          className="mt-1 w-full rounded-xl border border-line bg-canvas px-3 py-3 text-base outline-none focus:border-brand dark:border-line-dark dark:bg-canvas-dark"
        />
        {error ? (
          <p className="mt-2 text-sm text-down" role="alert">
            {error}
          </p>
        ) : null}
        <button
          type="submit"
          disabled={busy || !pin.trim()}
          className="mt-4 inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-brand text-sm font-medium text-white disabled:opacity-50"
        >
          Unlock
        </button>
      </form>
    </div>
  );
}
