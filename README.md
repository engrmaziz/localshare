# LocalShare

LAN-only web app for sharing **text**, **chat**, and **files** between phones, laptops, and tablets on the same Wi-Fi. No cloud, no accounts — traffic stays on your network.

Every device must enter a 32-character **access key** before it can see chat, the shared pad, or files.

## Features

- Shared text pad that stays in sync across every connected device
- Simple LAN chat with device names, link detection, and copy
- Drag-and-drop file sharing (photos, videos, zips) with live progress
- QR code + copy/share URL so a phone can join without typing an IP
- Optional host QR that embeds the access key (`#k=…`) for one-scan login
- Dark/light theme, mobile tab layout, and Add to Home Screen support
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

The server prints **Local**, **Network**, and **Access key** in the console box. Open the Network URL on this computer, enter the key, then scan the QR from a phone on the same Wi-Fi (the phone will need the same key unless you enable **Include access key in QR code** on the host).

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
| `DATA_DIR` | `../data` | Chat, clipboard, file metadata, `access.key`, `sessions.json` |
| `MAX_FILE_SIZE_MB` | unset (unlimited) | Reject larger uploads with HTTP 413 |
| `AUTO_DELETE_HOURS` | unset (keep forever) | Delete files older than this (checked every 10 minutes) |
| `ACCESS_KEY` | unset | If set, must be exactly 32 characters with no whitespace; otherwise a key is generated into `DATA_DIR/access.key` |
| `SESSION_TTL_HOURS` | `168` | Session cookie lifetime (7 days) |
| `PRINT_KEY` | `true` | Set `false` to hide the key from the startup banner |
| `COOKIE_SECURE` | `false` | Set `true` only after terminating HTTPS |

## Authentication

On first boot (when `ACCESS_KEY` is not set), LocalShare generates a random 32-character alphanumeric key with `crypto.randomInt` and writes it to `DATA_DIR/access.key` (mode `0600` on Unix). The sha256 of the key is kept in memory; login compares hashes with `timingSafeEqual`.

The raw key is printed **once** in the startup banner (`Access key: …`) unless `PRINT_KEY=false`. It is never written to other logs. Failed logins log only the client IP.

A successful login sets an HttpOnly `ls_session` cookie (SameSite=Lax, Path=/). **Secure is off by default** because the app is plain HTTP on the LAN — a Secure cookie would never be sent.

Rotate the key and wipe sessions:

```bash
npm run key:rotate
```

Then **restart the server** so it loads the new hash. Every device is kicked back to the login screen.

Rate limits: 5 failed logins per IP per minute; 10 consecutive failures lock that IP for 15 minutes; 60 login attempts per minute across all IPs.

### Honest security note

The app runs over **plain HTTP on the LAN**. Anyone who can sniff the same Wi-Fi can capture the access key or the session cookie. Use a trusted network (not a public hotspot). This is not a substitute for a firewall, VPN, or HTTPS.

Optional upgrade: terminate HTTPS with a locally trusted certificate ([mkcert](https://github.com/FiloSottile/mkcert)), then set `COOKIE_SECURE=true` so the session cookie is only sent over TLS.

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
- **Login loop / 401:** enter the 32-character key from the server banner (or `data/access.key`). After `npm run key:rotate`, restart the server and log in again.

## End-to-end checklist

- [ ] Fresh start: console prints a 32-character key; `data/access.key` exists
- [ ] `curl -i http://localhost:7421/api/files` returns 401; `/api/health` returns 200
- [ ] Browser shows only the login screen until the key is entered
- [ ] Scan the QR with a phone; enter the key (or use a host QR with the key embedded)
- [ ] Send text in the shared pad and see it on the other device
- [ ] Send a chat message both ways
- [ ] Upload a photo from the phone; confirm it appears on the laptop
- [ ] Upload a large video from the phone; download it on the laptop; confirm video seeking and image previews
- [ ] Log out (lock icon) kicks the device back to login
- [ ] Restart the server and confirm chat, pad, and files are still there (sessions last `SESSION_TTL_HOURS`)
