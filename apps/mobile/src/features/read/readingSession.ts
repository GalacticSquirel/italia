/**
 * Records reading as study: active time goes into a study session (and the
 * streak), and finishing a story marks it read with its words and exposures.
 * Pure of React; the reader screen drives it.
 */
import type { StreakEvent } from '@italia/core';

import type { Repositories } from '@/data';
import { createActiveTimer } from '@/features/session/activeTimer';
import { recordStreakStudy } from '@/features/study/streakService';
import { msToMinutes } from '@/features/study/time';

import { lemmaOccurrences, type ReaderStory } from './storyModel';

/** Activity recorded on the study session when a story is finished. */
export const STORY_ACTIVITY = 'story';

/** One reading of a story. */
export interface ReadingSession {
  /** The screen is in view and the app in the foreground. */
  resume(): void;
  /** The screen left view or the app went to the background; saves time so far. */
  pause(): void;
  /** The learner did something (moved on, tapped a word): keeps the time counting. */
  touch(sentenceIndex?: number): void;
  /**
   * Mark the story read: records the reading (words, exposures, comprehension
   * result), the activity and the time, and counts a completed session for
   * the streak.
   */
  finish(comprehension: { correct: number; total: number } | null): StreakEvent[];
  /** Save the time and end the study session (leaving the reader). */
  close(): void;
  /** Whether the story has been finished in this reading. */
  readonly finished: boolean;
}

/** Start reading `story` at `now()`. */
export function startReadingSession(
  repos: Repositories,
  story: ReaderStory,
  now: () => Date = () => new Date(),
  onEnded?: () => void,
): ReadingSession {
  const timer = createActiveTimer();
  let studySessionId: string | null = null;
  let finished = false;
  let closed = false;
  repos.reading.open(story.id, now());

  /** The study session, started on the first minute of study (no empty sessions). */
  const session = (at: Date): string => {
    if (studySessionId !== null) return studySessionId;
    const stale = repos.studySessions.getActive();
    if (stale) repos.studySessions.end(stale.id, at);
    studySessionId = repos.studySessions.start(at).id;
    return studySessionId;
  };

  const flush = (completedSession = false): StreakEvent[] => {
    const at = now();
    const ms = timer.take(at.getTime());
    const minutes = msToMinutes(ms);
    if (minutes > 0 || completedSession) {
      const id = session(at);
      if (minutes > 0) repos.studySessions.heartbeat(id, minutes);
      return recordStreakStudy(repos, { at, activeMinutes: minutes, completedSession });
    }
    return [];
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
    touch(sentenceIndex) {
      if (closed) return;
      const at = now();
      if (timer.running) {
        // Close the current stretch so listening without tapping still counts.
        timer.pause(at.getTime());
        timer.resume(at.getTime());
      }
      if (sentenceIndex !== undefined && !finished) {
        repos.reading.savePosition(story.id, sentenceIndex, at);
      }
      flush();
    },
    finish(comprehension) {
      if (closed) return [];
      const at = now();
      repos.reading.markRead(
        story.id,
        { wordsRead: story.wordCount, exposures: lemmaOccurrences(story), comprehension },
        at,
      );
      finished = true;
      const events = flush(true);
      if (studySessionId !== null) repos.studySessions.addActivity(studySessionId, STORY_ACTIVITY);
      return events;
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
    get finished() {
      return finished;
    },
  };
}
