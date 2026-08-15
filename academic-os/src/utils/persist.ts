import type {
  AppSettings,
  Course,
  DailyMissionDayRecord,
  Mission,
  Player,
  TimeBlock,
  WeeklyMissionWeekRecord,
} from '../types';
import { persistQueue } from './persistQueue';

export async function persistPlayer(player: Player): Promise<void> {
  persistQueue.enqueuePut('player', player.id, player);
  await persistQueue.waitForFlush();
}

export async function persistCourseRecord(course: Course): Promise<void> {
  persistQueue.enqueuePut('courses', course.id, course);
  await persistQueue.waitForFlush();
}

export async function deleteCourseRecord(id: string): Promise<void> {
  persistQueue.enqueueDelete('courses', id);
  await persistQueue.waitForFlush();
}

export async function persistMission(mission: Mission): Promise<void> {
  persistQueue.enqueuePut('missions', mission.id, mission);
  await persistQueue.waitForFlush();
}

export async function deleteMissionRecord(id: string): Promise<void> {
  persistQueue.enqueueDelete('missions', id);
  await persistQueue.waitForFlush();
}

export async function persistTimeBlock(block: TimeBlock): Promise<void> {
  persistQueue.enqueuePut('timeblocks', block.id, block);
  await persistQueue.waitForFlush();
}

export async function persistTimeBlocksBulk(blocks: TimeBlock[]): Promise<void> {
  for (const block of blocks) {
    persistQueue.enqueuePut('timeblocks', block.id, block);
  }
  await persistQueue.waitForFlush();
}

export async function deleteTimeBlocksBulk(ids: string[]): Promise<void> {
  for (const id of ids) {
    persistQueue.enqueueDelete('timeblocks', id);
  }
  await persistQueue.waitForFlush();
}

export async function persistSetting(setting: AppSettings): Promise<void> {
  persistQueue.enqueuePut('settings', setting.key, setting);
  await persistQueue.waitForFlush();
}

export async function deleteSettingKey(key: string): Promise<void> {
  persistQueue.enqueueDelete('settings', key);
  await persistQueue.waitForFlush();
}

export async function persistDailyMissionsRecord(record: DailyMissionDayRecord): Promise<void> {
  persistQueue.enqueuePut('dailyMissions', record.date, record);
  await persistQueue.waitForFlush();
}

export async function persistWeeklyMissionsRecord(record: WeeklyMissionWeekRecord): Promise<void> {
  persistQueue.enqueuePut('weeklyMissions', record.weekKey, record);
  await persistQueue.waitForFlush();
}

export { persistQueue } from './persistQueue';
