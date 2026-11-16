import { useEffect, useMemo, useRef } from 'react';
import { AppState } from 'react-native';

import { useRepositories } from '@/db';
import { useSync } from '@/sync';

import { startPracticeSession, type PracticeSession } from './practiceSession';

/** What a practice screen calls; both are safe to call at any time. */
export interface PracticeSessionHandle {
  /** The learner did something (keeps the time counting). */
  touch: () => void;
  /** The learner finished a unit of practice (counts a completed session once). */
  complete: () => void;
}

/**
 * Count the time spent on a practice screen as study (study session and
 * streak) while it is mounted and the app is in the foreground.
 *
 * @param activity - recorded on the study session when the practice completes
 * @param now - clock (tests)
 */
export function usePracticeSession(
  activity: string,
  now: () => Date = () => new Date(),
): PracticeSessionHandle {
  const repos = useRepositories();
  const { notifySessionEnded } = useSync();
  const session = useRef<PracticeSession | null>(null);
  const clock = useRef(now);
  useEffect(() => {
    clock.current = now;
  }, [now]);

  useEffect(() => {
    const s = startPracticeSession(repos, activity, () => clock.current(), notifySessionEnded);
    session.current = s;
    s.resume();
    const sub = AppState.addEventListener('change', (state) => {
      try {
        if (state === 'active') s.resume();
        else s.pause();
      } catch {
        // Saving study time must never take the screen down.
      }
    });
    return () => {
      sub.remove();
      try {
        s.close();
      } catch {
        // As above.
      }
      session.current = null;
    };
  }, [repos, activity, notifySessionEnded]);

  return useMemo(
    () => ({
      touch: () => {
        session.current?.touch();
      },
      complete: () => {
        try {
          session.current?.complete();
        } catch {
          // As above.
        }
      },
    }),
    [],
  );
}
