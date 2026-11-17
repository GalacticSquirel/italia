import { render, screen, userEvent } from '@testing-library/react-native';

import { ThemeProvider } from '@/ui';

import type { Library, LibraryEpisode, LibrarySeries } from './library';
import { ReadScreen } from './ReadScreen';
import { useLibrary } from './useLibrary';

jest.mock('./useLibrary', () => ({ useLibrary: jest.fn() }));

function series(id: string, title: string, level: LibrarySeries['level']): LibrarySeries {
  const episode = {
    id: `${id}-01`,
    seriesIndex: 1,
    locked: false,
    read: false,
    fit: 'hard',
    coverage: { ratio: 0 },
    unmetTargetLemmaIds: [],
    story: { id: `${id}-01`, title: `${title} 1`, level },
  } as unknown as LibraryEpisode;
  return {
    seriesId: id,
    series: { titleIt: title, titleEn: title, blurb: 'blurb' },
    level,
    band: 0,
    episodes: [episode],
    readCount: 0,
    next: episode,
  };
}

function library(upNextLevel: LibrarySeries['level']): Library {
  const all = [series('a', 'Serie A1', 'A1'), series('b', 'Serie B1', 'B1')];
  const closest = all.find((s) => s.level === upNextLevel)?.episodes[0] ?? null;
  return { series: all, upNext: null, closest, knownWords: 0, met: new Set() };
}

const renderRead = () =>
  render(
    <ThemeProvider scheme="light">
      <ReadScreen onOpenStory={jest.fn()} />
    </ThemeProvider>,
  );

describe('ReadScreen library', () => {
  it('opens at the level of the closest story and switches level with the chips', async () => {
    jest.mocked(useLibrary).mockReturnValue(library('B1'));
    const user = userEvent.setup();
    await renderRead();
    expect(screen.getByRole('tab', { name: 'Level B1' })).toBeSelected();
    expect(screen.getByText('Serie B1')).toBeOnTheScreen();
    expect(screen.queryByText('Serie A1')).toBeNull();

    await user.press(screen.getByRole('tab', { name: 'Level A1' }));
    expect(screen.getByText('Serie A1')).toBeOnTheScreen();
    expect(screen.queryByText('Serie B1')).toBeNull();
  });
});
