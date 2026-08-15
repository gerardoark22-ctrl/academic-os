import { motion } from 'framer-motion';
import { DynamicProgressBar } from '../ui/DynamicProgressBar';
import { getCourseColor, courseAuraCss } from '../../utils/courseColors';
import { daysUntil } from '../../utils/gamification';
import { getCourseExamDates } from '../../utils/courseExams';
import {
  kratosTopicStats,
  thorTaskStats,
  courseHasThorTasks,
  upcomingThorTasks,
  courseModeBadgeLabel,
  courseCardSectionVisibility,
  formatExamDaysLabel,
  nearestExamUnit,
} from '../../utils/thorCourse';
import type { Course } from '../../types';

interface CourseDualStatsProps {
  course: Course;
  variant: 'card' | 'hub';
  accentColor?: string;
  onFirstThorTask?: () => void;
}

function CourseDualStatsSections({ course, variant, accentColor, onFirstThorTask }: CourseDualStatsProps) {
  const kratosStats = kratosTopicStats(course);
  const thorStats = thorTaskStats(course);
  const { showKratosSection, showThorSection, hasKratosContent, hasThorContent } =
    courseCardSectionVisibility(course);
  const nextExam = nearestExamUnit(course);
  const nextExamLabel = formatExamDaysLabel(nextExam?.examDate);
  const examUrgent = !!(nextExam?.examDate && daysUntil(nextExam.examDate) <= 7);
  const isHub = variant === 'hub';

  const sectionTitle = (label: string) => (
    <p
      className={`mb-1.5 font-semibold uppercase tracking-wider text-readable-dim ${isHub ? 'text-xs' : 'text-[10px]'}`}
    >
      {label}
    </p>
  );

  const emptyMsg = (text: string) => (
    <p className={`body-parchment text-center opacity-80 ${isHub ? 'py-3 text-sm' : 'py-2 text-xs'}`}>{text}</p>
  );

  const statCell = (
    label: string,
    value: string | number,
    opts?: { urgent?: boolean; overdue?: boolean },
  ) => {
    if (isHub) {
      return (
        <div
          className={`course-hub-stat ${opts?.overdue ? 'ring-1 ring-blood-fresh/70 bg-blood-dried/10' : ''}`}
          style={opts?.urgent && accentColor ? { borderColor: `${accentColor}66` } : undefined}
        >
          <p className="course-hub-stat-label">{label}</p>
          <p
            className={`course-hub-stat-value ${opts?.urgent ? 'flavor-brutal' : ''} ${opts?.overdue ? 'text-blood-fresh' : ''}`}
          >
            {value}
          </p>
        </div>
      );
    }
    return (
      <div className={`stat-block !py-2 ${opts?.overdue ? 'ring-1 ring-blood-fresh/70 bg-blood-dried/10' : ''}`}>
        <p className="text-readable-dim">{label}</p>
        <p
          className={`label-clear ${opts?.urgent ? 'flavor-brutal' : ''} ${opts?.overdue ? 'flavor-brutal text-blood-fresh' : ''}`}
        >
          {value}
        </p>
      </div>
    );
  };

  return (
    <div className={isHub ? 'space-y-3' : 'mt-3 space-y-3'}>
      {showKratosSection && (
        <div>
          {sectionTitle('⚔ KRATOS')}
          {hasKratosContent ? (
            <div className={`grid grid-cols-2 gap-2 ${isHub ? 'md:gap-3' : 'text-[11px]'}`}>
              {statCell('Temas', `${kratosStats.doneTopics}/${kratosStats.totalTopics}`)}
              {statCell('Próx. examen', nextExamLabel, { urgent: examUrgent })}
            </div>
          ) : (
            emptyMsg('Sin temario')
          )}
        </div>
      )}

      {showThorSection && (
        <div>
          {sectionTitle('⚡ THOR')}
          {hasThorContent ? (
            <div className={`grid grid-cols-2 gap-2 ${isHub ? 'md:gap-3' : 'text-[11px]'}`}>
              {statCell('Pendientes', thorStats.pending)}
              {statCell('Vencidas', thorStats.overdue || '—', { overdue: thorStats.overdue > 0 })}
            </div>
          ) : isHub && onFirstThorTask ? (
            <div className="flex flex-col items-center gap-2 py-1">
              {emptyMsg('Gestor vacío — forja tu primera tarea')}
              <button type="button" className="btn-war btn-war-sm" onClick={onFirstThorTask}>
                ⚡ + Primera tarea
              </button>
            </div>
          ) : (
            emptyMsg('Gestor vacío')
          )}
        </div>
      )}
    </div>
  );
}

interface CourseWarCardProps {
  course: Course;
  index?: number;
  urgentCount?: number;
  onClick: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
}

