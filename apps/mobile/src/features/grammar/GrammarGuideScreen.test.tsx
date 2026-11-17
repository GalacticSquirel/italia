import { render, screen, userEvent } from '@testing-library/react-native';
import { router } from 'expo-router';

import { createTestApp, type TestApp } from '@/testing/testApp';

import { GrammarGuideScreen } from './GrammarGuideScreen';
import { GrammarPointScreen } from './GrammarPointScreen';

jest.mock('expo-router', () => {
  const { useEffect } = jest.requireActual<{
    useEffect: (effect: () => void, deps: unknown[]) => void;
  }>('react');
  return {
    router: { push: jest.fn() },
    useFocusEffect: (effect: () => void) => {
      useEffect(effect, [effect]);
    },
  };
});

let app: TestApp;

beforeEach(async () => {
  app = await createTestApp();
});

afterEach(() => {
  app.t.close();
});

describe('grammar guide screens', () => {
  it('lists the points and opens one', async () => {
    await render(app.wrap(<GrammarGuideScreen />));
    expect(screen.getByText(/You have learnt 0 of \d+ grammar points/)).toBeOnTheScreen();
    const point = screen.getByRole('button', { name: /Essere \(to be\) in the present/ });
    await userEvent.setup().press(point);
    expect(router.push).toHaveBeenCalledWith('/grammar/1');
  });

  it('shows a point with its explanation', async () => {
    await render(app.wrap(<GrammarPointScreen pointId={1} />));
    expect(screen.getByRole('header', { name: 'Essere (to be) in the present' })).toBeOnTheScreen();
    expect(screen.getByText(/Up next/)).toBeOnTheScreen();
  });

  it('says when a point is not in the content', async () => {
    await render(app.wrap(<GrammarPointScreen pointId={999} />));
    expect(screen.getByText('Point not found')).toBeOnTheScreen();
  });
});
