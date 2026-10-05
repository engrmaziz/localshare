import { useCallback, useState } from "react";

const ADJECTIVES = [
  "Swift",
  "Quiet",
  "Amber",
  "Copper",
  "Brave",
  "Silent",
  "Lucky",
  "Noble",
  "Rusty",
  "Frost",
  "Cedar",
  "Maple",
  "Ivory",
  "Solar",
  "Nimble",
  "Gentle",
] as const;

const ANIMALS = [
  "Otter",
  "Fox",
  "Heron",
  "Lynx",
  "Puma",
  "Wren",
  "Hare",
  "Badger",
  "Finch",
  "Cobra",
  "Moose",
  "Puffin",
  "Gecko",
  "Marten",
  "Ibis",
  "Osprey",
] as const;

const STORAGE_KEY = "localshare.deviceName";
const MAX_NAME = 30;

function pick<T extends readonly string[]>(list: T): T[number] {
  return list[Math.floor(Math.random() * list.length)]!;
}

export function generateDeviceName(): string {
  const n = 10 + Math.floor(Math.random() * 90);
  return `${pick(ADJECTIVES)}-${pick(ANIMALS)}-${n}`;
}

export function readDeviceName(): string {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && stored.trim()) return stored.trim().slice(0, MAX_NAME);
  } catch {
    /* private mode */
  }
  const name = generateDeviceName();
  try {
    localStorage.setItem(STORAGE_KEY, name);
  } catch {
    /* ignore */
  }
  return name;
}

export function writeDeviceName(name: string): string {
  const next = name.trim().slice(0, MAX_NAME) || readDeviceName();
  try {
    localStorage.setItem(STORAGE_KEY, next);
  } catch {
    /* ignore */
  }
  return next;
}

export function useDeviceName() {
  const [name, setName] = useState(readDeviceName);

  const rename = useCallback((next: string) => {
    const saved = writeDeviceName(next);
    setName(saved);
    return saved;
  }, []);

  return { name, rename };
}
