import { rotateAccessKey } from "../auth/accessKey.ts";
import { clearAllSessions, flushSessions } from "../auth/sessions.ts";

const key = rotateAccessKey();
clearAllSessions();
await flushSessions();

console.log("");
console.log("  New access key:");
console.log(`  ${key}`);
console.log("");
console.log("  All sessions were cleared. Restart the LocalShare server");
console.log("  so it loads the new key (tsx watch may already have restarted).");
console.log("");
