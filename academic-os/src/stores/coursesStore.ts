import { create } from 'zustand';
import { db } from '../utils/db';
import { persistCourseRecord, deleteCourseRecord, persistMission, persistSetting } from '../utils/persist';
import type { Course, UnitTask, MissionPriority, MissionComplexity, ThorTask, ThorSection, ThorSubtask } from '../types';
import { DomainLevel } from '../types';
import {
  getDomainFromStudyTime,
  generateId,
  XP_REWARDS,
  getMissionXpReward,
  todayISO,
} from '../utils/gamification';
import { normalizeCourse } from '../utils/courseNormalize';
import { usePlayerStore, PLAYER_CONFIG } from './playerStore';
import { syncDailyMissions } from './dailyMissionsStore';
import { heraldMessages, createNotification } from '../utils/notifications';
import {
  getLinkedBlocksForTopic,
  getTopicCompletedVia,
  studyMinutesForTopicRef,
} from '../utils/topicBlockSync';
import { missionTypeFromThorType } from '../utils/thorCourse';
import { migratePriority } from '../utils/priorityMigrate';
import { buildNewCourse, finalizeCourse } from '../utils/courseFactory';

interface CoursesState {
  courses: Course[];
  loading: boolean;
  selectedCourseId: string | null;
  load: () => Promise<void>;
  selectCourse: (id: string | null) => void;
  addCourse: (name: string, icon: string, color?: string, mode?: import('../types').CourseMode) => Promise<string>;
  importCourseFromSyllabus: (name: string, icon: string, color: string, draft: import('../utils/deepseekClient').SyllabusDraft) => Promise<string>;
  updateCourse: (id: string, data: { name?: string; icon?: string; color?: string; mode?: import('../types').CourseMode }) => Promise<void>;
  deleteCourse: (id: string) => Promise<void>;
  addUnit: (courseId: string, name: string, examDate?: string) => Promise<string | undefined>;
  updateUnit: (courseId: string, unitId: string, data: { name?: string; examDate?: string }) => Promise<void>;
  deleteUnit: (courseId: string, unitId: string) => Promise<void>;
  addTopic: (courseId: string, unitId: string, name: string) => Promise<void>;
  updateTopic: (courseId: string, unitId: string, topicId: string, name: string) => Promise<void>;
  deleteTopic: (courseId: string, unitId: string, topicId: string) => Promise<void>;
  addSubtopic: (courseId: string, unitId: string, topicId: string, name: string) => Promise<void>;
  updateSubtopic: (courseId: string, unitId: string, topicId: string, subtopicId: string, name: string) => Promise<void>;
  deleteSubtopic: (courseId: string, unitId: string, topicId: string, subtopicId: string) => Promise<void>;
  addUnitTask: (courseId: string, unitId: string, title: string, priority: MissionPriority, dueDate?: string, complexity?: import('../types').MissionComplexity) => Promise<void>;
  updateUnitTask: (courseId: string, unitId: string, taskId: string, data: Partial<UnitTask>) => Promise<void>;
  deleteUnitTask: (courseId: string, unitId: string, taskId: string) => Promise<void>;
  completeUnitTask: (courseId: string, unitId: string, taskId: string) => Promise<void>;
  toggleUnitTask: (courseId: string, unitId: string, taskId: string) => Promise<void>;
  updateTopicDomain: (courseId: string, unitId: string, topicId: string, level: DomainLevel) => Promise<void>;
  addStudyTime: (courseId: string, unitId: string, topicId: string, minutes: number, grantXp?: boolean, subtopicId?: string, syncPlayerMinutes?: boolean) => Promise<void>;
  subtractStudyTime: (courseId: string, unitId: string, topicId: string, minutes: number, subtopicId?: string) => Promise<void>;
  markTopicStudiedToday: (courseId: string, unitId: string, topicId: string) => Promise<void>;
  markTopicComplete: (courseId: string, unitId: string, topicId: string, subtopicId?: string, fromTimeBlock?: boolean) => Promise<void>;
  unmarkTopicFromBlock: (courseId: string, unitId: string, topicId: string, subtopicId?: string) => Promise<void>;
  toggleTopicStudy: (courseId: string, unitId: string, topicId: string, subtopicId?: string) => Promise<void>;
  addThorSection: (courseId: string, name: string) => Promise<void>;
  updateThorSection: (courseId: string, sectionId: string, name: string) => Promise<void>;
  deleteThorSection: (courseId: string, sectionId: string) => Promise<void>;
  addThorTaskType: (courseId: string, name: string, icon?: string) => Promise<void>;
  addThorTask: (courseId: string, data: {
    title: string;
    priority: MissionPriority;
    complexity?: MissionComplexity;
    taskTypeId: string;
    dueDate?: string;
    estimateBlocks?: number;
    sectionId?: string;
    parentTaskId?: string;
  }) => Promise<string | undefined>;
  updateThorTask: (courseId: string, taskId: string, data: Partial<ThorTask>) => Promise<void>;
  deleteThorTask: (courseId: string, taskId: string) => Promise<void>;
  toggleThorTask: (courseId: string, taskId: string) => Promise<void>;
  addThorSubtask: (courseId: string, taskId: string, title: string) => Promise<void>;
  toggleThorSubtask: (courseId: string, taskId: string, subtaskId: string) => Promise<void>;
  deleteThorSubtask: (courseId: string, taskId: string, subtaskId: string) => Promise<void>;
  syncThorTaskFromMission: (missionId: string, completed: boolean, xpReward?: number) => Promise<void>;
  syncThorOnMissionDelete: (missionId: string) => Promise<void>;
  patchThorTaskFromBoard: (courseId: string, taskId: string, data: Partial<ThorTask>) => Promise<void>;
  getCourse: (id: string) => Course | undefined;
  getTotalTopics: () => { completed: number; total: number };
  recalculateProgress: (course: Course) => Course;
}

