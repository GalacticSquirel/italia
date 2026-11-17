/**
 * Rule-based Italian grapheme-to-phoneme conversion (standard, neutral
 * pronunciation) with stress, syllabification and source spans.
 *
 * ## Rules, in the order they apply
 *
 * 1. **Tokenising.** Words are runs of letters; an internal apostrophe joins an
 *    elided form to its host (*l'acqua*, *dell'anno*, *c'è* are one phonological
 *    word). Spans are UTF-16 offsets into {@link G2PResult.text}, the NFC form of
 *    the input.
 * 2. **Lexicon** ({@link LEXICON}) supplies stress, mid-vowel quality and `z`
 *    voicing for the host word when the text has no written stress accent. An
 *    unknown inflected form falls back to a listed form that differs only in its
 *    final vowel (or `-che/-chi/-ghe/-ghi` for `-ca/-co/-ga/-go`), keeping the
 *    stress position.
 * 3. **Vowel letters.** A written accent always makes a syllable nucleus.
 *    Otherwise `u` after `q` is /w/; `i` between `c`, `g`, `gl` or `gn` and a vowel
 *    is silent (*ciao*, *giorno*, *figlio*, *sogniamo*); an unstressed `i`/`u`
 *    before a vowel is the glide /j/, /w/ (*piano*, *uomo*); an unstressed `i`/`u`
 *    after a nucleus and before a consonant or the end is a non-syllabic off-glide
 *    (*mai*, *zaino*, *euro*). Everything else is a nucleus.
 * 4. **Stress.** Written accent (last one wins), then lexicon, then suffix rules
 *    (stressed *-ìa* in *-logia, -grafia, -sofia, -nomia, -patia, -crazia, -metria,
 *    -fonia, -fobia*; antepenultimate in *-issimo, -bile, -evole, -ologo, -esimo*),
 *    then final stress when the word ends in a falling diphthong (*vorrei*, *parlai*),
 *    then the default: penultimate nucleus. Unstressed function words (articles,
 *    clitics, simple and articulated prepositions, *e, o, ma, se, che, non*) get
 *    no stress.
 * 5. **Consonants.** `c`/`g` are /tʃ dʒ/ before `e`/`i` and /k ɡ/ elsewhere;
 *    `ch`/`gh` are /k ɡ/; `gli` is /ʎ/ (except listed *glicine*-type words); `gn`
 *    is /ɲ/; `sc` before `e`/`i` is /ʃ/, `sch` is /sk/; `qu` is /kw/ and `cq` /kː/;
 *    `h` is silent; `x` is /ks/. Doubled letters give one long consonant.
 * 6. **`z`.** Lexicon first; then `z` + `i` + vowel → /ts/ (*azione*, *grazie*);
 *    `-izzare/-izzato/-izzazione` → /dz/; word-final `-nza/-nze/-nzi` after `a`/`e` →
 *    /ts/ (*stanza*, *senza*, *Firenze*). Remaining cases are guesses flagged
 *    `zVoicingUncertain` with the other value as an accepted alternative: after
 *    `l`/`r` /ts/, word-initially /dz/, elsewhere /ts/.
 * 7. **`s`.** Before a voiced consonant /z/ (*sbaglio*, *smettere*), before a
 *    voiceless one /s/; word-initially and after a consonant /s/. A single `s`
 *    between vowels is /z/ in northern and much neutral speech and lexically
 *    /s/ or /z/ in Tuscan and /s/ in the centre-south, so it is given as /z/ with
 *    /s/ accepted and flagged `sVoicingVariable`. `ss` is always /sː/.
 * 8. **Nasals.** /n/ before /k ɡ/ is [ŋ] (/n/ accepted).
 * 9. **Intrinsic geminates.** /ʎ ɲ ʃ ts dz/ are long between vowels within the
 *    word (*figlio* /ˈfiʎʎo/, *pesce* /ˈpeʃʃe/, *azione* /atˈtsjone/), flagged
 *    `intrinsicLong`.
 * 10. **Mid vowels.** Unstressed `e`/`o` are close /e o/ (standard
 *     neutralisation). Stressed: written or lexicon accent (`è ò` open, `é ó`
 *     close); otherwise /ɔ/ in the diphthong `uo` (*buono*), /ɛ/ after the glide in
 *     `ie` (*piede*); close in the suffixes *-ione, -ore, -oso* (3+ syllables),
 *     *-mente, -mento, -ezza* (3+ syllables), *-ese*, *-esi* (3+ syllables).
 *     Anything else is the archiphoneme `E`/`O`, flagged `midVowelUnknown`, with
 *     both qualities accepted.
 * 11. **Syllables.** One nucleus per syllable; off-glides close the syllable;
 *     a medial cluster splits before the longest legal onset (one consonant,
 *     obstruent + `r`/`l` except *tl* and *dl*, `s` + consonant, `s` + obstruent +
 *     liquid, each optionally followed by a glide); a long consonant splits across
 *     the boundary (*fat.to*).
 * 12. **Syntactic doubling.** The first consonant of a word after a trigger (*a, e,
 *     o, è, da, tra, fra, su, ma, che, chi, né, tre, ho, ha, va, fa, può, più, già,
 *     qui, qua, come, dove, qualche, sopra*, any word ending in a written stressed
 *     vowel, ...) is flagged `syntacticDoublingCandidate`. It is not lengthened:
 *     raddoppiamento sintattico is standard in Tuscan and central-southern speech
 *     but absent in the north, and it does not apply across a pause or before
 *     `s` + consonant.
 *
 * @packageDocumentation
 */

