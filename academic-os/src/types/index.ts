export enum DomainLevel {
  MORTAL = 0,
  HERO = 25,
  DEMIGOD = 50,
  GOD = 75,
  TITAN = 100,
}

export type MissionType = 'exam' | 'task' | 'reading';
export type MissionPriority = 'odisea' | 'epica' | 'chiste';
export type MissionComplexity = 'light' | 'medium' | 'heavy';
export type DailyMissionKind =
  | 'blocks_completed'
  | 'study_minutes'
  | 'complete_mission'
  | 'complete_topic'
  | 'daily_goal'
  | 'assign_blocks'
  | 'consecutive_blocks'
  | 'course_study'
  | 'earn_xp';
export type BlockType = 'study' | 'exam' | 'task' | 'rest';
export type CourseMode = 'kratos' | 'thor';
export type HadesEmailFrequency = 'daily' | 'conditional' | 'disabled';
export type HadesEmailSlotKey =
  | 'fiveAm'
  | 'sixPm'
  | 'ninePm'
  | 'evening'
  | 'elevenPm'
  | 'inactivity6h';

export interface HadesEmailSlotSettings {
  hour: number;
  minute: number;
  frequency: HadesEmailFrequency;
  intervalHours?: number;
}
/** Origen de la completitud del tema — evita doble XP con timeblocking */
export type TopicCompletionVia = 'manual' | 'timeblock';

export interface SubTopic {
  id: string;
  name: string;
  completed: boolean;
  studyTime: number;
  completedVia?: TopicCompletionVia;
}

export interface Topic {
  id: string;
  name: string;
  domainLevel: DomainLevel;
  studyTime: number;
  lastStudied: string | null;
  completed?: boolean;
  /** YYYY-MM-DD local — día en que se marcó completado (desafíos diarios) */
  completedOn?: string;
  completedVia?: TopicCompletionVia;
  subtopics: SubTopic[];
}

export interface UnitTask {
  id: string;
  title: string;
  dueDate?: string;
  completed: boolean;
  priority: MissionPriority;
  complexity?: MissionComplexity;
}

export interface ThorTaskType {
  id: string;
  name: string;
  icon: string;
}

export interface ThorSection {
  id: string;
  name: string;
  order: number;
}

export interface ThorSubtask {
  id: string;
  title: string;
  completed: boolean;
}

export interface ThorTask {
  id: string;
  missionId: string;
  title: string;
  dueDate?: string;
  priority: MissionPriority;
  complexity: MissionComplexity;
  taskTypeId: string;
  estimateBlocks?: number;
  sectionId?: string;
  parentTaskId?: string;
  subtasks: ThorSubtask[];
  completed: boolean;
  xpEarned?: number;
  createdAt: string;
}

export interface Unit {
  id: string;
  name: string;
  topics: Topic[];
  progress: number;
  examDate?: string;
  tasks: UnitTask[];
}

export interface Course {
  id: string;
  name: string;
  icon: string;
  color?: string;
  mode?: CourseMode;
  units: Unit[];
  progress: number;
  templeLevel: number;
  /** THOR — secciones del gestor de tareas */
  thorSections?: ThorSection[];
  /** THOR — tareas del curso (sincronizadas con Misiones) */
  thorTasks?: ThorTask[];
  /** THOR — tipos de tarea personalizables */
  thorTaskTypes?: ThorTaskType[];
  /** THOR — XP acumulado por tareas completadas */
  thorXpEarned?: number;
}

export interface Mission {
  id: string;
  title: string;
  type: MissionType;
  courseId: string;
  courseName: string;
  unitId?: string;
  /** Cadena vacía = sin fecha límite */
  dueDate: string;
  priority: MissionPriority;
  complexity?: MissionComplexity;
  xpReward: number;
  completed: boolean;
  /** YYYY-MM-DD local — día en que se completó (desafíos diarios) */
  completedOn?: string;
  /** Origen: tablero global o THOR del curso */
  source?: 'board' | 'thor';
  thorTaskId?: string;
}

