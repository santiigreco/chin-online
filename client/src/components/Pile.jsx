import { motion, AnimatePresence } from 'framer-motion';

const CARD_SYMBOLS = {
  0: '★',
  1: '1', 2: '2', 3: '3', 4: '4', 5: '5', 6: '6',
  7: '7', 8: '8', 9: '9', 10: '10', 11: '11', 12: '12',
};

export default function Pile({ topCard, count, chinActive, pileIndex }) {
  if (!topCard) {
    return (
      <div className="pile">
        <span className="text-text-muted/30 text-sm">vacío</span>
      </div>
    );
  }

  const isWild = topCard.value === 0;
  const label = CARD_SYMBOLS[topCard.value] || '?';

  return (
    <div className="relative">
      {/* Count badge */}
      <div className="absolute -top-2 -right-2 z-10 w-6 h-6 rounded-full bg-surface-3 
                      border border-card-border flex items-center justify-center">
        <span className="text-[10px] font-bold text-text-secondary">{count}</span>
      </div>

      {/* Pile label */}
      <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-[10px] text-text-muted font-medium">
        Pozo {pileIndex + 1}
      </div>

      <AnimatePresence mode="popLayout">
        <motion.div
          key={topCard.id}
          initial={{ scale: 0.5, opacity: 0, rotateZ: -15 }}
          animate={{ scale: 1, opacity: 1, rotateZ: 0 }}
          exit={{ scale: 0.8, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 500, damping: 30 }}
          className={`pile pile-card ${isWild ? 'pile-wild' : ''} ${chinActive ? 'pile-chin' : ''}`}
        >
          {/* Corner values */}
          <span className="absolute top-2 left-2.5 text-xs font-bold opacity-50">
            {label}
          </span>
          <span className="absolute bottom-2 right-2.5 text-xs font-bold opacity-50 rotate-180">
            {label}
          </span>

          <span className={`${isWild ? 'text-3xl' : ''}`}>{label}</span>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
