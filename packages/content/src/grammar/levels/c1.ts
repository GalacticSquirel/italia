import type { GrammarPointSource } from '../types';

/** C1 grammar points in teaching order. */
export const C1_POINTS: readonly GrammarPointSource[] = [
  {
    id: 94,
    slug: 'participle-clauses',
    title: 'Participle clauses: finita la cena, ...',
    cefr: 'C1',
    prerequisites: ['passato-prossimo-essere', 'gerund-clauses'],
    noteMd: `**In short:** a past participle on its own at the start of a sentence means "once this was done" or "after doing this". It is a compact, written-style alternative to *dopo che* or *dopo aver*.

*Finita la cena, siamo usciti.* = *Dopo che la cena è finita, siamo usciti.*

How it agrees (agreement means the ending matches in gender and number):
- With a verb that takes an object (the thing acted on), the participle agrees with that object, which usually comes right after it: *finita la cena*, *chiuse le finestre*, *letto il giornale*.
- With a verb that takes *essere* (arrive, leave, go out...), it agrees with the subject (who does the action): *Arrivati a casa, ci siamo riposati.* *Partita Giulia, ...*
- Object pronouns and reflexive pronouns are attached to the end: *vistolo* (having seen him), *alzatasi* (she having got up).

You often add *una volta* for "once": *Una volta presa la decisione, ...*

The participle clause usually describes something that happened before the main action. It sounds natural in writing, news and storytelling; in everyday speech *dopo che* or *quando* is more common.

**Watch out:** do not add *avendo* or *essendo* here, and do not leave the ending as *-o* by default. *Finito la cena* is wrong: it must be *finita*, because *cena* is feminine.

Examples:
- *Finita la cena, siamo usciti a fare due passi.* (Once dinner was over, we went out for a walk.)
- *Arrivate a Roma, le ragazze hanno chiamato i genitori.* (Once they reached Rome, the girls called their parents.)
- *Una volta firmato il contratto, non si può più cambiare idea.* (Once the contract is signed, you can't change your mind.)
- *Vistolo arrivare, la madre gli corse incontro.* (Seeing him arrive, his mother ran to meet him.)`,
    drills: [
      {
        it: '[Finita] la cena, siamo usciti a fare due passi.',
        en: 'Once dinner was over, we went out for a walk.',
        hint: 'finire (past participle, agrees with la cena)',
      },
      {
        it: '[Chiuse] le finestre, abbiamo acceso il condizionatore.',
        en: 'Having closed the windows, we turned on the air conditioning.',
        hint: 'chiudere (past participle, agrees with le finestre)',
      },
      {
        it: "[Letto] il contratto, l'avvocato lo ha firmato senza esitare.",
        en: 'Having read the contract, the lawyer signed it without hesitating.',
        hint: 'leggere (past participle)',
      },
      {
        it: '[Arrivati] alla stazione, abbiamo scoperto che il treno era stato cancellato.',
        en: 'When we got to the station, we found out the train had been cancelled.',
        hint: 'arrivare (past participle, we: a mixed group)',
      },
      {
        it: '[Partita] Giulia, la casa sembrava vuota.',
        en: 'Once Giulia had left, the house felt empty.',
        hint: 'partire (past participle)',
      },
      {
        it: '[Uscite] dal cinema, le ragazze sono andate a mangiare una pizza.',
        en: 'After leaving the cinema, the girls went to get a pizza.',
        hint: 'uscire (past participle)',
      },
      {
        it: '[Superati] gli esami, potrò finalmente rilassarmi.',
        en: "Once I've passed the exams, I'll finally be able to relax.",
        hint: 'superare (past participle, agrees with gli esami)',
      },
      {
        it: 'Una volta [presa] la decisione, non si torna indietro.',
        en: "Once the decision is made, there's no going back.",
        hint: 'prendere (past participle)',
      },
      {
        it: '[Spenta] la luce, il bambino si addormentò subito.',
        en: 'Once the light was off, the child fell asleep at once.',
        hint: 'spegnere (past participle)',
      },
      {
        it: '[Vistolo] arrivare, la madre gli corse incontro.',
        en: 'Seeing him arrive, his mother ran to meet him.',
        hint: 'vedere + him (past participle with attached pronoun)',
      },
      {
        it: '[Alzatasi] dal letto, Anna aprì le tende.',
        en: 'Having got out of bed, Anna opened the curtains.',
        hint: 'alzarsi (past participle with attached pronoun, Anna)',
      },
    ],
  },
  {
    id: 95,
    slug: 'past-gerund',
    title: 'Past gerund: avendo finito, essendo arrivati',
    cefr: 'C1',
    prerequisites: ['gerund-clauses'],
    noteMd: `**In short:** the past gerund means "having done something". Use it for an action that happened before the main action, often as its cause: *Avendo finito, sono uscito.* (Having finished, I went out.)

It is built with the gerund of the auxiliary (the helping verb *avere* or *essere*) plus the past participle:

| auxiliary | example |
|---|---|
| *avendo* | *avendo finito, avendo letto* |
| *essendo* | *essendo arrivato, essendo partite* |

- Choose *avendo* or *essendo* exactly as in the passato prossimo: *ho finito*, so *avendo finito*; *sono arrivato*, so *essendo arrivato*.
- With *essendo*, the participle agrees with the subject: *essendo arrivata* (Sara), *essendo arrivati* (we).
- Pronouns attach to the end of *avendo* or *essendo*: *avendolo visto* (having seen it), *essendosi alzata* (she having got up), *avendoci pensato* (having thought about it).
- For the negative, put *non* first: *non avendo capito* (not having understood).

The subject of the gerund should be the same as the subject of the main verb: *Avendo perso il treno, abbiamo preso un taxi* (we lost it, we took the taxi).

**Watch out:** English "having" tempts you to always use *avendo*. Verbs that take *essere* need *essendo*: *essendo partito*, not *avendo partito*. And with *essendo*, remember the agreement.

Examples:
- *Avendo studiato molto, Sara ha superato l'esame.* (Having studied a lot, Sara passed the exam.)
- *Essendo arrivati tardi, abbiamo perso l'inizio del film.* (Having arrived late, we missed the start of the film.)
- *Non avendo ricevuto risposta, ho scritto di nuovo.* (Not having had a reply, I wrote again.)
- *Essendosi rotta una gamba, Chiara non può sciare.* (Having broken her leg, Chiara can't ski.)`,
    drills: [
      {
        it: '[Avendo finito] i compiti, Marco è uscito a giocare.',
        en: 'Having finished his homework, Marco went out to play.',
        hint: 'finire (past gerund)',
      },
      {
        it: "[Avendo studiato] molto, Sara ha superato l'esame senza problemi.",
        en: 'Having studied a lot, Sara passed the exam easily.',
        hint: 'studiare (past gerund)',
      },
      {
        it: "[Essendo arrivati] in ritardo, abbiamo perso l'inizio del film.",
        en: 'Having arrived late, we missed the start of the film.',
        hint: 'arrivare (past gerund, we: a mixed group)',
      },
      {
        it: '[Essendo partita] presto, Laura è arrivata prima di tutti.',
        en: 'Having left early, Laura arrived before everyone else.',
        hint: 'partire (past gerund)',
      },
      {
        it: '[Avendo perso] il treno, abbiamo preso un taxi.',
        en: 'Having missed the train, we took a taxi.',
        hint: 'perdere (past gerund)',
      },
      {
        it: "[Non avendo ricevuto] risposta, ho scritto di nuovo all'ufficio.",
        en: 'Not having received a reply, I wrote to the office again.',
        hint: 'ricevere (past gerund, negative)',
      },
      {
        it: '[Essendo nati] a Napoli, i miei figli tifano per il Napoli.',
        en: 'Having been born in Naples, my sons support Napoli.',
        hint: 'nascere (past gerund)',
      },
      {
        it: 'Quel film? [Avendolo visto] tre volte, lo conosco a memoria.',
        en: 'That film? Having seen it three times, I know it by heart.',
        hint: 'vedere + it (past gerund with attached pronoun)',
      },
      {
        it: "[Essendosi rotta] una gamba, Chiara non potrà sciare quest'inverno.",
        en: "Having broken her leg, Chiara won't be able to ski this winter.",
        hint: 'rompersi (past gerund)',
      },
      {
        it: "[Avendoci pensato] bene, ho deciso di accettare l'offerta.",
        en: 'Having thought it over carefully, I decided to accept the offer.',
        hint: 'pensarci (past gerund)',
      },
      {
        it: "[Essendosi sposati] molto giovani, i miei nonni hanno festeggiato sessant'anni di matrimonio.",
        en: 'Having married very young, my grandparents celebrated sixty years of marriage.',
        hint: 'sposarsi (past gerund)',
      },
    ],
  },
  {
    id: 96,
    slug: 'mixed-hypotheticals',
    title: 'Mixed and implicit if-clauses',
    cefr: 'C1',
    prerequisites: ['if-past-unreal'],
    noteMd: `**In short:** the "if" part and the result part of an unreal sentence can refer to different times, so you mix the two patterns you know. And the condition can also be hidden in a gerund, *a* + infinitive or a phrase like *senza di te*.

Mixed patterns:

| if part | result | meaning |
|---|---|---|
| *se avessi studiato* | *ora avrei un lavoro* | past cause, present result |
| *se fossi più paziente* | *non avrei litigato* | general fact, past result |

- Past condition, present result: *se* + pluperfect subjunctive (*avessi fatto*) + present conditional (*farei*).
- Present or permanent condition, past result: *se* + imperfect subjunctive (*fossi*) + past conditional (*avrei fatto*).

Implicit conditions (no *se*):
- gerund: *Volendo, potremmo partire domani.* (If we wanted to...)
- *a* + infinitive: *A saperlo, sarei venuto.* (Had I known...)
- a phrase: *senza il tuo aiuto*, *al tuo posto*, *con un po' di fortuna*.

In relaxed speech, the past unreal sentence is often said with two imperfects: *Se lo sapevo, venivo.* (= *Se l'avessi saputo, sarei venuto.*) It is very common but stay with the subjunctive in writing.

**Watch out:** never use the conditional in the *se* part (the condition) of an if-sentence. *Se avrei studiato* is a classic mistake (also for Italians): it must be *se avessi studiato*.

Examples:
- *Se avessi studiato medicina, ora farei il medico.* (If I had studied medicine, I'd be a doctor now.)
- *Se non fossi così testardo, avresti accettato il loro aiuto.* (If you weren't so stubborn, you'd have accepted their help.)
- *Senza il tuo aiuto, non ce l'avrei fatta.* (Without your help, I wouldn't have made it.)
- *A saperlo, sarei venuto prima.* (Had I known, I'd have come earlier.)`,
    drills: [
      {
        it: 'Se avessi studiato medicina, ora [farei] il medico.',
        en: "If I had studied medicine, I'd be a doctor now.",
        hint: 'fare (present conditional)',
      },
      {
        it: 'Se non avessimo perso il treno, adesso [saremmo] già a casa.',
        en: "If we hadn't missed the train, we'd be home by now.",
        hint: 'essere (present conditional)',
      },
      {
        it: 'Se tu mi [avessi ascoltato], ora non saresti in questa situazione.',
        en: "If you had listened to me, you wouldn't be in this situation now.",
        hint: 'ascoltare (pluperfect subjunctive)',
      },
      {
        it: 'Se [fossi] più paziente, non avresti litigato con lui ieri.',
        en: "If you were more patient, you wouldn't have argued with him yesterday.",
        hint: 'essere (imperfect subjunctive, tu)',
      },
      {
        it: "Se Marco [parlasse] inglese, l'avrebbero assunto.",
        en: 'If Marco spoke English, they would have hired him.',
        hint: 'parlare (imperfect subjunctive)',
      },
      {
        it: 'Se non fossi così testardo, [avresti accettato] il loro aiuto.',
        en: "If you weren't so stubborn, you would have accepted their help.",
        hint: 'accettare (past conditional, tu)',
      },
      {
        it: 'Al tuo posto, [avrei detto] la verità.',
        en: 'In your place, I would have told the truth.',
        hint: 'dire (past conditional, io)',
      },
      {
        it: "Senza il tuo aiuto, non [ce l'avrei fatta].",
        en: "Without your help, I wouldn't have made it.",
        hint: 'farcela (past conditional, io)',
      },
      {
        it: '[Volendo], potremmo partire già domani.',
        en: 'If we wanted to, we could leave as early as tomorrow.',
        hint: 'volere (gerund as a hidden if-clause)',
      },
      {
        it: '[A saperlo], sarei venuto prima.',
        en: 'Had I known, I would have come earlier.',
        hint: 'a + sapere + it (hidden if-clause)',
        also: ["se l'avessi saputo"],
      },
      {
        it: "Se lo sapevo, [venivo] anch'io.",
        en: "If I'd known, I'd have come too.",
        hint: 'venire (colloquial imperfect, io)',
      },
    ],
  },
  {
    id: 97,
    slug: 'conditional-hearsay',
    title: 'Conditional for unconfirmed news: sarebbe stato arrestato',
    cefr: 'C1',
    prerequisites: ['conditional-past'],
    noteMd: `**In short:** news reports use the conditional to give information that is not confirmed: the reporter is passing it on, not vouching for it. In English you say "reportedly", "allegedly" or "is said to".

- For something true now, use the **present conditional**: *Il ministro sarebbe pronto a dimettersi.* (The minister is reportedly ready to resign.)
- For something that happened, use the **past conditional** (the conditional of *avere* or *essere* + past participle): *Il ladro sarebbe entrato dalla finestra.* (The thief allegedly got in through the window.)
- For a passive (something done to the subject), use *sarebbe stato* + participle: *Il sospettato sarebbe stato arrestato.* (The suspect has reportedly been arrested.)
- For something in progress: *starebbe lavorando* (is reportedly working).

This conditional often comes with *secondo* (according to), *stando a* (going by), *a quanto pare* (apparently). (After *pare che* you need the subjunctive instead: *pare che sia pronto*.) The same rules for agreement apply as in the passato prossimo: *la coppia si sarebbe separata*.

It is the standard tool of Italian newspapers and TV news, and you also use it in speech when you repeat gossip.

**Watch out:** this conditional has nothing to do with "would". Translate *sarebbe stato arrestato* as "has reportedly been arrested", not "would have been arrested". And do not change it into the indicative: the conditional is exactly what signals "not confirmed".

Examples:
- *Secondo alcune fonti, il ministro sarebbe pronto a dimettersi.* (According to some sources, the minister is ready to resign.)
- *Il sospettato sarebbe stato arrestato ieri sera.* (The suspect was reportedly arrested last night.)
- *Nell'incidente ci sarebbero tre feriti.* (Three people are reported injured in the accident.)
- *Il cantante starebbe lavorando a un nuovo album.* (The singer is said to be working on a new album.)`,
    drills: [
      {
        it: 'Secondo alcune fonti, il ministro [sarebbe] pronto a dimettersi.',
        en: 'According to some sources, the minister is ready to resign.',
        hint: 'essere (conditional, unconfirmed news)',
      },
      {
        it: "Nell'incidente [ci sarebbero] almeno tre feriti.",
        en: 'At least three people are reported injured in the accident.',
        hint: 'esserci (present conditional, unconfirmed)',
      },
      {
        it: 'Il cantante [starebbe lavorando] a un nuovo album.',
        en: 'The singer is reportedly working on a new album.',
        hint: 'stare + lavorare (conditional, in progress)',
      },
      {
        it: 'Secondo la polizia, i ladri [sarebbero entrati] da una finestra.',
        en: 'According to the police, the thieves got in through a window.',
        hint: 'entrare (past conditional, unconfirmed)',
      },
      {
        it: "L'azienda [avrebbe licenziato] duecento dipendenti negli ultimi mesi.",
        en: 'The company has reportedly laid off two hundred employees in recent months.',
        hint: 'licenziare (past conditional, unconfirmed)',
      },
      {
        it: 'Il sospettato [sarebbe stato arrestato] ieri sera a Milano.',
        en: 'The suspect was reportedly arrested in Milan last night.',
        hint: 'arrestare (past conditional, passive)',
      },
      {
        it: "Secondo i testimoni, l'uomo [avrebbe sparato] due colpi prima di fuggire.",
        en: 'According to witnesses, the man fired two shots before fleeing.',
        hint: 'sparare (past conditional, unconfirmed)',
      },
      {
        it: 'Stando alle prime indiscrezioni, la coppia [si sarebbe separata] a gennaio.',
        en: 'According to the first rumours, the couple split up in January.',
        hint: 'separarsi (past conditional, unconfirmed)',
      },
      {
        it: 'Il presidente [avrebbe dichiarato] di non sapere nulla della vicenda.',
        en: 'The president allegedly stated that he knew nothing about the affair.',
        hint: 'dichiarare (past conditional, unconfirmed)',
      },
      {
        it: 'Il terremoto [avrebbe causato] gravi danni in diversi paesi della zona.',
        en: 'The earthquake is reported to have caused serious damage in several villages in the area.',
        hint: 'causare (past conditional, unconfirmed)',
      },
      {
        it: 'I due rapinatori [sarebbero stati visti] alla stazione poco dopo il colpo.',
        en: 'The two robbers were reportedly seen at the station shortly after the robbery.',
        hint: 'vedere (past conditional, passive, plural)',
      },
    ],
  },
  {
    id: 98,
    slug: 'subjunctive-independent',
    title: 'The subjunctive on its own: Magari!, Che entri!, Sia chiaro',
    cefr: 'C1',
    prerequisites: ['subjunctive-imperfect'],
    noteMd: `**In short:** the subjunctive can stand alone, with no main verb before it, to express a wish, a wondering question, or a "let him / let them" order.

Wishes, with *magari* or *se solo* (if only):
- imperfect subjunctive for now: *Magari fosse vero!* (If only it were true!)
- pluperfect subjunctive for the past: *Magari fossimo partiti prima!* (If only we had left earlier!)

*Che* + subjunctive (present, or past for something already done):
- an order or permission about someone else (third person): *Che entri pure.* (Let him come in.) *Che se ne vadano!* (Let them go!)
- a wondering question: *Che sia già partito?* (Could he have left already?) *Che abbia dimenticato?* (Could she have forgotten?)

Fixed expressions you will meet often:
- *Sia chiaro.* (Let's be clear.)
- *Che io sappia...* (As far as I know...)
- *Viva gli sposi!* (Long live the bride and groom!) *Viva* usually stays singular even before a plural; *Vivano* is correct but formal.
- *Dio ce ne scampi!* (God forbid!)

These forms sound natural in speech and writing alike; *magari* and *che io sappia* are everyday Italian.

**Watch out:** after *magari* meaning "if only", use the imperfect or pluperfect subjunctive, never the present or the conditional: *Magari potessi!*, not *Magari posso!* or *Magari potrei!* (On its own, *magari* also means "maybe", and then it takes the indicative: *Magari vengo.*)

Examples:
- *Magari avessi più tempo!* (If only I had more time!)
- *Il signor Bianchi è qui? Che entri pure.* (Mr Bianchi's here? Let him come in.)
- *Non risponde: che sia già partito?* (He isn't answering: could he have left already?)
- *Che io sappia, il negozio è aperto.* (As far as I know, the shop is open.)`,
    drills: [
      {
        it: 'Magari [fosse] vero!',
        en: 'If only it were true!',
        hint: 'essere (imperfect subjunctive)',
      },
      {
        it: 'Magari [avessi] più tempo per leggere!',
        en: 'If only I had more time to read!',
        hint: 'avere (imperfect subjunctive, io)',
      },
      {
        it: 'Se solo [potessi] tornare indietro!',
        en: 'If only I could go back!',
        hint: 'potere (imperfect subjunctive, io)',
      },
      {
        it: 'Magari [fossimo partiti] prima della tempesta!',
        en: 'If only we had left before the storm!',
        hint: 'partire (pluperfect subjunctive, we: a mixed group)',
      },
      {
        it: 'Il signor Bianchi è qui? Che [entri] pure.',
        en: "Mr Bianchi's here? Let him come in.",
        hint: 'entrare (present subjunctive)',
      },
      {
        it: 'Che [se ne vadano] pure, se non sono contenti!',
        en: "Let them leave, if they're not happy!",
        hint: 'andarsene (present subjunctive, loro)',
      },
      {
        it: 'Non risponde al telefono: che [sia] già partito?',
        en: "He isn't answering the phone: could he have left already?",
        hint: 'essere (present subjunctive, wondering)',
      },
      {
        it: 'Che Luca [abbia dimenticato] il nostro appuntamento?',
        en: 'Could Luca have forgotten our appointment?',
        hint: 'dimenticare (past subjunctive, wondering)',
      },
      {
        it: '[Sia] chiaro: non accetterò altri ritardi.',
        en: "Let's be clear: I won't accept any more delays.",
        hint: 'essere (present subjunctive, fixed phrase)',
      },
      {
        it: 'Che io [sappia], il negozio è aperto anche la domenica.',
        en: 'As far as I know, the shop is open on Sundays too.',
        hint: 'sapere (present subjunctive, fixed phrase)',
      },
      {
        it: '[Viva] gli sposi!',
        en: 'Long live the bride and groom!',
        hint: 'vivere (present subjunctive, the usual fixed toast)',
        also: ['Vivano'],
      },
    ],
  },
  {
    id: 99,
    slug: 'subjunctive-indirect-questions',
    title: 'Subjunctive after superlatives and in indirect questions',
    cefr: 'C1',
    prerequisites: ['sequence-of-tenses'],
    noteMd: `**In short:** careful Italian uses the subjunctive in two more places: after a superlative or *l'unico* (the only one) followed by *che*, and in indirect questions (a question reported inside a sentence: "I wonder where he is").

After superlatives, *il primo*, *l'ultimo*, *l'unico*:
- *È il film più bello che io abbia mai visto.* (It's the best film I've ever seen.)
- *Sei l'unica persona che mi capisca.* (You're the only person who understands me.)

Indirect questions, after *non so*, *mi chiedo*, *mi domando*, *non capisco*, *chiedere* + *se, chi, dove, come, perché, quanto*:
- *Non so se sia vero.* (I don't know if it's true.)
- *Mi chiedo dove abbiano messo le chiavi.* (I wonder where they've put the keys.)

The sequence of tenses applies as usual. With a main verb in the past, use the imperfect subjunctive for the same time and the pluperfect for earlier:
- *Mi domandavo chi fosse.* (I wondered who she was.)
- *Non sapevamo se il volo fosse partito.* (We didn't know if the flight had left.)

In everyday speech the indicative is also common here (*Non so se è vero*), but in writing and formal speech the subjunctive is expected.

**Watch out:** in the present subjunctive the *io*, *tu* and *lui/lei* forms are the same (*che io abbia, che tu abbia, che lui abbia*), so keep the subject pronoun when it is not clear: *il film più bello che io abbia visto*. In an indirect question, *se* means "whether".

Examples:
- *È la persona più generosa che io conosca.* (She's the most generous person I know.)
- *Non capisco perché tu non voglia venire.* (I don't understand why you don't want to come.)
- *Gli ho chiesto quanto costasse la riparazione.* (I asked him how much the repair cost.)`,
    drills: [
      {
        it: 'È la persona più generosa che io [conosca].',
        en: "She's the most generous person I know.",
        hint: 'conoscere (present subjunctive)',
      },
      {
        it: "È il film più noioso che io [abbia visto] quest'anno.",
        en: "It's the most boring film I've seen this year.",
        hint: 'vedere (past subjunctive, io)',
      },
      {
        it: "Sei l'unica persona che mi [capisca] davvero.",
        en: "You're the only person who really understands me.",
        hint: 'capire (present subjunctive)',
      },
      {
        it: "Lei è l'unica che [sappia] la verità.",
        en: "She's the only one who knows the truth.",
        hint: 'sapere (present subjunctive)',
      },
      {
        it: 'Non so se Paolo [sia] ancora a casa.',
        en: "I don't know if Paolo is still at home.",
        hint: 'essere (present subjunctive)',
      },
      {
        it: 'Mi chiedo dove [abbiano messo] le chiavi.',
        en: "I wonder where they've put the keys.",
        hint: 'mettere (past subjunctive, loro)',
      },
      {
        it: 'Non capisco perché tu non [voglia] venire.',
        en: "I don't understand why you don't want to come.",
        hint: 'volere (present subjunctive, tu)',
      },
      {
        it: 'Non è chiaro come [sia andata] a finire la storia.',
        en: "It isn't clear how the story ended.",
        hint: 'andare (past subjunctive)',
      },
      {
        it: 'Mi domandavo chi [fosse] quella ragazza.',
        en: 'I was wondering who that girl was.',
        hint: 'essere (imperfect subjunctive)',
      },
      {
        it: 'Gli ho chiesto quanto [costasse] la riparazione.',
        en: 'I asked him how much the repair cost.',
        hint: 'costare (imperfect subjunctive)',
      },
      {
        it: 'Non sapevamo se il volo [fosse partito] in orario.',
        en: "We didn't know if the flight had left on time.",
        hint: 'partire (pluperfect subjunctive)',
      },
    ],
  },
  {
    id: 100,
    slug: 'cui-possessive',
    title: 'Whose: il cui, la cui',
    cefr: 'C1',
    prerequisites: ['relatives-advanced'],
    noteMd: `**In short:** "whose" in Italian is article + *cui* + noun: *l'uomo la cui moglie...* (the man whose wife...). The article agrees with the thing possessed, not with the owner.

| possessed noun | whose |
|---|---|
| masculine singular | *il cui padre* |
| feminine singular | *la cui casa* |
| masculine plural | *i cui libri* |
| feminine plural | *le cui strade* |

- *Ho conosciuto un uomo la cui moglie è giapponese.* (*la* because *moglie* is feminine, even though the owner is a man.)
- *È una scrittrice i cui libri sono famosi.* (*i* because *libri* is masculine plural.)

With a preposition (a small linking word like *in, a, di*), join it to the article as usual (*in + la = nella*) and put it before *cui*:
- *la signora nella cui casa abitavo* (the lady in whose house I lived)
- *un problema alla cui soluzione lavoriamo* (a problem whose solution we're working on)
- *un'attrice del cui passato si sa poco* (an actress about whose past little is known)

*Il cui* belongs to written and careful spoken Italian. In conversation people often rephrase: *un uomo che ha la moglie giapponese*. A more formal alternative is *del quale / della quale* after the noun: *l'uomo, la moglie del quale...*

**Watch out:** do not match the article to the owner. *La donna il cui marito* is right (*marito* is masculine); *la donna la cui marito* is wrong. And never put *di* before *cui* for "whose": *l'uomo di cui la moglie* is wrong.

Examples:
- *Il ragazzo il cui padre lavora con me si chiama Luca.* (The boy whose father works with me is called Luca.)
- *Ho visitato una città le cui strade erano piene di turisti.* (I visited a city whose streets were full of tourists.)
- *La signora nella cui casa abitavo era molto gentile.* (The lady in whose house I lived was very kind.)`,
    drills: [
      {
        it: 'Ho conosciuto un uomo [la cui] moglie è giapponese.',
        en: 'I met a man whose wife is Japanese.',
        hint: 'whose (before moglie)',
      },
      {
        it: 'Il ragazzo [il cui] padre lavora con me si chiama Luca.',
        en: 'The boy whose father works with me is called Luca.',
        hint: 'whose (before padre)',
      },
      {
        it: 'È una scrittrice [i cui] libri sono tradotti in venti lingue.',
        en: "She's a writer whose books are translated into twenty languages.",
        hint: 'whose (before libri)',
      },
      {
        it: 'Ho visitato una città [le cui] strade erano piene di turisti.',
        en: 'I visited a city whose streets were full of tourists.',
        hint: 'whose (before strade)',
      },
      {
        it: "È un'azienda [la cui] sede si trova a Torino.",
        en: "It's a company whose headquarters are in Turin.",
        hint: 'whose (before sede)',
      },
      {
        it: 'Ringraziamo i volontari, [il cui] lavoro è stato prezioso.',
        en: 'We thank the volunteers, whose work has been invaluable.',
        hint: 'whose (before lavoro)',
      },
      {
        it: 'Gli studenti [i cui] nomi sono sulla lista possono entrare.',
        en: 'The students whose names are on the list may go in.',
        hint: 'whose (before nomi)',
      },
      {
        it: 'Conosco una donna [il cui] marito fa il pilota.',
        en: 'I know a woman whose husband is a pilot.',
        hint: 'whose (before marito)',
      },
      {
        it: 'La signora [nella cui] casa abitavo era molto gentile.',
        en: 'The lady in whose house I lived was very kind.',
        hint: 'in + whose (before casa)',
      },
      {
        it: 'È un problema [alla cui] soluzione stiamo lavorando da mesi.',
        en: "It's a problem whose solution we've been working on for months.",
        hint: 'a + whose (before soluzione)',
      },
      {
        it: "Abbiamo intervistato un'attrice [del cui] passato si sa poco.",
        en: 'We interviewed an actress about whose past little is known.',
        hint: 'di + whose (before passato)',
      },
    ],
  },
  {
    id: 101,
    slug: 'causative-perception',
    title: 'Lasciare, sentire, vedere + infinitive; farsi fare',
    cefr: 'C1',
    prerequisites: ['causative-fare'],
    noteMd: `**In short:** like *fare*, the verbs *lasciare* (let), *vedere* (see), *sentire* (hear) and *guardare* (watch) can be followed directly by an infinitive (the basic *-are/-ere/-ire* form). *Farsi* + infinitive means "to get something done for yourself".

*lasciare* + infinitive:
- *I miei non mi lasciano uscire.* (My parents don't let me go out.)
- *Lascialo parlare!* (Let him speak!)
- *Non lasciarti convincere.* (Don't let yourself be talked into it.)
- *lasciare che* + subjunctive is the alternative: *Ha lasciato che tutti partissero.*

*vedere, sentire, guardare* + infinitive, with no preposition before the infinitive:
- *Ho sentito Marta cantare.* (I heard Marta sing.)
- *Ho visto i bambini correre.* (I saw the children running.)
- An object pronoun goes before the conjugated verb, and in the passato prossimo the participle agrees with it: *Li ho visti correre.*

*farsi* + infinitive (have something done for yourself, or get someone to do something for you). It takes *essere*, so the participle agrees with the subject:
- *Mi sono fatto tagliare i capelli.* (I got my hair cut: a man speaking.)
- *Laura si è fatta aiutare da un amico.* (Laura got a friend to help her.)
- Imperative: *Fatti spiegare la strada.* (Get someone to explain the way to you.)

**Watch out:** English says "I saw them running"; Italian uses the plain infinitive, not the gerund: *Li ho visti correre*, not *Li ho visti correndo*. And with *farsi*, do not use *avere*: *mi sono fatto*, not *mi ho fatto*.

Examples:
- *Lascia stare, ci penso io.* (Leave it, I'll take care of it.)
- *Abbiamo sentito qualcuno bussare alla porta.* (We heard someone knock at the door.)
- *Mi sono fatta portare una pizza.* (I had a pizza delivered: a woman speaking.)`,
    drills: [
      {
        it: 'I miei genitori non mi [lasciano] uscire dopo mezzanotte.',
        en: "My parents don't let me go out after midnight.",
        hint: 'lasciare (present)',
      },
      {
        it: '[Lascialo] parlare, per favore!',
        en: 'Let him speak, please!',
        hint: 'lasciare + him (tu imperative)',
      },
      {
        it: 'Ieri [ho sentito] Marta cantare in giardino.',
        en: 'Yesterday I heard Marta singing in the garden.',
        hint: 'sentire (passato prossimo, io)',
      },
      {
        it: '[Abbiamo sentito] qualcuno bussare alla porta.',
        en: 'We heard someone knock at the door.',
        hint: 'sentire (passato prossimo, noi)',
      },
      {
        it: 'Dove sono i bambini? [Li ho visti] correre verso il parco.',
        en: 'Where are the children? I saw them running towards the park.',
        hint: 'vedere + them (passato prossimo, io)',
      },
      {
        it: 'Non [lasciarti] convincere dalle sue promesse.',
        en: "Don't let yourself be talked round by his promises.",
        hint: 'lasciarsi (negative tu imperative)',
        also: ['ti lasciare'],
      },
      {
        it: 'Il direttore [ha lasciato] che tutti uscissero prima.',
        en: 'The manager let everyone leave early.',
        hint: 'lasciare (passato prossimo)',
      },
      {
        it: 'Ieri mi [sono fatto] tagliare i capelli.',
        en: 'I got my hair cut yesterday.',
        hint: 'farsi (passato prossimo, a man speaking)',
      },
      {
        it: 'Laura [si è fatta] aiutare da un amico per il trasloco.',
        en: 'Laura got a friend to help her with the move.',
        hint: 'farsi (passato prossimo)',
      },
      {
        it: 'Non avevo voglia di cucinare, quindi mi [sono fatta] portare una pizza.',
        en: "I didn't feel like cooking, so I had a pizza delivered.",
        hint: 'farsi (passato prossimo, a woman speaking)',
      },
      {
        it: '[Fatti] spiegare la strada da qualcuno del posto.',
        en: 'Get someone local to explain the way to you.',
        hint: 'farsi (tu imperative)',
      },
    ],
  },
  {
    id: 102,
    slug: 'trapassato-remoto',
    title: 'Trapassato remoto: dopo che ebbe finito',
    cefr: 'C1',
    prerequisites: ['passato-remoto'],
    noteMd: `**In short:** the trapassato remoto ("had done") is a literary tense. You only need to recognise and use it in one situation: after *dopo che*, *appena*, *non appena* or *quando*, when the main verb is in the passato remoto (the simple past of written stories).

It is the passato remoto of *avere* or *essere* + the past participle:

| | avere | essere |
|---|---|---|
| io | *ebbi finito* | *fui partito/a* |
| tu | *avesti finito* | *fosti partito/a* |
| lui, lei | *ebbe finito* | *fu partito/a* |
| noi | *avemmo finito* | *fummo partiti/e* |
| voi | *aveste finito* | *foste partiti/e* |
| loro | *ebbero finito* | *furono partiti/e* |

- Choose the auxiliary (the helping verb) as in the passato prossimo; with *essere*, the participle agrees with the subject.
- Reflexive verbs use *essere*: *si fu seduto* (he had sat down).

*Dopo che ebbe finito di mangiare, uscì.* (After he had finished eating, he went out.) The trapassato remoto shows the action finished just before the main one.

In modern speech and most writing it is replaced by the trapassato prossimo (*dopo che aveva finito*), by *dopo aver finito*, or by a participle clause (*finito di mangiare*). You will meet it in novels and history books.

**Watch out:** do not use it as a general "had done". In any other context, or with a main verb that is not in the passato remoto, use the trapassato prossimo: *Quando sono arrivato, Marco era già uscito.*

Examples:
- *Dopo che ebbe finito di mangiare, il vecchio uscì in giardino.* (After he had finished eating, the old man went out into the garden.)
- *Appena fu arrivata a casa, Maria telefonò alla madre.* (As soon as she had got home, Maria phoned her mother.)
- *Quando ebbero letto la lettera, scoppiarono a ridere.* (When they had read the letter, they burst out laughing.)`,
    drills: [
      {
        it: 'Dopo che [ebbe finito] di mangiare, il vecchio uscì in giardino.',
        en: 'After he had finished eating, the old man went out into the garden.',
        hint: 'finire (trapassato remoto)',
      },
      {
        it: 'Appena [fu arrivata] a casa, Maria telefonò alla madre.',
        en: 'As soon as she had got home, Maria phoned her mother.',
        hint: 'arrivare (trapassato remoto)',
      },
      {
        it: 'Quando [ebbero letto] la lettera, scoppiarono a ridere.',
        en: 'When they had read the letter, they burst out laughing.',
        hint: 'leggere (trapassato remoto, loro)',
      },
      {
        it: 'Dopo che [ebbi pagato] il conto, lasciai il ristorante.',
        en: 'After I had paid the bill, I left the restaurant.',
        hint: 'pagare (trapassato remoto, io)',
      },
      {
        it: 'Non appena [fummo usciti], cominciò a piovere.',
        en: 'As soon as we had gone out, it began to rain.',
        hint: 'uscire (trapassato remoto, we: a mixed group)',
      },
      {
        it: 'Quando [ebbe detto] tutto, si sentì più leggera.',
        en: 'When she had said everything, she felt lighter.',
        hint: 'dire (trapassato remoto)',
      },
      {
        it: 'Appena [si fu seduto], il professore aprì il registro.',
        en: 'As soon as he had sat down, the teacher opened the register.',
        hint: 'sedersi (trapassato remoto)',
      },
      {
        it: 'Dopo che i soldati [furono partiti], il villaggio tornò tranquillo.',
        en: 'After the soldiers had left, the village became quiet again.',
        hint: 'partire (trapassato remoto)',
      },
      {
        it: 'Dopo che [avemmo cenato], uscimmo a passeggiare sul lungomare.',
        en: 'After we had had dinner, we went out for a walk along the seafront.',
        hint: 'cenare (trapassato remoto, noi)',
      },
      {
        it: 'Appena il treno [fu ripartito], mi accorsi di aver dimenticato la valigia.',
        en: 'As soon as the train had set off again, I realised I had left my suitcase behind.',
        hint: 'ripartire (trapassato remoto)',
      },
    ],
  },
  {
    id: 103,
    slug: 'advanced-conjunctions',
    title: 'Formal conditions and concessions: qualora, purché, per quanto',
    cefr: 'C1',
    prerequisites: ['subjunctive-conjunctions'],
    noteMd: `**In short:** these conjunctions (linking words that join two parts of a sentence) introduce a condition ("if", "provided that", "unless") or a concession ("however much", "although"). All of them are followed by the subjunctive.

Conditions:
- *qualora* (if, in the event that; formal): *Qualora il volo fosse cancellato, vi rimborseremo.*
- *nel caso in cui / nel caso che* (in case): *Nel caso in cui dovesse piovere, ...*
- *purché* (provided that): *Puoi uscire, purché torni presto.*
- *a patto che / a condizione che* (on condition that)
- *ammesso che* (assuming that)
- *a meno che (non)* (unless): *a meno che non venga anche tu*. The *non* here does not make it negative.

Concessions:
- *per quanto* (however much, although): *Per quanto mi sforzi, non ricordo.*
- *nonostante / malgrado* (despite the fact that): *Nonostante fosse stanco, ...*

"-ever" words, also + subjunctive:
- *chiunque* (whoever), *qualunque / qualsiasi* + noun (whatever, whichever), *comunque* (however, whichever way), *dovunque* (wherever).
- *Qualunque cosa tu decida, ti sosterrò.* (Whatever you decide, I'll support you.)

*Qualora* often takes the imperfect subjunctive even for a future event, and *dovesse* + infinitive is common after *qualora* and *nel caso in cui*: *qualora dovesse servire* (should it be needed).

**Watch out:** *a meno che non venga* means "unless he comes", not "unless he doesn't come". And *comunque* + subjunctive means "however / whichever way" (*comunque vada*); on its own with the indicative, it just means "anyway".

Examples:
- *Ti presto la macchina, a patto che tu me la restituisca con il pieno.* (I'll lend you the car on condition that you give it back with a full tank.)
- *Per quanto mi sforzi, non riesco a ricordare il suo nome.* (However hard I try, I can't remember his name.)
- *Comunque vada, sarà un'esperienza utile.* (Whichever way it goes, it'll be a useful experience.)`,
    drills: [
      {
        it: 'Puoi uscire stasera, [purché] tu torni prima di mezzanotte.',
        en: 'You can go out tonight, provided that you are back before midnight.',
        hint: 'provided that (one word)',
      },
      {
        it: 'Ti presto la macchina, [a patto che] tu me la restituisca con il pieno.',
        en: "I'll lend you the car on condition that you give it back with a full tank.",
        hint: 'on condition that (a patto...)',
      },
      {
        it: '[Per quanto] mi sforzi, non riesco a ricordare il suo nome.',
        en: "However hard I try, I can't remember his name.",
        hint: 'however much (two words)',
      },
      {
        it: '[Nonostante] fosse stanco, ha continuato a lavorare fino a tardi.',
        en: 'Although he was tired, he kept working until late.',
        hint: 'despite the fact that (starts with n)',
      },
      {
        it: 'Non verrò alla festa, [a meno che] non venga anche tu.',
        en: "I won't come to the party unless you come too.",
        hint: 'unless',
      },
      {
        it: '[Qualora] il volo fosse cancellato, la compagnia vi rimborserà il biglietto.',
        en: 'In the event that the flight is cancelled, the airline will refund your ticket.',
        hint: 'in the event that (one formal word)',
      },
      {
        it: '[Nel caso in cui] dovesse piovere, la cerimonia si terrà al chiuso.',
        en: 'In case it rains, the ceremony will be held indoors.',
        hint: 'in case (nel caso...)',
        also: ['nel caso che'],
      },
      {
        it: '[Ammesso che] il progetto venga approvato, i lavori inizieranno a marzo.',
        en: 'Assuming the project is approved, work will start in March.',
        hint: 'assuming that',
      },
      {
        it: '[Chiunque] chiami, digli che non ci sono.',
        en: "Whoever calls, tell them I'm not in.",
        hint: 'whoever',
      },
      {
        it: '[Qualunque] cosa tu decida, ti sosterrò.',
        en: "Whatever you decide, I'll support you.",
        hint: 'whatever (before cosa)',
        also: ['qualsiasi'],
      },
      {
        it: "[Comunque] vada, sarà un'esperienza utile.",
        en: "Whichever way it goes, it'll be a useful experience.",
        hint: 'however / whichever way',
      },
    ],
  },
  {
    id: 104,
    slug: 'formal-register',
    title: 'Formal register: Loro, letters, bureaucratic Italian',
    cefr: 'C1',
    prerequisites: ['imperative-formal'],
    noteMd: `**In short:** formal written Italian (letters, emails to offices, notices) has its own fixed phrases, and very formal speech can address a group as *Loro*. You need to recognise all of it and use the common letter formulas yourself.

Letters and formal emails:
- Opening: *Gentile signora Rossi*, *Gentile dottore*, *Egregio avvocato* (very formal, mostly to men). *Gentili signori* for a group.
- *Le scrivo per...* (I am writing to...), *La ringrazio per...* (Thank you for...), *Desidero informarLa che...* (I wish to inform you that...).
- *In allegato Le invio...* (Please find attached...).
- Closing: *In attesa di un Suo cortese riscontro* (Looking forward to your reply), then *Cordiali saluti* or *Distinti saluti*.
- In letters, the formal *Lei* forms are often written with a capital: *La, Le, Suo*, even attached: *informarLa*.

Notices and bureaucratic language:
- *Si prega di* + infinitive (please...): *Si prega di non fumare.*
- *I signori passeggeri sono pregati di...* (Passengers are kindly requested to...)
- *provvedere a* (to see to), *entro* (by a date), *il sottoscritto* (the undersigned).

*Loro* (very formal "you", plural): verbs in the third person plural, *Loro* forms like *Si accomodino* (please sit down), *Desiderano?* (What would you like?). You hear it from waiters in elegant places and in ceremonies; elsewhere *voi* is now normal.

**Watch out:** do not open a formal email with *Caro* + surname or close it with *Ciao*. And *Egregio* is used mostly for men; for a woman *Gentile* is the usual choice (*Egregia* exists but is rarer).

Examples:
- *Gentile dottoressa Rossi, Le scrivo per chiederLe un appuntamento.* (Dear Dr Rossi, I am writing to ask you for an appointment.)
- *Si prega di non lasciare i bagagli incustoditi.* (Please do not leave luggage unattended.)
- *Signori, si accomodino pure.* (Ladies and gentlemen, please take a seat.)`,
    drills: [
      {
        it: '[Gentile] dottoressa Rossi, Le scrivo per chiederLe un appuntamento.',
        en: 'Dear Dr Rossi, I am writing to ask you for an appointment.',
        hint: 'Dear (formal letter opening, to a woman)',
      },
      {
        it: 'La [ringrazio] per la Sua cortese risposta.',
        en: 'Thank you for your kind reply.',
        hint: 'ringraziare (present, io)',
      },
      {
        it: 'In attesa di un Suo riscontro, Le porgo [distinti saluti].',
        en: 'Looking forward to your reply, yours faithfully.',
        hint: 'formal closing (distinti...)',
      },
      {
        it: '[In allegato] Le invio il modulo compilato.',
        en: 'Please find attached the completed form.',
        hint: 'attached (formal phrase, two words)',
      },
      {
        it: 'Desidero [informarLa] che la Sua richiesta è stata accolta.',
        en: 'I wish to inform you that your request has been accepted.',
        hint: 'informare + you (formal Lei)',
      },
      {
        it: 'La [preghiamo] di compilare il modulo entro il 30 giugno.',
        en: 'We kindly ask you to fill in the form by 30 June.',
        hint: 'pregare (present, noi)',
      },
      {
        it: '[Si prega di] non lasciare i bagagli incustoditi.',
        en: 'Please do not leave luggage unattended.',
        hint: 'please (impersonal formula for notices)',
      },
      {
        it: 'I signori passeggeri [sono pregati] di allacciare le cinture.',
        en: 'Passengers are kindly requested to fasten their seat belts.',
        hint: 'pregare (present passive, plural)',
      },
      {
        it: 'Il richiedente [dovrà provvedere] al pagamento entro trenta giorni.',
        en: 'The applicant must arrange payment within thirty days.',
        hint: 'dovere + provvedere (future)',
      },
      {
        it: 'Signori, [si accomodino] pure in sala.',
        en: 'Ladies and gentlemen, please take a seat in the hall.',
        hint: 'accomodarsi (formal plural imperative, Loro)',
      },
      {
        it: 'Signori, se [desiderano] altre informazioni, non esitino a contattarci.',
        en: "Ladies and gentlemen, if you would like further information, don't hesitate to contact us.",
        hint: 'desiderare (present, Loro)',
      },
    ],
  },
  {
    id: 105,
    slug: 'discourse-markers',
    title: 'Spoken Italian: mica, pure, magari, allora, cioè, dai',
    cefr: 'C1',
    prerequisites: [],
    noteMd: `**In short:** discourse markers are the small words that give spoken Italian its tone: they soften, stress, encourage or fill a pause. They rarely translate word for word, but using them makes you sound natural.

- *mica*: strengthens a negative, "not at all", "not exactly". *Non è mica facile.* (It's not exactly easy.) In a question it means "you're not..., are you?": *Non sarai mica arrabbiato?* *Mica male!* (Not bad at all!)
- *pure*: after an imperative, it means "go ahead", "feel free": *Entra pure.* *Fai pure.*
- *magari*: "maybe" (*Magari passo più tardi*), or "I wish!" as an answer: *Hai vinto? Magari!*
- *allora*: "so", "well then", to start or move on: *Allora, che facciamo?*
- *cioè*: "I mean", "that is", to explain or correct: *domani, cioè venerdì*.
- *dai*: "come on", to encourage or to protest: *Dai, non essere triste!* *Su* works the same way.
- *insomma*: "in short", or "so-so" as a lukewarm answer: *Com'è andata? Insomma...*
- *comunque*: "anyway", "still": *Era lungo, ma comunque mi è piaciuto.*
- *figurati*: "don't mention it", "of course not" (*si figuri* with *Lei*).

**Watch out:** *magari* + indicative is "maybe", but *magari!* on its own is "if only!". And *pure* after an imperative is not "also": *Prendi pure* means "go ahead and take it", not "take it too".

Examples:
- *Non è mica facile trovare casa a Milano.* (It's not exactly easy to find a flat in Milan.)
- *Siediti pure, arrivo subito.* (Do sit down, I'll be right there.)
- *Grazie mille! Figurati, è stato un piacere.* (Thanks so much! Don't mention it, it was a pleasure.)
- *Allora, cioè, non so se vengo.* (So, I mean, I don't know if I'm coming.)`,
    drills: [
      {
        it: 'Non è [mica] facile trovare casa a Milano.',
        en: "It's not exactly easy to find a flat in Milan.",
        hint: 'not at all (strengthens non)',
      },
      {
        it: 'Entra [pure], la porta è aperta.',
        en: 'Go ahead and come in, the door is open.',
        hint: 'go ahead (softens an imperative)',
      },
      {
        it: '[Allora], che facciamo stasera?',
        en: 'So, what are we doing tonight?',
        hint: 'so / well then (to open a question)',
      },
      {
        it: 'Arrivo domani, [cioè] venerdì.',
        en: "I'm arriving tomorrow, I mean Friday.",
        hint: 'I mean / that is',
      },
      {
        it: '[Dai], non essere triste!',
        en: "Come on, don't be sad!",
        hint: 'come on (encouraging)',
        also: ['su'],
      },
      {
        it: 'Non so se vengo stasera, [magari] passo più tardi.',
        en: "I don't know if I'm coming tonight, maybe I'll drop by later.",
        hint: 'maybe (spoken)',
        also: ['forse'],
      },
      {
        it: 'Hai vinto la gara? [Magari]! Sono arrivato ultimo.',
        en: 'Did you win the race? I wish! I came last.',
        hint: 'I wish! (as an answer)',
      },
      {
        it: 'Grazie mille! [Figurati], è stato un piacere.',
        en: "Thanks so much! Don't mention it, it was a pleasure.",
        hint: "don't mention it (to tu)",
      },
      {
        it: 'Non sarai [mica] arrabbiato con me?',
        en: "You're not angry with me, are you?",
        hint: 'not... are you? (in a worried question)',
      },
      {
        it: "Com'è andato il colloquio? [Insomma], potevo fare meglio.",
        en: 'How did the interview go? So-so, I could have done better.',
        hint: 'so-so (a lukewarm answer)',
      },
      {
        it: 'Il film era lunghissimo, ma [comunque] mi è piaciuto.',
        en: 'The film was really long, but I still liked it.',
        hint: 'anyway / still',
      },
    ],
  },
  {
    id: 106,
    slug: 'nominalisation',
    title: "Nominalisation: il mangiare, l'arrivo del treno",
    cefr: 'C1',
    prerequisites: [],
    noteMd: `**In short:** nominalisation means turning a verb or an adjective into a noun (a naming word). Written Italian, especially news and official texts, uses it constantly: *Dopo l'arrivo del treno...* instead of *Dopo che il treno è arrivato...*

Nouns made from verbs. There is no single rule, so learn them in pairs:

| verb | noun |
|---|---|
| *arrivare* | *l'arrivo* |
| *partire* | *la partenza* |
| *aumentare* | *l'aumento* |
| *decidere* | *la decisione* |
| *chiudere* | *la chiusura* |
| *scoprire* | *la scoperta* |

Common endings: *-zione* (*costruzione*), *-mento* (*aumento*, *cambiamento*), *-ura* (*chiusura*), *-enza* (*partenza*), *-ita* (*vendita*, *nascita*). The person or thing involved follows with *di*: *la partenza del volo*, *la nascita del figlio*.

The infinitive as a noun: with *il* (or *lo*, *l'*), an infinitive can act as a masculine noun, often for a habit or way of doing something: *il mangiare*, *il suo continuo lamentarsi* (his constant complaining).

Adjectives as nouns: *il bello* (the nice thing, beauty), *i giovani* (young people), *il difficile* (the hard part).

**Watch out:** English often uses an "-ing" form where Italian needs a real noun: "the closing of the road" is *la chiusura della strada*, not *il chiudere della strada*. Keep the infinitive-noun for general activities and habits.

Examples:
- *Dopo l'arrivo del treno, la stazione si è svuotata.* (After the train arrived, the station emptied.)
- *La chiusura della strada durerà tre giorni.* (The road closure will last three days.)
- *Il bello di questo lavoro è che posso viaggiare.* (The nice thing about this job is that I can travel.)`,
    drills: [
      {
        it: "Dopo [l'arrivo] del treno, la stazione si è svuotata.",
        en: 'After the train arrived, the station emptied.',
        hint: 'arrivare (noun, with article)',
      },
      {
        it: '[La partenza] del volo è prevista alle dieci.',
        en: 'The flight is scheduled to leave at ten.',
        hint: 'partire (noun, with article)',
      },
      {
        it: 'Il governo ha annunciato [un aumento] delle tasse.',
        en: 'The government has announced a tax increase.',
        hint: 'aumentare (noun, with indefinite article)',
      },
      {
        it: '[La chiusura] della strada durerà tre giorni.',
        en: 'The road closure will last three days.',
        hint: 'chiudere (noun, with article)',
      },
      {
        it: '[La decisione] del giudice arriverà domani.',
        en: "The judge's decision will come tomorrow.",
        hint: 'decidere (noun, with article)',
      },
      {
        it: '[La scoperta] della penicillina ha cambiato la medicina.',
        en: 'The discovery of penicillin changed medicine.',
        hint: 'scoprire (noun, with article)',
      },
      {
        it: '[La costruzione] del ponte è iniziata nel 2020.',
        en: 'Construction of the bridge began in 2020.',
        hint: 'costruire (noun, with article)',
      },
      {
        it: '[La vendita] dei biglietti inizia lunedì.',
        en: 'Ticket sales start on Monday.',
        hint: 'vendere (noun, with article)',
      },
      {
        it: 'Ci ha raccontato [la nascita] del figlio con grande emozione.',
        en: "He told us about his son's birth with great emotion.",
        hint: 'nascere (noun, with article)',
      },
      {
        it: 'Per gli italiani [il mangiare] è una cosa seria.',
        en: 'For Italians, eating is a serious matter.',
        hint: 'mangiare (infinitive as a noun, with article)',
      },
      {
        it: 'Mi dà fastidio il suo continuo [lamentarsi].',
        en: 'His constant complaining annoys me.',
        hint: 'complain (reflexive infinitive used as a noun)',
      },
      {
        it: '[Il bello] di questo lavoro è che posso viaggiare.',
        en: 'The nice thing about this job is that I can travel.',
        hint: 'bello (adjective as a noun, with article)',
      },
    ],
  },
  {
    id: 107,
    slug: 'auxiliary-choice',
    title: 'Essere or avere? Verbs that take both',
    cefr: 'C1',
    prerequisites: ['passato-prossimo-essere'],
    noteMd: `**In short:** some verbs take *avere* when they have a direct object (a thing acted on directly, with no preposition) and *essere* when they don't. The meaning shifts slightly: someone does something to something, or something simply happens.

| verb | with an object: *avere* | no object: *essere* |
|---|---|---|
| *cominciare* | *Ho cominciato il corso.* | *Il corso è cominciato.* |
| *finire* | *Ho finito il libro.* | *Il film è finito.* |
| *passare* | *Ho passato l'estate qui.* | *Sono passato da te.* |
| *aumentare* | *Hanno aumentato i prezzi.* | *I prezzi sono aumentati.* |

The same pattern works for *iniziare*, *salire*, *scendere* (*ho sceso le scale* / *sono sceso*), *cambiare* (*ho cambiato idea* / *Paolo è cambiato*), *crescere* (*ha cresciuto tre figli* / *è cresciuto*), *diminuire*, *migliorare*.

Other verbs to know:
- *correre*: *avere* for the activity (*Ho corso un'ora*), *essere* with a destination (*Sono corso a casa*).
- Weather verbs take either: *è piovuto* or *ha piovuto*.
- *vivere* takes either without an object: *ho vissuto* or *sono vissuto a Roma*.

With *essere*, the participle agrees with the subject as usual: *la lezione è cominciata*, *i prezzi sono aumentati*.

**Watch out:** ask "is there a direct object?" before choosing. *Ho finito* (I've finished, my work is implied) is right for a person; *è finito* is for the thing that ended. *Il film ha finito* is wrong.

Examples:
- *La lezione è cominciata alle nove.* (The lesson started at nine.)
- *Il professore ha cominciato la lezione in ritardo.* (The teacher started the lesson late.)
- *Mio figlio è cresciuto tantissimo.* (My son has grown so much.)
- *Mia nonna ha cresciuto cinque figli da sola.* (My grandmother raised five children on her own.)`,
    drills: [
      {
        it: 'La lezione [è cominciata] alle nove.',
        en: 'The lesson started at nine.',
        hint: 'cominciare (passato prossimo)',
      },
      {
        it: 'Il professore [ha cominciato] la lezione in ritardo.',
        en: 'The teacher started the lesson late.',
        hint: 'cominciare (passato prossimo)',
      },
      {
        it: "[Ho passato] l'estate in Sardegna.",
        en: 'I spent the summer in Sardinia.',
        hint: 'passare (passato prossimo, io)',
      },
      {
        it: 'Ieri Giulia [è passata] da me per un caffè.',
        en: 'Yesterday Giulia dropped by my place for a coffee.',
        hint: 'passare (passato prossimo)',
      },
      {
        it: 'I prezzi della benzina [sono aumentati] di nuovo.',
        en: 'Petrol prices have gone up again.',
        hint: 'aumentare (passato prossimo)',
      },
      {
        it: 'Il negozio [ha aumentato] i prezzi a settembre.',
        en: 'The shop put its prices up in September.',
        hint: 'aumentare (passato prossimo)',
      },
      {
        it: "L'ascensore era rotto, così [siamo saliti] a piedi.",
        en: 'The lift was broken, so we walked up.',
        hint: 'salire (passato prossimo, we: a mixed group)',
      },
      {
        it: '[Abbiamo salito] sei piani di scale con le valigie.',
        en: 'We climbed six flights of stairs with the suitcases.',
        hint: 'salire (passato prossimo, noi)',
      },
      {
        it: "Mio figlio [è cresciuto] tantissimo quest'anno.",
        en: 'My son has grown so much this year.',
        hint: 'crescere (passato prossimo)',
      },
      {
        it: 'Mia nonna [ha cresciuto] cinque figli da sola.',
        en: 'My grandmother raised five children on her own.',
        hint: 'crescere (passato prossimo)',
      },
      {
        it: "Stamattina [ho corso] per un'ora al parco.",
        en: 'This morning I ran for an hour in the park.',
        hint: 'correre (passato prossimo, io: the activity)',
      },
      {
        it: 'Appena ha saputo la notizia, Marco [è corso] a casa.',
        en: 'As soon as he heard the news, Marco rushed home.',
        hint: 'correre (passato prossimo: towards a place)',
      },
    ],
  },
  {
    id: 108,
    slug: 'adjective-position',
    title: 'Adjective position changes meaning',
    cefr: 'C1',
    prerequisites: ['adjective-agreement'],
    noteMd: `**In short:** most adjectives (describing words) go after the noun, with their plain, literal meaning. A few common ones change meaning depending on whether they come before or after the noun.

| adjective | before the noun | after the noun |
|---|---|---|
| *vecchio* | *un vecchio amico* (long-standing) | *un amico vecchio* (elderly) |
| *povero* | *un povero ragazzo* (unlucky) | *un ragazzo povero* (with no money) |
| *grande* | *un grand'uomo* (great) | *un uomo grande* (big) |
| *diverso* | *diversi libri* (several) | *libri diversi* (different) |

More pairs:
- *caro*: *una cara amica* (dear) / *un ristorante caro* (expensive)
- *nuovo*: *una nuova macchina* (another one, new to me) / *una macchina nuova* (brand-new)
- *stesso*: *lo stesso problema* (the same) / *il direttore stesso* (the manager himself)
- *certo*: *un certo coraggio* (a certain amount of) / *una notizia certa* (sure, reliable)
- *unico*: *l'unico figlio* (the only son) / *un figlio unico* (an only child)

The general idea: after the noun, the adjective sorts and describes objectively (which one? a cheap or an expensive one?). Before the noun, it is more subjective, emotional or figurative.

**Watch out:** in English the adjective always comes first, so "an old friend" is ambiguous. In Italian you must choose: someone you have known for years is *un vecchio amico*; a friend who is old is *un amico anziano* or *un amico vecchio*.

Examples:
- *Luca è un vecchio amico: ci conosciamo dalle elementari.* (Luca is an old friend: we've known each other since primary school.)
- *Quel povero ragazzo ha perso il lavoro.* (That poor boy has lost his job.)
- *Ho letto diversi libri su questo argomento.* (I've read several books on this subject.)`,
    drills: [
      {
        it: 'Luca è un [vecchio amico]: ci conosciamo dalle elementari.',
        en: "Luca is an old friend: we've known each other since primary school.",
        hint: 'amico + vecchio (long-standing)',
      },
      {
        it: 'Ti presento Marta, una mia [cara amica].',
        en: 'This is Marta, a dear friend of mine.',
        hint: 'amica + cara (dear)',
      },
      {
        it: 'È un [ristorante caro]: non possiamo andarci tutte le sere.',
        en: "It's an expensive restaurant: we can't go there every night.",
        hint: 'ristorante + caro (expensive)',
      },
      {
        it: 'Quel [povero ragazzo] ha perso il lavoro e la casa.',
        en: 'That poor boy has lost his job and his home.',
        hint: 'ragazzo + povero (unlucky)',
      },
      {
        it: 'Vengono da una [famiglia povera] e hanno cominciato a lavorare presto.',
        en: 'They come from a poor family and started working young.',
        hint: 'famiglia + povera (with no money)',
      },
      {
        it: 'Ho letto [diversi libri] su questo argomento.',
        en: "I've read several books on this subject.",
        hint: 'libri + diversi (several)',
      },
      {
        it: 'Io e mio fratello abbiamo [gusti diversi].',
        en: 'My brother and I have different tastes.',
        hint: 'gusti + diversi (different)',
      },
      {
        it: "Garibaldi fu un [grand'uomo].",
        en: 'Garibaldi was a great man.',
        hint: 'uomo + grande (great, important)',
        also: ['grande uomo'],
      },
      {
        it: 'Mio cugino è un [uomo grande] e grosso: è alto quasi due metri.',
        en: "My cousin is a big, burly man: he's almost two metres tall.",
        hint: 'uomo + grande (big, physically)',
      },
      {
        it: 'Hai comprato una [macchina nuova]? Sembra appena uscita dalla fabbrica.',
        en: "Have you bought a new car? It looks as if it's just come out of the factory.",
        hint: 'macchina + nuova (brand-new)',
      },
      {
        it: 'Ho venduto la Panda e ho preso una [nuova macchina], usata ma in buono stato.',
        en: 'I sold the Panda and got a new car, second-hand but in good condition.',
        hint: 'macchina + nuova (another, a different one)',
      },
      {
        it: 'Il [direttore stesso] è venuto a chiederci scusa.',
        en: 'The manager himself came to apologise to us.',
        hint: 'direttore + stesso (himself, in person)',
      },
    ],
  },
];
