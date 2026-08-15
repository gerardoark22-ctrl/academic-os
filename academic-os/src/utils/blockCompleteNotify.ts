import type { TimeBlock } from '../types';
import { showBrowserNotification } from './notifications';
import { playBlockCompleteChime } from './epicSound';
import { browserNotificationsAllowed } from './notificationPolicy';

function nextBlockHint(blocks: TimeBlock[], completed: TimeBlock): string | null {
  const scheduled = blocks
    .filter((b) => b.title && b.type !== 'rest' && b.date === completed.date)
    .sort((a, b) => a.startTime.localeCompare(b.startTime));
  const idx = scheduled.findIndex((b) => b.id === completed.id);
  if (idx < 0) return null;
  const next = scheduled.slice(idx + 1).find((b) => !b.completed);
  if (!next) return 'Sin más bloques hoy — descansa o repasa.';
  return `Siguiente: ${next.startTime} — ${next.title}`;
}

/** Aviso OS + sonido al completar un bloque de time blocking con contenido */
export async function notifyBlockCompleted(
  block: TimeBlock,
  blocksToday: TimeBlock[],
): Promise<void> {
  if (!block.title || block.type === 'rest') return;

  await playBlockCompleteChime();

  if (!browserNotificationsAllowed()) return;
  if (!('Notification' in window) || Notification.permission !== 'granted') return;

  const hint = nextBlockHint(blocksToday, block);
  const body = hint
    ? `${block.startTime}–${block.endTime} · ${block.title}\n${hint}`
    : `${block.startTime}–${block.endTime} · ${block.title}`;

  showBrowserNotification('⚔ Bloque completado — cambia de tarea', body, `block-${block.id}`, {
    skipDedup: true,
  });
}
