export async function writeClipboard(text: string): Promise<boolean> {
  const api = navigator.clipboard;
  if (api && typeof api.writeText === "function") {
    try {
      await api.writeText(text);
      return true;
    } catch {
      /* fall through to execCommand */
    }
  }

  const el = document.createElement("textarea");
  el.value = text;
  el.setAttribute("readonly", "");
  el.style.position = "fixed";
  el.style.left = "-9999px";
  document.body.appendChild(el);
  el.select();
  let ok = false;
  try {
    ok = document.execCommand("copy");
  } catch {
    ok = false;
  }
  document.body.removeChild(el);
  return ok;
}

export async function readClipboard(): Promise<string | null> {
  const api = navigator.clipboard;
  if (api && typeof api.readText === "function") {
    try {
      return await api.readText();
    } catch {
      /* fall through */
    }
  }

  try {
    const ok = document.execCommand("paste");
    if (!ok) return null;
  } catch {
    return null;
  }
  return null;
}

export function pasteShortcutHint(): string {
  const mac = /mac/i.test(navigator.platform) || /mac/i.test(navigator.userAgent);
  return mac
    ? "Paste isn't available here. Click the text box and press ⌘V."
    : "Paste isn't available here. Click the text box and press Ctrl+V.";
}