export interface TimeBlock {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  type: BlockType;
  title: string;
  courseId?: string;
  unitId?: string;
  topicId?: string;
  subtopicId?: string;
  missionId?: string;
  completed: boolean;
  /** ISO datetime — sesión play en Contratos (XP solo si llega a endTime) */
  playStartedAt?: string;
  /** Registro para revertir al desmarcar */
  completionRecord?: {
    blockXp: number;
    goalBonus: number;
    minutes: number;
  };
}

export interface BlockCompletionGrant {
  blockXp: number;
  goalBonus: number;
  minutes: number;
}

export type OracleCoursePriority = 'always' | 'exam_only';

export interface OracleProfile {
  scheduleStart?: string;
  scheduleEnd?: string;
  blockMinutes?: 30 | 45 | 60;
  coursePriorities?: Record<string, OracleCoursePriority>;
  /** Unidad preferida por curso (vacío = libre / el coach pregunta). */
  unitFocus?: Record<string, string>;
}

export interface OracleBlockPlanItem {
  startTime: string;
  courseId: string;
  unitId: string;
  topicId: string;
  title: string;
  type: 'study' | 'exam';
}

export interface OracleBlockPlan {
  blocks: OracleBlockPlanItem[];
}

export interface BlockAssignPayload {
  title: string;
  type: BlockType;
  courseId?: string;
  unitId?: string;
  topicId?: string;
  subtopicId?: string;
  missionId?: string;
}

export interface Player {
  id: string;
  level: number;
  xp: number;
  titles: string[];
  weapons: string[];
  skins: string[];
  currentSkin: string;
  lastStudyDate: string | null;
  studyStreak: number;
  todayStudyMinutes?: number;
  yesterdayStudyMinutes?: number;
  consecutiveBlocks?: number;
  lastActiveDate?: string;
  badges?: string[];
  unlockedAnimations?: string[];
  dailyBonusActive?: boolean;
  goalMetDate?: string;
  lastPenaltyDate?: string;
  panelTheme?: 'bronze' | 'blood' | 'golden' | 'inferno' | 'titan';
  activeTitle?: string;
  showAnimations?: boolean;
  perfectDayDate?: string;
  nightBonusClaimedDate?: string;
  autoOracleEnabled?: boolean;
  lastOracleBriefingDate?: string;
  /** Preferencias del Oráculo DeepSeek (horario, prioridades, duración de bloque) */
  oracleProfile?: OracleProfile;
  /** ISO datetime — cooldown La Verdad Revelada (4 h) */
  lastVerdadAt?: string;
  perfectDaysCount?: number;
  lastChestDate?: string;
  /** ISO datetime del último cofre reclamado — cooldown 8h */
  lastChestAt?: string;
  currentInterfaceSkin?: string;
  totalBlocksCompleted?: number;
  lastLevelCelebrated?: number;
  /** Último modo de curso usado (KRATOS/THOR) — default al crear curso */
  lastCourseMode?: CourseMode;
  hadesWeeklyShieldWeek?: string;
  lastShameEmailDate?: string;
  hadesEmailEnabled?: boolean;
  /** Notificaciones del sistema operativo — desactivadas por defecto (anti-spam) */
  browserNotificationsEnabled?: boolean;
  lastHadesEmailSixPm?: string;
  lastHadesEmailNinePm?: string;
  lastHadesEmailEvening?: string;
  lastHadesEmailFiveAm?: string;
  lastHadesEmailElevenPm?: string;
  lastNinePmNotifyDate?: string;
  lastUnderworldPenaltyDate?: string;
  lastXpPenaltyAmount?: number;
  lastAppOpenDate?: string;
  /** Última interacción real (ISO datetime) — estudio, edición, apertura */
  lastActivityAt?: string;
  /** Último correo Hades por 6h de inactividad */
  lastHadesInactivityEmailAt?: string;
  topicBacklogSince?: string;
  topicBacklogEscalation?: number;
  /** Meta diaria personalizada en minutos (default 3h) */
  dailyGoalMinutes?: number;
  /** Inicio del grid de bloques HH:MM (Perú) */
  dayBlockStart?: string;
  /** Fin del grid de bloques HH:MM (exclusivo) */
  dayBlockEnd?: string;
  /** Horarios de correos Hades vigentes hoy */
  hadesEmailSlotsActive?: Partial<Record<HadesEmailSlotKey, HadesEmailSlotSettings>>;
  /** Cambios de horario/frecuencia — aplican desde hadesEmailSlotsPendingFrom */
  hadesEmailSlotsPending?: Partial<Record<HadesEmailSlotKey, HadesEmailSlotSettings>>;
  hadesEmailSlotsPendingFrom?: string;
  /** Racha de días completando todas las misiones diarias */
  dailyMissionStreak?: number;
  lastDailyMissionAllCompleteDate?: string;
  lastDailyMissionGeneratedDate?: string;
  lastWeeklyMissionGeneratedWeek?: string;
}

