import type { GrammarPointSource } from '../types';

/** C2 grammar points in teaching order. */
export const C2_POINTS: readonly GrammarPointSource[] = [
  {
    id: 109,
    slug: 'literary-forms',
    title: 'Literary and bureaucratic forms: egli, esso, codesto, vendesi',
    cefr: 'C2',
    prerequisites: ['passato-remoto'],
    noteMd: `**In short:** novels, history books, laws and official notices use forms you will rarely hear in conversation. You mostly need to recognise them, and to use a few in formal writing.

Subject pronouns (the word for who does the action) of written Italian:

| meaning | literary / formal | everyday |
|---|---|---|
| he, she | *egli, ella* | *lui, lei* |
| it (thing, animal) | *esso, essa* | usually left out |
| they | *essi, esse* | *loro* |

- *egli* and *ella* are only for people and only as subjects; *ella* is now very old-fashioned.
- *esso* and *essa* are mainly for things and animals; *essi* and *esse* are used for people as well as things: *Il regolamento è stato approvato: esso entrerà in vigore a gennaio.*

Demonstratives (words like "this", "that"):
- *codesto* means "that, near you". Outside Tuscany it survives in official letters: *codesto Ufficio* (your office).
- *costui, costei* (this man, this woman), often with a scornful tone: *Chi è costui?*
- *colui, colei* (the one), mostly in *colui che* (he who), *colei che* (she who).
- *coloro che* (those who): *Coloro che desiderano partecipare...*

Bureaucratic words: *suddetto* (above-mentioned), *medesimo* (same), *il sottoscritto* (the undersigned).

Signs and ads attach *si* to the end of the verb: *vendesi* (for sale), *affittasi* (to let), *cercasi* (wanted).

**Watch out:** do not use *egli* or *esso* in speech or in an informal email: it sounds like a nineteenth-century novel. Say *lui*, or simply leave the subject out.

Examples:
- *Dante nacque a Firenze nel 1265; egli fu esiliato nel 1302.* (Dante was born in Florence in 1265; he was exiled in 1302.)
- *Coloro che desiderano partecipare devono iscriversi entro venerdì.* (Those who wish to take part must register by Friday.)
- *Vendesi appartamento in centro.* (Flat for sale in the town centre.)`,
    drills: [
      {
        it: 'Dante nacque a Firenze nel 1265; [egli] fu esiliato nel 1302.',
        en: 'Dante was born in Florence in 1265; he was exiled in 1302.',
        hint: 'he (literary subject pronoun)',
      },
      {
        it: 'Il comune ha approvato il nuovo regolamento: [esso] entrerà in vigore a gennaio.',
        en: 'The council has approved the new regulation: it will come into force in January.',
        hint: 'it (formal written pronoun, masculine thing)',
      },
      {
        it: 'I lupi vivono in branco: [essi] cacciano soprattutto di notte.',
        en: 'Wolves live in packs: they hunt mainly at night.',
        hint: 'they (written pronoun, for animals, masculine)',
      },
      {
        it: '[Coloro] che desiderano partecipare devono iscriversi entro venerdì.',
        en: 'Those who wish to take part must register by Friday.',
        hint: 'those (people, formal)',
      },
      {
        it: '[Vendesi] appartamento in centro, ottime condizioni.',
        en: 'Flat for sale in the town centre, excellent condition.',
        hint: 'vendere + si (sign)',
      },
      {
        it: '[Affittasi] camera a studenti.',
        en: 'Room to let to students.',
        hint: 'affittare + si (sign)',
      },
      {
        it: '[Cercasi] cameriere con esperienza.',
        en: 'Experienced waiter wanted.',
        hint: 'cercare + si (job ad)',
      },
      {
        it: 'Si prega [codesto] Ufficio di inviare la documentazione richiesta.',
        en: 'Your Office is requested to send the required documents.',
        hint: 'that (near you, bureaucratic)',
      },
      {
        it: "Chi è [costui]? Non l'ho mai visto prima.",
        en: "Who is this fellow? I've never seen him before.",
        hint: 'this man (literary, often scornful)',
      },
      {
        it: 'Le norme [suddette] si applicano a tutti i dipendenti.',
        en: 'The above-mentioned rules apply to all employees.',
        hint: 'above-mentioned (bureaucratic)',
      },
      {
        it: 'Giunse alla [medesima] conclusione del fratello.',
        en: 'He reached the same conclusion as his brother.',
        hint: 'same (formal)',
      },
    ],
  },
  {
    id: 110,
    slug: 'subjunctive-in-usage',
    title: 'The subjunctive in real usage: dropping che, indicative in speech',
    cefr: 'C2',
    prerequisites: ['sequence-of-tenses'],
    noteMd: `**In short:** real Italian handles the subjunctive more flexibly than textbooks. In writing, *che* is often dropped while the subjunctive stays; in relaxed speech, the subjunctive is often replaced by the indicative. Knowing when each is acceptable is a sign of mastery.

Dropping *che*. After verbs of opinion, hope and fear (*credo, penso, spero, immagino, temo, mi auguro*) and after *pare, sembra, si dice*, the *che* can be left out. The subjunctive stays:
- *Credo sia meglio partire presto.* (I think it's better to leave early.)
- *Spero tu stia bene.* (I hope you're well.)
- *Pare abbia vinto la lotteria.* (Apparently he won the lottery.)

Because *io, tu, lui* share the same present subjunctive forms (*abbia, sia*), add the subject pronoun when it isn't clear: *Penso tu abbia ragione.*

Indicative in speech. In conversation, many speakers say *Penso che è vero* or *Non so se viene*. In indirect questions this is widely accepted; after *penso che* it still sounds careless in writing. Keep the subjunctive in anything formal.

Where the indicative is the rule, not a shortcut:
- after verbs of certainty or knowledge: *So che hai ragione.* *Ho saputo che si è sposata.*

Where the subjunctive never drops, even in speech:
- after conjunctions such as *benché, prima che, affinché, senza che*: *Benché piovesse, uscimmo.*

**Watch out:** dropping *che* does not mean dropping the subjunctive. *Credo è meglio* is wrong; it is *Credo sia meglio* or *Credo che sia meglio*.

Examples:
- *Immagino siate stanchi dopo il viaggio.* (I imagine you're tired after the journey.)
- *Mi auguro vada tutto bene.* (I hope everything goes well.)
- *So che tu hai ragione.* (I know you're right.)`,
    drills: [
      {
        it: 'Credo [sia] meglio partire presto.',
        en: "I think it's better to leave early.",
        hint: 'essere (subjunctive, che left out)',
      },
      {
        it: 'Spero tu [stia] bene.',
        en: "I hope you're well.",
        hint: 'stare (subjunctive, che left out)',
      },
      {
        it: 'Immagino [siate] stanchi dopo il viaggio.',
        en: "I imagine you're tired after the journey.",
        hint: 'essere (subjunctive, voi, che left out)',
      },
      {
        it: 'Mi auguro [vada] tutto bene.',
        en: 'I hope everything goes well.',
        hint: 'andare (subjunctive, che left out)',
      },
      {
        it: 'Pare [abbia vinto] la lotteria.',
        en: 'Apparently he won the lottery.',
        hint: 'vincere (past subjunctive, che left out)',
      },
      {
        it: 'Si dice [abbiano] intenzione di vendere la casa.',
        en: "They're said to be planning to sell the house.",
        hint: 'avere (subjunctive, loro, che left out)',
      },
      {
        it: 'Temo [abbiano chiuso] il negozio.',
        en: "I'm afraid they've closed the shop.",
        hint: 'chiudere (past subjunctive, loro, che left out)',
      },
      {
        it: 'Penso [tu abbia] ragione.',
        en: "I think you're right.",
        hint: 'tu + avere (subjunctive, keep the pronoun)',
      },
      {
        it: 'So che tu [hai] ragione.',
        en: "I know you're right.",
        hint: 'avere (after sapere: a fact)',
      },
      {
        it: 'Ho saputo che Giulia [si è sposata].',
        en: 'I heard that Giulia got married.',
        hint: 'sposarsi (a fact: passato prossimo)',
      },
      {
        it: 'Non so se Luca [viene] stasera.',
        en: "I don't know if Luca is coming tonight.",
        hint: 'venire (relaxed speech: indicative)',
        also: ['venga'],
      },
      {
        it: 'Benché [piovesse], uscimmo lo stesso.',
        en: 'Although it was raining, we went out anyway.',
        hint: 'piovere (after benché: always subjunctive)',
      },
    ],
  },
  {
    id: 111,
    slug: 'apocope-elision',
    title: 'Truncation and elision: buon, signor, gran, pur',
    cefr: 'C2',
    prerequisites: ['bello-quello-forms'],
    noteMd: `**In short:** Italian often shortens words before another word. Truncation (dropping the last vowel or syllable) uses no apostrophe; elision (dropping a vowel before another vowel) uses one.

Truncation, no apostrophe:
- *buono* becomes *buon* before a masculine singular noun: *buon amico, buon giorno* (but *buono studente*, before s + consonant or z).
- Titles before a name: *signore, dottore, professore, ingegnere* become *signor Rossi, dottor Bianchi, professor Neri*.
- *grande* can become *gran*: *gran parte, un gran piacere*.
- *santo* becomes *San* before a consonant: *San Marco* (but *Santo Stefano*, before s + consonant).
- *bene* becomes *ben*: *ben fatto*; *pure* becomes *pur*: *pur sapendo* (even though he knew).
- *quale* becomes *qual*: *qual è* (no apostrophe).
- Infinitives in fixed phrases and poetry: *far vedere, aver paura, esser felice*.

Elision, with apostrophe, before a vowel:
- *santo*: *Sant'Antonio*; *grande*: *grand'uomo*; *bello*: *bell'aspetto*.
- *come è, dove è*: *com'è, dov'è*.

One exception to learn: *poco* becomes *po'* with an apostrophe, because a syllable is cut off: *un po' di pane*.

**Watch out:** *qual è* never has an apostrophe, because *qual* also exists before consonants (*qual buon vento*). *Qual'è* is a classic mistake, even among Italians. And keep the full form of a title when you speak to someone without their surname: *Buongiorno, signore!*, *Sì, dottore.*

Examples:
- *Buongiorno, signor Rossi!* (Good morning, Mr Rossi!)
- *Qual è il tuo colore preferito?* (What's your favourite colour?)
- *Pur sapendo la verità, non ha detto nulla.* (Even though he knew the truth, he said nothing.)
- *Vorrei un po' di zucchero.* (I'd like a little sugar.)`,
    drills: [
      {
        it: 'Buongiorno, [signor] Rossi!',
        en: 'Good morning, Mr Rossi!',
        hint: 'signore (before a surname)',
      },
      {
        it: 'Ho parlato con il [dottor] Bianchi ieri.',
        en: 'I spoke to Dr Bianchi yesterday.',
        hint: 'dottore (before a surname)',
      },
      {
        it: 'È un [buon] amico, puoi fidarti di lui.',
        en: "He's a good friend, you can trust him.",
        hint: 'buono (before amico)',
      },
      {
        it: 'Abbiamo visitato la basilica di [San] Marco.',
        en: "We visited St Mark's Basilica.",
        hint: 'santo (before Marco)',
      },
      {
        it: "La chiesa di [Sant'Antonio] è chiusa per restauro.",
        en: "St Anthony's church is closed for restoration.",
        hint: 'santo + Antonio',
      },
      {
        it: '[Qual è] il tuo colore preferito?',
        en: "What's your favourite colour?",
        hint: 'quale + è',
      },
      {
        it: "Vorrei solo un [po'] di zucchero.",
        en: "I'd just like a little sugar.",
        hint: 'poco (shortened)',
      },
      {
        it: 'Mi ha fatto un [gran] piacere rivederti.',
        en: 'It was a great pleasure to see you again.',
        hint: 'grande (shortened, before a consonant)',
      },
      {
        it: 'È un lavoro [ben] fatto, complimenti.',
        en: "It's a job well done, congratulations.",
        hint: 'bene (shortened)',
      },
      {
        it: '[Pur] sapendo la verità, non ha detto nulla.',
        en: 'Even though he knew the truth, he said nothing.',
        hint: 'pure (shortened, before a gerund)',
      },
      {
        it: "Oggi hai proprio un [bell'aspetto].",
        en: 'You look really well today.',
        hint: 'bello + aspetto',
      },
    ],
  },
  {
    id: 112,
    slug: 'marked-word-order',
    title: 'Marked word order: inversion and focus',
    cefr: 'C2',
    prerequisites: ['dislocation-cleft'],
    noteMd: `**In short:** Italian word order is flexible: the new or most important information usually goes at the end of the sentence. So the subject (who or what does the action) often comes after the verb, and putting a word first can make it stand out.

Subject after the verb:
- When the subject is the new information, especially with verbs of happening and arriving: *È arrivato il treno.* (The train has arrived.) *È successo un incidente.* *Mancano tre giorni.*
- To answer "who?": *Chi paga? Pago io.* (I'll pay.) *L'ho fatto io.* (I did it.) Also in the fixed *Lo dicevo io!* (I told you so!)
- In questions with a question word: *Dove sono andati i ragazzi?*

Putting a word first for emphasis:
- Contrast in speech: *Domani parto, non oggi!* (said with stress on *domani*).
- Literary and journalistic inversion: *Grande fu la sorpresa.* (Great was the surprise.) *Molto si è discusso di questa riforma.* (Much has been said about this reform.)

The neutral order is still subject, verb, object: *Marco ha chiamato.* The marked order tells the listener what matters: *Ha chiamato Marco* answers "who called?".

**Watch out:** English stresses a word with the voice ("*I* did it"); Italian moves it to the end: *L'ho fatto io*, not *Io l'ho fatto* (which does not sound like an answer to "who did it?"). And with a question word, do not keep the English order: *Dove sono andati i ragazzi?*, not *Dove i ragazzi sono andati?*

Examples:
- *Non preoccuparti, pago io.* (Don't worry, I'll pay.)
- *Mentre cenavamo, è arrivato Luca.* (While we were having dinner, Luca arrived.)
- *Grande fu la sorpresa quando lo vidi entrare.* (Great was my surprise when I saw him come in.)`,
    drills: [
      {
        it: 'Non preoccuparti, [pago io].',
        en: "Don't worry, I'll pay.",
        hint: 'pagare + io (I am the one who pays)',
      },
      {
        it: "Chi ha rotto il vaso? [L'ho rotto io].",
        en: 'Who broke the vase? I did.',
        hint: 'rompere + lo + io (focus on who)',
      },
      {
        it: 'Mentre cenavamo, [è arrivato Luca].',
        en: 'While we were having dinner, Luca arrived.',
        hint: 'arrivare (passato prossimo) + Luca (new information)',
      },
      {
        it: "[È successo un incidente] sull'autostrada.",
        en: "There's been an accident on the motorway.",
        hint: 'succedere (passato prossimo) + un incidente',
      },
      {
        it: '[Sono arrivate] le tue lettere.',
        en: 'Your letters have arrived.',
        hint: 'arrivare (passato prossimo, verb before the subject)',
      },
      {
        it: '[Mancano] ancora tre giorni alle vacanze.',
        en: 'There are still three days to go until the holidays.',
        hint: 'mancare (present, verb before the subject)',
      },
      {
        it: 'Dove [sono andati i ragazzi]?',
        en: 'Where have the boys gone?',
        hint: 'andare (passato prossimo) + i ragazzi (question order)',
      },
      {
        it: '[Domani parto], non oggi!',
        en: "I'm leaving tomorrow, not today!",
        hint: 'partire (io) + domani (contrast first)',
        also: ['parto domani'],
      },
      {
        it: '[Lo dicevo io] che sarebbe finita così!',
        en: 'I said it would end like this!',
        hint: 'dire (imperfetto) + lo + io (emphatic)',
      },
      {
        it: '[Grande fu] la sorpresa quando lo vidi entrare.',
        en: 'Great was my surprise when I saw him come in.',
        hint: 'grande + essere (passato remoto, adjective first)',
      },
      {
        it: '[Molto si è discusso] di questa riforma.',
        en: 'Much has been said about this reform.',
        hint: 'molto + discutere (si, passato prossimo, focus first)',
      },
    ],
  },
  {
    id: 113,
    slug: 'pronominal-idioms',
    title: 'Pronoun idioms: smetterla, avercela con, farla franca',
    cefr: 'C2',
    prerequisites: ['pronominal-verbs'],
    noteMd: `**In short:** many everyday idioms are verbs with fixed pronouns attached (*la, ci, ne, si*), whose meaning you cannot guess from the parts. Learn them as whole words, with their conjugation.

| infinitive | meaning | example |
|---|---|---|
| *smetterla* | to stop it | *Smettila!* |
| *avercela con* | to be angry with | *Ce l'hai con me?* |
| *farla franca* | to get away with it | *L'ha fatta franca.* |
| *cavarsela* | to get by, cope | *Me la cavo.* |

More you will hear every day:
- *prendersela* (to take offence): *Non te la prendere.*
- *sentirsela* (to feel up to): *Non me la sento.*
- *passarsela* (to be getting on): *Come te la passi?*
- *entrarci* (to have to do with): *Che c'entra?*
- *fregarsene* (colloquial: not to care at all): *Se ne frega.*
- *farcela* and *andarsene*, which you already know: *Ce l'ho fatta. Me ne vado.*

How they work:
- The reflexive pronoun changes with the person (*mi, ti, si, ci, vi*) and becomes *me, te, se, ce, ve* before *la* or *ne*: *me la cavo, te la cavi, se la cava...*
- In compound tenses the participle agrees with *la*: *ce l'ho fatta*, *se l'è presa*, *l'hanno fatta franca*.
- In the imperative the pronouns attach: *Smettila!*, *Smettetela!*; in the negative, both orders work: *Non te la prendere* or *Non prendertela*.

**Watch out:** do not drop the pronouns. *Ho fatto* means "I did"; *ce l'ho fatta* means "I made it". And use feminine *fatta, presa*, not *fatto, preso*, because the hidden *la* is feminine.

Examples:
- *Smettila di fare rumore!* (Stop making noise!)
- *Perché ce l'hai con me?* (Why are you angry with me?)
- *Non parlo bene il tedesco, ma me la cavo.* (I don't speak German well, but I get by.)
- *Il ladro l'ha fatta franca.* (The thief got away with it.)`,
    drills: [
      {
        it: '[Smettila] di fare rumore!',
        en: 'Stop making noise!',
        hint: 'smetterla (tu imperative)',
      },
      { it: 'È tardi, [me ne vado].', en: "It's late, I'm off.", hint: 'andarsene (present, io)' },
      {
        it: "Perché [ce l'hai] con me? Non ho fatto niente!",
        en: "Why are you angry with me? I haven't done anything!",
        hint: 'avercela (present, tu)',
      },
      {
        it: 'Non parlo bene il tedesco, ma [me la cavo].',
        en: "I don't speak German well, but I get by.",
        hint: 'cavarsela (present, io)',
      },
      {
        it: 'Ciao Marco, come [te la passi]?',
        en: 'Hi Marco, how are you getting on?',
        hint: 'passarsela (present, tu)',
      },
      {
        it: 'Non [me la sento] di guidare con questa nebbia.',
        en: "I don't feel up to driving in this fog.",
        hint: 'sentirsela (present, io)',
      },
      {
        it: "Che [c'entra] questo con il nostro problema?",
        en: 'What has this got to do with our problem?',
        hint: 'entrarci (present)',
      },
      {
        it: 'Non [te la prendere], stavo scherzando!',
        en: "Don't take it badly, I was joking!",
        hint: 'prendersela (negative tu imperative)',
        also: ['prendertela'],
      },
      {
        it: "Il ladro [l'ha fatta franca] ancora una volta.",
        en: 'The thief got away with it once again.',
        hint: 'farla franca (passato prossimo)',
      },
      {
        it: "Giulia [se l'è presa] per quello che hai detto.",
        en: 'Giulia took offence at what you said.',
        hint: 'prendersela (passato prossimo)',
      },
      {
        it: "Siamo arrivati in cima: [ce l'abbiamo fatta]!",
        en: "We've reached the top: we made it!",
        hint: 'farcela (passato prossimo, noi)',
      },
      {
        it: 'Quei ragazzi [se ne fregano] delle regole.',
        en: "Those boys couldn't care less about the rules.",
        hint: 'fregarsene (present, loro, colloquial)',
      },
    ],
  },
  {
    id: 114,
    slug: 'tense-stylistics',
    title: 'Tenses for style: historic present, narrative and polite imperfect',
    cefr: 'C2',
    prerequisites: ['passato-remoto'],
    noteMd: `**In short:** Italian tenses do more than place events in time. Writers and speakers choose them for effect: to make a story vivid, to sound polite, or to concede a point.

- **Historic present** (the present for past events): in history books and in lively storytelling. *Nel 1492 Colombo arriva in America.* *Ieri entro in un bar e chi vedo? Il mio professore!*
- **Historic future**: in a past narrative, the future for what happened later. *Dante non tornerà mai a Firenze e morirà a Ravenna nel 1321.*
- **Narrative imperfect**: in news reports, the imperfect for single completed events, to give a "live" effect. *Pochi minuti dopo, la polizia arrestava i rapinatori.* In ordinary speech you would use the passato prossimo.
- **Polite imperfect**: in shops and requests, the imperfect softens what you want. *Volevo un chilo di pane.* *Cercavo un paio di scarpe.* It means "I'd like", not "I wanted".
- **Play imperfect**: children set up a game with it. *Facciamo che io ero il re.* (Let's pretend I'm the king.)
- **Concessive future**: the future admits a point before a "but". *Sarà anche bravo, ma è antipatico.* (He may well be good, but he's unpleasant.)

**Watch out:** *Volevo un caffè* in a bar is not about the past, and the barista will simply serve you. Don't translate it as "I wanted". And the narrative imperfect is a written style: in conversation, say *Il ministro si è dimesso*, not *si dimetteva*.

Examples:
- *Buongiorno, volevo un chilo di pane.* (Good morning, I'd like a kilo of bread.)
- *Nel 1492 Colombo arriva in America.* (In 1492 Columbus reaches America.)
- *Il giorno dopo, il ministro rassegnava le dimissioni.* (The next day, the minister handed in his resignation.)
- *Avrà anche ragione, ma non doveva urlare così.* (He may well be right, but he shouldn't have shouted like that.)`,
    drills: [
      {
        it: 'Buongiorno, [volevo] un chilo di pane, per favore.',
        en: "Good morning, I'd like a kilo of bread, please.",
        hint: 'volere (polite imperfect, io)',
      },
      {
        it: 'Scusi, [cercavo] il reparto scarpe.',
        en: "Excuse me, I'm looking for the shoe department.",
        hint: 'cercare (polite imperfect, io)',
      },
      {
        it: '[Volevamo] sapere se avete una camera libera per stanotte.',
        en: "We'd like to know if you have a room free for tonight.",
        hint: 'volere (polite imperfect, noi)',
      },
      {
        it: 'Nel 1492 Colombo [arriva] in America.',
        en: 'In 1492 Columbus reaches America.',
        hint: 'arrivare (historic present)',
      },
      {
        it: 'Ieri entro in un bar e chi [vedo]? Il mio vecchio professore!',
        en: 'Yesterday I walk into a bar and who do I see? My old teacher!',
        hint: 'vedere (present in storytelling, io)',
      },
      {
        it: 'Esiliato nel 1302, Dante non tornerà mai a Firenze e [morirà] a Ravenna nel 1321.',
        en: 'Exiled in 1302, Dante would never return to Florence and would die in Ravenna in 1321.',
        hint: 'morire (historic future)',
      },
      {
        it: 'Il giorno dopo, il ministro [rassegnava] le dimissioni.',
        en: 'The next day, the minister handed in his resignation.',
        hint: 'rassegnare (narrative imperfect, news style)',
      },
      {
        it: 'Pochi minuti dopo, la polizia [arrestava] i due rapinatori.',
        en: 'A few minutes later, the police arrested the two robbers.',
        hint: 'arrestare (narrative imperfect, news style)',
      },
      {
        it: 'Facciamo che io [ero] il re e tu il cavaliere.',
        en: "Let's pretend I'm the king and you're the knight.",
        hint: "essere (imperfect of children's games)",
      },
      {
        it: '[Sarà] anche bravo, ma è molto antipatico.',
        en: "He may well be good, but he's very unpleasant.",
        hint: 'essere (concessive future)',
      },
      {
        it: '[Avrà] anche ragione, ma non doveva urlare così.',
        en: "He may well be right, but he shouldn't have shouted like that.",
        hint: 'avere (concessive future)',
      },
    ],
  },
];
