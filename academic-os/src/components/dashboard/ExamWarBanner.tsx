import { motion } from 'framer-motion';
import { DynamicProgressBar } from '../ui/DynamicProgressBar';
import { computeWarReadiness, type CourseExamAlert } from '../../utils/courseExams';

interface ExamWarBannerProps {
  exam: CourseExamAlert;
  multi?: boolean;
}

function formatCountdown(days: number): { main: string; sub: string; critical: boolean } {
  if (days < 0) return { main: `${Math.abs(days)}`, sub: 'DÍAS VENCIDO', critical: true };
  if (days === 0) return { main: 'HOY', sub: 'ES EL DÍA', critical: true };
  if (days === 1) return { main: '1', sub: 'DÍA RESTANTE', critical: true };
  return { main: String(days), sub: 'DÍAS RESTANTES', critical: days <= 7 };
}

function CourseExamParticles({ color }: { color: string }) {
  return (
    <div className="exam-particles pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      {Array.from({ length: 8 }, (_, i) => (
        <motion.span
          key={i}
          className="exam-particle absolute h-1.5 w-1.5 rounded-full"
          style={{ background: color, boxShadow: `0 0 8px ${color}`, left: `${10 + i * 11}%`, top: `${15 + (i % 3) * 25}%` }}
          animate={{ y: [-4, -18, -4], opacity: [0.3, 0.9, 0.3] }}
          transition={{ duration: 2 + i * 0.2, repeat: Infinity, delay: i * 0.15 }}
        />
      ))}
    </div>
  );
}

export function ExamWarBanner({ exam, multi = false }: ExamWarBannerProps) {
  const cd = formatCountdown(exam.daysLeft);
  const readiness = computeWarReadiness(exam.courseProgress, exam.unitProgress);
  const studyLeft = Math.max(0, 100 - exam.unitProgress);
  const intense = exam.isCritical || cd.critical;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className={[
        'exam-war-banner',
        intense ? 'exam-war-banner-critical' : 'exam-war-banner-upcoming',
        multi ? 'exam-war-banner-multi' : '',
      ].filter(Boolean).join(' ')}
      style={{
        '--exam-accent': exam.courseColor,
        borderColor: exam.courseColor,
        boxShadow: `0 8px 0 #1A0F08, 0 0 ${multi ? 36 : intense ? 32 : 24}px ${exam.courseColor}${intense ? '66' : '44'}`,
      } as Record<string, string>}
    >
      <CourseExamParticles color={exam.courseColor} />
      <div className="exam-war-banner-inner">
        <div className="exam-war-banner-top">
          <span className="exam-war-label" style={{ color: exam.courseColor, textShadow: `0 0 10px ${exam.courseColor}88` }}>
            {intense ? '⚔ Modo Examen' : '📅 Próximo Examen'}
          </span>
          <span className="exam-war-priority" style={{ color: exam.courseColor }}>
            {exam.courseIcon} {exam.courseName.toUpperCase()}
          </span>
        </div>

        <div className="exam-war-grid">
          <div className="exam-war-countdown" style={{ borderColor: `${exam.courseColor}88` }}>
            <motion.span
              className="exam-war-countdown-number"
              style={{ color: exam.courseColor, textShadow: `0 0 24px ${exam.courseColor}` }}
              animate={cd.critical ? { scale: [1, 1.05, 1] } : {}}
              transition={{ duration: 2, repeat: Infinity }}
            >
              {cd.main}
            </motion.span>
            <span className="exam-war-countdown-sub">{cd.sub}</span>
          </div>

          <div className="exam-war-info">
            <h3 className="exam-war-title">{exam.unitName}</h3>
            <p className="exam-war-course">{exam.courseIcon} Unidad · {exam.courseName}</p>
            <p className="exam-war-date">
              {new Date(exam.examDate + 'T12:00:00').toLocaleDateString('es-MX', {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
              })}
            </p>
          </div>
        </div>

        <div className="exam-war-progress mt-5 grid gap-3 md:grid-cols-2">
          <DynamicProgressBar
            value={exam.unitProgress}
            max={100}
            label="Temario de la unidad"
            sublabel={`Te falta ~${studyLeft}% de esta unidad`}
            variant="study"
            size="md"
            shimmer={intense && exam.daysLeft <= 7}
          />
          <DynamicProgressBar
            value={readiness}
            max={100}
            label="Preparación de guerra"
            sublabel={`Índice ${readiness}/100 — curso al ${exam.courseProgress}%`}
            variant="xp"
            size="md"
            shimmer={intense && readiness < 50 && exam.daysLeft <= 7}
          />
        </div>
      </div>
    </motion.div>
  );
}

export function ExamModeBoard({ exams }: { exams: CourseExamAlert[] }) {
  if (exams.length === 0) return null;

  return (
    <section className="exam-mode-board space-y-3">
      <div className="exam-mode-board-head">
        <h2 className="exam-mode-board-title">Radar de Exámenes</h2>
        <p className="exam-mode-board-flavor flavor-brutal text-xs">
          {exams.length} unidad{exams.length !== 1 ? 'es' : ''} con fecha fijada
        </p>
      </div>
      <div className={exams.length > 1 ? 'grid grid-cols-1 gap-4 xl:grid-cols-2' : ''}>
        {exams.map((exam) => (
          <ExamWarBanner key={`${exam.courseId}-${exam.unitId}`} exam={exam} multi={exams.length > 1} />
        ))}
      </div>
    </section>
  );
}
