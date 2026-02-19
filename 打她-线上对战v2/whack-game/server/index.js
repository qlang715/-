const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

app.use(express.static(path.join(__dirname, '../public')));

let waitingPlayer = null;
const rooms = {};

const BOT_NAMES = ['小红','小美','晓晓','阿花','甜甜','橙子','草莓','柠檬','西瓜','芒果','桃子','荔枝','樱桃','葡萄','椰子'];
const BOT_AVATARS = ['🐱','🐰','🐼','🦊','🐸','🐨','🦁','🐯','🦋','🌸','🍓','🌈','⭐','🎀','🦄'];

function makeRoomId() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}
function randomBot() {
  const i = Math.floor(Math.random() * BOT_NAMES.length);
  const j = Math.floor(Math.random() * BOT_AVATARS.length);
  return { id: 'bot_' + Date.now(), name: BOT_NAMES[i], avatar: BOT_AVATARS[j] };
}
function broadcastCount() {
  io.emit('online_count', { count: io.engine.clientsCount });
}

io.on('connection', (socket) => {
  broadcastCount();

  socket.on('find_match', ({ name, avatar }) => {
    socket.playerName = name || '玩家';
    socket.playerAvatar = avatar || '😈';

    if (waitingPlayer && waitingPlayer.socket.connected && waitingPlayer.socket.id !== socket.id) {
      pairPlayers(waitingPlayer, { socket });
      waitingPlayer = null;
    } else {
      waitingPlayer = { socket };
      socket.emit('waiting');
      socket._botTimer = setTimeout(() => {
        if (waitingPlayer && waitingPlayer.socket.id === socket.id) {
          waitingPlayer = null;
          pairWithBot(socket);
        }
      }, 30000);
    }
  });

  socket.on('cancel_search', () => {
    clearTimeout(socket._botTimer);
    if (waitingPlayer && waitingPlayer.socket.id === socket.id) waitingPlayer = null;
  });

  socket.on('score_update', ({ score }) => {
    const roomId = getRoomOf(socket);
    if (!roomId || !rooms[roomId]) return;
    const room = rooms[roomId];
    room.scores[socket.id] = score;
    if (!room.isBot) socket.to(roomId).emit('opp_score', { score });
  });

  socket.on('rematch', () => {
    const roomId = getRoomOf(socket);
    if (!roomId || !rooms[roomId]) return;
    const room = rooms[roomId];
    if (room.isBot) {
      clearInterval(room.timerInterval);
      clearInterval(room.botInterval);
      delete rooms[roomId];
      socket.leave(roomId);
      pairWithBot(socket);
      return;
    }
    if (!room.rematch) room.rematch = new Set();
    room.rematch.add(socket.id);
    if (room.rematch.size === 2) {
      room.rematch.clear();
      room.players.forEach(p => { room.scores[p.id] = 0; });
      startCountdown(roomId);
    } else {
      socket.to(roomId).emit('opp_rematch');
    }
  });

  socket.on('disconnect', () => {
    clearTimeout(socket._botTimer);
    broadcastCount();
    if (waitingPlayer && waitingPlayer.socket.id === socket.id) waitingPlayer = null;
    const roomId = getRoomOf(socket);
    if (roomId && rooms[roomId]) {
      const room = rooms[roomId];
      if (!room.isBot) socket.to(roomId).emit('opp_disconnected');
      clearInterval(room.timerInterval);
      clearInterval(room.botInterval);
      delete rooms[roomId];
    }
  });
});

function pairPlayers(p1, p2) {
  clearTimeout(p1.socket._botTimer);
  clearTimeout(p2.socket._botTimer);
  const roomId = makeRoomId();
  p1.socket.join(roomId);
  p2.socket.join(roomId);
  rooms[roomId] = {
    isBot: false,
    players: [p1.socket, p2.socket],
    names: { [p1.socket.id]: p1.socket.playerName, [p2.socket.id]: p2.socket.playerName },
    avatars: { [p1.socket.id]: p1.socket.playerAvatar, [p2.socket.id]: p2.socket.playerAvatar },
    scores: { [p1.socket.id]: 0, [p2.socket.id]: 0 },
  };
  io.to(roomId).emit('matched', {
    roomId,
    players: [
      { id: p1.socket.id, name: p1.socket.playerName, avatar: p1.socket.playerAvatar },
      { id: p2.socket.id, name: p2.socket.playerName, avatar: p2.socket.playerAvatar },
    ],
  });
  startCountdown(roomId);
}

function pairWithBot(socket) {
  const bot = randomBot();
  const roomId = makeRoomId();
  socket.join(roomId);
  rooms[roomId] = {
    isBot: true, botId: bot.id,
    players: [socket],
    names: { [socket.id]: socket.playerName, [bot.id]: bot.name },
    avatars: { [socket.id]: socket.playerAvatar, [bot.id]: bot.avatar },
    scores: { [socket.id]: 0, [bot.id]: 0 },
  };
  socket.emit('matched', {
    roomId,
    isBot: true,
    players: [
      { id: socket.id, name: socket.playerName, avatar: socket.playerAvatar },
      { id: bot.id, name: bot.name, avatar: bot.avatar },
    ],
  });
  startCountdown(roomId);
}

function getRoomOf(socket) {
  for (const [roomId, room] of Object.entries(rooms)) {
    if (room.players.some(p => p.id === socket.id)) return roomId;
  }
  return null;
}

function startCountdown(roomId) {
  let cd = 3;
  io.to(roomId).emit('countdown', { n: cd });
  const iv = setInterval(() => {
    cd--;
    if (cd <= 0) {
      clearInterval(iv);
      io.to(roomId).emit('countdown', { n: 0 });
      startGame(roomId);
    } else {
      io.to(roomId).emit('countdown', { n: cd });
    }
  }, 1000);
}

function startGame(roomId) {
  const room = rooms[roomId];
  if (!room) return;
  room.timeLeft = 60;
  room.started = true;
  io.to(roomId).emit('game_start');

  if (room.isBot) {
    let botScore = 0, botCombo = 1, botLastHit = Date.now();
    const botSkill = 0.62 + Math.random() * 0.36; // 0.62~0.98
    const baseMs = Math.round(1050 - botSkill * 420); // ~630ms~1050ms per tick
    room.botInterval = setInterval(() => {
      if (!rooms[roomId]) { clearInterval(room.botInterval); return; }
      if (Math.random() < botSkill) {
        const now = Date.now();
        botCombo = (now - botLastHit < 2500) ? Math.min(botCombo + 1, 8) : 1;
        botLastHit = now;
        botScore += 10 * botCombo;
        room.scores[room.botId] = botScore;
        io.to(roomId).emit('opp_score', { score: botScore });
      }
    }, baseMs + Math.random() * 250);
  }

  room.timerInterval = setInterval(() => {
    if (!rooms[roomId]) { clearInterval(room.timerInterval); return; }
    room.timeLeft--;
    io.to(roomId).emit('tick', { timeLeft: room.timeLeft });
    if (room.timeLeft <= 0) {
      clearInterval(room.timerInterval);
      if (room.botInterval) clearInterval(room.botInterval);
      endGame(roomId);
    }
  }, 1000);
}

function endGame(roomId) {
  const room = rooms[roomId];
  if (!room) return;
  io.to(roomId).emit('game_over', {
    scores: room.scores,
    names: room.names,
    avatars: room.avatars,
    isBot: !!room.isBot,
  });
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`🎮 Server on port ${PORT}`));