import { INTRINSIC_GEMINATES, isConsonant, isGlide, isVowel, type Phoneme } from './inventory';
import { lookupLexicon, type LexiconEntry, type ZValue } from './lexicon';

/** A half-open range `[start, end)` of UTF-16 offsets into {@link G2PResult.text}. */
export interface TextSpan {
  readonly start: number;
  readonly end: number;
}

/** What a phone does in its syllable. */
export type PhoneRole = 'nucleus' | 'offGlide' | 'onsetGlide' | 'consonant';

/** Notes the G2P attaches to a phone. */
export type PhoneFlag =
  /** Intervocalic single `s`: /z/ or /s/ depending on region. */
  | 'sVoicingVariable'
  /** `z` voicing guessed by a default rule, not known from the lexicon or a reliable rule. */
  | 'zVoicingUncertain'
  /** Stressed mid vowel whose open/close quality is not known (`E`/`O`). */
  | 'midVowelUnknown'
  /** Long because /ʎ ɲ ʃ ts dz/ are always long between vowels, not because of spelling. */
  | 'intrinsicLong'
  /** Word-initial consonant after a syntactic-doubling trigger; may be lengthened. */
  | 'syntacticDoublingCandidate';

/** Where a stressed mid vowel's quality came from. */
export type MidVowelSource = 'accent' | 'lexicon' | 'rule' | 'unstressed' | 'unknown';

/** One phoneme of the expected pronunciation. */
export interface PhoneToken {
  /** The phoneme (see {@link PHONEMES}). */
  readonly phoneme: Phoneme;
  /** True for a long (geminate) consonant. */
  readonly isLong: boolean;
  /** Function of the phone in its syllable. */
  readonly role: PhoneRole;
  /** True for the nucleus of the stressed syllable. */
  readonly stressed: boolean;
  /** Index of the (first) syllable containing the phone; a long consonant also opens the next one. */
  readonly syllable: number;
  /** Source letters, including silent letters attached to this phone (*h* in *che*, *i* in *ciao*). */
  readonly span: TextSpan;
  /** Other phonemes that are acceptable realisations here (regional or allophonic variants). */
  readonly alternatives: readonly Phoneme[];
  /** Notes about this phone. */
  readonly flags: readonly PhoneFlag[];
  /** For `e`/`o`-type vowels: where the quality came from. */
  readonly midVowelSource?: MidVowelSource;
}

/** One syllable of a word. */
export interface Syllable {
  /** Indices into {@link WordG2P.phonemes}; a long consonant appears in two adjacent syllables. */
  readonly phonemes: readonly number[];
  /** True for the stressed syllable. */
  readonly stressed: boolean;
  /** Source span covered by the syllable's phones. */
  readonly span: TextSpan;
  /** IPA of the syllable (a long consonant shows its closing half in the coda). */
  readonly ipa: string;
}

/** Where a word's stress position came from. */
export type StressSource =
  'accent' | 'lexicon' | 'rule' | 'default' | 'monosyllable' | 'unstressed';

/** The G2P analysis of one (phonological) word. */
export interface WordG2P {
  /** The word as written (including elided forms joined by an apostrophe). */
  readonly text: string;
  /** Span of the word in {@link G2PResult.text}. */
  readonly span: TextSpan;
  /** Phones in order. */
  readonly phonemes: readonly PhoneToken[];
  /** Syllables in order. */
  readonly syllables: readonly Syllable[];
  /** Index of the stressed syllable, or `null` for unstressed function words. */
  readonly stressedSyllable: number | null;
  /** Where the stress position came from. */
  readonly stressSource: StressSource;
  /** Other readings of an ambiguous spelling (annotated, e.g. `àncora` for *ancora*). */
  readonly stressAlternatives: readonly string[];
  /** IPA with syllable dots and a stress mark, e.g. `ˈfat.to`. */
  readonly ipa: string;
}

/** Result of {@link g2p}. */
export interface G2PResult {
  /** The NFC-normalised input; all spans index into this string. */
  readonly text: string;
  /** Words in order. */
  readonly words: readonly WordG2P[];
}

/** An expected phone with its position, as consumed by the aligner. */
export interface ExpectedPhone {
  readonly phoneme: Phoneme;
  readonly isLong: boolean;
  readonly alternatives: readonly Phoneme[];
  readonly wordIndex: number;
  readonly phoneIndex: number;
}