export interface DailyMission {
  id: string;
  date: string;
  title: string;
  description: string;
  kind: DailyMissionKind;
  complexity: MissionComplexity;
  required: boolean;
  target: number;
  progress: number;
  completed: boolean;
  completedAt?: string;
  xpReward: number;
  xpGranted?: number;
  manualComplete?: boolean;
  /** Tras revertir manualmente, no auto-completar hasta acción nueva */
  autoCompleteBlocked?: boolean;
  refMissionId?: string;
  refCourseId?: string;
  refUnitId?: string;
  refTopicId?: string;
  icon: string;
}

export interface DailyMissionDayRecord {
  date: string;
  missions: DailyMission[];
  allCompleteBonusGranted?: boolean;
  penaltyApplied?: boolean;
  generatedAt: string;
  /** Versión del generador de copy creativo */
  generatorVersion?: number;
  /** XP del jugador al generar el día — base para misión earn_xp */
  xpBaseline?: number;
}

export interface DailyMissionHistoryEntry {
  date: string;
  total: number;
  completed: number;
  allComplete: boolean;
  streakAfter: number;
  penaltyXp?: number;
}

export type WeeklyMissionKind =
  | 'week_blocks'
  | 'week_minutes'
  | 'week_missions_done'
  | 'week_topics'
  | 'week_goal_days'
  | 'week_course_blocks'
  | 'week_assign_blocks'
  | 'week_xp'
  | 'complete_mission';

export interface WeeklyMission {
  id: string;
  weekKey: string;
  title: string;
  description: string;
  kind: WeeklyMissionKind;
  complexity: MissionComplexity;
  required: boolean;
  target: number;
  progress: number;
  completed: boolean;
  completedAt?: string;
  xpReward: number;
  xpGranted?: number;
  manualComplete?: boolean;
  autoCompleteBlocked?: boolean;
  refMissionId?: string;
  refCourseId?: string;
  refUnitId?: string;
  refTopicId?: string;
  icon: string;
}

export interface WeeklyMissionWeekRecord {
  weekKey: string;
  missions: WeeklyMission[];
  allCompleteBonusGranted?: boolean;
  penaltyApplied?: boolean;
  generatedAt: string;
  generatorVersion?: number;
  /** Misiones del tablero ya completadas al generar la semana */
  missionsCompletedBaseline?: number;
  /** Temas completados al generar la semana */
  topicsBaseline?: number;
  /** XP del jugador al generar la semana — base para week_xp */
  xpBaseline?: number;
}

export interface AppSettings {
  key: string;
  value: unknown;
}

export interface GerardexStage {
  stage: number;
  levelRange: string;
  title: string;
  weapon: string;
  armor: string;
}

export interface EpicTitle {
  id: number;
  name: string;
  requirement: string;
  unlocked: boolean;
}

export interface NotificationMessage {
  id: string;
  type: 'zeus' | 'herald' | 'hades';
  message: string;
  timestamp: string;
  read: boolean;
}
