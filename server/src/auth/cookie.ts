export const SESSION_COOKIE = "ls_session";

export function parseCookie(
  header: string | undefined,
  name: string,
): string | undefined {
  if (!header) return undefined;
  for (const part of header.split(";")) {
    const trimmed = part.trim();
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    if (trimmed.slice(0, eq) !== name) continue;
    try {
      return decodeURIComponent(trimmed.slice(eq + 1));
    } catch {
      return trimmed.slice(eq + 1);
    }
  }
  return undefined;
}

export function cookieHeaderFrom(
  source: { headers?: { cookie?: string | string[] } },
): string | undefined {
  const raw = source.headers?.cookie;
  if (Array.isArray(raw)) return raw.join("; ");
  return raw;
}
