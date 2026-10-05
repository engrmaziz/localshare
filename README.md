# LocalShare

LAN-only web app for sharing **text**, **chat**, and **files** between phones, laptops, and tablets on the same Wi-Fi. No cloud, no accounts — traffic stays on your network.

## Features

- Shared text pad that stays in sync across every connected device
- Simple LAN chat with device names, link detection, and copy
- Drag-and-drop file sharing (photos, videos, zips) with live progress
- QR code + copy/share URL so a phone can join without typing an IP
- Dark/light theme, mobile tab layout, and Add to Home Screen support
- Optional access PIN (`ACCESS_PIN`) for a light lock on a trusted LAN
- Persistence across server restarts (chat, clipboard, files on disk)

## Screenshots

_Add screenshots of the desktop layout, mobile tabs, and QR connect card here._

## Prerequisites

- Node.js 20 or newer
- Devices on the same local network (same Wi-Fi / LAN)

## Quick start

```bash
npm install
npm run build
npm start
```

Then open the Network URL printed in the terminal on this computer, and scan the QR code from a phone on the same Wi-Fi.

For day-to-day development (API on `PORT`, Vite UI on `CLIENT_PORT`):

```bash
npm install
npm run dev
```

The Vite client proxies `/api`, `/files`, and `/socket.io` to the server. The connect QR always uses **the port the page is served from**, so a phone scanning during `npm run dev` hits the UI (default 7422), not the API port.

Optional: copy `.env.example` to `.env`. Defaults live in `.env.example` and as fallbacks in code.

## Environment variables

| Variable | Default | Notes |
| --- | --- | --- |
| `PORT` | `7421` | API and production server (binds `0.0.0.0`) |
| `CLIENT_PORT` | `7422` | Vite dev client only |
| `UPLOAD_DIR` | `../data/uploads` | Where uploaded files are stored (relative to `server/`) |
| `DATA_DIR` | `../data` | Chat, clipboard, and file metadata JSON |
| `MAX_FILE_SIZE_MB` | unset (unlimited) | Reject larger uploads with HTTP 413 |
| `AUTO_DELETE_HOURS` | unset (keep forever) | Delete files older than this (checked every 10 minutes) |
| `ACCESS_PIN` | unset | If set, require this PIN before REST, files, and Socket.io |

## Firewall

Node must accept inbound connections on your **private** network, or phones cannot load the app.

**Windows:** when Windows Defender Firewall prompts, allow Node.js on **private** networks. If it never prompted: Windows Security → Firewall & network protection → Allow an app through firewall → enable Node.js for Private. Also allow TCP port `7421` (and `7422` when developing).

**macOS:** System Settings → Network → Firewall → allow incoming for Node. If you use `pf` or a third-party firewall, allow TCP `7421` on the LAN interface.

**Linux:** allow TCP on `PORT` (and `CLIENT_PORT` in dev) for your LAN, for example:

```bash
sudo ufw allow from 192.168.0.0/16 to any port 7421
```

If the phone cannot connect but the PC can, the firewall is the usual cause.

## Troubleshooting

- **AP/client isolation:** many routers isolate Wi-Fi clients from each other. Turn off “AP isolation”, “client isolation”, or “guest network” for the SSID you are using.
- **VPN:** a VPN can hide the LAN IP LocalShare detects, or block device-to-device traffic. Disconnect the VPN on the host (and often the phone) or pick another address from **Not working? Try another network address**.
- **Wrong IP:** laptops with Ethernet + Wi-Fi + virtual adapters may advertise the wrong address. Use the dropdown on the Connect card.
- **Port already in use:** the server prints `Port <PORT> is busy. Set PORT in .env` and exits. It does not pick another port. Change `PORT` / `CLIENT_PORT` in `.env`.
- **QR opens the API, not the UI:** in development the UI is on `CLIENT_PORT`. The QR uses `window.location.port` so it should match the page you opened. Prefer scanning from the Vite URL, not `localhost:7421`.
- **Disconnected / PIN loop:** if `ACCESS_PIN` is set, unlock once; cookies and the socket handshake both need that PIN.

## Security note

LocalShare is designed for **trusted local networks**. It is not meant to be exposed to the internet. There is no multi-user permission model. Anyone who can reach the server on the LAN can read chat, the shared pad, and files (unless you set `ACCESS_PIN`, which is a simple shared secret — not a substitute for a firewall or VPN).

## End-to-end checklist

- [ ] Scan the QR with a phone on the same Wi-Fi and confirm the app loads
- [ ] Send text in the shared pad and see it on the other device
- [ ] Send a chat message both ways
- [ ] Upload a photo from the phone; confirm it appears on the laptop
- [ ] Upload a large video from the phone; download it on the laptop
- [ ] Restart the server (`Ctrl+C`, then `npm start`) and confirm chat, pad, and files are still there
