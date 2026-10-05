import { createHash, randomInt, timingSafeEqual } from "node:crypto";
import { chmodSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { DATA_DIR, ensureDataDirs } from "../config.ts";

const KEY_LENGTH = 32;
const ALPHABET =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
const KEY_FILE = path.join(DATA_DIR, "access.key");

let keyHash: Buffer | null = null;

export function accessKeyPath(): string {
  return KEY_FILE;
}

function sha256(value: string): Buffer {
  return createHash("sha256").update(value, "utf8").digest();
}

function generateKey(): string {
  const chars = new Array<string>(KEY_LENGTH);
  for (let i = 0; i < KEY_LENGTH; i++) {
    chars[i] = ALPHABET[randomInt(ALPHABET.length)]!;
  }
  return chars.join("");
}

function isExactKey(value: string): boolean {
  return value.length === KEY_LENGTH && !/\s/.test(value);
}

function readKeyFile(): string {
  const raw = readFileSync(KEY_FILE, "utf8").replace(/\r?\n$/, "");
  if (!isExactKey(raw)) {
    console.error(
      `Access key file ${KEY_FILE} must contain exactly 32 characters with no whitespace.`,
    );
    process.exit(1);
  }
  return raw;
}

function writeKeyFile(key: string): void {
  ensureDataDirs();
  writeFileSync(KEY_FILE, key, { encoding: "utf8", mode: 0o600 });
  try {
    chmodSync(KEY_FILE, 0o600);
  } catch {
    /* Windows may ignore mode */
  }
}

function abortInvalidEnv(): never {
  console.error(
    "ACCESS_KEY must be exactly 32 characters with no whitespace.",
  );
  process.exit(1);
}

function setHash(key: string): void {
  keyHash = sha256(key);
}

/** Load the key, store only sha256 in memory, and return the raw value for the one-time banner. */
export function loadAccessKey(): string {
  ensureDataDirs();
  if (process.env.ACCESS_KEY !== undefined) {
    const envKey = process.env.ACCESS_KEY;
    if (!isExactKey(envKey)) abortInvalidEnv();
    setHash(envKey);
    return envKey;
  }
  if (existsSync(KEY_FILE)) {
    const fromFile = readKeyFile();
    setHash(fromFile);
    return fromFile;
  }
  const generated = generateKey();
  writeKeyFile(generated);
  setHash(generated);
  return generated;
}

export function rotateAccessKey(): string {
  if (process.env.ACCESS_KEY !== undefined) {
    console.error(
      "ACCESS_KEY is set in the environment; rotating data/access.key will not change the running key until that env var is unset.",
    );
  }
  const key = generateKey();
  writeKeyFile(key);
  setHash(key);
  return key;
}

/** Re-read env or disk when the host reveals the key. The hash stays the source of truth for verify. */
export function readRawKeyForHost(): string | null {
  if (process.env.ACCESS_KEY !== undefined) {
    return isExactKey(process.env.ACCESS_KEY) ? process.env.ACCESS_KEY : null;
  }
  if (!existsSync(KEY_FILE)) return null;
  try {
    const raw = readFileSync(KEY_FILE, "utf8").replace(/\r?\n$/, "");
    return isExactKey(raw) ? raw : null;
  } catch {
    return null;
  }
}

export function verifyKey(input: unknown): boolean {
  if (typeof input !== "string" || input.length !== KEY_LENGTH) return false;
  if (!keyHash) return false;
  const got = sha256(input);
  if (got.length !== keyHash.length) return false;
  return timingSafeEqual(got, keyHash);
}
