/**
 * Optional local WebSocket echo relay for LAN testing (not required for public PeerJS play).
 * Usage: node server/relay.mjs
 * Then point a custom client at ws://localhost:8787 (default game uses PeerJS cloud).
 */
import { WebSocketServer } from "ws";

const PORT = Number(process.env.PORT || 8787);
const rooms = new Map();

const wss = new WebSocketServer({ port: PORT });
console.log(`[pulse-relay] ws://localhost:${PORT}`);
console.log("Rooms are in-memory; for production use PeerJS or a managed relay.");

wss.on("connection", (socket) => {
  let roomId = null;
  socket.on("message", (raw) => {
    let msg;
    try {
      msg = JSON.parse(String(raw));
    } catch {
      return;
    }
    if (msg.t === "join" && msg.room) {
      roomId = String(msg.room).toUpperCase();
      if (!rooms.has(roomId)) rooms.set(roomId, new Set());
      rooms.get(roomId).add(socket);
      socket.send(JSON.stringify({ t: "joined", room: roomId, n: rooms.get(roomId).size }));
      return;
    }
    if (!roomId) return;
    const peers = rooms.get(roomId);
    if (!peers) return;
    for (const peer of peers) {
      if (peer !== socket && peer.readyState === 1) peer.send(String(raw));
    }
  });
  socket.on("close", () => {
    if (!roomId) return;
    const peers = rooms.get(roomId);
    peers?.delete(socket);
    if (peers && peers.size === 0) rooms.delete(roomId);
  });
});
