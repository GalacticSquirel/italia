import type { GrammarPointSource } from '../types';

/** B2 grammar points in teaching order. */
export const B2_POINTS: readonly GrammarPointSource[] = [
  {
    id: 75,
    slug: 'subjunctive-imperfect',
    title: 'Imperfect subjunctive: volevo che tu venissi',
    cefr: 'B2',
    prerequisites: ['subjunctive-past', 'imperfetto'],
    noteMd: `**In short:** The imperfect subjunctive (*congiuntivo imperfetto*) is the past partner of the present subjunctive. You use it in the same kinds of sentences (wishes, opinions, doubts, feelings) when the main verb is in a past tense or in the conditional.

How to build it: take the imperfetto without *-vo* (*parla-vo*, *prende-vo*, *dormi-vo*) and add **-ssi, -ssi, -sse, -ssimo, -ste, -ssero**.

| | parlare | prendere | dormire |
|---|---|---|---|
| io | parlassi | prendessi | dormissi |
| tu | parlassi | prendessi | dormissi |
| lui, lei | parlasse | prendesse | dormisse |
| noi | parlassimo | prendessimo | dormissimo |
| voi | parlaste | prendeste | dormiste |
| loro | parlassero | prendessero | dormissero |

Verbs with a longer imperfetto stem keep it: *fare* gives *facessi*, *dire* gives *dicessi*, *bere* gives *bevessi*. *Avere* is regular: *avessi, avesse*.

The truly irregular ones:
- *essere*: fossi, fossi, fosse, fossimo, foste, fossero
- *dare*: dessi, dessi, desse, dessimo, deste, dessero
- *stare*: stessi, stessi, stesse, stessimo, steste, stessero

When to use it: the main verb is past or conditional and the action happens at the same time or later.
- *Penso che sia stanco.* becomes *Pensavo che fosse stanco.*
- *Vorrei che tu restassi.* (I'd like you to stay.)

**Watch out:** English says "I wanted you to come" with an infinitive. Italian needs *che* + subjunctive when the two people are different: *volevo che tu venissi*, never *volevo te venire*. Also, *io* and *tu* share one form, so add *tu* when the meaning is unclear.

Examples:
- *Volevo che tu venissi alla festa.* (I wanted you to come to the party.)
- *Pensavo che fosse italiano.* (I thought he was Italian.)
- *Vorrei che mi dicessi la verità.* (I'd like you to tell me the truth.)`,
    drills: [
      {
        it: 'Volevo che tu [venissi] con noi.',
        en: 'I wanted you to come with us.',
        hint: 'venire (imperfect subjunctive)',
      },
      {
        it: 'Pensavo che Marco [fosse] a casa.',
        en: 'I thought Marco was at home.',
        hint: 'essere (imperfect subjunctive)',
      },
      {
        it: 'Speravamo che [facesse] bel tempo.',
        en: 'We were hoping the weather would be nice.',
        hint: 'fare (imperfect subjunctive)',
      },
      {
        it: 'Mia madre voleva che io [studiassi] medicina.',
        en: 'My mother wanted me to study medicine.',
        hint: 'studiare (imperfect subjunctive)',
      },
      {
        it: 'Credevo che voi [aveste] già una macchina.',
        en: 'I thought you already had a car.',
        hint: 'avere (imperfect subjunctive, voi)',
      },
      {
        it: 'Vorrei che i miei figli [leggessero] di più.',
        en: "I'd like my children to read more.",
        hint: 'leggere (imperfect subjunctive)',
      },
      {
        it: 'Era strano che Anna non [dicesse] niente.',
        en: "It was strange that Anna didn't say anything.",
        hint: 'dire (imperfect subjunctive)',
      },
      {
        it: 'Il professore voleva che noi [arrivassimo] in orario.',
        en: 'The teacher wanted us to arrive on time.',
        hint: 'arrivare (imperfect subjunctive)',
      },
      {
        it: 'Avevo paura che tu non [capissi].',
        en: "I was afraid you wouldn't understand.",
        hint: 'capire (imperfect subjunctive)',
      },
      {
        it: 'Sarebbe meglio che Lei [stesse] a letto oggi.',
        en: 'It would be better if you stayed in bed today.',
        hint: 'stare (imperfect subjunctive, formal you)',
      },
      {
        it: 'Non pensavo che i biglietti [costassero] così tanto.',
        en: "I didn't think the tickets cost so much.",
        hint: 'costare (imperfect subjunctive)',
      },
      {
        it: 'Bisognava che qualcuno gli [desse] una mano.',
        en: 'Someone needed to give him a hand.',
        hint: 'dare (imperfect subjunctive)',
      },
    ],
  },
  {
    id: 76,
    slug: 'subjunctive-pluperfect',
    title: 'Pluperfect subjunctive: pensavo che fosse già partito',
    cefr: 'B2',
    prerequisites: ['subjunctive-imperfect', 'trapassato-prossimo'],
    noteMd: `**In short:** The pluperfect subjunctive (*congiuntivo trapassato*) means "had done" in a subjunctive sentence. Use it when the main verb is past or conditional and the other action happened **before** it.

How to build it: the imperfect subjunctive of *avere* or *essere* + the past participle (the *-ato, -uto, -ito* form). Choose *avere* or *essere* exactly as in the passato prossimo.

| | finire | uscire |
|---|---|---|
| io | avessi finito | fossi uscito/a |
| tu | avessi finito | fossi uscito/a |
| lui, lei | avesse finito | fosse uscito/a |
| noi | avessimo finito | fossimo usciti/e |
| voi | aveste finito | foste usciti/e |
| loro | avessero finito | fossero usciti/e |

With *essere*, the participle agrees with the subject (who does the action): *-o, -a, -i, -e*.

Pick the tense by timing:
- *Pensavo che mangiasse.* (I thought he was eating: same time.)
- *Pensavo che avesse mangiato.* (I thought he had eaten: earlier.)

**Watch out:** do not forget the agreement with *essere*: *Credevo che Giulia fosse partita*, not *fosse partito*. And do not use the passato prossimo form after a past main verb: *pensavo che sia partito* is a common slip; say *pensavo che fosse partito*.

Examples:
- *Pensavo che fosse già partito.* (I thought he had already left.)
- *Non sapevo che avessi cambiato casa.* (I didn't know you had moved house.)
- *Era contenta che fossimo venuti.* (She was happy we had come.)`,
    drills: [
      {
        it: 'Pensavo che Luca [fosse partito] ieri.',
        en: 'I thought Luca had left yesterday.',
        hint: 'partire (pluperfect subjunctive)',
      },
      {
        it: 'Credevo che tu [avessi finito] il lavoro.',
        en: 'I thought you had finished the work.',
        hint: 'finire (pluperfect subjunctive)',
      },
      {
        it: 'Non sapevo che Giulia [fosse arrivata].',
        en: "I didn't know Giulia had arrived.",
        hint: 'arrivare (pluperfect subjunctive)',
      },
      {
        it: 'Speravo che [aveste ricevuto] il mio messaggio.',
        en: 'I was hoping you had received my message.',
        hint: 'ricevere (pluperfect subjunctive, voi)',
      },
      {
        it: 'Dubitavo che lui [avesse detto] la verità.',
        en: 'I doubted that he had told the truth.',
        hint: 'dire (pluperfect subjunctive)',
      },
      {
        it: 'Nessuno credeva che io [avessi scritto] quel libro.',
        en: 'Nobody believed I had written that book.',
        hint: 'scrivere (pluperfect subjunctive)',
      },
      {
        it: 'Avevo paura che [avessimo sbagliato] strada.',
        en: 'I was afraid we had taken the wrong road.',
        hint: 'sbagliare (pluperfect subjunctive, noi)',
      },
      {
        it: 'Era strano che le mie amiche non [fossero venute].',
        en: "It was strange that my (female) friends hadn't come.",
        hint: 'venire (pluperfect subjunctive)',
      },
      {
        it: 'Mi sembrava che voi [foste usciti] presto.',
        en: 'It seemed to me that you had gone out early.',
        hint: 'uscire (pluperfect subjunctive, voi, a mixed group)',
      },
      {
        it: 'Pensavamo che il film [fosse cominciato] da un pezzo.',
        en: 'We thought the film had started a while ago.',
        hint: 'cominciare (pluperfect subjunctive)',
      },
      {
        it: 'Era possibile che i ragazzi [si fossero persi].',
        en: 'It was possible that the boys had got lost.',
        hint: 'perdersi (pluperfect subjunctive)',
      },
      {
        it: 'Ero contento che tu [fossi tornata].',
        en: 'I was happy that you had come back.',
        hint: 'tornare (pluperfect subjunctive, to a woman)',
      },
    ],
  },
  {
    id: 77,
    slug: 'sequence-of-tenses',
    title: 'Matching tenses with the subjunctive',
    cefr: 'B2',
    prerequisites: ['subjunctive-pluperfect'],
    noteMd: `**In short:** The tense of the subjunctive depends on two things: the tense of the main verb (the one before *che*), and whether the other action happens at the same time, later, or earlier. Italians call this *concordanza dei tempi*.

| Main verb | Same time or later | Earlier |
|---|---|---|
| present: *penso che* | *venga* | *sia venuto* |
| past: *pensavo che* | *venisse* | *fosse venuto* |
| conditional: *vorrei che* | *venisse* | *fosse venuto* |

So there are two families:
- Main verb in the present (or future, or imperative): use the **present** subjunctive, or the **past** subjunctive (*abbia fatto, sia andato*) for something earlier.
- Main verb in any past tense (imperfetto, passato prossimo) or in the conditional: use the **imperfect** subjunctive, or the **pluperfect** (*avesse fatto, fosse andato*) for something earlier.

Impersonal phrases work the same way: *è importante che venga*, but *era importante che venisse*.

For a future action seen from the past, Italian often uses the past conditional instead: *Ero sicuro che sarebbe venuto.* (I was sure he would come.)

**Watch out:** *vorrei che* talks about now, but it is a conditional, so it takes the imperfect subjunctive: *Vorrei che tu venissi*, never *vorrei che tu venga*. The same goes for *preferirei che*, *sarebbe meglio che*.

Examples:
- *Spero che tu stia bene.* (I hope you're well.)
- *Speravo che tu stessi bene.* (I was hoping you were well.)
- *Non credo che abbiano capito.* (I don't think they understood.)
- *Non credevo che avessero capito.* (I didn't think they had understood.)`,
    drills: [
      {
        it: 'Penso che Anna [sia] stanca oggi.',
        en: 'I think Anna is tired today.',
        hint: 'essere (main verb present, same time)',
      },
      {
        it: 'Pensavo che Anna [fosse] stanca.',
        en: 'I thought Anna was tired.',
        hint: 'essere (main verb past, same time)',
      },
      {
        it: 'Penso che Anna [sia partita] ieri.',
        en: 'I think Anna left yesterday.',
        hint: 'partire (main verb present, earlier action)',
      },
      {
        it: 'Pensavo che Anna [fosse partita] il giorno prima.',
        en: 'I thought Anna had left the day before.',
        hint: 'partire (main verb past, earlier action)',
      },
      {
        it: 'È importante che tutti [arrivino] puntuali domani.',
        en: 'It is important that everyone arrives on time tomorrow.',
        hint: 'arrivare (main verb present, later action)',
      },
      {
        it: 'Era importante che tutti [arrivassero] puntuali.',
        en: 'It was important for everyone to arrive on time.',
        hint: 'arrivare (main verb past, same time)',
      },
      {
        it: 'Vorrei che tu [restassi] a cena.',
        en: "I'd like you to stay for dinner.",
        hint: 'restare (main verb conditional)',
      },
      {
        it: 'Mi dispiace che tu non [sia potuto] venire.',
        en: "I'm sorry you couldn't come.",
        hint: 'potere (main verb present, earlier action, to a man)',
        also: ['abbia potuto'],
      },
      {
        it: 'Mi dispiaceva che tu non [potessi] venire.',
        en: "I was sorry you couldn't come.",
        hint: 'potere (main verb past, same time)',
      },
      {
        it: 'Non credo che loro [abbiano capito] la domanda.',
        en: "I don't think they understood the question.",
        hint: 'capire (main verb present, earlier action)',
      },
      {
        it: 'Non credevo che loro [avessero capito] la domanda.',
        en: "I didn't think they had understood the question.",
        hint: 'capire (main verb past, earlier action)',
      },
      {
        it: 'Preferirei che voi non [diceste] niente a nessuno.',
        en: "I'd rather you didn't say anything to anyone.",
        hint: 'dire (main verb conditional, voi)',
      },
    ],
  },
  {
    id: 78,
    slug: 'if-hypothetical',
    title: 'Unlikely conditions: se avessi tempo, viaggerei',
    cefr: 'B2',
    prerequisites: ['subjunctive-imperfect', 'conditional'],
    noteMd: `**In short:** To talk about something imaginary or unlikely, now or in the future ("if I had time, I would travel"), Italian uses **se + imperfect subjunctive** for the condition and the **conditional** for the result.

The pattern:
- *se* + imperfect subjunctive: *se avessi, se fossi, se potessi*
- result in the present conditional: *viaggerei, sarei, potrei*

The two halves can come in either order:
- *Se avessi tempo, viaggerei.*
- *Viaggerei, se avessi tempo.*

Compare the three degrees:
- Real, likely: *Se ho tempo, vengo.* (If I have time, I'll come.) Both verbs in the indicative.
- Unlikely or imaginary: *Se avessi tempo, verrei.* (If I had time, I would come.)
- Impossible, about the past: see the next point.

Useful chunks: *se fossi in te* (if I were you), *se potessi* (if I could), *sarebbe meglio se* (it would be better if).

**Watch out:** never put the conditional after *se*. *Se avrei tempo* is the most famous mistake in Italian, even among natives; say *se avessi tempo*. And English "if I were" or "if I was" is always *se fossi*.

Examples:
- *Se avessi più soldi, comprerei una casa al mare.* (If I had more money, I'd buy a house by the sea.)
- *Se fossi in te, accetterei.* (If I were you, I'd accept.)
- *Cosa faresti se vincessi alla lotteria?* (What would you do if you won the lottery?)`,
    drills: [
      {
        it: 'Se [avessi] tempo, viaggerei di più.',
        en: "If I had time, I'd travel more.",
        hint: 'avere (imperfect subjunctive, io)',
      },
      {
        it: 'Se fossi ricco, [comprerei] una casa al mare.',
        en: "If I were rich, I'd buy a house by the sea.",
        hint: 'comprare (conditional, io)',
      },
      {
        it: 'Se [fossi] in te, accetterei.',
        en: "If I were you, I'd accept.",
        hint: 'essere (imperfect subjunctive, io)',
      },
      {
        it: 'Se Marta [sapesse] la verità, si arrabbierebbe.',
        en: "If Marta knew the truth, she'd get angry.",
        hint: 'sapere (imperfect subjunctive)',
      },
      {
        it: 'Se vincessimo alla lotteria, [smetteremmo] di lavorare.',
        en: "If we won the lottery, we'd stop working.",
        hint: 'smettere (conditional, noi)',
      },
      {
        it: 'Che cosa [faresti] se perdessi il lavoro?',
        en: 'What would you do if you lost your job?',
        hint: 'fare (conditional, tu)',
      },
      {
        it: 'Se i miei genitori [abitassero] più vicino, li vedrei più spesso.',
        en: "If my parents lived closer, I'd see them more often.",
        hint: 'abitare (imperfect subjunctive)',
      },
      {
        it: 'Se voi [veniste] in Italia, potreste stare da noi.',
        en: 'If you came to Italy, you could stay with us.',
        hint: 'venire (imperfect subjunctive, voi)',
      },
      {
        it: 'Se non piovesse, [andremmo] al parco.',
        en: "If it weren't raining, we'd go to the park.",
        hint: 'andare (conditional, noi)',
      },
      {
        it: 'Se [potessi] scegliere, vivrei a Napoli.',
        en: "If I could choose, I'd live in Naples.",
        hint: 'potere (imperfect subjunctive, io)',
      },
      {
        it: 'Sarebbe meglio se [prendessimo] un taxi.',
        en: 'It would be better if we took a taxi.',
        hint: 'prendere (imperfect subjunctive, noi)',
      },
      {
        it: 'Se la gente [leggesse] di più, il mondo sarebbe migliore.',
        en: 'If people read more, the world would be a better place.',
        hint: 'leggere (imperfect subjunctive)',
      },
    ],
  },
  {
    id: 79,
    slug: 'if-past-unreal',
    title: 'Past unreal conditions: se avessi saputo, sarei venuto',
    cefr: 'B2',
    prerequisites: ['if-hypothetical', 'subjunctive-pluperfect', 'conditional-past'],
    noteMd: `**In short:** To imagine a different past ("if I had known, I would have come"), use **se + pluperfect subjunctive** for the condition and the **past conditional** for the result. The past cannot change, so both halves are unreal.

The pattern:
- *se* + pluperfect subjunctive: *se avessi saputo, se fossi partito*
- result in the past conditional: *sarei venuto, avrei detto*

Both halves choose *avere* or *essere* as in the passato prossimo, and with *essere* the participle agrees with the subject:
- *Se Laura fosse partita prima, sarebbe arrivata in tempo.* (If Laura had left earlier, she would have arrived in time.)

As before, the order can be swapped: *Sarei venuto, se avessi saputo.*

In relaxed speech you will often hear the imperfetto in both halves: *Se lo sapevo, venivo.* It is fine in conversation, but write the full form.

**Watch out:** English "would have" goes only in the result, never after *se*. *Se avrei saputo* and *se sarei venuto* are wrong; the *se* half always takes the subjunctive: *se avessi saputo*. Also check *essere* verbs: *se fossi arrivato*, not *se avessi arrivato*.

Examples:
- *Se avessi saputo, sarei venuto.* (If I had known, I would have come.)
- *Se non avesse piovuto, saremmo andati al mare.* (If it hadn't rained, we would have gone to the seaside.)
- *Se mi avessi chiamato, ti avrei aiutato.* (If you had called me, I would have helped you.)`,
    drills: [
      {
        it: 'Se [avessi saputo], sarei venuto.',
        en: 'If I had known, I would have come.',
        hint: 'sapere (pluperfect subjunctive, io)',
      },
      {
        it: 'Se avessi saputo, [sarei venuta] prima.',
        en: 'If I had known, I would have come earlier.',
        hint: 'venire (past conditional, a woman speaking)',
      },
      {
        it: 'Se tu [fossi arrivato] in orario, avremmo preso il treno.',
        en: 'If you had arrived on time, we would have caught the train.',
        hint: 'arrivare (pluperfect subjunctive, to a man)',
      },
      {
        it: 'Se avessimo prenotato, [avremmo trovato] posto.',
        en: 'If we had booked, we would have found a table.',
        hint: 'trovare (past conditional, noi)',
      },
      {
        it: "Se Paolo [avesse studiato] di più, avrebbe passato l'esame.",
        en: 'If Paolo had studied more, he would have passed the exam.',
        hint: 'studiare (pluperfect subjunctive)',
      },
      {
        it: 'Se non avesse piovuto, [saremmo andati] al mare.',
        en: "If it hadn't rained, we would have gone to the seaside.",
        hint: 'andare (past conditional, noi, a mixed group)',
      },
      {
        it: 'Se mi [avessi chiamato], ti avrei aiutato.',
        en: 'If you had called me, I would have helped you.',
        hint: 'chiamare (pluperfect subjunctive, tu)',
      },
      {
        it: 'Che cosa [avresti fatto] al mio posto?',
        en: 'What would you have done in my place?',
        hint: 'fare (past conditional, tu)',
      },
      {
        it: "Se i ragazzi [fossero partiti] prima, non avrebbero perso l'aereo.",
        en: "If the boys had left earlier, they wouldn't have missed the plane.",
        hint: 'partire (pluperfect subjunctive)',
      },
      {
        it: 'Se me lo aveste detto, [avrei potuto] fare qualcosa.',
        en: 'If you had told me, I could have done something.',
        hint: 'potere (past conditional, io)',
      },
      {
        it: 'Se Laura non [fosse uscita] con quel tempo, non si sarebbe ammalata.',
        en: "If Laura hadn't gone out in that weather, she wouldn't have got ill.",
        hint: 'uscire (pluperfect subjunctive)',
      },
      {
        it: 'Se avessi avuto più soldi, [avrei comprato] quella casa.',
        en: 'If I had had more money, I would have bought that house.',
        hint: 'comprare (past conditional, io)',
      },
    ],
  },
  {
    id: 80,
    slug: 'subjunctive-conjunctions',
    title: 'Subjunctive after benché, affinché, prima che, senza che',
    cefr: 'B2',
    prerequisites: ['subjunctive-imperfect', 'connectors'],
    noteMd: `**In short:** Some conjunctions (linking words that join two parts of a sentence) are always followed by the subjunctive. Learn them as a set.

| Conjunction | Meaning |
|---|---|
| *benché, sebbene, nonostante* | although |
| *affinché, perché* | so that |
| *prima che* | before |
| *senza che* | without |
| *purché, a condizione che* | provided that |
| *a meno che (non)* | unless |

The tense follows the usual rule: present or past subjunctive after a present main verb, imperfect or pluperfect after a past one.
- *Esco, benché piova.* (I'm going out, although it's raining.)
- *È uscito senza che nessuno lo vedesse.* (He went out without anyone seeing him.)

*Perché* with the subjunctive means "so that"; with the indicative it means "because": *Parlo piano perché dorme* (because he's sleeping) versus *Parlo piano perché non si svegli* (so that he doesn't wake up).

After *a meno che* Italians usually add a *non* that does not make the sentence negative: *a meno che non piova* (unless it rains).

**Watch out:** *prima che*, *senza che* and *affinché* are for two different subjects. When the subject is the same, use a preposition + infinitive (the *-are, -ere, -ire* form): *prima di partire*, *senza dire niente*, *per capire*. So "before I leave, I'll call you" is *prima di partire ti chiamo*, not *prima che io parta*.

Examples:
- *Benché fosse stanca, ha continuato a lavorare.* (Although she was tired, she kept working.)
- *Te lo spiego affinché tu capisca.* (I'm explaining it to you so that you understand.)
- *Ti presto la macchina, purché tu guidi con attenzione.* (I'll lend you the car, provided you drive carefully.)`,
    drills: [
      {
        it: 'Esco, benché [piova].',
        en: "I'm going out, although it's raining.",
        hint: 'piovere (present subjunctive)',
      },
      {
        it: 'Te lo spiego affinché tu [capisca].',
        en: "I'm explaining it to you so that you understand.",
        hint: 'capire (present subjunctive)',
      },
      {
        it: 'Torniamo a casa prima che [faccia] buio.',
        en: "Let's go home before it gets dark.",
        hint: 'fare (present subjunctive)',
      },
      {
        it: 'Ti presto la macchina, purché tu [guidi] con attenzione.',
        en: "I'll lend you the car, provided you drive carefully.",
        hint: 'guidare (present subjunctive)',
      },
      {
        it: 'Verrò alla festa, a meno che non [succeda] qualcosa.',
        en: "I'll come to the party unless something happens.",
        hint: 'succedere (present subjunctive)',
      },
      {
        it: 'È uscito senza che nessuno lo [vedesse].',
        en: 'He went out without anyone seeing him.',
        hint: 'vedere (imperfect subjunctive)',
      },
      {
        it: '[Sebbene] fosse stanca, ha continuato a lavorare.',
        en: 'Although she was tired, she kept working.',
        hint: 'although',
        also: ['benché', 'nonostante'],
      },
      {
        it: 'Ho parlato piano [affinché] il bambino non si svegliasse.',
        en: "I spoke quietly so that the baby wouldn't wake up.",
        hint: 'so that',
        also: ['perché'],
      },
      {
        it: 'Ti chiamo [prima che] tu parta.',
        en: "I'll call you before you leave.",
        hint: 'before (different subjects)',
      },
      {
        it: 'Lavorano tanto affinché i loro figli [possano] studiare.',
        en: 'They work hard so that their children can study.',
        hint: 'potere (present subjunctive)',
      },
      {
        it: "Benché [avessimo studiato] molto, l'esame è andato male.",
        en: 'Although we had studied a lot, the exam went badly.',
        hint: 'studiare (pluperfect subjunctive, noi)',
      },
      {
        it: 'Sono partiti [senza] salutare.',
        en: 'They left without saying goodbye.',
        hint: 'without (same subject)',
      },
    ],
  },
  {
    id: 81,
    slug: 'subjunctive-relative',
    title: 'Subjunctive in relative clauses: cerco qualcuno che sappia',
    cefr: 'B2',
    prerequisites: ['subjunctive-present', 'relative-che-cui'],
    noteMd: `**In short:** A relative clause (a part of the sentence starting with *che*, "who, which, that", describing a noun) takes the subjunctive when that person or thing is wanted, imagined or may not exist. When it really exists, use the indicative.

Compare:
- *Conosco una ragazza che parla cinese.* (I know a girl who speaks Chinese: she exists.)
- *Cerco una ragazza che parli cinese.* (I'm looking for a girl who speaks Chinese: any girl, if there is one.)

The subjunctive is used:
- after looking for, wanting, needing: *cerco, vorrei, ho bisogno di* + someone or something *che*...
- after a negative: *non c'è nessuno che*, *non ho trovato niente che*
- after a superlative or *l'unico, il primo, l'ultimo*: *il film più bello che abbia visto*, *l'unica persona che mi capisca*
- often in questions about whether something exists: *C'è qualcuno che sappia la strada?*

The tense follows the main verb as usual: *cerco qualcuno che sappia*, but *cercavo qualcuno che sapesse*.

**Watch out:** English uses the same verb form in both cases, so learners forget the switch. Ask yourself: do I have a real, specific person or thing in mind? If yes, indicative (*ho un collega che vive a Bologna*); if not, subjunctive (*cerco un collega che viva a Bologna*).

Examples:
- *Cerco qualcuno che sappia il tedesco.* (I'm looking for someone who knows German.)
- *Non c'è niente che io possa fare.* (There's nothing I can do.)
- *È il libro più bello che abbia mai letto.* (It's the best book I've ever read.)`,
    drills: [
      {
        it: 'Cerco qualcuno che [sappia] il cinese.',
        en: "I'm looking for someone who knows Chinese.",
        hint: 'sapere (present subjunctive)',
      },
      {
        it: 'Cerchiamo una casa che [abbia] un giardino.',
        en: "We're looking for a house that has a garden.",
        hint: 'avere (present subjunctive)',
      },
      {
        it: "Non c'è nessuno che [possa] aiutarmi.",
        en: "There's no one who can help me.",
        hint: 'potere (present subjunctive)',
      },
      {
        it: 'Conosco una ragazza che [parla] cinese.',
        en: 'I know a girl who speaks Chinese.',
        hint: 'parlare (she exists: indicative)',
      },
      {
        it: "Sei l'unica persona che mi [capisca] davvero.",
        en: "You're the only person who really understands me.",
        hint: 'capire (present subjunctive)',
      },
      {
        it: 'Abbiamo bisogno di un assistente che [sia] disponibile anche il sabato.',
        en: 'We need an assistant who is also available on Saturdays.',
        hint: 'essere (present subjunctive)',
      },
      {
        it: "C'è qualcuno qui che [conosca] la strada?",
        en: 'Is there anyone here who knows the way?',
        hint: 'conoscere (present subjunctive)',
      },
      {
        it: 'Ho un collega che [vive] a Bologna.',
        en: 'I have a colleague who lives in Bologna.',
        hint: 'vivere (he exists: indicative)',
      },
      {
        it: "È il libro più interessante che io [abbia letto] quest'anno.",
        en: "It's the most interesting book I've read this year.",
        hint: 'leggere (past subjunctive)',
      },
      {
        it: 'Cercavano un appartamento che non [costasse] troppo.',
        en: "They were looking for a flat that didn't cost too much.",
        hint: 'costare (imperfect subjunctive)',
      },
      {
        it: 'Non ho trovato niente che mi [piacesse].',
        en: "I didn't find anything I liked.",
        hint: 'piacere (imperfect subjunctive)',
      },
      {
        it: 'Era la città più bella che [avessimo visitato].',
        en: 'It was the most beautiful city we had visited.',
        hint: 'visitare (pluperfect subjunctive, noi)',
      },
    ],
  },
  {
    id: 82,
    slug: 'come-se',
    title: 'As if: come se + imperfect subjunctive',
    cefr: 'B2',
    prerequisites: ['subjunctive-pluperfect'],
    noteMd: `**In short:** *Come se* means "as if" or "as though". It is always followed by the imperfect or the pluperfect subjunctive, whatever the tense of the main verb.

Which one to use:
- **imperfect subjunctive** for something at the same time: *Parla come se fosse il capo.* (He talks as if he were the boss.)
- **pluperfect subjunctive** for something earlier: *Mangia come se non avesse mangiato da giorni.* (He eats as if he hadn't eaten for days.)

The main verb can be present, past or future; it does not change the choice:
- *Mi guarda come se non mi conoscesse.* (She looks at me as if she didn't know me.)
- *Mi guardava come se non mi conoscesse.* (She looked at me as if she didn't know me.)

A common set phrase: *Fai come se fossi a casa tua.* (Make yourself at home.) Another: *come se niente fosse* (as if nothing had happened, casually).

**Watch out:** English often says "as if he was" or "like he's the boss". Italian never uses the indicative or the present subjunctive here: not *come se è*, not *come se sia*, but *come se fosse*.

Examples:
- *Parla come se sapesse tutto.* (He talks as if he knew everything.)
- *Si comportavano come se niente fosse successo.* (They behaved as if nothing had happened.)
- *Mi sento come se avessi corso una maratona.* (I feel as if I had run a marathon.)`,
    drills: [
      {
        it: 'Parla come se [fosse] il capo.',
        en: 'He talks as if he were the boss.',
        hint: 'essere (after come se)',
      },
      {
        it: 'Mi guardi come se non mi [conoscessi].',
        en: "You look at me as if you didn't know me.",
        hint: 'conoscere (after come se, tu)',
      },
      {
        it: 'Spende come se [avesse] un sacco di soldi.',
        en: 'She spends as if she had loads of money.',
        hint: 'avere (after come se)',
      },
      {
        it: 'Ci trattano come se [fossimo] bambini.',
        en: 'They treat us as if we were children.',
        hint: 'essere (after come se, noi)',
      },
      {
        it: 'Fai come se [fossi] a casa tua.',
        en: 'Make yourself at home.',
        hint: 'essere (after come se, tu)',
      },
      {
        it: 'Parlavate come se [sapeste] tutto.',
        en: 'You were talking as if you knew everything.',
        hint: 'sapere (after come se, voi)',
      },
      {
        it: 'Correva come se lo [inseguisse] qualcuno.',
        en: 'He was running as if someone were chasing him.',
        hint: 'inseguire (after come se, same time)',
      },
      {
        it: 'Piove come se non [dovesse] smettere mai.',
        en: 'It is raining as if it were never going to stop.',
        hint: 'dovere (after come se)',
      },
      {
        it: 'Mangia come se non [avesse mangiato] da giorni.',
        en: "He eats as if he hadn't eaten for days.",
        hint: 'mangiare (after come se, earlier action)',
      },
      {
        it: 'Si comportavano come se niente [fosse successo].',
        en: 'They behaved as if nothing had happened.',
        hint: 'succedere (after come se, earlier action)',
      },
      {
        it: 'Mi sento come se [avessi corso] una maratona.',
        en: 'I feel as if I had run a marathon.',
        hint: 'correre (after come se, earlier action, io)',
      },
      {
        it: 'Ha reagito come se gli [avessi detto] una cosa terribile.',
        en: 'He reacted as if I had told him something terrible.',
        hint: 'dire (after come se, earlier action, io)',
      },
    ],
  },
  {
    id: 84,
    slug: 'passive-venire-andare',
    title: 'Passive with venire and andare: viene servito, va fatto',
    cefr: 'B2',
    prerequisites: ['passive-essere'],
    noteMd: `**In short:** Besides *essere*, Italian can make the passive with **venire** (to stress the action) and with **andare** (meaning "must be done").

**Venire + past participle** means the same as the *essere* passive, but it clearly describes an action, not a state:
- *La porta è chiusa.* (The door is closed: a state, or is being closed?)
- *La porta viene chiusa alle otto.* (The door is closed at eight: someone closes it.)

It is used only in simple (one-word) tenses of *venire*: *viene, veniva, verrà, verrebbe, venga*. In compound tenses use *essere*: *è stato servito*, never *è venuto servito*.

**Andare + past participle** means something must or should be done:
- *Questo lavoro va fatto entro domani.* (This work must be done by tomorrow.)
- *I documenti vanno firmati.* (The documents must be signed.)
- *Non va detto a nessuno.* (It mustn't be told to anyone.)

The participle agrees with the subject in both cases: *la cena viene servita*, *le verdure vanno lavate*.

With verbs of losing and destroying, *andare* simply means "get": *andare perso* (to get lost), *andare distrutto* (to be destroyed). Here compound tenses are fine: *molti libri sono andati persi*.

**Watch out:** *va fatto* has nothing to do with going. Read it as "needs to be done". And keep *venire* out of compound tenses.

Examples:
- *La cena viene servita alle otto.* (Dinner is served at eight.)
- *Questa medicina va presa dopo i pasti.* (This medicine must be taken after meals.)
- *Il pane veniva fatto in casa ogni mattina.* (Bread used to be made at home every morning.)`,
    drills: [
      {
        it: 'La cena [viene servita] alle otto.',
        en: 'Dinner is served at eight.',
        hint: 'servire (venire passive, present)',
      },
      {
        it: 'Questo lavoro [va fatto] entro domani.',
        en: 'This work must be done by tomorrow.',
        hint: 'fare (must be: andare passive)',
      },
      {
        it: 'I documenti [vanno firmati] in due copie.',
        en: 'The documents must be signed in two copies.',
        hint: 'firmare (must be: andare passive)',
      },
      {
        it: 'In Italia la pasta [viene cotta] al dente.',
        en: 'In Italy pasta is cooked al dente.',
        hint: 'cuocere (venire passive, present)',
      },
      {
        it: 'Le verdure [vanno lavate] bene prima di mangiarle.',
        en: 'Vegetables must be washed well before you eat them.',
        hint: 'lavare (must be: andare passive)',
      },
      {
        it: 'Ogni giorno [vengono vendute] migliaia di copie.',
        en: 'Thousands of copies are sold every day.',
        hint: 'vendere (venire passive, present)',
      },
      {
        it: 'Il pane [veniva fatto] in casa ogni mattina.',
        en: 'Bread used to be made at home every morning.',
        hint: 'fare (venire passive, imperfetto)',
      },
      {
        it: 'Questa medicina [va presa] dopo i pasti.',
        en: 'This medicine must be taken after meals.',
        hint: 'prendere (must be: andare passive)',
      },
      {
        it: 'I vincitori [verranno premiati] domenica.',
        en: 'The winners will be given their prizes on Sunday.',
        hint: 'premiare (venire passive, future)',
      },
      {
        it: 'Le domande [vanno presentate] entro il 30 giugno.',
        en: 'Applications must be submitted by 30 June.',
        hint: 'presentare (must be: andare passive)',
      },
      {
        it: 'Questa parola non [va scritta] con la maiuscola.',
        en: "This word shouldn't be written with a capital letter.",
        hint: 'scrivere (must be: andare passive)',
      },
      {
        it: 'Durante il trasloco molti libri [sono andati persi].',
        en: 'Many books got lost during the move.',
        hint: 'perdere (andare: get lost, passato prossimo)',
      },
    ],
  },
  {
    id: 85,
    slug: 'si-passivante',
    title: 'Passive si: si vendono biglietti',
    cefr: 'B2',
    prerequisites: ['si-impersonale', 'passive-essere'],
    noteMd: `**In short:** *Si* + a verb in the third person is the most common Italian passive in everyday speech: *si vendono biglietti* (tickets are sold). The verb agrees with the thing: singular for one thing, plural for several.

How it works:
- one thing: *si vende* una casa, *si parla* italiano
- several things: *si vendono* biglietti, *si parlano* quattro lingue

English often translates it with "you", "people" or "they": *Come si scrive?* (How do you spell it?) *A Natale si mangia il panettone.* (At Christmas people eat panettone.)

In compound tenses (two-word tenses) it always uses *essere*, and the participle agrees with the thing:
- *Si è venduta una sola casa.* (Only one house was sold.)
- *Si sono venduti molti biglietti.* (A lot of tickets were sold.)
- *Si sono trovate nuove soluzioni.* (New solutions were found.)

It works in every tense: *si scrivevano* (used to be written), *si decideranno* (will be decided).

Compare with the impersonal *si* you already know, which has no thing after it and stays singular: *Qui si vive bene.* (People live well here.)

**Watch out:** the verb must agree with the noun. *Si vende biglietti* and *si parla quattro lingue* are common slips, even in Italian shop signs; the correct forms are *si vendono biglietti* and *si parlano quattro lingue*.

Examples:
- *Qui si vendono biglietti dell'autobus.* (Bus tickets are sold here.)
- *In Svizzera si parlano quattro lingue.* (Four languages are spoken in Switzerland.)
- *Non si è trovata una soluzione.* (No solution was found.)`,
    drills: [
      {
        it: "Qui [si vendono] biglietti dell'autobus.",
        en: 'Bus tickets are sold here.',
        hint: 'vendere (passive si, present)',
      },
      {
        it: 'In Svizzera [si parlano] quattro lingue.',
        en: 'Four languages are spoken in Switzerland.',
        hint: 'parlare (passive si, present)',
      },
      {
        it: 'Da qui [si vede] il mare.',
        en: 'You can see the sea from here.',
        hint: 'vedere (passive si, present)',
      },
      {
        it: 'A Natale [si mangia] il panettone.',
        en: 'At Christmas people eat panettone.',
        hint: 'mangiare (passive si, present)',
      },
      {
        it: 'Come [si scrive] il tuo cognome?',
        en: 'How do you spell your surname?',
        hint: 'scrivere (passive si, present)',
      },
      {
        it: 'In questo ristorante [si usano] solo prodotti locali.',
        en: 'Only local produce is used in this restaurant.',
        hint: 'usare (passive si, present)',
      },
      {
        it: 'In quel negozio [si riparano] biciclette.',
        en: 'Bikes are repaired in that shop.',
        hint: 'riparare (passive si, present)',
      },
      {
        it: 'Una volta [si scrivevano] lettere a mano.',
        en: 'People used to write letters by hand.',
        hint: 'scrivere (passive si, imperfetto)',
      },
      {
        it: 'Domani [si decideranno] le date degli esami.',
        en: 'The exam dates will be decided tomorrow.',
        hint: 'decidere (passive si, future)',
      },
      {
        it: 'Non [si è trovata] una soluzione.',
        en: 'No solution was found.',
        hint: 'trovare (passive si, passato prossimo)',
      },
      {
        it: "L'anno scorso [si sono vendute] più biciclette che macchine.",
        en: 'Last year more bikes were sold than cars.',
        hint: 'vendere (passive si, passato prossimo)',
      },
      {
        it: 'Finalmente [si sono risolti] tutti i problemi.',
        en: 'All the problems have finally been solved.',
        hint: 'risolvere (passive si, passato prossimo)',
      },
    ],
  },
  {
    id: 86,
    slug: 'passato-remoto',
    title: 'Passato remoto: the narrative past',
    cefr: 'B2',
    prerequisites: ['passato-prossimo-vs-imperfetto'],
    noteMd: `**In short:** The *passato remoto* is a one-word past tense for completed events. It is the tense of history books, novels and fairy tales. In everyday speech most Italians use the passato prossimo instead, though it is still common in speech in the south and in Tuscany.

Regular forms:

| | parlare | dormire |
|---|---|---|
| io | parlai | dormii |
| tu | parlasti | dormisti |
| lui, lei | parlò | dormì |
| noi | parlammo | dormimmo |
| voi | parlaste | dormiste |
| loro | parlarono | dormirono |

Regular *-ere* verbs have two sets of forms (*credei* or *credetti*); most common *-ere* verbs are irregular anyway.

Irregular verbs usually change only in three persons, io, lui/lei and loro, and are regular in the others:
- *fare*: feci, facesti, fece, facemmo, faceste, fecero
- *avere*: ebbi, avesti, ebbe, avemmo, aveste, ebbero
- *essere* (fully irregular): fui, fosti, fu, fummo, foste, furono

More io forms to learn: *dissi* (dire), *venni* (venire), *vidi* (vedere), *presi* (prendere), *scrissi* (scrivere), *nacqui* (nascere), *vissi* (vivere), *decisi* (decidere), *dipinsi* (dipingere), *diedi* (dare), *stetti* (stare).

It is used like the passato prossimo, next to the imperfetto for background: *Quando arrivò, pioveva.* (When he arrived, it was raining.)

**Watch out:** the accent matters: *parlò* (he spoke) is not *parlo* (I speak), and *finì* (he finished) is not *fini*. For reading, learn the lui and loro forms first; they are the ones you meet most.

Examples:
- *Dante nacque a Firenze nel 1265.* (Dante was born in Florence in 1265.)
- *La guerra finì nel 1945.* (The war ended in 1945.)
- *Disse che era stanco e se ne andò.* (He said he was tired and left.)`,
    drills: [
      {
        it: 'Cristoforo Colombo [arrivò] in America nel 1492.',
        en: 'Christopher Columbus reached America in 1492.',
        hint: 'arrivare (passato remoto)',
      },
      {
        it: 'La guerra [finì] nel 1945.',
        en: 'The war ended in 1945.',
        hint: 'finire (passato remoto)',
      },
      {
        it: 'Dante [nacque] a Firenze nel 1265.',
        en: 'Dante was born in Florence in 1265.',
        hint: 'nascere (passato remoto)',
      },
      {
        it: 'Garibaldi [fu] un grande generale.',
        en: 'Garibaldi was a great general.',
        hint: 'essere (passato remoto)',
      },
      {
        it: 'I miei nonni [emigrarono] in Argentina negli anni Cinquanta.',
        en: 'My grandparents emigrated to Argentina in the fifties.',
        hint: 'emigrare (passato remoto, loro)',
      },
      {
        it: "Leonardo [dipinse] la Gioconda all'inizio del Cinquecento.",
        en: 'Leonardo painted the Mona Lisa in the early 1500s.',
        hint: 'dipingere (passato remoto)',
      },
      {
        it: '«Non è vero», [disse] lei a bassa voce.',
        en: '"It isn\'t true," she said quietly.',
        hint: 'dire (passato remoto)',
      },
      {
        it: 'Quando [vide] il lupo, Cappuccetto Rosso ebbe paura.',
        en: 'When she saw the wolf, Little Red Riding Hood was afraid.',
        hint: 'vedere (passato remoto)',
      },
      {
        it: 'Quella sera [facemmo] una lunga passeggiata sulla spiaggia.',
        en: 'That evening we went for a long walk on the beach.',
        hint: 'fare (passato remoto, noi)',
      },
      {
        it: 'Dopo la laurea [vissi] due anni a Londra.',
        en: 'After my degree I lived in London for two years.',
        hint: 'vivere (passato remoto, io)',
      },
      {
        it: 'Perché non [veniste] al matrimonio di Carlo?',
        en: "Why didn't you come to Carlo's wedding?",
        hint: 'venire (passato remoto, voi)',
      },
      {
        it: 'Quando [ebbero] la notizia, i ragazzi partirono subito.',
        en: 'When they got the news, the boys left at once.',
        hint: 'avere (passato remoto, loro)',
      },
    ],
  },
  {
    id: 87,
    slug: 'reported-speech',
    title: 'Reported speech: ha detto che sarebbe venuto',
    cefr: 'B2',
    prerequisites: ['sequence-of-tenses', 'conditional-past'],
    noteMd: `**In short:** Reported speech (*discorso indiretto*) tells what someone said without quoting them: "Marco said he was tired". When the reporting verb (*ha detto, disse, diceva*) is in the past, the verbs inside move one step back in time.

| They said | Reported after *ha detto che* |
|---|---|
| *Sono stanco.* | *era stanco* |
| *Ho finito.* | *aveva finito* |
| *Verrò.* | *sarebbe venuto* |
| *Vieni!* | *di venire* |

So:
- present becomes imperfetto
- passato prossimo becomes trapassato prossimo (*aveva finito*)
- future becomes past conditional (*sarebbe venuto*)
- present subjunctive becomes imperfect subjunctive
- an order (imperative) becomes *di* + infinitive: *mi ha detto di tornare presto*. *Che* + imperfect subjunctive (*mi ha detto che tornassi presto*) also exists, but it is formal and old-fashioned
- a yes or no question uses *se* (if): *mi ha chiesto se volevo un caffè*

Pronouns, possessives and time words change too: *io* becomes *lui* or *lei*, *qui* becomes *lì*, *oggi* becomes *quel giorno*, *domani* becomes *il giorno dopo*, *ieri* becomes *il giorno prima*.

If the reporting verb is in the present (*dice che*), nothing moves: *Dice che è stanco.*

**Watch out:** English "he said he would come" uses "would", but Italian needs the **past** conditional here: *ha detto che sarebbe venuto*. *Ha detto che verrebbe* sounds wrong to a careful speaker.

Examples:
- *Luca ha detto che sarebbe venuto alla festa.* (Luca said he would come to the party.)
- *Giulia mi ha detto che aveva finito il progetto.* (Giulia told me she had finished the project.)
- *La professoressa ci ha detto di studiare di più.* (The teacher told us to study more.)`,
    drills: [
      {
        it: 'Marco ha detto che [era] stanco.',
        en: 'Marco said he was tired.',
        hint: 'essere (reported: «Sono stanco»)',
      },
      {
        it: 'Dice che non [ha] tempo.',
        en: "He says he doesn't have time.",
        hint: 'avere (reported now: «Non ho tempo»)',
      },
      {
        it: 'Giulia mi ha detto che [aveva finito] il progetto.',
        en: 'Giulia told me she had finished the project.',
        hint: 'finire (reported: «Ho finito il progetto»)',
      },
      {
        it: 'Luca ha detto che [sarebbe venuto] alla festa.',
        en: 'Luca said he would come to the party.',
        hint: 'venire (reported: «Verrò alla festa»)',
      },
      {
        it: 'Mi hanno detto che il treno [partiva] alle sei.',
        en: 'They told me the train left at six.',
        hint: 'partire (reported: «Il treno parte alle sei»)',
      },
      {
        it: 'Mi ha chiesto se [volevo] un caffè.',
        en: 'He asked me if I wanted a coffee.',
        hint: 'volere (reported: «Vuoi un caffè?»)',
        also: ['volessi'],
      },
      {
        it: 'La professoressa ci ha detto [di studiare] di più.',
        en: 'The teacher told us to study more.',
        hint: 'studiare (reported: «Studiate di più!»)',
        also: ['che studiassimo'],
      },
      {
        it: 'Anna ha scritto che [sarebbe arrivata] il giorno dopo.',
        en: 'Anna wrote that she would arrive the next day.',
        hint: 'arrivare (reported: «Arriverò domani»)',
      },
      {
        it: 'I miei vicini hanno detto che [avevano venduto] la casa.',
        en: 'My neighbours said they had sold the house.',
        hint: 'vendere (reported: «Abbiamo venduto la casa»)',
      },
      {
        it: 'Mi ha chiesto dove [avevo messo] le chiavi.',
        en: 'She asked me where I had put the keys.',
        hint: 'mettere (reported: «Dove hai messo le chiavi?»)',
        also: ['avessi messo'],
      },
      {
        it: 'Le previsioni dicevano che [avrebbe piovuto] tutto il fine settimana.',
        en: 'The forecast said it would rain all weekend.',
        hint: 'piovere (reported: «Pioverà tutto il fine settimana»)',
        also: ['sarebbe piovuto'],
      },
      {
        it: 'Sara ha detto che sperava che io [venissi] alla festa.',
        en: 'Sara said she hoped I would come to the party.',
        hint: 'venire (reported: «Spero che tu venga alla festa»)',
      },
    ],
  },
  {
    id: 89,
    slug: 'relatives-advanced',
    title: 'Il quale, chi, quello che, ciò che',
    cefr: 'B2',
    prerequisites: ['relative-che-cui'],
    noteMd: `**In short:** Besides *che* and *cui*, Italian has *il quale* (a more formal "who, which"), *chi* ("whoever, the person who") and *quello che* or *ciò che* ("what, the thing that").

**Il quale** agrees with the noun it refers to: *il quale, la quale, i quali, le quali*. It can replace *che* or *cui*, and it combines with prepositions and their articles: *con la quale, del quale, per i quali, alla quale*.
- *Ecco la collega con la quale lavoro.* (= *con cui lavoro*)
It is more formal, and useful when *che* would be unclear, because it shows gender and number: *la sorella di Marco, la quale vive a Parigi* (the sister lives in Paris, not Marco).

**Chi** means "the person who" or "whoever". It takes a singular verb and is common in proverbs and rules:
- *Chi cerca trova.* (Seek and you shall find.)
- *C'è chi preferisce il mare.* (Some people prefer the sea.)

**Quello che** and **ciò che** mean "what" in the sense "the thing that". They are interchangeable; *ciò che* is a little more written. *Tutto quello che* or *tutto ciò che* means "everything that".
- *Non ho capito quello che hai detto.* (I didn't understand what you said.)

**Watch out:** English "what" in the middle of a sentence is not *che* or *cosa* here: "What I need is rest" is *Quello che mi serve è riposo*. And "those who" with *chi* stays singular: *chi arriva tardi*, not *chi arrivano tardi*.

Examples:
- *Ti dirò tutto quello che so.* (I'll tell you everything I know.)
- *Chi arriva tardi non trova posto.* (Whoever arrives late won't find a seat.)
- *Sono i motivi per i quali ho rinunciato.* (These are the reasons why I gave up.)`,
    drills: [
      { it: '[Chi] cerca trova.', en: 'Seek and you shall find.', hint: 'whoever' },
      {
        it: 'Non ho capito [quello che] hai detto.',
        en: "I didn't understand what you said.",
        hint: 'what (the thing that)',
        also: ['ciò che'],
      },
      {
        it: '[Chi] arriva tardi non trova posto.',
        en: "Whoever arrives late won't find a seat.",
        hint: 'whoever',
      },
      {
        it: '[Ciò che] mi preoccupa è il prezzo.',
        en: 'What worries me is the price.',
        hint: 'what (the thing that)',
        also: ['quello che'],
      },
      {
        it: 'Ti dirò [tutto quello che] so.',
        en: "I'll tell you everything I know.",
        hint: 'everything that',
        also: ['tutto ciò che'],
      },
      {
        it: "C'è [chi] preferisce il mare e chi la montagna.",
        en: 'Some people prefer the sea and others the mountains.',
        hint: 'some people (the person who)',
      },
      {
        it: 'Ho scritto al professore, [il quale] mi ha risposto subito.',
        en: 'I wrote to the professor, who replied straight away.',
        hint: 'who (il quale form)',
      },
      {
        it: 'Ecco la collega [con la quale] lavoro.',
        en: "Here's the colleague I work with.",
        hint: 'with whom (il quale form)',
      },
      {
        it: 'Mi hanno presentato la sorella di Marco, [la quale] vive a Parigi.',
        en: "I was introduced to Marco's sister, who lives in Paris.",
        hint: 'who (il quale form, so it is clear who lives there)',
      },
      {
        it: 'La ditta [della quale] ti ho parlato ha chiuso.',
        en: 'The company I told you about has closed down.',
        hint: 'about which (il quale form)',
      },
      {
        it: 'Sono questi i motivi [per i quali] ho rinunciato.',
        en: 'These are the reasons why I gave up.',
        hint: 'for which (il quale form)',
      },
      {
        it: '[Quello che] non sopporto è la maleducazione.',
        en: "What I can't stand is rudeness.",
        hint: 'what (the thing that)',
        also: ['ciò che'],
      },
    ],
  },
  {
    id: 90,
    slug: 'pronominal-verbs',
    title: 'Pronominal verbs: andarsene, farcela, cavarsela',
    cefr: 'B2',
    prerequisites: ['combined-pronouns', 'ci-uses', 'ne-uses'],
    noteMd: `**In short:** Some very common verbs come with one or two pronouns glued on, and this changes their meaning: *andarsene* (to leave), *farcela* (to manage), *cavarsela* (to get by). You learn them as fixed expressions.

**Andarsene** (to go away, leave): *me ne vado, te ne vai, se ne va, ce ne andiamo, ve ne andate, se ne vanno*. Passato prossimo with *essere*: *me ne sono andato/a*. Imperative: *vattene!* (go away!), *andiamocene* (let's go).

**Farcela** (to manage, to make it, to cope): *ce la faccio, ce la fai, ce la fa, ce la facciamo, ce la fate, ce la fanno*. Passato prossimo: *ce l'ho fatta* (I made it).

**Cavarsela** (to get by, to cope all right): *me la cavo, te la cavi, se la cava, ce la caviamo, ve la cavate, se la cavano*. Passato prossimo: *me la sono cavata*.

A few more:
- *prendersela* (to get upset, take offence): *Non te la prendere!* *Se l'è presa.*
- *avercela con qualcuno* (to be angry with someone): *Ce l'hai con me?*
- *fregarsene* (not to care, informal): *Me ne frego.*

Notice the spelling: *mi, ti, si, ci, vi* become *me, te, se, ce, ve* before *ne* and *la*.

**Watch out:** in compound tenses the participle of the *-la* verbs is always feminine, because it agrees with *la*: *ce l'abbiamo fatta*, *Marco se l'è cavata*, never *fatto* or *cavato*. With *andarsene* it agrees with the subject: *Giulia se n'è andata*.

Examples:
- *È tardi, me ne vado.* (It's late, I'm off.)
- *Non ce la faccio più!* (I can't take any more!)
- *Con l'inglese me la cavo.* (I get by in English.)`,
    drills: [
      {
        it: 'È tardi, io [me ne vado].',
        en: "It's late, I'm off.",
        hint: 'andarsene (present, io)',
      },
      {
        it: 'Non [ce la faccio] più!',
        en: "I can't take it any more!",
        hint: 'farcela (present, io)',
      },
      {
        it: "Con l'inglese [me la cavo] abbastanza bene.",
        en: 'I get by quite well in English.',
        hint: 'cavarsela (present, io)',
      },
      {
        it: 'Perché [te ne vai] così presto?',
        en: 'Why are you leaving so early?',
        hint: 'andarsene (present, tu)',
      },
      {
        it: "Perché [ce l'hai] con me?",
        en: 'Why are you angry with me?',
        hint: 'avercela (present, tu)',
      },
      {
        it: 'Secondo te, [ce la faranno] a finire in tempo?',
        en: "Do you think they'll manage to finish in time?",
        hint: 'farcela (future, loro)',
      },
      {
        it: "Finalmente [ce l'abbiamo fatta]!",
        en: 'We finally made it!',
        hint: 'farcela (passato prossimo, noi)',
      },
      {
        it: 'Gli ospiti [se ne sono andati] a mezzanotte.',
        en: 'The guests left at midnight.',
        hint: 'andarsene (passato prossimo, loro)',
      },
      {
        it: "All'esame Sara [se l'è cavata] bene.",
        en: 'Sara did all right in the exam.',
        hint: 'cavarsela (passato prossimo, lei)',
      },
      {
        it: "Marco [se l'è presa] per quello che ho detto.",
        en: 'Marco took offence at what I said.',
        hint: 'prendersela (passato prossimo, lui)',
      },
      {
        it: 'Non [prendertela], scherzavo!',
        en: "Don't get upset, I was joking!",
        hint: 'prendersela (negative imperative, tu)',
        also: ['te la prendere'],
      },
      {
        it: '[Andiamocene], questo posto è noioso.',
        en: "Let's get out of here, this place is boring.",
        hint: 'andarsene (imperative, noi)',
      },
    ],
  },
  {
    id: 91,
    slug: 'causative-fare',
    title: 'Fare + infinitive: faccio riparare la macchina',
    cefr: 'B2',
    prerequisites: ['combined-pronouns'],
    noteMd: `**In short:** *Fare* + an infinitive (the dictionary form of a verb) means "to have something done" or "to make someone do something": *Faccio riparare la macchina.* (I'm having the car repaired.) *Mi fa ridere.* (He makes me laugh.)

How it works:
- *fare* changes for person and tense; the infinitive never changes: *faccio riparare, ho fatto riparare, farò riparare*.
- the person made to act is a direct object (*lo, la, li, le*) if there is no other object: *La faccio ridere.* (I make her laugh.)
- if there is also a thing, the person takes *a* and becomes indirect (*gli, le*): *Faccio leggere il libro a Marco.* becomes *Glielo faccio leggere.*

For something done for yourself, use **farsi** + infinitive, with *essere* in compound tenses: *Mi faccio tagliare i capelli.* (I'm getting my hair cut.) *Mi sono fatta tagliare i capelli.* (I had my hair cut, said by a woman.)

Pronouns go before *fare*, or attach to it in the imperative and infinitive: *fallo entrare* (let him in), *voglio farti vedere una cosa*. Before another infinitive, *fare* is often shortened to *far*: *far vedere* (to show).

In the passato prossimo, the participle agrees with a *lo, la, li, le* before it: *La lavatrice? L'ho fatta riparare.*

**Watch out:** the pronouns belong to *fare*, not to the second verb: *la faccio riparare*, never *faccio ripararla*. And English "get" or "have" something done is not *avere*: say *ho fatto riparare*, not *ho avuto riparato*.

Examples:
- *Il film mi ha fatto piangere.* (The film made me cry.)
- *Dove hai fatto stampare le foto?* (Where did you get the photos printed?)
- *Non farmi aspettare!* (Don't keep me waiting!)`,
    drills: [
      {
        it: 'Domani [faccio riparare] la macchina.',
        en: "Tomorrow I'm getting the car repaired.",
        hint: 'riparare (fare + infinitive, present, io)',
      },
      {
        it: 'Le sue battute [ci fanno ridere].',
        en: 'His jokes make us laugh.',
        hint: 'ridere (fare + infinitive, present, us)',
      },
      {
        it: 'Il film mi [ha fatto piangere].',
        en: 'The film made me cry.',
        hint: 'piangere (fare + infinitive, passato prossimo)',
      },
      {
        it: 'Il capo [ci fa lavorare] anche il sabato.',
        en: 'The boss makes us work on Saturdays too.',
        hint: 'lavorare (fare + infinitive, present, us)',
      },
      {
        it: 'Dove [hai fatto stampare] le foto?',
        en: 'Where did you get the photos printed?',
        hint: 'stampare (fare + infinitive, passato prossimo, tu)',
      },
      {
        it: 'La professoressa [ci ha fatto leggere] un romanzo di Calvino.',
        en: 'The teacher had us read a Calvino novel.',
        hint: 'leggere (fare + infinitive, passato prossimo, us)',
      },
      {
        it: '[Fallo entrare], per favore.',
        en: 'Let him in, please.',
        hint: 'entrare (fare + infinitive, imperative tu, him)',
      },
      {
        it: 'Voglio [far vedere] le foto a mia madre.',
        en: 'I want to show the photos to my mother.',
        hint: 'vedere (fare + infinitive: show)',
        also: ['fare vedere'],
      },
      {
        it: 'Non [farmi aspettare]!',
        en: "Don't keep me waiting!",
        hint: 'aspettare (fare + infinitive, negative imperative tu, me)',
        also: ['mi far aspettare', 'mi fare aspettare'],
      },
      {
        it: 'Ieri [mi sono fatta tagliare] i capelli.',
        en: 'Yesterday I had my hair cut.',
        hint: 'tagliare (farsi + infinitive, passato prossimo, a woman speaking)',
      },
      {
        it: "La lavatrice era rotta, così [l'ho fatta riparare].",
        en: 'The washing machine was broken, so I had it repaired.',
        hint: 'riparare (fare + infinitive, passato prossimo, io, it)',
      },
      {
        it: "Ho finito la tesi e [l'ho fatta leggere] al mio professore.",
        en: 'I finished my thesis and had my professor read it.',
        hint: 'leggere (fare + infinitive, passato prossimo, io, it)',
      },
    ],
  },
  {
    id: 92,
    slug: 'dislocation-cleft',
    title: "Highlighting: il libro l'ho letto, è lui che...",
    cefr: 'B2',
    prerequisites: ['direct-object-pronouns', 'relative-che-cui'],
    noteMd: `**In short:** Spoken Italian often moves a word to the front to make it the topic, then repeats it with a pronoun: *Il libro l'ho letto.* (The book, I've read it.) To stress who or what, it uses *è ... che*: *È Marco che ha chiamato.* (It was Marco who called.)

**Moving the object to the front.** When the direct object (the "what?" of the verb) comes first, you must repeat it with *lo, la, li, le* before the verb:
- *Il caffè lo prendo senza zucchero.*
- *La pasta la compro io.*
- *Le chiavi le ho perse.* (the participle agrees, as usual with *lo, la, li, le*)

The same happens with *ne* for amounts and *di* phrases (*Di soldi non ne ho*), with *ci* for places (*A Roma ci sono stato*), and with indirect objects (*A Luca gli ho scritto* is very common in speech; *A Luca ho scritto* is safer in writing).

The topic can also come at the end, as an afterthought: *L'hai vista, la nuova casa?*

**Stressing one element (cleft sentences).** Use *è* + the stressed part + *che*:
- *È Marco che ha telefonato, non Luca.*
- *È per questo che non sono venuto.* (That's why I didn't come.)
For the subject, *è stato ... a* + infinitive is very natural: *È stata mia sorella a dirmelo.* (It was my sister who told me.)

**Watch out:** English can say "The book I've read" with no pronoun, but in Italian an object moved to the front needs its pronoun: *Il libro l'ho letto*, not *Il libro ho letto* (that sounds like a strong contrast, or simply odd).

Examples:
- *Quel film l'ho visto due volte.* (I've seen that film twice.)
- *I compiti li fai dopo.* (You'll do your homework later.)
- *È lui che mi ha aiutato.* (He's the one who helped me.)`,
    drills: [
      {
        it: 'Il caffè [lo prendo] senza zucchero.',
        en: 'I take my coffee without sugar.',
        hint: 'prendere (present, io, with object pronoun)',
      },
      {
        it: 'La pasta [la compro] io.',
        en: "I'll buy the pasta.",
        hint: 'comprare (present, io, with object pronoun)',
      },
      {
        it: "Quel libro [l'ho letto] l'anno scorso.",
        en: 'I read that book last year.',
        hint: 'leggere (passato prossimo, io, with object pronoun)',
      },
      {
        it: 'Le chiavi [le ho perse] di nuovo.',
        en: "I've lost the keys again.",
        hint: 'perdere (passato prossimo, io, with object pronoun)',
      },
      {
        it: 'Quelle foto [le abbiamo stampate] ieri.',
        en: 'We printed those photos yesterday.',
        hint: 'stampare (passato prossimo, noi, with object pronoun)',
      },
      {
        it: 'Di soldi non [ne ho].',
        en: "I haven't got any money.",
        hint: 'avere (present, io, with the pronoun for "of it")',
      },
      {
        it: 'A Roma [ci sono stato] tre volte.',
        en: "I've been to Rome three times.",
        hint: 'essere (passato prossimo, a man speaking, with the pronoun for "there")',
      },
      {
        it: "[L'hai vista], la nuova casa di Anna?",
        en: "Have you seen Anna's new house?",
        hint: 'vedere (passato prossimo, tu, with object pronoun)',
      },
      {
        it: "Ai tuoi genitori, [gliel'hai detto]?",
        en: 'Have you told your parents?',
        hint: 'dire (passato prossimo, tu, it to them)',
        also: ['glielo hai detto'],
      },
      {
        it: 'È Marco [che] ha telefonato, non Luca.',
        en: 'It was Marco who phoned, not Luca.',
        hint: 'who (cleft sentence with è)',
      },
      {
        it: 'È per questo [che] non sono venuto.',
        en: "That's why I didn't come.",
        hint: 'that (cleft sentence with è)',
      },
      {
        it: 'È stata mia sorella [a] dirmelo.',
        en: 'It was my sister who told me.',
        hint: 'preposition after è stato + person (+ infinitive)',
      },
    ],
  },
  {
    id: 93,
    slug: 'altered-nouns',
    title: 'Suffixes: -ino, -etto, -one, -accio',
    cefr: 'B2',
    prerequisites: ['noun-gender-number'],
    noteMd: `**In short:** Italian adds endings to nouns to make them small, big or bad, often with feeling: *gatto* (cat) becomes *gattino* (kitten), *libro* becomes *librone* (big book), *tempo* becomes *tempaccio* (awful weather).

Drop the final vowel and add the suffix (the added ending). It still agrees in gender and number.

| Suffix | Meaning | Example |
|---|---|---|
| *-ino, -ina* | small, cute | *gattino, manina* |
| *-etto, -etta* | small | *casetta, laghetto* |
| *-one, -ona* | big | *librone, nasone* |
| *-accio, -accia* | bad, ugly | *tempaccio, parolaccia* |

Some notes:
- After *c* and *g*, add *h* to keep the hard sound: *lago* gives *laghetto*, *barca* gives *barchetta*.
- For family, *-ino* often means younger: *fratellino* (little brother), *sorellina*.
- *-accio* can be playful for people: *ragazzaccio* (naughty boy).
- *-one* often turns a feminine noun masculine: *la porta* gives *il portone* (main door of a building).

Many altered words have become ordinary words with their own meaning: *panino* (sandwich, from *pane*), *ombrellone* (beach umbrella), *portone* (front door), *telefonino* (mobile phone), *parolaccia* (swear word).

**Watch out:** you cannot add any suffix to any word. Some forms do not exist, and some mean something else: *burrone* is a ravine, not a lot of butter, and *mulino* is a mill, not a small mule. Use the ones you have heard, and learn the fixed words as new vocabulary.

Examples:
- *Abbiamo trovato un gattino sotto la macchina.* (We found a kitten under the car.)
- *Che tempaccio oggi!* (What awful weather today!)
- *Ho un fratellino di sei anni.* (I've got a little brother who's six.)`,
    drills: [
      {
        it: 'Abbiamo trovato un [gattino] sotto la macchina.',
        en: 'We found a kitten under the car.',
        hint: 'gatto (small, cute)',
      },
      { it: 'Che [tempaccio] oggi!', en: 'What awful weather today!', hint: 'tempo (bad)' },
      {
        it: 'Ho un [fratellino] di sei anni.',
        en: "I've got a little brother who's six.",
        hint: 'fratello (small: younger)',
      },
      {
        it: 'Vivono in una [casetta] in montagna.',
        en: 'They live in a little house in the mountains.',
        hint: 'casa (small)',
        also: ['casina'],
      },
      {
        it: 'Mi passi quel [librone] sullo scaffale?',
        en: 'Can you pass me that big book on the shelf?',
        hint: 'libro (big)',
      },
      {
        it: "Nel parco c'è un [laghetto] con le anatre.",
        en: "There's a little lake with ducks in the park.",
        hint: 'lago (small, with -etto)',
      },
      {
        it: 'Non dire [parolacce] davanti ai bambini!',
        en: "Don't swear in front of the children!",
        hint: 'parola (bad, plural)',
      },
      {
        it: 'Che [ragazzaccio]! Ha rotto di nuovo la finestra.',
        en: "What a naughty boy! He's broken the window again.",
        hint: 'ragazzo (bad)',
      },
      {
        it: 'La neonata ha delle [manine] bellissime.',
        en: 'The newborn baby girl has beautiful little hands.',
        hint: 'mano (small, cute, plural)',
      },
      {
        it: 'Ogni bambino scrive una [letterina] a Babbo Natale.',
        en: 'Every child writes a little letter to Father Christmas.',
        hint: 'lettera (small, cute)',
      },
      {
        it: 'Ho mangiato un [panino] al prosciutto.',
        en: 'I had a ham sandwich.',
        hint: 'pane (small: sandwich)',
      },
      {
        it: 'Al mare abbiamo affittato un [ombrellone].',
        en: 'We rented a beach umbrella at the seaside.',
        hint: 'ombrello (big: beach umbrella)',
      },
    ],
  },
];
