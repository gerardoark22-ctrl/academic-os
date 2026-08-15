import { motion } from 'framer-motion';
import { useEffect, type ReactNode, type ButtonHTMLAttributes } from 'react';
import { createPortal } from 'react-dom';
import { getProgressGradient, getProgressGlow, getProgressAura } from '../../utils/progressGradients';

export { DynamicProgressBar } from './DynamicProgressBar';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'gold' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  children: ReactNode;
}

export function EpicButton({ variant = 'gold', size = 'md', children, className = '', ...props }: ButtonProps) {
  const sizes = { sm: 'px-3 py-1.5 text-sm', md: 'px-6 py-2.5 text-base', lg: 'px-10 py-3.5 text-lg' };
  return (
    <motion.div whileHover={{ y: -2 }} whileTap={{ y: 2 }} className="inline-block">
      <button
        className={`btn-war ${variant === 'danger' ? 'btn-war-danger' : ''} ${variant === 'ghost' ? 'opacity-80' : ''} ${sizes[size]} ${className}`}
        {...props}
      >
        {children}
      </button>
    </motion.div>
  );
}

interface SectionTitleProps {
  title: string;
  flavor?: string;
  large?: boolean;
  className?: string;
}

export function SectionTitle({ title, flavor, large, className = '' }: SectionTitleProps) {
  return (
    <div className={`mb-4 ${className}`}>
      <h2 className={large ? 'title-carved-lg' : 'title-carved'}>{title}</h2>
      {flavor && <p className="flavor-brutal mt-1">{flavor}</p>}
    </div>
  );
}

type ModalSize = 'md' | 'lg' | 'xl' | 'forge';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  flavor?: string;
  children: ReactNode;
  size?: ModalSize;
  panelClassName?: string;
  /** Apertura suave sin scale — evita glitches en paneles anchos */
  softOpen?: boolean;
}

const MODAL_WIDTH: Record<ModalSize, string> = {
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
  forge: 'max-w-5xl',
};

export function EpicModal({ open, onClose, title, flavor, children, size = 'md', panelClassName = '', softOpen = false }: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="epic-modal-overlay fixed inset-0 z-[200] flex items-center justify-center bg-ink/85 p-3 sm:p-5"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="epic-modal-title"
    >
      <motion.div
        initial={softOpen ? { opacity: 0, y: 10 } : { scale: 0.94, y: 20 }}
        animate={softOpen ? { opacity: 1, y: 0 } : { scale: 1, y: 0 }}
        transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
        className={`panel-epic epic-modal-panel relative flex max-h-[92vh] w-full flex-col ${MODAL_WIDTH[size]} ${panelClassName}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="panel-epic-inner shrink-0 border-b-2 border-ink/50 px-5 py-4 sm:px-6 sm:py-5">
          <SectionTitle title={title} flavor={flavor} className="mb-0 pr-8" large={size === 'forge'} />
          <button
            type="button"
            onClick={onClose}
            className="absolute right-4 top-4 stat-epic text-xl text-parchment-dim hover:text-blood-fresh sm:right-5 sm:top-5"
            aria-label="Cerrar"
          >
            ✕
          </button>
        </div>
        <div className="panel-epic-inner min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">{children}</div>
      </motion.div>
    </motion.div>,
    document.body,
  );
}

interface ProgressBarProps {
  value: number;
  max?: number;
  label?: string;
  showPulse?: boolean;
  variant?: 'gold' | 'blood' | 'marble' | 'xp' | 'study' | 'course' | 'streak';
  size?: 'sm' | 'lg';
  shimmer?: boolean;
  /** false = sin animación desde 0 al montar (ideal para misiones diarias) */
  animateEntry?: boolean;
}

export function ProgressBar({
  value,
  max = 100,
  label,
  showPulse = false,
  variant = 'gold',
  size = 'sm',
  shimmer = true,
  animateEntry = true,
}: ProgressBarProps) {
  const pct = Math.min(100, Math.round((value / max) * 100));
  const gradVariant =
    variant === 'blood' ? 'study' : variant === 'marble' ? 'course' : variant === 'gold' ? 'xp' : variant;
  const gradient = getProgressGradient(pct, gradVariant as 'xp' | 'study' | 'course' | 'streak');
  const glow = getProgressGlow(pct);
  const aura = getProgressAura(pct);

  return (
    <div className="w-full">
      {label && (
        <div className="mb-2 flex justify-between">
          <span className="label-clear text-sm">{label}</span>
          <span className="stat-epic text-highlight">{pct}%</span>
        </div>
      )}
      <div className="bar-aura-wrapper rounded-sm p-[3px]" style={{ boxShadow: aura }}>
        <div className={`bar-epic bar-epic-ryg ${size === 'lg' ? 'h-6' : ''} ${showPulse ? 'animate-pulse-blood' : ''} ${shimmer ? 'bar-shimmer' : ''}`}>
          <motion.div
            initial={animateEntry ? { width: 0 } : false}
            animate={{ width: `${pct}%` }}
            transition={{ duration: 0.45, ease: 'easeOut' }}
            className="bar-fill-ryg h-full"
            style={{ background: gradient, boxShadow: glow }}
          />
        </div>
      </div>
    </div>
  );
}

interface CardProps {
  children: ReactNode;
  className?: string;
  glow?: boolean;
  hero?: boolean;
}

export function StoneCard({ children, className = '', glow = false, hero = false }: CardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className={`${hero ? 'panel-hero' : 'panel-epic'} ${glow ? 'ring-2 ring-blood-dried/50' : ''} p-5 ${className}`}
    >
      <div className="panel-epic-inner">{children}</div>
    </motion.div>
  );
}

export function NotificationToast({ message, onClose }: {
  message: string;
  onClose: () => void;
}) {
  return (
    <motion.div
      initial={{ x: 300, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: 300, opacity: 0 }}
      className="panel-epic notification-toast fixed z-50 p-5 shadow-epic"
    >
      <div className="panel-epic-inner">
        <p className="body-parchment text-base">{message}</p>
        <button onClick={onClose} className="btn-war mt-3 px-4 py-1 text-sm">Descartar</button>
      </div>
    </motion.div>
  );
}

export function XpFloat({ amount, show }: { amount: number; show: boolean }) {
  if (!show) return null;
  return (
    <motion.div
      initial={{ opacity: 1, y: 0, scale: 1 }}
      animate={{ opacity: 0, y: -50, scale: 1.2 }}
      transition={{ duration: 1.5 }}
      className="stat-epic pointer-events-none absolute right-2 top-0 text-xl text-bronze-light"
    >
      +{amount} XP
    </motion.div>
  );
}
