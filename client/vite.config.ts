import path from "node:path";
import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const DEFAULT_CLIENT_PORT = 7422;
const DEFAULT_API_PORT = 7421;

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, path.resolve(__dirname, ".."), "");
  const clientPort = Number(env.CLIENT_PORT) || DEFAULT_CLIENT_PORT;
  const apiPort = Number(env.PORT) || DEFAULT_API_PORT;
  const apiOrigin = `http://localhost:${apiPort}`;

  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        "@shared": path.resolve(__dirname, "../shared"),
      },
    },
    server: {
      host: true,
      port: clientPort,
      strictPort: true,
      fs: {
        allow: [path.resolve(__dirname, "..")],
      },
      proxy: {
        "/api": apiOrigin,
        "/files": apiOrigin,
        "/socket.io": { target: apiOrigin, ws: true },
      },
    },
  };
});
