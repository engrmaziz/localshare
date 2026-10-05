const FAIL_WINDOW_MS = 60_000;
const FAIL_MAX_PER_MIN = 5;
const CONSECUTIVE_LOCK = 10;
const LOCK_MS = 15 * 60 * 1000;
const GLOBAL_MAX_PER_MIN = 60;
export const LOGIN_FAIL_DELAY_MS = 300;

type Bucket = {
  failTimes: number[];
  consecutive: number;
  lockedUntil: number;
};

const ips = new Map<string, Bucket>();
const globalTimes: number[] = [];

function prune(times: number[], now: number): number[] {
  return times.filter((t) => now - t < FAIL_WINDOW_MS);
}

export function clientIp(req: {
  socket: { remoteAddress?: string };
  headers: { [key: string]: string | string[] | undefined };
}): string {
  const remote = req.socket.remoteAddress ?? "unknown";
  const loopback =
    remote === "127.0.0.1" ||
    remote === "::1" ||
    remote === "::ffff:127.0.0.1";
  if (loopback) {
    const forwarded = req.headers["x-forwarded-for"];
    const first =
      typeof forwarded === "string"
        ? forwarded.split(",")[0]?.trim()
        : Array.isArray(forwarded)
          ? forwarded[0]?.split(",")[0]?.trim()
          : undefined;
    if (first) return first;
  }
  return remote.replace(/^::ffff:/, "");
}

export type LimitBlock = {
  blocked: true;
  retryAfterSeconds: number;
};

export function inspectLoginLimit(ip: string): LimitBlock | { blocked: false } {
  const now = Date.now();
  const global = prune(globalTimes, now);
  globalTimes.length = 0;
  globalTimes.push(...global);
  if (globalTimes.length >= GLOBAL_MAX_PER_MIN) {
    const oldest = globalTimes[0] ?? now;
    return {
      blocked: true,
      retryAfterSeconds: Math.max(1, Math.ceil((oldest + FAIL_WINDOW_MS - now) / 1000)),
    };
  }

  const bucket = ips.get(ip);
  if (bucket && bucket.lockedUntil > now) {
    return {
      blocked: true,
      retryAfterSeconds: Math.max(1, Math.ceil((bucket.lockedUntil - now) / 1000)),
    };
  }
  if (bucket) {
    bucket.failTimes = prune(bucket.failTimes, now);
    if (bucket.failTimes.length >= FAIL_MAX_PER_MIN) {
      const oldest = bucket.failTimes[0] ?? now;
      return {
        blocked: true,
        retryAfterSeconds: Math.max(1, Math.ceil((oldest + FAIL_WINDOW_MS - now) / 1000)),
      };
    }
  }
  return { blocked: false };
}

export function noteLoginAttempt(): void {
  globalTimes.push(Date.now());
}

export function noteLoginFailure(ip: string): { locked: boolean; retryAfterSeconds: number } {
  const now = Date.now();
  const bucket = ips.get(ip) ?? {
    failTimes: [],
    consecutive: 0,
    lockedUntil: 0,
  };
  bucket.failTimes = prune(bucket.failTimes, now);
  bucket.failTimes.push(now);
  bucket.consecutive += 1;
  if (bucket.consecutive >= CONSECUTIVE_LOCK) {
    bucket.lockedUntil = now + LOCK_MS;
    console.warn(`Login locked ${ip}`);
  } else {
    console.warn(`Login failed from ${ip}`);
  }
  ips.set(ip, bucket);
  const retryAfterSeconds =
    bucket.lockedUntil > now
      ? Math.max(1, Math.ceil((bucket.lockedUntil - now) / 1000))
      : Math.max(1, Math.ceil((bucket.failTimes[0]! + FAIL_WINDOW_MS - now) / 1000));
  return { locked: bucket.lockedUntil > now, retryAfterSeconds };
}

export function noteLoginSuccess(ip: string): void {
  const bucket = ips.get(ip);
  if (!bucket) return;
  bucket.consecutive = 0;
  bucket.failTimes = [];
  bucket.lockedUntil = 0;
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
