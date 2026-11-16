/**
 * Everything the reader screen needs for one story: the story and how well
 * the learner knows its words, playback, the reading session (time, position,
 * mark as read), the word sheet, listening-first mode and the comprehension
 * check. Screens render this; the logic lives in the modules it wires up.
 */
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { AppState } from 'react-native';

import type { ComprehensionQuestion, StoryFit } from '@italia/core';

import { META_KEYS, type LemmaRow } from '@/data';
import { useRepositories } from '@/db';
import { useSettingsStore } from '@/features/settings/settingsStore';
import { useSpeech } from '@/speech';
import { useSync } from '@/sync';

import { comprehensionFor } from './comprehension';
import { learnerWords, loadLibrary } from './library';
import {
  clampRate,
  createPlaybackController,
  type PlaybackController,
  type PlaybackState,
} from './playback/playbackController';
import { createStorySpeaker } from './playback/speakers';
import { startReadingSession, type ReadingSession } from './readingSession';
import type { ReaderStory } from './storyModel';
import { addWordToReviews, loadWordInfo, type WordInfo } from './wordInfo';

/** A story with what the learner knows of it. */
export interface StoryForReading {
  story: ReaderStory;
  /** Known-word coverage, 0 to 1. */
  coverage: number;
  fit: StoryFit;
  /** Lemmas the learner knows (to mark the others). */
  known: ReadonlySet<number>;
  /** The story's target words the learner has not met, for the preview. */
  newWords: LemmaRow[];
  /** Sentence to start at (where the learner left off). */
  startAt: number;
  /** Whether the learner had finished this story before. */
  readBefore: boolean;
  /** The next episode of the series, if any. */
  nextEpisodeId: string | null;
}

/** Load a story for reading, or null when it does not exist. */
export function loadStoryForReading(
  repos: ReturnType<typeof useRepositories>,
  storyId: string,
  now: Date,
): StoryForReading | null {
  const library = loadLibrary(repos, now);
  for (const series of library.series) {
    const index = series.episodes.findIndex((e) => e.id === storyId);
    const episode = series.episodes[index];
    if (!episode) continue;
    const progress = repos.reading.get(storyId);
    const last = episode.story.sentences.length - 1;
    return {
      story: episode.story,
      coverage: episode.coverage.ratio,
      fit: episode.fit,
      known: learnerWords(repos.cards.listAll(), now).known,
      newWords: episode.unmetTargetLemmaIds.flatMap((id) => {
        const lemma = repos.lemmas.getById(id);
        return lemma ? [lemma] : [];
      }),
      startAt: Math.min(Math.max(0, progress?.lastSentence ?? 0), Math.max(0, last)),
      readBefore: (progress?.completedAt ?? null) !== null,
      nextEpisodeId: series.episodes[index + 1]?.id ?? null,
    };
  }
  return null;
}

/** The open word sheet. */
export interface OpenWord {
  sentenceIndex: number;
  tokenIndex: number;
  info: WordInfo;
}

/** Where the learner is in the story. */
export type ReaderPhase = 'reading' | 'check' | 'done';

/** Result of the comprehension check. */
export interface CheckResult {
  correct: number;
  total: number;
}

const tokenOf = (story: ReaderStory, sentenceIndex: number, tokenIndex: number) =>
  story.sentences[sentenceIndex]?.tokens[tokenIndex];

