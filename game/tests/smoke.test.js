import { test } from 'node:test';
import assert from 'node:assert/strict';
import { io } from 'socket.io-client';

const PORT = 3848;

test('server starts and two clients receive state', async () => {
  process.env.PORT = String(PORT);
  const { httpServer, game } = await import('../server/index.js');

  await new Promise((r) => {
    if (httpServer.listening) r();
    else httpServer.once('listening', r);
  });

  const url = `http://127.0.0.1:${PORT}`;
  const a = io(url, { transports: ['websocket'], forceNew: true });
  const b = io(url, { transports: ['websocket'], forceNew: true });

  const waitWelcome = (s) =>
    new Promise((resolve) => s.once('welcome', resolve));

  a.emit('join', { nickname: '测试甲' });
  b.emit('join', { nickname: '测试乙' });
  await Promise.all([waitWelcome(a), waitWelcome(b)]);

  const stateA = await new Promise((resolve) => a.once('state', resolve));
  assert.ok(stateA.players.length >= 2, 'both players on same map');
  assert.equal(stateA.map.id, 'meadow');

  a.close();
  b.close();
  game.destroy();
  await new Promise((r) => httpServer.close(r));
});
