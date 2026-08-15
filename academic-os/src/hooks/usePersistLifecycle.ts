import { useEffect } from 'react';
import { persistQueue } from '../utils/persistQueue';

const BACKUP_HINT =
  '¿Exportaste tu backup (💾)? Los datos viven en este navegador. Guarda una copia antes de cerrar.';

/**
 * Flush al ocultar pestaña + aviso de backup al cerrar + guardado de seguridad periódico.
 */
export function usePersistLifecycle() {
  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') {
        void persistQueue.drain();
      }
    };

    const onPageHide = () => {
      void persistQueue.drain();
    };

    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      void persistQueue.flush();
      e.preventDefault();
      e.returnValue = BACKUP_HINT;
      return BACKUP_HINT;
    };

    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', onPageHide);
    window.addEventListener('beforeunload', onBeforeUnload);

    const safetyId = persistQueue.startSafetyInterval();

    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', onPageHide);
      window.removeEventListener('beforeunload', onBeforeUnload);
      window.clearInterval(safetyId);
    };
  }, []);
}
