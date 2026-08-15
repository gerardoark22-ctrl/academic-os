import { useEffect, useRef } from 'react';

import { todayISO } from '../utils/gamification';

import { addDaysLocalISO, todayLocalISO } from '../utils/localTime';

import { usePlayerStore } from '../stores/playerStore';

import { useDailyMissionsStore } from '../stores/dailyMissionsStore';

import { useTimeStore } from '../stores/timeStore';



/** Detecta cambio de día (Perú) y ejecuta rollover aunque la app siga abierta. */

export function useDailyRolloverWatch() {

  const lastDateRef = useRef(todayISO());



  useEffect(() => {

    const runIfNewDay = async () => {

      const today = todayISO();

      if (today === lastDateRef.current) return;



      lastDateRef.current = today;



      await usePlayerStore.getState().ensureDailyRollover();

      await useDailyMissionsStore.getState().ensureToday();



      const timeStore = useTimeStore.getState();

      const todayLocal = todayLocalISO();

      const yesterday = addDaysLocalISO(todayLocal, -1);



      if (timeStore.selectedDate === yesterday || timeStore.selectedDate === todayLocal) {

        timeStore.setDate(todayLocal);

      } else {

        await timeStore.load(timeStore.selectedDate);

      }

    };



    void runIfNewDay();



    const interval = window.setInterval(() => void runIfNewDay(), 60_000);

    const onVisible = () => {

      if (document.visibilityState === 'visible') void runIfNewDay();

    };

    document.addEventListener('visibilitychange', onVisible);



    return () => {

      window.clearInterval(interval);

      document.removeEventListener('visibilitychange', onVisible);

    };

  }, []);

}

