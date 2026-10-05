import os from "node:os";
import path from "node:path";
import { accessKeyPath } from "../auth/accessKey.ts";
import { DATA_DIR, PORT, REPO_ROOT } from "../config.ts";
import { getLanAddresses, getPrimaryIp } from "../network.ts";

const primary = getPrimaryIp();
const ips = getLanAddresses();
const host = os.hostname();
const keyFile = accessKeyPath();

console.log("");
console.log("  LocalShare URLs");
console.log(`  Local:     http://localhost:${PORT}`);
console.log(`  Network:   http://${primary}:${PORT}`);
if (ips.length > 1) {
  console.log("  Other addresses:");
  for (const { address, iface } of ips) {
    if (address === primary) continue;
    console.log(`    • http://${address}:${PORT}  (${iface})`);
  }
}
console.log(`  mDNS hint: http://${host}.local:${PORT}`);
console.log("             (works on Apple, Windows 10+, and many Android devices;");
console.log("             the IP URL above is the one to share if .local fails.)");
console.log("");
console.log("  On a phone: open the Network URL, then enter the 32-character");
console.log("  access key. After you log in on this computer, the Connect card");
console.log("  shows a QR for the same address.");
console.log("");
console.log(`  Access key file: ${keyFile}`);
console.log(`  Data directory:  ${path.resolve(DATA_DIR)}`);
console.log(`  Project:         ${REPO_ROOT}`);
console.log("");
