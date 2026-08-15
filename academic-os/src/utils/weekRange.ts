/** Fechas ISO (lun–dom) de la semana que empieza en weekKey (lunes). */
export function getWeekDateRange(weekKey: string): string[] {
  const dates: string[] = [];
  const start = new Date(`${weekKey}T12:00:00`);
  for (let i = 0; i < 7; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    dates.push(d.toISOString().split('T')[0]);
  }
  return dates;
}
