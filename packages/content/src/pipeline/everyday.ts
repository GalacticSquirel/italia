/**
 * Everyday vocabulary. The seed ranks lemmas by how often they occur in film
 * and TV subtitles, which underrates words people use every day but rarely say
 * on screen: the months (gennaio is about #3800 by subtitle frequency),
 * quaderno, forchetta, nuora, aglio. This hand-picked list gives such words a
 * rank ceiling by CEFR level, so the A2 stories can use "forchetta" and the B1
 * stories "nuora". Words that are already frequent enough keep their rank.
 *
 * Entries are lemmas, with `|POS` where the bare lemma is ambiguous
 * (`sei|NUM`, not the verb form). Compound numerals are not listed: the
 * lexicon reads them as their parts (see `numerals.ts`).
 *
 * Pure: no IO.
 */
import { type Lexicon, parseUnitKey, unitKey } from './lexicon';

/** Levels the list uses. */
export type EverydayLevel = 'A1' | 'A2' | 'B1' | 'B2';

/**
 * The highest seed rank a word of each level may have: the top story band of
 * that level (A2 stories go up to band 1500, B1 to 3000, B2 to 5000). A1 words
 * go up to the first A2 band (750) instead of 500: the A1 bands are so small
 * that pushing some 70 words into them would push out core words such as
 * "cane"; the A1 stories can still use them as next-band words.
 */
export const LEVEL_CEILING: Readonly<Record<EverydayLevel, number>> = {
  A1: 750,
  A2: 1500,
  B1: 3000,
  B2: 5000,
};

