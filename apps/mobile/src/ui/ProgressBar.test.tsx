import { render, screen } from '@testing-library/react-native';

import { ProgressBar } from './ProgressBar';
import { ThemeProvider } from './ThemeProvider';

async function renderBar(value: number) {
  await render(
    <ThemeProvider scheme="light">
      <ProgressBar value={value} label="Today's reviews" />
    </ThemeProvider>,
  );
  return screen.getByRole('progressbar', { name: "Today's reviews" });
}

describe('ProgressBar', () => {
  it('exposes its value as a percentage', async () => {
    const bar = await renderBar(0.42);
    expect(bar).toHaveAccessibilityValue({ min: 0, max: 100, now: 42, text: '42%' });
  });

  it.each([
    [-1, 0],
    [2, 100],
    [Number.NaN, 0],
  ])('clamps %p to %p%%', async (value, expected) => {
    const bar = await renderBar(value);
    expect(bar).toHaveAccessibilityValue({ now: expected });
  });
});
