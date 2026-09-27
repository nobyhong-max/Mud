(function () {
  const joinScreen = document.getElementById('join-screen');
  const chatScreen = document.getElementById('chat-screen');
  const joinForm = document.getElementById('join-form');
  const joinError = document.getElementById('join-error');
  const messageForm = document.getElementById('message-form');
  const messageInput = document.getElementById('message-input');
  const messagesEl = document.getElementById('messages');
  const onlineList = document.getElementById('online-list');
  const onlineCount = document.getElementById('online-count');
  const headerOnline = document.getElementById('header-online');
  const roomTitle = document.getElementById('room-title');
  const roomTitleMobile = document.getElementById('room-title-mobile');
  const youNick = document.getElementById('you-nick');
  const leaveBtn = document.getElementById('leave-btn');
  const toggleOnline = document.getElementById('toggle-online');
  const sidebar = document.querySelector('.sidebar');

  let socket = null;
  let myNickname = '';

  function formatTime(ts) {
    const d = new Date(ts);
    return d.toLocaleString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
  }

  function scrollMessages() {
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  function renderOnline(names) {
    const list = names.slice().sort((a, b) => a.localeCompare(b, 'zh'));
    onlineList.innerHTML = '';
    list.forEach((name) => {
      const li = document.createElement('li');
      li.textContent = name;
      onlineList.appendChild(li);
    });
    onlineCount.textContent = String(list.length);
    headerOnline.textContent = `${list.length} 人在线`;
  }

  function appendMessage({ type, nickname, text, ts, self }) {
    const li = document.createElement('li');
    li.className = `msg ${type}${self ? ' self' : ''}`;

    if (type === 'system') {
      li.textContent = text;
      li.className = 'msg system';
    } else {
      const meta = document.createElement('div');
      meta.className = 'msg-meta';
      meta.innerHTML = `<span class="msg-nick">${escapeHtml(nickname)}</span><time>${formatTime(ts)}</time>`;

      const body = document.createElement('p');
      body.className = 'msg-text';
      body.textContent = text;

      li.appendChild(meta);
      li.appendChild(body);
    }

    messagesEl.appendChild(li);
    scrollMessages();
  }

  function escapeHtml(s) {
    const div = document.createElement('div');
    div.textContent = s;
    return div.innerHTML;
  }

  function showJoinError(msg) {
    joinError.textContent = msg;
    joinError.hidden = !msg;
  }

  function enterChat(room, nick) {
    myNickname = nick;
    youNick.textContent = nick;
    roomTitle.textContent = room;
    roomTitleMobile.textContent = room;
    messagesEl.innerHTML = '';
    joinScreen.hidden = true;
    chatScreen.hidden = false;
    messageInput.focus();
  }

  function leaveChat() {
    if (socket) {
      socket.disconnect();
      socket = null;
    }
    chatScreen.hidden = true;
    joinScreen.hidden = false;
    sidebar.classList.remove('open');
    showJoinError('');
  }

  joinForm.addEventListener('submit', (e) => {
    e.preventDefault();
    showJoinError('');

    const nickname = document.getElementById('nickname').value.trim();
    const room = document.getElementById('room').value.trim() || 'lobby';

    socket = io({ transports: ['websocket', 'polling'] });

    socket.on('connect_error', () => {
      showJoinError('无法连接服务器，请稍后重试');
    });

    socket.once('connect', () => {
      socket.emit('join', { nickname, room }, (res) => {
        if (!res?.ok) {
          showJoinError(res?.error || '加入失败');
          socket.disconnect();
          socket = null;
          return;
        }
        enterChat(res.room, nickname);
        renderOnline(res.online || []);
      });
    });

    socket.on('message', (msg) => {
      appendMessage({
        type: 'chat',
        nickname: msg.nickname,
        text: msg.text,
        ts: msg.ts,
        self: msg.nickname === myNickname,
      });
    });

    socket.on('system', (payload) => {
      appendMessage({ type: 'system', text: payload.text, ts: payload.ts });
    });

    socket.on('online', (names) => {
      renderOnline(names);
    });

    socket.on('disconnect', () => {
      appendMessage({
        type: 'system',
        text: '与服务器断开连接',
        ts: Date.now(),
      });
    });
  });

  messageForm.addEventListener('submit', (e) => {
    e.preventDefault();
    if (!socket?.connected) return;
    const text = messageInput.value.trim();
    if (!text) return;
    messageInput.value = '';
    socket.emit('message', { text }, (res) => {
      if (!res?.ok) {
        appendMessage({
          type: 'system',
          text: res?.error || '发送失败',
          ts: Date.now(),
        });
      }
    });
  });

  leaveBtn.addEventListener('click', leaveChat);

  toggleOnline.addEventListener('click', () => {
    sidebar.classList.toggle('open');
  });
})();
