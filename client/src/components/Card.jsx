import { motion } from 'framer-motion';

const CARD_SYMBOLS = {
  0: '★',   // Wildcard
  1: '1',
  2: '2',
  3: '3',
  4: '4',
  5: '5',
  6: '6',
  7: '7',
  8: '8',
  9: '9',
  10: '10',
  11: '11',
  12: '12',
};

export default function Card({
  card,
  index,
  playable = false,
  disabled = false,
  onClick,
  isOpponent = false,
  small = false,
}) {
  if (!card) {
    // Empty slot
    return (
      <div
        className={`${small ? 'w-[60px] h-[84px]' : 'w-[80px] h-[112px]'} rounded-xl border-2 border-dashed 
                    border-card-border/30 flex items-center justify-center`}
      >
        <span className="text-text-muted/30 text-xs">vacío</span>
      </div>
    );
  }

  if (isOpponent) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.2, delay: index * 0.05 }}
        className={`card-back ${small ? 'w-[60px] h-[84px]' : ''}`}
      >
        <div className="card-back-pattern" />
      </motion.div>
    );
  }

  const isWild = card.value === 0;
  const label = CARD_SYMBOLS[card.value] || '?';

  const cardClasses = [
    'card',
    small ? 'w-[60px] h-[84px] text-base' : '',
    isWild ? 'card-wild' : '',
    playable ? 'card-playable' : '',
    disabled ? 'card-disabled' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.5, rotate: -10 }}
      animate={{ opacity: 1, scale: 1, rotate: 0 }}
      exit={{ opacity: 0, scale: 0.5, y: -50 }}
      transition={{ type: 'spring', stiffness: 400, damping: 25, delay: index * 0.05 }}
      whileHover={!disabled ? { y: -8, scale: 1.06 } : {}}
      whileTap={!disabled ? { scale: 0.95 } : {}}
      className={cardClasses}
      onClick={!disabled ? onClick : undefined}
    >
      {/* Corner values */}
      <span className="absolute top-1.5 left-2 text-[10px] font-bold opacity-60">
        {label}
      </span>
      <span className="absolute bottom-1.5 right-2 text-[10px] font-bold opacity-60 rotate-180">
        {label}
      </span>

      {/* Center value */}
      <span className={`${isWild ? 'text-2xl' : ''}`}>{label}</span>

      {/* Keyboard hint */}
      {index !== undefined && index >= 0 && !isOpponent && (
        <span className="absolute bottom-1 left-1/2 -translate-x-1/2 text-[9px] 
                          text-text-muted/40 font-mono">
          {index + 1}
        </span>
      )}
    </motion.div>
  );
}
