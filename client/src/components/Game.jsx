import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { socket } from '../socket';
import Card from './Card';
import Pile from './Pile';
import Chat from './Chat';

// ─── Check if a card value is ±1 (circular) from pile value ───
function isValidMove(cardValue, pileValue) {
  if (cardValue === 0) return true; // wildcard
  if (pileValue === 0) return true; // pile is wildcard
  const diff = Math.abs(cardValue - pileValue);
  return diff === 1 || diff === 11;
}

export default function Game({ roomCode, playerIdx, playerName, onLeave }) {
  const [state, setState] = useState(null);
  const [selectedCard, setSelectedCard] = useState(null); // hand index
  const [notification, setNotification] = useState(null);
  const [chinResult, setChinResult] = useState(null);
  const [gameOver, setGameOver] = useState(null);
  const [disconnected, setDisconnected] = useState(false);
  const [waiting, setWaiting] = useState(true);
  const [rematchRequested, setRematchRequested] = useState(false);
  const notifTimeout = useRef(null);

  // ─── Show notification ───
  const showNotif = useCallback((msg, type = 'info', duration = 2500) => {
    if (notifTimeout.current) clearTimeout(notifTimeout.current);
    setNotification({ msg, type });
    notifTimeout.current = setTimeout(() => setNotification(null), duration);
  }, []);

  // ─── Socket event listeners ───
  useEffect(() => {
    socket.on('game:state', (newState) => {
      setState(newState);
      setWaiting(false);
    });

    socket.on('game:started', () => {
      setWaiting(false);
      setGameOver(null);
      setRematchRequested(false);
      showNotif('¡La partida comenzó!', 'success');
    });

    socket.on('game:chinResult', ({ callerName, correct, penalizedIdx }) => {
      setChinResult({
        callerName,
        correct,
        penalized: penalizedIdx === playerIdx,
      });
      setTimeout(() => setChinResult(null), 2500);

      if (correct) {
        showNotif(
          `${callerName} cantó ¡CHIN! correctamente`,
          'success',
          3000
        );
      } else {
        showNotif(
          `${callerName} cantó CHIN incorrecto — ¡penalización!`,
          'danger',
          3000
        );
      }
    });

    socket.on('game:over', ({ winnerIdx, winnerName }) => {
      setGameOver({ winnerIdx, winnerName, isMe: winnerIdx === playerIdx });
    });

    socket.on('game:unblocked', () => {
      showNotif('Bloqueo resuelto — se quemaron cartas', 'warning');
    });

    socket.on('game:stalemate', () => {
      showNotif('¡Empate! No quedan cartas para desbloquear.', 'warning', 5000);
    });

    socket.on('game:playerDisconnected', () => {
      setDisconnected(true);
    });

    socket.on('game:rematchRequested', ({ playerName: name }) => {
      setRematchRequested(true);
      showNotif(`${name} quiere revancha`, 'info');
    });

    return () => {
      socket.off('game:state');
      socket.off('game:started');
      socket.off('game:chinResult');
      socket.off('game:over');
      socket.off('game:unblocked');
      socket.off('game:stalemate');
      socket.off('game:playerDisconnected');
      socket.off('game:rematchRequested');
    };
  }, [playerIdx, showNotif]);

  // ─── Keyboard shortcuts ───
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!state || gameOver || !state.started) return;

      // 1-4 for selecting cards
      if (['1', '2', '3', '4'].includes(e.key)) {
        const idx = parseInt(e.key) - 1;
        if (state.you.hand[idx]) {
          setSelectedCard((prev) => (prev === idx ? null : idx));
        }
        return;
      }

      // Q/E for playing on pile 0/1
      if (selectedCard !== null) {
        if (e.key.toLowerCase() === 'q') {
          playCard(selectedCard, 0);
          return;
        }
        if (e.key.toLowerCase() === 'e') {
          playCard(selectedCard, 1);
          return;
        }
      }

      // Space for CHIN
      if (e.key === ' ' || e.code === 'Space') {
        e.preventDefault();
        handleChin();
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [state, selectedCard, gameOver]);

  // ─── Play a card ───
  const playCard = useCallback(
    (handIndex, pileIndex) => {
      if (!state || gameOver) return;
      socket.emit('game:playCard', { handIndex, pileIndex }, (res) => {
        if (!res.success) {
          showNotif(res.error || 'Movimiento no válido', 'danger');
        }
        setSelectedCard(null);
      });
    },
    [state, gameOver, showNotif]
  );

  // ─── Handle card click ───
  const handleCardClick = (handIndex) => {
    if (!state || gameOver) return;

    if (selectedCard === handIndex) {
      // Deselect
      setSelectedCard(null);
      return;
    }

    setSelectedCard(handIndex);
  };

  // ─── Handle pile click (to play selected card) ───
  const handlePileClick = (pileIndex) => {
    if (selectedCard === null || !state || gameOver) return;
    playCard(selectedCard, pileIndex);
  };

  // ─── CHIN ───
  const handleChin = useCallback(() => {
    if (!state || gameOver) return;
    socket.emit('game:chin', {}, (res) => {
      if (!res.success && res.error) {
        showNotif(res.error, 'warning');
      }
    });
  }, [state, gameOver, showNotif]);

  // ─── Rematch ───
  const handleRematch = () => {
    socket.emit('game:rematch');
    setRematchRequested(true);
  };

  // ─── Loading state ───
  if (waiting || !state) {
    return (
      <div className="lobby-bg flex flex-col items-center justify-center gap-6">
        <div className="glass p-10 text-center">
          <h2
            className="text-3xl font-bold mb-4"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            <span className="bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
              CHIN
            </span>
          </h2>
          <p className="text-text-secondary text-sm mb-4">
            Esperando al oponente...
          </p>
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="text-xs text-text-muted">Código de sala:</div>
            <div
              className="px-4 py-1.5 rounded-lg bg-surface-3 border border-card-border 
                          text-lg font-bold tracking-[0.3em] text-accent"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              {roomCode}
            </div>
          </div>
          <div className="flex justify-center gap-1.5">
            {[0, 1, 2].map((i) => (
              <motion.div
                key={i}
                className="w-2 h-2 rounded-full bg-accent"
                animate={{ opacity: [0.3, 1, 0.3] }}
                transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2 }}
              />
            ))}
          </div>
        </div>
      </div>
    );
  }

  const { you, opponent, piles, pilesCounts, chinAvailable, isBlocked } = state;

  // Check which cards are playable
  const playableMap = you.hand.map((card) => {
    if (!card) return [false, false];
    return [
      piles[0] ? isValidMove(card.value, piles[0].value) : false,
      piles[1] ? isValidMove(card.value, piles[1].value) : false,
    ];
  });

  return (
    <div className="min-h-screen bg-surface flex flex-col relative overflow-hidden">
      {/* Background gradients */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] 
                        bg-accent/5 rounded-full blur-[100px]" />
        <div className="absolute bottom-0 left-1/4 w-[400px] h-[200px] 
                        bg-purple-500/5 rounded-full blur-[80px]" />
      </div>

      {/* ═══════ Top Bar ═══════ */}
      <div className="relative z-10 flex items-center justify-between px-4 py-3 
                      border-b border-card-border/10">
        <div className="flex items-center gap-3">
          <h1
            className="text-lg font-bold tracking-wider"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            <span className="bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
              CHIN
            </span>
          </h1>
          <span className="text-[10px] text-text-muted px-2 py-0.5 rounded bg-surface-3 font-mono">
            {roomCode}
          </span>
        </div>

        <div className="flex items-center gap-4">
          {isBlocked && (
            <span className="text-xs text-warning animate-pulse font-medium">
              ⚠ Bloqueado — resolviendo...
            </span>
          )}
          <span className="text-xs text-text-muted hidden sm:block">
            [1-4] Carta · [Q/E] Pozo · [Espacio] CHIN
          </span>
        </div>
      </div>

      {/* ═══════ Game Board ═══════ */}
      <div className="relative z-10 flex-1 flex flex-col items-center justify-between 
                      px-4 py-4 max-w-2xl mx-auto w-full">

        {/* ─── Opponent Area ─── */}
        <div className="w-full mb-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-surface-3 border border-card-border 
                              flex items-center justify-center text-xs font-bold text-accent">
                {opponent.name?.charAt(0).toUpperCase()}
              </div>
              <div>
                <p className="text-sm font-semibold text-text-primary">{opponent.name}</p>
                <p className="text-[10px] text-text-muted">
                  Reserva: {opponent.reserveCount} cartas
                </p>
              </div>
            </div>
            {/* Opponent reserve visual */}
            <div className="flex items-center gap-1.5">
              <div className="card-back w-[40px] h-[56px] rounded-lg">
                <div className="card-back-pattern w-[60%] h-[60%] rounded" />
              </div>
              <span className="text-xs text-text-muted font-mono">
                ×{opponent.reserveCount}
              </span>
            </div>
          </div>

          {/* Opponent hand (face down) */}
          <div className="flex justify-center gap-2">
            {opponent.hand.map((card, i) => (
              <Card key={`opp-${i}`} card={card} index={i} isOpponent small />
            ))}
          </div>
        </div>

        {/* ─── Central Piles + CHIN ─── */}
        <div className="flex flex-col items-center gap-6 my-4">
          <div className="flex items-center gap-8 sm:gap-14">
            {/* Pile 0 */}
            <motion.div
              className="cursor-pointer"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => handlePileClick(0)}
            >
              <Pile
                topCard={piles[0]}
                count={pilesCounts[0]}
                chinActive={chinAvailable}
                pileIndex={0}
              />
              {selectedCard !== null && playableMap[selectedCard]?.[0] && (
                <div className="mt-2 text-center">
                  <span className="text-[10px] text-success font-semibold animate-pulse">
                    [Q] Jugar aquí
                  </span>
                </div>
              )}
            </motion.div>

            {/* CHIN Button */}
            <div className="flex flex-col items-center gap-2">
              <button
                onClick={handleChin}
                className={`chin-btn ${chinAvailable ? 'chin-available' : ''}`}
                disabled={!state.started || !!gameOver}
              >
                CHIN
              </button>
              <span className="text-[10px] text-text-muted">[Espacio]</span>
              {chinAvailable && (
                <motion.span
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-xs text-gold font-bold animate-pulse"
                >
                  ¡OPORTUNIDAD!
                </motion.span>
              )}
            </div>

            {/* Pile 1 */}
            <motion.div
              className="cursor-pointer"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => handlePileClick(1)}
            >
              <Pile
                topCard={piles[1]}
                count={pilesCounts[1]}
                chinActive={chinAvailable}
                pileIndex={1}
              />
              {selectedCard !== null && playableMap[selectedCard]?.[1] && (
                <div className="mt-2 text-center">
                  <span className="text-[10px] text-success font-semibold animate-pulse">
                    [E] Jugar aquí
                  </span>
                </div>
              )}
            </motion.div>
          </div>
        </div>

        {/* ─── Your Area ─── */}
        <div className="w-full mt-4">
          {/* Your hand */}
          <div className="flex justify-center gap-3 mb-4">
            <AnimatePresence mode="popLayout">
              {you.hand.map((card, i) => (
                <motion.div
                  key={card ? card.id : `empty-${i}`}
                  layout
                  className={`relative ${
                    selectedCard === i
                      ? 'ring-2 ring-accent ring-offset-2 ring-offset-surface rounded-xl'
                      : ''
                  }`}
                >
                  <Card
                    card={card}
                    index={i}
                    playable={playableMap[i]?.some(Boolean)}
                    disabled={!card}
                    onClick={() => handleCardClick(i)}
                  />
                  {selectedCard === i && (
                    <motion.div
                      layoutId="selectedIndicator"
                      className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-1.5 h-1.5 
                                 rounded-full bg-accent"
                    />
                  )}
                </motion.div>
              ))}
            </AnimatePresence>
          </div>

          {/* Your info */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-accent/20 border border-accent/30 
                              flex items-center justify-center text-xs font-bold text-accent">
                {you.name?.charAt(0).toUpperCase()}
              </div>
              <div>
                <p className="text-sm font-semibold text-text-primary">
                  {you.name}
                  <span className="text-[10px] text-accent ml-1">(vos)</span>
                </p>
                <p className="text-[10px] text-text-muted">
                  Reserva: {you.reserveCount} cartas
                </p>
              </div>
            </div>

            {/* Your reserve visual */}
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-text-muted font-mono">
                ×{you.reserveCount}
              </span>
              <div className="card-back w-[40px] h-[56px] rounded-lg">
                <div className="card-back-pattern w-[60%] h-[60%] rounded" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ═══════ Notifications ═══════ */}
      <AnimatePresence>
        {notification && (
          <motion.div
            initial={{ opacity: 0, y: -30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -30 }}
            className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 px-6 py-3 rounded-xl 
                        glass text-sm font-medium shadow-2xl shadow-black/30
                        ${notification.type === 'success' ? 'border-success/40 text-success' : ''}
                        ${notification.type === 'danger' ? 'border-danger/40 text-danger' : ''}
                        ${notification.type === 'warning' ? 'border-warning/40 text-warning' : ''}
                        ${notification.type === 'info' ? 'border-accent/40 text-accent-2' : ''}
                       `}
          >
            {notification.msg}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ═══════ CHIN Result Overlay ═══════ */}
      <AnimatePresence>
        {chinResult && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="fixed inset-0 z-40 flex items-center justify-center pointer-events-none"
          >
            <div
              className={`glass px-12 py-8 text-center rounded-2xl shadow-2xl 
                          ${chinResult.correct ? 'border-gold/30' : 'border-danger/30'}`}
            >
              <div className="text-5xl mb-3">{chinResult.correct ? '🎉' : '💥'}</div>
              <h2
                className={`text-3xl font-black mb-2 ${
                  chinResult.correct ? 'text-gold' : 'text-danger'
                }`}
                style={{ fontFamily: 'var(--font-display)' }}
              >
                {chinResult.correct ? '¡CHIN!' : 'CHIN Falso'}
              </h2>
              <p className="text-text-secondary text-sm">
                {chinResult.correct
                  ? `${chinResult.callerName} acertó`
                  : `${chinResult.callerName} recibe penalización`}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ═══════ Game Over Overlay ═══════ */}
      <AnimatePresence>
        {gameOver && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.7, y: 30 }}
              animate={{ scale: 1, y: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 25 }}
              className="glass p-10 text-center rounded-2xl max-w-sm w-full mx-4"
            >
              <div className="text-6xl mb-4">{gameOver.isMe ? '🏆' : '😔'}</div>
              <h2
                className="text-3xl font-black mb-2"
                style={{ fontFamily: 'var(--font-display)' }}
              >
                <span
                  className={`${
                    gameOver.isMe
                      ? 'bg-gradient-to-r from-yellow-400 to-amber-400'
                      : 'bg-gradient-to-r from-red-400 to-pink-400'
                  } bg-clip-text text-transparent`}
                >
                  {gameOver.isMe ? '¡Ganaste!' : 'Perdiste'}
                </span>
              </h2>
              <p className="text-text-secondary text-sm mb-6">
                {gameOver.winnerName} se quedó sin cartas
              </p>

              <div className="flex flex-col gap-3">
                <button
                  onClick={handleRematch}
                  disabled={rematchRequested}
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 
                             text-white font-semibold text-sm
                             hover:from-indigo-500 hover:to-purple-500 transition-all
                             disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {rematchRequested ? 'Esperando al rival...' : '🔄 Revancha'}
                </button>
                <button
                  onClick={onLeave}
                  className="w-full py-3 rounded-xl bg-surface-3 border border-card-border
                             text-text-secondary font-semibold text-sm
                             hover:text-text-primary hover:border-card-border/40 transition-all"
                >
                  Salir al Lobby
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ═══════ Disconnection Overlay ═══════ */}
      <AnimatePresence>
        {disconnected && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          >
            <div className="glass p-10 text-center rounded-2xl max-w-sm mx-4">
              <div className="text-5xl mb-4">💔</div>
              <h2
                className="text-2xl font-bold mb-2 text-danger"
                style={{ fontFamily: 'var(--font-display)' }}
              >
                Oponente desconectado
              </h2>
              <p className="text-text-secondary text-sm mb-6">
                Tu rival abandonó la partida.
              </p>
              <button
                onClick={onLeave}
                className="w-full py-3 rounded-xl bg-accent/20 text-accent font-semibold text-sm
                           hover:bg-accent/30 transition-all"
              >
                Volver al Lobby
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ═══════ Chat ═══════ */}
      <Chat playerIdx={playerIdx} />
    </div>
  );
}
