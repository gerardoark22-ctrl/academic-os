import { PlayerHeroPanel } from './PlayerHeroPanel';
import { TypewriterTitle } from '../ui/TypewriterTitle';
import { ExamModeBoard } from './ExamWarBanner';
import { DashboardTodayMissions, DashboardTodaySchedule } from './DashboardTodayPanels';
import { usePlayerStore } from '../../stores/playerStore';
import { useCoursesStore } from '../../stores/coursesStore';
import { getGerardexStage } from '../../utils/gamification';
import { getExamModeAlerts } from '../../utils/courseExams';

export function AgoraDashboard() {
  const player = usePlayerStore((s) => s.player);
  const courses = useCoursesStore((s) => s.courses);
  const stage = player ? getGerardexStage(player.level) : null;
  const displayTitle = player?.activeTitle ?? stage?.title ?? 'Aprendiz';

  const examAlerts = getExamModeAlerts(courses);

  return (
    <div className="space-y-6">
      <div>
        <TypewriterTitle text={displayTitle} className="mb-4 text-center" />
        <PlayerHeroPanel />
      </div>

      <ExamModeBoard exams={examAlerts} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <DashboardTodayMissions />
        <DashboardTodaySchedule />
      </div>
    </div>
  );
}
