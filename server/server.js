// ─────────────────────────────────────────────────────────────
//  CHIN — Real-time multiplayer card game server
//  Stack: Express + Socket.io
// ─────────────────────────────────────────────────────────────
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { v4 as uuidv4 } from 'uuid';

const app = express();

// CORS — configurable via environment variable
// Set CORS_ORIGIN to your frontend URL in production (e.g. https://chin-game.netlify.app)
// Defaults to '*' (all origins) for easy initial setup
const CORS_ORIGIN = process.env.CORS_ORIGIN || '*';

app.use(cors({ origin: CORS_ORIGIN }));

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: CORS_ORIGIN,
    methods: ['GET', 'POST'],
  },
});

// ─────────────────────── Constants ───────────────────────────
const TOTAL_CARDS = 50;
const HAND_SIZE = 4;
const WILDCARD_VALUE = 0; // comodín

// ─────────────── Room / Game State Storage ───────────────────
const rooms = new Map();

// ─────────────── Helper: shuffle array (Fisher-Yates) ────────
function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// ─────────────── Helper: build 50-card deck ──────────────────
// Cards 1-12 appear 4 times each (48) + 2 wildcards (value 0)
function buildDeck() {
  const deck = [];
  for (let v = 1; v <= 12; v++) {
    for (let s = 0; s < 4; s++) {
      deck.push({ id: uuidv4(), value: v });
    }
  }
  // 2 comodines
  deck.push({ id: uuidv4(), value: WILDCARD_VALUE });
  deck.push({ id: uuidv4(), value: WILDCARD_VALUE });
  return shuffle(deck);
}

// ─────────────── Helper: check if move is valid ──────────────
function isValidMove(cardValue, pileTopValue) {
  // Wildcard can be played on anything
  if (cardValue === WILDCARD_VALUE) return true;
  // The pile top is a wildcard — anything plays on it
  if (pileTopValue === WILDCARD_VALUE) return true;

  // Circular +1 / -1
  const diff = Math.abs(cardValue - pileTopValue);
  return diff === 1 || diff === 11; // 11 = circular wrap (1↔12)
}

// ─────────────── Helper: check CHIN condition ────────────────
function isChinValid(room) {
  const p1Top = room.piles[0][room.piles[0].length - 1];
  const p2Top = room.piles[1][room.piles[1].length - 1];
  if (!p1Top || !p2Top) return false;

  // Wildcards do NOT allow CHIN
  if (p1Top.value === WILDCARD_VALUE || p2Top.value === WILDCARD_VALUE)
    return false;

  return p1Top.value === p2Top.value;
}

// ─────────────── Helper: check if player has moves ───────────
function playerHasMoves(room, playerIdx) {
  const hand = room.hands[playerIdx];
  for (const card of hand) {
    if (card === null) continue;
    for (const pile of room.piles) {
      const top = pile[pile.length - 1];
      if (top && isValidMove(card.value, top.value)) return true;
    }
  }
  return false;
}

// ──── Helper: check if game is blocked (no player can move) ──
function isBlocked(room) {
  return !playerHasMoves(room, 0) && !playerHasMoves(room, 1);
}

// ─────────────── Helper: replenish hand from reserve ─────────
function replenishHand(room, playerIdx) {
  const hand = room.hands[playerIdx];
  const reserve = room.reserves[playerIdx];
  for (let i = 0; i < HAND_SIZE; i++) {
    if (hand[i] === null && reserve.length > 0) {
      hand[i] = reserve.shift();
    }
  }
}

// ─────────────── Helper: check win condition ─────────────────
function checkWin(room, playerIdx) {
  const hand = room.hands[playerIdx];
  const reserve = room.reserves[playerIdx];
  const allHandEmpty = hand.every((c) => c === null);
  return allHandEmpty && reserve.length === 0;
}

// ─────── Helper: build state snapshot for a player ───────────
function getPlayerState(room, playerIdx) {
  const opponentIdx = playerIdx === 0 ? 1 : 0;
  return {
    you: {
      hand: room.hands[playerIdx],
      reserveCount: room.reserves[playerIdx].length,
      playerIdx,
      name: room.players[playerIdx]?.name || `Jugador ${playerIdx + 1}`,
    },
    opponent: {
      hand: room.hands[opponentIdx].map((c) => (c ? { id: c.id } : null)), // hide values
      reserveCount: room.reserves[opponentIdx].length,
      playerIdx: opponentIdx,
      name: room.players[opponentIdx]?.name || `Jugador ${opponentIdx + 1}`,
    },
    piles: [
      room.piles[0].length > 0
        ? room.piles[0][room.piles[0].length - 1]
        : null,
      room.piles[1].length > 0
        ? room.piles[1][room.piles[1].length - 1]
        : null,
    ],
    pilesCounts: [room.piles[0].length, room.piles[1].length],
    started: room.started,
    chinAvailable: isChinValid(room),
    isBlocked: room.started ? isBlocked(room) : false,
  };
}

// ─── Helper: broadcast state to both players ───────────
function broadcastState(room) {
  for (let i = 0; i < 2; i++) {
    const p = room.players[i];
    if (p) {
      io.to(p.socketId).emit('game:state', getPlayerState(room, i));
    }
  }
}

