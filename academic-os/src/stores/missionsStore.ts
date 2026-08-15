import { create } from 'zustand';
import { db } from '../utils/db';
import { persistMission, deleteMissionRecord, persistTimeBlock } from '../utils/persist';
import type { Mission, MissionPriority, MissionType, MissionComplexity, TimeBlock } from '../types';
import { generateId, getMissionXpReward, todayISO } from '../utils/gamification';
import { missionSortScore } from '../utils/statsEngine';
import { usePlayerStore } from './playerStore';
import { useTimeStore } from './timeStore';
import { checkMissionNotifications, createNotification } from '../utils/notifications';
import { GERARDEX_COMIC } from '../utils/playerConfig';
import { migratePriority } from '../utils/priorityMigrate';
import { syncDailyMissions } from './dailyMissionsStore';

async function syncMissionCompleteToBlocks(missionId: string): Promise<void> {
  const blocks = await db.timeblocks.filter((b) => b.missionId === missionId && !b.completed).toArray();
  if (!blocks.length) return;
  for (const block of blocks) {
    const updated: TimeBlock = { ...block, completed: true };
    await persistTimeBlock(updated);
  }
  await useTimeStore.getState().load(useTimeStore.getState().selectedDate);
}

async function syncMissionUncompleteToBlocks(missionId: string): Promise<void> {
  const blocks = await db.timeblocks.filter((b) => b.missionId === missionId && b.completed).toArray();
  if (!blocks.length) return;
  for (const block of blocks) {
    if (block.completionRecord) {
      await useTimeStore.getState().uncompleteBlock(block.id);
    } else {
      await persistTimeBlock({ ...block, completed: false });
    }
  }
  await useTimeStore.getState().load(useTimeStore.getState().selectedDate);
}

interface MissionInput {
  id?: string;
  title: string;
  type: MissionType;
  courseId: string;
  courseName: string;
  unitId?: string;
  dueDate?: string;
  priority: MissionPriority;
  complexity?: MissionComplexity;
  source?: 'board' | 'thor';
  thorTaskId?: string;
}

interface MissionsState {
  missions: Mission[];
  loading: boolean;
  load: () => Promise<void>;
  addMission: (data: MissionInput) => Promise<void>;
  updateMission: (id: string, data: Partial<MissionInput>) => Promise<void>;
  completeMission: (id: string, opts?: { fromTimeBlock?: boolean }) => Promise<void>;
  uncompleteMission: (id: string, opts?: { fromTimeBlock?: boolean }) => Promise<void>;
  deleteMission: (id: string) => Promise<void>;
  getActive: () => Mission[];
  getCompleted: () => Mission[];
  getSortedActive: () => Mission[];
  getLegendary: () => Mission | undefined;
  checkNotifications: () => void;
}

