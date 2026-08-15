import { db } from './db';
import type { Course, TimeBlock, TopicCompletionVia } from '../types';

export interface TopicRef {
  courseId: string;
  unitId: string;
  topicId: string;
  subtopicId?: string;
}

export function isAssignedStudyBlock(b: TimeBlock): boolean {
  return !!b.title && b.type !== 'rest';
}

export function blockMatchesTopicRef(b: TimeBlock, ref: TopicRef): boolean {
  if (!isAssignedStudyBlock(b)) return false;
  if (b.courseId !== ref.courseId || b.unitId !== ref.unitId || b.topicId !== ref.topicId) return false;
  if (ref.subtopicId) return b.subtopicId === ref.subtopicId;
  return !b.subtopicId;
}

export function topicRefFromBlock(block: TimeBlock): TopicRef | null {
  if (!block.courseId || !block.unitId || !block.topicId) return null;
  return {
    courseId: block.courseId,
    unitId: block.unitId,
    topicId: block.topicId,
    subtopicId: block.subtopicId,
  };
}

export async function getLinkedBlocksForTopic(ref: TopicRef): Promise<TimeBlock[]> {
  const all = await db.timeblocks.toArray();
  return all.filter((b) => blockMatchesTopicRef(b, ref));
}

export function allLinkedBlocksComplete(blocks: TimeBlock[]): boolean {
  return blocks.length > 0 && blocks.every((b) => b.completed);
}

export function getTopicCompletedVia(courses: Course[], ref: TopicRef): TopicCompletionVia | undefined {
  const course = courses.find((c) => c.id === ref.courseId);
  const unit = course?.units.find((u) => u.id === ref.unitId);
  const topic = unit?.topics.find((t) => t.id === ref.topicId);
  if (!topic) return undefined;
  if (ref.subtopicId) {
    return topic.subtopics.find((st) => st.id === ref.subtopicId)?.completedVia;
  }
  return topic.completedVia;
}

export function isTopicMarkedComplete(courses: Course[], ref: TopicRef): boolean {
  const course = courses.find((c) => c.id === ref.courseId);
  const unit = course?.units.find((u) => u.id === ref.unitId);
  const topic = unit?.topics.find((t) => t.id === ref.topicId);
  if (!topic) return false;
  if (ref.subtopicId) {
    return !!topic.subtopics.find((st) => st.id === ref.subtopicId)?.completed;
  }
  if (topic.subtopics.length > 0) {
    return topic.subtopics.every((st) => st.completed);
  }
  return !!topic.completed;
}

export function studyMinutesForTopicRef(blockCount: number, blockMinutes: number): number {
  return (blockCount > 0 ? blockCount : 1) * blockMinutes;
}
