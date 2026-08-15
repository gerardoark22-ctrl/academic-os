import { motion, AnimatePresence } from 'framer-motion';

interface EpicWarCheckboxProps {
  checked: boolean;
  onToggle: () => void;
  size?: 'sm' | 'md';
  label?: string;
}

export function EpicWarCheckbox({ checked, onToggle, size = 'md', label }: EpicWarCheckboxProps) {
  const dim = size === 'sm' ? 'epic-war-checkbox-sm' : 'epic-war-checkbox-md';

  return (
    <motion.button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      title={checked ? 'Desmarcar (−XP)' : 'Conquistar (+XP)'}
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
      className={`epic-war-checkbox ${dim} ${checked ? 'epic-war-checkbox-on' : ''}`}
      whileTap={{ scale: 0.88 }}
      animate={
        checked
          ? {
              boxShadow: [
                '0 0 0 rgba(255,215,0,0)',
                '0 0 14px rgba(255,215,0,0.65)',
                '0 0 6px rgba(255,215,0,0.35)',
              ],
            }
          : { boxShadow: '0 2px 0 #1A0F08' }
      }
      transition={{ duration: 0.45 }}
    >
      <AnimatePresence mode="wait">
        {checked ? (
          <motion.span
            key="on"
            initial={{ scale: 0, rotate: -120, opacity: 0 }}
            animate={{ scale: 1, rotate: 0, opacity: 1 }}
            exit={{ scale: 0, rotate: 90, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 520, damping: 22 }}
            className="epic-war-checkbox-mark"
          >
            ⚔
          </motion.span>
        ) : (
          <motion.span
            key="off"
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.35 }}
            exit={{ opacity: 0 }}
            className="epic-war-checkbox-empty"
            aria-hidden
          />
        )}
      </AnimatePresence>
      {checked && (
        <motion.span
          className="epic-war-checkbox-ring"
          initial={{ scale: 0.6, opacity: 0.8 }}
          animate={{ scale: 1.8, opacity: 0 }}
          transition={{ duration: 0.55, ease: 'easeOut' }}
          aria-hidden
        />
      )}
    </motion.button>
  );
}

interface StudyMinutesBadgeProps {
  minutes: number;
  domainLabel: string;
}

export function StudyMinutesBadge({ minutes, domainLabel }: StudyMinutesBadgeProps) {
  return (
    <p className="text-readable-dim flex items-center gap-1 text-xs">
      <span>{domainLabel}</span>
      <span>·</span>
      <motion.span
        key={minutes}
        initial={{ scale: 1.35, color: '#FFD700' }}
        animate={{ scale: 1, color: '#C4B8A0' }}
        transition={{ type: 'spring', stiffness: 400, damping: 18 }}
        className="stat-epic inline-block tabular-nums"
      >
        {minutes}m
      </motion.span>
    </p>
  );
}