// ─── Helper: generate short room code ───────────────────
function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 5; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

// ─────────────── Helper: deal and start the game ─────────────
function startGame(room) {
  const deck = buildDeck();
  const half = Math.floor(deck.length / 2);
  const p1Cards = deck.slice(0, half);
  const p2Cards = deck.slice(half);

  // First 4 cards go to hand, rest to reserve
  room.hands = [
    p1Cards.slice(0, HAND_SIZE),
    p2Cards.slice(0, HAND_SIZE),
  ];
  room.reserves = [
    p1Cards.slice(HAND_SIZE),
    p2Cards.slice(HAND_SIZE),
  ];

  // Initialize piles — each gets one card from each player's reserve
  room.piles = [
    [room.reserves[0].shift()],
    [room.reserves[1].shift()],
  ];

  room.started = true;
  room.winner = null;
  room.chinLock = false;

  broadcastState(room);
  io.to(room.code).emit('game:started');
}

// ═══════════════════════ Socket.io Logic ═════════════════════
io.on('connection', (socket) => {
  console.log(`⚡ Connected: ${socket.id}`);

  // ────────── CREATE ROOM ──────────
  socket.on('room:create', ({ playerName }, callback) => {
    const code = generateRoomCode();
    const room = {
      code,
      players: [{ socketId: socket.id, name: playerName || 'Jugador 1' }],
      hands: [[], []],
      reserves: [[], []],
      piles: [[], []],
      started: false,
      winner: null,
      chinLock: false,
      chat: [],
    };
    rooms.set(code, room);
    socket.join(code);
    socket.data.roomCode = code;
    socket.data.playerIdx = 0;
    console.log(`🏠 Room created: ${code} by ${playerName}`);
    callback({ success: true, code, playerIdx: 0 });
  });

  // ────────── JOIN ROOM ──────────
  socket.on('room:join', ({ code, playerName }, callback) => {
    const room = rooms.get(code);
    if (!room) {
      return callback({ success: false, error: 'Sala no encontrada.' });
    }
    if (room.players.length >= 2) {
      return callback({ success: false, error: 'La sala está llena.' });
    }
    room.players.push({
      socketId: socket.id,
      name: playerName || 'Jugador 2',
    });
    socket.join(code);
    socket.data.roomCode = code;
    socket.data.playerIdx = 1;
    console.log(`🤝 ${playerName} joined room ${code}`);
    callback({ success: true, code, playerIdx: 1 });

    // Notify both players
    io.to(code).emit('room:playerJoined', {
      players: room.players.map((p) => p.name),
    });

    // Auto-start when 2 players
    setTimeout(() => startGame(room), 1500);
  });

  // ────────── PLAY CARD ──────────
  socket.on('game:playCard', ({ handIndex, pileIndex }, callback) => {
    const roomCode = socket.data.roomCode;
    const playerIdx = socket.data.playerIdx;
    const room = rooms.get(roomCode);

    if (!room || !room.started || room.winner !== null) {
      return callback?.({ success: false, error: 'Juego no activo.' });
    }

    const hand = room.hands[playerIdx];
    const card = hand[handIndex];
    if (!card) {
      return callback?.({
        success: false,
        error: 'No hay carta en esa posición.',
      });
    }

    const pile = room.piles[pileIndex];
    const pileTop = pile[pile.length - 1];
    if (!pileTop) {
      return callback?.({ success: false, error: 'Pozo vacío.' });
    }

    if (!isValidMove(card.value, pileTop.value)) {
      return callback?.({
        success: false,
        error: 'Movimiento no válido.',
      });
    }

    // Valid move — apply
    pile.push(card);
    hand[handIndex] = null;

    // Replenish hand from reserve
    replenishHand(room, playerIdx);

    // Check win
    if (checkWin(room, playerIdx)) {
      // But cannot win with a wildcard as last card
      if (card.value === WILDCARD_VALUE) {
        // Put it back — can't end on wildcard
        pile.pop();
        hand[handIndex] = card;
        return callback?.({
          success: false,
          error: 'No podés terminar con un comodín.',
        });
      }
      room.winner = playerIdx;
      broadcastState(room);
      io.to(roomCode).emit('game:over', {
        winnerIdx: playerIdx,
        winnerName: room.players[playerIdx].name,
      });
      return callback?.({ success: true });
    }

    broadcastState(room);
    callback?.({ success: true });

    // Check for blocked state after the move
    if (isBlocked(room)) {
      setTimeout(() => handleBlocked(room), 1000);
    }
  });

  // ────────── CHIN ──────────
  socket.on('game:chin', (_, callback) => {
    const roomCode = socket.data.roomCode;
    const playerIdx = socket.data.playerIdx;
    const room = rooms.get(roomCode);

    if (!room || !room.started || room.winner !== null) {
      return callback?.({ success: false });
    }

    // Prevent double-chin race
    if (room.chinLock) {
      return callback?.({ success: false, error: 'Ya procesado.' });
    }
    room.chinLock = true;

    const opponentIdx = playerIdx === 0 ? 1 : 0;

    if (isChinValid(room)) {
      // CORRECT CHIN — opponent gets all pile cards
      const allPileCards = [...room.piles[0], ...room.piles[1]];
      room.reserves[opponentIdx].push(...allPileCards);

      // Reset piles with one card from each reserve
      room.piles = [[], []];
      if (room.reserves[0].length > 0)
        room.piles[0].push(room.reserves[0].shift());
      if (room.reserves[1].length > 0)
        room.piles[1].push(room.reserves[1].shift());

      io.to(roomCode).emit('game:chinResult', {
        callerIdx: playerIdx,
        callerName: room.players[playerIdx].name,
        correct: true,
        penalizedIdx: opponentIdx,
      });

      // Check win after CHIN
      if (checkWin(room, playerIdx)) {
        room.winner = playerIdx;
        broadcastState(room);
        io.to(roomCode).emit('game:over', {
          winnerIdx: playerIdx,
          winnerName: room.players[playerIdx].name,
        });
        room.chinLock = false;
        return callback?.({ success: true });
      }
    } else {
      // WRONG CHIN — caller gets all pile cards as penalty
      const allPileCards = [...room.piles[0], ...room.piles[1]];
      room.reserves[playerIdx].push(...allPileCards);

      // Reset piles
      room.piles = [[], []];
      if (room.reserves[0].length > 0)
        room.piles[0].push(room.reserves[0].shift());
      if (room.reserves[1].length > 0)
        room.piles[1].push(room.reserves[1].shift());

      io.to(roomCode).emit('game:chinResult', {
        callerIdx: playerIdx,
        callerName: room.players[playerIdx].name,
        correct: false,
        penalizedIdx: playerIdx,
      });
    }

    // Replenish both hands
    replenishHand(room, 0);
    replenishHand(room, 1);

    setTimeout(() => {
      room.chinLock = false;
      broadcastState(room);
    }, 800);

    callback?.({ success: true });
  });

  // ────────── HANDLE BLOCKED STATE ──────────
  function handleBlocked(room) {
    if (!room || !room.started || room.winner !== null) return;
    if (!isBlocked(room)) return;

    // Burn one card from each reserve onto piles
    let burned = false;
    for (let i = 0; i < 2; i++) {
      if (room.reserves[i].length > 0) {
        room.piles[i].push(room.reserves[i].shift());
        burned = true;
      }
    }

    if (!burned) {
      // No cards to burn — stalemate (very rare)
      io.to(room.code).emit('game:stalemate');
      return;
    }

    io.to(room.code).emit('game:unblocked');
    broadcastState(room);

    // Check again
    if (isBlocked(room)) {
      setTimeout(() => handleBlocked(room), 1200);
    }
  }

  // ────────── CHAT ──────────
  socket.on('chat:message', ({ message }) => {
    const roomCode = socket.data.roomCode;
    const playerIdx = socket.data.playerIdx;
    const room = rooms.get(roomCode);
    if (!room) return;

    const chatMsg = {
      id: uuidv4(),
      playerIdx,
      playerName: room.players[playerIdx]?.name || 'Anon',
      message: message.slice(0, 200),
      timestamp: Date.now(),
    };
    room.chat.push(chatMsg);
    io.to(roomCode).emit('chat:message', chatMsg);
  });

  // ────────── REMATCH ──────────
  socket.on('game:rematch', () => {
    const roomCode = socket.data.roomCode;
    const room = rooms.get(roomCode);
    if (!room || room.players.length < 2) return;

    if (!room.rematchVotes) room.rematchVotes = new Set();
    room.rematchVotes.add(socket.data.playerIdx);

    if (room.rematchVotes.size >= 2) {
      room.rematchVotes = null;
      startGame(room);
    } else {
      io.to(roomCode).emit('game:rematchRequested', {
        playerIdx: socket.data.playerIdx,
        playerName: room.players[socket.data.playerIdx].name,
      });
    }
  });

  // ────────── DISCONNECT ──────────
  socket.on('disconnect', () => {
    console.log(`💔 Disconnected: ${socket.id}`);
    const roomCode = socket.data.roomCode;
    if (!roomCode) return;
    const room = rooms.get(roomCode);
    if (!room) return;

    io.to(roomCode).emit('game:playerDisconnected', {
      playerIdx: socket.data.playerIdx,
    });

    // Clean up room after a delay
    setTimeout(() => {
      if (rooms.has(roomCode)) {
        const r = rooms.get(roomCode);
        const stillConnected = r.players.some((p) => {
          const s = io.sockets.sockets.get(p.socketId);
          return s && s.connected;
        });
        if (!stillConnected) {
          rooms.delete(roomCode);
          console.log(`🗑️ Room ${roomCode} deleted (empty)`);
        }
      }
    }, 30000);
  });
});

// ─── Health ─────────────────────────────────────────────
app.get('/', (_, res) => res.json({ status: 'CHIN server running 🃏' }));

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`🃏 CHIN server listening on port ${PORT}`);
  console.log(`🌐 CORS origin: ${CORS_ORIGIN}`);
});
