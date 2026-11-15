import { render, screen, userEvent } from '@testing-library/react-native';

import { Button } from './Button';
import { ThemeProvider } from './ThemeProvider';
import { minTouchTarget, palettes } from './tokens';

describe('Button', () => {
  it('renders its label as an accessible button and fires onPress', async () => {
    const onPress = jest.fn();
    const user = userEvent.setup();
    await render(
      <ThemeProvider scheme="light">
        <Button label="Start session" onPress={onPress} />
      </ThemeProvider>,
    );

    const button = screen.getByRole('button', { name: 'Start session' });
    expect(screen.getByText('Start session')).toBeOnTheScreen();
    expect(button).toHaveStyle({ minHeight: minTouchTarget, minWidth: minTouchTarget });

    await user.press(button);
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('does not fire onPress when disabled', async () => {
    const onPress = jest.fn();
    const user = userEvent.setup();
    await render(
      <ThemeProvider scheme="light">
        <Button label="Continue" onPress={onPress} disabled />
      </ThemeProvider>,
    );

    const button = screen.getByRole('button', { name: 'Continue' });
    expect(button).toBeDisabled();
    await user.press(button);
    expect(onPress).not.toHaveBeenCalled();
  });

  it('uses the dark palette when the theme is dark', async () => {
    await render(
      <ThemeProvider scheme="dark">
        <Button label="Go" />
      </ThemeProvider>,
    );
    expect(screen.getByRole('button', { name: 'Go' })).toHaveStyle({
      backgroundColor: palettes.dark.primary,
    });
    expect(screen.getByText('Go')).toHaveStyle({ color: palettes.dark.onPrimary });
  });
});
