# LocalShare

LAN-only web app for sharing text, chat, and files between devices on the same Wi-Fi. No cloud, no accounts — traffic stays on your network.

Phase 1 is the scaffold and UI shell. Phase 2 is chat and shared text. Phase 3 is the file storage API (UI in a later phase).

## Prerequisites

- Node.js 20 or newer
- Devices on the same local network (same Wi-Fi / LAN)

## Setup

```bash
npm install
```

Optional: copy `.env.example` to `.env` and change ports if the defaults are taken. Defaults live only in `.env.example` (and as fallbacks in server/client config):

- `PORT` — API and production server
- `CLIENT_PORT` — Vite dev client

## Development

```bash
npm run dev
```

This starts the API server and the Vite client together.

- On this machine: open the Local URL printed in the server banner (and the Vite URL for the client).
- On a phone on the same Wi-Fi: open `http://<LAN-IP>:<CLIENT_PORT>` (the Network URL, using the client port).

The client proxies `/api`, `/files`, and `/socket.io` to the server.

## Production

```bash
npm run build
npm start
```

The server serves the built client and the API from `PORT` (bind address `0.0.0.0`).

- On this machine: `http://localhost:<PORT>`
- On a phone: `http://<LAN-IP>:<PORT>`

Open the app on two devices (or two browser tabs) and the header should show **2 devices connected**.

## Firewall

Node must accept inbound connections on your private network, or other devices cannot load the app.

**Windows:** when Windows Defender Firewall prompts, allow Node.js on **private** networks. If it never prompted: Windows Security → Firewall & network protection → Allow an app through firewall → enable Node.js for Private networks.

**macOS:** System Settings → Network → Firewall → allow incoming for Node.

**Linux:** allow TCP on `PORT` / `CLIENT_PORT` for your LAN interface (for example `ufw allow from 192.168.0.0/16 to any port <PORT>`).

If the phone cannot connect but the PC can, the firewall is the usual cause.

## Busy ports

If a port is already in use, the server prints `Port <PORT> is busy. Set PORT in .env` and exits. It does not pick another port automatically. Set `PORT` / `CLIENT_PORT` in `.env` instead.

## File API (Phase 3)

Uploads stream straight to disk (`multer.diskStorage`). There is no in-memory buffer of the file, so a multi-GB video uses roughly constant Node heap. Optional env vars (see `.env.example`):

- `MAX_FILE_SIZE_MB` — reject larger uploads with HTTP 413. Unset = unlimited.
- `AUTO_DELETE_HOURS` — delete files older than this (checked every 10 minutes). Unset = keep forever.

Replace `FILE_ID` with an `id` from the upload or list response. Examples assume the default `PORT=7421`.

### Upload a small file

```bash
curl -sS -X POST http://localhost:7421/api/files \
  -H "x-device-name: Curl-Tester" \
  -F "files=@./README.md"
```

### Upload a large file (~2 GB)

```bash
dd if=/dev/zero of=big.bin bs=1M count=2048
curl -sS -X POST http://localhost:7421/api/files \
  -H "x-device-name: Curl-Tester" \
  -F "files=@./big.bin"
```

Windows (PowerShell) equivalent of `dd`:

```powershell
fsutil file createnew big.bin 2147483648
curl.exe -sS -X POST http://localhost:7421/api/files -H "x-device-name: Curl-Tester" -F "files=@big.bin"
```

### List and storage usage

```bash
curl -sS http://localhost:7421/api/files
curl -sS http://localhost:7421/api/storage
```

### Range request, download, inline/raw, delete

```bash
curl -sS -D - -o first100.bin -r 0-99 http://localhost:7421/files/FILE_ID/download
curl -sS -o restored.bin http://localhost:7421/files/FILE_ID/download
curl -sS -D - -o raw.bin http://localhost:7421/files/FILE_ID/raw
curl -sS -D - -X DELETE http://localhost:7421/api/files/FILE_ID
```

Multiple files in one request: repeat `-F "files=@./another.bin"`.

### Why memory stays flat on a 2 GB upload

- `diskStorage` pipes each multipart file stream to `fs.createWriteStream` (chunked; never `memoryStorage` / `file.buffer`).
- The JSON body parser is not used for multipart, so Express does not load the upload into RAM.
- `server.requestTimeout = 0` so a slow phone-over-Wi-Fi transfer is not killed mid-stream.
- Only small JSON metadata (`files.json`) is kept in memory.

OS file cache may grow; that is the kernel, not the Node heap (`process.memoryUsage().heapUsed`).