// ---------------------------------------------------------------------------
// Letters

type Mark = 'grave' | 'acute' | 'circ' | 'diaeresis';
type MarkSource = 'text' | 'lexicon' | 'rule';

interface Letter {
  ch: string;
  mark: Mark | null;
  markSource: MarkSource | null;
  start: number;
  end: number;
}

const COMBINING: Readonly<Record<string, Mark>> = {
  '̀': 'grave',
  '́': 'acute',
  '̂': 'circ',
  '̈': 'diaeresis',
};

const VOWEL_LETTERS = new Set(['a', 'e', 'i', 'o', 'u']);
const FRONT = new Set(['e', 'i']);
const isVowelLetter = (ch: string | undefined): boolean =>
  ch !== undefined && VOWEL_LETTERS.has(ch);
const isStressMark = (m: Mark | null): boolean => m === 'grave' || m === 'acute' || m === 'circ';

function lettersOf(text: string, start: number, end: number): Letter[] {
  const letters: Letter[] = [];
  for (let i = start; i < end; i++) {
    const char = text.charAt(i);
    const mark = COMBINING[char];
    if (mark !== undefined) {
      const last = letters.at(-1);
      if (last) {
        last.mark = mark;
        last.markSource = 'text';
        last.end = i + 1;
      }
      continue;
    }
    if (char === "'" || char === '’') continue;
    const decomposed = char.normalize('NFD');
    let base = decomposed.charAt(0).toLowerCase();
    if (base === 'y') base = 'i';
    if (!/^[a-z]$/u.test(base)) continue;
    const m = COMBINING[decomposed.charAt(1)] ?? null;
    letters.push({ ch: base, mark: m, markSource: m ? 'text' : null, start: i, end: i + 1 });
  }
  return letters;
}

function annotationMarks(accented: string): (Mark | null)[] {
  const marks: (Mark | null)[] = [];
  for (const char of accented.normalize('NFD')) {
    const mark = COMBINING[char];
    if (mark !== undefined) marks[marks.length - 1] = mark;
    else marks.push(null);
  }
  return marks;
}

// ---------------------------------------------------------------------------
// Lexicon lookup with inflection fallback

interface LexiconHit {
  entry: LexiconEntry;
  /** False when found through the inflection fallback. */
  exact: boolean;
}

function findLexicon(plain: string): LexiconHit | undefined {
  const exact = lookupLexicon(plain);
  if (exact) return { entry: exact, exact: true };
  if (plain.length < 3) return undefined;
  const candidates: string[] = [];
  const two = plain.slice(-3);
  const swaps: Readonly<Record<string, readonly string[]>> = {
    che: ['ca', 'co'],
    chi: ['co', 'ca'],
    ghe: ['ga', 'go'],
    ghi: ['go', 'ga'],
  };
  const swap = swaps[two];
  if (swap) for (const s of swap) candidates.push(plain.slice(0, -3) + s);
  const last = plain.slice(-1);
  if (isVowelLetter(last)) {
    for (const vw of ['o', 'a', 'e', 'i'])
      if (vw !== last) candidates.push(plain.slice(0, -1) + vw);
  }
  for (const candidate of candidates) {
    const entry = lookupLexicon(candidate);
    if (!entry || entry.homographs) continue;
    const marks = annotationMarks(entry.accented);
    const stressAt = marks.findIndex(isStressMark);
    // Only reuse the stress if it falls on the shared stem, not on the changed ending.
    const stem = Math.min(candidate.length, plain.length) - (swap && candidate !== plain ? 2 : 1);
    if (stressAt >= 0 && stressAt < stem) return { entry, exact: false };
  }
  return undefined;
}

// ---------------------------------------------------------------------------
// Word-level analysis

const UNSTRESSED_FUNCTION_WORDS = new Set([
  'il',
  'lo',
  'la',
  'i',
  'gli',
  'le',
  'un',
  'mi',
  'ti',
  'si',
  'ci',
  'vi',
  'ne',
  'di',
  'a',
  'da',
  'in',
  'con',
  'su',
  'per',
  'tra',
  'fra',
  'e',
  'ed',
  'o',
  'od',
  'ad',
  'ma',
  'se',
  'che',
  'non',
  'del',
  'al',
  'dal',
  'nel',
  'col',
  'sul',
  'allo',
  'alla',
  'alle',
  'agli',
  'ai',
  'dello',
  'della',
  'delle',
  'degli',
  'dei',
  'nello',
  'nella',
  'nelle',
  'negli',
  'nei',
  'dallo',
  'dalla',
  'dalle',
  'dagli',
  'dai',
  'sullo',
  'sulla',
  'sulle',
  'sugli',
  'sui',
  'coi',
]);

