/**
 * Records practice outside review sessions and stories (speaking drills, ear
 * training, shadowing, conversation) as study: active time goes into a study
 * session and the streak, like reading does. Pure of React; screens drive it
 * through {@link usePracticeSession}.
 */
import type { StreakEvent } from '@italia/core';

import type { Repositories } from '@/data';
import { createActiveTimer } from '@/features/session/activeTimer';

import { recordStreakStudy } from './streakService';
import { msToMinutes } from './time';

/** One stretch of practice on one screen. */
export interface PracticeSession {
  /** The screen is in view and the app in the foreground. */
  resume(): void;
  /** The app went to the background; saves time so far. */
  pause(): void;
  /** The learner did something: keeps the time counting (idle stretches are capped). */
  touch(): void;
  /**
   * The learner finished a unit of practice (a drill, a conversation): saves
   * the time, records the activity and counts a completed session for the
   * streak. Only the first call counts.
   */
  complete(): StreakEvent[];
  /** Save the time and end the study session (leaving the screen). */
  close(): void;
}

/** Start practising `activity` (recorded on the study session when completed). */
export function startPracticeSession(
  repos: Repositories,
  activity: string,
  now: () => Date = () => new Date(),
  onEnded?: () => void,
): PracticeSession {
  const timer = createActiveTimer();
  let studySessionId: string | null = null;
  let completed = false;
  let closed = false;

  /** The study session, started on the first time saved (no empty sessions). */
  const session = (at: Date): string => {
    if (studySessionId !== null) return studySessionId;
    const stale = repos.studySessions.getActive();
    if (stale) repos.studySessions.end(stale.id, at);
    studySessionId = repos.studySessions.start(at).id;
    return studySessionId;
  };

  const flush = (completedSession = false): StreakEvent[] => {
    const at = now();
    const minutes = msToMinutes(timer.take(at.getTime()));
    if (minutes <= 0 && !completedSession) return [];
    const id = session(at);
    if (minutes > 0) repos.studySessions.heartbeat(id, minutes);
    if (completedSession) repos.studySessions.addActivity(id, activity);
    return recordStreakStudy(repos, { at, activeMinutes: minutes, completedSession });
  };

  return {
    resume() {
      if (!closed) timer.resume(now().getTime());
    },
    pause() {
      if (closed) return;
      timer.pause(now().getTime());
      flush();
    },
    touch() {
      if (closed || !timer.running) return;
      const at = now().getTime();
      // Close the current stretch so steady practice is not cut by the idle cap.
      timer.pause(at);
      timer.resume(at);
    },
    complete() {
      if (closed || completed) return [];
      completed = true;
      const at = now().getTime();
      const running = timer.running;
      timer.pause(at);
      if (running) timer.resume(at);
      return flush(true);
    },
    close() {
      if (closed) return;
      timer.pause(now().getTime());
      flush();
      closed = true;
      if (studySessionId !== null) {
        repos.studySessions.end(studySessionId, now());
        studySessionId = null;
        onEnded?.();
      }
    },
  };
}
