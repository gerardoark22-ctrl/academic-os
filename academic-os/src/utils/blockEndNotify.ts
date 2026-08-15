import type { TimeBlock } from '../types';
import { showBrowserNotification } from './notifications';
import { playBlockEndChime } from './epicSound';
import { browserNotificationsAllowed } from './notificationPolicy';

function nextBlockHint(blocks: TimeBlock[], ended: TimeBlock): string | null {
  const scheduled = blocks
    .filter((b) => b.title && b.type !== 'rest' && b.date === ended.date)
    .sort((a, b) => a.startTime.localeCompare(b.startTime));
  const idx = scheduled.findIndex((b) => b.id === ended.id);
  if (idx < 0) return null;
  const next = scheduled.slice(idx + 1).find((b) => !b.completed);
  if (!next) return 'Sin más bloques hoy — descansa o repasa.';
  return `Siguiente: ${next.startTime} — ${next.title}`;
}

/** Sonido (+ aviso OS si la pestaña está oculta) al terminar el slot de un bloque */
export async function notifyBlockEnded(
  block: TimeBlock,
  blocksToday: TimeBlock[],
): Promise<void> {
  if (!block.title || block.type === 'rest' || block.completed) return;

  await playBlockEndChime();

  if (!browserNotificationsAllowed()) return;
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  if (document.visibilityState === 'visible') return;

  const hint = nextBlockHint(blocksToday, block);
  const body = hint
    ? `${block.startTime}–${block.endTime} · ${block.title}\n${hint}`
    : `${block.startTime}–${block.endTime} · ${block.title}`;

  showBrowserNotification('⏰ Bloque terminado — cambia de tarea', body, `block-end-${block.id}`, {
    skipDedup: true,
  });
}
