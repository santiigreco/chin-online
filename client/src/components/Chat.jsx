import { useState, useEffect, useRef } from 'react';
import { socket } from '../socket';

export default function Chat({ playerIdx }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const scrollRef = useRef(null);

  useEffect(() => {
    const handler = (msg) => {
      setMessages((prev) => [...prev, msg]);
      if (!isOpen && msg.playerIdx !== playerIdx) {
        setUnread((u) => u + 1);
      }
    };
    socket.on('chat:message', handler);
    return () => socket.off('chat:message', handler);
  }, [isOpen, playerIdx]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const send = (e) => {
    e.preventDefault();
    if (!input.trim()) return;
    socket.emit('chat:message', { message: input.trim() });
    setInput('');
  };

  const toggle = () => {
    setIsOpen(!isOpen);
    if (!isOpen) setUnread(0);
  };

  return (
    <div className="fixed bottom-4 right-4 z-50">
      {/* Toggle Button */}
      <button
        onClick={toggle}
        className="w-12 h-12 rounded-full bg-accent/20 border border-accent/30 
                   flex items-center justify-center text-accent hover:bg-accent/30 
                   transition-all relative"
      >
        💬
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-danger 
                           text-[10px] font-bold text-white flex items-center justify-center">
            {unread}
          </span>
        )}
      </button>

      {/* Chat Panel */}
      {isOpen && (
        <div className="absolute bottom-14 right-0 w-72 glass rounded-xl overflow-hidden 
                        animate-slide-up shadow-2xl shadow-black/40">
          {/* Header */}
          <div className="px-4 py-2.5 border-b border-card-border/20 flex items-center justify-between">
            <span className="text-xs font-semibold text-text-secondary uppercase tracking-wider">
              Chat
            </span>
            <button
              onClick={toggle}
              className="text-text-muted hover:text-text-primary transition-colors text-sm"
            >
              ✕
            </button>
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="h-48 overflow-y-auto p-3 space-y-2">
            {messages.length === 0 && (
              <p className="text-text-muted text-xs text-center mt-8">
                Sin mensajes aún...
              </p>
            )}
            {messages.map((m) => (
              <div
                key={m.id}
                className={`flex flex-col ${
                  m.playerIdx === playerIdx ? 'items-end' : 'items-start'
                }`}
              >
                <span className="text-[9px] text-text-muted mb-0.5">
                  {m.playerName}
                </span>
                <div
                  className={`px-3 py-1.5 rounded-xl text-xs max-w-[85%] ${
                    m.playerIdx === playerIdx
                      ? 'bg-accent/20 text-accent-2'
                      : 'bg-surface-3 text-text-primary'
                  }`}
                >
                  {m.message}
                </div>
              </div>
            ))}
          </div>

          {/* Input */}
          <form onSubmit={send} className="p-2 border-t border-card-border/20">
            <div className="flex gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Escribí algo..."
                maxLength={200}
                className="flex-1 px-3 py-1.5 rounded-lg bg-surface-3 border border-card-border/30
                           text-text-primary text-xs placeholder-text-muted focus:outline-none
                           focus:border-accent/50 transition-all"
              />
              <button
                type="submit"
                className="px-3 py-1.5 rounded-lg bg-accent/20 text-accent text-xs font-semibold
                           hover:bg-accent/30 transition-all"
              >
                →
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
