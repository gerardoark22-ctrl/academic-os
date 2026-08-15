/** Labels claros + flavor brutal (híbrido 3C) */

export const NAV_TABS = [
  { id: 'agora' as const, label: 'Dashboard', flavor: 'Ruinas del Ágora', icon: '⚔️' },
  { id: 'ranking' as const, label: 'Ranking', flavor: 'Estadísticas de guerra', icon: '📊' },
  { id: 'courses' as const, label: 'Cursos', flavor: 'Estructuras caídas', icon: '🏚️' },
  { id: 'missions' as const, label: 'Misiones', flavor: 'Contratos de sangre', icon: '🗡️' },
  { id: 'time' as const, label: 'Horario', flavor: 'Reloj de ceniza', icon: '☀️' },
];

export const SECTIONS = {
  godAnger: { title: 'Riesgo académico', flavor: 'Ira de los dioses' },
  titles: { title: 'Logros', flavor: 'Marcas de guerra' },
  temples: { title: 'Progreso por curso', flavor: 'Ruinas en reconstrucción' },
  missions: { title: 'Pendientes', flavor: 'Batallas por librar' },
  missionsBoard: { title: 'Misiones', flavor: 'Campo de batalla académico' },
  courses: { title: 'Cursos', flavor: 'Biblioteca saqueada' },
  time: { title: 'Time blocking', flavor: 'Reloj de sol sobre ceniza' },
  notifications: { title: 'Avisos', flavor: 'Susurros del Olimpo' },
};

export const FLAVOR = {
  emptyMissions: 'No hay enemigos a la vista. Disfruta la tregua.',
  emptyCourses: 'Solo escombros. Levanta tu primer templo.',
  underworld: (days: number) =>
    days > 3
      ? `Hades reclama tu alma — ${days} días sin sangre en el campo de estudio`
      : `${days} días vagando en el Inframundo`,
  syncOnline: 'Vínculo con el archivo de guerra',
  syncOffline: 'Sin conexión al archivo',
  syncConfirm:
    '⚠️ Sync desde Python REEMPLAZA todos los datos locales (Gerardex, cursos, misiones, bloques).\n\nExporta un backup (💾) antes si quieres conservar el progreso actual.\n\n¿Continuar?',
};
