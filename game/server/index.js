import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import path from 'path';
import { fileURLToPath } from 'url';
import { GameServer } from './gameState.js';
import { MAPS } from './maps.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3847;

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, { cors: { origin: '*' } });

app.use(express.static(path.join(__dirname, '../public')));

const game = new GameServer();

io.on('connection', (socket) => {
  let joined = false;

  socket.on('join', ({ nickname }) => {
    if (joined) return;
    const player = game.addPlayer(socket.id, nickname || '冒险者');
    joined = true;
    socket.join(player.mapId);
    socket.emit('welcome', {
      playerId: socket.id,
      maps: MAPS.map((m) => ({ id: m.id, name: m.name })),
    });
    socket.emit('state', game.snapshotForPlayer(socket.id));
    socket.to(player.mapId).emit('playerJoined', { id: socket.id, nickname: player.nickname });
  });

  socket.on('input', (payload) => {
    if (payload.keys) game.setInputs(socket.id, payload.keys);
    if (payload.move) game.movePlayer(socket.id, payload.move);
    if (payload.stop) game.stopMove(socket.id);
  });

  socket.on('engage', ({ monsterId }) => {
    const r = game.tryEngage(socket.id, monsterId);
    if (r?.reason) socket.emit('toast', { message: r.reason });
  });

  socket.on('battleAttack', () => {
    game.battleAttack(socket.id);
  });

  socket.on('battleFlee', () => {
    const r = game.battleFlee(socket.id);
    if (r?.reason) socket.emit('toast', { message: r.reason });
  });

  socket.on('pickupEgg', ({ eggId }) => {
    game.pickupEgg(socket.id, eggId);
  });

  socket.on('enterMap', ({ mapId }) => {
    const p = game.players.get(socket.id);
    if (!p) return;
    const oldRoom = p.mapId;
    const result = game.tryEnterMap(socket.id, mapId);
    if (!result.ok) {
      socket.emit('toast', { message: result.reason });
      return;
    }
    socket.leave(oldRoom);
    socket.join(mapId);
    socket.emit('toast', { message: `进入 ${MAPS.find((m) => m.id === mapId)?.name}` });
  });

  socket.on('disconnect', () => {
    const p = game.players.get(socket.id);
    if (p) socket.to(p.mapId).emit('playerLeft', { id: socket.id });
    game.removePlayer(socket.id);
  });
});

const broadcastInterval = setInterval(() => {
  for (const map of MAPS) {
    const room = io.sockets.adapter.rooms.get(map.id);
    if (!room) continue;
    for (const sid of room) {
      const snap = game.snapshotForPlayer(sid);
      if (snap) io.to(sid).emit('state', snap);
    }
  }
}, 100);

httpServer.listen(PORT, () => {
  console.log(`联机打怪 RPG 服务已启动 http://localhost:${PORT}`);
});

process.on('SIGTERM', () => {
  clearInterval(broadcastInterval);
  game.destroy();
  httpServer.close();
});

export { httpServer, game, PORT };
