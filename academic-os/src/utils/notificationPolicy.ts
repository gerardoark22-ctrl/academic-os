/** Política de notificaciones OS — sincronizada desde playerStore sin dependencia circular */
let browserNotificationsEnabled = true;

export function syncBrowserNotificationPolicy(enabled: boolean | undefined): void {
  browserNotificationsEnabled = enabled !== false;
}

export function browserNotificationsAllowed(): boolean {
  return browserNotificationsEnabled;
}