/** The list, by level. Each string is a space-separated group of one topic. */
export const EVERYDAY_VOCABULARY: Readonly<Record<EverydayLevel, readonly string[]>> = {
  A1: [
    // Core words of everyday scenes, which the A1 stories need.
    'cane gatto casa scuola negozio bar chiesa treno biglietto regalo scarpa',
    'zero uno due tre quattro cinque sei|NUM sette otto nove dieci undici dodici tredici',
    'quattordici quindici sedici diciassette diciotto diciannove venti trenta quaranta',
    'cinquanta sessanta settanta ottanta novanta cento mille',
    'lunedì martedì mercoledì giovedì venerdì sabato domenica',
    'gennaio febbraio marzo aprile maggio giugno luglio agosto settembre ottobre novembre',
    'dicembre',
    'rosso giallo verde blu azzurro marrone grigio rosa viola arancione nero bianco',
    'padre madre fratello sorella figlio figlia marito moglie nonno nonna zio zia cugino cugina',
    'nipote',
  ],
  A2: [
    'pane latte formaggio pomodoro uovo mela pera arancia banana limone fragola uva frutta',
    'verdura insalata patata carota cipolla riso zucchero sale pepe olio burro marmellata',
    'biscotto gelato torta cioccolato prosciutto pollo bistecca minestra zuppa colazione pranzo',
    'cena merenda forchetta coltello cucchiaio piatto bicchiere tazza bottiglia',
    'maglietta camicia gonna pantalone giacca cappotto maglione calza calzino cappello',
    'sciarpa guanto vestito borsa ombrello',
    'cucina bagno camera letto tavolo sedia divano armadio finestra porta frigorifero forno',
    'doccia lavandino specchio lampada chiave giardino balcone scala ascensore',
    'quaderno penna matita libro zaino lavagna maestra maestro compito lezione',
    'testa capello occhio naso bocca orecchio dente mano braccio gamba piede dito pancia',
    'schiena collo',
    'pioggia neve sole vento nuvola',
    'cavallo mucca pecora maiale gallina uccello pesce coniglio topo',
    'autobus stazione fermata piazza strada supermercato farmacia',
    'ospedale banca',
    'settimana mese stagione primavera estate autunno inverno mattina pomeriggio sera notte',
    'medico dottoressa infermiere infermiera cameriere cameriera cuoco commesso commessa',
    'insegnante impiegato impiegata',
  ],
  B1: [
    'aglio zucchina melanzana peperone fagiolo pisello lenticchia basilico prezzemolo farina',
    'lievito aceto miele panna mozzarella parmigiano ricotta salame salsiccia vitello manzo',
    'tonno salmone gambero ciliegia pesca albicocca anguria melone castagna noce mandorla fungo',
    'sugo ragù brodo risotto lasagna frittata antipasto contorno aperitivo spuntino trattoria',
    'pizzeria pasticceria panetteria macelleria cucchiaino tovaglia tovagliolo pentola padella',
    'teglia vassoio grembiule ricetta tazzina',
    'poltrona cassetto comodino scaffale tenda tappeto cuscino coperta lenzuolo asciugamano',
    'sapone spazzolino dentifricio pettine scopa secchio lavatrice lavastoviglie aspirapolvere',
    'rubinetto vasca terrazzo cortile cantina soffitta citofono campanello termosifone',
    'pianerottolo maniglia',
    'stivale sandalo ciabatta pigiama cintura cravatta bottone tasca taglia',
    'astuccio righello gomma diario pagella voto esame interrogazione preside professoressa',
    'grammatica vocabolario dizionario verbo aggettivo pronuncia dialetto accento',
    'suocero suocera genero nuora cognato cognata fidanzato fidanzata bisnonno gemello parente',
    'vedova vedovo',
    'farmacista fornaio panettiere macellaio parrucchiere idraulico elettricista falegname',
    'muratore contadino pescatore postino vigile pompiere veterinario dentista operaio operaia',
    'segretaria giornalista fotografo autista tassista meccanico sarto sarta',
    'febbre tosse raffreddore influenza medicina pillola sciroppo cerotto termometro allergia',
    'ambulatorio',
    'temporale fulmine tuono arcobaleno nebbia grandine ghiaccio umidità bosco prato collina',
    'pianura valle fiume lago spiaggia onda isola sentiero',
    'capra gallo anatra oca scoiattolo volpe lupo orso farfalla ape mosca zanzara formica ragno',
    'lumaca serpente lucertola rana tartaruga delfino balena',
    'semaforo marciapiede incrocio parcheggio binario biglietteria abbonamento edicola',
    'tabaccheria francobollo busta cartolina pacco sportello bancomat portafoglio scontrino',
    'spicciolo moneta tram metropolitana traghetto',
    'compleanno anniversario matrimonio carnevale vigilia capodanno ferragosto',
  ],
  B2: [
    'congiuntivo sostantivo ortografia dettato caldaia condizionatore ventilatore stendino',
    'molletta interruttore vendemmia vigneto grappolo frantoio botte acciuga cozza vongola',
    'polpo calamaro rosmarino origano peperoncino cece spinacio',
    'brina rugiada afa siccità alluvione frana valanga torrente ruscello sorgente scoglio vetta',
    'ghiacciaio grotta palude penisola',
    'passero piccione gabbiano rondine aquila gufo civetta cinghiale cervo riccio lepre vespa',
    'medusa granchio pulcino',
    'gondola vaporetto motoscafo canale vicolo rotonda capolinea pendolare piazzetta',
    'ostetrica calzolaio benzinaio traduttore agricoltore iniezione vaccino benda presepe',
    'panettone coriandolo polenta salumeria enoteca osteria caraffa mestolo grattugia colapasta',
    'nostalgia malinconia stanchezza lentezza pigrizia timidezza sollievo spazzaneve sagrestano',
    'doglia raffermo geografo',
  ],
};

/** Every entry with its rank ceiling. Throws on a duplicate. */
export function everydayCeilings(): Map<string, number> {
  const out = new Map<string, number>();
  for (const [level, groups] of Object.entries(EVERYDAY_VOCABULARY) as [
    EverydayLevel,
    readonly string[],
  ][]) {
    for (const entry of groups.join(' ').split(/\s+/).filter(Boolean)) {
      if (out.has(entry)) throw new Error(`Everyday word listed twice: ${entry}`);
      out.set(entry, LEVEL_CEILING[level]);
    }
  }
  return out;
}

