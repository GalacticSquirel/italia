import type { GrammarPointSource } from '../types';

/** A2 grammar points in teaching order. */
export const A2_POINTS: readonly GrammarPointSource[] = [
  {
    id: 21,
    slug: 'passato-prossimo-avere',
    title: 'Passato prossimo with avere',
    cefr: 'A2',
    prerequisites: ['avere-present', 'present-ere-ire'],
    noteMd: `**In short:** The passato prossimo is the everyday past tense for finished actions: *I worked*, *I have worked*. Most verbs build it with *avere*.

It has two parts: the present of **avere** (here a helper verb, called the auxiliary) + the **past participle** (the verb's "-ed" form).

| infinitive | participle |
|---|---|
| parl**are** | parl**ato** |
| vend**ere** | vend**uto** |
| dorm**ire** | dorm**ito** |

The full forms of *mangiare*: *ho mangiato, hai mangiato, ha mangiato, abbiamo mangiato, avete mangiato, hanno mangiato*.

- With *avere* the participle stays in **-o**, whoever the subject (the person doing the action) is: *Anna ha mangiato*, *i ragazzi hanno mangiato*.
- One Italian form covers both English "I ate" and "I have eaten".
- Short adverbs like *già* (already), *mai* (ever, never), *appena* (just) and *sempre* (always) usually go between the two parts: *Ho già mangiato.*
- *Non* goes before the auxiliary: *Non ho capito.*
- Many common -ere verbs have irregular participles; they come in the next point.

**Watch out:** never drop the auxiliary. *Io mangiato* is wrong: say *Ho mangiato*. And there is no "did" in Italian questions or negatives: *Hai finito?* (Did you finish?), *Non ho finito.* (I didn't finish.)

Examples:
- *Ieri ho lavorato tutto il giorno.* (Yesterday I worked all day.)
- *Hai finito?* (Have you finished?)
- *Abbiamo venduto la macchina.* (We sold the car.)
- *Ho già mangiato, grazie.* (I've already eaten, thanks.)`,
    drills: [
      {
        it: 'Ieri [ho lavorato] fino alle otto.',
        en: 'Yesterday I worked until eight.',
        hint: 'lavorare (passato prossimo, io)',
      },
      {
        it: '[Hai finito] i compiti?',
        en: 'Have you finished your homework?',
        hint: 'finire (passato prossimo, tu)',
      },
      {
        it: 'Marco [ha mangiato] una pizza.',
        en: 'Marco ate a pizza.',
        hint: 'mangiare (passato prossimo)',
      },
      {
        it: '[Abbiamo venduto] la macchina.',
        en: 'We sold the car.',
        hint: 'vendere (passato prossimo, noi)',
      },
      {
        it: '[Avete dormito] bene?',
        en: 'Did you sleep well?',
        hint: 'dormire (passato prossimo, voi)',
      },
      {
        it: 'I bambini [hanno giocato] in giardino.',
        en: 'The children played in the garden.',
        hint: 'giocare (passato prossimo)',
      },
      {
        it: 'Stamattina [ho comprato] il pane.',
        en: 'This morning I bought bread.',
        hint: 'comprare (passato prossimo, io)',
      },
      {
        it: 'Laura [ha ricevuto] una lettera.',
        en: 'Laura received a letter.',
        hint: 'ricevere (passato prossimo)',
      },
      {
        it: 'Scusa, non [ho capito] la domanda.',
        en: "Sorry, I didn't understand the question.",
        hint: 'capire (passato prossimo, io)',
      },
      {
        it: '[Avete conosciuto] i genitori di Anna?',
        en: "Have you met Anna's parents?",
        hint: 'conoscere (passato prossimo, voi)',
      },
      {
        it: 'No, grazie, [ho già mangiato].',
        en: "No, thanks, I've already eaten.",
        hint: 'mangiare (passato prossimo, io) + già',
      },
      {
        it: 'I miei amici non [hanno mai provato] la pizza napoletana.',
        en: 'My friends have never tried Neapolitan pizza.',
        hint: 'provare (passato prossimo) + mai',
      },
    ],
  },
  {
    id: 22,
    slug: 'irregular-participles',
    title: 'Irregular past participles',
    cefr: 'A2',
    prerequisites: ['passato-prossimo-avere'],
    noteMd: `**In short:** Many common verbs, especially in **-ere**, have an irregular past participle. The passato prossimo is built the same way (*ho* + participle), but the participle must be learnt with the verb.

The most useful ones:

| verb | participle | verb | participle |
|---|---|---|---|
| fare | fatto | dire | detto |
| vedere | visto | leggere | letto |
| prendere | preso | scrivere | scritto |
| mettere | messo | aprire | aperto |
| chiudere | chiuso | perdere | perso |
| chiedere | chiesto | rispondere | risposto |
| bere | bevuto | vivere | vissuto |

Some verbs that use *essere* also have irregular participles: *essere* and *stare → stato*, *venire → venuto*, *nascere → nato*, *morire → morto*, *rimanere → rimasto*. You will use them in the next point.

Many of these come in families: *prendere → preso*, so *spendere → speso*; *mettere → messo*, so *promettere → promesso*; *scrivere → scritto*, so *descrivere → descritto*.

**Watch out:** don't build a regular form by analogy. *Ho prenduto* and *ho veduto* are wrong (or very old-fashioned): say *ho preso* and *ho visto*.

Examples:
- *Che cosa hai fatto ieri?* (What did you do yesterday?)
- *Non ho visto il film.* (I didn't see the film.)
- *Ho letto il tuo messaggio.* (I read your message.)
- *Chi ha aperto la finestra?* (Who opened the window?)`,
    drills: [
      {
        it: 'Che cosa [hai fatto] ieri?',
        en: 'What did you do yesterday?',
        hint: 'fare (passato prossimo, tu)',
      },
      {
        it: 'Non [ho visto] il film.',
        en: "I didn't see the film.",
        hint: 'vedere (passato prossimo, io)',
      },
      {
        it: '[Ho letto] il tuo messaggio.',
        en: 'I read your message.',
        hint: 'leggere (passato prossimo, io)',
      },
      {
        it: 'Marco [ha detto] la verità.',
        en: 'Marco told the truth.',
        hint: 'dire (passato prossimo)',
      },
      {
        it: '[Abbiamo preso] un taxi.',
        en: 'We took a taxi.',
        hint: 'prendere (passato prossimo, noi)',
      },
      {
        it: 'Dove [hai messo] le chiavi?',
        en: 'Where did you put the keys?',
        hint: 'mettere (passato prossimo, tu)',
      },
      {
        it: 'Giulia [ha scritto] una lettera alla nonna.',
        en: 'Giulia wrote a letter to her grandmother.',
        hint: 'scrivere (passato prossimo)',
      },
      {
        it: 'Chi [ha aperto] la finestra?',
        en: 'Who opened the window?',
        hint: 'aprire (passato prossimo)',
      },
      {
        it: '[Avete chiuso] la porta?',
        en: 'Did you close the door?',
        hint: 'chiudere (passato prossimo, voi)',
      },
      {
        it: 'I ragazzi [hanno perso] la partita.',
        en: 'The boys lost the match.',
        hint: 'perdere (passato prossimo)',
      },
      {
        it: 'Il professore non [ha risposto] alla mia email.',
        en: "The teacher didn't answer my email.",
        hint: 'rispondere (passato prossimo)',
      },
      {
        it: 'Al bar [ho chiesto] un caffè.',
        en: 'At the café I asked for a coffee.',
        hint: 'chiedere (passato prossimo, io)',
      },
      {
        it: 'Ieri sera [abbiamo bevuto] troppo vino.',
        en: 'Last night we drank too much wine.',
        hint: 'bere (passato prossimo, noi)',
      },
      {
        it: 'I miei nonni [hanno vissuto] in campagna per tutta la vita.',
        en: 'My grandparents lived in the country all their lives.',
        hint: 'vivere (passato prossimo)',
        also: ['sono vissuti'],
      },
    ],
  },
  {
    id: 23,
    slug: 'passato-prossimo-essere',
    title: 'Passato prossimo with essere and agreement',
    cefr: 'A2',
    prerequisites: ['passato-prossimo-avere', 'predicative-agreement'],
    noteMd: `**In short:** Some verbs build the passato prossimo with **essere** instead of *avere*. They are mostly verbs of moving or changing, and their participle changes its ending to match the subject (the person or thing doing the action).

Common *essere* verbs: *andare, venire, arrivare, partire, uscire, entrare, tornare, restare, rimanere, stare, diventare, nascere, morire, succedere*, and *essere* itself (*sono stato*, I have been).

The participle **agrees** like an adjective: **-o** (masculine singular), **-a** (feminine singular), **-i** (masculine or mixed plural), **-e** (feminine plural).

| | a man / men | a woman / women |
|---|---|---|
| io | sono andato | sono andata |
| tu | sei andato | sei andata |
| lui / lei | è andato | è andata |
| noi | siamo andati | siamo andate |
| voi | siete andati | siete andate |
| loro | sono andati | sono andate |

A mixed group of men and women takes **-i**.

**Watch out:** English always says "have", so learners write *ho andato*. Verbs of going, coming, arriving, leaving and staying take *essere*: *sono andato*. And don't forget the ending: a woman says *sono andata*, not *sono andato*.

Examples:
- *Sono nato a Torino.* (I was born in Turin.)
- *Mia sorella è partita ieri.* (My sister left yesterday.)
- *Le ragazze sono uscite insieme.* (The girls went out together.)
- *Che cosa è successo?* (What happened?)`,
    drills: [
      {
        it: 'Marco [è andato] al cinema.',
        en: 'Marco went to the cinema.',
        hint: 'andare (passato prossimo)',
      },
      {
        it: 'Giulia [è arrivata] tardi.',
        en: 'Giulia arrived late.',
        hint: 'arrivare (passato prossimo)',
      },
      {
        it: 'Io e Paolo [siamo partiti] alle sei.',
        en: 'Paolo and I left at six.',
        hint: 'partire (passato prossimo, noi)',
      },
      {
        it: 'Le ragazze [sono uscite] insieme.',
        en: 'The girls went out together.',
        hint: 'uscire (passato prossimo)',
      },
      {
        it: 'Io [sono nata] a Torino.',
        en: 'I was born in Turin.',
        hint: 'nascere (passato prossimo, a woman speaking)',
      },
      {
        it: 'Luca, [sei tornato] presto ieri sera?',
        en: 'Luca, did you come back early last night?',
        hint: 'tornare (passato prossimo, tu)',
      },
      {
        it: 'Domenica [sono stata] a casa tutto il giorno.',
        en: 'On Sunday I stayed at home all day.',
        hint: 'stare (passato prossimo, a woman speaking)',
      },
      { it: 'Che cosa [è successo]?', en: 'What happened?', hint: 'succedere (passato prossimo)' },
      {
        it: 'I miei nonni [sono venuti] a pranzo.',
        en: 'My grandparents came for lunch.',
        hint: 'venire (passato prossimo)',
      },
      {
        it: 'Ragazze, perché [siete entrate] senza bussare?',
        en: 'Girls, why did you come in without knocking?',
        hint: 'entrare (passato prossimo, voi)',
      },
      {
        it: 'Mio padre [è diventato] nonno.',
        en: 'My father has become a grandfather.',
        hint: 'diventare (passato prossimo)',
      },
      {
        it: 'Anna e Paola [sono rimaste] a Roma.',
        en: 'Anna and Paola stayed in Rome.',
        hint: 'rimanere (passato prossimo)',
      },
      {
        it: 'Il nonno di Marco [è morto] nel 2010.',
        en: "Marco's grandfather died in 2010.",
        hint: 'morire (passato prossimo)',
      },
    ],
  },
  {
    id: 43,
    slug: 'modals-passato-prossimo',
    title: 'Modal verbs in the past: ho dovuto, sono dovuto andare',
    cefr: 'A2',
    prerequisites: ['modal-verbs', 'passato-prossimo-essere'],
    noteMd: `**In short:** To say "I had to", "I wanted to" or "I couldn't" about a finished event, put *dovere*, *volere* or *potere* (the modal verbs) in the passato prossimo and add an infinitive (the basic "to" form of a verb).

The participles are regular: *dovuto, voluto, potuto*.

The auxiliary (*avere* or *essere*) is chosen by the **infinitive that follows**:

- Infinitive that takes *avere* (like *lavorare, mangiare, studiare*): use **avere**. *Ho dovuto lavorare.* (I had to work.)
- Infinitive that takes *essere* (like *andare, partire, venire, restare*): careful Italian uses **essere**, and then the participle agrees with the subject. *Giulia è dovuta partire.* (Giulia had to leave.)
- Modal on its own, with no infinitive: **avere**. *Non ho potuto.* (I couldn't.)
- Modal + *essere*: **avere**. *Ho dovuto essere paziente.* (I had to be patient.)

In everyday speech you will also hear *avere* with essere verbs (*Giulia ha dovuto partire*), and it is accepted, but *essere* is the safer choice in writing.

| | with lavorare | with partire |
|---|---|---|
| io | ho dovuto lavorare | sono dovuto/a partire |
| lui / lei | ha dovuto lavorare | è dovuto/a partire |
| noi | abbiamo dovuto lavorare | siamo dovuti/e partire |
| loro | hanno dovuto lavorare | sono dovuti/e partire |

**Watch out:** English has no past of "must" or "can", so learners avoid these forms. Italian uses them all the time: *Ho dovuto* (I had to), *Non ho potuto* (I couldn't), *Non ha voluto* (he refused, he didn't want to).

Examples:
- *Ieri ho dovuto lavorare fino a tardi.* (Yesterday I had to work late.)
- *Giulia è dovuta partire presto.* (Giulia had to leave early.)
- *Non sono potuti venire alla festa.* (They couldn't come to the party.)
- *Mi dispiace, non ho potuto.* (I'm sorry, I couldn't.)`,
    drills: [
      {
        it: 'Ieri [ho dovuto] lavorare fino a tardi.',
        en: 'Yesterday I had to work late.',
        hint: 'dovere (passato prossimo, io)',
      },
      {
        it: 'Non [abbiamo potuto] comprare i biglietti.',
        en: "We couldn't buy the tickets.",
        hint: 'potere (passato prossimo, noi)',
      },
      {
        it: 'Marco non [ha voluto] mangiare.',
        en: "Marco didn't want to eat.",
        hint: 'volere (passato prossimo)',
      },
      {
        it: '[Hai potuto] parlare con il direttore?',
        en: 'Were you able to talk to the manager?',
        hint: 'potere (passato prossimo, tu)',
      },
      {
        it: 'Le ragazze [hanno dovuto] studiare tutto il weekend.',
        en: 'The girls had to study all weekend.',
        hint: 'dovere (passato prossimo)',
      },
      {
        it: 'Mi dispiace, non [ho potuto].',
        en: "I'm sorry, I couldn't.",
        hint: 'potere (passato prossimo, io, no infinitive)',
      },
      {
        it: 'Perché [hai voluto] cambiare casa?',
        en: 'Why did you want to move house?',
        hint: 'volere (passato prossimo, tu)',
      },
      {
        it: 'Giulia [è dovuta] partire presto.',
        en: 'Giulia had to leave early.',
        hint: 'dovere (passato prossimo, with the auxiliary of partire)',
        also: ['ha dovuto'],
      },
      {
        it: 'I miei amici non [sono potuti] venire alla festa.',
        en: "My friends couldn't come to the party.",
        hint: 'potere (passato prossimo, with the auxiliary of venire)',
        also: ['hanno potuto'],
      },
      {
        it: 'Ieri sera [sono voluta] restare a casa.',
        en: 'Last night I wanted to stay at home.',
        hint: 'volere (passato prossimo, with the auxiliary of restare, a woman speaking)',
        also: ['ho voluto'],
      },
      {
        it: 'Ragazzi, [siete dovuti] tornare a piedi?',
        en: 'Guys, did you have to walk back?',
        hint: 'dovere (passato prossimo, voi, with the auxiliary of tornare)',
        also: ['avete dovuto'],
      },
      {
        it: 'Anna [è voluta] andare al mare.',
        en: 'Anna wanted to go to the seaside.',
        hint: 'volere (passato prossimo, with the auxiliary of andare)',
        also: ['ha voluto'],
      },
    ],
  },
  {
    id: 44,
    slug: 'possessives-family',
    title: 'Possessives with family: mia madre, i miei fratelli',
    cefr: 'A2',
    prerequisites: ['possessives'],
    noteMd: `**In short:** Possessives (*my, your, his*...) normally need the article: *la mia casa*. With a **single family member**, the article is dropped: *mia madre*, *tuo fratello*.

No article with one family member, unchanged:
- *mio padre, mia madre, tuo fratello, sua sorella, nostro zio, vostra nonna*

The article comes back:
- in the **plural**: *i miei fratelli, le mie cugine, i nostri nonni*
- with **loro** (their), always: *la loro figlia, il loro zio*
- when the noun has an **adjective** or is **changed by a suffix** (an ending added for "little" or affection): *il mio fratellino* (my little brother), *la mia cara zia*
- usually with the affectionate words *mamma* and *papà*: *la mia mamma*, *il mio papà* (though *mia mamma* is common in speech)

Remember that *suo / sua* means **his, her** and formal **your** (*Suo*), and agrees with the family member, not with the owner: *suo marito* (her husband), *sua moglie* (his wife).

| | one | more than one |
|---|---|---|
| my brother / sister | mio fratello, mia sorella | i miei fratelli, le mie sorelle |
| their son | il loro figlio | i loro figli |

**Watch out:** English speakers either add the article everywhere (*la mia madre*, wrong) or drop it everywhere (*miei fratelli*, wrong). Rule of thumb: one relative, no article; several relatives or *loro*, article.

Examples:
- *Mia madre è insegnante.* (My mother is a teacher.)
- *I miei fratelli abitano a Milano.* (My brothers live in Milan.)
- *La loro figlia ha tre anni.* (Their daughter is three.)
- *Suo marito è medico.* (Her husband is a doctor.)`,
    drills: [
      { it: '[Mia] madre è insegnante.', en: 'My mother is a teacher.', hint: 'my (madre)' },
      { it: '[Mio] padre lavora in banca.', en: 'My father works in a bank.', hint: 'my (padre)' },
      { it: 'Come sta [tua] sorella?', en: "How's your sister?", hint: 'your (tu, sorella)' },
      {
        it: '[I miei] fratelli abitano a Milano.',
        en: 'My brothers live in Milan.',
        hint: 'my (fratelli, plural)',
      },
      {
        it: '[Le mie] cugine sono molto simpatiche.',
        en: 'My (female) cousins are very nice.',
        hint: 'my (cugine, feminine plural)',
      },
      { it: '[Suo] marito è medico.', en: 'Her husband is a doctor.', hint: 'her (marito)' },
      {
        it: '[La loro] figlia ha tre anni.',
        en: 'Their daughter is three.',
        hint: 'their (figlia)',
      },
      {
        it: '[Il mio] fratellino ha sei anni.',
        en: 'My little brother is six.',
        hint: 'my (fratellino, little brother)',
      },
      {
        it: '[I nostri] nonni vivono in campagna.',
        en: 'Our grandparents live in the country.',
        hint: 'our (nonni)',
      },
      {
        it: '[Vostro] zio è molto divertente.',
        en: 'Your uncle is really funny.',
        hint: 'your (voi, zio)',
      },
      {
        it: 'Signora, come sta [Suo] figlio?',
        en: 'Madam, how is your son?',
        hint: 'your (formal Lei, figlio)',
      },
      {
        it: "[Nostra] nonna ha novant'anni.",
        en: 'Our grandmother is ninety.',
        hint: 'our (nonna)',
      },
      { it: 'Conosci [i suoi] genitori?', en: 'Do you know his parents?', hint: 'his (genitori)' },
    ],
  },
  {
    id: 45,
    slug: 'double-negation',
    title: 'Never, nothing, nobody: non ... mai, niente, nessuno',
    cefr: 'A2',
    prerequisites: ['negation'],
    noteMd: `**In short:** To say "never", "nothing", "nobody" and similar, Italian puts **non** before the verb **and** the negative word after it. Two negatives make one negative.

| meaning | form |
|---|---|
| never | non ... mai |
| nothing | non ... niente (or nulla) |
| nobody, no one | non ... nessuno |
| no longer, not any more | non ... più |
| not even, neither | non ... neanche (or nemmeno, neppure) |

- *Non mangio mai la carne.* (I never eat meat.)
- *Non vedo nessuno.* (I don't see anybody.)

**Nessuno** before a noun means "no, not any" and changes like *uno*: *nessun problema*, *nessuno studente*, *nessuna idea*, *nessun'amica*. It is always singular.

When **niente** or **nessuno** comes first, as the subject (who or what does the action), **drop non**:
- *Nessuno è venuto.* = *Non è venuto nessuno.* (Nobody came.)
- *Niente è impossibile.* (Nothing is impossible.)

In the passato prossimo, *mai*, *più* and *neanche* usually go between the auxiliary and the participle, while *niente* and *nessuno* go after the participle: *Non ho mai visto Venezia*, *Non ho visto nessuno*.

**Watch out:** in English a double negative is wrong, so learners say *Vedo nessuno* or *Ho niente*. In Italian you need both: *Non vedo nessuno*, *Non ho niente*. Drop *non* only when the negative word comes before the verb.

Examples:
- *Non ho niente da fare.* (I have nothing to do.)
- *Non conosco nessuno qui.* (I don't know anybody here.)
- *Marco non fuma più.* (Marco doesn't smoke any more.)
- *Nessuno mi ha chiamato.* (Nobody called me.)`,
    drills: [
      { it: 'Non mangio [mai] la carne.', en: 'I never eat meat.', hint: 'never' },
      {
        it: 'Non ho [niente] da fare.',
        en: 'I have nothing to do.',
        hint: 'nothing',
        also: ['nulla'],
      },
      { it: 'Non conosco [nessuno] qui.', en: "I don't know anybody here.", hint: 'nobody' },
      { it: 'Marco non fuma [più].', en: "Marco doesn't smoke any more.", hint: 'no longer' },
      {
        it: "Non c'è [nessun] problema.",
        en: "There's no problem at all.",
        hint: 'no, not any (+ problema)',
      },
      { it: 'Non ho [nessuna] idea.', en: 'I have no idea.', hint: 'no, not any (+ idea)' },
      { it: 'Non ho [mai] visto Venezia.', en: "I've never seen Venice.", hint: 'never' },
      {
        it: 'Non hai mangiato [niente]?',
        en: "Didn't you eat anything?",
        hint: 'nothing, anything',
        also: ['nulla'],
      },
      {
        it: '[Nessuno] è venuto alla festa.',
        en: 'Nobody came to the party.',
        hint: 'nobody (at the start, before the verb)',
      },
      {
        it: '[Niente] è impossibile.',
        en: 'Nothing is impossible.',
        hint: 'nothing (at the start, before the verb)',
        also: ['Nulla'],
      },
      {
        it: 'Oggi [non] è venuto nessuno.',
        en: 'Nobody came today.',
        hint: 'the word needed before the verb',
      },
      {
        it: 'Non conosco [neanche] il suo nome.',
        en: "I don't even know his name.",
        hint: 'not even',
        also: ['nemmeno', 'neppure'],
      },
    ],
  },
  {
    id: 46,
    slug: 'da-duration',
    title: 'How long: da + present (abito qui da due anni)',
    cefr: 'A2',
    prerequisites: ['simple-prepositions'],
    noteMd: `**In short:** For something that started in the past and **is still true now**, Italian uses the **present tense** + **da** (for, since). English uses "have been" or "have done" here.

- *Abito qui da due anni.* (I have lived here for two years, and I still do.)
- *Studio l'italiano da sei mesi.* (I've been studying Italian for six months.)

*Da* covers both English "for" and "since":
- **da** + an amount of time: *da tre anni, da un mese, da mezz'ora*
- **da** + a starting point: *da lunedì, da gennaio*; with an article it combines: *dal 2015, dalle otto*

To ask "how long?": **Da quanto tempo...?** + present (in speech often just *Da quanto...?*).
- *Da quanto tempo lavori qui?* (How long have you been working here?)

In the negative it means "I haven't ... for":
- *Non vedo Marco da un mese.* (I haven't seen Marco for a month.)

If the period is **over**, use the passato prossimo with **per** (for):
- *Ho lavorato a Roma per due anni.* (I worked in Rome for two years, and I don't any more.)

**Watch out:** don't translate "I have lived" word for word. *Ho abitato qui da due anni* is wrong: say *Abito qui da due anni*. And don't use *per* for something still going on: *Abito qui per due anni* sounds like a future plan ("I'll live here for two years").

Examples:
- *Abito a Milano da tre anni.* (I've lived in Milan for three years.)
- *Ti aspetto da mezz'ora!* (I've been waiting for you for half an hour!)
- *Conosco Giulia dal 2015.* (I've known Giulia since 2015.)
- *Da quanto tempo studi l'italiano?* (How long have you been studying Italian?)`,
    drills: [
      {
        it: 'Abito a Milano [da] tre anni.',
        en: "I've lived in Milan for three years.",
        hint: 'for (still true now)',
      },
      {
        it: "Studio l'italiano [da] sei mesi.",
        en: "I've been studying Italian for six months.",
        hint: 'for (still going on)',
      },
      {
        it: "Ti aspetto [da] mezz'ora!",
        en: "I've been waiting for you for half an hour!",
        hint: 'for (still going on)',
      },
      {
        it: 'Siamo sposati [da] dieci anni.',
        en: "We've been married for ten years.",
        hint: 'for (still true now)',
      },
      {
        it: '[Da quanto tempo] lavori qui?',
        en: 'How long have you been working here?',
        hint: 'how long (still going on)',
        also: ['Da quanto'],
      },
      {
        it: 'Non vedo Marco [da] un mese.',
        en: "I haven't seen Marco for a month.",
        hint: 'for (negative, still true)',
      },
      {
        it: 'Conosco Giulia [dal] 2015.',
        en: "I've known Giulia since 2015.",
        hint: 'since (+ the year)',
      },
      { it: 'Piove [da] lunedì.', en: "It's been raining since Monday.", hint: 'since (+ a day)' },
      {
        it: "[Aspetto] l'autobus da venti minuti.",
        en: "I've been waiting for the bus for twenty minutes.",
        hint: 'aspettare (io, still waiting)',
      },
      {
        it: 'Marco [vive] a Londra da due anni.',
        en: 'Marco has been living in London for two years.',
        hint: 'vivere (he still lives there)',
      },
      {
        it: '[Siamo] qui dalle otto.',
        en: "We've been here since eight.",
        hint: 'essere (noi, still here)',
      },
      {
        it: 'Ho lavorato a Roma [per] due anni, poi sono tornato a casa.',
        en: 'I worked in Rome for two years, then I came back home.',
        hint: 'for (a finished period)',
      },
    ],
  },
  {
    id: 24,
    slug: 'reflexive-verbs',
    title: 'Reflexive verbs in the present',
    cefr: 'A2',
    prerequisites: ['present-ere-ire'],
    noteMd: `**In short:** Reflexive verbs are verbs where the action comes back to the subject (the person doing it), like *lavarsi* (to wash oneself). They need a small pronoun: *mi lavo* (I wash myself, I get washed).

In the dictionary they end in **-si**: *alzarsi* (to get up), *svegliarsi* (to wake up). Drop *-si*, conjugate the verb as usual, and put a reflexive pronoun **before** it:

| | alzarsi | vestirsi |
|---|---|---|
| io | mi alzo | mi vesto |
| tu | ti alzi | ti vesti |
| lui / lei | si alza | si veste |
| noi | ci alziamo | ci vestiamo |
| voi | vi alzate | vi vestite |
| loro | si alzano | si vestono |

Many daily-routine and feeling verbs are reflexive in Italian but not in English: *svegliarsi* (wake up), *vestirsi* (get dressed), *sentirsi* (feel), *divertirsi* (have fun), *riposarsi* (rest), *ricordarsi* (remember), *chiamarsi* (be called).

- *Non* goes before the pronoun: *Non mi sento bene.*
- With an infinitive, the pronoun joins its end, matching the person: *Devo alzarmi presto.* After *dovere, potere, volere* it can also go first: *Mi devo alzare presto.*
- For body parts, use the article, not *my*: *Mi lavo le mani.* (I wash my hands.)

**Watch out:** don't leave out the pronoun. *Alzo alle sette* means "I lift at seven": say *Mi alzo alle sette*. And it must match the person: *io mi*, *tu ti*, not *io si*.

Examples:
- *Mi chiamo Luca.* (My name is Luca.)
- *A che ora ti svegli?* (What time do you wake up?)
- *Ci divertiamo molto al mare.* (We have a lot of fun at the seaside.)
- *Devo alzarmi presto domani.* (I have to get up early tomorrow.)`,
    drills: [
      { it: 'Ciao, come [ti chiami]?', en: "Hi, what's your name?", hint: 'chiamarsi (tu)' },
      { it: '[Mi sveglio] alle sette.', en: 'I wake up at seven.', hint: 'svegliarsi (io)' },
      { it: 'Marco [si alza] sempre presto.', en: 'Marco always gets up early.', hint: 'alzarsi' },
      {
        it: '[Ci divertiamo] molto al mare.',
        en: 'We have a lot of fun at the seaside.',
        hint: 'divertirsi (noi)',
      },
      {
        it: 'A che ora [vi alzate] la domenica?',
        en: 'What time do you get up on Sundays?',
        hint: 'alzarsi (voi)',
      },
      { it: 'Giulia [si veste] in fretta.', en: 'Giulia gets dressed quickly.', hint: 'vestirsi' },
      {
        it: 'I bambini [si lavano] le mani.',
        en: 'The children wash their hands.',
        hint: 'lavarsi',
      },
      { it: 'Oggi non [mi sento] bene.', en: "I don't feel well today.", hint: 'sentirsi (io)' },
      { it: 'Ragazzi, [vi divertite]?', en: 'Guys, are you having fun?', hint: 'divertirsi (voi)' },
      {
        it: 'Non [mi ricordo] il suo nome.',
        en: "I don't remember his name.",
        hint: 'ricordarsi (io)',
      },
      {
        it: 'I miei gatti [si chiamano] Tom e Leo.',
        en: 'My cats are called Tom and Leo.',
        hint: 'chiamarsi',
      },
      {
        it: '[Devo alzarmi] presto domani.',
        en: 'I have to get up early tomorrow.',
        hint: 'dovere + alzarsi (io)',
        also: ['Mi devo alzare'],
      },
      {
        it: "Sei stanca? [Vuoi riposarti] un po'?",
        en: 'Are you tired? Do you want to rest a bit?',
        hint: 'volere + riposarsi (tu)',
        also: ['Ti vuoi riposare'],
      },
    ],
  },
  {
    id: 25,
    slug: 'reflexive-passato-prossimo',
    title: 'Reflexive verbs in the passato prossimo',
    cefr: 'A2',
    prerequisites: ['reflexive-verbs', 'passato-prossimo-essere'],
    noteMd: `**In short:** In the passato prossimo, reflexive verbs always use **essere**, so the participle agrees with the subject (the person doing the action): *mi sono alzato* (a man), *mi sono alzata* (a woman).

Form: reflexive pronoun + present of *essere* + past participle.

| | a man / men | a woman / women |
|---|---|---|
| io | mi sono alzato | mi sono alzata |
| tu | ti sei alzato | ti sei alzata |
| lui / lei | si è alzato | si è alzata |
| noi | ci siamo alzati | ci siamo alzate |
| voi | vi siete alzati | vi siete alzate |
| loro | si sono alzati | si sono alzate |

The ending works as with *andare*: **-o, -a, -i, -e**, and **-i** for a mixed group.

- *Non* goes before the pronoun: *Non mi sono divertito.*
- Irregular participles stay irregular: *mettersi → mi sono messo*.
- Verbs that mean "each other" work the same way: *Si sono conosciuti a Roma.* (They met in Rome.)

**Watch out:** the verb is not reflexive in English, so learners reach for *avere*: *ho svegliato* means "I woke someone up". For yourself, say *mi sono svegliato* (or *svegliata*). Never *mi ho*.

Examples:
- *Stamattina mi sono svegliata tardi.* (This morning I woke up late.)
- *Vi siete divertiti alla festa?* (Did you have fun at the party?)
- *Luca si è sentito male.* (Luca felt ill.)
- *I miei genitori si sono sposati nel 1990.* (My parents got married in 1990.)`,
    drills: [
      {
        it: 'Stamattina [mi sono svegliata] tardi.',
        en: 'This morning I woke up late.',
        hint: 'svegliarsi (passato prossimo, a woman speaking)',
      },
      {
        it: 'Marco [si è alzato] alle sei.',
        en: 'Marco got up at six.',
        hint: 'alzarsi (passato prossimo)',
      },
      {
        it: 'Giulia [si è vestita] in fretta.',
        en: 'Giulia got dressed in a hurry.',
        hint: 'vestirsi (passato prossimo)',
      },
      {
        it: 'Io e Anna [ci siamo divertite] molto alla festa.',
        en: 'Anna and I had a great time at the party.',
        hint: 'divertirsi (passato prossimo, noi, a woman speaking)',
      },
      {
        it: 'Luca, a che ora [ti sei alzato]?',
        en: 'Luca, what time did you get up?',
        hint: 'alzarsi (passato prossimo, tu)',
      },
      {
        it: 'Ieri [mi sono riposato] tutto il giorno.',
        en: 'Yesterday I rested all day.',
        hint: 'riposarsi (passato prossimo, a man speaking)',
      },
      {
        it: 'Luca [si è sentito] male.',
        en: 'Luca felt ill.',
        hint: 'sentirsi (passato prossimo)',
      },
      {
        it: 'Le bambine [si sono lavate] le mani.',
        en: 'The little girls washed their hands.',
        hint: 'lavarsi (passato prossimo)',
      },
      {
        it: 'I miei genitori [si sono sposati] nel 1990.',
        en: 'My parents got married in 1990.',
        hint: 'sposarsi (passato prossimo)',
      },
      {
        it: 'Ragazze, [vi siete divertite] ieri sera?',
        en: 'Girls, did you have fun last night?',
        hint: 'divertirsi (passato prossimo, voi)',
      },
      {
        it: 'Scusa, non [mi sono ricordata] del tuo compleanno.',
        en: "Sorry, I didn't remember your birthday.",
        hint: 'ricordarsi (passato prossimo, a woman speaking)',
      },
      {
        it: 'Anna e Marco [si sono conosciuti] a Roma.',
        en: 'Anna and Marco met in Rome.',
        hint: 'conoscersi (passato prossimo)',
      },
      {
        it: 'Sara, perché non [ti sei fermata]?',
        en: "Sara, why didn't you stop?",
        hint: 'fermarsi (passato prossimo, tu)',
      },
    ],
  },
  {
    id: 26,
    slug: 'direct-object-pronouns',
    title: 'Direct object pronouns: lo, la, li, le',
    cefr: 'A2',
    prerequisites: ['present-ere-ire', 'definite-articles'],
    noteMd: `**In short:** A direct object pronoun replaces the person or thing that receives the action (the direct object), like English "him", "it", "them": *Conosci Marco? Sì, lo conosco.*

| | singular | plural |
|---|---|---|
| 1st | **mi** (me) | **ci** (us) |
| 2nd | **ti** (you) | **vi** (you all) |
| 3rd masculine | **lo** (him, it) | **li** (them) |
| 3rd feminine | **la** (her, it) | **le** (them) |

Polite "you" (to one person, man or woman) is **La**: *La ringrazio.* (Thank you, formally.)

For things, choose by the noun's gender: *il caffè → lo*, *la pizza → la*, *i libri → li*, *le chiavi → le*.

Where they go:
- **before** the conjugated verb, and after *non*: *Lo conosco. Non lo conosco.*
- **joined to the end** of an infinitive, which drops its final *-e*: *Voglio vederla.* After *dovere, potere, volere* you can also put it first: *La voglio vedere.*

*Lo* and *la* usually become **l'** before a vowel or *h*: *L'aspetto qui. L'ho comprato.* *Li* and *le* never do.

*Lo* also stands for a whole idea: *Non lo so.* (I don't know.)

**Watch out:** English puts the pronoun after the verb ("I know him"), so learners say *Conosco lo*. In Italian it goes before: *Lo conosco*. The only exception at this level is the infinitive: *vederlo*.

Examples:
- *Conosci Marco? Sì, lo conosco.* (Do you know Marco? Yes, I know him.)
- *Dove sono le chiavi? Non le trovo.* (Where are the keys? I can't find them.)
- *Ti aspetto davanti al cinema.* (I'll wait for you outside the cinema.)
- *Voglio vederla stasera.* (I want to see her tonight.)`,
    drills: [
      {
        it: 'Conosci Marco? Sì, [lo] conosco.',
        en: 'Do you know Marco? Yes, I know him.',
        hint: 'him',
      },
      {
        it: 'Dove sono le chiavi? Non [le] trovo.',
        en: "Where are the keys? I can't find them.",
        hint: 'them (le chiavi)',
      },
      {
        it: 'Il caffè? [Lo] prendo senza zucchero.',
        en: 'Coffee? I take it without sugar.',
        hint: 'it (il caffè)',
      },
      {
        it: 'Questa borsa è bella, [la] compro.',
        en: "This bag is nice, I'll buy it.",
        hint: 'it (la borsa)',
      },
      {
        it: 'Questi libri? [Li] leggo in vacanza.',
        en: "These books? I'll read them on holiday.",
        hint: 'them (i libri)',
      },
      { it: 'Marco [mi] chiama ogni sera.', en: 'Marco calls me every evening.', hint: 'me' },
      {
        it: '[Ti] aspetto davanti al cinema.',
        en: "I'll wait for you outside the cinema.",
        hint: 'you (tu)',
      },
      {
        it: 'I nonni [ci] invitano a pranzo.',
        en: 'Our grandparents are inviting us to lunch.',
        hint: 'us',
      },
      { it: 'Ragazzi, [vi] vedo domani!', en: "Guys, I'll see you tomorrow!", hint: 'you (voi)' },
      { it: 'Non [lo] so.', en: "I don't know.", hint: 'it (the idea)' },
      { it: 'Signora, [La] ringrazio.', en: 'Thank you, madam.', hint: 'you (formal Lei)' },
      {
        it: "Anna? [L']aspetto qui.",
        en: "Anna? I'll wait for her here.",
        hint: 'her (before a vowel)',
      },
      {
        it: 'Giulia è simpatica, [voglio vederla] stasera.',
        en: 'Giulia is nice, I want to see her tonight.',
        hint: 'volere + vedere + her (io)',
        also: ['la voglio vedere'],
      },
    ],
  },
  {
    id: 27,
    slug: 'object-pronouns-passato-prossimo',
    title: "Object pronouns with the passato prossimo (l'ho vista)",
    cefr: 'A2',
    prerequisites: ['direct-object-pronouns', 'passato-prossimo-avere'],
    noteMd: `**In short:** With *avere*, the participle normally stays in **-o**. But when **lo, la, li** or **le** comes before the verb, the participle **agrees** with that pronoun: *Hai visto Anna? Sì, l'ho vista.*

The pronoun goes before the auxiliary (*ho, hai, ha*...), and the participle takes its ending:

| pronoun | example | meaning |
|---|---|---|
| lo | l'ho visto | I saw him / it |
| la | l'ho vista | I saw her / it |
| li | li ho visti | I saw them (m.) |
| le | le ho viste | I saw them (f.) |

- *Lo* and *la* shorten to **l'** before *ho, hai, ha, abbiamo, avete, hanno*. *Li* and *le* never shorten.
- Because *l'* hides which one it is, the participle ending tells you: *l'ho visto* (him, it m.), *l'ho vista* (her, it f.).
- With **mi, ti, ci, vi** the agreement is optional: *Anna, chi ti ha chiamata?* or *chi ti ha chiamato?* Both are correct.
- *Non* goes first, and *già*, *mai* still sit before the participle: *Non l'ho mai vista.*

**Watch out:** learners forget the agreement because nothing in English shows it. *Le chiavi? Le ho preso* is wrong: say *Le ho prese*. Look back at the noun the pronoun replaces to find the ending.

Examples:
- *La pizza? L'abbiamo già mangiata.* (The pizza? We've already eaten it.)
- *Hai comprato i biglietti? Sì, li ho comprati.* (Did you buy the tickets? Yes, I bought them.)
- *Le lettere? Le ho scritte ieri.* (The letters? I wrote them yesterday.)
- *Non li ho visti.* (I didn't see them.)`,
    drills: [
      {
        it: "Hai visto Anna? Sì, [l'ho vista].",
        en: 'Have you seen Anna? Yes, I saw her.',
        hint: 'vedere + her (io)',
      },
      {
        it: "Il film? [L'ho visto] due volte.",
        en: "The film? I've seen it twice.",
        hint: 'vedere + it (il film, io)',
      },
      {
        it: 'Hai comprato i biglietti? Sì, [li ho comprati].',
        en: 'Did you buy the tickets? Yes, I bought them.',
        hint: 'comprare + them (io)',
      },
      {
        it: 'Le lettere? [Le ho scritte] ieri.',
        en: 'The letters? I wrote them yesterday.',
        hint: 'scrivere + them (io)',
      },
      {
        it: "Il libro? Non [l'ho letto].",
        en: "The book? I haven't read it.",
        hint: 'leggere + it (io)',
      },
      {
        it: 'I tuoi amici? Non [li ho visti].',
        en: "Your friends? I didn't see them.",
        hint: 'vedere + them (io)',
      },
      {
        it: "La pizza? [L'abbiamo già mangiata].",
        en: "The pizza? We've already eaten it.",
        hint: 'mangiare + it (noi) + già',
      },
      {
        it: 'Le chiavi? [Le hai prese] tu?',
        en: 'The keys? Did you take them?',
        hint: 'prendere + them (tu)',
      },
      {
        it: "Marco? [L'hanno chiamato] ieri.",
        en: 'Marco? They called him yesterday.',
        hint: 'chiamare + him (loro)',
      },
      {
        it: 'Le foto? [Le abbiamo viste] ieri sera.',
        en: 'The photos? We saw them last night.',
        hint: 'vedere + them (noi)',
      },
      {
        it: 'La mamma [ci ha accompagnati] alla stazione.',
        en: 'Mum took us to the station.',
        hint: 'accompagnare + us (a mixed group)',
        also: ['ci ha accompagnato'],
      },
      {
        it: 'Giulia, chi [ti ha chiamata]?',
        en: 'Giulia, who called you?',
        hint: 'chiamare + you (tu)',
        also: ['ti ha chiamato'],
      },
    ],
  },
  {
    id: 28,
    slug: 'indirect-object-pronouns',
    title: 'Indirect object pronouns: gli, le',
    cefr: 'A2',
    prerequisites: ['direct-object-pronouns', 'piacere'],
    noteMd: `**In short:** An indirect object pronoun means "to someone" or "for someone": *Gli telefono* (I phone him, literally "I phone to him"). You use it with verbs of giving, telling and sending.

| | singular | plural |
|---|---|---|
| 1st | **mi** (to me) | **ci** (to us) |
| 2nd | **ti** (to you) | **vi** (to you all) |
| 3rd | **gli** (to him), **le** (to her) | **gli** (to them) |

Polite "to you" is **Le**: *Le posso fare una domanda?*

For "to them", everyday Italian uses **gli**. Formal writing uses *loro* after the verb: *Ho scritto loro.*

Where they go: like direct object pronouns, **before** the conjugated verb, after *non*, and **joined to an infinitive**: *Devo dirgli una cosa* (or *Gli devo dire una cosa*).

Common verbs that take an indirect object (with *a* + person): *dare, dire, telefonare, scrivere, chiedere, rispondere, mandare, regalare, raccontare*, and *piacere*: *Le piace il gelato.* (She likes ice cream.)

With these pronouns the participle does **not** agree: *Le ho dato un regalo.*

**Watch out:** don't mix up *le* (to her) and *la* (her). *Telefonare* takes "to" in Italian (*telefonare ad Anna*), so it is *Le telefono*, not *La telefono*. And remember that *gli* is "to him", not "him": *Lo vedo* (I see him), but *Gli parlo* (I speak to him).

Examples:
- *Gli telefono stasera.* (I'll call him tonight.)
- *Le ho dato un regalo.* (I gave her a present.)
- *Mi dici la verità?* (Will you tell me the truth?)
- *Signora, Le posso fare una domanda?* (Madam, may I ask you a question?)`,
    drills: [
      {
        it: 'Marco è a casa? [Gli] telefono stasera.',
        en: "Is Marco at home? I'll call him tonight.",
        hint: 'to him',
      },
      {
        it: 'Era il compleanno di Anna e [le] ho dato un regalo.',
        en: "It was Anna's birthday and I gave her a present.",
        hint: 'to her',
      },
      { it: '[Mi] dici la verità?', en: 'Will you tell me the truth?', hint: 'to me' },
      { it: '[Ti] scrivo domani.', en: "I'll write to you tomorrow.", hint: 'to you (tu)' },
      {
        it: 'Ragazzi, [vi] mando le foto stasera.',
        en: "Guys, I'll send you the photos tonight.",
        hint: 'to you (voi)',
      },
      { it: 'Il film [ci] è piaciuto molto.', en: 'We really liked the film.', hint: 'to us' },
      { it: 'Anna non [mi] risponde.', en: "Anna isn't answering me.", hint: 'to me' },
      {
        it: 'Giulia è a dieta, ma [le] piace troppo il gelato.',
        en: 'Giulia is on a diet, but she likes ice cream too much.',
        hint: 'to her',
      },
      {
        it: 'Cosa regali a Paolo? [Gli] regalo un libro.',
        en: "What are you giving Paolo? I'm giving him a book.",
        hint: 'to him',
      },
      {
        it: 'Ho visto i miei cugini e [gli] ho raccontato tutto.',
        en: 'I saw my cousins and told them everything.',
        hint: 'to them (everyday Italian)',
      },
      { it: 'Non [ti] ho chiesto niente.', en: "I didn't ask you anything.", hint: 'to you (tu)' },
      {
        it: 'Signor Rossi, [Le] posso fare una domanda?',
        en: 'Mr Rossi, may I ask you a question?',
        hint: 'to you (formal Lei)',
      },
      {
        it: 'Luca aspetta una risposta. [Puoi dirgli] di venire?',
        en: 'Luca is waiting for an answer. Can you tell him to come?',
        hint: 'potere + dire + to him (tu)',
        also: ['Gli puoi dire'],
      },
    ],
  },
  {
    id: 47,
    slug: 'stressed-pronouns',
    title: 'Pronouns after prepositions: con me, per te, a lui',
    cefr: 'A2',
    prerequisites: ['indirect-object-pronouns'],
    noteMd: `**In short:** After a preposition (a small linking word like *con*, *per*, *di*, *a*, *da*), Italian uses a separate set of pronouns: *con me* (with me), *per te* (for you), *a lui* (to him).

| | singular | plural |
|---|---|---|
| 1st | **me** | **noi** |
| 2nd | **te** | **voi** |
| 3rd | **lui** (him), **lei** (her) | **loro** (them) |

Polite "you" is **Lei**: *Questo è per Lei.*

Only *me* and *te* are new; the rest look like subject pronouns (*io, tu, lui*...).

Use them:
- **after any preposition**: *con me, per te, di lui, senza di voi, tra noi, secondo te* (in your opinion)
- with **da** to mean "at someone's place": *da me* (at my place), *da noi*
- **for emphasis or contrast**, after the verb, instead of the short pronoun: *Hanno invitato me, non lui!* (They invited me, not him!)
- with *piacere* for emphasis: *A me piace il mare, e a te?* (I like the sea, and you?)

With *senza*, *dopo* and *dentro*, add *di* before a pronoun: *senza di te*, *dopo di me*.

**Watch out:** after a preposition, never use *io* or *tu*: *con io* and *per tu* are wrong; say *con me*, *per te*. And don't double up: *A me mi piace* is common in speech but avoided in careful Italian. Say *A me piace* or *Mi piace*.

Examples:
- *Vieni al cinema con me?* (Are you coming to the cinema with me?)
- *Questo regalo è per te.* (This present is for you.)
- *Stasera venite da noi?* (Are you coming to our place tonight?)
- *Secondo te, è giusto?* (In your opinion, is it fair?)`,
    drills: [
      {
        it: 'Vieni al cinema con [me]?',
        en: 'Are you coming to the cinema with me?',
        hint: 'me (after con)',
      },
      {
        it: 'Questo regalo è per [te].',
        en: 'This present is for you.',
        hint: 'you (tu, after per)',
      },
      {
        it: 'Esci con Marco? Sì, esco con [lui].',
        en: "Are you going out with Marco? Yes, I'm going out with him.",
        hint: 'him (after con)',
      },
      { it: 'Parliamo spesso di [lei].', en: 'We often talk about her.', hint: 'her (after di)' },
      { it: 'Abito vicino a [loro].', en: 'I live near them.', hint: 'them (after a)' },
      {
        it: 'Stasera venite da [noi]?',
        en: 'Are you coming to our place tonight?',
        hint: 'us (at our place)',
      },
      {
        it: 'Senza di [voi] non è una festa.',
        en: "Without you it's not a party.",
        hint: 'you (voi, after senza di)',
      },
      {
        it: 'Signora, questo è per [Lei].',
        en: 'Madam, this is for you.',
        hint: 'you (formal, after per)',
      },
      {
        it: 'Secondo [te], è giusto?',
        en: 'In your opinion, is it fair?',
        hint: 'you (tu, after secondo)',
      },
      {
        it: '[A me] piace il mare, e a te?',
        en: 'I like the sea, and you?',
        hint: 'to me (stressed, for emphasis)',
      },
      { it: 'A [lui] non piace il pesce.', en: "He doesn't like fish.", hint: 'him (after a)' },
      {
        it: 'Hanno invitato [me], non lui!',
        en: 'They invited me, not him!',
        hint: 'me (stressed, for contrast)',
      },
      {
        it: 'Tra [noi] non ci sono segreti.',
        en: 'There are no secrets between us.',
        hint: 'us (after tra)',
      },
    ],
  },
  {
    id: 48,
    slug: 'sapere-conoscere',
    title: 'Sapere or conoscere? (to know)',
    cefr: 'A2',
    prerequisites: ['irregular-present'],
    noteMd: `**In short:** English "to know" has two Italian verbs. **Sapere** is knowing a fact or how to do something. **Conoscere** is knowing (being familiar with) a person, a place or a thing.

**Sapere** (irregular): *so, sai, sa, sappiamo, sapete, sanno*
- facts, often followed by *che, dove, quando, se, come*...: *Non so dove abita.* (I don't know where he lives.)
- **sapere + infinitive** = "can, know how to": *Sai nuotare?* (Can you swim?)
- on its own: *Lo so.* (I know.) *Non lo so.* (I don't know.)

**Conoscere** (regular -ere verb): *conosco, conosci, conosce, conosciamo, conoscete, conoscono*
- people: *Conosci Giulia?*
- places: *Conosco bene Roma.* (I know Rome well.)
- things you have come across: a song, a book, a restaurant: *Conoscete questa canzone?*

Note the sound: *conosco* and *conoscono* have a hard "sk", the other forms a soft "sh".

In the passato prossimo, both change meaning a little:
- *ho conosciuto* = I **met** (for the first time): *Ieri ho conosciuto la ragazza di Luca.*
- *ho saputo* = I **found out**, I heard: *Come hai saputo la notizia?*

**Watch out:** English speakers use *conoscere* for facts: *Conosco che è vero* is wrong; say *So che è vero*. Quick test: if "know" is followed by a clause (that, where, if...) or a verb, use *sapere*; if it is followed by a person or a place, use *conoscere*.

Examples:
- *Non so dove abita Marco.* (I don't know where Marco lives.)
- *Conosci Giulia?* (Do you know Giulia?)
- *Sai cucinare?* (Can you cook?)
- *Ho conosciuto Anna a Roma.* (I met Anna in Rome.)`,
    drills: [
      {
        it: 'Non [so] dove abita Marco.',
        en: "I don't know where Marco lives.",
        hint: 'sapere or conoscere (io)',
      },
      { it: '[Conosci] Giulia?', en: 'Do you know Giulia?', hint: 'sapere or conoscere (tu)' },
      { it: '[Sai] nuotare?', en: 'Can you swim?', hint: 'sapere or conoscere (tu)' },
      {
        it: 'Mia madre [conosce] bene Roma.',
        en: 'My mother knows Rome well.',
        hint: 'sapere or conoscere',
      },
      {
        it: 'Scusate, [sapete] che ore sono?',
        en: 'Excuse me, do you know what time it is?',
        hint: 'sapere or conoscere (voi)',
      },
      {
        it: 'Non [conosciamo] nessuno qui.',
        en: "We don't know anybody here.",
        hint: 'sapere or conoscere (noi)',
      },
      {
        it: 'I miei cugini [sanno] parlare tre lingue.',
        en: 'My cousins can speak three languages.',
        hint: 'sapere or conoscere (loro)',
      },
      {
        it: 'Non dire niente, [sappiamo] già tutto.',
        en: "Don't say anything, we already know everything.",
        hint: 'sapere or conoscere (noi)',
      },
      {
        it: 'I miei genitori [conoscono] un buon ristorante qui vicino.',
        en: 'My parents know a good restaurant near here.',
        hint: 'sapere or conoscere (loro)',
      },
      {
        it: 'Giulia [sa] cucinare molto bene.',
        en: 'Giulia can cook really well.',
        hint: 'sapere or conoscere',
      },
      {
        it: '[Conoscete] questa canzone?',
        en: 'Do you know this song?',
        hint: 'sapere or conoscere (voi)',
      },
      {
        it: 'Ieri sera [ho conosciuto] la ragazza di Luca.',
        en: "Last night I met Luca's girlfriend.",
        hint: 'conoscere (passato prossimo, io: met)',
      },
      {
        it: 'Come [hai saputo] la notizia?',
        en: 'How did you find out the news?',
        hint: 'sapere (passato prossimo, tu: found out)',
      },
    ],
  },
  {
    id: 29,
    slug: 'imperfetto-essere-avere',
    title: "Imperfetto first: era, aveva, c'era",
    cefr: 'A2',
    prerequisites: ['passato-prossimo-essere'],
    noteMd: `**In short:** The imperfetto is a past tense for describing: what things were like, what people had, what there was. Start with *essere*, *avere* and *c'era*, the forms you will use most.

| | essere (was, were) | avere (had) |
|---|---|---|
| io | ero | avevo |
| tu | eri | avevi |
| lui / lei | era | aveva |
| noi | eravamo | avevamo |
| voi | eravate | avevate |
| loro | erano | avevano |

**C'era** (there was) and **c'erano** (there were) are the past of *c'è* and *ci sono*: *C'era molta gente.*

Use them for:
- descriptions of people, places and things: *La casa era vecchia.*
- age, feelings and physical states: *Avevo dieci anni. Ero stanco. Avevamo fame.*
- time and weather in the past: *Erano le otto.*
- how things used to be: *Da bambino ero timido.*

The passato prossimo of *essere* (*sono stato*) is for a finished, limited experience: *Sono stato a Roma.* (I've been to Rome.) For what something was like, use the imperfetto: *Roma era bellissima.*

**Watch out:** English "was" is the same for both, so learners say *È stato stanco* for "he was tired". For descriptions and states, use the imperfetto: *Era stanco.* Watch the stress too: *èrano*, *avèvano*, not *eràno*.

Examples:
- *Quando ero piccolo, avevo un cane.* (When I was little, I had a dog.)
- *C'era molta gente.* (There were lots of people.)
- *La casa era vecchia.* (The house was old.)
- *Avevamo fame e sonno.* (We were hungry and sleepy.)`,
    drills: [
      {
        it: 'Quando ero piccolo, [avevo] un cane.',
        en: 'When I was little, I had a dog.',
        hint: 'avere (imperfetto, io)',
      },
      {
        it: 'Da bambina [ero] molto timida.',
        en: 'As a child I was very shy.',
        hint: 'essere (imperfetto, io)',
      },
      {
        it: 'La casa dei nonni [era] vecchia.',
        en: "My grandparents' house was old.",
        hint: 'essere (imperfetto)',
      },
      {
        it: "[C'era] un bar vicino alla stazione.",
        en: 'There was a bar near the station.',
        hint: 'there was',
      },
      {
        it: "[C'erano] molte persone alla festa.",
        en: 'There were lots of people at the party.',
        hint: 'there were',
      },
      {
        it: 'Da piccolo [avevi] paura del buio?',
        en: 'When you were little, were you afraid of the dark?',
        hint: 'avere (imperfetto, tu)',
      },
      {
        it: 'Tu [eri] sempre allegro.',
        en: 'You were always cheerful.',
        hint: 'essere (imperfetto, tu)',
      },
      {
        it: 'Ieri sera [eravamo] molto stanchi.',
        en: 'Last night we were very tired.',
        hint: 'essere (imperfetto, noi)',
      },
      {
        it: 'Noi [avevamo] una piccola casa al mare.',
        en: 'We had a little house by the sea.',
        hint: 'avere (imperfetto, noi)',
      },
      {
        it: 'Ragazzi, [eravate] a casa ieri sera?',
        en: 'Guys, were you at home last night?',
        hint: 'essere (imperfetto, voi)',
      },
      {
        it: '[Avevate] fame dopo la partita?',
        en: 'Were you hungry after the match?',
        hint: 'avere (imperfetto, voi)',
      },
      {
        it: 'I miei nonni [erano] contadini.',
        en: 'My grandparents were farmers.',
        hint: 'essere (imperfetto, loro)',
      },
      {
        it: 'I bambini [avevano] sonno.',
        en: 'The children were sleepy.',
        hint: 'avere (imperfetto, loro)',
      },
    ],
  },
  {
    id: 30,
    slug: 'imperfetto',
    title: 'Imperfetto: regular forms and uses',
    cefr: 'A2',
    prerequisites: ['imperfetto-essere-avere'],
    noteMd: `**In short:** The imperfetto is the past tense for habits ("used to"), descriptions and actions that were in progress. It translates "I used to play", "I was playing", and often just "I played".

To form it, take the infinitive, drop **-re**, and add **-vo, -vi, -va, -vamo, -vate, -vano**. The endings are the same for all three verb groups.

| | parlare | leggere | dormire |
|---|---|---|---|
| io | parlavo | leggevo | dormivo |
| tu | parlavi | leggevi | dormivi |
| lui / lei | parlava | leggeva | dormiva |
| noi | parlavamo | leggevamo | dormivamo |
| voi | parlavate | leggevate | dormivate |
| loro | parlavano | leggevano | dormivano |

Very few verbs are irregular: *fare → facevo*, *dire → dicevo*, *bere → bevevo* (and *essere → ero*, seen before). Verbs like *capire* have no *-isc-*: *capivo*.

Use it for:
- **habits**, what used to happen: *Da bambino giocavo sempre a calcio.*
- **descriptions** of people, weather, time and feelings: *Faceva freddo.*
- **actions in progress**, often with *mentre* (while): *Mentre dormivo, pioveva.*

**Watch out:** English "I played" can be a single event or a habit. Use the imperfetto only for the habit or the background: *Ogni estate andavamo al mare* (every summer we went), but *L'estate scorsa siamo andati al mare* (last summer we went, once).

Examples:
- *Ogni estate andavamo al mare.* (Every summer we went to the seaside.)
- *Mentre dormivo, pioveva.* (While I was sleeping, it was raining.)
- *Faceva molto freddo.* (It was very cold.)
- *Da giovane mio padre beveva molto caffè.* (When he was young, my father drank a lot of coffee.)`,
    drills: [
      {
        it: 'Da bambino [giocavo] sempre a calcio.',
        en: 'As a child I always played football.',
        hint: 'giocare (imperfetto, io)',
      },
      {
        it: 'Ogni estate [andavamo] al mare.',
        en: 'Every summer we went to the seaside.',
        hint: 'andare (imperfetto, noi)',
      },
      {
        it: 'Quel giorno [faceva] molto freddo.',
        en: 'That day it was very cold.',
        hint: 'fare (imperfetto)',
      },
      {
        it: 'Mentre [dormivo], pioveva.',
        en: 'While I was sleeping, it was raining.',
        hint: 'dormire (imperfetto, io)',
      },
      {
        it: 'Quando sono uscito, [pioveva].',
        en: 'When I went out, it was raining.',
        hint: 'piovere (imperfetto)',
      },
      {
        it: 'Che cosa [leggevi] da piccolo?',
        en: 'What did you use to read when you were little?',
        hint: 'leggere (imperfetto, tu)',
      },
      {
        it: "Tu [prendevi] sempre l'autobus delle otto.",
        en: "You always took the eight o'clock bus.",
        hint: 'prendere (imperfetto, tu)',
      },
      {
        it: 'Mia nonna [cucinava] molto bene.',
        en: 'My grandmother cooked very well.',
        hint: 'cucinare (imperfetto)',
      },
      {
        it: 'Da giovane mio padre [beveva] molto caffè.',
        en: 'When he was young, my father drank a lot of coffee.',
        hint: 'bere (imperfetto)',
      },
      {
        it: 'Quando eravamo piccoli, [dormivamo] nel pomeriggio.',
        en: 'When we were little, we slept in the afternoon.',
        hint: 'dormire (imperfetto, noi)',
      },
      {
        it: 'Da bambini [dicevate] sempre la verità?',
        en: 'As children, did you always tell the truth?',
        hint: 'dire (imperfetto, voi)',
      },
      {
        it: 'I miei genitori [lavoravano] in un negozio.',
        en: 'My parents worked in a shop.',
        hint: 'lavorare (imperfetto, loro)',
      },
      {
        it: 'Il professore parlava piano e gli studenti [capivano] tutto.',
        en: 'The teacher spoke slowly and the students understood everything.',
        hint: 'capire (imperfetto, loro)',
      },
    ],
  },
  {
    id: 31,
    slug: 'passato-prossimo-vs-imperfetto',
    title: 'Passato prossimo or imperfetto?',
    cefr: 'A2',
    prerequisites: ['imperfetto', 'passato-prossimo-essere'],
    noteMd: `**In short:** Both are past tenses. The **passato prossimo** tells what happened, an event that is finished. The **imperfetto** describes the scene around it: what was going on, what things were like, what used to happen.

**Passato prossimo**: a completed event, a point on the timeline.
- single events: *Ieri ho visto Marco.*
- events with a clear limit, even a long one: *Ho studiato per tre ore. Ho abitato a Roma per due anni.*
- a series of events, one after another: *Sono arrivato, ho mangiato e sono uscito.*

**Imperfetto**: the background, with no focus on the end.
- descriptions, states, feelings, age, time, weather: *Marco era stanco. Pioveva.*
- habits: *Da piccolo andavo sempre dai nonni.*
- an action in progress when something else happened: *Mentre cucinavo, ha suonato il telefono.*

A story mixes both: the imperfetto sets the scene and the passato prossimo moves the action forward.

*Pioveva e non c'era nessuno. All'improvviso è arrivato un treno.* (It was raining and there was nobody. Suddenly a train arrived.)

Useful signals: *ieri, una volta, all'improvviso, per due ore* suggest the passato prossimo; *sempre, ogni giorno, di solito, mentre, da bambino* suggest the imperfetto.

**Watch out:** a long time is not a reason for the imperfetto. If the period is closed (*per tre ore*, *tutta la mattina*, *dal 2010 al 2015*), use the passato prossimo: *Ho dormito tutta la mattina.* Use the imperfetto when you describe the situation, not when you measure it.

Examples:
- *Mentre cucinavo, ha suonato il telefono.* (While I was cooking, the phone rang.)
- *Da piccola Giulia aveva i capelli lunghi.* (As a little girl Giulia had long hair.)
- *L'anno scorso siamo andati in Spagna.* (Last year we went to Spain.)
- *Quando sono arrivato, Anna dormiva.* (When I arrived, Anna was sleeping.)`,
    drills: [
      {
        it: 'Ieri [ho visto] Marco al bar.',
        en: 'Yesterday I saw Marco at the café.',
        hint: 'vedere (passato prossimo or imperfetto, io)',
      },
      {
        it: 'Quando ero piccolo, [andavo] sempre dai nonni.',
        en: "When I was little, I always went to my grandparents'.",
        hint: 'andare (passato prossimo or imperfetto, io)',
      },
      {
        it: 'Mentre cucinavo, [ha suonato] il telefono.',
        en: 'While I was cooking, the phone rang.',
        hint: 'suonare (passato prossimo or imperfetto)',
      },
      {
        it: "[Pioveva] e non c'era nessuno.",
        en: 'It was raining and there was nobody around.',
        hint: 'piovere (passato prossimo or imperfetto)',
      },
      {
        it: "All'improvviso [è arrivato] un treno.",
        en: 'Suddenly a train arrived.',
        hint: 'arrivare (passato prossimo or imperfetto)',
      },
      {
        it: "L'anno scorso [siamo andati] in Spagna.",
        en: 'Last year we went to Spain.',
        hint: 'andare (passato prossimo or imperfetto, noi)',
      },
      {
        it: 'Da piccola Giulia [aveva] i capelli lunghi.',
        en: 'As a little girl Giulia had long hair.',
        hint: 'avere (passato prossimo or imperfetto)',
      },
      {
        it: 'Ogni domenica mia madre [faceva] le lasagne.',
        en: 'Every Sunday my mother made lasagne.',
        hint: 'fare (passato prossimo or imperfetto)',
      },
      {
        it: 'Mentre [guardavo] la TV, mi ha chiamato Anna.',
        en: 'While I was watching TV, Anna called me.',
        hint: 'guardare (passato prossimo or imperfetto, io)',
      },
      {
        it: 'Quando sono arrivato, Anna [dormiva].',
        en: 'When I arrived, Anna was sleeping.',
        hint: 'dormire (passato prossimo or imperfetto)',
      },
      {
        it: 'Marco [era] stanco, così è andato a letto.',
        en: 'Marco was tired, so he went to bed.',
        hint: 'essere (passato prossimo or imperfetto)',
      },
      {
        it: "Stamattina [ho perso] l'autobus.",
        en: 'This morning I missed the bus.',
        hint: 'perdere (passato prossimo or imperfetto, io)',
      },
      {
        it: 'Ieri [ho studiato] per tre ore.',
        en: 'Yesterday I studied for three hours.',
        hint: 'studiare (passato prossimo or imperfetto, io)',
      },
    ],
  },
  {
    id: 49,
    slug: 'irregular-plurals',
    title: 'Irregular plurals: uomini, uova, amici, mani',
    cefr: 'A2',
    prerequisites: ['noun-gender-number'],
    noteMd: `**In short:** Most nouns form the plural with *-i* or *-e*, but some groups change their spelling, some are completely irregular, and some never change.

**Spelling changes** (to keep or change the sound):
- **-ca, -ga → -che, -ghe** (always): *amica → amiche*, *riga → righe*
- **-co, -go → -chi, -ghi** when the stress (the strong syllable) is just before the ending: *tedesco → tedeschi*, *albergo → alberghi*; but **-ci** when the stress is earlier: *medico → medici*. Learn *amico → amici* and *greco → greci* as exceptions.
- **-cia, -gia** (unstressed *i*): keep the *i* after a vowel (*camicia → camicie*), drop it after a consonant (*arancia → arance*); a stressed *i* always stays (*farmacia → farmacie*)
- **-io**: one *i* when the *i* is not stressed (*negozio → negozi*), two when it is (*zio → zii*)

**Never change** (same in the plural; only the article shows it):
- nouns ending in an accented vowel: *la città → le città*
- nouns ending in a consonant, often borrowed: *il film → i film*, *il bar → i bar*
- shortened words: *la foto → le foto*, *la moto*, *l'auto*
- nouns in *-i*: *la crisi → le crisi*

**Completely irregular:**
- *l'uomo → gli uomini* (man, men)
- *la mano → le mani* (hand, feminine though it ends in *-o*)
- some body parts and *uovo* become **feminine in -a**: *l'uovo → le uova*, *il braccio → le braccia*, *il dito → le dita*, *il labbro → le labbra*

**Watch out:** don't add an English-style *-s*. The plural of *film* is *film*, and of *foto* is *foto*. And with *uova* or *braccia*, the article and adjectives turn feminine: *le uova fresche*.

Examples:
- *Ho tanti amici a Roma.* (I have lots of friends in Rome.)
- *Compro sei uova.* (I'm buying six eggs.)
- *Ho le mani fredde.* (My hands are cold.)
- *Abbiamo visitato molte città.* (We visited lots of cities.)`,
    drills: [
      {
        it: 'Ho tanti [amici] a Roma.',
        en: 'I have lots of friends in Rome.',
        hint: 'amico (plural)',
      },
      {
        it: 'Le mie [amiche] sono simpatiche.',
        en: 'My (female) friends are nice.',
        hint: 'amica (plural)',
      },
      {
        it: 'Marco e Luca sono due [medici].',
        en: 'Marco and Luca are two doctors.',
        hint: 'medico (plural)',
      },
      {
        it: 'Ci sono due [alberghi] in centro.',
        en: 'There are two hotels in the centre.',
        hint: 'albergo (plural)',
      },
      {
        it: 'In questo bar ci sono molti turisti [tedeschi].',
        en: 'There are lots of German tourists in this bar.',
        hint: 'tedesco (masculine plural)',
      },
      { it: 'Ho comprato due [camicie].', en: 'I bought two shirts.', hint: 'camicia (plural)' },
      { it: 'Mi piacciono le [arance].', en: 'I like oranges.', hint: 'arancia (plural)' },
      {
        it: 'Ci sono molti [negozi] in questa strada.',
        en: 'There are lots of shops on this street.',
        hint: 'negozio (plural)',
      },
      {
        it: 'Gli [zii] arrivano domani.',
        en: 'My aunt and uncle are arriving tomorrow.',
        hint: 'zio (plural)',
      },
      {
        it: 'Quanti [uomini] ci sono nella squadra?',
        en: 'How many men are there on the team?',
        hint: 'uomo (plural)',
      },
      { it: 'Compro sei [uova].', en: "I'm buying six eggs.", hint: 'uovo (plural)' },
      { it: 'Ho le [mani] fredde.', en: 'My hands are cold.', hint: 'mano (plural)' },
      {
        it: 'Dopo la palestra mi fanno male le [braccia].',
        en: 'After the gym my arms hurt.',
        hint: 'braccio (plural)',
      },
      {
        it: 'Abbiamo visitato molte [città].',
        en: 'We visited lots of cities.',
        hint: 'città (plural)',
      },
      {
        it: 'Ho fatto tante [foto] in vacanza.',
        en: 'I took lots of photos on holiday.',
        hint: 'foto (plural)',
      },
    ],
  },
  {
    id: 50,
    slug: 'bello-quello-forms',
    title: 'Bello, quello and buono before a noun',
    cefr: 'A2',
    prerequisites: ['demonstratives'],
    noteMd: `**In short:** Before a noun, *quello* (that) and *bello* (beautiful, nice) change their ending exactly like the definite article (*il, lo, l', la, i, gli, le*). *Buono* (good) changes like the indefinite article (*un, uno, una, un'*).

| article | quello | bello |
|---|---|---|
| il | quel ragazzo | bel ragazzo |
| lo | quello studente | bello zaino |
| l' | quell'albero | bell'uomo |
| la | quella casa | bella casa |
| i | quei libri | bei libri |
| gli | quegli zaini | begli occhi |
| le | quelle scarpe | belle scarpe |

**Buono** before a singular noun:
- *buon* (like *un*): *buon viaggio, buon appetito, un buon amico*
- *buono* (like *uno*, before s + consonant, z): *un buono stipendio*
- *buona*, *buon'* (like *una, un'*): *una buona idea, una buon'amica*

In the plural, *buono* is regular: *buoni amici, buone idee*.

These short forms are used only **before** the noun. After the noun or after a verb (like *è*), use the normal adjective: *Quel ragazzo è bello. Questo vino è buono.* As a pronoun (on its own), *quello* keeps its full forms: *Quale vuoi? Quello.* (Which do you want? That one.)

**Watch out:** English "that" and "beautiful" never change, so learners write *quello ragazzo* or *bello giardino*. Think of the article first: *il ragazzo → quel ragazzo*, *il giardino → bel giardino*, *gli occhi → begli occhi*.

Examples:
- *Quel ragazzo è mio fratello.* (That boy is my brother.)
- *Che bella giornata!* (What a lovely day!)
- *Di chi sono quegli zaini?* (Whose are those backpacks?)
- *Buon appetito!* (Enjoy your meal!)`,
    drills: [
      {
        it: '[Quel] ragazzo è mio fratello.',
        en: 'That boy is my brother.',
        hint: 'quello (+ ragazzo)',
      },
      { it: 'Ti piace [quella] borsa?', en: 'Do you like that bag?', hint: 'quello (+ borsa)' },
      { it: 'Chi è [quello] studente?', en: 'Who is that student?', hint: 'quello (+ studente)' },
      {
        it: "[Quell']albero è molto vecchio.",
        en: 'That tree is very old.',
        hint: 'quello (+ albero)',
      },
      { it: '[Quei] libri sono miei.', en: 'Those books are mine.', hint: 'quello (+ libri)' },
      {
        it: 'Di chi sono [quegli] zaini?',
        en: 'Whose are those backpacks?',
        hint: 'quello (+ zaini)',
      },
      {
        it: '[Quelle] scarpe sono troppo care.',
        en: 'Those shoes are too expensive.',
        hint: 'quello (+ scarpe)',
      },
      { it: 'Che [bel] giardino!', en: 'What a lovely garden!', hint: 'bello (+ giardino)' },
      { it: 'Che [bella] giornata!', en: 'What a lovely day!', hint: 'bello (+ giornata)' },
      {
        it: "Suo padre è un [bell']uomo.",
        en: 'Her father is a handsome man.',
        hint: 'bello (+ uomo)',
      },
      {
        it: 'In centro ci sono molti [bei] negozi.',
        en: 'There are lots of nice shops in the centre.',
        hint: 'bello (+ negozi)',
      },
      { it: 'Che [begli] occhi!', en: 'What beautiful eyes!', hint: 'bello (+ occhi)' },
      {
        it: 'Queste mele sono [belle].',
        en: 'These apples are nice.',
        hint: 'bello (after the verb)',
      },
      { it: '[Buon] appetito!', en: 'Enjoy your meal!', hint: 'buono (+ appetito)' },
      { it: "Sara è una [buon']amica.", en: 'Sara is a good friend.', hint: 'buono (+ amica)' },
    ],
  },
  {
    id: 51,
    slug: 'indefinites',
    title: 'Some, every, all: qualche, alcuni, ogni, tutto',
    cefr: 'A2',
    prerequisites: ['indefinite-articles'],
    noteMd: `**In short:** Indefinites are words for vague amounts and groups: "some", "every", "all", "someone", "something". Each Italian word has its own rule about singular and plural.

**"Some", "a few"**:
- **qualche** + **singular** noun (but plural meaning); it never changes: *qualche amico* (some friends), *qualche volta* (sometimes)
- **alcuni** (masculine) / **alcune** (feminine) + **plural** noun: *alcuni libri, alcune persone*

**"Every", "each"**:
- **ogni** + **singular** noun; it never changes: *ogni giorno* (every day), *ogni settimana*

**"All", "the whole"**:
- **tutto** agrees with the noun and is followed by the **article**: *tutto il giorno* (all day), *tutta la torta*, *tutti i miei amici*, *tutte le ragazze*
- *tutti* on its own means "everybody": *Sono arrivati tutti.*

**Pronouns** (standing on their own):
- *qualcuno* (someone, anyone), *qualcosa* (something, anything), *ognuno* (each one), *tutto* (everything)

| meaning | + singular | + plural |
|---|---|---|
| some | qualche | alcuni, alcune |
| every, each | ogni | (tutti i, tutte le) |
| all | tutto il, tutta la | tutti i, tutte le |

**Watch out:** *qualche* and *ogni* look as if they could take a plural, but they never do: *qualche libro*, not *qualche libri*; *ogni giorno*, not *ogni giorni*. And don't drop the article after *tutto*: *tutti i giorni*, not *tutti giorni*.

Examples:
- *Ho qualche amico a Roma.* (I have a few friends in Rome.)
- *Ogni giorno vado in palestra.* (Every day I go to the gym.)
- *Ho lavorato tutto il giorno.* (I worked all day.)
- *Vuoi qualcosa da bere?* (Would you like something to drink?)`,
    drills: [
      {
        it: 'Ho [qualche] amico a Roma.',
        en: 'I have a few friends in Rome.',
        hint: 'some (+ singular noun)',
      },
      {
        it: 'Fuori ci sono [alcune] persone.',
        en: 'There are some people outside.',
        hint: 'some (+ feminine plural noun)',
      },
      {
        it: 'Ho comprato [alcuni] libri per le vacanze.',
        en: 'I bought some books for the holidays.',
        hint: 'some (alcuno, + masculine plural noun)',
      },
      { it: '[Ogni] giorno vado in palestra.', en: 'Every day I go to the gym.', hint: 'every' },
      {
        it: 'Il treno per Milano parte [ogni] ora.',
        en: 'The train to Milan leaves every hour.',
        hint: 'every',
      },
      {
        it: 'Ieri ho lavorato [tutto il] giorno.',
        en: 'Yesterday I worked all day.',
        hint: 'all, the whole (+ giorno)',
      },
      {
        it: 'Chi ha mangiato [tutta la] torta?',
        en: 'Who ate the whole cake?',
        hint: 'all, the whole (+ torta)',
      },
      {
        it: '[Tutti i] miei amici sono qui.',
        en: 'All my friends are here.',
        hint: 'all (+ miei amici)',
      },
      {
        it: '[Tutte le] ragazze ballano.',
        en: 'All the girls are dancing.',
        hint: 'all (+ ragazze)',
      },
      { it: '[Qualcuno] ha chiamato?', en: 'Did anyone call?', hint: 'someone, anyone' },
      {
        it: 'Vuoi [qualcosa] da bere?',
        en: 'Would you like something to drink?',
        hint: 'something',
      },
      {
        it: '[Ognuno] ha la sua opinione.',
        en: 'Everyone has their own opinion.',
        hint: 'each one',
      },
    ],
  },
  {
    id: 52,
    slug: 'adverbs-mente',
    title: 'Adverbs: -mente, bene, male, molto, troppo',
    cefr: 'A2',
    prerequisites: ['adjective-agreement'],
    noteMd: `**In short:** An adverb tells you how, how much or when something happens (in English often "-ly": "slowly"). Many Italian adverbs add **-mente** to an adjective: *lento → lentamente*.

How to build them:
- adjectives in **-o**: take the **feminine** form, then add *-mente*: *lento → lenta → lentamente*, *vero → veramente*
- adjectives in **-e**: add *-mente*: *veloce → velocemente*
- adjectives in **-le** or **-re**: drop the final *-e* first: *facile → facilmente*, *regolare → regolarmente*

Some important adverbs are not built this way:
- **bene** (well) and **male** (badly), the adverbs of *buono* and *cattivo*: *Marco cucina bene.*
- **molto** (very, a lot), **poco** (little, not much), **troppo** (too, too much), **tanto** (so, so much)

Adverbs **never change** their ending. But *molto, poco, troppo, tanto* can also be adjectives before a noun, and then they agree:
- adverb: *Sono molto stanchi.* (They are very tired.) *Lavori troppo.* (You work too much.)
- adjective: *Ho molti amici.* (I have many friends.) *C'è troppa gente.* (There are too many people.)

Adverbs usually go **after the verb**: *Parla lentamente.*

**Watch out:** don't use *buono* as an adverb. "He speaks Italian well" is *Parla bene l'italiano*, not *Parla buono*. And check *molto*: before an adjective it means "very" and never changes (*molto simpatiche*); before a noun it means "many" and agrees (*molte ragazze*).

Examples:
- *Parla lentamente, per favore.* (Speak slowly, please.)
- *Ho trovato la strada facilmente.* (I found the way easily.)
- *Marco cucina molto bene.* (Marco cooks very well.)
- *Queste ragazze sono molto simpatiche.* (These girls are very nice.)`,
    drills: [
      {
        it: 'Parla [lentamente], per favore.',
        en: 'Speak slowly, please.',
        hint: 'lento (adverb)',
      },
      {
        it: 'Luca parla [velocemente] e non capisco niente.',
        en: "Luca talks fast and I can't understand a thing.",
        hint: 'veloce (adverb)',
      },
      {
        it: 'Ho trovato la strada [facilmente].',
        en: 'I found the way easily.',
        hint: 'facile (adverb)',
      },
      {
        it: 'Vado [regolarmente] in palestra.',
        en: 'I go to the gym regularly.',
        hint: 'regolare (adverb)',
      },
      { it: '[Sinceramente], non lo so.', en: "Honestly, I don't know.", hint: 'sincero (adverb)' },
      {
        it: 'Mi ha risposto molto [gentilmente].',
        en: 'He answered me very kindly.',
        hint: 'gentile (adverb)',
      },
      { it: 'Sono [veramente] stanco.', en: "I'm really tired.", hint: 'vero (adverb)' },
      { it: 'Marco cucina [bene].', en: 'Marco cooks well.', hint: 'buono (adverb)' },
      {
        it: 'Ho dormito [male] stanotte.',
        en: 'I slept badly last night.',
        hint: 'cattivo (adverb)',
      },
      { it: 'Lavori [troppo]!', en: 'You work too much!', hint: 'too much (adverb)' },
      {
        it: 'Queste ragazze sono [molto] simpatiche.',
        en: 'These girls are very nice.',
        hint: 'very (before an adjective)',
      },
      {
        it: 'Ho [molti] amici in Italia.',
        en: 'I have many friends in Italy.',
        hint: 'molto (before amici)',
      },
      { it: 'Luca studia [poco].', en: "Luca doesn't study much.", hint: 'not much (adverb)' },
      {
        it: "In questo bar c'è sempre [troppa] gente.",
        en: 'There are always too many people in this bar.',
        hint: 'troppo (before gente)',
      },
    ],
  },
  {
    id: 32,
    slug: 'future',
    title: 'The simple future',
    cefr: 'A2',
    prerequisites: ['present-ere-ire'],
    noteMd: `**In short:** The future tense says what *will* happen: *Domani pioverà* (it will rain tomorrow). It is one word, with no separate "will".

Take the infinitive, drop the final **-e**, and add the endings **-ò, -ai, -à, -emo, -ete, -anno**. In **-are** verbs the *a* becomes **e**: *parlare → parlerò*.

| | parlare | leggere | dormire |
|---|---|---|---|
| io | parlerò | leggerò | dormirò |
| tu | parlerai | leggerai | dormirai |
| lui / lei | parlerà | leggerà | dormirà |
| noi | parleremo | leggeremo | dormiremo |
| voi | parlerete | leggerete | dormirete |
| loro | parleranno | leggeranno | dormiranno |

Spelling: *-care, -gare* add an **h** to keep the hard sound: *cercherò, pagherò*. *-ciare, -giare* drop the **i**: *comincerò, mangerò*.

Common irregular stems (the endings stay the same): *essere → sarò*, *avere → avrò*, *andare → andrò*, *fare → farò*, *venire → verrò*, *volere → vorrò*, *potere → potrò*, *dovere → dovrò*, *vedere → vedrò*, *stare → starò*.

When to use it:
- predictions and promises: *Ti chiamerò stasera.*
- plans further ahead: *L'anno prossimo andremo in Giappone.*
- **guesses** about now: *Dove sono le chiavi? Saranno in macchina.* (They're probably in the car.)

For near, fixed plans Italians often use the present: *Domani vado a Roma.*

**Watch out:** the accent matters. *parlerò* (I will speak) and *parlerà* (he will speak) differ only in the last vowel, and *parlera* without an accent is not a word. In speech, stress the last syllable.

Examples:
- *Domani pioverà.* (It will rain tomorrow.)
- *Ti chiamerò stasera.* (I'll call you tonight.)
- *L'anno prossimo andremo in Giappone.* (Next year we'll go to Japan.)
- *Marco avrà trent'anni a maggio.* (Marco will be thirty in May.)`,
    drills: [
      { it: 'Domani [pioverà].', en: 'It will rain tomorrow.', hint: 'piovere (future)' },
      { it: 'Ti [chiamerò] stasera.', en: "I'll call you tonight.", hint: 'chiamare (future, io)' },
      {
        it: "Quando [finirai] l'università?",
        en: 'When will you finish university?',
        hint: 'finire (future, tu)',
      },
      {
        it: 'Gli ospiti [arriveranno] alle nove.',
        en: 'The guests will arrive at nine.',
        hint: 'arrivare (future, loro)',
      },
      {
        it: 'Stasera [mangeremo] fuori.',
        en: "Tonight we'll eat out.",
        hint: 'mangiare (future, noi)',
      },
      { it: 'Chi [pagherà] il conto?', en: 'Who will pay the bill?', hint: 'pagare (future)' },
      { it: '[Sarò] a casa alle otto.', en: "I'll be home at eight.", hint: 'essere (future, io)' },
      {
        it: "Marco [avrà] trent'anni a maggio.",
        en: 'Marco will be thirty in May.',
        hint: 'avere (future)',
      },
      {
        it: "L'anno prossimo [andremo] in Giappone.",
        en: "Next year we'll go to Japan.",
        hint: 'andare (future, noi)',
      },
      {
        it: 'Ragazzi, [verrete] alla festa?',
        en: 'Guys, will you come to the party?',
        hint: 'venire (future, voi)',
      },
      { it: 'Domani [farà] caldo.', en: 'It will be hot tomorrow.', hint: 'fare (future)' },
      {
        it: 'Mi dispiace, non [potrò] venire.',
        en: "I'm sorry, I won't be able to come.",
        hint: 'potere (future, io)',
      },
      {
        it: "Se vuoi passare l'esame, [dovrai] studiare di più.",
        en: "If you want to pass the exam, you'll have to study more.",
        hint: 'dovere (future, tu)',
      },
      {
        it: 'Dove sono le chiavi? [Saranno] in macchina.',
        en: "Where are the keys? They're probably in the car.",
        hint: 'essere (future, a guess)',
      },
    ],
  },
  {
    id: 33,
    slug: 'stare-gerund',
    title: 'Stare + gerund (I am doing)',
    cefr: 'A2',
    prerequisites: ['irregular-present'],
    noteMd: `**In short:** To stress that something is happening **right now**, use **stare** + the gerund (the "-ing" form): *Sto mangiando* (I'm eating, at this moment).

The gerund:
- **-are → -ando**: *parlare → parlando*
- **-ere, -ire → -endo**: *leggere → leggendo*, *dormire → dormendo*
- irregular: *fare → facendo*, *dire → dicendo*, *bere → bevendo*

The gerund never changes. Only *stare* changes, in the present: *sto, stai, sta, stiamo, state, stanno*.

| | |
|---|---|
| io | sto leggendo |
| tu | stai leggendo |
| lui / lei | sta leggendo |
| noi | stiamo leggendo |
| voi | state leggendo |
| loro | stanno leggendo |

With the imperfetto of *stare* (*stavo, stavi, stava*...) it means "was doing" at a moment in the past: *Stavamo uscendo quando è arrivato Luca.*

Pronouns go before *stare* or join the gerund: *Mi sto preparando* or *Sto preparandomi*.

The simple present (*mangio*) can also mean "I'm eating"; *stare* + gerund just makes "right now" clearer.

**Watch out:** English uses "-ing" for plans too ("I'm leaving tomorrow"), but Italian *stare* + gerund is only for actions in progress. For plans, use the simple present: *Domani parto*, not *Domani sto partendo*.

Examples:
- *Cosa stai facendo?* (What are you doing?)
- *Sto leggendo un libro.* (I'm reading a book.)
- *I bambini stanno giocando in giardino.* (The children are playing in the garden.)
- *Stavamo uscendo.* (We were going out.)`,
    drills: [
      { it: 'Cosa [stai facendo]?', en: 'What are you doing?', hint: 'fare (stare + gerund, tu)' },
      {
        it: '[Sto leggendo] un libro.',
        en: "I'm reading a book.",
        hint: 'leggere (stare + gerund, io)',
      },
      {
        it: 'Non fare rumore, Marco [sta dormendo].',
        en: "Don't make noise, Marco is sleeping.",
        hint: 'dormire (stare + gerund)',
      },
      {
        it: '[Stiamo mangiando], ti chiamo dopo.',
        en: "We're eating, I'll call you later.",
        hint: 'mangiare (stare + gerund, noi)',
      },
      {
        it: 'I bambini [stanno giocando] in giardino.',
        en: 'The children are playing in the garden.',
        hint: 'giocare (stare + gerund, loro)',
      },
      {
        it: 'Ragazzi, cosa [state guardando]?',
        en: 'Guys, what are you watching?',
        hint: 'guardare (stare + gerund, voi)',
      },
      {
        it: 'Aspetta, [sto arrivando]!',
        en: "Wait, I'm coming!",
        hint: 'arrivare (stare + gerund, io)',
      },
      {
        it: 'Scusa, che cosa [stai dicendo]?',
        en: 'Sorry, what are you saying?',
        hint: 'dire (stare + gerund, tu)',
      },
      {
        it: 'Corri, il treno [sta partendo]!',
        en: 'Run, the train is leaving!',
        hint: 'partire (stare + gerund)',
      },
      {
        it: 'Papà [sta lavorando], non può rispondere.',
        en: "Dad is working, he can't answer.",
        hint: 'lavorare (stare + gerund)',
      },
      {
        it: '[Stavamo uscendo] quando è arrivato Luca.',
        en: 'We were going out when Luca arrived.',
        hint: 'uscire (imperfetto of stare + gerund, noi)',
      },
      {
        it: "Quando l'ho vista, Giulia [stava bevendo] un caffè.",
        en: 'When I saw her, Giulia was drinking a coffee.',
        hint: 'bere (imperfetto of stare + gerund)',
      },
      {
        it: 'Un momento, [mi sto preparando]!',
        en: "Just a moment, I'm getting ready!",
        hint: 'prepararsi (stare + gerund, io)',
        also: ['sto preparandomi'],
      },
    ],
  },
  {
    id: 53,
    slug: 'verb-preposition-infinitive',
    title: 'Verb + a / di + infinitive: comincio a, finisco di',
    cefr: 'A2',
    prerequisites: ['modal-verbs'],
    noteMd: `**In short:** When one verb is followed by another in the infinitive (the basic form, like *lavorare*), many verbs need a small linking word, usually **a** or **di**: *Comincio a lavorare. Finisco di lavorare.* Each verb has its own, so learn them in pairs.

**Verb + a** (often about starting, continuing, managing, moving):
- *cominciare a, continuare a, imparare a, insegnare a, riuscire a* (manage to), *provare a* (try to), *aiutare a*
- movement verbs: *andare a, venire a, uscire a* (*Vado a dormire.*)

**Verb + di** (often about stopping, deciding, thinking, feeling):
- *finire di, smettere di* (stop), *decidere di, cercare di* (try to), *dimenticare di* (forget to), *sperare di* (hope to), *credere di*
- expressions with *avere*: *avere bisogno di* (need to), *avere voglia di* (feel like), *avere paura di* (be afraid of)

**No linking word**:
- *dovere, potere, volere, sapere*: *Devo lavorare.*
- *preferire, amare* and *piacere*: *Preferisco restare. Mi piace ballare.*

*Provare a* and *cercare di* both mean "try to": *provare a* is "have a go", *cercare di* is "make an effort".

| a | di | nothing |
|---|---|---|
| cominciare a | finire di | dovere |
| imparare a | smettere di | potere |
| riuscire a | decidere di | volere |
| andare a | sperare di | preferire |

**Watch out:** English uses "to" for all of these, so there is no shortcut: *Ho deciso a partire* is wrong, it is *Ho deciso di partire*. And don't add anything after the modal verbs: *Voglio di uscire* is wrong; say *Voglio uscire*.

Examples:
- *Comincio a lavorare alle nove.* (I start working at nine.)
- *Ha smesso di fumare.* (He stopped smoking.)
- *Non riesco a dormire.* (I can't get to sleep.)
- *Ho voglia di uscire.* (I feel like going out.)`,
    drills: [
      {
        it: 'Comincio [a] lavorare alle nove.',
        en: 'I start working at nine.',
        hint: 'the linking word after cominciare',
      },
      {
        it: 'Finisco [di] lavorare alle sei.',
        en: 'I finish work at six.',
        hint: 'the linking word after finire',
      },
      {
        it: 'Sto imparando [a] guidare.',
        en: "I'm learning to drive.",
        hint: 'the linking word after imparare',
      },
      {
        it: 'Marco ha smesso [di] fumare.',
        en: 'Marco has stopped smoking.',
        hint: 'the linking word after smettere',
      },
      {
        it: 'Abbiamo deciso [di] cambiare casa.',
        en: "We've decided to move house.",
        hint: 'the linking word after decidere',
      },
      {
        it: 'Non riesco [a] dormire.',
        en: "I can't get to sleep.",
        hint: 'the linking word after riuscire',
      },
      {
        it: 'Cerco [di] capire, ma è difficile.',
        en: "I'm trying to understand, but it's hard.",
        hint: 'the linking word after cercare',
      },
      {
        it: 'Vieni [a] mangiare da noi stasera?',
        en: 'Are you coming to eat at our place tonight?',
        hint: 'the linking word after venire',
      },
      {
        it: 'Mi aiuti [a] portare le borse?',
        en: 'Will you help me carry the bags?',
        hint: 'the linking word after aiutare',
      },
      {
        it: 'Ieri ho dimenticato [di] chiamare la nonna.',
        en: 'Yesterday I forgot to call my grandmother.',
        hint: 'the linking word after dimenticare',
      },
      {
        it: 'Spero [di] vederti presto.',
        en: 'I hope to see you soon.',
        hint: 'the linking word after sperare',
      },
      {
        it: 'Stasera ho voglia [di] uscire.',
        en: 'Tonight I feel like going out.',
        hint: 'the linking word after avere voglia',
      },
      {
        it: 'Proviamo [a] chiamare Marco.',
        en: "Let's try calling Marco.",
        hint: 'the linking word after provare',
      },
    ],
  },
  {
    id: 34,
    slug: 'imperative',
    title: 'The informal imperative',
    cefr: 'A2',
    prerequisites: ['present-ere-ire'],
    noteMd: `**In short:** The imperative is the form for orders, requests and advice: *Aspetta!* (Wait!) Here are the informal forms for **tu**, **voi**, and **noi** (*let's*).

| | parlare | prendere | sentire | finire |
|---|---|---|---|---|
| tu | parla! | prendi! | senti! | finisci! |
| noi | parliamo! | prendiamo! | sentiamo! | finiamo! |
| voi | parlate! | prendete! | sentite! | finite! |

So only the *tu* form of **-are** verbs is new: it ends in **-a**. All the other forms are the same as the present tense.

**Negative**:
- *tu*: **non + infinitive**: *Non parlare!* (Don't talk!) *Non toccare!*
- *noi, voi*: *non* + the normal form: *Non parlate!*

**Irregular tu forms**: *fare → fa'* (or *fai*), *andare → va'* (or *vai*), *stare → sta'* (or *stai*), *dare → da'* (or *dai*), *dire → di'*, *essere → sii*, *avere → abbi*. For *voi*: *siate*, *abbiate*.

**Pronouns** join the end of the positive form: *Aspettami!* (Wait for me!) After the one-syllable forms *fa', va', sta', da', di'*, the consonant doubles: *Dimmi!* (Tell me!) *Fammi vedere!* (Let me see!)

**Watch out:** for a negative order to *tu*, don't use the *tu* form: *Non parla!* is wrong; say *Non parlare!* with the infinitive. And remember the *-a* ending in -are verbs: *Mangia!*, not *Mangi!*

Examples:
- *Scusa, aspetta un momento!* (Sorry, wait a moment!)
- *Non toccare il forno!* (Don't touch the oven!)
- *Andiamo!* (Let's go!)
- *Dimmi la verità!* (Tell me the truth!)`,
    drills: [
      {
        it: 'Scusa, [aspetta] un momento!',
        en: 'Sorry, wait a moment!',
        hint: 'aspettare (imperative, tu)',
      },
      {
        it: '[Prendi] un caffè con me!',
        en: 'Have a coffee with me!',
        hint: 'prendere (imperative, tu)',
      },
      {
        it: '[Senti], hai tempo stasera?',
        en: 'Listen, are you free tonight?',
        hint: 'sentire (imperative, tu)',
      },
      { it: '[Finisci] la minestra!', en: 'Finish your soup!', hint: 'finire (imperative, tu)' },
      {
        it: 'Dai, [andiamo] al cinema!',
        en: "Come on, let's go to the cinema!",
        hint: "andare (imperative, noi: let's)",
      },
      {
        it: '[Mangiamo] qualcosa!',
        en: "Let's eat something!",
        hint: "mangiare (imperative, noi: let's)",
      },
      {
        it: 'Ragazzi, [parlate] più piano!',
        en: 'Guys, speak more quietly!',
        hint: 'parlare (imperative, voi)',
      },
      {
        it: '[Non toccare] il forno!',
        en: "Don't touch the oven!",
        hint: 'toccare (negative imperative, tu)',
      },
      {
        it: '[Non parlate] tutti insieme!',
        en: "Don't all talk at once!",
        hint: 'parlare (negative imperative, voi)',
      },
      { it: "[Fa'] presto!", en: 'Hurry up!', hint: 'fare (imperative, tu)', also: ['fai'] },
      {
        it: "È tardi, [va'] a dormire!",
        en: "It's late, go to bed!",
        hint: 'andare (imperative, tu)',
        also: ['vai'],
      },
      {
        it: '[Sii] gentile con tua sorella!',
        en: 'Be nice to your sister!',
        hint: 'essere (imperative, tu)',
      },
      { it: '[Abbi] pazienza!', en: 'Be patient!', hint: 'avere (imperative, tu)' },
      { it: '[Dimmi] la verità!', en: 'Tell me the truth!', hint: 'dire + me (imperative, tu)' },
      { it: '[Aspettami] qui!', en: 'Wait for me here!', hint: 'aspettare + me (imperative, tu)' },
    ],
  },
  {
    id: 35,
    slug: 'comparatives',
    title: 'Comparatives: più / meno ... di / che',
    cefr: 'A2',
    prerequisites: ['adjective-agreement'],
    noteMd: `**In short:** To compare two things, use **più** (more) or **meno** (less) before the adjective, and **di** or **che** for "than": *Marco è più alto di Luca.*

**"Than" = di** before a noun, a name or a pronoun (*me, te, lui*...). *Di* combines with the article: *del, della, dell'*...
- *Roma è più grande di Firenze.*
- *Il treno è più veloce dell'autobus.*
- *Mia sorella è meno alta di me.*

**"Than" = che** when you compare two of anything else about the same subject: two adjectives, two verbs, two nouns after a verb (*bevo più tè che caffè*), or two phrases with a preposition.
- *È più facile leggere che parlare.*
- *Fa più caldo d'estate che d'inverno.*

**"As ... as"**: **come** or **quanto**: *È alto come me* or *È alto quanto me.* (The longer *così ... come* and *tanto ... quanto* also exist.)

Irregular forms you will meet often:

| | adjective | adverb |
|---|---|---|
| better | migliore (or più buono) | meglio |
| worse | peggiore (or più cattivo) | peggio |

*Migliore* and *peggiore* describe a noun (*una pizza migliore*); *meglio* and *peggio* go with a verb (*Oggi sto meglio*).

**Watch out:** English "than" has two translations. Quick test: if you could put a person or a name in its place (*than Luca*), use *di*; if you compare two actions or two descriptions, use *che*. And never say *più meglio*: *meglio* already means "better".

Examples:
- *Roma è più grande di Firenze.* (Rome is bigger than Florence.)
- *È più facile leggere che parlare.* (Reading is easier than speaking.)
- *Sono alto come te.* (I'm as tall as you.)
- *Oggi sto meglio.* (Today I feel better.)`,
    drills: [
      {
        it: 'Marco è più alto [di] Luca.',
        en: 'Marco is taller than Luca.',
        hint: 'than (+ a name)',
      },
      {
        it: 'Roma è più grande [di] Firenze.',
        en: 'Rome is bigger than Florence.',
        hint: 'than (+ a name)',
      },
      {
        it: 'Mia sorella è [meno] alta di me.',
        en: "My sister isn't as tall as me.",
        hint: 'less',
      },
      {
        it: "Il treno è più veloce [dell']autobus.",
        en: 'The train is faster than the bus.',
        hint: "than (+ l'autobus)",
      },
      {
        it: 'Questo libro è [più] interessante del film.',
        en: 'This book is more interesting than the film.',
        hint: 'more',
      },
      {
        it: 'È più facile leggere [che] parlare.',
        en: 'Reading is easier than speaking.',
        hint: 'than (comparing two verbs)',
      },
      {
        it: 'Bevo più tè [che] caffè.',
        en: 'I drink more tea than coffee.',
        hint: 'than (comparing two things you drink)',
      },
      {
        it: "Fa più caldo d'estate [che] d'inverno.",
        en: "It's hotter in summer than in winter.",
        hint: 'than (+ a phrase with a preposition)',
      },
      {
        it: 'Sono alto [come] te.',
        en: "I'm as tall as you.",
        hint: 'as (equality)',
        also: ['quanto'],
      },
      {
        it: 'Questa pizza è [migliore] di quella.',
        en: 'This pizza is better than that one.',
        hint: 'better (adjective)',
        also: ['più buona'],
      },
      { it: 'Oggi sto [meglio].', en: 'Today I feel better.', hint: 'better (adverb)' },
      {
        it: 'Il secondo film è [peggiore] del primo.',
        en: 'The second film is worse than the first.',
        hint: 'worse (adjective)',
        also: ['più brutto'],
      },
      {
        it: 'Marco canta [peggio] di me.',
        en: 'Marco sings worse than me.',
        hint: 'worse (adverb)',
      },
    ],
  },
  {
    id: 54,
    slug: 'superlatives',
    title: 'Superlatives: il più bello, bellissimo',
    cefr: 'A2',
    prerequisites: ['comparatives'],
    noteMd: `**In short:** Italian has two kinds of superlative. **Il più bello** means "the most beautiful" (of a group). **Bellissimo** means "very, very beautiful", with no comparison.

**The most, the least** (compared with a group):
- **article + più / meno + adjective**: *Giulia è la più alta.*
- with a noun, the adjective usually goes after it: *la città più grande* (the biggest city)
- "in" or "of" the group is **di** (combined with the article): *Giulia è la più alta della classe.* *Roma è la città più grande d'Italia.*

**Very, extremely** (no comparison): add **-issimo** to the adjective without its last vowel. It agrees like any -o adjective: *-issimo, -issima, -issimi, -issime*.
- *bello → bellissimo*, *facile → facilissimo*, *buono → buonissimo*
- adjectives in *-co, -go* add *h* where the plural does: *stanco → stanchissimo*, *lungo → lunghissimo*; but *simpatico → simpaticissimo*
- adverbs too: *bene → benissimo*, *male → malissimo*
- you can also just use *molto*: *molto bello*

Irregular forms:

| | the best / worst | very good / very bad |
|---|---|---|
| buono | il migliore | ottimo (or buonissimo) |
| cattivo | il peggiore | pessimo |

*Migliore* often goes before the noun: *la mia migliore amica*, *il miglior ristorante*.

**Watch out:** "in" after a superlative is *di*, not *in*: *il ristorante più caro della città*, not *in la città*. And don't repeat the article: *la città più grande*, not *la città la più grande*.

Examples:
- *Roma è la città più grande d'Italia.* (Rome is the biggest city in Italy.)
- *Giulia è la più alta della classe.* (Giulia is the tallest in the class.)
- *Questa pizza è buonissima!* (This pizza is delicious!)
- *Anna è la mia migliore amica.* (Anna is my best friend.)`,
    drills: [
      {
        it: "Roma è la città [più grande] d'Italia.",
        en: 'Rome is the biggest city in Italy.',
        hint: 'grande (the biggest)',
      },
      {
        it: 'Questo è il ristorante [più caro] della città.',
        en: 'This is the most expensive restaurant in the city.',
        hint: 'caro (the most expensive)',
      },
      {
        it: "Questi sono i giorni [più freddi] dell'anno.",
        en: 'These are the coldest days of the year.',
        hint: 'freddo (the coldest)',
      },
      {
        it: 'Giulia è [la più alta] della classe.',
        en: 'Giulia is the tallest in the class.',
        hint: 'alto (the tallest, no noun)',
      },
      {
        it: 'Marco è [il meno simpatico] del gruppo.',
        en: 'Marco is the least likeable in the group.',
        hint: 'simpatico (the least, no noun)',
      },
      {
        it: 'Il film è [bellissimo].',
        en: 'The film is really beautiful.',
        hint: 'bello (very, one word)',
      },
      {
        it: 'Le lezioni sono [facilissime].',
        en: 'The lessons are really easy.',
        hint: 'facile (very, one word)',
      },
      {
        it: 'Dopo il viaggio sono [stanchissimo].',
        en: "After the trip I'm exhausted.",
        hint: 'stanco (very, one word, a man speaking)',
      },
      {
        it: 'I tuoi amici sono [simpaticissimi].',
        en: 'Your friends are really nice.',
        hint: 'simpatico (very, one word)',
      },
      {
        it: 'Questa pizza è [buonissima]!',
        en: 'This pizza is delicious!',
        hint: 'buono (very, one word)',
        also: ['ottima'],
      },
      {
        it: 'Anna è la mia [migliore] amica.',
        en: 'Anna is my best friend.',
        hint: 'buono (the best)',
      },
      {
        it: 'È stato il giorno [peggiore] della mia vita.',
        en: 'It was the worst day of my life.',
        hint: 'cattivo (the worst)',
        also: ['più brutto'],
      },
      {
        it: 'Sto [benissimo], grazie.',
        en: "I'm very well, thanks.",
        hint: 'bene (very, one word)',
      },
      { it: 'Ho dormito [malissimo].', en: 'I slept really badly.', hint: 'male (very, one word)' },
    ],
  },
];
