import { useEffect, useMemo, useRef, useState } from 'react';
import { View } from 'react-native';

import type { AudioClip } from '@italia/core';

import { useRepositories } from '@/db';
import { useSettingsStore } from '@/features/settings/settingsStore';
import { getContentIndex } from '@/features/study/content';
import { SPOKEN_PROMPT_MAX_WORDS, wordCount } from '@/features/study/prompts';
import { usePracticeSession } from '@/features/study/usePracticeSession';
import {
  recordingClip,
  sayItalian,
  useSpeech,
  type PronunciationAnalysis,
  type Recording,
} from '@/speech';
import { Button, Card, EmptyState, Screen, Text, useTheme } from '@/ui';

import { MicGate } from './components/MicGate';
import { PronunciationResult } from './components/PronunciationResult';
import { Waveform } from './components/Waveform';

/** Sentences offered for shadowing. */
export const SHADOWING_SENTENCES = 20;

type Step = 'idle' | 'playing' | 'recording' | 'scoring' | 'done';

function samplesOf(clip: AudioClip | null): Float32Array | null {
  return clip?.kind === 'pcm' ? clip.samples : null;
}

/** Shadowing: hear a sentence, say it straight after, compare the waveforms and the score. */
export function ShadowingScreen() {
  const repos = useRepositories();
  const services = useSpeech();
  const { spacing } = useTheme();
  const rate = useSettingsStore((s) => s.settings.speechRate);
  const sentences = useMemo(
    () =>
      getContentIndex(repos)
        .sentencesByLength.filter((s) => wordCount(s.it) <= SPOKEN_PROMPT_MAX_WORDS)
        .slice(0, SHADOWING_SENTENCES),
    [repos],
  );
  const [index, setIndex] = useState(0);
  const [step, setStep] = useState<Step>('idle');
  const [model, setModel] = useState<AudioClip | null>(null);
  const [heardModel, setHeardModel] = useState(false);
  const [recording, setRecording] = useState<Recording | null>(null);
  const [analysis, setAnalysis] = useState<PronunciationAnalysis | null>(null);
  const [scorerReady, setScorerReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sentence = sentences[index];
  // Bumped on "Next": playback, recording and scoring that finish after it are stale.
  const turn = useRef(0);
  const practice = usePracticeSession('shadowing');

  useEffect(() => {
    void services.scorer.availability().then((a) => {
      setScorerReady(a === 'ready');
    });
    return () => {
      services.recorder.cancel();
      services.audio.stop();
    };
  }, [services]);

  if (!sentence) {
    return (
      <Screen edges={['bottom', 'left', 'right']}>
        <EmptyState title="No sentences yet" message="Sentences appear once content is loaded." />
      </Screen>
    );
  }

  const listen = async () => {
    practice.touch();
    const mine = turn.current;
    setStep('playing');
    setError(null);
    const clip = await sayItalian(services, sentence.it, rate).catch(() => null);
    if (mine !== turn.current) return;
    setModel(clip);
    setHeardModel(true);
    setStep(recording ? 'done' : 'idle');
  };

  const record = async () => {
    practice.touch();
    setError(null);
    setAnalysis(null);
    try {
      await services.recorder.start();
      setStep('recording');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'The microphone could not start.');
    }
  };

  const stop = async () => {
    const mine = turn.current;
    try {
      const r = await services.recorder.stop();
      if (mine !== turn.current) return;
      setRecording(r);
      setStep(scorerReady ? 'scoring' : 'done');
      if (scorerReady) {
        const result = await services.scorer
          .analyse({ audio: recordingClip(r), expectedText: sentence.it })
          .catch(() => null);
        if (mine !== turn.current) return;
        setAnalysis(result);
        setStep('done');
      }
    } catch (e) {
      if (mine !== turn.current) return;
      setError(e instanceof Error ? e.message : 'Recording failed.');
      setStep('idle');
    }
  };

  const next = () => {
    turn.current += 1;
    services.audio.stop();
    services.recorder.cancel();
    setIndex((i) => (i + 1) % sentences.length);
    setStep('idle');
    setModel(null);
    setHeardModel(false);
    setRecording(null);
    setAnalysis(null);
    setError(null);
  };

  return (
    <Screen edges={['bottom', 'left', 'right']} testID="shadowing-screen">
      <Card>
        <Text variant="caption" color="textMuted">
          {`Sentence ${String(index + 1)} of ${String(sentences.length)}`}
        </Text>
        <Text variant="title">{sentence.it}</Text>
        <Text color="textMuted">{sentence.en}</Text>
      </Card>
      <Button
        label={heardModel ? 'Listen again' : 'Listen'}
        variant={heardModel ? 'secondary' : 'primary'}
        disabled={step === 'recording' || step === 'playing'}
        onPress={() => {
          void listen();
        }}
      />
      <MicGate>
        <View style={{ gap: spacing.md }}>
          {step === 'recording' ? (
            <Button
              label="Stop"
              accessibilityHint="Stops recording"
              onPress={() => {
                void stop();
              }}
            />
          ) : (
            <Button
              label={recording ? 'Record again' : 'Record yourself'}
              disabled={step === 'playing' || step === 'scoring'}
              onPress={() => {
                void record();
              }}
            />
          )}
          {error !== null ? <Text color="danger">{error}</Text> : null}
          {heardModel ? (
            samplesOf(model) ? (
              <Waveform samples={samplesOf(model)} label="Model" />
            ) : (
              <Text variant="caption" color="textMuted">
                The model waveform needs the downloaded Italian voice (Settings, On-device models).
              </Text>
            )
          ) : null}
          {recording ? (
            <>
              <Waveform samples={recording.samples} label="You" color="warning" />
              <Button
                label="Play mine"
                variant="secondary"
                onPress={() => {
                  void services.audio.play(recordingClip(recording)).catch(() => undefined);
                }}
              />
              <PronunciationResult analysis={analysis} scorerReady={scorerReady} />
            </>
          ) : null}
        </View>
      </MicGate>
      <Button label="Next sentence" variant="secondary" onPress={next} />
    </Screen>
  );
}
