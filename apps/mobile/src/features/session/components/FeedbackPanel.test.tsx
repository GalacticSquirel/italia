import { render, screen, userEvent } from '@testing-library/react-native';
import * as Haptics from 'expo-haptics';
import { AccessibilityInfo } from 'react-native';

import { gradeTyped } from '@italia/core';

import type { SentenceRow } from '@/data';
import type { Feedback } from '@/features/session/sessionStore';
import type { TypedPrompt } from '@/features/study/prompts';
import { ThemeProvider } from '@/ui';

import { FeedbackPanel } from './FeedbackPanel';

const sentence: SentenceRow = {
  id: 9,
  it: 'Il caffè è buono.',
  en: 'The coffee is good.',
  lemmaIds: [2, 33, 1, 17],
  grammarIds: [],
  tokens: null,
  source: 'test',
  licence: 'CC0-1.0',
};
const prompt: TypedPrompt = { kind: 'sentence_production', sentence, accepted: [sentence.it] };

function feedbackFor(answer: string): Feedback {
  const { grade, rating } = gradeTyped({
    answer,
    accepted: prompt.accepted,
    kind: 'sentence_production',
    latencyMs: 20_000,
  });
  return {
    grade,
    rating,
    gradedRating: rating,
    answer,
    latencyMs: 20_000,
    answeredAt: new Date(0),
    overridden: false,
  };
}

async function renderPanel(
  feedback: Feedback,
  handlers = { onContinue: jest.fn(), onOverride: jest.fn() },
) {
  await render(
    <ThemeProvider scheme="light">
      <FeedbackPanel
        prompt={prompt}
        feedback={feedback}
        speechRate={1}
        autoPlay={false}
        {...handlers}
      />
    </ThemeProvider>,
  );
  return handlers;
}

describe('FeedbackPanel', () => {
  it('announces a wrong answer, shows the diff and the correct answer, and offers an override', async () => {
    const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility');
    const user = userEvent.setup();
    const handlers = await renderPanel(feedbackFor('Il te è buono.'));
    expect(screen.getByText('Not quite.')).toBeOnTheScreen();
    expect(screen.getByText('Your answer')).toBeOnTheScreen();
    expect(screen.getByLabelText('Correct answer: Il caffè è buono.')).toBeOnTheScreen();
    expect(screen.getByText('Counted as Again')).toBeOnTheScreen();
    expect(announce).toHaveBeenCalledWith('Not quite. The correct answer is Il caffè è buono.');
    expect(Haptics.notificationAsync).toHaveBeenLastCalledWith('error');
    await user.press(screen.getByRole('button', { name: 'I was right' }));
    expect(handlers.onOverride).toHaveBeenCalled();
    await user.press(screen.getByRole('button', { name: 'Continue' }));
    expect(handlers.onContinue).toHaveBeenCalled();
  });

  it('flags accent slips as correct but hard, without an override', async () => {
    await renderPanel(feedbackFor('Il caffe e buono.'));
    expect(screen.getByText('Correct, but check the accents.')).toBeOnTheScreen();
    expect(screen.getByText('Counted as Hard')).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'I was right' })).toBeNull();
    expect(Haptics.notificationAsync).toHaveBeenLastCalledWith('success');
  });

  it('shows an override as counted correct', async () => {
    const base = feedbackFor('sbagliato');
    await renderPanel({ ...base, rating: 'good', overridden: true });
    expect(screen.getByText('Counted as correct.')).toBeOnTheScreen();
    expect(screen.getByText('Counted as Good')).toBeOnTheScreen();
  });
});