const SYNTACTIC_DOUBLING_TRIGGERS = new Set([
  'a',
  'e',
  'o',
  'è',
  'da',
  'fra',
  'tra',
  'su',
  'ma',
  'se',
  'che',
  'chi',
  'né',
  'tre',
  'ho',
  'ha',
  'so',
  'sa',
  'sto',
  'sta',
  'va',
  'fa',
  'fu',
  'può',
  'più',
  'già',
  'giù',
  'qui',
  'qua',
  'là',
  'lì',
  'sì',
  'blu',
  'come',
  'dove',
  'qualche',
  'sopra',
]);

type VRole = 'nucleus' | 'glide' | 'offGlide' | 'silent';

function vowelRoles(L: readonly Letter[], hardGl: boolean): (VRole | null)[] {
  const roles: (VRole | null)[] = [];
  for (let k = 0; k < L.length; k++) {
    const letter = L[k];
    if (!letter || !isVowelLetter(letter.ch)) {
      roles.push(null);
      continue;
    }
    const ch = letter.ch;
    const prev = L[k - 1]?.ch;
    const prev2 = L[k - 2]?.ch;
    const next = L[k + 1]?.ch;
    const isIU = ch === 'i' || ch === 'u';
    let role: VRole;
    if (letter.mark !== null) role = 'nucleus';
    else if (ch === 'u' && prev === 'q') role = 'glide';
    else if (
      ch === 'i' &&
      isVowelLetter(next) &&
      (prev === 'c' ||
        prev === 'g' ||
        (prev === 'l' && prev2 === 'g' && !hardGl) ||
        (prev === 'n' && prev2 === 'g'))
    )
      role = 'silent';
    else if (isIU && isVowelLetter(next)) role = 'glide';
    else if (isIU && isVowelLetter(prev) && prev !== ch && roles[k - 1] === 'nucleus')
      role = 'offGlide';
    else role = 'nucleus';
    roles.push(role);
  }
  return roles;
}

const PLAIN_CONSONANTS = new Set(['b', 'd', 'f', 'l', 'm', 'n', 'p', 'r', 't', 'v']);

/** Suffixes that put the stress on the `i` of a final `-ia`/`-ie`. */
const STRESSED_IA = /(?:log|graf|sof|nom|pat|craz|metr|fon|fob)i[ae]$/u;

interface Tok {
  ph: Phoneme;
  long: boolean;
  role: PhoneRole;
  start: number;
  end: number;
  letter: number;
  flags: Set<PhoneFlag>;
  alts: Phoneme[];
  /** Index of the z/zz group, for lexicon z values. */
  zGroup?: number;
  /** For s tokens: whether voicing rules apply. */
  sVoiceable?: boolean;
  midSource?: MidVowelSource;
}

interface WordAnalysis {
  phonemes: PhoneToken[];
  syllables: Syllable[];
  stressedSyllable: number | null;
  stressSource: StressSource;
  stressAlternatives: string[];
  ipa: string;
}

