# 连线聊天 (Real-time Chat)

Simple multi-user room chat for **hong noby**, built with Node.js, Express, and Socket.IO.

## Requirements

- Node.js 18+

## Install

```bash
cd chat
npm install
```

## Run

```bash
npm start
```

Open [http://localhost:3000](http://localhost:3000) in one or more browser tabs. Enter a nickname and optionally a room name (default room: `lobby`).

Health check:

```bash
curl -s http://localhost:3000/health
```

## Features

- Nickname required to join; duplicate nicknames in the same room are rejected
- Optional room name (shared `lobby` by default)
- Live online user list per room
- Broadcast messages with timestamps
- Mobile-friendly layout with slide-over online panel on small screens

## Environment

| Variable | Default | Description        |
| -------- | ------- | ------------------ |
| `PORT`   | `3000`  | HTTP/WebSocket port |

This app is independent of the root 斗地主 tracker; run it from the `chat/` directory only.
