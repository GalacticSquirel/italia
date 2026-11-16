/**
 * Hand-checked data that corrects or fills gaps in the automatic sources.
 */

/**
 * Glosses for high-frequency function words whose Wiktionary first senses are
 * long usage notes or alternative forms. Key: `lemma|UPOS`.
 */
export const GLOSS_OVERRIDES: Readonly<Record<string, string>> = {
  'il|DET': 'the',
  'un|DET': 'a, an',
  'di|ADP': "of, from, 's",
  'a|ADP': 'to, at, in',
  'da|ADP': "from, by, at (someone's place), since",
  'in|ADP': 'in, into, to',
  'su|ADP': 'on, about',
  'con|ADP': 'with',
  'per|ADP': 'for, through, in order to',
  'tra|ADP': 'between, among, in (time)',
  'fra|ADP': 'between, among, in (time)',
  'gente|NOUN': 'people, folks',
  'eh|INTJ': 'eh, huh',
  'che|SCONJ': 'that, than',
  'che|DET': 'what, which, who, that',
  'che|PRON': 'what, which, who, that',
  'e|CCONJ': 'and',
  'o|CCONJ': 'or',
  'ma|CCONJ': 'but',
  'non|ADV': 'not',
  'essere|VERB': 'to be',
  'avere|VERB': 'to have',
  'stare|VERB': 'to stay, to be (feeling, doing)',
  'andare|VERB': 'to go',
  'dire|VERB': 'to say, to tell',
  'dovere|VERB': 'to have to, must; to owe',
  'più|ADV': 'more; (with non) any more',
  'signore|NOUN': 'sir, gentleman, Mr; the Lord',
  'uomo|NOUN': 'man, person',
  'si|PRON': 'oneself, himself, herself; one (impersonal)',
  'ci|PRON': 'us, to us; there, about it',
  'ne|PRON': 'of it, of them, about it; from there',
  'mi|PRON': 'me, to me, myself',
  'ti|PRON': 'you, to you, yourself',
  'vi|PRON': 'you (plural), to you; there',
  'lo|PRON': 'him, it',
  'la|PRON': 'her, it; you (formal)',
  'li|PRON': 'them (masculine)',
  'le|PRON': 'them (feminine); to her, to you (formal)',
  'gli|PRON': 'to him, to them',
  'io|PRON': 'I',
  'tu|PRON': 'you (informal)',
  'lui|PRON': 'he, him',
  'lei|PRON': 'she, her; you (formal)',
  'noi|PRON': 'we, us',
  'voi|PRON': 'you (plural)',
  'loro|PRON': 'they, them; their',
  'cosa|NOUN': 'thing; what',
  'grazie|INTJ': 'thank you, thanks',
  'tardi|ADV': 'late',
  'se|SCONJ': 'if, whether',
  'come|ADV': 'how, like, as',
  'perché|ADV': 'why, because',
  'quando|ADV': 'when',
  'dove|ADV': 'where',
  'mio|DET': 'my, mine',
  'tuo|DET': 'your, yours (informal)',
  'suo|DET': 'his, her, its; your (formal)',
  'nostro|DET': 'our, ours',
  'vostro|DET': 'your, yours (plural)',
  'questo|DET': 'this, this one',
  'quello|DET': 'that, that one',
};

/**
 * Lemmas never put in the seed: a first-pass profanity and slur filter, plus
 * English words and name-like titles that subtitles use as Italian.
 */
export const BLOCKED_LEMMAS: ReadonlySet<string> = new Set([
  'cazzo',
  'cazzata',
  'cazzone',
  'merda',
  'stronzo',
  'stronza',
  'stronzata',
  'puttana',
  'puttanata',
  'troia',
  'troietta',
  'zoccola',
  'fottere',
  'fottuto',
  'fottutamente',
  'vaffanculo',
  'fanculo',
  'culo',
  'coglione',
  'cogliona',
  'coglionata',
  'minchia',
  'figa',
  'fica',
  'scopare',
  'sega',
  'pompino',
  'tetta',
  'cagare',
  'cacare',
  'incazzare',
  'incazzato',
  'sfigato',
  'bastardo',
  'bastarda',
  'frocio',
  'ricchione',
  'negro',
  'troione',
  'porca',
  'puttaniere',
  'cornuto',
  'deficiente',
  'ritardato',
  'bob',
  'don',
  'lord',
  'lady',
  'city',
  'star',
  'mister',
  'baby',
  'sir',
  'okay',
]);

/**
 * Forms whose only sensible reading the automatic disambiguation gets wrong
 * (the tagged corpus mislabels them). Value: the one `lemma|UPOS` to keep.
 */
export const FORM_READINGS: Readonly<Record<string, string>> = {
  sei: 'essere|VERB',
  era: 'essere|VERB',
  sai: 'sapere|VERB',
  grazie: 'grazie|INTJ',
  salve: 'salve|INTJ',
  tardi: 'tardi|ADV',
  caffe: 'caffè|NOUN',
  pero: 'però|CCONJ',
  meta: 'metà|NOUN',
  papa: 'papà|NOUN',
  faro: 'fare|VERB',
  stia: 'stare|VERB',
  do: 'dare|VERB',
  accetto: 'accettare|VERB',
  accetta: 'accettare|VERB',
  accetti: 'accettare|VERB',
  confesso: 'confessare|VERB',
  confessa: 'confessare|VERB',
  riporto: 'riportare|VERB',
  malissimo: 'male|ADV',
  salivo: 'salire|VERB',
  salivano: 'salire|VERB',
};

/**
 * Part of speech a merged homograph group takes (possessives and demonstratives
 * are determiners even though the tagged corpus mostly calls them pronouns).
 */
export const PREFERRED_POS: Readonly<Record<string, string>> = {
  mio: 'DET',
  tuo: 'DET',
  suo: 'DET',
  nostro: 'DET',
  vostro: 'DET',
  questo: 'DET',
  quello: 'DET',
  cosa: 'NOUN',
};

/**
 * Rows missing from Morph-it! 0.4.8, in its own `form<TAB>lemma<TAB>tag` format
 * (it lists only "veduto" as the participle of vedere, and lacks "ehi").
 */
export const LEXICON_SUPPLEMENT = [
  'ehi\tehi\tINT',
  'visto\tvedere\tVER:part+past+s+m',
  'vista\tvedere\tVER:part+past+s+f',
  'visti\tvedere\tVER:part+past+p+m',
  'viste\tvedere\tVER:part+past+p+f',
].join('\n');

/** Single letters are only kept when they are real words. */
export const SINGLE_LETTER_WORDS: ReadonlySet<string> = new Set(['a', 'e', 'o', 'i']);

/**
 * Frequent subtitle word forms deliberately left out of the seed, with the
 * reason. Every other form in the top of the frequency list must map to a seed
 * lemma or be a name (checked by the seed tests).
 */
export const EXCLUDED_TOP_FORMS: Readonly<Record<string, string>> = {
  ok: 'English loanword, understood without teaching',
  okay: 'English loanword, understood without teaching',
  cazzo: 'profanity',
};
