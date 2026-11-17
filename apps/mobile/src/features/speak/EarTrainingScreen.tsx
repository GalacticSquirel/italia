import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';

import type { Rng, Voice } from '@italia/core';
import type { MinimalPairContrast, MinimalPairItem } from '@italia/speech';

import { META_KEYS } from '@/data';
import { useRepositories } from '@/db';
import { usePracticeSession } from '@/features/study/usePracticeSession';
import { ITALIAN, useSpeech } from '@/speech';
import { Button, Card, Screen, Text, useTheme } from '@/ui';

import {
  answerTrial,
  nextTrial,
  parseHvptStats,
  type HvptStats,
  type HvptTrial,
} from './hvpt/hvpt';

/**
 * Contrasts device voices can render. Synthetic voices do not reliably make
 * the open/close e and o distinction, so those pairs need recorded speakers.
 */
export const DEVICE_VOICE_CONTRASTS: readonly MinimalPairContrast[] = ['geminate', 'stress'];

const CONTRAST_NAMES: Record<MinimalPairContrast, string> = {
  geminate: 'Single or double consonant',
  stress: 'Where the stress falls',
  midVowel: 'Open or closed vowel',
};

/** How a choice is written: stress and vowel pairs need the accent to tell them apart. */
export function choiceLabel(contrast: MinimalPairContrast, item: MinimalPairItem): string {
  return contrast === 'geminate' ? item.word : item.accented;
}

/** What the voice is given: accents mark stress for the synthesiser. */
function spokenForm(contrast: MinimalPairContrast, item: MinimalPairItem): string {
  return contrast === 'stress' ? item.accented : item.word;
}

/** Activity recorded on the study session (ear training has no end, so only its time counts). */
const EAR_TRAINING_ACTIVITY = 'ear_training';

export interface EarTrainingScreenProps {
  /** Random numbers (tests). */
  rng?: Rng;
}

type Answer = { chosen: MinimalPairItem; correct: boolean; levelChange: -1 | 0 | 1 } | null;

/**
 * High-variability ear training: hear a word from a minimal pair, pick which
 * one it was. The voice changes every trial and difficulty adapts.
 */
export function EarTrainingScreen({ rng = Math.random }: EarTrainingScreenProps) {
  const repos = useRepositories();
  const services = useSpeech();
  const { spacing } = useTheme();
  const [voices, setVoices] = useState<Voice[] | null>(null);
  const [stats, setStats] = useState<HvptStats>(() =>
    parseHvptStats(repos.meta.get(META_KEYS.hvptStats)),
  );
  const [trial, setTrial] = useState<HvptTrial | null>(null);
  const [answer, setAnswer] = useState<Answer>(null);
  const [count, setCount] = useState({ right: 0, total: 0 });
  const rngRef = useRef(rng);
  const practice = usePracticeSession(EAR_TRAINING_ACTIVITY);

  useEffect(() => {
    let live = true;
    void services.audio
      .voices('it')
      .catch(() => [])
      .then((v) => {
        if (live) setVoices(v);
      });
    return () => {
      live = false;
      services.audio.stop();
    };
  }, [services]);

  const play = useCallback(
    (t: HvptTrial) => {
      services.audio.stop();
      const voice = voices?.[t.talker];
      void services.audio
        .speak(spokenForm(t.set.contrast, t.target), {
          language: voice?.language ?? ITALIAN,
          rate: t.rate,
          voiceId: voice?.id,
        })
        .catch(() => undefined);
    },
    [services, voices],
  );

  const advance = useCallback(
    (from: HvptStats, previous: HvptTrial | null) => {
      if (!voices) return;
      const t = nextTrial(from, {
        rng: rngRef.current,
        talkers: Math.max(1, voices.length),
        previous,
        contrasts: DEVICE_VOICE_CONTRASTS,
      });
      setTrial(t);
      setAnswer(null);
      play(t);
    },
    [voices, play],
  );

  useEffect(() => {
    if (voices && !trial) advance(stats, null);
  }, [voices, trial, stats, advance]);

  const choose = (item: MinimalPairItem) => {
    if (!trial || answer) return;
    practice.touch();
    const result = answerTrial(stats, trial, item);
    setStats(result.stats);
    repos.meta.set(META_KEYS.hvptStats, JSON.stringify(result.stats));
    setCount((c) => ({ right: c.right + (result.correct ? 1 : 0), total: c.total + 1 }));
    setAnswer({ chosen: item, correct: result.correct, levelChange: result.levelChange });
  };

  if (!voices || !trial) {
    return (
      <Screen edges={['bottom', 'left', 'right']}>
        <ActivityIndicator accessibilityLabel="Preparing voices" />
      </Screen>
    );
  }

  const contrast = trial.set.contrast;
  return (
    <Screen edges={['bottom', 'left', 'right']} testID="ear-training-screen">
      <Text variant="caption" color="textMuted" testID="limited-voices">
        {`Spoken by ${voices.length > 0 ? `${String(voices.length)} Italian voice${voices.length === 1 ? '' : 's'}` : "your phone's Italian voice"} on this phone. Open and closed vowel pairs (pèsca, pésca) need recorded speakers, so they are left out.`}
      </Text>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text variant="caption" color="textMuted">{`Level ${String(trial.level)} of 3`}</Text>
        <Text variant="caption" color="textMuted">
          {`${String(count.right)} of ${String(count.total)} right`}
        </Text>
      </View>
      <Card>
        <Text variant="caption" color="textMuted">
          {CONTRAST_NAMES[contrast]}
        </Text>
        <Text variant="heading">Which word did you hear?</Text>
        <Button
          label="Play again"
          variant="secondary"
          onPress={() => {
            play(trial);
          }}
        />
      </Card>
      <View style={{ gap: spacing.sm }} accessibilityRole="radiogroup">
        {trial.options.map((item) => {
          const label = choiceLabel(contrast, item);
          return (
            <Button
              key={item.accented}
              label={`${label} · ${item.gloss}`}
              variant={answer?.chosen === item ? 'primary' : 'secondary'}
              accessibilityLabel={`${label}, ${item.gloss}`}
              disabled={answer !== null}
              onPress={() => {
                choose(item);
              }}
            />
          );
        })}
      </View>
      {answer ? (
        <Card accessibilityLiveRegion="polite">
          <Text variant="bodyStrong" color={answer.correct ? 'success' : 'danger'}>
            {answer.correct
              ? 'Right!'
              : `It was ${choiceLabel(contrast, trial.target)}: ${trial.target.gloss}.`}
          </Text>
          {answer.levelChange === 1 ? <Text>Level up: faster speech and harder pairs.</Text> : null}
          {answer.levelChange === -1 ? <Text>Back a level to steady things.</Text> : null}
          <Button
            label="Next"
            onPress={() => {
              advance(stats, trial);
            }}
          />
        </Card>
      ) : null}
    </Screen>
  );
}
