/**
 * Lightweight P2P rooms via PeerJS public broker (no self-hosted server required).
 * Limits: 2 players, best-effort sync, depends on peerjs cloud + WebRTC NAT traversal.
 */

const PREFIX = "pulsestrike-";

function loadPeerScript() {
  if (window.Peer) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://unpkg.com/peerjs@1.5.4/dist/peerjs.min.js";
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("PeerJS load failed"));
    document.head.appendChild(s);
  });
}

function randCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 4; i++) out += chars[(Math.random() * chars.length) | 0];
  return out;
}

export class NetRoom {
  constructor() {
    this.peer = null;
    this.conn = null;
    this.code = null;
    this.isHost = false;
    this.connected = false;
    this.onMessage = null;
    this.onStatus = null;
    this.onPeerOpen = null;
  }

  _status(msg) {
    this.onStatus?.(msg);
  }

  async host() {
    await loadPeerScript();
    this.destroy();
    this.isHost = true;
    this.code = randCode();
    const id = PREFIX + this.code;
    this.peer = new window.Peer(id, { debug: 1 });
    await new Promise((resolve, reject) => {
      this.peer.on("open", () => {
        this._status(`房间号 ${this.code}`);
        resolve();
      });
      this.peer.on("error", (err) => {
        this._status(`开房失败：${err.type || err.message || err}`);
        reject(err);
      });
    });
    this.peer.on("connection", (conn) => {
      this._bindConn(conn);
      this._status("好友已到 · 可以开始");
      this.onPeerOpen?.();
    });
    return this.code;
  }

  async join(code) {
    await loadPeerScript();
    this.destroy();
    this.isHost = false;
    this.code = String(code || "")
      .trim()
      .toUpperCase();
    if (this.code.length < 4) throw new Error("房间号不对");
    this.peer = new window.Peer({ debug: 1 });
    await new Promise((resolve, reject) => {
      this.peer.on("open", () => resolve());
      this.peer.on("error", (err) => reject(err));
    });
    const conn = this.peer.connect(PREFIX + this.code, { reliable: true });
    await new Promise((resolve, reject) => {
      const t = setTimeout(() => reject(new Error("连接超时，请重试")), 12000);
      conn.on("open", () => {
        clearTimeout(t);
        this._bindConn(conn);
        this._status(`已进入 ${this.code}`);
        resolve();
      });
      conn.on("error", (err) => {
        clearTimeout(t);
        reject(err);
      });
    });
    return this.code;
  }

  _bindConn(conn) {
    this.conn = conn;
    this.connected = true;
    conn.on("data", (data) => {
      try {
        const msg = typeof data === "string" ? JSON.parse(data) : data;
        this.onMessage?.(msg);
      } catch {
        /* ignore */
      }
    });
    conn.on("close", () => {
      this.connected = false;
      this._status("对方已离开");
    });
  }

  send(msg) {
    if (!this.conn || !this.connected) return;
    try {
      this.conn.send(msg);
    } catch {
      /* ignore */
    }
  }

  destroy() {
    try {
      this.conn?.close();
    } catch {
      /* ignore */
    }
    try {
      this.peer?.destroy();
    } catch {
      /* ignore */
    }
    this.peer = null;
    this.conn = null;
    this.connected = false;
  }
}
