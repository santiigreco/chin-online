import { useState, useEffect, useRef } from 'react';
import { socket } from '../socket';

export default function Lobby({ onJoin }) {
  const [playerName, setPlayerName] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [mode, setMode] = useState(null); // null | 'create' | 'join'
  const [waiting, setWaiting] = useState(false);
  const [createdCode, setCreatedCode] = useState('');
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    if (!socket.connected) socket.connect();

    socket.on('room:playerJoined', ({ players }) => {
      // Both players present
      if (players.length === 2) {
        setWaiting(false);
      }
    });

    return () => {
      socket.off('room:playerJoined');
    };
  }, []);

  const handleCreate = () => {
    if (!playerName.trim()) {
      setError('Ingresá tu nombre.');
      return;
    }
    setError('');
    socket.emit('room:create', { playerName: playerName.trim() }, (res) => {
      if (res.success) {
        setCreatedCode(res.code);
        setWaiting(true);
        onJoin({
          code: res.code,
          playerIdx: res.playerIdx,
          playerName: playerName.trim(),
        });
      }
    });
  };

  const handleJoin = () => {
    if (!playerName.trim()) {
      setError('Ingresá tu nombre.');
      return;
    }
    if (!roomCode.trim()) {
      setError('Ingresá el código de sala.');
      return;
    }
    setError('');
    socket.emit(
      'room:join',
      { code: roomCode.trim().toUpperCase(), playerName: playerName.trim() },
      (res) => {
        if (res.success) {
          onJoin({
            code: res.code,
            playerIdx: res.playerIdx,
            playerName: playerName.trim(),
          });
        } else {
          setError(res.error || 'No se pudo unir a la sala.');
        }
      }
    );
  };

  const copyCode = () => {
    navigator.clipboard.writeText(createdCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="lobby-bg flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-10 animate-slide-up">
          <h1
            className="text-7xl font-black tracking-wider mb-2"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            <span className="bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
              CHIN
            </span>
          </h1>
          <p className="text-text-secondary text-sm tracking-widest uppercase">
            Juego de cartas en tiempo real
          </p>
          <div className="mt-4 flex justify-center gap-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <div
                key={i}
                className="w-2 h-2 rounded-full bg-accent opacity-60"
                style={{ animationDelay: `${i * 0.15}s`, animation: 'float 2s ease-in-out infinite' }}
              />
            ))}
          </div>
        </div>

        {/* Main Panel */}
        <div className="glass p-8 animate-slide-up" style={{ animationDelay: '0.1s' }}>
          {/* Name Input */}
          <div className="mb-6">
            <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">
              Tu Nombre
            </label>
            <input
              ref={inputRef}
              type="text"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              placeholder="Ej: Santiago"
              maxLength={20}
              className="w-full px-4 py-3 rounded-xl bg-surface-3 border border-card-border 
                         text-text-primary placeholder-text-muted focus:outline-none focus:border-accent
                         focus:ring-1 focus:ring-accent transition-all text-sm"
            />
          </div>

          {error && (
            <div className="mb-4 px-4 py-2 rounded-lg bg-danger/10 border border-danger/20 text-danger text-sm">
              {error}
            </div>
          )}

          {/* Mode Selection */}
          {!mode && (
            <div className="space-y-3">
              <button
                onClick={() => setMode('create')}
                className="w-full py-3.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 
                           text-white font-semibold text-sm tracking-wide
                           hover:from-indigo-500 hover:to-purple-500 transition-all
                           hover:shadow-lg hover:shadow-accent/20 active:scale-[0.98]"
              >
                🏠 Crear Sala
              </button>
              <button
                onClick={() => setMode('join')}
                className="w-full py-3.5 rounded-xl bg-surface-3 border border-card-border
                           text-text-primary font-semibold text-sm tracking-wide
                           hover:border-accent/50 hover:bg-surface-3/80 transition-all
                           active:scale-[0.98]"
              >
                🔗 Unirse a Sala
              </button>
            </div>
          )}

          {/* Create Mode */}
          {mode === 'create' && !waiting && (
            <div className="space-y-4">
              <button
                onClick={handleCreate}
                className="w-full py-3.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 
                           text-white font-semibold text-sm
                           hover:from-indigo-500 hover:to-purple-500 transition-all
                           hover:shadow-lg hover:shadow-accent/20 active:scale-[0.98]"
              >
                Crear Partida
              </button>
              <button
                onClick={() => setMode(null)}
                className="w-full py-2 text-text-muted text-xs hover:text-text-secondary transition-colors"
              >
                ← Volver
              </button>
            </div>
          )}

          {/* Join Mode */}
          {mode === 'join' && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">
                  Código de Sala
                </label>
                <input
                  type="text"
                  value={roomCode}
                  onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                  placeholder="Ej: ABC12"
                  maxLength={5}
                  className="w-full px-4 py-3 rounded-xl bg-surface-3 border border-card-border 
                             text-text-primary placeholder-text-muted focus:outline-none focus:border-accent
                             focus:ring-1 focus:ring-accent transition-all text-center text-xl font-bold 
                             tracking-[0.3em]"
                  style={{ fontFamily: 'var(--font-display)' }}
                />
              </div>
              <button
                onClick={handleJoin}
                className="w-full py-3.5 rounded-xl bg-gradient-to-r from-green-600 to-emerald-600 
                           text-white font-semibold text-sm
                           hover:from-green-500 hover:to-emerald-500 transition-all
                           hover:shadow-lg hover:shadow-success/20 active:scale-[0.98]"
              >
                Unirse
              </button>
              <button
                onClick={() => setMode(null)}
                className="w-full py-2 text-text-muted text-xs hover:text-text-secondary transition-colors"
              >
                ← Volver
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <p className="text-center text-text-muted text-xs mt-8 tracking-wider">
          2 jugadores · Tiempo real · Socket.io
        </p>
      </div>
    </div>
  );
}
