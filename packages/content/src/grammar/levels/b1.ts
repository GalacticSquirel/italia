import type { GrammarPointSource } from '../types';

/** B1 grammar points in teaching order. */
export const B1_POINTS: readonly GrammarPointSource[] = [
  {
    id: 36,
    slug: 'ci-locative',
    title: 'Ci meaning "there"',
    cefr: 'B1',
    prerequisites: ['ce-ci-sono', 'direct-object-pronouns'],
    noteMd: `**In short:** *ci* means "there". It replaces a place you have already mentioned, so you don't have to repeat it.

*ci* is a pronoun (a short word that stands in for a noun). It replaces a place introduced by *a, in, da* or *su*: *a Roma, in Sicilia, dal medico, al cinema*.

- It goes **before** the conjugated verb: *Vai a Roma? Sì, ci vado domani.*
- In the negative, *non* comes first: *Non ci vado.*
- In the passato prossimo it goes before the auxiliary: *Ci sono stato.*
- With an infinitive it can be attached to the end (the infinitive drops its final *-e*) or go before the modal verb: *Devo andarci* or *Ci devo andare*.

| without ci | with ci |
|---|---|
| *Vado al mare.* | *Ci vado.* |
| *Abito a Napoli.* | *Ci abito.* |
| *Torno in ufficio.* | *Ci torno.* |

*ci* has other uses too (*ci penso, ci vuole*), which come in a later lesson.

**Watch out:** in English you can just say "Yes, I'm going". In Italian a verb of place like *andare* sounds incomplete without the place, so say *Sì, ci vado*, not just *Sì, vado*. And put *ci* before the verb, not after it as with "there".

Examples:
- *Vai a Roma? Sì, ci vado domani.* (Are you going to Rome? Yes, I'm going there tomorrow.)
- *Sei mai stato in Sicilia? No, non ci sono mai stato.* (Have you ever been to Sicily? No, I've never been there.)
- *Il museo è bellissimo: devi andarci.* (The museum is beautiful: you must go there.)`,
    drills: [
      {
        it: 'Vai al cinema stasera? Sì, [ci vado] con Luca.',
        en: "Are you going to the cinema tonight? Yes, I'm going with Luca.",
        hint: 'ci + andare (I)',
      },
      {
        it: 'Quando torni a casa? [Ci torno] alle otto.',
        en: "When are you going back home? I'm going back at eight.",
        hint: 'ci + tornare (I)',
      },
      {
        it: 'Vivete a Milano? Sì, [ci viviamo] da due anni.',
        en: "Do you live in Milan? Yes, we've lived there for two years.",
        hint: 'ci + vivere (we)',
      },
      {
        it: 'Vanno spesso al mare? No, non [ci vanno] quasi mai.',
        en: 'Do they often go to the seaside? No, they hardly ever go.',
        hint: 'ci + andare (they)',
      },
      {
        it: 'Vieni alla festa? Sì, [ci vengo] volentieri.',
        en: "Are you coming to the party? Yes, I'd love to come.",
        hint: 'ci + venire (I)',
      },
      {
        it: 'Resti a Roma? Sì, [ci resto] fino a domenica.',
        en: "Are you staying in Rome? Yes, I'm staying there until Sunday.",
        hint: 'ci + restare (I)',
      },
      {
        it: 'Mia nonna è nata a Napoli e [ci abita] ancora.',
        en: 'My grandmother was born in Naples and still lives there.',
        hint: 'ci + abitare (she)',
      },
      {
        it: 'Andate in palestra domani? No, [ci andiamo] giovedì.',
        en: "Are you going to the gym tomorrow? No, we're going on Thursday.",
        hint: 'ci + andare (we)',
      },
      {
        it: 'Sei andata dal medico? Sì, [ci sono andata] ieri.',
        en: "Did you go to the doctor's? Yes, I went yesterday.",
        hint: 'ci + andare (passato prossimo, a woman speaking)',
      },
      {
        it: 'Quella pizzeria? [Ci siamo stati] sabato.',
        en: 'That pizzeria? We were there on Saturday.',
        hint: 'ci + essere (passato prossimo, we, men or a mixed group)',
      },
      {
        it: 'Il museo è bellissimo: devi [andarci]!',
        en: 'The museum is beautiful: you must go there!',
        hint: 'andare + ci (infinitive, attached)',
      },
      {
        it: "Questa città mi piace: voglio [tornarci] l'anno prossimo.",
        en: 'I like this city: I want to come back here next year.',
        hint: 'tornare + ci (infinitive, attached)',
      },
    ],
  },
  {
    id: 37,
    slug: 'ne-partitive',
    title: 'Ne meaning "of it, of them"',
    cefr: 'B1',
    prerequisites: ['direct-object-pronouns'],
    noteMd: `**In short:** *ne* means "of it" or "of them". You use it when you give a quantity of something already mentioned, so the quantity can stand alone.

English often leaves this out ("I have two", "I'll take some"). Italian cannot: it needs *ne*.

- *Ne* goes **before** the conjugated verb: *Ne ho due.*
- The quantity stays after the verb: a number, *un po'*, *molti*, *tanti*, *pochi*, *un chilo*...
- In the negative it means "any": *Non ne ho.* (I haven't got any.)
- With an infinitive it is attached to the end (*Devo comprarne un po'*), or it goes before a modal verb like *devo, posso, voglio* (*Ne devo comprare un po'*).

| question | answer |
|---|---|
| *Quanti fratelli hai?* | *Ne ho due.* |
| *Vuoi del caffè?* | *Sì, ne prendo un po'.* |
| *Hai dei soldi?* | *No, non ne ho.* |

*Ne* also replaces *di* + something after verbs like *parlare di* and *avere bisogno di* (*Ne abbiamo parlato*, we talked about it). That comes in a later lesson.

**Watch out:** don't drop it. *Ho due* on its own is wrong: say *Ne ho due*. And don't use *lo* or *li* with a quantity: *Ne compro tre*, not *Li compro tre*.

Examples:
- *Quanti fratelli hai? Ne ho due.* (How many brothers do you have? I have two.)
- *Vuoi del caffè? Sì, ne prendo un po'.* (Do you want some coffee? Yes, I'll have a little.)
- *Mi dispiace, non ne ho.* (I'm sorry, I haven't got any.)`,
    drills: [
      {
        it: 'Quanti fratelli hai? [Ne ho] due.',
        en: 'How many brothers do you have? I have two.',
        hint: 'ne + avere (I)',
      },
      {
        it: "Vuoi del caffè? Sì, [ne prendo] un po'.",
        en: "Do you want some coffee? Yes, I'll have a little.",
        hint: 'ne + prendere (I)',
      },
      {
        it: 'Quante mele compri? [Ne compro] un chilo.',
        en: "How many apples are you buying? I'm buying a kilo.",
        hint: 'ne + comprare (I)',
      },
      {
        it: 'Quanti anni ha tuo padre? [Ne ha] sessanta.',
        en: "How old is your father? He's sixty.",
        hint: 'ne + avere (he)',
      },
      {
        it: 'Quanti caffè bevi al giorno? [Ne bevo] tre.',
        en: 'How many coffees do you drink a day? I drink three.',
        hint: 'ne + bere (I)',
      },
      {
        it: 'Hai dei soldi? No, non [ne ho].',
        en: "Have you got any money? No, I haven't got any.",
        hint: 'ne + avere (I)',
      },
      {
        it: 'Hanno molti amici? Sì, [ne hanno] tanti.',
        en: 'Do they have many friends? Yes, they have lots.',
        hint: 'ne + avere (they)',
      },
      {
        it: "Quanti libri leggete all'anno? [Ne leggiamo] dieci.",
        en: 'How many books do you read a year? We read ten.',
        hint: 'ne + leggere (we)',
      },
      {
        it: 'Le ciliegie sono buonissime: [ne vuoi] qualcuna?',
        en: 'The cherries are delicious: do you want some?',
        hint: 'ne + volere (you)',
      },
      {
        it: 'Mi servono delle uova: [ne compri] sei, per favore?',
        en: 'I need some eggs: can you buy six, please?',
        hint: 'ne + comprare (you)',
      },
      {
        it: 'Quanti studenti ci sono? Non lo so, [ne conosco] solo tre.',
        en: "How many students are there? I don't know, I only know three of them.",
        hint: 'ne + conoscere (I)',
      },
      {
        it: "Il pane è finito: devo [comprarne] un po'.",
        en: 'The bread has run out: I need to buy some.',
        hint: 'comprare + ne (infinitive, attached)',
      },
    ],
  },
  {
    id: 38,
    slug: 'conditional',
    title: 'The conditional: vorrei, potrei',
    cefr: 'B1',
    prerequisites: ['future', 'modal-verbs'],
    noteMd: `**In short:** the conditional is the Italian "would". You use it to ask politely, to say what you'd like, and to give advice.

It uses the **same stem as the future** (*parler-, prender-, finir-*) with these endings:

| | parlare | prendere |
|---|---|---|
| io | parlerei | prenderei |
| tu | parleresti | prenderesti |
| lui, lei, Lei | parlerebbe | prenderebbe |
| noi | parleremmo | prenderemmo |
| voi | parlereste | prendereste |
| loro | parlerebbero | prenderebbero |

Verbs with an irregular future stem keep it: *essere → sarei*, *avere → avrei*, *andare → andrei*, *fare → farei*, *venire → verrei*, *volere → vorrei*, *potere → potrei*, *dovere → dovrei*, *dire → direi*. Verbs in *-ciare, -giare* drop the *i*: *mangerei, viaggerei*.

The main uses:
- polite requests: **vorrei** (I'd like), **potresti** (could you)
- advice: **dovresti** (you should), *Al tuo posto, andrei.* (If I were you, I'd go.)
- wishes: *Mi piacerebbe...* (I'd like to...)

**Watch out:** the "we" form has a double *m*: *parleremmo* (we would speak) is not *parleremo* (we will speak). And English "would" for past habits ("as a child I would play outside") is not the conditional: Italian uses the imperfect there (*giocavo*).

Examples:
- *Vorrei un caffè, per favore.* (I'd like a coffee, please.)
- *Potresti aiutarmi?* (Could you help me?)
- *Dovrei studiare di più.* (I should study more.)
- *Mi piacerebbe vedere Venezia.* (I'd like to see Venice.)`,
    drills: [
      {
        it: '[Vorrei] un caffè, per favore.',
        en: "I'd like a coffee, please.",
        hint: 'volere (conditional, I)',
      },
      {
        it: '[Potresti] aiutarmi con la valigia?',
        en: 'Could you help me with the suitcase?',
        hint: 'potere (conditional, you)',
      },
      {
        it: '[Dovresti] dormire di più.',
        en: 'You should sleep more.',
        hint: 'dovere (conditional, you)',
      },
      {
        it: 'Mi [piacerebbe] vedere Venezia.',
        en: "I'd like to see Venice.",
        hint: 'piacere (conditional)',
      },
      {
        it: '[Sarebbe] bello andare al mare domenica.',
        en: 'It would be nice to go to the seaside on Sunday.',
        hint: 'essere (conditional)',
      },
      {
        it: 'Al tuo posto [andrei] dal medico.',
        en: "If I were you, I'd go to the doctor.",
        hint: 'andare (conditional, I)',
      },
      { it: 'Io non lo [farei] mai.', en: 'I would never do it.', hint: 'fare (conditional, I)' },
      {
        it: 'Che cosa [mangeresti] stasera?',
        en: 'What would you eat tonight?',
        hint: 'mangiare (conditional, you)',
      },
      {
        it: 'Noi [prenderemmo] volentieri un gelato.',
        en: "We'd love an ice cream.",
        hint: 'prendere (conditional, we)',
      },
      {
        it: 'Scusi, mi [direbbe] che ore sono?',
        en: 'Excuse me, could you tell me what time it is?',
        hint: 'dire (conditional, Lei)',
      },
      {
        it: 'Ragazzi, [verreste] con noi a cena?',
        en: 'Guys, would you come to dinner with us?',
        hint: 'venire (conditional, you plural)',
      },
      {
        it: 'Scusate, [avreste] un minuto?',
        en: 'Excuse me, would you have a minute?',
        hint: 'avere (conditional, you plural)',
      },
      {
        it: 'Con più soldi, i miei genitori [viaggerebbero] di più.',
        en: 'With more money, my parents would travel more.',
        hint: 'viaggiare (conditional, they)',
      },
    ],
  },
  {
    id: 55,
    slug: 'imperative-pronouns',
    title: 'Imperative with pronouns: dimmi, fallo, non toccarlo',
    cefr: 'B1',
    prerequisites: ['imperative', 'direct-object-pronouns', 'indirect-object-pronouns'],
    noteMd: `**In short:** when you give an order to *tu*, *noi* or *voi*, the pronouns (*mi, ti, lo, la, gli, ci, ne*...) are joined to the end of the verb: *guardami* (look at me), *prendilo* (take it).

- *tu*: *aspetta + mi → aspettami*, *prendi + lo → prendilo*
- *noi*: *andiamo + ci → andiamoci* (let's go there)
- *voi*: *prendete + le → prendetele*
- reflexive verbs work the same way: *alzati!* (get up!), *lavatevi le mani!*

The short *tu* forms *da', di', fa', sta', va'* double the first letter of the pronoun:

| verb | + pronoun |
|---|---|
| *di'* (say) | *dimmi, dillo* |
| *da'* (give) | *dammi, dalle* |
| *fa'* (do) | *fallo, fammi* |
| *va'* (go) | *vacci* |

The exception is *gli*, which never doubles: *digli* (tell him), *dagli* (give him).

In the negative *tu* form (*non* + infinitive), the pronoun can be attached to the infinitive or go before it: *non toccarlo* or *non lo toccare* (don't touch it).

This lesson covers *tu, noi, voi*. The polite *Lei* form works differently and comes next.

**Watch out:** write it as one word, with the stress staying where it was: *prendilo* (PREN-di-lo), not *prendi lo*. And remember the double letter: *dimmi*, not *dimi*.

Examples:
- *Dimmi la verità.* (Tell me the truth.)
- *Il libro è sul tavolo: prendilo.* (The book is on the table: take it.)
- *Non toccarlo, è fragile!* (Don't touch it, it's fragile!)
- *Se vedi Marco, digli di chiamarmi.* (If you see Marco, tell him to call me.)`,
    drills: [
      { it: 'Mamma, [guardami]!', en: 'Mum, look at me!', hint: 'guardare + me (tu)' },
      {
        it: 'Il libro è sul tavolo: [prendilo]!',
        en: 'The book is on the table: take it!',
        hint: 'prendere + it (tu; il libro)',
      },
      {
        it: 'Ho bisogno di una mano: [aiutami], per favore.',
        en: 'I need a hand: help me, please.',
        hint: 'aiutare + me (tu)',
      },
      {
        it: 'Questa torta è buona: [assaggiala]!',
        en: 'This cake is good: taste it!',
        hint: 'assaggiare + it (tu; la torta)',
      },
      { it: '[Dimmi] la verità.', en: 'Tell me the truth.', hint: 'dire + me (tu)' },
      { it: '[Dammi] il tuo numero.', en: 'Give me your number.', hint: 'dare + me (tu)' },
      {
        it: 'Se devi farlo, [fallo] subito.',
        en: 'If you have to do it, do it right away.',
        hint: 'fare + it (tu)',
      },
      {
        it: 'Se vedi Marco, [digli] di chiamarmi.',
        en: 'If you see Marco, tell him to call me.',
        hint: 'dire + him (tu)',
      },
      {
        it: 'La nonna è sola: [telefonale] stasera.',
        en: 'Grandma is on her own: phone her tonight.',
        hint: 'telefonare + her (tu)',
      },
      {
        it: 'Il vaso è fragile: non [toccarlo]!',
        en: "The vase is fragile: don't touch it!",
        hint: 'toccare + it (negative tu, attached)',
      },
      {
        it: 'Ragazzi, le chiavi sono qui: [prendetele].',
        en: 'Guys, the keys are here: take them.',
        hint: 'prendere + them (voi; le chiavi)',
      },
      {
        it: 'È tardi per il museo: [andiamoci] domani.',
        en: "It's too late for the museum: let's go there tomorrow.",
        hint: 'andare + ci (noi)',
      },
      {
        it: 'Bambini, [lavatevi] le mani!',
        en: 'Children, wash your hands!',
        hint: 'lavarsi (voi)',
      },
      {
        it: 'Non è colpa sua: non [arrabbiarti] con lui.',
        en: "It's not his fault: don't get angry with him.",
        hint: 'arrabbiarsi (negative tu, attached)',
      },
    ],
  },
  {
    id: 56,
    slug: 'imperative-formal',
    title: 'Polite imperative: Scusi, Venga, Si accomodi',
    cefr: 'B1',
    prerequisites: ['imperative'],
    noteMd: `**In short:** to tell or ask someone you address as *Lei* (a stranger, a customer, an older person) to do something, you use the polite imperative: *Scusi, Senta, Venga, Si accomodi*.

How to build it:
- **-are** verbs end in **-i**: *scusare → scusi*, *aspettare → aspetti*, *guardare → guardi*
- **-ere** and **-ire** verbs end in **-a**: *prendere → prenda*, *sentire → senta*, *finire → finisca*

Many verbs build it from the *io* form of the present: *vengo → venga*, *faccio → faccia*, *dico → dica*, *vado → vada*, *esco → esca*, *bevo → beva*.

A few are fully irregular:

| verb | Lei form |
|---|---|
| essere | *sia* |
| avere | *abbia* |
| dare | *dia* |
| stare | *stia* |
| sapere | *sappia* |

Pronouns go **before** the verb, never attached: *Mi dica* (tell me), *Si accomodi* (have a seat), *Lo prenda* (take it), *Non si preoccupi* (don't worry). For the negative, just put *non* in front: *Non aspetti.*

To a group, everyday Italian simply uses the *voi* imperative: *Scusate, venite pure.*

**Watch out:** the vowels look "swapped": *-are* verbs take *-i* and the others take *-a*. So it's *Scusi* (from *scusare*) and *Senta* (from *sentire*), not *Scusa* and *Senti*, which are the *tu* forms you'd use with a friend.

Examples:
- *Scusi, dov'è la stazione?* (Excuse me, where is the station?)
- *Prego, si accomodi.* (Please, have a seat.)
- *Mi dica, cosa desidera?* (Tell me, what would you like?)
- *Non si preoccupi, ci penso io.* (Don't worry, I'll take care of it.)`,
    drills: [
      {
        it: "[Scusi], dov'è la stazione?",
        en: 'Excuse me, where is the station?',
        hint: 'scusare (Lei)',
      },
      {
        it: 'Signora, [aspetti] un attimo, per favore.',
        en: 'Madam, wait a moment, please.',
        hint: 'aspettare (Lei)',
      },
      {
        it: '[Senta], posso farle una domanda?',
        en: 'Excuse me, may I ask you a question?',
        hint: 'sentire (Lei)',
      },
      {
        it: '[Prenda] la seconda strada a destra.',
        en: 'Take the second street on the right.',
        hint: 'prendere (Lei)',
      },
      {
        it: '[Vada] sempre dritto fino alla piazza.',
        en: 'Go straight on as far as the square.',
        hint: 'andare (Lei)',
      },
      { it: '[Venga] pure avanti, dottore.', en: 'Do come in, doctor.', hint: 'venire (Lei)' },
      { it: '[Faccia] attenzione al gradino.', en: 'Mind the step.', hint: 'fare (Lei)' },
      {
        it: "[Finisca] pure di mangiare, non c'è fretta.",
        en: "Do finish eating, there's no hurry.",
        hint: 'finire (Lei)',
      },
      {
        it: '[Abbia] pazienza, arrivo subito.',
        en: "Please be patient, I'll be right with you.",
        hint: 'avere (Lei)',
      },
      { it: 'Prego, [si accomodi].', en: 'Please, have a seat.', hint: 'accomodarsi (Lei)' },
      {
        it: '[Mi dica], cosa desidera?',
        en: 'Tell me, what would you like?',
        hint: 'dire + me (Lei)',
      },
      {
        it: 'Il modulo è qui: [lo compili], per favore.',
        en: 'The form is here: fill it in, please.',
        hint: 'compilare + it (Lei)',
      },
      {
        it: 'Non [si preoccupi], ci penso io.',
        en: "Don't worry, I'll take care of it.",
        hint: 'preoccuparsi (Lei, negative)',
      },
    ],
  },
  {
    id: 57,
    slug: 'combined-pronouns',
    title: 'Double pronouns: me lo, te la, glielo',
    cefr: 'B1',
    prerequisites: ['direct-object-pronouns', 'indirect-object-pronouns'],
    noteMd: `**In short:** when a verb has two pronouns, "to someone" plus "it/them", Italian puts the "to someone" pronoun first and changes its form: *me lo* (it to me), *te la* (it to you), *glielo* (it to him or her).

The indirect object (who receives: "to me, to you") comes first, then the direct object (the thing: *lo, la, li, le*) or *ne*.

- *mi, ti, ci, vi* change their *i* to *e*: **me, te, ce, ve**. So *me lo, te la, ce li, ve le, me ne*.
- *gli* and *le* (to him, to her) and *Le* (to you, formal) all become **glie-**, written as one word with the next pronoun: *glielo, gliela, glieli, gliele, gliene*.
- Reflexive *si* becomes *se*: *se lo mette* (he puts it on).
- *ci* (there) + *ne* becomes *ce ne*: *Ce ne sono tre.* (There are three of them.)

| to | + lo | + la | + li / le |
|---|---|---|---|
| me | *me lo* | *me la* | *me li / me le* |
| you | *te lo* | *te la* | *te li / te le* |
| him, her | *glielo* | *gliela* | *glieli / gliele* |
| us | *ce lo* | *ce la* | *ce li / ce le* |

They go before the conjugated verb, or are attached as one word to an infinitive or a *tu* imperative: *Devo dirtelo*, *Dammelo!*. In the passato prossimo, *lo* and *la* become *l'* before *ho, ha*..., and the participle agrees with the thing: *Te l'ho data* (the letter), *Me le ha date* (the keys).

**Watch out:** the order is the reverse of English "give it to me": Italian says *me lo* (to me, it). And *glielo* can mean "it to him" or "it to her"; the context tells you which.

Examples:
- *Mi presti la penna? Sì, te la presto.* (Will you lend me the pen? Yes, I'll lend it to you.)
- *Porto i fiori alla nonna: glieli porto oggi.* (I'm taking the flowers to Grandma: I'm taking them to her today.)
- *Quel libro è mio: dammelo!* (That book is mine: give it to me!)`,
    drills: [
      {
        it: 'Mi presti la penna? Sì, [te la] presto.',
        en: "Will you lend me the pen? Yes, I'll lend it to you.",
        hint: 'to you + it (la penna)',
      },
      {
        it: 'Quando mi restituisci il libro? [Te lo] restituisco domani.',
        en: "When will you give me back the book? I'll give it back to you tomorrow.",
        hint: 'to you + it (il libro)',
      },
      {
        it: 'Signora, Le porto il menù? Sì, [me lo] porti, grazie.',
        en: 'Madam, shall I bring you the menu? Yes, bring it to me, thank you.',
        hint: 'to me + it (il menù)',
      },
      {
        it: 'Ci mandate le foto? Sì, [ve le] mandiamo subito.',
        en: "Will you send us the photos? Yes, we'll send them to you right away.",
        hint: 'to you plural + them (le foto)',
      },
      {
        it: 'Ci prepari un caffè? Certo, [ve lo] preparo subito.',
        en: "Will you make us a coffee? Of course, I'll make you one right away.",
        hint: 'to you plural + it (il caffè)',
      },
      {
        it: 'Porti i fiori alla nonna? Sì, [glieli] porto oggi.',
        en: "Are you taking the flowers to Grandma? Yes, I'm taking them to her today.",
        hint: 'to her + them (i fiori)',
      },
      {
        it: 'Scrivi la lettera al direttore? Sì, [gliela] scrivo stasera.',
        en: "Are you writing the letter to the director? Yes, I'm writing it to him tonight.",
        hint: 'to him + it (la lettera)',
      },
      {
        it: 'Ne parli con tua madre? Sì, [gliene] parlo stasera.',
        en: "Are you talking to your mother about it? Yes, I'm talking to her about it tonight.",
        hint: 'to her + about it (ne)',
      },
      {
        it: 'Ci sono ancora uova? Sì, [ce ne] sono sei.',
        en: 'Are there any eggs left? Yes, there are six.',
        hint: 'there + of them (ci + ne)',
      },
      {
        it: 'Ti lavi i denti? Sì, [me li] lavo dopo cena.',
        en: 'Do you brush your teeth? Yes, I brush them after dinner.',
        hint: 'reflexive me + them (i denti)',
      },
      {
        it: 'Le chiavi? [Me le] ha date Marco.',
        en: 'The keys? Marco gave them to me.',
        hint: 'to me + them (le chiavi)',
      },
      {
        it: "La macchina? [Gliel'ho prestata] ieri.",
        en: 'The car? I lent it to him yesterday.',
        hint: 'to him + it (la macchina) + prestare (passato prossimo, I)',
        also: ['Gliela ho prestata'],
      },
      {
        it: 'Quel libro è mio: [dammelo]!',
        en: 'That book is mine: give it to me!',
        hint: 'dare + me + it (tu)',
      },
      {
        it: 'Ho una sorpresa per te, ma non posso [dirtela].',
        en: "I have a surprise for you, but I can't tell you what it is.",
        hint: 'dire + to you + it (la sorpresa, infinitive)',
      },
    ],
  },
  {
    id: 58,
    slug: 'relative-che-cui',
    title: 'Relative pronouns: che and cui',
    cefr: 'B1',
    prerequisites: ['simple-prepositions'],
    noteMd: `**In short:** *che* and *cui* join two sentences by referring back to a noun, like English "who", "which", "that". Use *che* on its own, and *cui* after a preposition (a little word like *con, di, a, in, per*).

**che** means who, which or that. It is the subject (who does the action) or the direct object (what the action is done to) of the second part:
- *Il ragazzo che parla con Anna è mio fratello.* (who is talking)
- *Il libro che mi hai regalato è bello.* (that you gave me)

**cui** comes after a preposition. The preposition is the one the verb normally takes:

| preposition + cui | meaning |
|---|---|
| *con cui* | with whom, with which |
| *di cui* | about which, of which |
| *a cui* | to whom |
| *in cui* | in which, where, when |
| *per cui* | for which, why |
| *da cui* | from whom |

So *parlare di* gives *il film di cui ti ho parlato*, *avere bisogno di* gives *le cose di cui ho bisogno*. For places, *dove* is also fine: *la città in cui vivo* or *la città dove vivo*.

*che* and *cui* never change for gender or number.

**Watch out:** English can drop "that" ("the book I read"); Italian never drops *che*: *il libro che ho letto*. And never put *che* after a preposition: say *la ragazza con cui esco*, not *con che*. English puts the preposition at the end ("the girl I go out with"); Italian moves it to the front.

Examples:
- *Il libro che leggo è bellissimo.* (The book I'm reading is wonderful.)
- *L'amica con cui vado in vacanza si chiama Sara.* (The friend I'm going on holiday with is called Sara.)
- *Il film di cui ti ho parlato è uscito.* (The film I told you about has come out.)`,
    drills: [
      {
        it: 'Il ragazzo [che] parla con Anna è mio fratello.',
        en: 'The boy who is talking to Anna is my brother.',
        hint: 'who (relative pronoun)',
      },
      {
        it: 'Il libro [che] mi hai regalato è bellissimo.',
        en: 'The book you gave me is wonderful.',
        hint: 'that (relative pronoun, object)',
      },
      {
        it: 'Le scarpe [che] ho comprato sono strette.',
        en: 'The shoes I bought are tight.',
        hint: 'that (relative pronoun, object)',
      },
      {
        it: 'Non trovo la penna [che] era sul tavolo.',
        en: "I can't find the pen that was on the table.",
        hint: 'that (relative pronoun, subject)',
      },
      {
        it: 'La città [in cui] vivo è piccola.',
        en: 'The city I live in is small.',
        hint: 'in which (preposition + relative)',
        also: ['dove'],
      },
      {
        it: "L'amica [con cui] vado in vacanza si chiama Sara.",
        en: "The friend I'm going on holiday with is called Sara.",
        hint: 'with whom (preposition + relative)',
      },
      {
        it: 'Il film [di cui] ti ho parlato è uscito ieri.',
        en: 'The film I told you about came out yesterday.',
        hint: 'about which (parlare di)',
      },
      {
        it: 'Ecco le cose [di cui] ho bisogno.',
        en: 'Here are the things I need.',
        hint: 'which (avere bisogno di)',
      },
      {
        it: 'Questa è la persona [a cui] ho scritto.',
        en: 'This is the person I wrote to.',
        hint: 'to whom (preposition + relative)',
        also: ['cui'],
      },
      {
        it: 'È questa la ragione [per cui] sono qui.',
        en: "This is the reason why I'm here.",
        hint: 'for which, why (preposition + relative)',
      },
      {
        it: 'Il collega [da cui] ho ricevuto il messaggio è in ferie.',
        en: 'The colleague I got the message from is on holiday.',
        hint: 'from whom (preposition + relative)',
      },
      {
        it: 'Gli amici [su cui] posso contare sono pochi.',
        en: 'The friends I can count on are few.',
        hint: 'on whom (contare su)',
      },
      {
        it: 'Ti ricordi il giorno [in cui] ci siamo conosciuti?',
        en: 'Do you remember the day we met?',
        hint: 'when, on which (preposition + relative)',
        also: ['che'],
      },
    ],
  },
  {
    id: 59,
    slug: 'ci-uses',
    title: 'More uses of ci: ci penso, ci credo, ci metto',
    cefr: 'B1',
    prerequisites: ['ci-locative'],
    noteMd: `**In short:** besides "there", *ci* replaces *a* + a thing or an idea (*ci penso*, I think about it), and it appears in fixed expressions such as *ci vuole* (it takes) and *ci metto* (it takes me).

**1. ci = a + thing or idea**, after verbs that take *a*:
- *pensare a* → *Ci penso io.* (I'll take care of it.)
- *credere a* → *Non ci credo!* (I don't believe it!)
- *riuscire a* → *Non ci riesco.* (I can't manage it.)
- *provare a* → *Voglio provarci.* (I want to give it a try.)

**2. How long it takes**

| expression | agrees with | example |
|---|---|---|
| *volerci* (it takes) | the thing needed | *Ci vuole un'ora. Ci vogliono due ore.* |
| *metterci* (it takes someone) | the person | *Ci metto un'ora. Ci mettiamo due ore.* |

In the passato prossimo, *volerci* uses *essere* (*Ci è voluta un'ora*) and *metterci* uses *avere* (*Ci ho messo un'ora*).

**3. Fixed expressions with senses:** *Non ci vedo* (I can't see), *Non ci sento* (I can't hear).

*ci* follows the usual pronoun position: before the conjugated verb, or attached to an infinitive.

**Watch out:** don't mix up *volerci* and *metterci*. *Ci vuole / ci vogliono* changes with the time or thing (*ci vogliono tre ore*), and has no person. *Metterci* changes with the person who takes the time: *ci metto, ci metti, ci mette*. English "it takes me an hour" is most simply *ci metto un'ora*.

Examples:
- *Non preoccuparti, ci penso io.* (Don't worry, I'll take care of it.)
- *Per arrivare a Roma ci vogliono tre ore.* (It takes three hours to get to Rome.)
- *Quanto ci metti per andare al lavoro?* (How long does it take you to get to work?)`,
    drills: [
      {
        it: "Pensi ancora all'esame? Sì, [ci penso] sempre.",
        en: 'Are you still thinking about the exam? Yes, I think about it all the time.',
        hint: 'ci + pensare (I)',
      },
      {
        it: 'Credi ai fantasmi? No, non [ci credo].',
        en: "Do you believe in ghosts? No, I don't believe in them.",
        hint: 'ci + credere (I)',
      },
      {
        it: 'Non preoccuparti, [ci pensa] Marco.',
        en: "Don't worry, Marco will take care of it.",
        hint: 'ci + pensare (he)',
      },
      {
        it: 'Per fare il pane [ci vuole] pazienza.',
        en: 'Making bread takes patience.',
        hint: 'volerci (one thing needed)',
      },
      {
        it: 'Per arrivare a Roma [ci vogliono] tre ore.',
        en: 'It takes three hours to get to Rome.',
        hint: 'volerci (plural)',
      },
      {
        it: 'Quanto tempo [ci metti] per andare al lavoro?',
        en: 'How long does it take you to get to work?',
        hint: 'metterci (you)',
      },
      {
        it: 'Di solito [ci metto] venti minuti a piedi.',
        en: 'It usually takes me twenty minutes on foot.',
        hint: 'metterci (I)',
      },
      {
        it: 'Provo ad aprire la porta, ma non [ci riesco].',
        en: "I'm trying to open the door, but I can't manage it.",
        hint: 'riuscirci (I)',
      },
      {
        it: 'Senza occhiali non [ci vedo] bene.',
        en: "Without my glasses I can't see well.",
        hint: 'ci + vedere (I)',
      },
      {
        it: 'Il progetto è difficile, ma voglio [provarci].',
        en: 'The project is hard, but I want to give it a try.',
        hint: 'provarci (infinitive)',
      },
      {
        it: 'Ieri [ci abbiamo messo] due ore per trovare parcheggio.',
        en: 'Yesterday it took us two hours to find a parking space.',
        hint: 'metterci (passato prossimo, we)',
      },
      {
        it: 'Hai finito il puzzle? Sì, ma [ci è voluto] un mese!',
        en: 'Have you finished the puzzle? Yes, but it took a month!',
        hint: 'volerci (passato prossimo; un mese)',
      },
      {
        it: "Hai superato l'esame? Sì, [ci sono riuscita] al primo tentativo.",
        en: 'Did you pass the exam? Yes, I managed it on the first try.',
        hint: 'riuscirci (passato prossimo, a woman speaking)',
      },
    ],
  },
  {
    id: 60,
    slug: 'ne-uses',
    title: 'More uses of ne: ne parlo, ne ho mangiati tre',
    cefr: 'B1',
    prerequisites: ['ne-partitive', 'object-pronouns-passato-prossimo'],
    noteMd: `**In short:** *ne* also replaces *di* + something ("about it", "of it"), and in the passato prossimo with a quantity the participle agrees with the thing counted: *Ne ho mangiati tre* (biscuits).

**1. ne = di + something**, after verbs and expressions that take *di*:
- *parlare di* → *Ne parliamo domani.* (We'll talk about it tomorrow.)
- *avere bisogno di* → *Ne ho bisogno.* (I need it.)
- *pensare di* (have an opinion) → *Che ne pensi?* (What do you think of it?)
- *essere contento / sicuro di* → *Ne sono sicuro.* (I'm sure of it.)
- *sapere di* → *Ne sai qualcosa?* (Do you know anything about it?)

**2. ne + quantity in the passato prossimo.** The participle takes the gender and number of the noun that *ne* replaces:

| noun replaced | sentence |
|---|---|
| *biscotti* (m. pl.) | *Ne ho mangiati tre.* |
| *birre* (f. pl.) | *Ne abbiamo bevute due.* |
| *lettera* (f. sing.) | *Ne ho scritta una.* |

When *ne* means "about it" (*di* + thing), there is no agreement: *Ne abbiamo parlato.*

A useful idiom: *Non ne posso più!* (I can't take any more!)

**Watch out:** English never changes the verb here, so it's easy to forget the agreement: *Quante foto hai fatto? Ne ho fatte cento*, with *-e* because *foto* is feminine plural. Look back at the noun to choose the ending.

Examples:
- *Che ne pensi di questo film?* (What do you think of this film?)
- *Quanti biscotti hai mangiato? Ne ho mangiati tre.* (How many biscuits did you eat? I ate three.)
- *Ne abbiamo parlato ieri.* (We talked about it yesterday.)`,
    drills: [
      {
        it: 'Parli spesso del tuo lavoro? No, non [ne parlo] mai.',
        en: 'Do you often talk about your work? No, I never talk about it.',
        hint: 'ne + parlare (I)',
      },
      {
        it: 'Hai bisogno della macchina? Sì, [ne ho] bisogno domani.',
        en: 'Do you need the car? Yes, I need it tomorrow.',
        hint: 'ne + avere (I)',
      },
      {
        it: 'Che [ne pensi] di questo film?',
        en: 'What do you think of this film?',
        hint: 'ne + pensare (you)',
      },
      {
        it: 'Questa storia è strana: tu [ne sai] qualcosa?',
        en: 'This story is odd: do you know anything about it?',
        hint: 'ne + sapere (you)',
      },
      {
        it: 'Il viaggio è stato bellissimo: [ne sono] molto contenta.',
        en: "The trip was wonderful: I'm very happy about it.",
        hint: 'ne + essere (I)',
      },
      {
        it: "C'è uno scandalo in città: [ne parlano] tutti.",
        en: "There's a scandal in town: everyone is talking about it.",
        hint: 'ne + parlare (they)',
      },
      {
        it: 'Avete parlato del problema? Sì, [ne abbiamo parlato] ieri.',
        en: 'Did you talk about the problem? Yes, we talked about it yesterday.',
        hint: 'ne + parlare (passato prossimo, we)',
      },
      {
        it: 'Quanti biscotti hai mangiato? [Ne ho mangiati] tre.',
        en: 'How many biscuits did you eat? I ate three.',
        hint: 'ne + mangiare (passato prossimo, I)',
      },
      {
        it: 'Quante birre avete bevuto? [Ne abbiamo bevute] due.',
        en: 'How many beers did you drink? We drank two.',
        hint: 'ne + bere (passato prossimo, we)',
      },
      {
        it: 'Quante foto hai fatto? [Ne ho fatte] cento!',
        en: 'How many photos did you take? I took a hundred!',
        hint: 'ne + fare (passato prossimo, I)',
      },
      {
        it: "Quanti libri ha letto Marta quest'anno? [Ne ha letti] venti.",
        en: "How many books has Marta read this year? She's read twenty.",
        hint: 'ne + leggere (passato prossimo, she)',
      },
      {
        it: 'Quante lettere hai ricevuto? Non [ne ho ricevuta] nessuna.',
        en: "How many letters did you get? I didn't get any.",
        hint: 'ne + ricevere (passato prossimo, I; agree with lettere)',
      },
      {
        it: 'Basta parlare di lavoro: non [ne posso] più!',
        en: "Enough talk about work: I can't take any more!",
        hint: "ne + potere (I; can't take any more)",
      },
    ],
  },
  {
    id: 61,
    slug: 'comparatives-irregular',
    title: 'Better and worse: migliore, meglio, peggiore, peggio',
    cefr: 'B1',
    prerequisites: ['superlatives'],
    noteMd: `**In short:** "better" and "worse" have two forms each in Italian. Use *migliore / peggiore* with a noun (a thing or person) and *meglio / peggio* with a verb.

| | goes with a noun (adjective) | goes with a verb (adverb) |
|---|---|---|
| better | *migliore* (pl. *migliori*) | *meglio* |
| worse | *peggiore* (pl. *peggiori*) | *peggio* |

- An adjective (a word that describes a noun) changes in the plural: *i ristoranti migliori*.
- An adverb (a word that describes how you do something) never changes: *Parli meglio di me.*
- With *stare* and *sentirsi* (how you feel) use the adverb: *Oggi sto meglio.*
- *È meglio* + infinitive means "it's better to": *È meglio partire presto.*

Add the article to say "the best, the worst": *il migliore*, *la peggiore*. Before a noun, *migliore* often shortens to *miglior*: *il mio miglior amico*.

Two more pairs:
- *maggiore / minore*: older / younger, for brothers and sisters (*mia sorella maggiore*)
- *ottimo / pessimo*: excellent / terrible, the strongest forms of *buono / cattivo*

For food, *più buono* is also common and correct: *Questa pizza è più buona.*

**Watch out:** "better" in English is one word, so learners say *Parli migliore* or *È una meglio idea*. Ask: does it describe a noun (*migliore*) or a verb (*meglio*)? And never say *più meglio*: *meglio* already means "more good".

Examples:
- *Questa pizza è migliore di quella di ieri.* (This pizza is better than yesterday's.)
- *Oggi sto meglio, grazie.* (I feel better today, thanks.)
- *Marco canta peggio di me.* (Marco sings worse than me.)
- *È stata la giornata peggiore della mia vita.* (It was the worst day of my life.)`,
    drills: [
      {
        it: 'Questa pizza è [migliore] di quella di ieri.',
        en: "This pizza is better than yesterday's.",
        hint: 'better (with a noun)',
        also: ['più buona'],
      },
      {
        it: 'Oggi sto [meglio], grazie.',
        en: 'I feel better today, thanks.',
        hint: 'better (with a verb)',
      },
      {
        it: 'Parli italiano [meglio] di me.',
        en: 'You speak Italian better than me.',
        hint: 'better (how you do something)',
      },
      {
        it: 'Marco canta [peggio] di me.',
        en: 'Marco sings worse than me.',
        hint: 'worse (how you do something)',
      },
      {
        it: 'Non ho dormito e mi sento [peggio] di ieri.',
        en: "I didn't sleep and I feel worse than yesterday.",
        hint: 'worse (how you feel)',
      },
      {
        it: 'Sei il mio [migliore] amico.',
        en: "You're my best friend.",
        hint: 'best (with a noun)',
        also: ['miglior'],
      },
      {
        it: 'Questi sono i ristoranti [migliori] della città.',
        en: 'These are the best restaurants in town.',
        hint: 'best (with a plural noun)',
      },
      {
        it: 'È stata la giornata [peggiore] della mia vita.',
        en: 'It was the worst day of my life.',
        hint: 'worst (with a noun)',
      },
      {
        it: 'Le notizie di oggi sono [peggiori] di quelle di ieri.',
        en: "Today's news is worse than yesterday's.",
        hint: 'worse (with a plural noun)',
      },
      {
        it: '[È meglio] partire presto domani.',
        en: "It's better to leave early tomorrow.",
        hint: "it's better (+ infinitive)",
        also: ['Meglio'],
      },
      {
        it: 'Mia sorella [maggiore] vive a Londra.',
        en: 'My older sister lives in London.',
        hint: 'older (comparative of grande)',
      },
      {
        it: 'Luca è il fratello [minore] di Anna.',
        en: "Luca is Anna's younger brother.",
        hint: 'younger (comparative of piccolo)',
      },
      {
        it: 'Grazie, il vino era [ottimo].',
        en: 'Thank you, the wine was excellent.',
        hint: 'excellent (strongest form of buono)',
        also: ['buonissimo'],
      },
    ],
  },
  {
    id: 62,
    slug: 'trapassato-prossimo',
    title: 'Past perfect: avevo già mangiato',
    cefr: 'B1',
    prerequisites: ['passato-prossimo-vs-imperfetto'],
    noteMd: `**In short:** the trapassato prossimo is the Italian "had done". It describes something that happened before another moment in the past.

Build it like the passato prossimo, but put the auxiliary (*avere* or *essere*) in the imperfect:

| | mangiare (with avere) | partire (with essere) |
|---|---|---|
| io | *avevo mangiato* | *ero partito / partita* |
| tu | *avevi mangiato* | *eri partito / partita* |
| lui, lei | *aveva mangiato* | *era partito / partita* |
| noi | *avevamo mangiato* | *eravamo partiti / partite* |
| voi | *avevate mangiato* | *eravate partiti / partite* |
| loro | *avevano mangiato* | *erano partiti / partite* |

The same verbs take *essere* as in the passato prossimo (verbs of movement and change, reflexive verbs), and with *essere* the participle agrees with the subject: *Anna era uscita*, *si era sposata*.

You use it when you are already talking about the past and need to go one step further back:
- *Quando sono arrivato, il film era cominciato.* (The film started first, then I arrived.)
- *Non avevo fame perché avevo mangiato tardi.*

Words like *già* (already), *mai* (ever, never) and *appena* (just) go between the auxiliary and the participle: *era già partito*.

**Watch out:** English often uses the simple past where Italian needs this tense: "I realised I forgot my keys" is *Mi sono accorto che avevo dimenticato le chiavi*. If one past event clearly comes before another, use the trapassato for the earlier one.

Examples:
- *Quando sono arrivato, il treno era già partito.* (When I arrived, the train had already left.)
- *Non avevo mai visto il mare.* (I had never seen the sea.)
- *Anna era stanca perché aveva lavorato tutto il giorno.* (Anna was tired because she had worked all day.)`,
    drills: [
      {
        it: 'Non avevo fame perché [avevo mangiato] tardi.',
        en: "I wasn't hungry because I had eaten late.",
        hint: 'mangiare (trapassato prossimo, I)',
      },
      {
        it: 'Anna era stanca perché [aveva lavorato] tutto il giorno.',
        en: 'Anna was tired because she had worked all day.',
        hint: 'lavorare (trapassato prossimo, she)',
      },
      {
        it: 'Quando sono arrivato, il film [era cominciato] da dieci minuti.',
        en: 'When I arrived, the film had started ten minutes earlier.',
        hint: 'cominciare (trapassato prossimo)',
      },
      {
        it: 'Mi sono accorta che [avevo dimenticato] le chiavi.',
        en: 'I realised I had forgotten my keys.',
        hint: 'dimenticare (trapassato prossimo, I)',
      },
      {
        it: 'Non sapevamo che Luca [era partito].',
        en: "We didn't know that Luca had left.",
        hint: 'partire (trapassato prossimo, he)',
      },
      {
        it: "Giulia era felice perché [aveva superato] l'esame.",
        en: 'Giulia was happy because she had passed the exam.',
        hint: 'superare (trapassato prossimo, she)',
      },
      {
        it: 'Ti ho restituito il libro che mi [avevi prestato].',
        en: 'I gave you back the book you had lent me.',
        hint: 'prestare (trapassato prossimo, you)',
      },
      {
        it: 'Prima di quel viaggio, [avevamo visto] Parigi solo in foto.',
        en: 'Before that trip, we had only seen Paris in photos.',
        hint: 'vedere (trapassato prossimo, we)',
      },
      {
        it: 'Quando li ho chiamati, i miei amici [erano usciti] da poco.',
        en: 'When I called them, my friends had just gone out.',
        hint: 'uscire (trapassato prossimo, they)',
      },
      {
        it: 'Quando siamo arrivate alla festa, gli altri [erano andati] via.',
        en: 'When we got to the party, the others had left.',
        hint: 'andare (trapassato prossimo, they)',
      },
      {
        it: 'Ragazzi, [avevate prenotato] il tavolo?',
        en: 'Guys, had you booked the table?',
        hint: 'prenotare (trapassato prossimo, you plural)',
      },
      {
        it: 'Sara mi ha detto che [si era sposata] a giugno.',
        en: 'Sara told me she had got married in June.',
        hint: 'sposarsi (trapassato prossimo, she)',
      },
    ],
  },
  {
    id: 63,
    slug: 'future-perfect-probability',
    title: 'Future perfect and guessing: avrò finito, sarà stanco',
    cefr: 'B1',
    prerequisites: ['future', 'passato-prossimo-essere'],
    noteMd: `**In short:** the future perfect (*avrò finito*, I will have finished) says that something will be done before a moment in the future. Italian also uses the future tenses to make guesses: *sarà stanco* (he's probably tired), *avrà perso il treno* (he must have missed the train).

Build it with the future of *avere* or *essere* + the participle:

| | finire (with avere) | arrivare (with essere) |
|---|---|---|
| io | *avrò finito* | *sarò arrivato / arrivata* |
| tu | *avrai finito* | *sarai arrivato / arrivata* |
| lui, lei | *avrà finito* | *sarà arrivato / arrivata* |
| noi | *avremo finito* | *saremo arrivati / arrivate* |
| voi | *avrete finito* | *sarete arrivati / arrivate* |
| loro | *avranno finito* | *saranno arrivati / arrivate* |

**1. Finished before a future moment**, often after *quando, appena* (as soon as), *dopo che* or with *entro* (by):
- *Domani a quest'ora avrò finito l'esame.*
- *Ti chiamo appena sarò arrivato.*

**2. Guessing**
- about now: simple future. *Non risponde: sarà in riunione.* (He's probably in a meeting.)
- about the past: future perfect. *Marco non è qui: avrà perso il treno.* (He must have missed the train.)
- wondering: *Dove avrò messo gli occhiali?* (Where can I have put my glasses?)

**Watch out:** in a guess the future does not talk about the future at all. *Saranno le tre* means "it must be about three o'clock" right now. Use the simple future for a guess about the present and the future perfect for a guess about something already done.

Examples:
- *Quando avremo finito i lavori, faremo una festa.* (When we've finished the work, we'll have a party.)
- *Che ore sono? Saranno le tre.* (What time is it? It must be about three.)
- *Le luci sono spente: saranno usciti.* (The lights are off: they must have gone out.)`,
    drills: [
      {
        it: "Domani a quest'ora [avrò finito] l'esame.",
        en: "This time tomorrow I'll have finished the exam.",
        hint: 'finire (future perfect, I)',
      },
      {
        it: 'Ti chiamo appena [sarò arrivato] a casa.',
        en: "I'll call you as soon as I've got home.",
        hint: 'arrivare (future perfect, a man speaking)',
      },
      {
        it: 'Quando [avremo finito] i lavori, faremo una festa.',
        en: "When we've finished the work, we'll have a party.",
        hint: 'finire (future perfect, we)',
      },
      {
        it: 'Dopo che [avrai letto] il libro, dimmi cosa ne pensi.',
        en: "Once you've read the book, tell me what you think of it.",
        hint: 'leggere (future perfect, you)',
      },
      {
        it: "Entro giugno i ragazzi [saranno tornati] dall'Australia.",
        en: 'By June the kids will have come back from Australia.',
        hint: 'tornare (future perfect, they)',
      },
      {
        it: 'Non risponde: [sarà] in riunione.',
        en: "He's not answering: he's probably in a meeting.",
        hint: 'essere (future, guessing)',
      },
      {
        it: 'Che ore sono? [Saranno] le tre.',
        en: 'What time is it? It must be about three.',
        hint: 'essere (future, guessing)',
      },
      {
        it: "Quanti anni ha quel signore? [Avrà] ottant'anni.",
        en: 'How old is that man? He must be about eighty.',
        hint: 'avere (future, guessing)',
      },
      {
        it: 'Marco non è ancora qui: [avrà perso] il treno.',
        en: "Marco isn't here yet: he must have missed the train.",
        hint: 'perdere (future perfect, guessing)',
      },
      {
        it: 'Anna è di buon umore: [avrà ricevuto] buone notizie.',
        en: 'Anna is in a good mood: she must have had good news.',
        hint: 'ricevere (future perfect, guessing)',
      },
      {
        it: 'Le luci sono spente: [saranno usciti].',
        en: 'The lights are off: they must have gone out.',
        hint: 'uscire (future perfect, guessing, they)',
      },
      {
        it: 'Chi ha chiamato? Non so, [sarà stata] tua madre.',
        en: "Who called? I don't know, it was probably your mother.",
        hint: 'essere (future perfect, guessing, feminine)',
      },
      {
        it: 'Dove [avrò messo] gli occhiali?',
        en: 'Where can I have put my glasses?',
        hint: 'mettere (future perfect, I, wondering)',
      },
    ],
  },
  {
    id: 64,
    slug: 'conditional-past',
    title: 'Past conditional: avrei voluto, sarei venuto',
    cefr: 'B1',
    prerequisites: ['conditional'],
    noteMd: `**In short:** the past conditional is "would have done": *avrei voluto* (I would have liked), *sarei venuto* (I would have come). It is also how Italian says "would" when reporting a past promise: *Ha detto che sarebbe venuto.*

Build it with the conditional of *avere* or *essere* + the participle:

| | volere (with avere) | venire (with essere) |
|---|---|---|
| io | *avrei voluto* | *sarei venuto / venuta* |
| tu | *avresti voluto* | *saresti venuto / venuta* |
| lui, lei | *avrebbe voluto* | *sarebbe venuto / venuta* |
| noi | *avremmo voluto* | *saremmo venuti / venute* |
| voi | *avreste voluto* | *sareste venuti / venute* |
| loro | *avrebbero voluto* | *sarebbero venuti / venute* |

The main uses:
- something that didn't happen: *Avrei comprato quella giacca, ma costava troppo.*
- regrets and criticism with modal verbs: *avrei dovuto* (I should have), *avrei potuto* (I could have): *Avresti dovuto dirmelo!*
- **the future seen from the past**, after a past verb like *ha detto, pensavo, sapevo*: *Marco ha detto che sarebbe arrivato alle otto.* (Marco said he would arrive at eight.)

**Watch out:** in that last use English has a simple "would" ("he said he would come"), so learners use the present conditional: *ha detto che verrebbe*. That is wrong in standard Italian. After a past verb of saying or thinking, use the past conditional: *ha detto che sarebbe venuto*, even if he may still come.

Examples:
- *Avrei voluto venire, ma ero malato.* (I would have liked to come, but I was ill.)
- *Avresti dovuto dirmelo prima!* (You should have told me before!)
- *Pensavo che il film sarebbe stato noioso.* (I thought the film would be boring.)`,
    drills: [
      {
        it: '[Avrei voluto] venire, ma ero malato.',
        en: 'I would have liked to come, but I was ill.',
        hint: 'volere (past conditional, I)',
      },
      {
        it: '[Sarei venuta] volentieri alla festa.',
        en: 'I would gladly have come to the party.',
        hint: 'venire (past conditional, a woman speaking)',
      },
      {
        it: '[Avrei comprato] quella giacca, ma costava troppo.',
        en: 'I would have bought that jacket, but it cost too much.',
        hint: 'comprare (past conditional, I)',
      },
      {
        it: 'Mi [sarebbe piaciuto] vivere al mare.',
        en: 'I would have liked to live by the sea.',
        hint: 'piacere (past conditional)',
      },
      {
        it: 'Con più tempo, [avremmo visitato] anche Firenze.',
        en: 'With more time, we would have visited Florence too.',
        hint: 'visitare (past conditional, we)',
      },
      {
        it: 'Al posto tuo, non [avrei detto] niente.',
        en: "If I were you, I wouldn't have said anything.",
        hint: 'dire (past conditional, I)',
      },
      {
        it: '[Avresti dovuto] dirmelo prima!',
        en: 'You should have told me before!',
        hint: 'dovere (past conditional, you)',
      },
      {
        it: '[Avrei potuto] aiutarti: perché non mi hai chiamato?',
        en: "I could have helped you: why didn't you call me?",
        hint: 'potere (past conditional, I)',
      },
      {
        it: "Ragazze, [sareste rimaste] ancora un po'?",
        en: 'Girls, would you have stayed a bit longer?',
        hint: 'rimanere (past conditional, you plural, women)',
      },
      {
        it: 'Marco ha detto che [sarebbe arrivato] alle otto.',
        en: 'Marco said he would arrive at eight.',
        hint: 'arrivare (future in the past)',
      },
      {
        it: 'Pensavo che il film [sarebbe stato] noioso.',
        en: 'I thought the film would be boring.',
        hint: 'essere (future in the past)',
      },
      {
        it: 'Sapevo che Giulia [avrebbe capito].',
        en: 'I knew Giulia would understand.',
        hint: 'capire (future in the past)',
      },
      {
        it: 'Mi avevano promesso che mi [avrebbero scritto].',
        en: 'They had promised they would write to me.',
        hint: 'scrivere (future in the past, they)',
      },
    ],
  },
  {
    id: 65,
    slug: 'si-impersonale',
    title: 'Impersonal si: si mangia bene qui',
    cefr: 'B1',
    prerequisites: ['reflexive-verbs'],
    noteMd: `**In short:** *si* + a verb in the *lui/lei* form talks about people in general, like English "you", "one", "people" or "they": *Qui si mangia bene.* (You eat well here.)

How it works:
- *si* + third person singular: *si mangia, si dice, si parte, si arriva*.
- In the negative: *non si* + verb: *Qui non si fuma.*
- With a plural noun (the thing people buy, sell, eat...), the verb goes plural: *Qui si vendono biglietti.* More on this in a later lesson.
- With *essere*, an adjective after it is plural: *Quando si è giovani...*
- With a reflexive verb (*alzarsi, vestirsi*), you can't say *si si*: it becomes **ci si**: *In vacanza ci si alza tardi.*
- In the passato prossimo it uses *essere*: *Alla festa si è ballato molto.*

| personal | impersonal |
|---|---|
| *Mangio bene qui.* (I eat well) | *Si mangia bene qui.* (you eat well) |
| *Come dici "grazie"?* | *Come si dice "grazie"?* |
| *Mi alzo tardi.* | *Ci si alza tardi.* |

**Watch out:** English uses "you" or "they" for people in general; don't translate them as *tu* or *loro*. "How do you say...?" is *Come si dice...?*, and "they speak Italian here" is *Qui si parla italiano*.

Examples:
- *In questo ristorante si mangia benissimo.* (You eat really well in this restaurant.)
- *Come si dice "thank you" in italiano?* (How do you say "thank you" in Italian?)
- *In vacanza ci si alza tardi.* (On holiday you get up late.)`,
    drills: [
      {
        it: 'In questo ristorante [si mangia] benissimo.',
        en: 'You eat really well in this restaurant.',
        hint: 'si + mangiare',
      },
      {
        it: 'Come [si dice] «thank you» in italiano?',
        en: 'How do you say "thank you" in Italian?',
        hint: 'si + dire',
      },
      {
        it: 'Da qui [si vede] il mare.',
        en: 'You can see the sea from here.',
        hint: 'si + vedere',
      },
      {
        it: 'In Italia [si cena] tardi.',
        en: 'In Italy people have dinner late.',
        hint: 'si + cenare',
      },
      {
        it: 'In biblioteca non [si parla] ad alta voce.',
        en: "You don't talk loudly in the library.",
        hint: 'si + parlare',
      },
      {
        it: 'Quando fa caldo, [si dorme] male.',
        en: "When it's hot, you sleep badly.",
        hint: 'si + dormire',
      },
      {
        it: 'Scusi, come [si arriva] in centro?',
        en: 'Excuse me, how do you get to the centre?',
        hint: 'si + arrivare',
      },
      {
        it: 'In quella trattoria [si spende] poco.',
        en: "You don't spend much in that trattoria.",
        hint: 'si + spendere',
      },
      {
        it: "Qui [si vendono] biglietti dell'autobus?",
        en: 'Do they sell bus tickets here?',
        hint: 'si + vendere (with a plural noun)',
      },
      {
        it: 'Quando [si è] giovani, tutto sembra possibile.',
        en: "When you're young, everything seems possible.",
        hint: 'si + essere',
      },
      {
        it: 'In vacanza [ci si alza] tardi.',
        en: 'On holiday you get up late.',
        hint: 'alzarsi (impersonal)',
      },
      {
        it: 'In ufficio [ci si veste] in modo elegante.',
        en: 'At the office people dress smartly.',
        hint: 'vestirsi (impersonal)',
      },
      {
        it: "Ieri sera alla festa [si è ballato] fino all'alba.",
        en: 'Last night at the party people danced until dawn.',
        hint: 'si + ballare (passato prossimo)',
      },
    ],
  },
  {
    id: 66,
    slug: 'impersonal-verbs',
    title: 'Bisogna, basta, serve, conviene',
    cefr: 'B1',
    prerequisites: ['indirect-object-pronouns'],
    noteMd: `**In short:** some very common verbs have no real subject (no "I", "you" or "he" doing the action). They say what is necessary, enough, needed or worth doing: *bisogna, basta, serve, conviene*.

| verb | meaning | example |
|---|---|---|
| *bisogna* + infinitive | you have to, it's necessary | *Bisogna avere il biglietto.* |
| *basta* + infinitive or noun | you only need, it's enough | *Basta chiedere.* *Basta un minuto.* |
| *serve / servono* | is / are needed | *Mi serve una penna.* |
| *conviene* + infinitive | it's better, it's worth it | *Ti conviene prendere il treno.* |

- **bisogna** never changes and takes no pronoun. To say "I need something", use *ho bisogno di*.
- **basta** on its own means "Enough!", and *Basta con...!* means "Enough of...!"
- **servire** works like *piacere*: the person goes in an indirect pronoun (*mi, ti, gli, le, ci, vi*) or with *a*, and the verb agrees with the thing needed: *Mi serve la macchina*, *Mi servono due uova*. In the passato prossimo it uses *essere*: *Il tuo aiuto mi è servito.*
- **conviene** also takes the indirect pronoun for the person: *Ci conviene partire presto.* (We'd better leave early.)

**Watch out:** with *servire*, the thing needed is the subject, as with *piacere*. So it's *Mi servono le chiavi* (plural, because of *le chiavi*), not *Mi serve le chiavi* and not *Io servo le chiavi*.

Examples:
- *Per entrare bisogna avere il biglietto.* (You need a ticket to get in.)
- *Basta chiedere al bancone.* (You just need to ask at the counter.)
- *Per la torta mi servono tre uova.* (I need three eggs for the cake.)
- *Ti conviene prendere la metro.* (You'd better take the underground.)`,
    drills: [
      {
        it: 'Per entrare [bisogna] avere il biglietto.',
        en: 'You need a ticket to get in.',
        hint: "it's necessary (impersonal verb)",
      },
      {
        it: 'Non [bisogna] avere paura del buio.',
        en: "You mustn't be afraid of the dark.",
        hint: "it's necessary (impersonal verb)",
      },
      {
        it: '[Basta] chiedere al bancone.',
        en: 'You just need to ask at the counter.',
        hint: "it's enough (+ infinitive)",
      },
      {
        it: '[Basta] un minuto per iscriversi.',
        en: 'It only takes a minute to sign up.',
        hint: "it's enough (+ noun)",
      },
      { it: '[Basta] con queste domande!', en: 'Enough with these questions!', hint: 'enough!' },
      { it: 'Ti [serve] una mano?', en: 'Do you need a hand?', hint: 'servire (one thing needed)' },
      {
        it: 'Per la torta mi [servono] tre uova.',
        en: 'I need three eggs for the cake.',
        hint: 'servire (several things needed)',
      },
      {
        it: 'Gli [servono] le chiavi della macchina?',
        en: 'Does he need the car keys?',
        hint: 'servire (several things needed)',
      },
      {
        it: 'Ai ragazzi [serve] un computer nuovo.',
        en: 'The kids need a new computer.',
        hint: 'servire (one thing needed)',
      },
      {
        it: 'Grazie, il tuo consiglio mi [è servito] molto.',
        en: 'Thanks, your advice was really useful to me.',
        hint: 'servire (passato prossimo)',
      },
      {
        it: 'Ci [conviene] partire presto per evitare il traffico.',
        en: "We'd better leave early to avoid the traffic.",
        hint: "convenire (it's better for us)",
      },
      {
        it: 'Non ti [conviene] comprare la macchina adesso.',
        en: "It isn't worth buying the car now.",
        hint: "convenire (it's worth it for you)",
      },
    ],
  },
  {
    id: 67,
    slug: 'stare-per',
    title: 'About to: stare per + infinitive',
    cefr: 'B1',
    prerequisites: ['stare-gerund'],
    noteMd: `**In short:** *stare per* + infinitive means "to be about to" do something: *Sto per uscire.* (I'm about to go out.)

Use *stare* in the present for now, and in the imperfect for the past:

| | present | imperfect |
|---|---|---|
| io | *sto per uscire* | *stavo per uscire* |
| tu | *stai per uscire* | *stavi per uscire* |
| lui, lei | *sta per uscire* | *stava per uscire* |
| noi | *stiamo per uscire* | *stavamo per uscire* |
| voi | *state per uscire* | *stavate per uscire* |
| loro | *stanno per uscire* | *stavano per uscire* |

- The infinitive never changes; only *stare* changes for the person.
- Pronouns attach to the infinitive: *Stavo per chiamarti.* (I was just about to call you.)
- The imperfect is very common when something interrupts the action, or when it nearly happened: *Stavo per dimenticare il portafoglio.* (I nearly forgot my wallet.)
- It works with weather too: *Sta per piovere.*

**Watch out:** don't confuse it with *stare* + gerund (the *-ando, -endo* form), which you learnt earlier. *Sto mangiando* means "I'm eating" right now; *Sto per mangiare* means "I'm about to eat". And don't translate "about" literally: *sono circa di uscire* is wrong.

Examples:
- *Aspetta, sto per uscire.* (Wait, I'm about to go out.)
- *Il treno sta per partire.* (The train is about to leave.)
- *Quando hai telefonato, stavamo per mangiare.* (When you rang, we were about to eat.)`,
    drills: [
      {
        it: 'Aspetta, [sto per uscire].',
        en: "Wait, I'm about to go out.",
        hint: 'uscire (about to, I)',
      },
      {
        it: 'Il treno [sta per partire].',
        en: 'The train is about to leave.',
        hint: 'partire (about to)',
      },
      {
        it: 'Sbrigati, il film [sta per cominciare].',
        en: 'Hurry up, the film is about to start.',
        hint: 'cominciare (about to)',
      },
      {
        it: 'Gli ospiti [stanno per arrivare].',
        en: 'The guests are about to arrive.',
        hint: 'arrivare (about to, they)',
      },
      {
        it: '[Stai per andare] via?',
        en: 'Are you about to leave?',
        hint: 'andare (about to, you)',
      },
      {
        it: "Ragazzi, [state per perdere] l'autobus!",
        en: "Guys, you're about to miss the bus!",
        hint: 'perdere (about to, you plural)',
      },
      {
        it: 'Non posso parlare, [sto per entrare] in riunione.',
        en: "I can't talk, I'm about to go into a meeting.",
        hint: 'entrare (about to, I)',
      },
      {
        it: 'Mia sorella [sta per avere] un bambino.',
        en: 'My sister is about to have a baby.',
        hint: 'avere (about to)',
      },
      {
        it: '[Stavo per chiamarti]!',
        en: 'I was just about to call you!',
        hint: 'chiamare + you (about to, imperfect, I)',
      },
      {
        it: 'Quando hai telefonato, [stavamo per mangiare].',
        en: 'When you rang, we were about to eat.',
        hint: 'mangiare (about to, imperfect, we)',
      },
      {
        it: '[Stavo per dimenticare] il portafoglio.',
        en: 'I nearly forgot my wallet.',
        hint: 'dimenticare (about to, imperfect, I)',
      },
      {
        it: 'Il cielo era nero: [stava per piovere].',
        en: 'The sky was black: it was about to rain.',
        hint: 'piovere (about to, imperfect)',
      },
    ],
  },
  {
    id: 88,
    slug: 'gerund-clauses',
    title: 'Gerund clauses: studiando, ho imparato',
    cefr: 'B1',
    prerequisites: ['stare-gerund'],
    noteMd: `**In short:** The gerund (the *-ando, -endo* form you know from *sto parlando*) can stand on its own to say **how**, **when**, **why** or **on what condition** something happens. It replaces a whole clause (a part of the sentence with its own verb).

Forms: *-are* verbs take *-ando* (*parlando*), *-ere* and *-ire* verbs take *-endo* (*prendendo, partendo*). Irregular ones use the long stem: *facendo, dicendo, bevendo*.

What it can mean:
- how, by what means: *Studiando ogni giorno, ho imparato.* (By studying every day, I learnt.)
- while, when: *Tornando a casa, ho incontrato Luca.* (On my way home, I ran into Luca.)
- why, since: *Essendo stanca, sono andata a letto.* (Being tired, I went to bed.)
- if: *Volendo, possiamo partire domani.* (If we want, we can leave tomorrow.)
- although, with *pur*: *Pur avendo poco tempo, mi ha aiutato.* (Although he had little time, he helped me.)

Object pronouns attach to the end: *vedendola* (seeing her), *parlandogli* (talking to him).

The gerund normally has the same subject as the main verb. *Uscendo, ho visto Anna* means I was going out, not Anna.

**Watch out:** many English "-ing" forms are not gerunds in Italian. After a preposition, or as a subject, use the infinitive: "before leaving" is *prima di partire*, "without saying" is *senza dire*, "swimming is good for you" is *nuotare fa bene*.

Examples:
- *Sbagliando s'impara.* (You learn by making mistakes.)
- *Leggendo il giornale, ho scoperto la notizia.* (Reading the newspaper, I found out the news.)
- *Il bambino è entrato piangendo.* (The child came in crying.)`,
    drills: [
      {
        it: "[Studiando] ogni giorno, ho imparato l'italiano.",
        en: 'By studying every day, I learnt Italian.',
        hint: 'studiare (gerund)',
      },
      {
        it: '[Tornando] a casa, ho incontrato Luca.',
        en: 'On my way home, I ran into Luca.',
        hint: 'tornare (gerund)',
      },
      {
        it: "[Sbagliando] s'impara.",
        en: 'You learn by making mistakes.',
        hint: 'sbagliare (gerund)',
      },
      {
        it: 'Il bambino è entrato [piangendo].',
        en: 'The child came in crying.',
        hint: 'piangere (gerund)',
      },
      {
        it: 'Ho trovato il portafoglio [cercando] le chiavi.',
        en: 'I found my wallet while I was looking for the keys.',
        hint: 'cercare (gerund)',
      },
      {
        it: '[Leggendo] il giornale, ho scoperto la notizia.',
        en: 'Reading the newspaper, I found out the news.',
        hint: 'leggere (gerund)',
      },
      {
        it: '[Facendo] sport tutti i giorni, sto molto meglio.',
        en: 'By doing sport every day, I feel much better.',
        hint: 'fare (gerund)',
      },
      {
        it: '[Essendo] stanca, sono andata a letto presto.',
        en: 'Being tired, I went to bed early.',
        hint: 'essere (gerund: reason)',
      },
      {
        it: '[Prendendo] la metro, arriverai prima.',
        en: "If you take the underground, you'll get there sooner.",
        hint: 'prendere (gerund: condition)',
      },
      {
        it: '[Volendo], possiamo partire domani.',
        en: 'If we want, we can leave tomorrow.',
        hint: 'volere (gerund: condition)',
      },
      {
        it: 'Pur [avendo] poco tempo, mi ha aiutato.',
        en: 'Although he had little time, he helped me.',
        hint: 'avere (gerund after pur)',
      },
      {
        it: '[Dicendo] queste parole, è uscito dalla stanza.',
        en: 'Saying these words, he left the room.',
        hint: 'dire (gerund)',
      },
      {
        it: '[Vedendola] così triste, le ho chiesto cosa avesse.',
        en: 'Seeing her so sad, I asked her what was wrong.',
        hint: 'vedere + her (gerund with pronoun)',
      },
    ],
  },
  {
    id: 68,
    slug: 'infinitive-past',
    title: 'Before and after: prima di + infinitive, dopo aver fatto',
    cefr: 'B1',
    prerequisites: ['passato-prossimo-essere', 'verb-preposition-infinitive'],
    noteMd: `**In short:** to say "before doing" use *prima di* + infinitive (*prima di mangiare*). To say "after doing" use *dopo* + the past infinitive (*dopo aver mangiato*).

**Before:** *prima di* + infinitive.
- *Lavati le mani prima di mangiare.* (before eating)
- Pronouns attach to the infinitive: *prima di vederti*, *prima di alzarsi*.

**After:** *dopo* + past infinitive. The past infinitive is *avere* or *essere* + the participle:
- with *avere* (usually shortened to *aver*): *dopo aver mangiato, dopo aver finito*
- with *essere*, the participle agrees with the subject: *dopo essere arrivato / arrivata / arrivati / arrivate*
- reflexive verbs attach the pronoun to *essere*: *dopo essermi alzato, dopo essersi alzata*

| | before | after |
|---|---|---|
| mangiare | *prima di mangiare* | *dopo aver mangiato* |
| uscire | *prima di uscire* | *dopo essere uscito/a* |
| alzarsi | *prima di alzarsi* | *dopo essersi alzato/a* |

The past infinitive is also used after *grazie per* (thanks for): *Grazie per essere venuti!*

Both work only when the person doing the two actions is the same: *Dopo aver mangiato (io), sono uscito (io).*

**Watch out:** English uses the *-ing* form ("before eating, after leaving"), but Italian never uses the gerund here. Say *prima di partire*, not *prima partendo*. For "after", the simple infinitive is a common mistake: say *dopo aver mangiato*, not *dopo mangiare*.

Examples:
- *Chiamami prima di partire.* (Call me before you leave.)
- *Dopo aver finito il lavoro, sono andato in palestra.* (After finishing work, I went to the gym.)
- *Dopo essere arrivata a casa, Anna ha fatto una doccia.* (After getting home, Anna had a shower.)`,
    drills: [
      {
        it: 'Lavati le mani [prima di mangiare].',
        en: 'Wash your hands before eating.',
        hint: 'before + mangiare',
      },
      {
        it: 'Chiamami [prima di partire].',
        en: 'Call me before you leave.',
        hint: 'before + partire',
      },
      {
        it: 'Pensaci bene [prima di rispondere].',
        en: 'Think carefully before answering.',
        hint: 'before + rispondere',
      },
      {
        it: "[Prima di andare] a letto, leggo sempre un po'.",
        en: 'Before going to bed, I always read a bit.',
        hint: 'before + andare',
      },
      {
        it: '[Prima di uscire], spegni la luce.',
        en: 'Turn off the light before you go out.',
        hint: 'before + uscire',
      },
      {
        it: '[Dopo aver mangiato], facciamo una passeggiata.',
        en: "After eating, let's go for a walk.",
        hint: 'after + mangiare (past infinitive)',
        also: ['Dopo avere mangiato'],
      },
      {
        it: '[Dopo aver finito] il lavoro, sono andato in palestra.',
        en: 'After finishing work, I went to the gym.',
        hint: 'after + finire (past infinitive)',
        also: ['Dopo avere finito'],
      },
      {
        it: 'Mi sono addormentato [dopo aver letto] due pagine.',
        en: 'I fell asleep after reading two pages.',
        hint: 'after + leggere (past infinitive)',
        also: ['dopo avere letto'],
      },
      {
        it: '[Dopo essere arrivata] a casa, Anna ha fatto una doccia.',
        en: 'After getting home, Anna had a shower.',
        hint: 'after + arrivare (past infinitive)',
      },
      {
        it: '[Dopo essere usciti] dal cinema, siamo andati a cena.',
        en: 'After leaving the cinema, we went for dinner.',
        hint: 'after + uscire (past infinitive, we)',
      },
      {
        it: '[Dopo essersi alzata], Giulia beve un caffè.',
        en: 'After getting up, Giulia has a coffee.',
        hint: 'after + alzarsi (past infinitive)',
      },
      {
        it: 'Grazie per [essere venuti]!',
        en: 'Thanks for coming!',
        hint: 'venire (past infinitive, to a group)',
      },
    ],
  },
  {
    id: 69,
    slug: 'connectors',
    title: 'Linking ideas: quindi, però, invece, siccome, anche se',
    cefr: 'B1',
    prerequisites: ['linking-words'],
    noteMd: `**In short:** connectors are the small words that link ideas and show how they relate: a result, a contrast, a reason. They make your Italian sound fluent instead of a list of short sentences.

| connector | meaning | use |
|---|---|---|
| *quindi, allora* | so, therefore | a result |
| *però* | but, however | a contrast |
| *invece* | instead, whereas, on the other hand | a different choice or a comparison |
| *siccome* | since, as | a reason, at the start of the sentence |
| *perché* | because | a reason, after the main idea |
| *anche se* | even though, even if | a contrast with a fact |
| *mentre* | while | two things at the same time |
| *infatti* | indeed, and sure enough | confirms what was just said |
| *comunque* | anyway, however | moving on despite something |

A few notes on position:
- *siccome* comes first: *Siccome era tardi, abbiamo preso un taxi.* With the reason second, use *perché*: *Abbiamo preso un taxi perché era tardi.*
- *però* and *invece* can also go after the subject or at the end: *Io prendo il treno, Marco invece va in macchina.*
- *comunque* can go at the end too: *Esco comunque.* (I'm going out anyway.)
- *anche se* takes the normal indicative (the ordinary present, past...): *Esco anche se piove.*

**Watch out:** *infatti* is a false friend. It doesn't correct anything like English "in fact" ("I thought it was easy; in fact, it was hard"). It confirms: *Ha detto che sarebbe arrivato tardi, e infatti è arrivato alle dieci.* To correct, use *invece* or *in realtà*.

Examples:
- *Piove, quindi restiamo a casa.* (It's raining, so we're staying in.)
- *Il ristorante è caro, però si mangia bene.* (The restaurant is expensive, but the food is good.)
- *Siccome era tardi, abbiamo preso un taxi.* (As it was late, we took a taxi.)
- *Esco anche se piove.* (I'm going out even though it's raining.)`,
    drills: [
      {
        it: 'Piove, [quindi] restiamo a casa.',
        en: "It's raining, so we're staying in.",
        hint: 'so (a result)',
        also: ['allora', 'perciò', 'così'],
      },
      {
        it: 'Il ristorante è caro, [però] si mangia bene.',
        en: 'The restaurant is expensive, but the food is good.',
        hint: 'but, however (a contrast)',
        also: ['ma'],
      },
      {
        it: 'Sono stanca [perché] ho lavorato molto.',
        en: "I'm tired because I've worked a lot.",
        hint: 'because (reason after the main idea)',
        also: ['poiché'],
      },
      {
        it: '[Siccome] era tardi, abbiamo preso un taxi.',
        en: 'As it was late, we took a taxi.',
        hint: 'since, as (reason at the start)',
        also: ['Poiché', 'Dato che', 'Visto che'],
      },
      {
        it: 'Io prendo il treno, Marco [invece] va in macchina.',
        en: "I'm taking the train, whereas Marco is going by car.",
        hint: 'whereas, on the other hand',
      },
      {
        it: 'Esco [anche se] piove.',
        en: "I'm going out even though it's raining.",
        hint: 'even though',
      },
      {
        it: '[Anche se] è ricco, vive in una casa piccola.',
        en: "Even though he's rich, he lives in a small house.",
        hint: 'even though',
      },
      {
        it: '[Mentre] cucinavo, ascoltavo la radio.',
        en: 'While I was cooking, I was listening to the radio.',
        hint: 'while (at the same time)',
      },
      {
        it: 'Ha detto che sarebbe arrivato tardi, e [infatti] è arrivato alle dieci.',
        en: "He said he'd be late, and sure enough he arrived at ten.",
        hint: 'indeed, sure enough (confirms)',
      },
      {
        it: 'Forse pioverà, forse no: io esco [comunque].',
        en: "Maybe it'll rain, maybe not: I'm going out anyway.",
        hint: 'anyway (whatever happens)',
        also: ['lo stesso', 'ugualmente'],
      },
      {
        it: 'Abbiamo perso il treno e [quindi] siamo arrivati tardi.',
        en: 'We missed the train and so we arrived late.',
        hint: 'so, therefore (a result)',
        also: ['allora', 'perciò', 'così'],
      },
      {
        it: 'Hai finito? [Allora] possiamo andare.',
        en: 'Have you finished? Then we can go.',
        hint: 'then, in that case',
        also: ['Quindi'],
      },
    ],
  },
  {
    id: 70,
    slug: 'if-real',
    title: 'Real conditions: se + present or future',
    cefr: 'B1',
    prerequisites: ['future'],
    noteMd: `**In short:** to talk about something that can really happen ("if it rains, we'll stay in"), use *se* (if) + the present or the future, and the present, future or imperative in the other part.

A sentence with *se* has two parts: the condition (*se piove*) and the result (*restiamo a casa*).

| condition (se...) | result |
|---|---|
| present: *Se piove,* | present: *restiamo a casa.* |
| present: *Se hai fame,* | imperative: *mangia qualcosa!* |
| future: *Se avrò tempo,* | future: *ti chiamerò.* |

- In everyday speech the present in both parts is the most common: *Se vuoi, ti accompagno.*
- When the whole thing is in the future, you can use the future in both parts, which sounds a little more careful: *Se domani farà bel tempo, andremo al mare.*
- The order can change: *Ti chiamo se arrivo tardi.*

These are real, possible conditions. For imaginary ones ("if I were rich") Italian uses other tenses, which come later.

**Watch out:** English never puts "will" after "if", but Italian can use the future there: *Se verrai, sarò contento* is correct. The opposite mistake is worse: don't use the conditional for a real condition. "If you want, I'll help you" is *Se vuoi, ti aiuto*, not *Se vuoi, ti aiuterei*.

Examples:
- *Se piove, restiamo a casa.* (If it rains, we'll stay in.)
- *Se vuoi, ti accompagno io.* (If you like, I'll take you.)
- *Se avrò tempo, ti chiamerò.* (If I have time, I'll call you.)
- *Se ti senti male, chiama il medico.* (If you feel ill, call the doctor.)`,
    drills: [
      {
        it: 'Se [piove], restiamo a casa.',
        en: "If it rains, we'll stay in.",
        hint: 'piovere (present)',
      },
      {
        it: 'Se [vuoi], ti accompagno io.',
        en: "If you like, I'll take you.",
        hint: 'volere (present, you)',
      },
      {
        it: 'Se hai fame, [mangia] qualcosa!',
        en: "If you're hungry, eat something!",
        hint: 'mangiare (imperative, tu)',
      },
      {
        it: "Se non [studi], non passi l'esame.",
        en: "If you don't study, you won't pass the exam.",
        hint: 'studiare (present, you)',
      },
      {
        it: 'Se [arrivate] presto, troviamo posto.',
        en: "If you arrive early, we'll find a seat.",
        hint: 'arrivare (present, you plural)',
      },
      {
        it: 'Se Marco [finisce] presto, viene con noi.',
        en: "If Marco finishes early, he'll come with us.",
        hint: 'finire (present)',
      },
      {
        it: 'Se il negozio [è] chiuso, torno domani.',
        en: "If the shop is closed, I'll come back tomorrow.",
        hint: 'essere (present)',
      },
      {
        it: 'Se ti [senti] male, chiama il medico.',
        en: 'If you feel ill, call the doctor.',
        hint: 'sentirsi (present, you)',
      },
      {
        it: 'Se domani [farà] bel tempo, andremo al mare.',
        en: "If the weather is nice tomorrow, we'll go to the seaside.",
        hint: 'fare (future)',
        also: ['fa'],
      },
      {
        it: 'Se avrò tempo, ti [chiamerò].',
        en: "If I have time, I'll call you.",
        hint: 'chiamare (future, I)',
        also: ['chiamo'],
      },
      {
        it: 'Se [vedrai] Anna, salutala da parte mia.',
        en: 'If you see Anna, say hello to her from me.',
        hint: 'vedere (future, you)',
        also: ['vedi'],
      },
      {
        it: 'Se [potremo], verremo a trovarvi a Natale.',
        en: "If we can, we'll come and see you at Christmas.",
        hint: 'potere (future, we)',
        also: ['possiamo'],
      },
      {
        it: 'Se non vi sbrigate, [perderete] il treno.',
        en: "If you don't hurry up, you'll miss the train.",
        hint: 'perdere (future, you plural)',
        also: ['perdete'],
      },
    ],
  },
  {
    id: 83,
    slug: 'passive-essere',
    title: 'The passive with essere: è stato costruito',
    cefr: 'B1',
    prerequisites: ['passato-prossimo-essere'],
    noteMd: `**In short:** In a passive sentence the thing that receives the action becomes the subject: "the house was built" instead of "they built the house". Italian forms it with **essere + past participle**, and the participle agrees with the subject like an adjective.

How to build it: put *essere* in the tense you need, then add the participle.

| Tense | Passive |
|---|---|
| present | *è costruito* (is built) |
| imperfetto | *era costruito* (was built, used to be) |
| passato prossimo | *è stato costruito* (was built, has been built) |
| future | *sarà costruito* (will be built) |

In compound tenses both *stato* and the participle agree: *la casa è stata venduta*, *i ponti sono stati costruiti*, *le lettere sono state scritte*.

To say who did it (the agent), use *da* (with its article: *dal, dalla, dai*...):
- *Il libro è stato scritto da Calvino.* (The book was written by Calvino.)
- *Il ladro è stato arrestato dalla polizia.* (The thief was arrested by the police.)

Only verbs that can take a direct object (a "what?" after the verb, like *vendere qualcosa*) can be made passive. *Andare* or *arrivare* cannot.

The passive works in every mood too: *Penso che il problema sia stato risolto.* (I think the problem has been solved.)

**Watch out:** "by" is *da*, never *per*: *scritto da Calvino*. And do not forget the double agreement: *la finestra è stata aperta*, not *è stato aperto*.

Examples:
- *Il Colosseo è stato costruito quasi duemila anni fa.* (The Colosseum was built almost two thousand years ago.)
- *Questi prodotti sono venduti in tutto il mondo.* (These products are sold all over the world.)
- *I risultati saranno pubblicati lunedì.* (The results will be published on Monday.)`,
    drills: [
      {
        it: 'Il Colosseo [è stato costruito] quasi duemila anni fa.',
        en: 'The Colosseum was built almost two thousand years ago.',
        hint: 'costruire (passive, passato prossimo)',
      },
      {
        it: 'La lettera [è stata scritta] da mia nonna.',
        en: 'The letter was written by my grandmother.',
        hint: 'scrivere (passive, passato prossimo)',
      },
      {
        it: 'Questi prodotti [sono venduti] in tutto il mondo.',
        en: 'These products are sold all over the world.',
        hint: 'vendere (passive, present)',
        also: ['vengono venduti'],
      },
      {
        it: 'Le finestre [sono state aperte] dai bambini.',
        en: 'The windows were opened by the children.',
        hint: 'aprire (passive, passato prossimo)',
      },
      {
        it: 'Il ladro [è stato arrestato] dalla polizia ieri sera.',
        en: 'The thief was arrested by the police last night.',
        hint: 'arrestare (passive, passato prossimo)',
      },
      {
        it: 'Il nuovo ponte [sarà inaugurato] a maggio.',
        en: 'The new bridge will be opened in May.',
        hint: 'inaugurare (passive, future)',
        also: ['verrà inaugurato'],
      },
      {
        it: 'I risultati [saranno pubblicati] la settimana prossima.',
        en: 'The results will be published next week.',
        hint: 'pubblicare (passive, future)',
        also: ['verranno pubblicati'],
      },
      {
        it: 'Ai tempi di mio nonno, la piazza [era usata] come mercato.',
        en: "In my grandfather's day, the square was used as a market.",
        hint: 'usare (passive, imperfetto)',
        also: ['veniva usata'],
      },
      {
        it: 'Noi [siamo stati invitati] al matrimonio.',
        en: 'We were invited to the wedding.',
        hint: 'invitare (passive, passato prossimo, noi, a mixed group)',
      },
      {
        it: 'La partita [è stata vinta] dalla squadra di casa.',
        en: 'The match was won by the home team.',
        hint: 'vincere (passive, passato prossimo)',
      },
      {
        it: 'Penso che il problema [sia stato risolto].',
        en: 'I think the problem has been solved.',
        hint: 'risolvere (passive, past subjunctive)',
      },
      {
        it: 'Tutte le camere [erano state prenotate] mesi prima.',
        en: 'All the rooms had been booked months before.',
        hint: 'prenotare (passive, trapassato prossimo)',
      },
    ],
  },
  {
    id: 71,
    slug: 'subjunctive-present',
    title: 'Present subjunctive: forms',
    cefr: 'B1',
    prerequisites: ['irregular-present'],
    noteMd: `**In short:** the subjunctive (*congiuntivo*) is a set of verb forms used after *che* when you express an opinion, a wish, a doubt or a feeling: *Penso che sia vero.* This lesson is about how to build the present subjunctive.

Regular verbs swap the typical vowel: *-are* verbs take **-i**, *-ere* and *-ire* verbs take **-a**:

| | parlare | prendere | partire |
|---|---|---|---|
| io, tu, lui | *parli* | *prenda* | *parta* |
| noi | *parliamo* | *prendiamo* | *partiamo* |
| voi | *parliate* | *prendiate* | *partiate* |
| loro | *parlino* | *prendano* | *partano* |

- The three singular forms are the same, so add *tu*, *lui*, *lei* when it's unclear: *Penso che tu abbia ragione.*
- The *noi* form is the same as the present: *parliamo*.
- *-isc-* verbs keep it: *finisca, capiscano*. Verbs in *-care, -gare* add *h*: *cerchi, paghi*.

Many verbs build it from the *io* present: *faccio → faccia*, *vado → vada*, *vengo → venga*, *dico → dica*, *posso → possa*, *voglio → voglia*, *devo → debba*, *esco → esca*. Their *noi* and *voi* forms are regular: *facciamo, andiate, veniate*.

Fully irregular:

| essere | avere | sapere | dare / stare |
|---|---|---|---|
| *sia, siano* | *abbia, abbiano* | *sappia, sappiano* | *dia / stia* |

The *noi* forms are *siamo, abbiamo, sappiamo, diamo, stiamo*, and the *voi* forms *siate, abbiate, sappiate, diate, stiate*.

**Watch out:** these endings look like the "wrong" conjugation: *parli* is not the *tu* present here, and *prenda* is not a mistake for *prende*. Think of the polite imperative (*Scusi, Prenda*): it uses exactly the same forms.

Examples:
- *Penso che Marco parli bene l'inglese.* (I think Marco speaks English well.)
- *Spero che tu stia bene.* (I hope you're well.)
- *Voglio che i bambini vadano a letto presto.* (I want the children to go to bed early.)`,
    drills: [
      {
        it: "Penso che Marco [parli] bene l'inglese.",
        en: 'I think Marco speaks English well.',
        hint: 'parlare (present subjunctive)',
      },
      {
        it: 'Credo che loro [abitino] a Torino.',
        en: 'I think they live in Turin.',
        hint: 'abitare (present subjunctive, they)',
      },
      {
        it: 'Penso che il negozio [apra] alle nove.',
        en: 'I think the shop opens at nine.',
        hint: 'aprire (present subjunctive)',
      },
      {
        it: 'Voglio che voi [prendiate] il treno delle otto.',
        en: "I want you to take the eight o'clock train.",
        hint: 'prendere (present subjunctive, you plural)',
      },
      {
        it: 'Voglio che tu [finisca] il lavoro oggi.',
        en: 'I want you to finish the work today.',
        hint: 'finire (present subjunctive, you)',
      },
      {
        it: 'Spero che domani [sia] una bella giornata.',
        en: 'I hope tomorrow is a nice day.',
        hint: 'essere (present subjunctive)',
      },
      {
        it: 'Credo che Giulia [abbia] ragione.',
        en: 'I think Giulia is right.',
        hint: 'avere (present subjunctive)',
      },
      {
        it: 'Spero che tu [stia] bene.',
        en: "I hope you're well.",
        hint: 'stare (present subjunctive)',
      },
      {
        it: 'Voglio che i bambini [vadano] a letto presto.',
        en: 'I want the children to go to bed early.',
        hint: 'andare (present subjunctive, they)',
      },
      {
        it: 'Penso che domani [faccia] freddo.',
        en: "I think it'll be cold tomorrow.",
        hint: 'fare (present subjunctive)',
      },
      {
        it: 'Speriamo che [vengano] anche loro.',
        en: "Let's hope they come too.",
        hint: 'venire (present subjunctive, they)',
      },
      {
        it: 'Non credo che Luca [sappia] la verità.',
        en: "I don't think Luca knows the truth.",
        hint: 'sapere (present subjunctive)',
      },
      {
        it: 'Mi sembra che tu [debba] riposarti.',
        en: 'I think you need to rest.',
        hint: 'dovere (present subjunctive, you)',
      },
      {
        it: 'Spero che tu mi [dia] una mano.',
        en: "I hope you'll give me a hand.",
        hint: 'dare (present subjunctive)',
      },
    ],
  },
  {
    id: 72,
    slug: 'subjunctive-opinion-wish',
    title: 'Subjunctive after penso che, voglio che, spero che',
    cefr: 'B1',
    prerequisites: ['subjunctive-present'],
    noteMd: `**In short:** after verbs of opinion, wish, hope, doubt or feeling followed by *che*, the second verb goes in the subjunctive: *Penso che sia tardi.* (I think it's late.)

The main triggers:
- **opinion:** *penso che, credo che, mi sembra che, immagino che*
- **wish or will:** *voglio che, preferisco che, desidero che*
- **hope and feelings:** *spero che, sono contento che, mi dispiace che, ho paura che*
- **doubt:** *dubito che, non credo che, non sono sicuro che*

The subjunctive is needed only when the two parts have **different subjects** (different people doing the actions). When the subject is the same, use *di* + infinitive (or just the infinitive after *voglio, preferisco*):

| different people | same person |
|---|---|
| *Spero che tu venga.* | *Spero di venire.* |
| *Voglio che tu parta.* | *Voglio partire.* |
| *Penso che lui abbia ragione.* | *Penso di avere ragione.* |

Certainty takes the ordinary indicative (the normal present, past, future): *So che hai ragione*, *Sono sicuro che viene*, *Secondo me è vero*.

**Watch out:** English says "I want you to come", so learners say *Voglio te venire*. Italian needs a *che* clause with the subjunctive: *Voglio che tu venga.* And with the same subject, don't use *che* at all: *Spero di vederti*, not *Spero che io ti veda*.

Examples:
- *Penso che Anna sia a casa.* (I think Anna is at home.)
- *Voglio che tu venga con me.* (I want you to come with me.)
- *Spero di vederti presto.* (I hope to see you soon.)
- *So che Marco ha ragione.* (I know Marco is right.)`,
    drills: [
      { it: 'Penso che Anna [sia] a casa.', en: 'I think Anna is at home.', hint: 'essere' },
      { it: 'Voglio che tu [venga] con me.', en: 'I want you to come with me.', hint: 'venire' },
      {
        it: 'Spero che domani non [piova].',
        en: "I hope it doesn't rain tomorrow.",
        hint: 'piovere',
      },
      {
        it: 'Credo che il film [cominci] alle nove.',
        en: 'I think the film starts at nine.',
        hint: 'cominciare',
      },
      {
        it: 'Mia madre preferisce che noi [restiamo] a cena.',
        en: 'My mother would rather we stayed for dinner.',
        hint: 'restare (we)',
      },
      {
        it: 'Mi dispiace che tu [stia] male.',
        en: "I'm sorry you're not feeling well.",
        hint: 'stare',
      },
      {
        it: 'Ho paura che non [ci sia] più posto.',
        en: "I'm afraid there's no room left.",
        hint: 'esserci',
      },
      {
        it: 'Sono contento che voi [siate] qui.',
        en: "I'm glad you're here.",
        hint: 'essere (you plural)',
      },
      {
        it: 'Non credo che loro [capiscano] il problema.',
        en: "I don't think they understand the problem.",
        hint: 'capire (they)',
      },
      { it: 'Dubito che Luca [possa] venire.', en: 'I doubt Luca can come.', hint: 'potere' },
      {
        it: 'I miei genitori vogliono che io [faccia] medicina.',
        en: 'My parents want me to study medicine.',
        hint: 'fare',
      },
      {
        it: 'Spero di [vederti] presto.',
        en: 'I hope to see you soon.',
        hint: 'vedere + you (same subject)',
      },
      {
        it: 'So che Marco [ha] ragione.',
        en: 'I know Marco is right.',
        hint: 'avere (after so che: a certainty)',
      },
    ],
  },
  {
    id: 73,
    slug: 'subjunctive-impersonal',
    title: 'Subjunctive after è importante che, bisogna che',
    cefr: 'B1',
    prerequisites: ['subjunctive-opinion-wish', 'impersonal-verbs'],
    noteMd: `**In short:** impersonal expressions (ones with no real "I" or "you", like "it is important that") take the subjunctive when they are followed by *che*: *È importante che tu dorma.*

Common expressions that take the subjunctive:
- necessity: *bisogna che, è necessario che, è ora che* (it's time that)
- judgement: *è importante che, è meglio che, è giusto che, è strano che, peccato che* (it's a shame that)
- possibility: *è possibile che, è probabile che, può darsi che* (maybe)
- condition: *basta che* (as long as)

When the sentence is about people in general, with no specific person, use the infinitive without *che*:

| general | about a specific person |
|---|---|
| *È importante dormire.* | *È importante che tu dorma.* |
| *Bisogna partire.* | *Bisogna che partiamo.* |
| *È meglio aspettare.* | *È meglio che aspettiate.* |

Expressions of certainty take the ordinary indicative: *è vero che, è chiaro che, è certo che, è evidente che*: *È vero che Luca vive a Londra.*

**Watch out:** *è vero che* and *è chiaro che* look like the other *è ... che* phrases, but they state a fact, so no subjunctive: *È chiaro che hai ragione*, not *abbia*. With *bisogna*, the infinitive is the everyday choice for general rules; use *bisogna che* + subjunctive only when you name who has to do it.

Examples:
- *È importante che tu dorma almeno otto ore.* (It's important that you sleep at least eight hours.)
- *Bisogna che voi arriviate in orario.* (You need to arrive on time.)
- *Peccato che tu non possa venire.* (It's a shame you can't come.)
- *È vero che Luca vive a Londra.* (It's true that Luca lives in London.)`,
    drills: [
      {
        it: 'È importante che tu [dorma] almeno otto ore.',
        en: "It's important that you sleep at least eight hours.",
        hint: 'dormire',
      },
      {
        it: 'Bisogna che voi [arriviate] in orario.',
        en: 'You need to arrive on time.',
        hint: 'arrivare (you plural)',
      },
      {
        it: 'È meglio che [prendiamo] un taxi.',
        en: "We'd better take a taxi.",
        hint: 'prendere (we)',
      },
      {
        it: 'È possibile che Marco [abbia] la febbre.',
        en: 'Marco may have a temperature.',
        hint: 'avere',
      },
      {
        it: 'È strano che Anna non [risponda] al telefono.',
        en: "It's strange that Anna isn't answering the phone.",
        hint: 'rispondere',
      },
      {
        it: 'È necessario che tutti [firmino] il documento.',
        en: 'Everyone needs to sign the document.',
        hint: 'firmare (they)',
      },
      {
        it: 'Peccato che tu non [possa] venire.',
        en: "It's a shame you can't come.",
        hint: 'potere',
      },
      {
        it: 'È probabile che domani [nevichi].',
        en: 'It will probably snow tomorrow.',
        hint: 'nevicare',
      },
      {
        it: 'Basta che tu mi [dica] la verità.',
        en: 'All you have to do is tell me the truth.',
        hint: 'dire',
      },
      {
        it: "È giusto che i bambini [giochino] all'aperto.",
        en: "It's right that children play outdoors.",
        hint: 'giocare (they)',
      },
      {
        it: 'È ora che voi [andiate] a letto.',
        en: "It's time you went to bed.",
        hint: 'andare (you plural)',
      },
      {
        it: 'È importante [fare] sport.',
        en: "It's important to do sport.",
        hint: 'fare (general statement, no che)',
      },
      {
        it: 'È vero che Luca [vive] a Londra.',
        en: "It's true that Luca lives in London.",
        hint: 'vivere (after è vero che: a fact)',
      },
    ],
  },
  {
    id: 74,
    slug: 'subjunctive-past',
    title: 'Past subjunctive: credo che sia partito',
    cefr: 'B1',
    prerequisites: ['subjunctive-opinion-wish', 'passato-prossimo-essere'],
    noteMd: `**In short:** the past subjunctive (*congiuntivo passato*) is used after *penso che, spero che, è possibile che* and the other triggers when the action has already happened: *Credo che sia partito ieri.* (I think he left yesterday.)

Build it like the passato prossimo, with the auxiliary in the present subjunctive: *abbia* or *sia* + the participle.

| | finire (with avere) | partire (with essere) |
|---|---|---|
| io, tu, lui, lei | *abbia finito* | *sia partito / partita* |
| noi | *abbiamo finito* | *siamo partiti / partite* |
| voi | *abbiate finito* | *siate partiti / partite* |
| loro | *abbiano finito* | *siano partiti / partite* |

The same verbs take *essere* as in the passato prossimo, and the participle agrees in the same way: *Spero che le ragazze siano tornate.* Reflexive verbs use *essere*: *Sono contenta che vi siate divertiti.*

Choose the tense by when the second action happens, compared with the first verb (here in the present):
- same time or later: present subjunctive. *Penso che parta.* (I think he's leaving.)
- earlier: past subjunctive. *Penso che sia partito.* (I think he has left / he left.)

As before, when the subject is the same, use *di* + the past infinitive: *Ho paura di aver sbagliato.* (I'm afraid I made a mistake.)

**Watch out:** English uses the same "I think he left" for many past events; Italian doesn't use the passato prossimo after these triggers. Say *Credo che sia partito*, not *Credo che è partito*. And remember the agreement with *essere*: *Credo che Giulia sia andata a casa.*

Examples:
- *Credo che Marco sia partito ieri.* (I think Marco left yesterday.)
- *Spero che tu abbia dormito bene.* (I hope you slept well.)
- *Mi dispiace che abbiate perso il treno.* (I'm sorry you missed the train.)`,
    drills: [
      {
        it: 'Credo che Marco [sia partito] ieri.',
        en: 'I think Marco left yesterday.',
        hint: 'partire (past subjunctive)',
      },
      {
        it: 'Penso che Anna [abbia finito] il lavoro.',
        en: 'I think Anna has finished the work.',
        hint: 'finire (past subjunctive)',
      },
      {
        it: 'Spero che tu [abbia dormito] bene.',
        en: 'I hope you slept well.',
        hint: 'dormire (past subjunctive)',
      },
      {
        it: 'Dubito che Luca [abbia detto] la verità.',
        en: 'I doubt Luca told the truth.',
        hint: 'dire (past subjunctive)',
      },
      {
        it: 'È strano che nessuno [abbia chiamato].',
        en: "It's strange that nobody has called.",
        hint: 'chiamare (past subjunctive)',
      },
      {
        it: 'Mi dispiace che voi [abbiate perso] il treno.',
        en: "I'm sorry you missed the train.",
        hint: 'perdere (past subjunctive, you plural)',
      },
      {
        it: 'Penso che [abbiano chiuso] il negozio per ferie.',
        en: "I think they've closed the shop for the holidays.",
        hint: 'chiudere (past subjunctive, they)',
      },
      {
        it: 'È possibile che Giulia [sia andata] a casa.',
        en: 'Giulia may have gone home.',
        hint: 'andare (past subjunctive, she)',
      },
      {
        it: 'Non credo che loro [siano arrivati] in tempo.',
        en: "I don't think they arrived in time.",
        hint: 'arrivare (past subjunctive, they)',
      },
      {
        it: 'Spero che le ragazze [siano tornate] a casa.',
        en: 'I hope the girls have got home.',
        hint: 'tornare (past subjunctive, they)',
      },
      {
        it: 'Mi sembra che tu [sia dimagrito].',
        en: "I think you've lost weight.",
        hint: 'dimagrire (past subjunctive, you, a man)',
      },
      {
        it: 'Sono contenta che vi [siate divertiti].',
        en: "I'm glad you had fun.",
        hint: 'divertirsi (past subjunctive, you plural, mixed group)',
      },
      {
        it: 'Ho paura di [aver sbagliato].',
        en: "I'm afraid I made a mistake.",
        hint: 'sbagliare (same subject: past infinitive)',
        also: ['avere sbagliato'],
      },
    ],
  },
];
