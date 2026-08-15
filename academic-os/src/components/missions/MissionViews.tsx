import { useMemo } from 'react';

import { groupMissionsByDate, missionSortScore } from '../../utils/statsEngine';

import { getCourseColor } from '../../utils/courseColors';

import type { Mission, Course } from '../../types';

import { MissionCompactCard } from './MissionCompactCard';

import { MissionMonthGrid } from './MissionMonthGrid';

import { migratePriority } from '../../utils/priorityMigrate';
import { MissionEisenhowerView } from './MissionEisenhowerView';



interface MissionListViewProps {

  missions: Mission[];

  courses: Course[];

  courseFilter: string;

  onComplete: (id: string) => void;

  onEdit: (m: Mission) => void;

  onDelete: (id: string) => void;

  onExport: (m: Mission) => void;

}



export function MissionListView({

  missions,

  courses,

  courseFilter,

  onComplete,

  onEdit,

  onDelete,

  onExport,

}: MissionListViewProps) {

  const filtered = useMemo(() => {

    let list = [...missions];

    if (courseFilter) list = list.filter((m) => m.courseId === courseFilter);

    return list.sort((a, b) => missionSortScore(b) - missionSortScore(a));

  }, [missions, courseFilter]);



  const byPriority = useMemo(() => {

    const groups: Record<string, Mission[]> = {
      odisea: [],
      epica: [],
      chiste: [],
    };
    for (const m of filtered) groups[migratePriority(m.priority)].push(m);

    return groups;

  }, [filtered]);



  const getColor = (courseId: string) => {

    const c = courses.find((x) => x.id === courseId);

    return getCourseColor(courseId, c?.color);

  };



  if (filtered.length === 0) {

    return <p className="body-parchment py-8 text-center text-sm">Sin misiones en este filtro</p>;

  }



  return (

    <div className="space-y-5">

      {(['odisea', 'epica', 'chiste'] as const).map((prio) => {
        const items = byPriority[prio];
        if (items.length === 0) return null;
        return (
          <div key={prio}>
            <h4 className="title-carved mb-2 !text-xs">
              {prio === 'odisea' ? '🗡 ODISEA' : prio === 'epica' ? '⚔ ÉPICAS' : '▪ CHISTE'}

              <span className="text-readable-dim ml-2">({items.length})</span>

            </h4>

            <div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3">

              {items.map((m) => (

                <MissionCompactCard

                  key={m.id}

                  mission={m}

                  courseColor={getColor(m.courseId)}

                  onComplete={onComplete}

                  onEdit={onEdit}

                  onDelete={onDelete}

                  onExport={onExport}

                />

              ))}

            </div>

          </div>

        );

      })}

    </div>

  );

}



export function MissionCalendarView(props: MissionListViewProps) {

  return <MissionMonthGrid {...props} />;

}



export function MissionMatrixView(props: MissionListViewProps) {

  return <MissionEisenhowerView {...props} />;

}



export { groupMissionsByDate };


