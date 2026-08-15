/** Lunes de la semana ISO (clave YYYY-MM-DD) */
export function getWeekKey(isoDate: string): string {
  const d = new Date(`${isoDate}T12:00:00`);
  const day = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - day);
  return d.toISOString().split('T')[0];
}

export function hadesShieldsPenalty(
  player: {
    currentSkin: string;
    skins: string[];
    lastStudyDate: string | null;
    hadesWeeklyShieldWeek?: string;
  },
  today: string,
  yesterdayMinutes: number,
): { skip: boolean; useWeeklyShield?: boolean } {
  const hadesEquipped = player.currentSkin === 'hades' && player.skins.includes('hades');
  if (!hadesEquipped || yesterdayMinutes <= 0) return { skip: false };

  const weekKey = getWeekKey(today);
  const daysSinceStudy = player.lastStudyDate
    ? Math.floor((new Date(`${today}T12:00:00`).getTime() - new Date(`${player.lastStudyDate}T12:00:00`).getTime()) / 86400000)
    : 999;

  // Volver del inframundo: estuvo ≥2 días sin estudiar y ayer retomó (parcial)
  if (daysSinceStudy >= 2) return { skip: true };

  // 1er día sucio de la semana
  if (player.hadesWeeklyShieldWeek !== weekKey) {
    return { skip: true, useWeeklyShield: true };
  }

  return { skip: false };
}
