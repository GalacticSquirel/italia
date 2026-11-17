import { render, screen } from '@testing-library/react-native';

import { Text } from './Text';
import { ThemeProvider, useTheme } from './ThemeProvider';
import { palettes } from './tokens';

const mockColorScheme = jest.fn<'light' | 'dark' | null, []>(() => 'light');

jest.mock('react-native/Libraries/Utilities/useColorScheme', () => ({
  __esModule: true,
  default: () => mockColorScheme(),
}));

function SchemeLabel() {
  const { scheme } = useTheme();
  return <Text>{scheme}</Text>;
}

describe('ThemeProvider', () => {
  afterEach(() => {
    mockColorScheme.mockReset();
  });

  it('follows the OS light appearance', async () => {
    mockColorScheme.mockReturnValue('light');
    await render(
      <ThemeProvider>
        <SchemeLabel />
      </ThemeProvider>,
    );
    expect(screen.getByText('light')).toHaveStyle({ color: palettes.light.text });
  });

  it('switches to the dark theme when the OS is in dark mode', async () => {
    mockColorScheme.mockReturnValue('dark');
    await render(
      <ThemeProvider>
        <SchemeLabel />
      </ThemeProvider>,
    );
    expect(screen.getByText('dark')).toHaveStyle({ color: palettes.dark.text });
  });

  it('falls back to light when the OS reports no preference', async () => {
    mockColorScheme.mockReturnValue(null);
    await render(
      <ThemeProvider>
        <SchemeLabel />
      </ThemeProvider>,
    );
    expect(screen.getByText('light')).toBeOnTheScreen();
  });

  it('lets an explicit scheme override the OS', async () => {
    mockColorScheme.mockReturnValue('light');
    await render(
      <ThemeProvider scheme="dark">
        <SchemeLabel />
      </ThemeProvider>,
    );
    expect(screen.getByText('dark')).toBeOnTheScreen();
  });
});
