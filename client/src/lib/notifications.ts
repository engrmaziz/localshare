import type { Message } from "@shared/types";

const SOUND_KEY = "localshare.soundEnabled";
const ORIGINAL_TITLE = "LocalShare";

let audioCtx: AudioContext | null = null;
let unreadCount = 0;

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const AudioCtx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!AudioCtx) return null;
  if (!audioCtx) {
    audioCtx = new AudioCtx();
  }
  return audioCtx;
}

export function initAudioOnInteraction(): () => void {
  if (typeof window === "undefined") return () => undefined;
  const resume = () => {
    if (audioCtx && audioCtx.state === "suspended") {
      void audioCtx.resume();
    }
  };
  window.addEventListener("pointerdown", resume, { passive: true });
  window.addEventListener("keydown", resume, { passive: true });
  window.addEventListener("touchstart", resume, { passive: true });

  return () => {
    window.removeEventListener("pointerdown", resume);
    window.removeEventListener("keydown", resume);
    window.removeEventListener("touchstart", resume);
  };
}

export function isSoundMuted(): boolean {
  try {
    return localStorage.getItem(SOUND_KEY) === "0";
  } catch {
    return false;
  }
}

export function setSoundMuted(muted: boolean): void {
  try {
    localStorage.setItem(SOUND_KEY, muted ? "0" : "1");
  } catch {
    /* ignore */
  }
}

function playChime(ctx: AudioContext): void {
  const now = ctx.currentTime;

  const master = ctx.createGain();
  master.gain.setValueAtTime(0.2, now);
  master.connect(ctx.destination);

  // Tone 1: 587.33 Hz (D5)
  const osc1 = ctx.createOscillator();
  const gain1 = ctx.createGain();
  osc1.type = "sine";
  osc1.frequency.setValueAtTime(587.33, now);
  gain1.gain.setValueAtTime(0.6, now);
  gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
  osc1.connect(gain1);
  gain1.connect(master);
  osc1.start(now);
  osc1.stop(now + 0.22);

  // Tone 2: 880 Hz (A5)
  const osc2 = ctx.createOscillator();
  const gain2 = ctx.createGain();
  osc2.type = "sine";
  osc2.frequency.setValueAtTime(880, now + 0.07);
  gain2.gain.setValueAtTime(0.001, now);
  gain2.gain.setValueAtTime(0.7, now + 0.07);
  gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
  osc2.connect(gain2);
  gain2.connect(master);
  osc2.start(now + 0.07);
  osc2.stop(now + 0.4);
}

export function playNotificationSound(): void {
  if (isSoundMuted()) return;
  const ctx = getAudioContext();
  if (!ctx) return;
  if (ctx.state === "suspended") {
    ctx
      .resume()
      .then(() => playChime(ctx))
      .catch(() => undefined);
    return;
  }
  playChime(ctx);
}

export function isNotificationSupported(): boolean {
  return typeof window !== "undefined" && "Notification" in window;
}

export function getNotificationPermission(): NotificationPermission | "unsupported" {
  if (!isNotificationSupported()) return "unsupported";
  return Notification.permission;
}

export async function requestNotificationPermission(): Promise<NotificationPermission | "unsupported"> {
  if (!isNotificationSupported()) return "unsupported";
  try {
    const res = await Notification.requestPermission();
    return res;
  } catch {
    return "denied";
  }
}

export function showChatNotification(message: Message): Notification | null {
  if (!isNotificationSupported() || Notification.permission !== "granted") {
    return null;
  }
  try {
    const title = `${message.sender} in LocalShare`;
    const snippet =
      message.text.length > 120
        ? `${message.text.slice(0, 117)}…`
        : message.text;
    const notification = new Notification(title, {
      body: snippet,
      icon: "/favicon.svg",
      tag: "localshare-chat",
    });
    notification.onclick = () => {
      window.focus();
      notification.close();
    };
    return notification;
  } catch {
    return null;
  }
}

export function handleIncomingMessageTitle(): void {
  if (typeof document === "undefined") return;
  if (document.hidden) {
    unreadCount += 1;
    document.title = `(${unreadCount}) LocalShare`;
  }
}

export function initTitleNotificationReset(): () => void {
  if (typeof document === "undefined") return () => undefined;
  const reset = () => {
    if (!document.hidden) {
      unreadCount = 0;
      document.title = ORIGINAL_TITLE;
    }
  };
  document.addEventListener("visibilitychange", reset);
  window.addEventListener("focus", reset);
  return () => {
    document.removeEventListener("visibilitychange", reset);
    window.removeEventListener("focus", reset);
  };
}
