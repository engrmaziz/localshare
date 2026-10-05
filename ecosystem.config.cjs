const path = require("node:path");
const fs = require("node:fs");

const root = __dirname;
const logsDir = path.join(root, "logs");
fs.mkdirSync(logsDir, { recursive: true });

function findTsxCli() {
  const candidates = [
    path.join(root, "node_modules", "tsx", "dist", "cli.mjs"),
    path.join(root, "server", "node_modules", "tsx", "dist", "cli.mjs"),
  ];
  const found = candidates.find((file) => fs.existsSync(file));
  if (!found) {
    throw new Error("tsx not found. Run npm install from the project root.");
  }
  return found;
}

// Production uses tsx (same entry as `npm start`) so @shared path aliases and
// `.ts` imports keep working without a second compiler pipeline.
module.exports = {
  apps: [
    {
      name: "localshare",
      cwd: path.join(root, "server"),
      script: findTsxCli(),
      args: "src/index.ts",
      interpreter: "node",
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      max_restarts: 20,
      min_uptime: "10s",
      max_memory_restart: "1G",
      kill_timeout: 8000,
      time: true,
      merge_logs: true,
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
      error_file: path.join(logsDir, "error.log"),
      out_file: path.join(logsDir, "out.log"),
      env: {
        NODE_ENV: "production",
        PORT: "7421",
      },
      env_production: {
        NODE_ENV: "production",
        PORT: "7421",
      },
    },
  ],
};
