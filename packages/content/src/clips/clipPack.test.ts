import { describe, expect, it } from 'vitest';

import {
  buildClipPack,
  parseCommonVoiceTsv,
  selectClips,
  sentenceWords,
  type CommonVoiceRow,
} from './clipPack';

const HEADER = 'client_id\tpath\tsentence_id\tsentence\tup_votes\tdown_votes\tage\tgender';

const row = (
  clientId: string,
  path: string,
  sentence: string,
  up = 2,
  down = 0,
  gender = '',
): CommonVoiceRow => ({ clientId, path, sentence, upVotes: up, downVotes: down, gender });

const DATASET = {
  name: 'Common Voice Italian',
  release: 'cv-corpus-test',
  licence: 'CC0-1.0' as const,
  url: 'https://datacollective.mozillafoundation.org/',
};

describe('clip packs', () => {
  it('parses validated.tsv by column name', () => {
    const tsv = [
      HEADER,
      'abc\tcv_1.mp3\t9\tIl cane dorme.\t3\t0\tthirties\tfemale_feminine',
      'broken line',
      '',
    ].join('\n');
    expect(parseCommonVoiceTsv(tsv)).toEqual([
      row('abc', 'cv_1.mp3', 'Il cane dorme.', 3, 0, 'female_feminine'),
    ]);
    expect(() => parseCommonVoiceTsv('a\tb\n1\t2')).toThrow(/client_id/);
  });

  it('splits sentences into lower-case words, elisions apart', () => {
    expect(sentenceWords("L'anno è Bello, vero?")).toEqual(['l', 'anno', 'è', 'bello', 'vero']);
  });

  it('picks validated clips from different speakers, alternating genders, short first', () => {
    const rows = [
      row('s1', 'a.mp3', 'Il cane dorme sul divano di casa.', 5, 0, 'male_masculine'),
      row('s1', 'b.mp3', 'Il cane.', 5, 0, 'male_masculine'), // same speaker, shorter
      row('s2', 'c.mp3', 'Un cane abbaia.', 2, 0, 'male_masculine'),
      row('s3', 'd.mp3', 'Il mio cane.', 2, 0, 'female_feminine'),
      row('s4', 'e.mp3', 'Cane.', 1, 0, 'female_feminine'), // too few votes
      row('s5', 'f.mp3', 'Il cane.', 3, 1, 'female_feminine'), // down-voted
      row('s6', 'g.mp3', 'Le canne al vento.', 2, 0),
    ];
    const picked = selectClips(
      rows,
      [
        { accented: 'cane', word: 'cane' },
        { accented: 'canne', word: 'canne' },
      ],
      { perWord: 3 },
    );
    expect(picked.map((p) => [p.accented, p.row.path, p.wordIndex])).toEqual([
      ['cane', 'd.mp3', 2],
      ['cane', 'b.mp3', 1],
      ['cane', 'c.mp3', 1],
      ['canne', 'g.mp3', 1],
    ]);
  });

  it('skips targets that share a spelling (stress pairs need alignment to tell apart)', () => {
    const rows = [row('s1', 'a.mp3', 'Ancora una volta.')];
    const picked = selectClips(rows, [
      { accented: 'àncora', word: 'ancora' },
      { accented: 'ancóra', word: 'ancora' },
    ]);
    expect(picked).toEqual([]);
  });

  it('builds a validated manifest from the clips that have word timings', () => {
    const selections = selectClips(
      [row('s1', 'a.mp3', 'Il cane.'), row('s2', 'b.mp3', 'Un cane.')],
      [{ accented: 'cane', word: 'cane' }],
    );
    const { pack, missingTimings } = buildClipPack(
      DATASET,
      selections,
      (s) => (s.row.path === 'a.mp3' ? { startMs: 300, endMs: 720 } : null),
      (s) => ({ file: `clips/${s.row.path}`, sha256: 'a'.repeat(64), sizeBytes: 1000 }),
      (id) => `speaker-${id}`,
    );
    expect(pack.clips).toEqual([
      {
        accented: 'cane',
        file: 'clips/a.mp3',
        sha256: 'a'.repeat(64),
        sizeBytes: 1000,
        startMs: 300,
        endMs: 720,
        speaker: 'speaker-s1',
        source: 'a.mp3',
      },
    ]);
    expect(missingTimings.map((s) => s.row.path)).toEqual(['b.mp3']);
  });
});