/** The reader's state and actions for `storyId`. */
export function useStoryReader(storyId: string) {
  const repos = useRepositories();
  const services = useSpeech();
  const { notifySessionEnded } = useSync();
  const settingsRate = useSettingsStore((s) => s.settings.speechRate);
  const [openedAt] = useState(() => new Date());
  const data = useMemo(
    () => loadStoryForReading(repos, storyId, openedAt),
    [repos, storyId, openedAt],
  );
  const story = data?.story ?? null;

  // Reading session: time, position, mark as read.
  const sessionRef = useRef<ReadingSession | null>(null);
  useEffect(() => {
    if (!story) return undefined;
    const session = startReadingSession(repos, story, () => new Date(), notifySessionEnded);
    sessionRef.current = session;
    session.resume();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') session.resume();
      else session.pause();
    });
    return () => {
      sub.remove();
      session.close();
      sessionRef.current = null;
    };
  }, [repos, story, notifySessionEnded]);
  useFocusEffect(
    useCallback(() => {
      sessionRef.current?.resume();
      return () => {
        sessionRef.current?.pause();
      };
    }, []),
  );

  // Playback. The learner's speech rate is the starting speed; the reader's
  // own control changes it from there.
  const initialRate = useRef(clampRate(settingsRate));
  const [controller, setController] = useState<PlaybackController | null>(null);
  useEffect(() => {
    if (!story || !data) return undefined;
    const c = createPlaybackController({
      sentences: story.sentences.map((s) => ({ text: s.it, tokens: s.tokens })),
      speaker: createStorySpeaker(services, { voiceSeed: story.id }),
      rate: initialRate.current,
      startAt: data.startAt,
      onSentenceDone: (i) => {
        sessionRef.current?.touch(Math.min(i + 1, story.sentences.length - 1));
      },
    });
    setController(c);
    return () => {
      c.dispose();
      setController(null);
    };
  }, [story, data, services]);
  const playback = useSyncExternalStore(
    useCallback((l: () => void) => controller?.subscribe(l) ?? (() => undefined), [controller]),
    () => controller?.getState() ?? IDLE,
  );

  // Listening-first mode and revealed sentences.
  const [listenFirst, setListenFirstState] = useState(
    () => repos.meta.get(META_KEYS.readerListenFirst) === '1',
  );
  const [revealed, setRevealed] = useState<ReadonlySet<number> | 'all'>(new Set());
  const setListenFirst = useCallback(
    (on: boolean) => {
      repos.meta.set(META_KEYS.readerListenFirst, on ? '1' : '0');
      setListenFirstState(on);
      setRevealed(new Set());
    },
    [repos],
  );
  const reveal = useCallback((index: number | 'all') => {
    setRevealed((prev) => {
      if (index === 'all' || prev === 'all') return 'all';
      const next = new Set(prev);
      next.add(index);
      return next;
    });
    sessionRef.current?.touch();
  }, []);
  const isHidden = useCallback(
    (index: number) => listenFirst && revealed !== 'all' && !revealed.has(index),
    [listenFirst, revealed],
  );

  // Translations.
  const [translated, setTranslated] = useState<ReadonlySet<number>>(new Set());
  const toggleTranslation = useCallback((index: number) => {
    setTranslated((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
    sessionRef.current?.touch(index);
  }, []);

  // Word sheet.
  const [word, setWord] = useState<OpenWord | null>(null);
  const openWord = useCallback(
    (sentenceIndex: number, tokenIndex: number) => {
      if (!story) return;
      const token = tokenOf(story, sentenceIndex, tokenIndex);
      if (!token) return;
      setWord({ sentenceIndex, tokenIndex, info: loadWordInfo(repos, token, new Date()) });
      sessionRef.current?.touch(sentenceIndex);
    },
    [repos, story],
  );
  const closeWord = useCallback(() => {
    setWord(null);
  }, []);
  const addToReviews = useCallback(
    (lemmaId: number) => {
      const result = addWordToReviews(repos, lemmaId, new Date());
      setWord((w) => {
        if (!w || !story) return w;
        const token = tokenOf(story, w.sentenceIndex, w.tokenIndex);
        return token ? { ...w, info: loadWordInfo(repos, token, new Date()) } : w;
      });
      return result;
    },
    [repos, story],
  );

  const addNewWords = useCallback(
    () =>
      (data?.newWords ?? []).filter((w) => addWordToReviews(repos, w.id, new Date()) === 'added')
        .length,
    [repos, data],
  );

  // End of story.
  const [phase, setPhase] = useState<ReaderPhase>('reading');
  const [result, setResult] = useState<CheckResult | null>(null);
  const questions = useMemo<ComprehensionQuestion[]>(
    () => (story ? comprehensionFor(repos, story) : []),
    [repos, story],
  );
  const finish = useCallback(
    (check: CheckResult | null) => {
      controller?.pause();
      sessionRef.current?.finish(check);
      setResult(check);
      setPhase('done');
    },
    [controller],
  );

  return {
    data,
    playback,
    controller,
    listenFirst,
    setListenFirst,
    isHidden,
    allRevealed: revealed === 'all',
    reveal,
    translated,
    toggleTranslation,
    word,
    openWord,
    closeWord,
    addToReviews,
    addNewWords,
    phase,
    startCheck: () => {
      controller?.pause();
      setPhase('check');
    },
    questions,
    finish,
    result,
    speechRate: settingsRate,
    touch: (sentenceIndex?: number) => sessionRef.current?.touch(sentenceIndex),
  };
}

const IDLE: PlaybackState = {
  status: 'idle',
  scope: 'story',
  sentenceIndex: 0,
  wordIndex: null,
  rate: 1,
  timing: null,
  voice: null,
  voiceName: null,
  error: null,
};
