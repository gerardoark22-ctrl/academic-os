import type { Mission, NotificationMessage } from '../types';
import { daysUntil, underworldDays, generateId, todayISO } from './gamification';
import { wasBrowserNotifSent, markBrowserNotifSent } from './notificationGate';
import { browserNotificationsAllowed } from './notificationPolicy';

export const zeusMessages = {
  reminder: (taskName: string, days: number) =>
    `⚡ Zeus te recuerda: ${taskName} en ${days} días`,
  tomorrow: (taskName: string) =>
    `⚡ ¡El Olimpo tiembla! ${taskName} es MAÑANA`,
  furious: (percentage: number) =>
    `⚡ Zeus está FURIOSO. Tu Ira de los Dioses es ${percentage}%`,
};

export const heraldMessages = {
  pending: (count: number) =>
    `📜 Un mensajero llega: Tienes ${count} tareas pendientes`,
  levelUp: (level: number) =>
    `📜 El heraldo anuncia: Has subido a nivel ${level}`,
  levelDown: (level: number) =>
    `☠ Hades proclama: Has caído a nivel ${level}`,
  courseComplete: (course: string) =>
    `📜 Noticias del Ágora: Completaste ${course} al 100%`,
};

export const hadesMessages = {
  inactive: (days: number) =>
    `⚰️ Hades susurra: Llevas ${days} días sin estudiar...`,
  call: () => '⚰️ El Inframundo te llama: ¡Regresa al estudio!',
  souls: () => '⚰️ Las almas perdidas te esperan... Estudia hoy',
};

export const scheduledMessages = [
  { time: '08:00', message: 'Buenos días, Gerardex. Tu destino te espera' },
  { time: '14:00', message: 'El sol está en lo alto. ¿Has estudiado hoy?' },
  { time: '20:00', message: 'La noche cae. Revisa tus misiones pendientes' },
];

export function createNotification(
  type: NotificationMessage['type'],
  message: string,
): NotificationMessage {
  return {
    id: generateId(),
    type,
    message,
    timestamp: new Date().toISOString(),
    read: false,
  };
}

export function checkMissionNotifications(missions: Mission[]): NotificationMessage[] {
  const notifications: NotificationMessage[] = [];
  const pending = missions.filter((m) => !m.completed);

  for (const mission of pending) {
    const days = daysUntil(mission.dueDate);
    if (days === 0) {
      notifications.push(createNotification('zeus', `⚔️ ¡HOY ES LA BATALLA! ${mission.title}`));
    } else if (days === 1) {
      notifications.push(createNotification('zeus', zeusMessages.tomorrow(mission.title)));
    } else if (days === 3) {
      notifications.push(createNotification('zeus', zeusMessages.reminder(mission.title, 3)));
    }
  }

  if (pending.length > 0) {
    notifications.push(createNotification('herald', heraldMessages.pending(pending.length)));
  }

  return notifications;
}

export function checkHadesNotification(lastStudyDate: string | null): NotificationMessage | null {
  const today = todayISO();
  if (!lastStudyDate || lastStudyDate === today) return null;
  const days = underworldDays(lastStudyDate);
  if (days <= 0) return null;
  if (days > 3) return createNotification('hades', hadesMessages.inactive(days));
  return createNotification('hades', hadesMessages.call());
}

export function checkAngerNotification(anger: number): NotificationMessage | null {
  if (anger > 70) {
    return createNotification('zeus', zeusMessages.furious(anger));
  }
  return null;
}

export async function requestNotificationPermission(): Promise<boolean> {
  if (!('Notification' in window)) return false;
  if (!browserNotificationsAllowed()) return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') return false;
  const result = await Notification.requestPermission();
  return result === 'granted';
}

export interface BrowserNotificationOptions {
  /** Si true, permite repetir el mismo tag (p. ej. bloques distintos) */
  skipDedup?: boolean;
}

export function showBrowserNotification(
  title: string,
  body: string,
  tag = 'general',
  opts?: BrowserNotificationOptions,
): void {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  if (!browserNotificationsAllowed()) return;
  if (!opts?.skipDedup && wasBrowserNotifSent(tag)) return;
  if (!opts?.skipDedup) markBrowserNotifSent(tag);
  try {
    new Notification(title, {
      body,
      icon: '/icons/gerardex-192.png',
      tag: `academic-os-${tag}`,
    });
  } catch {
    /* ignore */
  }
}

export function getScheduledNotificationMessage(): string | null {
  const now = new Date();
  const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  const match = scheduledMessages.find((s) => s.time === currentTime);
  return match?.message ?? null;
}
