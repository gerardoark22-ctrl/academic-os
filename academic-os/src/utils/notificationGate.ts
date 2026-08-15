import { todayISO } from './gamification';

const STORAGE_PREFIX = 'aos-notif';

/** Evita notificaciones OS repetidas el mismo día (persiste entre recargas y pestañas) */
export function wasBrowserNotifSent(tag: string): boolean {
  try {
    return localStorage.getItem(`${STORAGE_PREFIX}-${todayISO()}-${tag}`) === '1';
  } catch {
    return false;
  }
}

export function markBrowserNotifSent(tag: string): void {
  try {
    localStorage.setItem(`${STORAGE_PREFIX}-${todayISO()}-${tag}`, '1');
  } catch {
    /* ignore */
  }
}

export function clearBrowserNotifTag(tag: string): void {
  try {
    localStorage.removeItem(`${STORAGE_PREFIX}-${todayISO()}-${tag}`);
  } catch {
    /* ignore */
  }
}
