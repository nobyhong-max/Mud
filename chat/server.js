const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const PORT = process.env.PORT || 3000;
const DEFAULT_ROOM = 'lobby';

/** @type {Map<string, Map<string, { nickname: string, joinedAt: number }>>} */
const rooms = new Map();

function normalizeRoom(name) {
  const trimmed = String(name || DEFAULT_ROOM).trim().slice(0, 32);
  const slug = trimmed.replace(/[^\w\u4e00-\u9fff-]/gi, '-').replace(/-+/g, '-');
  return slug || DEFAULT_ROOM;
}

function getRoomUsers(roomId) {
  if (!rooms.has(roomId)) {
    rooms.set(roomId, new Map());
  }
  return rooms.get(roomId);
}

function listOnline(roomId) {
  return [...getRoomUsers(roomId).values()].map((u) => u.nickname);
}

const app = express();
app.use(express.static(path.join(__dirname, 'public')));

app.get('/health', (_req, res) => {
  res.json({ ok: true, rooms: rooms.size });
});

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' },
});

io.on('connection', (socket) => {
  let currentRoom = null;
  let nickname = null;

  socket.on('join', ({ nickname: rawNick, room: rawRoom }, ack) => {
    const nick = String(rawNick || '').trim().slice(0, 24);
    if (!nick) {
      if (typeof ack === 'function') ack({ ok: false, error: '请输入昵称' });
      return;
    }

    const roomId = normalizeRoom(rawRoom);
    const users = getRoomUsers(roomId);

    for (const [sid, u] of users.entries()) {
      if (u.nickname.toLowerCase() === nick.toLowerCase() && sid !== socket.id) {
        if (typeof ack === 'function') ack({ ok: false, error: '昵称已被使用' });
        return;
      }
    }

    if (currentRoom) {
      socket.leave(currentRoom);
      getRoomUsers(currentRoom).delete(socket.id);
      io.to(currentRoom).emit('online', listOnline(currentRoom));
    }

    currentRoom = roomId;
    nickname = nick;
    users.set(socket.id, { nickname: nick, joinedAt: Date.now() });
    socket.join(roomId);

    socket.to(roomId).emit('system', {
      text: `${nick} 加入了聊天`,
      ts: Date.now(),
    });

    io.to(roomId).emit('online', listOnline(roomId));

    if (typeof ack === 'function') {
      ack({ ok: true, room: roomId, online: listOnline(roomId) });
    }
  });

  socket.on('message', (payload, ack) => {
    if (!currentRoom || !nickname) {
      if (typeof ack === 'function') ack({ ok: false, error: '尚未加入房间' });
      return;
    }
    const text = String(payload?.text || '').trim().slice(0, 2000);
    if (!text) {
      if (typeof ack === 'function') ack({ ok: false, error: '消息不能为空' });
      return;
    }

    const msg = {
      id: `${socket.id}-${Date.now()}`,
      nickname,
      text,
      ts: Date.now(),
    };
    io.to(currentRoom).emit('message', msg);
    if (typeof ack === 'function') ack({ ok: true });
  });

  socket.on('disconnect', () => {
    if (!currentRoom || !nickname) return;
    const users = getRoomUsers(currentRoom);
    users.delete(socket.id);
    socket.to(currentRoom).emit('system', {
      text: `${nickname} 离开了`,
      ts: Date.now(),
    });
    io.to(currentRoom).emit('online', listOnline(currentRoom));
    if (users.size === 0) {
      rooms.delete(currentRoom);
    }
  });
});

server.listen(PORT, () => {
  console.log(`连线聊天 listening on http://localhost:${PORT}`);
});