function recalcCourse(course: Course): Course {
  return finalizeCourse(course);
}

async function saveCourse(get: () => CoursesState, set: (partial: Partial<CoursesState> | ((s: CoursesState) => Partial<CoursesState>)) => void, courseId: string, updater: (c: Course) => Course) {
  const course = get().courses.find((c) => c.id === courseId);
  if (!course) return;
  const updated = recalcCourse(updater(course));
  await persistCourse(updated);
  set((s) => ({ courses: s.courses.map((c) => (c.id === courseId ? updated : c)) }));
}

async function persistCourse(updated: Course) {
  await persistCourseRecord(updated);
}

export const useCoursesStore = create<CoursesState>((set, get) => ({
  courses: [],
  loading: true,
  selectedCourseId: null,

  load: async () => {
    let courses = (await db.courses.toArray()).map((c) => recalcCourse(normalizeCourse(c)));

    const existingMissions = await db.missions.toArray();
    const existingIds = new Set(existingMissions.map((m) => m.id));
    const synced = await db.settings.get('unitTasksSyncedV1');

    if (!synced) {
      const today = todayISO();
      for (const course of courses) {
        for (const unit of course.units) {
          for (const task of unit.tasks ?? []) {
            if (existingIds.has(task.id)) continue;
            await persistMission({
              id: task.id,
              title: task.title,
              type: 'task',
              courseId: course.id,
              courseName: course.name,
              unitId: unit.id,
              dueDate: task.dueDate || today,
              priority: task.priority,
              complexity: task.complexity ?? 'medium',
              xpReward: getMissionXpReward(task.priority, task.complexity ?? 'medium'),
              completed: task.completed,
            });
            existingIds.add(task.id);
          }
        }
      }
      await persistSetting({ key: 'unitTasksSyncedV1', value: '1' });
    }

    set({ courses, loading: false });
  },

  selectCourse: (id) => set({ selectedCourseId: id }),

  addCourse: async (name, icon, color, mode) => {
    const { usePlayerStore } = await import('./playerStore');
    const player = usePlayerStore.getState().player;
    const courseMode = mode ?? player?.lastCourseMode ?? 'kratos';
    const course = buildNewCourse({ name, icon, color, mode: courseMode });
    await persistCourseRecord(course);
    set((s) => ({ courses: [...s.courses, course] }));
    if (player && player.lastCourseMode !== courseMode) {
      const { persistPlayer } = await import('../utils/persist');
      const updated = { ...player, lastCourseMode: courseMode };
      await persistPlayer(updated);
      usePlayerStore.setState({ player: updated });
    }
    return course.id;
  },

  importCourseFromSyllabus: async (name, icon, color, draft) => {
    const { usePlayerStore } = await import('./playerStore');
    const player = usePlayerStore.getState().player;
    const course = buildNewCourse({
      name,
      icon,
      color,
      mode: player?.lastCourseMode ?? 'kratos',
      units: draft.units.map((u) => ({
        id: generateId(),
        name: u.name,
        examDate: u.examDate,
        progress: 0,
        tasks: [],
        topics: u.topics.map((t) => ({
          id: generateId(),
          name: t.name,
          domainLevel: DomainLevel.MORTAL,
          studyTime: 0,
          lastStudied: null,
          completed: false,
          subtopics: t.subtopics.map((st) => ({
            id: generateId(),
            name: st,
            completed: false,
            studyTime: 0,
          })),
        })),
      })),
    });
    await persistCourseRecord(course);
    set((s) => ({ courses: [...s.courses, course] }));
    return course.id;
  },

  updateCourse: async (id, data) => {
    const course = get().courses.find((c) => c.id === id);
    if (!course) return;
    const updated = recalcCourse({ ...course, ...data });
    await persistCourse(updated);
    set((s) => ({ courses: s.courses.map((c) => (c.id === id ? updated : c)) }));
  },

  deleteCourse: async (id) => {
    await deleteCourseRecord(id);
    set((s) => ({
      courses: s.courses.filter((c) => c.id !== id),
      selectedCourseId: s.selectedCourseId === id ? null : s.selectedCourseId,
    }));
  },

  addUnit: async (courseId, name, examDate) => {
    const course = get().courses.find((c) => c.id === courseId);
    if (!course) return undefined;
    const unit = { id: generateId(), name, topics: [], progress: 0, tasks: [], examDate };
    const updated = recalcCourse({ ...course, units: [...course.units, unit] });
    await persistCourse(updated);
    set((s) => ({ courses: s.courses.map((c) => (c.id === courseId ? updated : c)) }));
    return unit.id;
  },

  updateUnit: async (courseId, unitId, data) => {
    const course = get().courses.find((c) => c.id === courseId);
    if (!course) return;
    const updated = recalcCourse({
      ...course,
      units: course.units.map((u) => (u.id === unitId ? { ...u, ...data } : u)),
    });
    await persistCourse(updated);
    set((s) => ({ courses: s.courses.map((c) => (c.id === courseId ? updated : c)) }));
  },

  deleteUnit: async (courseId, unitId) => {
    const course = get().courses.find((c) => c.id === courseId);
    if (!course) return;
    const updated = recalcCourse({
      ...course,
      units: course.units.filter((u) => u.id !== unitId),
    });
    await persistCourse(updated);
    set((s) => ({ courses: s.courses.map((c) => (c.id === courseId ? updated : c)) }));
  },

  addTopic: async (courseId, unitId, name) => {
    const course = get().courses.find((c) => c.id === courseId);
    if (!course) return;
    const topic = {
      id: generateId(),
      name,
      domainLevel: DomainLevel.MORTAL,
      studyTime: 0,
      lastStudied: null,
      completed: false,
      subtopics: [],
    };
    const updated = recalcCourse({
      ...course,
      units: course.units.map((u) =>
        u.id === unitId ? { ...u, topics: [...u.topics, topic] } : u,
      ),
    });
    await persistCourse(updated);
    set((s) => ({ courses: s.courses.map((c) => (c.id === courseId ? updated : c)) }));
  },

  updateTopic: async (courseId, unitId, topicId, name) => {
    const course = get().courses.find((c) => c.id === courseId);
    if (!course) return;
    const updated = recalcCourse({
      ...course,
      units: course.units.map((u) =>
        u.id === unitId
          ? { ...u, topics: u.topics.map((t) => (t.id === topicId ? { ...t, name } : t)) }
          : u,
      ),
    });
    await persistCourse(updated);
    set((s) => ({ courses: s.courses.map((c) => (c.id === courseId ? updated : c)) }));
  },

  deleteTopic: async (courseId, unitId, topicId) => {
    const course = get().courses.find((c) => c.id === courseId);
    if (!course) return;
    const updated = recalcCourse({
      ...course,
      units: course.units.map((u) =>
        u.id === unitId ? { ...u, topics: u.topics.filter((t) => t.id !== topicId) } : u,
      ),
    });
    await persistCourse(updated);
    set((s) => ({ courses: s.courses.map((c) => (c.id === courseId ? updated : c)) }));
  },

  addSubtopic: async (courseId, unitId, topicId, name) => {
    const course = get().courses.find((c) => c.id === courseId);
    if (!course) return;
    const sub = { id: generateId(), name, completed: false, studyTime: 0 };
    const updated = recalcCourse({
      ...course,
      units: course.units.map((u) =>
        u.id === unitId
          ? {
              ...u,
              topics: u.topics.map((t) =>
                t.id === topicId ? { ...t, subtopics: [...(t.subtopics ?? []), sub] } : t,
              ),
            }
          : u,
      ),
    });
    await persistCourse(updated);
    set((s) => ({ courses: s.courses.map((c) => (c.id === courseId ? updated : c)) }));
  },

  updateSubtopic: async (courseId, unitId, topicId, subtopicId, name) => {
    const course = get().courses.find((c) => c.id === courseId);
    if (!course) return;
    const updated = recalcCourse({
      ...course,
      units: course.units.map((u) =>
        u.id === unitId
          ? {
              ...u,
              topics: u.topics.map((t) =>
                t.id === topicId
                  ? {
                      ...t,
                      subtopics: t.subtopics.map((st) =>
                        st.id === subtopicId ? { ...st, name } : st,
                      ),
                    }
                  : t,
              ),
            }
          : u,
      ),
    });
    await persistCourse(updated);
    set((s) => ({ courses: s.courses.map((c) => (c.id === courseId ? updated : c)) }));
  },

  deleteSubtopic: async (courseId, unitId, topicId, subtopicId) => {
    const course = get().courses.find((c) => c.id === courseId);
    if (!course) return;
    const updated = recalcCourse({
      ...course,
      units: course.units.map((u) =>
        u.id === unitId
          ? {
              ...u,
              topics: u.topics.map((t) =>
                t.id === topicId
                  ? { ...t, subtopics: t.subtopics.filter((st) => st.id !== subtopicId) }
                  : t,
              ),
            }
          : u,
      ),
    });
    await persistCourse(updated);
    set((s) => ({ courses: s.courses.map((c) => (c.id === courseId ? updated : c)) }));
  },

  addUnitTask: async (courseId, unitId, title, priority, dueDate, complexity = 'medium') => {
    const course = get().courses.find((c) => c.id === courseId);
    if (!course) return;
    const { useMissionsStore } = await import('./missionsStore');
    await useMissionsStore.getState().addMission({
      title,
      type: 'task',
      courseId,
      courseName: course.name,
      unitId,
      dueDate: dueDate || todayISO(),
      priority,
      complexity,
    });
  },

  updateUnitTask: async (courseId, unitId, taskId, data) => {
    void courseId;
    void unitId;
    const { useMissionsStore } = await import('./missionsStore');
    await useMissionsStore.getState().updateMission(taskId, {
      title: data.title,
      priority: data.priority,
      dueDate: data.dueDate,
      complexity: data.complexity,
    });
  },

  deleteUnitTask: async (courseId, unitId, taskId) => {
    void courseId;
    void unitId;
    const { useMissionsStore } = await import('./missionsStore');
    await useMissionsStore.getState().deleteMission(taskId);
  },

  completeUnitTask: async (courseId, unitId, taskId) => {
    void courseId;
    void unitId;
    const { useMissionsStore } = await import('./missionsStore');
    await useMissionsStore.getState().completeMission(taskId);
  },

  toggleUnitTask: async (courseId, unitId, taskId) => {
    void courseId;
    void unitId;
    const { useMissionsStore } = await import('./missionsStore');
    const mission = useMissionsStore.getState().missions.find((m) => m.id === taskId);
    if (!mission) return;
    if (mission.completed) {
      await useMissionsStore.getState().uncompleteMission(taskId);
    } else {
      await useMissionsStore.getState().completeMission(taskId);
    }
  },

  updateTopicDomain: async (courseId, unitId, topicId, level) => {
    const course = get().courses.find((c) => c.id === courseId);
    if (!course) return;
    const updated = recalcCourse({
      ...course,
      units: course.units.map((u) =>
        u.id === unitId
          ? {
              ...u,
              topics: u.topics.map((t) =>
                t.id === topicId ? { ...t, domainLevel: level } : t,
              ),
            }
          : u,
      ),
    });
    await persistCourse(updated);
    set((s) => ({ courses: s.courses.map((c) => (c.id === courseId ? updated : c)) }));
    syncDailyMissions();
  },

  addStudyTime: async (courseId, unitId, topicId, minutes, grantXp = true, subtopicId, syncPlayerMinutes = true) => {
    const course = get().courses.find((c) => c.id === courseId);
    if (!course) return;
    const wasComplete = course.progress >= 100;
    const studiedToday = todayISO();

    const updated = recalcCourse({
      ...course,
      units: course.units.map((u) =>
        u.id === unitId
          ? {
              ...u,
              topics: u.topics.map((t) => {
                if (t.id !== topicId) return t;
                const newTime = t.studyTime + minutes;
                const newLevel = getDomainFromStudyTime(newTime, t.domainLevel);
                if (subtopicId && t.subtopics.length > 0) {
                  const subtopics = t.subtopics.map((st) =>
                    st.id === subtopicId
                      ? { ...st, studyTime: st.studyTime + minutes, completed: true }
                      : st,
                  );
                  const allDone = subtopics.every((st) => st.completed);
                  return {
                    ...t,
                    studyTime: newTime,
                    subtopics,
                    completed: allDone,
                    completedOn: allDone ? studiedToday : t.completedOn,
                    domainLevel: Math.max(t.domainLevel, newLevel) as DomainLevel,
                    lastStudied: studiedToday,
                  };
                }
                return {
                  ...t,
                  studyTime: newTime,
                  completed: true,
                  completedOn: studiedToday,
                  domainLevel: Math.max(t.domainLevel, newLevel) as DomainLevel,
                  lastStudied: studiedToday,
                };
              }),
            }
          : u,
      ),
    });

    await persistCourse(updated);
    set((s) => ({ courses: s.courses.map((c) => (c.id === courseId ? updated : c)) }));

    if (grantXp) {
      const xpGain = Math.round(minutes * (PLAYER_CONFIG.xpPerBlock / PLAYER_CONFIG.blockMinutes));
      await usePlayerStore.getState().addXP(xpGain, `${minutes} min de estudio`);
    }
    if (syncPlayerMinutes) {
      await usePlayerStore.getState().recordStudyMinutes(minutes);
    } else {
      await usePlayerStore.getState().recordStudy();
    }

    if (!wasComplete && updated.progress === 100) {
      usePlayerStore.getState().addNotification(
        createNotification('herald', heraldMessages.courseComplete(updated.name)),
      );
      await usePlayerStore.getState().addXP(XP_REWARDS.course, `Curso ${updated.name} completado`);
      await usePlayerStore.getState().syncUnlockables();
    }
    syncDailyMissions();
  },

  subtractStudyTime: async (courseId, unitId, topicId, minutes, subtopicId) => {
    const course = get().courses.find((c) => c.id === courseId);
    if (!course) return;

    const updated = recalcCourse({
      ...course,
      units: course.units.map((u) =>
        u.id !== unitId
          ? u
          : {
              ...u,
              topics: u.topics.map((t) => {
                if (t.id !== topicId) return t;
                const newTime = Math.max(0, t.studyTime - minutes);
                if (subtopicId && t.subtopics.length > 0) {
                  const subtopics = t.subtopics.map((st) =>
                    st.id === subtopicId
                      ? { ...st, studyTime: Math.max(0, st.studyTime - minutes), completed: false, completedVia: undefined }
                      : st,
                  );
                  return {
                    ...t,
                    studyTime: newTime,
                    subtopics,
                    completed: subtopics.every((st) => st.completed),
                    completedOn: undefined,
                    completedVia: undefined,
                    domainLevel: getDomainFromStudyTime(newTime, t.domainLevel) as DomainLevel,
                  };
                }
                return {
                  ...t,
                  studyTime: newTime,
                  completed: false,
                  completedOn: undefined,
                  completedVia: undefined,
                  domainLevel: getDomainFromStudyTime(newTime, t.domainLevel) as DomainLevel,
                };
              }),
            },
      ),
    });

    await persistCourse(updated);
    set((s) => ({ courses: s.courses.map((c) => (c.id === courseId ? updated : c)) }));
  },

  markTopicStudiedToday: async () => {
    /* Recompensas solo vía timeblocking */
  },

  markTopicComplete: async (courseId, unitId, topicId, subtopicId, fromTimeBlock = false) => {
    const course = get().courses.find((c) => c.id === courseId);
    if (!course) return;

    const ref = { courseId, unitId, topicId, subtopicId };
    if (getTopicCompletedVia(get().courses, ref) === 'manual') return;

    const completedDay = todayISO();

    const updated = recalcCourse({
      ...course,
      units: course.units.map((u) =>
        u.id === unitId
          ? {
              ...u,
              topics: u.topics.map((t) => {
                if (t.id !== topicId) return t;
                if (subtopicId) {
                  const subtopics = t.subtopics.map((st) =>
                    st.id === subtopicId
                      ? { ...st, completed: true, completedVia: 'timeblock' as const }
                      : st,
                  );
                  const allDone = subtopics.length > 0 && subtopics.every((st) => st.completed);
                  return {
                    ...t,
                    subtopics,
                    completed: allDone,
                    completedOn: allDone ? completedDay : t.completedOn,
                    completedVia: allDone ? 'timeblock' as const : t.completedVia,
                  };
                }
                if (t.subtopics.length > 0) {
                  const subtopics = t.subtopics.map((st) => ({
                    ...st,
                    completed: true,
                    completedVia: 'timeblock' as const,
                  }));
                  return {
                    ...t,
                    subtopics,
                    completed: true,
                    completedOn: completedDay,
                    completedVia: 'timeblock' as const,
                  };
                }
                return {
                  ...t,
                  completed: true,
                  completedOn: completedDay,
                  completedVia: 'timeblock' as const,
                };
              }),
            }
          : u,
      ),
    });

    await persistCourse(updated);
    set((s) => ({ courses: s.courses.map((c) => (c.id === courseId ? updated : c)) }));

    if (fromTimeBlock) {
      const linked = await getLinkedBlocksForTopic(ref);
      const minutes = studyMinutesForTopicRef(linked.length, PLAYER_CONFIG.blockMinutes);
      await get().addStudyTime(
        courseId,
        unitId,
        topicId,
        minutes,
        false,
        subtopicId,
        false,
      );
    }
    syncDailyMissions();
  },

  unmarkTopicFromBlock: async (courseId, unitId, topicId, subtopicId) => {
    const ref = { courseId, unitId, topicId, subtopicId };
    const linked = await getLinkedBlocksForTopic(ref);
    const minutes = studyMinutesForTopicRef(linked.length, PLAYER_CONFIG.blockMinutes);
    await get().subtractStudyTime(courseId, unitId, topicId, minutes);

    const course = get().courses.find((c) => c.id === courseId);
    if (!course) return;

    const updated = recalcCourse({
      ...course,
      units: course.units.map((u) =>
        u.id !== unitId
          ? u
          : {
              ...u,
              topics: u.topics.map((t) => {
                if (t.id !== topicId) return t;
                if (subtopicId) {
                  const subtopics = t.subtopics.map((st) =>
                    st.id === subtopicId
                      ? { ...st, completed: false, completedVia: undefined }
                      : st,
                  );
                  return { ...t, subtopics, completed: false, completedOn: undefined, completedVia: undefined };
                }
                if (t.subtopics.length > 0) {
                  return {
                    ...t,
                    completed: false,
                    completedOn: undefined,
                    completedVia: undefined,
                    subtopics: t.subtopics.map((st) => ({ ...st, completed: false, completedVia: undefined })),
                  };
                }
                return { ...t, completed: false, completedOn: undefined, completedVia: undefined };
              }),
            },
      ),
    });

    await persistCourse(updated);
    set((s) => ({ courses: s.courses.map((c) => (c.id === courseId ? updated : c)) }));
    syncDailyMissions();
  },

  toggleTopicStudy: async (courseId, unitId, topicId, subtopicId) => {
    const course = get().courses.find((c) => c.id === courseId);
    if (!course) return;

    const unit = course.units.find((u) => u.id === unitId);
    const topic = unit?.topics.find((t) => t.id === topicId);
    if (!topic) return;

    const ref = { courseId, unitId, topicId, subtopicId };

    let wasComplete: boolean;
    let completedVia = subtopicId
      ? topic.subtopics.find((s) => s.id === subtopicId)?.completedVia
      : topic.completedVia;

    if (subtopicId) {
      const st = topic.subtopics.find((s) => s.id === subtopicId);
      if (!st) return;
      wasComplete = st.completed;
      completedVia = st.completedVia;
    } else if (topic.subtopics.length > 0) {
      wasComplete = topic.subtopics.every((st) => st.completed);
    } else {
      wasComplete = !!topic.completed;
    }

    if (wasComplete && completedVia === 'timeblock') return;

    const markComplete = !wasComplete;
    const linked = await getLinkedBlocksForTopic(ref);
    const hasTimeblocks = linked.length > 0;
    const studyMinutes = studyMinutesForTopicRef(linked.length, PLAYER_CONFIG.blockMinutes);
    const completedDay = todayISO();

    const updated = recalcCourse({
      ...course,
      units: course.units.map((u) =>
        u.id !== unitId
          ? u
          : {
              ...u,
              topics: u.topics.map((t) => {
                if (t.id !== topicId) return t;
                const viaOnComplete = markComplete && hasTimeblocks ? ('manual' as const) : undefined;
                if (subtopicId) {
                  const subtopics = t.subtopics.map((st) =>
                    st.id === subtopicId
                      ? {
                          ...st,
                          completed: markComplete,
                          completedVia: viaOnComplete,
                        }
                      : st,
                  );
                  const allDone = subtopics.length > 0 && subtopics.every((st) => st.completed);
                  return {
                    ...t,
                    subtopics,
                    completed: allDone,
                    completedOn: allDone && markComplete ? completedDay : markComplete ? t.completedOn : undefined,
                  };
                }
                if (t.subtopics.length > 0) {
                  const subtopics = t.subtopics.map((st) => ({
                    ...st,
                    completed: markComplete,
                    completedVia: viaOnComplete,
                  }));
                  return {
                    ...t,
                    subtopics,
                    completed: markComplete,
                    completedOn: markComplete ? completedDay : undefined,
                    completedVia: viaOnComplete,
                  };
                }
                return {
                  ...t,
                  completed: markComplete,
                  completedOn: markComplete ? completedDay : undefined,
                  completedVia: viaOnComplete,
                };
              }),
            },
      ),
    });

    await persistCourse(updated);
    set((s) => ({ courses: s.courses.map((c) => (c.id === courseId ? updated : c)) }));

    if (markComplete) {
      if (hasTimeblocks) {
        await usePlayerStore.getState().addXP(
          XP_REWARDS.topic,
          subtopicId ? `Subtema: ${topic.name}` : `Tema: ${topic.name}`,
        );
        await get().addStudyTime(courseId, unitId, topicId, studyMinutes, false, subtopicId, true);
      } else {
        usePlayerStore.getState().addNotification(
          createNotification(
            'herald',
            '📅 Exporta el tema al horario primero — sin bloques asignados no hay XP',
          ),
        );
      }
    } else if (completedVia === 'manual' && hasTimeblocks) {
      await usePlayerStore.getState().loseXP(
        XP_REWARDS.topic,
        subtopicId ? `Subtema desmarcado: ${topic.name}` : `Tema desmarcado: ${topic.name}`,
      );
      await get().subtractStudyTime(courseId, unitId, topicId, studyMinutes, subtopicId);
    }

    syncDailyMissions();
  },

  addThorSection: async (courseId, name) => {
    const section: ThorSection = {
      id: generateId(),
      name: name.trim(),
      order: (get().courses.find((c) => c.id === courseId)?.thorSections?.length ?? 0),
    };
    await saveCourse(get, set, courseId, (c) => ({
      ...c,
      thorSections: [...(c.thorSections ?? []), section],
    }));
  },

  updateThorSection: async (courseId, sectionId, name) => {
    await saveCourse(get, set, courseId, (c) => ({
      ...c,
      thorSections: (c.thorSections ?? []).map((s) => (s.id === sectionId ? { ...s, name: name.trim() } : s)),
    }));
  },

  deleteThorSection: async (courseId, sectionId) => {
    await saveCourse(get, set, courseId, (c) => ({
      ...c,
      thorSections: (c.thorSections ?? []).filter((s) => s.id !== sectionId),
      thorTasks: (c.thorTasks ?? []).map((t) => (t.sectionId === sectionId ? { ...t, sectionId: undefined } : t)),
    }));
  },

  addThorTaskType: async (courseId, name, icon = '📌') => {
    await saveCourse(get, set, courseId, (c) => ({
      ...c,
      thorTaskTypes: [...(c.thorTaskTypes ?? []), { id: generateId(), name: name.trim(), icon }],
    }));
  },

  addThorTask: async (courseId, data) => {
    const course = get().courses.find((c) => c.id === courseId);
    if (!course || !data.title.trim()) return undefined;
    const complexity = data.complexity ?? 'medium';
    const priority = migratePriority(data.priority);
    const taskId = generateId();
    const missionId = generateId();
    const task: ThorTask = {
      id: taskId,
      missionId,
      title: data.title.trim(),
      dueDate: data.dueDate,
      priority,
      complexity,
      taskTypeId: data.taskTypeId,
      estimateBlocks: data.estimateBlocks,
      sectionId: data.sectionId,
      parentTaskId: data.parentTaskId,
      subtasks: [],
      completed: false,
      createdAt: new Date().toISOString(),
    };
    const { useMissionsStore } = await import('./missionsStore');
    await useMissionsStore.getState().addMission({
      id: missionId,
      title: task.title,
      type: missionTypeFromThorType(data.taskTypeId),
      courseId,
      courseName: course.name,
      dueDate: data.dueDate || todayISO(),
      priority,
      complexity,
      source: 'thor',
      thorTaskId: taskId,
    });
    await saveCourse(get, set, courseId, (c) => ({
      ...c,
      thorTasks: [...(c.thorTasks ?? []), task],
    }));
    return taskId;
  },

  updateThorTask: async (courseId, taskId, data) => {
    const course = get().courses.find((c) => c.id === courseId);
    const task = course?.thorTasks?.find((t) => t.id === taskId);
    if (!course || !task) return;
    const nextPriority = data.priority ? migratePriority(data.priority) : task.priority;
    const nextComplexity = data.complexity ?? task.complexity;
    await saveCourse(get, set, courseId, (c) => ({
      ...c,
      thorTasks: (c.thorTasks ?? []).map((t) =>
        t.id === taskId
          ? {
              ...t,
              ...data,
              priority: nextPriority,
              complexity: nextComplexity,
              sectionId: data.sectionId !== undefined ? (data.sectionId || undefined) : t.sectionId,
            }
          : t,
      ),
    }));
    const { useMissionsStore } = await import('./missionsStore');
    const mission = useMissionsStore.getState().missions.find((m) => m.id === task.missionId);
    if (!mission) return;
    const updatedMission = {
      ...mission,
      title: data.title ?? task.title,
      priority: nextPriority,
      complexity: nextComplexity,
      dueDate: data.dueDate !== undefined ? (data.dueDate || '') : (task.dueDate || ''),
      type: data.taskTypeId ? missionTypeFromThorType(data.taskTypeId) : mission.type,
      xpReward: getMissionXpReward(nextPriority, nextComplexity),
    };
    await persistMission(updatedMission);
    useMissionsStore.setState((s) => ({
      missions: s.missions.map((m) => (m.id === task.missionId ? updatedMission : m)),
    }));
  },

  deleteThorTask: async (courseId, taskId) => {
    const course = get().courses.find((c) => c.id === courseId);
    const task = course?.thorTasks?.find((t) => t.id === taskId);
    if (!task) return;
    const childIds = (course?.thorTasks ?? []).filter((t) => t.parentTaskId === taskId).map((t) => t.id);
    for (const childId of childIds) {
      await get().deleteThorTask(courseId, childId);
    }
    const { useMissionsStore } = await import('./missionsStore');
    await useMissionsStore.getState().deleteMission(task.missionId);
    await saveCourse(get, set, courseId, (c) => ({
      ...c,
      thorTasks: (c.thorTasks ?? []).filter((t) => t.id !== taskId && t.parentTaskId !== taskId),
    }));
  },

  toggleThorTask: async (courseId, taskId) => {
    const course = get().courses.find((c) => c.id === courseId);
    const task = course?.thorTasks?.find((t) => t.id === taskId);
    if (!task) return;
    const { useMissionsStore } = await import('./missionsStore');
    if (task.completed) {
      await useMissionsStore.getState().uncompleteMission(task.missionId);
    } else {
      await useMissionsStore.getState().completeMission(task.missionId);
    }
  },

  addThorSubtask: async (courseId, taskId, title) => {
    const sub: ThorSubtask = { id: generateId(), title: title.trim(), completed: false };
    await saveCourse(get, set, courseId, (c) => ({
      ...c,
      thorTasks: (c.thorTasks ?? []).map((t) =>
        t.id === taskId ? { ...t, subtasks: [...t.subtasks, sub] } : t,
      ),
    }));
  },

  toggleThorSubtask: async (courseId, taskId, subtaskId) => {
    const course = get().courses.find((c) => c.id === courseId);
    const task = course?.thorTasks?.find((t) => t.id === taskId);
    if (!task) return;
    const subtasks = task.subtasks.map((s) =>
      s.id === subtaskId ? { ...s, completed: !s.completed } : s,
    );
    const allDone = subtasks.length > 0 && subtasks.every((s) => s.completed);
    await saveCourse(get, set, courseId, (c) => ({
      ...c,
      thorTasks: (c.thorTasks ?? []).map((t) => (t.id === taskId ? { ...t, subtasks } : t)),
    }));
    if (allDone && !task.completed) {
      await get().toggleThorTask(courseId, taskId);
    } else if (!allDone && task.completed) {
      await get().toggleThorTask(courseId, taskId);
    }
  },

  deleteThorSubtask: async (courseId, taskId, subtaskId) => {
    await saveCourse(get, set, courseId, (c) => ({
      ...c,
      thorTasks: (c.thorTasks ?? []).map((t) =>
        t.id === taskId ? { ...t, subtasks: t.subtasks.filter((s) => s.id !== subtaskId) } : t,
      ),
    }));
  },

  syncThorTaskFromMission: async (missionId, completed, xpReward) => {
    const course = get().courses.find((c) => (c.thorTasks ?? []).some((t) => t.missionId === missionId));
    if (!course) return;
    const task = course.thorTasks!.find((t) => t.missionId === missionId)!;
    const xp = xpReward ?? 0;
    await saveCourse(get, set, course.id, (c) => {
      const thorXpEarned = completed
        ? (c.thorXpEarned ?? 0) + (task.xpEarned ? 0 : xp)
        : Math.max(0, (c.thorXpEarned ?? 0) - (task.xpEarned ?? xp));
      return {
        ...c,
        thorXpEarned,
        thorTasks: (c.thorTasks ?? []).map((t) =>
          t.missionId === missionId
            ? {
                ...t,
                completed,
                xpEarned: completed ? (xpReward ?? t.xpEarned ?? 0) : undefined,
                subtasks: completed ? t.subtasks.map((s) => ({ ...s, completed: true })) : t.subtasks.map((s) => ({ ...s, completed: false })),
              }
            : t,
        ),
      };
    });
    syncDailyMissions();
  },

  syncThorOnMissionDelete: async (missionId) => {
    const course = get().courses.find((c) => (c.thorTasks ?? []).some((t) => t.missionId === missionId));
    if (!course) return;
    await saveCourse(get, set, course.id, (c) => ({
      ...c,
      thorTasks: (c.thorTasks ?? []).filter((t) => t.missionId !== missionId),
    }));
  },

  patchThorTaskFromBoard: async (courseId, taskId, data) => {
    await saveCourse(get, set, courseId, (c) => ({
      ...c,
      thorTasks: (c.thorTasks ?? []).map((t) => (t.id === taskId ? { ...t, ...data } : t)),
    }));
  },

  getCourse: (id) => get().courses.find((c) => c.id === id),

  getTotalTopics: () => {
    let completed = 0;
    let total = 0;
    for (const course of get().courses) {
      for (const unit of course.units) {
        for (const topic of unit.topics) {
          total++;
          if (topic.completed || topic.studyTime > 0 || topic.domainLevel > DomainLevel.MORTAL) completed++;
        }
      }
    }
    return { completed, total };
  },

  recalculateProgress: recalcCourse,
}));
