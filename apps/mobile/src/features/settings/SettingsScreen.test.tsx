import { fireEvent, render, screen, userEvent } from '@testing-library/react-native';

import { createTestApp, type TestApp } from '@/testing/testApp';

import { SettingsScreen } from './SettingsScreen';
import { useSettingsStore } from './settingsStore';

jest.mock('expo-sharing', () => ({
  isAvailableAsync: jest.fn(() => Promise.resolve(true)),
  shareAsync: jest.fn(() => Promise.resolve()),
}));
jest.mock('expo-document-picker', () => ({ getDocumentAsync: jest.fn() }));
jest.mock('expo-file-system', () => ({ File: jest.fn(), Paths: { cache: 'cache' } }));

let app: TestApp;

beforeEach(async () => {
  app = await createTestApp();
});

afterEach(() => {
  app.t.close();
});

describe('SettingsScreen', () => {
  it('persists daily limits, retention, speech rate and theme', async () => {
    const user = userEvent.setup();
    await render(app.wrap(<SettingsScreen />));

    await user.press(
      screen.getByTestId('New words per day-increase', { includeHiddenElements: true }),
    );
    expect(app.repos.settings.get('dailyNewLimit')).toBe(25);

    const budget = screen.getByRole('adjustable', { name: 'Daily time budget' });
    expect(budget).toHaveAccessibilityValue({ text: '60 min' });
    await fireEvent(budget, 'accessibilityAction', { nativeEvent: { actionName: 'decrement' } });
    expect(app.repos.settings.get('minutesBudget')).toBe(55);

    // Retention is offered between 80% and 95%.
    for (let i = 0; i < 10; i++)
      await user.press(
        screen.getByTestId('Target recall-increase', { includeHiddenElements: true }),
      );
    expect(app.repos.settings.get('desiredRetention')).toBe(0.95);
    expect(screen.getByRole('adjustable', { name: 'Target recall' })).toHaveAccessibilityValue({
      text: '95%',
    });

    await user.press(screen.getByTestId('Speech speed-decrease', { includeHiddenElements: true }));
    expect(app.repos.settings.get('speechRate')).toBe(0.9);

    await user.press(screen.getByRole('radio', { name: 'Dark' }));
    expect(app.repos.settings.get('theme')).toBe('dark');
    expect(useSettingsStore.getState().settings.theme).toBe('dark');
    expect(screen.getByRole('radio', { name: 'Dark' })).toBeChecked();
  });

  it('exports a backup through the share sheet', async () => {
    const write = jest.fn(() => Promise.resolve());
    const { File } = jest.requireMock<{ File: jest.Mock }>('expo-file-system');
    File.mockImplementation(() => ({
      exists: false,
      create: jest.fn(),
      write,
      uri: 'file:///cache/backup.json',
    }));
    const { shareAsync } = jest.requireMock<{ shareAsync: jest.Mock }>('expo-sharing');
    const user = userEvent.setup();
    await render(app.wrap(<SettingsScreen />));
    await user.press(screen.getByRole('button', { name: 'Export backup' }));
    expect(write).toHaveBeenCalledWith(expect.stringContaining('"format":"italia-backup"'));
    expect(shareAsync).toHaveBeenCalledWith(
      'file:///cache/backup.json',
      expect.objectContaining({ mimeType: 'application/json' }),
    );
  });
});
