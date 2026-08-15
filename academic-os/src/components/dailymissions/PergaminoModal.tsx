import { useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { SectionTitle } from '../ui';

interface PergaminoModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  flavor?: string;
  children: ReactNode;
}

/** Modal del pergamino — solo CSS, sin animaciones Framer que parpadean */
export function PergaminoModal({ open, onClose, title, flavor, children }: PergaminoModalProps) {
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
    <div
      className="pergamino-modal-overlay"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="pergamino-modal-title"
    >
      <div
        className="panel-epic pergamino-modal-panel daily-missions-modal-panel"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="panel-epic-inner pergamino-modal-header relative shrink-0 border-b-2 border-ink/50 px-5 py-4 sm:px-6 sm:py-5">
          <SectionTitle title={title} flavor={flavor} className="mb-0 pr-8" />
          <button
            type="button"
            onClick={onClose}
            className="absolute right-4 top-4 stat-epic text-xl text-parchment-dim hover:text-blood-fresh sm:right-5 sm:top-5"
            aria-label="Cerrar"
          >
            ✕
          </button>
        </div>
        <div className="panel-epic-inner pergamino-modal-body min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
          {children}
        </div>
      </div>
    </div>,
    document.body,
  );
}
