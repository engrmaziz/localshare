import { RotateCcw } from "lucide-react";
import { useState } from "react";
import { socket, useSocket } from "../lib/socket.ts";
import { useToast } from "../lib/toast.tsx";

export function ResetShareButton() {
  const { connected } = useSocket();
  const { toast } = useToast();
  const [confirm, setConfirm] = useState(false);

  function reset() {
    if (!connected) return;
    if (!confirm) {
      setConfirm(true);
      return;
    }
    setConfirm(false);
    socket.emit("share:reset", (result) => {
      if (result && !result.ok) toast(result.error);
      else toast("Session reset on every device", "success");
    });
  }

  return (
    <button
      type="button"
      disabled={!connected}
      onClick={reset}
      onBlur={() => setConfirm(false)}
      className={`inline-flex size-11 shrink-0 items-center justify-center rounded-full border disabled:opacity-40 ${
        confirm
          ? "border-down bg-down text-white"
          : "border-line bg-panel dark:border-line-dark dark:bg-panel-dark"
      }`}
      aria-label={
        confirm
          ? "Confirm reset: delete all shared text, chat, and files"
          : "Reset session"
      }
      title={confirm ? "Tap again to delete everything" : "Reset session"}
    >
      <RotateCcw className="size-4" />
    </button>
  );
}