/** Parts of speech a bare everyday entry may stand for, in order of preference. */
const ENTRY_POS = ['NOUN', 'ADJ', 'VERB', 'ADV', 'NUM'];

/**
 * Resolve each entry to a `lemma|POS` key: an entry with `|POS` as written;
 * a bare lemma to its most frequent content-word key in `counts`, or else to
 * a key the lexicon has. Throws for an entry the lexicon does not know.
 */
export function everydayKeys(
  ceilings: ReadonlyMap<string, number>,
  counts: ReadonlyMap<string, number>,
  lexicon: Lexicon,
): Map<string, number> {
  const known = new Map<string, Set<string>>();
  const add = (key: string) => {
    const { lemma, upos } = parseUnitKey(key);
    if (!ENTRY_POS.includes(upos)) return;
    let set = known.get(lemma);
    if (!set) known.set(lemma, (set = new Set()));
    set.add(key);
  };
  for (const key of counts.keys()) add(key);
  for (const readings of lexicon.values()) {
    for (const r of readings) if (r.units.length === 1 && r.units[0]) add(unitKey(r.units[0]));
  }
  const out = new Map<string, number>();
  const unknown: string[] = [];
  for (const [entry, ceiling] of ceilings) {
    const options = [...(known.get(entry.split('|')[0] ?? '') ?? [])];
    const key = entry.includes('|')
      ? options.find((k) => k === entry)
      : options.sort(
          (a, b) =>
            (counts.get(b) ?? 0) - (counts.get(a) ?? 0) ||
            ENTRY_POS.indexOf(parseUnitKey(a).upos) - ENTRY_POS.indexOf(parseUnitKey(b).upos),
        )[0];
    if (key) out.set(key, ceiling);
    else unknown.push(entry);
  }
  if (unknown.length > 0) throw new Error(`Everyday words the lexicon lacks: ${unknown.join(' ')}`);
  return out;
}

/**
 * Reorder a ranking (most frequent first) so that every item with a ceiling
 * sits at or above it (1-based), moving as little as possible: an item keeps
 * its place when that already meets its ceiling, and otherwise moves up only
 * as far as it must. The rest keep their relative order.
 *
 * Throws when the ceilings cannot all be met (more items under a ceiling than
 * there are places).
 */
export function applyRankCeilings<T>(
  ranked: readonly T[],
  ceilingOf: (item: T) => number | undefined,
): T[] {
  const capped = ranked
    .map((item, index) => ({ item, index, ceiling: ceilingOf(item) }))
    .filter((c): c is { item: T; index: number; ceiling: number } => c.ceiling !== undefined)
    // Earliest deadline first; on a tie, the more frequent item first.
    .sort((a, b) => a.ceiling - b.ceiling || a.index - b.index);
  const placed = new Set<number>();
  const out: T[] = [];
  let next = 0;
  while (out.length < ranked.length) {
    const position = out.length + 1;
    // Must a capped item go here? Yes when, for some ceiling c, the items still
    // waiting with a ceiling up to c fill every place left up to c.
    let first: (typeof capped)[number] | undefined;
    let waiting = 0;
    let forced = false;
    for (const c of capped) {
      if (placed.has(c.index)) continue;
      if (c.ceiling < position) throw new Error(`Rank ceiling ${c.ceiling} cannot be met`);
      first ??= c;
      waiting++;
      if (waiting >= c.ceiling - position + 1) {
        forced = true;
        break;
      }
    }
    if (forced && first) {
      placed.add(first.index);
      out.push(first.item);
      continue;
    }
    while (placed.has(next)) next++;
    placed.add(next);
    out.push(ranked[next] as T);
  }
  return out;
}
