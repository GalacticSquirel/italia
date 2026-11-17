import { render, screen } from '@testing-library/react-native';

import { ThemeProvider } from '@/ui';

import { PreparingView } from './DatabaseProvider';

describe('PreparingView', () => {
  it('shows a spinner before the seed import reports progress', async () => {
    await render(
      <ThemeProvider scheme="light">
        <PreparingView progress={null} />
      </ThemeProvider>,
    );
    expect(screen.getByLabelText('Preparing your data')).toBeOnTheScreen();
    expect(screen.queryByRole('progressbar')).toBeNull();
  });

  it('shows import progress on first launch', async () => {
    await render(
      <ThemeProvider scheme="dark">
        <PreparingView progress={{ done: 4300, total: 17341, table: 'sentence' }} />
      </ThemeProvider>,
    );
    expect(screen.getByRole('header', { name: 'Setting up Italia' })).toBeOnTheScreen();
    expect(
      screen.getByRole('progressbar', { name: 'Setting up content' }),
    ).toHaveAccessibilityValue({ now: 25 });
    expect(screen.getByText('25%')).toBeOnTheScreen();
  });
});
