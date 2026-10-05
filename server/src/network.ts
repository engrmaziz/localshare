import os from "node:os";

export type LanAddress = {
  address: string;
  iface: string;
};

const VIRTUAL_IFACE =
  /vethernet|virtualbox|vmware|docker|hyper-v|vbox|vmnet|wsl|loopback|tailscale|tun|tap|utun|br-|cbl|npcap|pseudo/i;

function isIPv4(family: string | number): boolean {
  return family === "IPv4" || family === 4;
}

function privacyRank(address: string): number {
  const [a, b] = address.split(".").map(Number);
  if (a === 192 && b === 168) return 0;
  if (a === 10) return 1;
  if (a === 172 && b >= 16 && b <= 31) return 2;
  return 3;
}

function virtualRank(iface: string): number {
  return VIRTUAL_IFACE.test(iface) ? 1 : 0;
}

export function getLanAddresses(): LanAddress[] {
  const ifaces = os.networkInterfaces();
  const results: LanAddress[] = [];

  for (const [name, addrs] of Object.entries(ifaces)) {
    if (!addrs) continue;
    for (const addr of addrs) {
      if (isIPv4(addr.family) && !addr.internal) {
        results.push({ address: addr.address, iface: name });
      }
    }
  }

  results.sort((left, right) => {
    const virtual = virtualRank(left.iface) - virtualRank(right.iface);
    if (virtual !== 0) return virtual;
    return privacyRank(left.address) - privacyRank(right.address);
  });

  return results;
}

export function getPrimaryIp(): string {
  return getLanAddresses()[0]?.address ?? "localhost";
}
