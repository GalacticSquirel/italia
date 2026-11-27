import { render, screen, userEvent } from '@testing-library/react-native';
import { router } from 'expo-router';

import { createTestApp, type TestApp } from '@/testing/testApp';

import { PracticeScreen } from './PracticeScreen';

jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));

let app: TestApp;

beforeEach(async () => {
  app = await createTestApp();
});

afterEach(() => {
  app.t.close();
});

describe('PracticeScreen', () => {
  it('links to every kind of practice and reference', async () => {
    const user = userEvent.setup();
    await render(app.wrap(<PracticeScreen />));
    expect(screen.getByText(/Using your phone's own speech recognition/)).toBeOnTheScreen();
    expect(
      screen.getByText(/Role-play with an on-device tutor \(\d+(\.\d)? GB download\)/),
    ).toBeOnTheScreen();

    const links: [string, unknown][] = [
      ['Story library', '/read'],
      ['Conversation', '/speak/converse'],
      ['Hands-free drill', { pathname: '/speak/drill', params: { handsFree: '1' } }],
      ['Speaking drill', '/speak/drill'],
      ['Ear training', '/speak/ear'],
      ['Shadowing', '/speak/shadow'],
      ['My words', '/words'],
      ['Grammar guide', '/grammar'],
      ['On-device models', '/models'],
    ];
    for (const [title, href] of links) {
      await user.press(screen.getByText(title));
      expect(router.push).toHaveBeenLastCalledWith(href);
    }
  });
});