function analyseWord(text: string, start: number, end: number): WordAnalysis {
  const raw = text.slice(start, end);
  const L = lettersOf(text, start, end);
  // Host = letters after the last internal apostrophe followed by a letter.
  let hostStart = 0;
  const apostrophe = /['’](?=\p{L})/gu;
  let lastApos = -1;
  for (const m of raw.matchAll(apostrophe)) lastApos = start + m.index;
  if (lastApos >= 0) {
    hostStart = L.findIndex((l) => l.start > lastApos);
    if (hostStart < 0) hostStart = L.length;
  }
  const host = L.slice(hostStart);
  const hostPlain = host.map((l) => l.ch).join('');
  const wordPlain = L.map((l) => l.ch).join('');
  const writtenStress = L.some((l) => isStressMark(l.mark));

  // 2. lexicon
  const hit = hostPlain.length > 0 ? findLexicon(hostPlain) : undefined;
  const entry = hit?.entry;
  if (entry && !writtenStress) {
    const marks = annotationMarks(entry.accented);
    marks.forEach((mark, i) => {
      const letter = host[i];
      if (mark && letter && isStressMark(mark)) {
        letter.mark = mark;
        letter.markSource = 'lexicon';
      }
    });
  }
  const isFunctionWord =
    lastApos < 0 && !L.some((l) => l.mark !== null) && UNSTRESSED_FUNCTION_WORDS.has(wordPlain);

  // 4a. stressed -ìa suffixes need the i to be a nucleus before roles are assigned
  if (!isFunctionWord && !L.some((l) => isStressMark(l.mark)) && STRESSED_IA.test(hostPlain)) {
    const letter = host[host.length - 2];
    if (letter) {
      letter.mark = 'grave';
      letter.markSource = 'rule';
    }
  }

  // 3. vowel roles
  const roles = vowelRoles(L, entry?.hardGl === true);

  // 4. stress letter
  let stressLetter = -1;
  let stressSource: StressSource = 'default';
  for (let k = L.length - 1; k >= 0; k--) {
    const letter = L[k];
    if (letter && isStressMark(letter.mark)) {
      stressLetter = k;
      stressSource =
        letter.markSource === 'lexicon'
          ? 'lexicon'
          : letter.markSource === 'rule'
            ? 'rule'
            : 'accent';
      break;
    }
  }
  const nuclei = roles.flatMap((r, k) => (r === 'nucleus' ? [k] : []));
  const hostNuclei = nuclei.filter((k) => k >= hostStart);
  if (stressLetter < 0) {
    if (isFunctionWord || nuclei.length === 0) {
      stressSource = 'unstressed';
    } else {
      const antepenultRule =
        (/issim[oaie]$/u.test(hostPlain) && hostNuclei.length >= 3) ||
        (/bil[ei]$/u.test(hostPlain) && hostNuclei.length >= 3) ||
        (/evol[ei]$/u.test(hostPlain) && hostNuclei.length >= 3) ||
        (/olog(?:[oaie]|h[ie])$/u.test(hostPlain) && hostNuclei.length >= 3) ||
        (/esim[oaie]$/u.test(hostPlain) && hostNuclei.length >= 4);
      const pick = (fromEnd: number): number =>
        hostNuclei[hostNuclei.length - fromEnd] ?? nuclei[nuclei.length - 1] ?? -1;
      if (antepenultRule) {
        stressLetter = pick(3);
        stressSource = 'rule';
      } else if (hostNuclei.length >= 2 && roles[L.length - 1] === 'offGlide') {
        // Word-final falling diphthong: vorrei, parlai, europei.
        stressLetter = pick(1);
        stressSource = 'rule';
      } else if (hostNuclei.length >= 2) {
        stressLetter = pick(2);
        stressSource = 'default';
      } else {
        stressLetter = pick(1);
        stressSource = nuclei.length === 1 ? 'monosyllable' : 'default';
      }
    }
  }

  // 5. tokens
  const toks: Tok[] = [];
  let pendingStart: number | null = null;
  let zGroup = 0;
  const push = (
    ph: Phoneme,
    role: PhoneRole,
    from: number,
    to: number,
    extra: Partial<Tok> = {},
  ): void => {
    const first = L[from];
    const lastL = L[to];
    if (!first || !lastL) return;
    toks.push({
      ph,
      long: false,
      role,
      start: pendingStart ?? first.start,
      end: lastL.end,
      letter: from,
      flags: new Set(),
      alts: [],
      ...extra,
    });
    pendingStart = null;
  };
  const attachSilent = (k: number): void => {
    const letter = L[k];
    const last = toks.at(-1);
    if (!letter) return;
    if (last) last.end = Math.max(last.end, letter.end);
    else pendingStart ??= letter.start;
  };

  let k = 0;
  while (k < L.length) {
    const letter = L[k];
    if (!letter) break;
    const ch = letter.ch;
    const next = L[k + 1]?.ch;
    const next2 = L[k + 2]?.ch;
    const role = roles[k];
    if (role) {
      if (role === 'silent') attachSilent(k);
      else if (role === 'glide') push(ch === 'i' ? 'j' : 'w', 'onsetGlide', k, k);
      else if (role === 'offGlide') push(ch === 'i' ? 'i' : 'u', 'offGlide', k, k);
      else {
        const ph: Phoneme = ch === 'e' ? 'E' : ch === 'o' ? 'O' : (ch as Phoneme);
        push(ph, 'nucleus', k, k);
      }
      k++;
      continue;
    }
    const single = (ph: Phoneme, len = 1, long = false, extra: Partial<Tok> = {}): void => {
      push(ph, 'consonant', k, k + len - 1, extra);
      const t = toks.at(-1);
      if (t) t.long = long;
      k += len;
    };
    switch (ch) {
      case 'h':
        attachSilent(k);
        k++;
        break;
      case 'c':
        if (next === 'c') {
          if (next2 === 'h') single('k', 3, true);
          else if (FRONT.has(next2 ?? '')) single('tʃ', 2, true);
          else single('k', 2, true);
        } else if (next === 'q') single('k', 2, true);
        else if (next === 'h') single('k', 2);
        else if (FRONT.has(next ?? '')) single('tʃ');
        else single('k');
        break;
      case 'g':
        if (next === 'g') {
          if (next2 === 'h') single('ɡ', 3, true);
          else if (FRONT.has(next2 ?? '')) single('dʒ', 2, true);
          else single('ɡ', 2, true);
        } else if (next === 'h') single('ɡ', 2);
        else if (next === 'l' && next2 === 'i' && entry?.hardGl !== true) single('ʎ', 2);
        else if (next === 'n') single('ɲ', 2);
        else if (FRONT.has(next ?? '')) single('dʒ');
        else single('ɡ');
        break;
      case 's':
        if (next === 'c' && FRONT.has(next2 ?? '')) single('ʃ', 2);
        else if (next === 's') single('s', 2, true);
        else single('s', 1, false, { sVoiceable: true });
        break;
      case 'z':
        if (next === 'z') single('ts', 2, true, { zGroup });
        else single('ts', 1, false, { zGroup });
        zGroup++;
        break;
      case 'q':
        single('k');
        break;
      case 'x':
        push('k', 'consonant', k, k);
        push('s', 'consonant', k, k);
        k++;
        break;
      case 'j':
        push('j', 'onsetGlide', k, k);
        k++;
        break;
      case 'w':
        push('w', 'onsetGlide', k, k);
        k++;
        break;
      case 'k':
        single('k', next === 'k' ? 2 : 1, next === 'k');
        break;
      default: {
        const ph = ch as Phoneme;
        if (!PLAIN_CONSONANTS.has(ch)) {
          attachSilent(k);
          k++;
        } else if (next === ch) single(ph, 2, true);
        else single(ph);
      }
    }
  }

  // 6. z
  const zValues = entry?.z;
  toks.forEach((t, i) => {
    if (t.zGroup === undefined) return;
    const lexical =
      zValues && (hit?.exact === true || zValues.length === zGroup) ? zValues[t.zGroup] : undefined;
    const idx = t.letter;
    const zLen = t.long ? 2 : 1;
    const before = L[idx - 1]?.ch;
    const beforeBefore = L[idx - 2]?.ch;
    const after = L[idx + zLen]?.ch;
    const after2 = L[idx + zLen + 1]?.ch;
    const isLast = idx + zLen === L.length - 1;
    let value: ZValue;
    let uncertain = false;
    if (lexical) value = lexical;
    else if (after === 'i' && isVowelLetter(after2)) value = 'ts';
    else if (
      t.long &&
      before === 'i' &&
      after === 'a' &&
      ['r', 't', 'v', 'n', 'z'].includes(after2 ?? '')
    )
      value = 'dz';
    else if (
      !t.long &&
      before === 'n' &&
      (beforeBefore === 'a' || beforeBefore === 'e') &&
      isLast &&
      (after === 'a' || after === 'e' || after === 'i')
    )
      value = 'ts';
    else {
      uncertain = true;
      if (before === 'l' || before === 'r') value = 'ts';
      else if (i === 0 || idx === hostStart) value = 'dz';
      else value = 'ts';
    }
    t.ph = value;
    if (uncertain) {
      t.flags.add('zVoicingUncertain');
      t.alts.push(value === 'ts' ? 'dz' : 'ts');
    }
  });

  // 7. s voicing, 8. nasal assimilation
  const VOICED = new Set<Phoneme>(['b', 'd', 'ɡ', 'v', 'dʒ', 'dz', 'l', 'm', 'n', 'ɲ', 'ʎ', 'r']);
  toks.forEach((t, i) => {
    const prev = toks[i - 1];
    const next = toks[i + 1];
    if (t.ph === 's' && t.sVoiceable) {
      if (next && isConsonant(next.ph)) {
        if (VOICED.has(next.ph)) t.ph = 'z';
      } else if (
        prev &&
        (isVowel(prev.ph) || prev.role === 'offGlide') &&
        next &&
        (isVowel(next.ph) || isGlide(next.ph))
      ) {
        t.ph = 'z';
        t.alts.push('s');
        t.flags.add('sVoicingVariable');
      }
    }
    if (t.ph === 'n' && next && (next.ph === 'k' || next.ph === 'ɡ')) {
      t.ph = 'ŋ';
      t.alts.push('n');
    }
  });

  // 9. intrinsic geminates
  toks.forEach((t, i) => {
    const prev = toks[i - 1];
    const next = toks[i + 1];
    if (
      !t.long &&
      INTRINSIC_GEMINATES.has(t.ph) &&
      prev &&
      (prev.role === 'nucleus' || prev.role === 'offGlide') &&
      next &&
      (next.role === 'nucleus' || next.role === 'onsetGlide')
    ) {
      t.long = true;
      t.flags.add('intrinsicLong');
    }
  });

  // 10. mid vowels
  const nucleiCount = hostNuclei.length;
  toks.forEach((t, i) => {
    if (t.ph !== 'E' && t.ph !== 'O') return;
    const isE = t.ph === 'E';
    const letter = L[t.letter];
    if (!letter) return;
    const stressed = t.letter === stressLetter;
    if (letter.mark === 'grave' || letter.mark === 'acute') {
      const open = letter.mark === 'grave';
      t.ph = isE ? (open ? 'ɛ' : 'e') : open ? 'ɔ' : 'o';
      t.midSource = letter.markSource === 'lexicon' ? 'lexicon' : 'accent';
      return;
    }
    if (!stressed) {
      t.ph = isE ? 'e' : 'o';
      t.midSource = 'unstressed';
      return;
    }
    const prev = toks[i - 1];
    const beforeGlide = prev ? L[prev.letter - 1]?.ch : undefined;
    const pos = t.letter - hostStart;
    const fromEnd = hostPlain.length - pos;
    const suffix = hostPlain.slice(pos);
    let close = false;
    let open = false;
    if (
      !isE &&
      prev?.ph === 'w' &&
      prev.role === 'onsetGlide' &&
      beforeGlide !== 'q' &&
      beforeGlide !== 'g'
    ) {
      open = true;
    } else if (isE && prev?.ph === 'j' && prev.role === 'onsetGlide') {
      open = true;
    } else if (!isE) {
      close =
        (fromEnd === 3 && /^on[ei]$/u.test(suffix) && L[t.letter - 1]?.ch === 'i') ||
        (fromEnd === 3 && /^or[ei]$/u.test(suffix) && nucleiCount >= 2) ||
        (fromEnd === 3 && /^os[oaie]$/u.test(suffix) && nucleiCount >= 3);
    } else {
      close =
        (fromEnd === 4 && /^ent[eoi]$/u.test(suffix) && L[t.letter - 1]?.ch === 'm') ||
        (fromEnd === 4 && /^ezz[ae]$/u.test(suffix) && nucleiCount >= 3) ||
        (fromEnd === 3 && /^ese$/u.test(suffix) && nucleiCount >= 2) ||
        (fromEnd === 3 && /^esi$/u.test(suffix) && nucleiCount >= 3);
    }
    if (open || close) {
      t.ph = isE ? (open ? 'ɛ' : 'e') : open ? 'ɔ' : 'o';
      t.midSource = 'rule';
    } else {
      t.midSource = 'unknown';
      t.flags.add('midVowelUnknown');
      t.alts.push(...(isE ? (['e', 'ɛ'] as const) : (['o', 'ɔ'] as const)));
    }
  });

  // 11. syllables
  const sylls = syllabify(toks);
  let stressedSyllable: number | null = null;
  const stressTok = toks.findIndex((t) => t.letter === stressLetter && t.role === 'nucleus');
  if (stressTok >= 0) {
    const s = sylls.findIndex((syl) => syl.includes(stressTok));
    stressedSyllable = s >= 0 ? s : null;
  }
  const firstSyllable = new Map<number, number>();
  sylls.forEach((syl, s) => {
    for (const idx of syl) if (!firstSyllable.has(idx)) firstSyllable.set(idx, s);
  });

  const phonemes: PhoneToken[] = toks.map((t, i) => {
    const token: PhoneToken = {
      phoneme: t.ph,
      isLong: t.long,
      role: t.role,
      stressed: i === stressTok && stressedSyllable !== null,
      syllable: firstSyllable.get(i) ?? 0,
      span: { start: t.start, end: t.end },
      alternatives: t.alts,
      flags: [...t.flags],
    };
    return t.midSource ? { ...token, midVowelSource: t.midSource } : token;
  });
  const syllables: Syllable[] = sylls.map((syl, s) => ({
    phonemes: syl,
    stressed: s === stressedSyllable,
    span: {
      start: Math.min(...syl.map((i) => phonemes[i]?.span.start ?? end)),
      end: Math.max(...syl.map((i) => phonemes[i]?.span.end ?? start)),
    },
    ipa: syllableIpa(s, sylls, phonemes),
  }));
  const ipa = syllables.map((s) => (s.stressed ? 'ˈ' : '') + s.ipa).join('.');

  return {
    phonemes,
    syllables,
    stressedSyllable,
    stressSource,
    stressAlternatives:
      hit?.exact && entry?.homographs && !writtenStress ? [...entry.homographs] : [],
    ipa,
  };
}

const OBSTRUENTS = new Set<Phoneme>(['p', 'b', 't', 'd', 'k', 'ɡ', 'f', 'v']);
const LIQUIDS = new Set<Phoneme>(['r', 'l']);

function legalOnset(seq: readonly Tok[]): boolean {
  const cons = [...seq];
  while (cons.length > 0 && cons.at(-1)?.role === 'onsetGlide') cons.pop();
  if (cons.some((t) => t.role !== 'consonant')) return false;
  const p = cons.map((t) => t.ph);
  const [a, b, c] = p;
  if (p.length <= 1) return true;
  const isS = (x: Phoneme | undefined): boolean => x === 's' || x === 'z';
  if (p.length === 2 && a && b) {
    if (OBSTRUENTS.has(a) && LIQUIDS.has(b) && !((a === 't' || a === 'd') && b === 'l'))
      return true;
    return isS(a) && !isS(b);
  }
  if (p.length === 3 && b && c) return isS(a) && OBSTRUENTS.has(b) && LIQUIDS.has(c);
  return false;
}

/** Group token indices into syllables. */
function syllabify(toks: readonly Tok[]): number[][] {
  const nuclei = toks.flatMap((t, i) => (t.role === 'nucleus' ? [i] : []));
  if (nuclei.length === 0) return toks.length > 0 ? [toks.map((_, i) => i)] : [];
  const syllables: number[][] = nuclei.map(() => []);
  const first = nuclei[0] ?? 0;
  for (let i = 0; i <= first; i++) syllables[0]?.push(i);
  for (let s = 1; s < nuclei.length; s++) {
    const prevN = nuclei[s - 1] ?? 0;
    const n = nuclei[s] ?? 0;
    const prevSyl = syllables[s - 1];
    const syl = syllables[s];
    if (!prevSyl || !syl) continue;
    let g = prevN + 1;
    while (g < n && toks[g]?.role === 'offGlide') prevSyl.push(g++);
    const cluster: number[] = [];
    for (let i = g; i < n; i++) cluster.push(i);
    let split = cluster.length;
    let lastLong = -1;
    cluster.forEach((i, j) => {
      if (toks[i]?.long === true) lastLong = j;
    });
    if (lastLong >= 0) {
      split = lastLong;
      for (let j = 0; j <= lastLong; j++) prevSyl.push(cluster[j] ?? 0);
    } else {
      for (let j = 0; j <= cluster.length; j++) {
        const onset = cluster
          .slice(j)
          .map((i) => toks[i])
          .filter((t): t is Tok => !!t);
        if (legalOnset(onset)) {
          split = j;
          break;
        }
      }
      for (let j = 0; j < split; j++) prevSyl.push(cluster[j] ?? 0);
    }
    for (let j = split; j < cluster.length; j++) syl.push(cluster[j] ?? 0);
    syl.push(n);
  }
  const last = syllables[syllables.length - 1];
  const lastN = nuclei[nuclei.length - 1] ?? 0;
  for (let i = lastN + 1; i < toks.length; i++) last?.push(i);
  return syllables;
}

const CODA_HALF: Partial<Record<Phoneme, string>> = { ts: 't', dz: 'd', tʃ: 't', dʒ: 'd' };

function syllableIpa(
  s: number,
  sylls: readonly (readonly number[])[],
  phonemes: readonly PhoneToken[],
): string {
  return (sylls[s] ?? [])
    .map((idx) => {
      const p = phonemes[idx];
      if (!p) return '';
      if (!p.isLong) return p.phoneme;
      if (sylls[s + 1]?.includes(idx)) return CODA_HALF[p.phoneme] ?? p.phoneme;
      if (sylls[s - 1]?.includes(idx)) return p.phoneme;
      return `${p.phoneme}ː`;
    })
    .join('');
}

// ---------------------------------------------------------------------------
// Public API

const WORD = /[\p{L}\p{M}]+(?:['’][\p{L}\p{M}]+)*['’]?/gu;

/**
 * Convert Italian text to phonemes, word by word.
 *
 * @example
 * ```ts
 * g2p('fatto').words[0]?.ipa; // 'ˈfat.to'
 * ```
 */
export function g2p(input: string): G2PResult {
  const text = input.normalize('NFC');
  const words: WordG2P[] = [];
  for (const m of text.matchAll(WORD)) {
    const start = m.index;
    const end = start + m[0].length;
    const analysis = analyseWord(text, start, end);
    if (analysis.phonemes.length === 0) continue;
    words.push({ text: m[0], span: { start, end }, ...analysis });
  }
  return { text, words: markSyntacticDoubling(text, words) };
}

function isTrigger(word: WordG2P): boolean {
  const lower = word.text.toLowerCase().replace(/['’]$/u, '');
  if (SYNTACTIC_DOUBLING_TRIGGERS.has(lower)) return true;
  // Any word written with a final stressed vowel (città, perché, andò).
  return /[àèéìíòóùú]$/u.test(lower);
}

function markSyntacticDoubling(text: string, words: WordG2P[]): WordG2P[] {
  return words.map((word, w) => {
    const prev = words[w - 1];
    if (!prev || !isTrigger(prev)) return word;
    if (!/^\s+$/u.test(text.slice(prev.span.end, word.span.start))) return word;
    const lastPrev = prev.phonemes.at(-1);
    if (lastPrev?.role !== 'nucleus') return word;
    const [first, second] = word.phonemes;
    if (first?.role !== 'consonant' || first.isLong) return word;
    if ((first.phoneme === 's' || first.phoneme === 'z') && second?.role === 'consonant')
      return word;
    const phonemes = word.phonemes.map((p, i) =>
      i === 0 ? { ...p, flags: [...p.flags, 'syntacticDoublingCandidate' as const] } : p,
    );
    return { ...word, phonemes };
  });
}

/** Flatten a G2P result into the expected phone sequence used by {@link alignPhones}. */
export function expectedPhones(result: G2PResult): ExpectedPhone[] {
  return result.words.flatMap((word, wordIndex) =>
    word.phonemes.map((p, phoneIndex) => ({
      phoneme: p.phoneme,
      isLong: p.isLong,
      alternatives: p.alternatives,
      wordIndex,
      phoneIndex,
    })),
  );
}