export const useMissionsStore = create<MissionsState>((set, get) => ({
  missions: [],
  loading: true,

  load: async () => {
    const raw = await db.missions.toArray();
    const missions = [];
    for (const m of raw) {
      const priority = migratePriority(m.priority);
      const updated = {
        ...m,
        priority,
        xpReward: getMissionXpReward(priority, m.complexity ?? 'medium'),
      };
      if (priority !== m.priority) await persistMission(updated);
      missions.push(updated);
    }
    set({ missions, loading: false });
  },

  addMission: async (data) => {
    const complexity = data.complexity ?? 'medium';
    const priority = migratePriority(data.priority);
    const mission: Mission = {
      id: data.id ?? generateId(),
      title: data.title,
      type: data.type,
      courseId: data.courseId,
      courseName: data.courseName,
      unitId: data.unitId,
      dueDate: data.dueDate || '',
      priority,
      complexity,
      source: data.source ?? 'board',
      thorTaskId: data.thorTaskId,
      xpReward: getMissionXpReward(priority, complexity),
      completed: false,
    };
    await persistMission(mission);
    set((s) => ({ missions: [...s.missions, mission] }));
  },

  updateMission: async (id, data) => {
    const mission = get().missions.find((m) => m.id === id);
    if (!mission) return;
    const priority = migratePriority(data.priority ?? mission.priority);
    const complexity = data.complexity ?? mission.complexity ?? 'medium';
    const updated: Mission = {
      ...mission,
      ...data,
      priority,
      complexity,
      xpReward: getMissionXpReward(priority, complexity),
    };
    await persistMission(updated);
    set((s) => ({
      missions: s.missions.map((m) => (m.id === id ? updated : m)),
    }));
    if (mission.source === 'thor' && (data.title || data.priority || data.complexity || data.dueDate !== undefined)) {
      const { useCoursesStore } = await import('./coursesStore');
      const course = useCoursesStore.getState().courses.find((c) => c.id === mission.courseId);
      const task = course?.thorTasks?.find((t) => t.missionId === id);
      if (task) {
        await useCoursesStore.getState().patchThorTaskFromBoard(mission.courseId, task.id, {
          title: updated.title,
          priority: updated.priority,
          complexity: updated.complexity,
          dueDate: updated.dueDate,
        });
      }
    }
  },

  completeMission: async (id, opts) => {
    const mission = get().missions.find((m) => m.id === id);
    if (!mission || mission.completed) return;

    const updated = { ...mission, completed: true, completedOn: todayISO() };
    await persistMission(updated);
    set((s) => ({
      missions: s.missions.map((m) => (m.id === id ? updated : m)),
    }));

    if (!opts?.fromTimeBlock) {
      await usePlayerStore.getState().addXP(
        mission.xpReward,
        `Misión completada: ${mission.title}`,
      );
      const notifs = [createNotification('herald', GERARDEX_COMIC.lootChest)];
      if (mission.priority === 'odisea') {
        await usePlayerStore.getState().unlockSkin('legendary');
        notifs.push(createNotification('herald', '🗡️ Skin legendaria desbloqueada'));
      }
      notifs.forEach((n) => usePlayerStore.getState().addNotification(n));
      await syncMissionCompleteToBlocks(id);
    }

    if (mission.source === 'thor') {
      const { useCoursesStore } = await import('./coursesStore');
      await useCoursesStore.getState().syncThorTaskFromMission(id, true, mission.xpReward);
    }

    syncDailyMissions();
  },

  uncompleteMission: async (id, opts) => {
    const mission = get().missions.find((m) => m.id === id);
    if (!mission || !mission.completed) return;

    if (!opts?.fromTimeBlock) {
      await syncMissionUncompleteToBlocks(id);
      await usePlayerStore.getState().loseXP(
        mission.xpReward,
        `Misión desmarcada: ${mission.title}`,
      );
    }

    if (mission.source === 'thor') {
      const { useCoursesStore } = await import('./coursesStore');
      await useCoursesStore.getState().syncThorTaskFromMission(id, false, mission.xpReward);
    }

    const updated = { ...mission, completed: false, completedOn: undefined };
    await persistMission(updated);
    set((s) => ({
      missions: s.missions.map((m) => (m.id === id ? updated : m)),
    }));
    syncDailyMissions();
  },

  deleteMission: async (id) => {
    const mission = get().missions.find((m) => m.id === id);
    if (mission?.source === 'thor') {
      const { useCoursesStore } = await import('./coursesStore');
      await useCoursesStore.getState().syncThorOnMissionDelete(id);
    }
    await deleteMissionRecord(id);
    set((s) => ({ missions: s.missions.filter((m) => m.id !== id) }));
  },

  getActive: () =>
    get().missions.filter((m) => !m.completed),

  getSortedActive: () =>
    get()
      .missions.filter((m) => !m.completed)
      .sort((a, b) => missionSortScore(b) - missionSortScore(a)),

  getCompleted: () =>
    get()
      .missions.filter((m) => m.completed)
      .slice(-10)
      .reverse(),

  getLegendary: () =>
    get().missions.find((m) => !m.completed && m.priority === 'odisea'),

  checkNotifications: () => {
    const notifs = checkMissionNotifications(get().missions);
    notifs.forEach((n) => usePlayerStore.getState().addNotification(n));
  },
}));
