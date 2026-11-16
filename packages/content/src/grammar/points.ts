/**
 * Hand-written grammar graph for A1-A2 (plus the first B1 points the A2 material
 * leads into), in the acquisition order from the research report: noun-phrase
 * agreement before subject-verb agreement before clitics; present, then
 * passato prossimo (avere before essere), imperfetto, future, conditional.
 *
 * Ids are fixed forever once published: add new points with new ids, never
 * renumber. `order` may change between seed versions.
 */

export type GrammarCefr = 'A1' | 'A2' | 'B1';

export interface GrammarPointSource {
  /** Stable numeric id (the `grammar_point.id`). */
  readonly id: number;
  /** Stable human-readable key. */
  readonly slug: string;
  readonly title: string;
  readonly cefr: GrammarCefr;
  /** Slugs of points that must be learnt first. */
  readonly prerequisites: readonly string[];
  /** Short explicit note in Markdown, at most 150 words, with 2-3 examples. */
  readonly noteMd: string;
}

/** Points in teaching order (their position is their `order`, starting at 1). */
export const GRAMMAR_POINTS: readonly GrammarPointSource[] = [
  {
    id: 1,
    slug: 'noun-gender-number',
    title: 'Nouns: gender and number',
    cefr: 'A1',
    prerequisites: [],
    noteMd: `Every Italian noun is **masculine** or **feminine**, even objects.

- Most nouns in **-o** are masculine: *libro* → plural *libri*.
- Most nouns in **-a** are feminine: *casa* → plural *case*.
- Nouns in **-e** can be either; learn the gender with the word: *il padre*, *la notte*. Plural **-i**: *padri*, *notti*.
- Nouns ending in an accented vowel or a consonant do not change: *la città → le città*, *il bar → i bar*.

Examples:
- *Il ragazzo legge un libro.* (The boy is reading a book.)
- *Le case sono grandi.* (The houses are big.)`,
  },
  {
    id: 2,
    slug: 'definite-articles',
    title: 'Definite articles: il, lo, la, i, gli, le',
    cefr: 'A1',
    prerequisites: ['noun-gender-number'],
    noteMd: `"The" changes with the gender, number and first sound of the next word.

| | singular | plural |
|---|---|---|
| masculine | **il** (most), **lo** (before s + consonant, z, gn, ps, y) | **i** / **gli** |
| feminine | **la** | **le** |

Before a vowel, *lo* and *la* become **l'**, and the plural of *l'* (masculine) is **gli**: *l'amico → gli amici*, *l'amica → le amiche*.

Italian uses the article more than English, for example with general ideas: *Mi piace il caffè.*

Examples:
- *Il libro è sul tavolo.* (The book is on the table.)
- *Lo studente e la studentessa.* (The male student and the female student.)
- *Gli amici di Marco.* (Marco's friends.)`,
  },
  {
    id: 3,
    slug: 'indefinite-articles',
    title: 'Indefinite articles: un, uno, una',
    cefr: 'A1',
    prerequisites: ['noun-gender-number'],
    noteMd: `"A, an" follows the same sound rules as the definite article.

- **un**: most masculine nouns, including before a vowel: *un libro*, *un amico*.
- **uno**: masculine before s + consonant, z, gn, ps: *uno studente*, *uno zaino*.
- **una**: feminine: *una casa*. Before a vowel it becomes **un'**: *un'amica*.

There is no plural indefinite article; use *dei / degli / delle* ("some") or nothing: *Ho comprato (delle) mele.*

Examples:
- *Ho un fratello e una sorella.* (I have a brother and a sister.)
- *C'è uno zaino sotto la sedia.* (There is a backpack under the chair.)`,
  },
  {
    id: 4,
    slug: 'subject-pronouns',
    title: 'Subject pronouns',
    cefr: 'A1',
    prerequisites: [],
    noteMd: `| | singular | plural |
|---|---|---|
| 1st | **io** (I) | **noi** (we) |
| 2nd | **tu** (you, informal) | **voi** (you all) |
| 3rd | **lui** (he), **lei** (she) | **loro** (they) |

**Lei** with a capital letter is the polite "you" and takes the *lei* (3rd person) verb form.

The verb ending already shows the person, so the pronoun is usually **left out**. Use it for emphasis or contrast.

Examples:
- *Sono stanco.* (I am tired.)
- *Io lavoro, tu dormi!* (I work, you sleep!)
- *Lei è italiano, signore?* (Are you Italian, sir?)`,
  },
  {
    id: 5,
    slug: 'essere-present',
    title: 'Essere (to be) in the present',
    cefr: 'A1',
    prerequisites: ['subject-pronouns'],
    noteMd: `**essere**: *sono, sei, è, siamo, siete, sono*.

Note *è* (is) has an accent; *e* without one means "and". *Sono* is both "I am" and "they are"; context tells them apart.

Use *essere* for identity, origin (*essere di*), description and location.

Examples:
- *Sono di Londra.* (I'm from London.)
- *Mario è molto simpatico.* (Mario is very nice.)
- *Siamo a casa.* (We are at home.)`,
  },
  {
    id: 6,
    slug: 'avere-present',
    title: 'Avere (to have) in the present',
    cefr: 'A1',
    prerequisites: ['subject-pronouns'],
    noteMd: `**avere**: *ho, hai, ha, abbiamo, avete, hanno*. The **h** is silent; it only distinguishes *ho* (I have) from *o* (or), *ha* from *a* (to) and *hanno* from *anno* (year).

Italian uses *avere* in many phrases where English uses "to be": *avere fame* (to be hungry), *avere sete* (thirsty), *avere freddo* (cold), *avere ragione* (right), *avere vent'anni* (to be twenty).

Examples:
- *Ho una macchina rossa.* (I have a red car.)
- *Hai fame?* (Are you hungry?)
- *Quanti anni hai?* (How old are you?)`,
  },
  {
    id: 7,
    slug: 'adjective-agreement',
    title: 'Adjectives agree with the noun',
    cefr: 'A1',
    prerequisites: ['definite-articles', 'indefinite-articles'],
    noteMd: `Adjectives match the noun in gender and number, and usually come **after** it.

- **-o** adjectives have four forms: *un gatto nero, una gatta nera, gatti neri, gatte nere*.
- **-e** adjectives have two: *un libro interessante, una storia interessante, libri interessanti*.

A few very common adjectives usually go before the noun: *bello, buono, brutto, grande, piccolo, nuovo, vecchio*. *Bello* and *buono* then change like articles: *un bel ragazzo, un buon amico*.

Examples:
- *Ho una casa piccola.* (I have a small house.)
- *Sono ragazze simpatiche.* (They are nice girls.)`,
  },
  {
    id: 8,
    slug: 'ce-ci-sono',
    title: "C'è and ci sono (there is, there are)",
    cefr: 'A1',
    prerequisites: ['essere-present'],
    noteMd: `**c'è** + singular = there is; **ci sono** + plural = there are.

Questions use the same words with rising intonation: *C'è un bagno?* Negative: *Non c'è tempo.*

Do not confuse with *ecco* ("here is", when pointing something out): *Ecco il treno!*

Examples:
- *C'è un bar vicino alla stazione.* (There's a café near the station.)
- *Ci sono molte persone qui.* (There are lots of people here.)
- *Non c'è problema.* (No problem.)`,
  },
  {
    id: 9,
    slug: 'negation',
    title: 'Negation with non',
    cefr: 'A1',
    prerequisites: ['essere-present'],
    noteMd: `Put **non** directly before the verb (and before any object pronouns attached to it).

Italian uses **double negatives**: *non* + verb + *niente* (nothing), *nessuno* (nobody), *mai* (never), *più* (any more), *ancora* (yet).

If *niente* or *nessuno* comes before the verb, drop *non*: *Nessuno lo sa.*

Examples:
- *Non parlo tedesco.* (I don't speak German.)
- *Non vedo niente.* (I can't see anything.)
- *Non lo so.* (I don't know.)`,
  },
  {
    id: 10,
    slug: 'questions',
    title: 'Questions and question words',
    cefr: 'A1',
    prerequisites: ['essere-present'],
    noteMd: `A yes/no question has the same word order as a statement; only the intonation rises: *Parli italiano?*

Question words: **chi** (who), **che cosa / cosa / che** (what), **dove** (where), **quando** (when), **come** (how), **perché** (why), **quanto** (how much), **quale** (which). The subject often goes after the verb: *Dove abita Luca?*

*Perché* also means "because" in the answer.

Examples:
- *Come ti chiami?* (What's your name?)
- *Dove sei?* (Where are you?)
- *Perché ridi?* (Why are you laughing?)`,
  },
  {
    id: 11,
    slug: 'present-are',
    title: 'Present tense: regular -are verbs',
    cefr: 'A1',
    prerequisites: ['subject-pronouns'],
    noteMd: `Drop **-are** and add: **-o, -i, -a, -iamo, -ate, -ano**.

*parlare*: *parlo, parli, parla, parliamo, parlate, parlano*.

The stress in the *loro* form is the same as in *io*: *PARlano*. Verbs in -care/-gare add **h** to keep the hard sound: *cerchi, paghiamo*. Verbs in -iare keep one *i*: *mangi, mangiamo*.

The Italian present also covers "I am doing" and the near future.

Examples:
- *Abito a Roma.* (I live in Rome.)
- *Parliamo italiano.* (We speak Italian.)
- *Domani lavoro.* (I'm working tomorrow.)`,
  },
  {
    id: 12,
    slug: 'present-ere-ire',
    title: 'Present tense: regular -ere and -ire verbs',
    cefr: 'A1',
    prerequisites: ['present-are'],
    noteMd: `**-ere**: *-o, -i, -e, -iamo, -ete, -ono* → *scrivo, scrivi, scrive, scriviamo, scrivete, scrivono*.

**-ire**: *-o, -i, -e, -iamo, -ite, -ono* → *dormo, dormi, dorme, dormiamo, dormite, dormono*.

Many -ire verbs add **-isc-** in all forms except *noi* and *voi*: *capire* → *capisco, capisci, capisce, capiamo, capite, capiscono*. Others like this: *finire, preferire, pulire, spedire*.

Examples:
- *Leggo il giornale.* (I read the newspaper.)
- *Dormono fino a tardi.* (They sleep late.)
- *Non capisco.* (I don't understand.)`,
  },
  {
    id: 13,
    slug: 'irregular-present',
    title: 'Common irregular verbs in the present',
    cefr: 'A1',
    prerequisites: ['present-ere-ire'],
    noteMd: `The most frequent verbs are irregular; learn them as wholes.

- **fare** (do, make): *faccio, fai, fa, facciamo, fate, fanno*
- **andare** (go): *vado, vai, va, andiamo, andate, vanno*
- **stare** (stay, be): *sto, stai, sta, stiamo, state, stanno*
- **venire** (come): *vengo, vieni, viene, veniamo, venite, vengono*
- **dire** (say): *dico, dici, dice, diciamo, dite, dicono*
- **uscire** (go out): *esco, esci, esce, usciamo, uscite, escono*

Also learn *dare* (*do, dai, dà...*), *sapere* (*so, sai, sa...*), *bere* (*bevo...*), *rimanere* (*rimango...*).

Examples:
- *Che cosa fai stasera?* (What are you doing tonight?)
- *Vado al lavoro in treno.* (I go to work by train.)
- *Come stai?* (How are you?)`,
  },
  {
    id: 14,
    slug: 'modal-verbs',
    title: 'Volere, potere, dovere + infinitive',
    cefr: 'A1',
    prerequisites: ['irregular-present'],
    noteMd: `The modal verbs are followed directly by an infinitive, with no "to".

- **volere** (want): *voglio, vuoi, vuole, vogliamo, volete, vogliono*
- **potere** (can, may): *posso, puoi, può, possiamo, potete, possono*
- **dovere** (must, have to): *devo, devi, deve, dobbiamo, dovete, devono*

Object pronouns can go before the modal or be attached to the infinitive: *Lo voglio vedere* = *Voglio vederlo*.

Examples:
- *Voglio imparare l'italiano.* (I want to learn Italian.)
- *Posso entrare?* (May I come in?)
- *Devo partire domani.* (I have to leave tomorrow.)`,
  },
  {
    id: 15,
    slug: 'predicative-agreement',
    title: 'Agreement across the sentence: essere + adjective',
    cefr: 'A1',
    prerequisites: ['adjective-agreement', 'essere-present'],
    noteMd: `An adjective after *essere* still agrees with the subject, even though it is in a different part of the sentence.

- *Il museo è chiuso.* / *La banca è chiusa.*
- *I negozi sono chiusi.* / *Le farmacie sono chiuse.*

When the subject mixes masculine and feminine, use the masculine plural: *Marco e Anna sono stanchi.*

The verb also agrees with its subject in person and number: *Il bambino dorme*, *I bambini dormono*.

Examples:
- *La pizza è buona.* (The pizza is good.)
- *Siamo contenti.* (We're happy.)`,
  },
  {
    id: 16,
    slug: 'simple-prepositions',
    title: 'Simple prepositions',
    cefr: 'A1',
    prerequisites: ['definite-articles'],
    noteMd: `The core prepositions: **di** (of, from), **a** (to, at, in a city), **da** (from, at someone's place, since), **in** (in, to a country or region), **con** (with), **su** (on), **per** (for), **tra / fra** (between, in time).

Useful patterns:
- *a* + city, *in* + country: *Vivo a Milano, in Italia.*
- *da* + person: *Vado da Marco.* (to Marco's)
- *in* + transport: *in treno, in macchina*; but *a piedi*.
- *tra* + time: *tra un'ora* (in an hour).

Examples:
- *Sono di Napoli.* (I'm from Naples.)
- *Esco con gli amici.* (I'm going out with friends.)`,
  },
  {
    id: 17,
    slug: 'articulated-prepositions',
    title: 'Prepositions + article: nel, della, al...',
    cefr: 'A1',
    prerequisites: ['simple-prepositions'],
    noteMd: `**di, a, da, in, su** join with a following definite article into one word.

| | il | lo | la | l' | i | gli | le |
|---|---|---|---|---|---|---|---|
| di | del | dello | della | dell' | dei | degli | delle |
| a | al | allo | alla | all' | ai | agli | alle |
| da | dal | dallo | dalla | dall' | dai | dagli | dalle |
| in | nel | nello | nella | nell' | nei | negli | nelle |
| su | sul | sullo | sulla | sull' | sui | sugli | sulle |

*con* and *per* stay separate: *con il, per la*.

Examples:
- *Il libro è nella borsa.* (The book is in the bag.)
- *Vado al mare.* (I'm going to the seaside.)
- *La casa dei miei genitori.* (My parents' house.)`,
  },
  {
    id: 18,
    slug: 'demonstratives',
    title: 'Questo and quello',
    cefr: 'A1',
    prerequisites: ['adjective-agreement'],
    noteMd: `**questo** (this) agrees like an -o adjective: *questo libro, questa casa, questi libri, queste case*.

**quello** (that) changes like the definite article when it comes before a noun: *quel libro, quello studente, quell'albero, quella casa, quei libri, quegli amici, quelle case*.

Used alone, as pronouns, they have regular forms: *Questo è mio, quello è tuo.*

Examples:
- *Questa pizza è buonissima.* (This pizza is delicious.)
- *Chi è quel ragazzo?* (Who is that boy?)
- *Preferisco quella.* (I prefer that one.)`,
  },
  {
    id: 19,
    slug: 'possessives',
    title: 'Possessives: il mio, la tua...',
    cefr: 'A1',
    prerequisites: ['adjective-agreement'],
    noteMd: `Possessives agree with the **thing owned**, not the owner, and normally take the article: *il mio libro, la mia casa, i miei libri, le mie case*.

Forms: *mio, tuo, suo* (his, her, your formal), *nostro, vostro*, and *loro* (invariable).

With a **singular, unmodified family noun**, drop the article: *mia madre, tuo fratello*. Keep it in the plural (*i miei fratelli*), with *loro* (*la loro madre*) and with *mamma, papà*.

Examples:
- *Dov'è la mia borsa?* (Where's my bag?)
- *Mio padre è medico.* (My father is a doctor.)
- *Suo marito è simpatico.* (Her husband is nice.)`,
  },
  {
    id: 20,
    slug: 'piacere',
    title: 'Mi piace (I like)',
    cefr: 'A1',
    prerequisites: ['present-ere-ire'],
    noteMd: `*Piacere* works backwards from English: the thing liked is the **subject**, and the person is an indirect object ("to me it is pleasing").

- **mi piace** + singular noun or infinitive: *Mi piace il caffè. Mi piace leggere.*
- **mi piacciono** + plural noun: *Mi piacciono i gatti.*

The person: *mi, ti, gli* (to him), *le* (to her), *ci, vi, gli* (to them), or *a* + noun: *A Marco piace il calcio.*

Examples:
- *Ti piace la musica italiana?* (Do you like Italian music?)
- *Non mi piacciono le verdure.* (I don't like vegetables.)`,
  },
  {
    id: 21,
    slug: 'passato-prossimo-avere',
    title: 'Passato prossimo with avere',
    cefr: 'A2',
    prerequisites: ['avere-present', 'present-ere-ire'],
    noteMd: `The passato prossimo is the everyday past for completed events: *I did, I have done*.

Form: present of **avere** + **past participle**. Regular participles: **-are → -ato**, **-ere → -uto**, **-ire → -ito**: *parlato, venduto, dormito*.

With *avere* the participle normally does not change: *Anna ha mangiato.*

Adverbs like *già, mai, appena, sempre* usually go between the two parts: *Ho già mangiato.*

Examples:
- *Ieri ho lavorato tutto il giorno.* (Yesterday I worked all day.)
- *Hai finito?* (Have you finished?)
- *Abbiamo venduto la macchina.* (We sold the car.)`,
  },
  {
    id: 22,
    slug: 'irregular-participles',
    title: 'Irregular past participles',
    cefr: 'A2',
    prerequisites: ['passato-prossimo-avere'],
    noteMd: `Many common verbs, especially in **-ere**, have irregular participles. Learn them with the verb:

*fare → fatto, dire → detto, vedere → visto, prendere → preso, mettere → messo, leggere → letto, scrivere → scritto, aprire → aperto, chiudere → chiuso, perdere → perso, rispondere → risposto, chiedere → chiesto, bere → bevuto, essere → stato, venire → venuto, nascere → nato, morire → morto*.

Examples:
- *Che cosa hai fatto ieri?* (What did you do yesterday?)
- *Non ho visto niente.* (I didn't see anything.)
- *Ho letto il tuo messaggio.* (I read your message.)`,
  },
  {
    id: 23,
    slug: 'passato-prossimo-essere',
    title: 'Passato prossimo with essere and agreement',
    cefr: 'A2',
    prerequisites: ['passato-prossimo-avere', 'predicative-agreement'],
    noteMd: `Most verbs of **movement or change of state** use **essere**: *andare, venire, arrivare, partire, uscire, entrare, tornare, restare, stare, diventare, nascere, morire, succedere*, and *essere* itself.

With *essere*, the participle **agrees with the subject** like an adjective: *-o, -a, -i, -e*.

- *Marco è andato.* / *Giulia è andata.*
- *Siamo arrivati.* / *Le ragazze sono uscite.*

Examples:
- *Sono nato a Torino.* (I was born in Turin.)
- *Mia sorella è partita ieri.* (My sister left yesterday.)
- *Che cosa è successo?* (What happened?)`,
  },
  {
    id: 24,
    slug: 'reflexive-verbs',
    title: 'Reflexive verbs in the present',
    cefr: 'A2',
    prerequisites: ['present-ere-ire'],
    noteMd: `Reflexive verbs end in **-si** in the infinitive (*lavarsi*, to wash oneself) and use a reflexive pronoun before the verb: **mi, ti, si, ci, vi, si**.

*alzarsi*: *mi alzo, ti alzi, si alza, ci alziamo, vi alzate, si alzano*.

Many daily-routine and feeling verbs are reflexive in Italian but not in English: *svegliarsi* (wake up), *vestirsi* (get dressed), *sentirsi* (feel), *divertirsi* (have fun), *chiamarsi* (be called).

With an infinitive, attach the pronoun: *Devo alzarmi presto.*

Examples:
- *Mi chiamo Luca.* (My name is Luca.)
- *A che ora ti svegli?* (What time do you wake up?)`,
  },
  {
    id: 25,
    slug: 'reflexive-passato-prossimo',
    title: 'Reflexive verbs in the passato prossimo',
    cefr: 'A2',
    prerequisites: ['reflexive-verbs', 'passato-prossimo-essere'],
    noteMd: `Reflexive verbs always use **essere** in compound tenses, so the participle agrees with the subject.

Form: reflexive pronoun + *essere* + participle.

- *Mi sono alzato* (a man) / *Mi sono alzata* (a woman).
- *Ci siamo divertiti molto.*
- *Si sono sposati l'anno scorso.*

Examples:
- *Stamattina mi sono svegliata tardi.* (This morning I woke up late.)
- *Vi siete divertiti alla festa?* (Did you have fun at the party?)
- *Luca si è sentito male.* (Luca felt ill.)`,
  },
  {
    id: 26,
    slug: 'direct-object-pronouns',
    title: 'Direct object pronouns: lo, la, li, le',
    cefr: 'A2',
    prerequisites: ['present-ere-ire', 'definite-articles'],
    noteMd: `Direct object pronouns replace the thing or person that receives the action: **mi** (me), **ti** (you), **lo** (him, it m.), **la** (her, it f.), **ci** (us), **vi** (you pl.), **li** (them m.), **le** (them f.). Polite "you" is **La**.

They go **before** the conjugated verb, after *non*: *Non lo so.* They attach to the end of an infinitive: *Voglio vederla.*

*Lo* and *la* become **l'** before a vowel or *h*: *L'ho comprato.*

Examples:
- *Conosci Marco? Sì, lo conosco.* (Do you know Marco? Yes, I know him.)
- *Dove sono le chiavi? Non le trovo.* (Where are the keys? I can't find them.)`,
  },
  {
    id: 27,
    slug: 'object-pronouns-passato-prossimo',
    title: "Object pronouns with the passato prossimo (l'ho vista)",
    cefr: 'A2',
    prerequisites: ['direct-object-pronouns', 'passato-prossimo-avere'],
    noteMd: `With *avere*, the participle normally stays in **-o**, but it **agrees** with a preceding **lo, la, li, le**:

- *Hai visto Anna? Sì, l'ho vista.*
- *Hai comprato i biglietti? Sì, li ho comprati.*
- *Le lettere? Le ho scritte ieri.*

*Lo* and *la* shorten to *l'* before *ho, hai, ha, hanno*; *li* and *le* never shorten.

Examples:
- *La pizza? L'abbiamo già mangiata.* (The pizza? We've already eaten it.)
- *Non li ho visti.* (I didn't see them.)`,
  },
  {
    id: 28,
    slug: 'indirect-object-pronouns',
    title: 'Indirect object pronouns: gli, le',
    cefr: 'A2',
    prerequisites: ['direct-object-pronouns', 'piacere'],
    noteMd: `Indirect object pronouns mean "to / for someone": **mi, ti, gli** (to him; in speech also to them), **le** (to her; **Le** to you formal), **ci, vi, gli** (to them; formal *loro*, after the verb).

They go before the conjugated verb, like direct object pronouns. Common verbs: *dare, dire, telefonare, scrivere, chiedere, rispondere, mandare*, and *piacere*.

Examples:
- *Gli telefono stasera.* (I'll call him tonight.)
- *Le ho dato un regalo.* (I gave her a present.)
- *Mi dici la verità?* (Will you tell me the truth?)`,
  },
  {
    id: 29,
    slug: 'imperfetto-essere-avere',
    title: "Imperfetto first: era, aveva, c'era",
    cefr: 'A2',
    prerequisites: ['passato-prossimo-essere'],
    noteMd: `The imperfetto describes **states and background** in the past. Learners pick it up first with *essere* and *avere*.

- **essere**: *ero, eri, era, eravamo, eravate, erano*
- **avere**: *avevo, avevi, aveva, avevamo, avevate, avevano*
- **c'era / c'erano**: there was / there were

Examples:
- *Quando ero piccolo, avevo un cane.* (When I was little, I had a dog.)
- *C'era molta gente.* (There were lots of people.)
- *La casa era vecchia.* (The house was old.)`,
  },
  {
    id: 30,
    slug: 'imperfetto',
    title: 'Imperfetto: regular forms and uses',
    cefr: 'A2',
    prerequisites: ['imperfetto-essere-avere'],
    noteMd: `Drop **-re** from the infinitive and add **-vo, -vi, -va, -vamo, -vate, -vano**: *parlavo, leggevi, dormiva, andavamo*. Irregular stems: *fare → facevo, dire → dicevo, bere → bevevo*.

Use it for:
- **habits**: "used to", "would": *Da bambino giocavo sempre a calcio.*
- **descriptions** of people, weather, time, feelings: *Faceva freddo.*
- **actions in progress** when something else happened: *Leggevo quando...*

Examples:
- *Ogni estate andavamo al mare.* (Every summer we went to the seaside.)
- *Mentre dormivo, pioveva.* (While I was sleeping, it was raining.)`,
  },
  {
    id: 31,
    slug: 'passato-prossimo-vs-imperfetto',
    title: 'Passato prossimo or imperfetto?',
    cefr: 'A2',
    prerequisites: ['imperfetto', 'passato-prossimo-essere'],
    noteMd: `Both are past tenses, but they show the event differently.

- **Passato prossimo**: a completed event, a point on the timeline. *Ieri ho visto Marco.*
- **Imperfetto**: the background, a state, a habit or an action in progress, with no focus on its end. *Marco era stanco.*

In a story, the imperfetto sets the scene and the passato prossimo moves the action forward:

*Pioveva e non c'era nessuno. All'improvviso è arrivato un treno.* (It was raining and there was nobody. Suddenly a train arrived.)

Example:
- *Mentre cucinavo, ha suonato il telefono.* (While I was cooking, the phone rang.)`,
  },
  {
    id: 32,
    slug: 'future',
    title: 'The simple future',
    cefr: 'A2',
    prerequisites: ['present-ere-ire'],
    noteMd: `Endings for all verbs: **-ò, -ai, -à, -emo, -ete, -anno**, added to the infinitive minus final *-e*; **-are** verbs change *a* to *e*: *parlare → parlerò*, *leggere → leggerò*, *dormire → dormirò*.

Common irregular stems: *essere → sarò, avere → avrò, andare → andrò, fare → farò, venire → verrò, volere → vorrò, potere → potrò, dovere → dovrò*.

Italians often use the present for plans; the future is common for predictions and promises, and for guesses: *Sarà vero.* (It's probably true.)

Examples:
- *Domani pioverà.* (It will rain tomorrow.)
- *Ti chiamerò stasera.* (I'll call you tonight.)`,
  },
  {
    id: 33,
    slug: 'stare-gerund',
    title: 'Stare + gerund (I am doing)',
    cefr: 'A2',
    prerequisites: ['irregular-present'],
    noteMd: `To stress that something is happening **right now**, use **stare** + gerund.

Gerund: **-are → -ando**, **-ere / -ire → -endo**: *parlando, leggendo, dormendo*. Irregular: *fare → facendo, dire → dicendo, bere → bevendo*.

*Sto mangiando* = I am eating (at this moment). The simple present *mangio* also works, but *stare* + gerund is more vivid. It is not used for future plans.

Examples:
- *Cosa stai facendo?* (What are you doing?)
- *Sto leggendo un libro.* (I'm reading a book.)
- *Stavamo uscendo.* (We were going out.)`,
  },
  {
    id: 34,
    slug: 'imperative',
    title: 'The informal imperative',
    cefr: 'A2',
    prerequisites: ['present-ere-ire'],
    noteMd: `For **tu**, **noi** and **voi**:

- **-are**: *parla! parliamo! parlate!*
- **-ere / -ire**: *prendi! prendiamo! prendete!*, *senti! sentite!*

So the *tu* form of -are verbs ends in **-a**; the others are the same as the present.

Negative *tu* = **non** + infinitive: *Non parlare!* Pronouns attach to the end: *Dimmi!* (tell me), *Aspettami!* Common irregulars: *fa'*, *va'*, *sta'*, *da'*, *di'*, *sii* (be), *abbi*.

Examples:
- *Scusa, aspetta un momento!* (Sorry, wait a moment!)
- *Non toccare!* (Don't touch!)
- *Andiamo!* (Let's go!)`,
  },
  {
    id: 35,
    slug: 'comparatives',
    title: 'Comparatives: più / meno ... di / che',
    cefr: 'A2',
    prerequisites: ['adjective-agreement'],
    noteMd: `**più** (more) and **meno** (less) + adjective, then:

- **di** before a noun or pronoun: *Marco è più alto di Luca.*
- **che** when comparing two adjectives, verbs or other phrases: *È più facile leggere che parlare.*

Equality: **(così) ... come** or **(tanto) ... quanto**: *È alto come me.*

Irregular forms are common: *migliore* (better), *peggiore* (worse); as adverbs *meglio, peggio*. Superlative: *il più bello*, or *-issimo*: *bellissimo*.

Examples:
- *Roma è più grande di Firenze.* (Rome is bigger than Florence.)
- *Oggi sto meglio.* (Today I feel better.)`,
  },
  {
    id: 36,
    slug: 'ci-locative',
    title: 'Ci meaning "there"',
    cefr: 'B1',
    prerequisites: ['ce-ci-sono', 'direct-object-pronouns'],
    noteMd: `**ci** replaces a place already mentioned (often after *a, in, da*). It goes before the verb, like other pronouns.

- *Vai a Roma? Sì, ci vado domani.* (Yes, I'm going there tomorrow.)
- *Sei mai stato in Sicilia? No, non ci sono mai stato.*

It also replaces *a* + a thing or idea after verbs like *pensare a, credere a*: *Ci penso io.* (I'll take care of it.)

Fixed expressions: *ci vuole / ci vogliono* (it takes), *volerci*, *non ci vedo* (I can't see).

Example:
- *Ci vogliono due ore.* (It takes two hours.)`,
  },
  {
    id: 37,
    slug: 'ne-partitive',
    title: 'Ne meaning "of it, of them"',
    cefr: 'B1',
    prerequisites: ['direct-object-pronouns'],
    noteMd: `**ne** replaces a noun after a quantity, so the quantity can stand alone. English often leaves it out ("I have two").

- *Quanti fratelli hai? Ne ho due.* (I have two [of them].)
- *Vuoi del caffè? Sì, ne prendo un po'.*
- *Non ne ho.* (I haven't got any.)

It also replaces *di* + something after verbs like *parlare di, avere bisogno di*: *Ne abbiamo parlato.* (We talked about it.)

Example:
- *Che ne pensi?* (What do you think about it?)`,
  },
  {
    id: 38,
    slug: 'conditional',
    title: 'The conditional: vorrei, potrei',
    cefr: 'B1',
    prerequisites: ['future', 'modal-verbs'],
    noteMd: `The conditional ("would") uses the **future stem** with the endings **-ei, -esti, -ebbe, -emmo, -este, -ebbero**: *parlerei, leggerei, sarei, avrei*.

Start with the polite chunks:
- **vorrei** (I would like): *Vorrei un caffè, per favore.*
- **potrei / potresti** (could I / could you): *Potresti aiutarmi?*
- **dovrei** (I should): *Dovrei studiare di più.*

It also softens opinions and gives advice: *Al tuo posto, andrei.*

Examples:
- *Mi piacerebbe vedere Venezia.* (I'd like to see Venice.)
- *Sarebbe bello.* (That would be nice.)`,
  },
];