export function CourseWarCard({ course, index = 0, urgentCount = 0, onClick, onEdit, onDelete }: CourseWarCardProps) {
  const color = getCourseColor(course.id, course.color);
  const { showKratosBar } = courseCardSectionVisibility(course);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.92 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: index * 0.08, duration: 0.4 }}
      whileHover={{ y: -4, scale: 1.02 }}
      className="course-war-card relative cursor-pointer overflow-hidden rounded-sm border-2 border-ink/50 p-4"
      style={{
        ...courseAuraCss(color, 0.45),
        boxShadow: `0 0 20px ${color}44, 0 6px 0 var(--ink)`,
      }}
      onClick={onClick}
    >
      {urgentCount > 0 && (
        <span className="absolute right-2 top-2 flex h-6 min-w-[1.5rem] items-center justify-center rounded-full bg-blood-dried px-1.5 text-[10px] font-bold text-parchment shadow-lg animate-pulse">
          {urgentCount} ⚔
        </span>
      )}

      <div className="flex items-start justify-between gap-2">
        <div>
          <span className="text-2xl drop-shadow-lg">{course.icon}</span>
          <h3 className="title-carved mt-1 !text-base" style={{ color }}>{course.name}</h3>
          <p className="text-[10px] uppercase tracking-wider text-readable-dim">
            {courseModeBadgeLabel(course)}
          </p>
        </div>
        <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
          {onEdit && <button type="button" onClick={onEdit} className="btn-icon-war">✎</button>}
          {onDelete && <button type="button" onClick={onDelete} className="btn-icon-war flavor-brutal">✕</button>}
        </div>
      </div>

      {showKratosBar && (
        <DynamicProgressBar
          value={course.progress}
          label=""
          variant="course"
          size="sm"
          showPercent
          shimmer={course.progress >= 50}
        />
      )}

      <CourseDualStatsSections course={course} variant="card" />
    </motion.div>
  );
}

interface CourseWarHubProps {
  course: Course;
  onFirstThorTask?: () => void;
}

export function CourseWarHub({ course, onFirstThorTask }: CourseWarHubProps) {
  const color = getCourseColor(course.id, course.color);
  const { showKratosBar, hasKratosContent } = courseCardSectionVisibility(course);
  const examDates = getCourseExamDates(course);
  const upcoming = upcomingThorTasks(course, 3);
  const hasThorContent = courseHasThorTasks(course);

  return (
    <div
      className="course-hub-horizontal panel-epic relative overflow-hidden"
      style={{
        ...courseAuraCss(color, 0.55),
        boxShadow: `0 0 32px ${color}44, 0 6px 0 var(--ink)`,
        borderLeft: `5px solid ${color}`,
      }}
    >
      <div className="course-hub-shimmer pointer-events-none absolute inset-0" aria-hidden />

      <div className="course-hub-inner relative z-10 flex flex-col gap-4 p-4 md:flex-row md:items-start md:justify-between">
        <div className="flex min-w-0 items-center gap-4">
          <span className="course-hub-icon text-4xl md:text-5xl">{course.icon}</span>
          <div className="min-w-0">
            <h2
              className="title-carved-lg !text-xl md:!text-2xl"
              style={{ color, textShadow: `0 0 16px ${color}66` }}
            >
              {course.name}
            </h2>
            <p className="body-parchment mt-1 text-sm">{courseModeBadgeLabel(course)}</p>
            {hasKratosContent && (
              <p className="body-parchment mt-0.5 text-xs text-readable-dim">Dominio {course.progress}%</p>
            )}
            {showKratosBar && (
              <div className="mt-2 max-w-xs">
                <DynamicProgressBar
                  value={course.progress}
                  label=""
                  variant="course"
                  size="sm"
                  showPercent
                  shimmer
                />
              </div>
            )}
          </div>
        </div>

        <div className="w-full md:max-w-sm md:shrink-0">
          <CourseDualStatsSections
            course={course}
            variant="hub"
            accentColor={color}
            onFirstThorTask={onFirstThorTask}
          />
        </div>
      </div>

      {hasKratosContent && examDates.length > 0 && (
        <div className="course-hub-exams relative z-10 border-t border-ink/30 px-4 py-3">
          <p className="course-hub-exams-title mb-2 text-xs uppercase tracking-widest" style={{ color }}>
            Fechas de examen
          </p>
          <div className="flex flex-wrap gap-2">
            {examDates.map((ex) => (
              <span
                key={ex.unitId}
                className={`course-hub-exam-chip ${ex.daysLeft <= 7 ? 'course-hub-exam-chip-hot' : ''}`}
                style={{ borderColor: color, boxShadow: ex.daysLeft <= 7 ? `0 0 12px ${color}55` : undefined }}
              >
                <span className="font-epic text-sm">{ex.unitName}</span>
                <span className="text-readable-dim text-xs">
                  {ex.daysLeft < 0 ? `+${Math.abs(ex.daysLeft)}d vencido` : ex.daysLeft === 0 ? 'HOY' : `${ex.daysLeft}d`}
                  {' · '}
                  {ex.examDate}
                </span>
              </span>
            ))}
          </div>
        </div>
      )}

      {hasThorContent && upcoming.length > 0 && (
        <div className="relative z-10 border-t border-ink/30 px-4 py-3">
          <p className="mb-2 text-xs uppercase tracking-widest text-readable-dim">Próximas tareas</p>
          <div className="space-y-1">
            {upcoming.map((t) => (
              <p key={t.id} className="text-xs text-readable-dim">
                <span className="text-highlight">{t.title}</span>
                {t.dueDate ? ` · ${t.dueDate} (${daysUntil(t.dueDate)}d)` : ' · sin fecha'}
              </p>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
