import type { GrammarPointSource } from '../types';

/** A1 grammar points in teaching order. */
export const A1_POINTS: readonly GrammarPointSource[] = [
  {
    id: 1,
    slug: 'noun-gender-number',
    title: 'Nouns: gender and number',
    cefr: 'A1',
    prerequisites: [],
    noteMd: `**In short:** Every Italian noun is either masculine or feminine, even words for things, like *tavolo* (table). The ending usually tells you which, and the ending changes to make the plural.

The gender of a noun (whether it is masculine or feminine) matters because the words around it, like "the" and adjectives, change to match it.

| singular | plural | example |
|---|---|---|
| -o (masculine) | -i | *libro → libri* |
| -a (feminine) | -e | *casa → case* |
| -e (either) | -i | *padre → padri*, *notte → notti* |

- Nouns in **-e** can be masculine or feminine, so learn each one with its article: *il padre* (masculine), *la notte* (feminine).
- Nouns ending in an accented vowel or a consonant, and shortened words, do not change in the plural: *la città → le città*, *il bar → i bar*, *la foto → le foto*.
- Feminine nouns in **-ca** and **-ga** add **h** to keep the hard sound: *amica → amiche*. Masculine **-co** and **-go** vary: *albergo → alberghi*, but *amico → amici*.

**Watch out:** never add **-s** to make a plural. Change the last vowel instead: *due pizze*, not *due pizzas*. And a few common words break the pattern, like *la mano* (the hand, feminine) and *il problema* (the problem, masculine).

Examples:
- *Il ragazzo legge un libro.* (The boy is reading a book.)
- *Le case sono grandi.* (The houses are big.)
- *Roma e Milano sono due città.* (Rome and Milan are two cities.)`,
    drills: [
      { it: 'Ho due [libri].', en: 'I have two books.', hint: 'libro (plural)' },
      { it: 'Prendiamo tre [pizze].', en: "We'll have three pizzas.", hint: 'pizza (plural)' },
      { it: 'Le [case] sono nuove.', en: 'The houses are new.', hint: 'casa (plural)' },
      { it: 'Ho due [fratelli].', en: 'I have two brothers.', hint: 'fratello (plural)' },
      { it: 'Le [notti] sono fredde.', en: 'The nights are cold.', hint: 'notte (plural)' },
      {
        it: 'I [padri] aspettano fuori.',
        en: 'The fathers are waiting outside.',
        hint: 'padre (plural)',
      },
      {
        it: 'Roma e Milano sono due [città] grandi.',
        en: 'Rome and Milan are two big cities.',
        hint: 'città (plural)',
      },
      {
        it: 'Conosco tre [bar] in questa strada.',
        en: 'I know three cafés on this street.',
        hint: 'bar (plural)',
      },
      { it: 'Le [foto] sono belle.', en: 'The photos are beautiful.', hint: 'foto (plural)' },
      {
        it: 'Ho due [amiche] a Roma.',
        en: 'I have two female friends in Rome.',
        hint: 'amica (plural)',
      },
      { it: 'Mario ha molti [amici].', en: 'Mario has lots of friends.', hint: 'amico (plural)' },
      { it: 'Gli [alberghi] sono pieni.', en: 'The hotels are full.', hint: 'albergo (plural)' },
    ],
  },
  {
    id: 2,
    slug: 'definite-articles',
    title: 'Definite articles: il, lo, la, i, gli, le',
    cefr: 'A1',
    prerequisites: ['noun-gender-number'],
    noteMd: `**In short:** Italian has several words for "the". You choose one by the noun's gender (masculine or feminine), its number (singular or plural) and the sound the next word starts with.

| | singular | plural |
|---|---|---|
| masculine, most words | **il** | **i** |
| masculine, before s + consonant, z, gn, ps, y | **lo** | **gli** |
| masculine, before a vowel | **l'** | **gli** |
| feminine | **la** (**l'** before a vowel) | **le** |

- *il libro → i libri*, *lo studente → gli studenti*, *lo zaino → gli zaini*, *l'amico → gli amici*.
- *la casa → le case*, *l'amica → le amiche*.

The article looks at the very next word, so an adjective in between can change it: *gli amici* but *i vecchi amici*.

Italian uses "the" more than English, for example with things in general: *Il caffè è buono* (Coffee is good).

**Watch out:** masculine plurals starting with a vowel, s + consonant or z take **gli**, not *i*: *gli amici*, *gli studenti*, *gli zii*. And keep the article where English has none: *La vita è bella* (Life is beautiful).

Examples:
- *Il libro è sul tavolo.* (The book is on the table.)
- *Lo studente e la studentessa.* (The male student and the female student.)
- *Gli amici di Marco sono simpatici.* (Marco's friends are nice.)`,
    drills: [
      { it: '[Il] libro è qui.', en: 'The book is here.', hint: 'the (masculine singular)' },
      { it: '[La] casa è grande.', en: 'The house is big.', hint: 'the (feminine singular)' },
      {
        it: '[I] ragazzi sono a scuola.',
        en: 'The boys are at school.',
        hint: 'the (masculine plural)',
      },
      {
        it: '[Le] ragazze sono a casa.',
        en: 'The girls are at home.',
        hint: 'the (feminine plural)',
      },
      {
        it: '[Lo] studente è bravo.',
        en: 'The student is good.',
        hint: 'the (masculine singular)',
      },
      { it: '[Lo] zaino è nero.', en: 'The backpack is black.', hint: 'the (masculine singular)' },
      {
        it: "[L']amico di Marco è simpatico.",
        en: "Marco's friend is nice.",
        hint: 'the (masculine singular)',
      },
      { it: "[L']acqua è fredda.", en: 'The water is cold.', hint: 'the (feminine singular)' },
      {
        it: '[Gli] studenti sono in classe.',
        en: 'The students are in class.',
        hint: 'the (masculine plural)',
      },
      {
        it: '[Gli] amici di Anna sono qui.',
        en: "Anna's friends are here.",
        hint: 'the (masculine plural)',
      },
      {
        it: '[Gli] zii di Luca sono di Roma.',
        en: "Luca's aunt and uncle are from Rome.",
        hint: 'the (masculine plural)',
      },
      {
        it: '[Il] caffè italiano è forte.',
        en: 'Italian coffee is strong.',
        hint: 'the (masculine singular)',
      },
      { it: '[La] vita è bella.', en: 'Life is beautiful.', hint: 'the (feminine singular)' },
    ],
  },
  {
    id: 3,
    slug: 'indefinite-articles',
    title: 'Indefinite articles: un, uno, una',
    cefr: 'A1',
    prerequisites: ['noun-gender-number'],
    noteMd: `**In short:** "A" or "an" is *un*, *uno*, *una* or *un'*. Like "the", it changes with the noun's gender and with the sound the next word starts with.

- **un**: most masculine nouns, including before a vowel: *un libro*, *un amico*.
- **uno**: masculine nouns starting with s + consonant, z, gn or ps: *uno studente*, *uno zaino*.
- **una**: feminine nouns: *una casa*, *una studentessa*.
- **un'**: feminine nouns starting with a vowel: *un'amica*, *un'ora*.

There is no plural "a". To say "some", use *dei*, *degli*, *delle*, or nothing at all: *Ho comprato (delle) mele* (I bought some apples).

**Watch out:** the apostrophe is only for feminine words. Masculine before a vowel is plain *un*: *un amico* (a male friend), but *un'amica* (a female friend). Don't write *un'amico*.

Examples:
- *Ho un fratello e una sorella.* (I have a brother and a sister.)
- *C'è uno zaino sotto la sedia.* (There is a backpack under the chair.)
- *Giulia è un'amica di Paolo.* (Giulia is a friend of Paolo's.)`,
    drills: [
      { it: 'Ho [un] fratello.', en: 'I have a brother.', hint: 'a (masculine)' },
      { it: 'Ho [una] sorella.', en: 'I have a sister.', hint: 'a (feminine)' },
      { it: 'Vorrei [un] caffè.', en: "I'd like a coffee.", hint: 'a (masculine)' },
      { it: 'Mangio [una] mela.', en: "I'm eating an apple.", hint: 'a (feminine)' },
      { it: 'Paolo è [uno] studente.', en: 'Paolo is a student.', hint: 'a (masculine)' },
      { it: 'Ho [uno] zaino nuovo.', en: 'I have a new backpack.', hint: 'a (masculine)' },
      { it: 'Marco è [un] amico.', en: 'Marco is a friend.', hint: 'a (masculine)' },
      { it: "Giulia è [un']amica.", en: 'Giulia is a friend.', hint: 'a (feminine)' },
      { it: "Prendo [un']aranciata.", en: "I'll have an orange soda.", hint: 'a (feminine)' },
      { it: 'Roma è [una] città antica.', en: 'Rome is an ancient city.', hint: 'a (feminine)' },
      { it: 'Ho [uno] zio a Milano.', en: 'I have an uncle in Milan.', hint: 'a (masculine)' },
      { it: 'Non è [un] problema.', en: "It's not a problem.", hint: 'a (masculine)' },
    ],
  },
  {
    id: 4,
    slug: 'subject-pronouns',
    title: 'Subject pronouns',
    cefr: 'A1',
    prerequisites: [],
    noteMd: `**In short:** Subject pronouns are words like "I", "you" and "she": the subject is who does the action. In Italian you usually leave them out, because the verb ending already shows who it is.

| | singular | plural |
|---|---|---|
| 1st | **io** (I) | **noi** (we) |
| 2nd | **tu** (you, informal) | **voi** (you, plural) |
| 3rd | **lui** (he), **lei** (she) | **loro** (they) |

- Use **tu** with friends, family and children; use **voi** for "you" when talking to more than one person.
- **Lei** with a capital letter is the polite "you" for strangers, shop staff and older people. It takes the same verb form as *lei* (she): *Lei è italiana?* can mean "Is she Italian?" or "Are you Italian?".
- *Io* has no capital letter, unlike English "I".

Say the pronoun only for emphasis or contrast: *Io lavoro, tu dormi!*

**Watch out:** there is no word for "it" as a subject. "It's beautiful" is just *È bello*. And don't put *io*, *tu* and so on in front of every verb: *Sono stanco* sounds natural, *Io sono stanco* stresses the "I".

Examples:
- *Sono stanco.* (I am tired.)
- *Io lavoro, tu dormi!* (I work, you sleep!)
- *Lei è italiano, signore?* (Are you Italian, sir?)`,
    drills: [
      { it: '[Io] sono Marco.', en: "I'm Marco.", hint: 'I' },
      { it: '[Lui] è Paolo.', en: 'He is Paolo.', hint: 'he' },
      { it: '[Lei] è Anna.', en: 'She is Anna.', hint: 'she' },
      { it: '[Tu] sei di Roma?', en: 'Are you from Rome?', hint: 'you (informal)' },
      { it: '[Noi] siamo a casa.', en: 'We are at home.', hint: 'we' },
      { it: '[Voi] siete stanchi?', en: 'Are you (all) tired?', hint: 'you (plural)' },
      { it: '[Loro] sono qui.', en: 'They are here.', hint: 'they' },
      {
        it: 'Scusi, [Lei] è il signor Rossi?',
        en: 'Excuse me, are you Mr Rossi?',
        hint: 'you (formal)',
      },
      { it: '[Io] lavoro, tu dormi!', en: 'I work, you sleep!', hint: 'I (for contrast)' },
      { it: 'E [tu], come ti chiami?', en: "And you, what's your name?", hint: 'you (informal)' },
      { it: 'Anche [noi] siamo italiani.', en: 'We are Italian too.', hint: 'we' },
      {
        it: 'Marco e Lucia? [Loro] abitano a Roma.',
        en: 'Marco and Lucia? They live in Rome.',
        hint: 'they',
      },
    ],
  },
  {
    id: 5,
    slug: 'essere-present',
    title: 'Essere (to be) in the present',
    cefr: 'A1',
    prerequisites: ['subject-pronouns'],
    noteMd: `**In short:** *Essere* means "to be". It is irregular (it doesn't follow the usual pattern), so learn its six forms by heart.

| | singular | plural |
|---|---|---|
| 1st | *io* **sono** (I am) | *noi* **siamo** (we are) |
| 2nd | *tu* **sei** (you are) | *voi* **siete** (you are) |
| 3rd | *lui, lei, Lei* **è** (he, she is; you are, formal) | *loro* **sono** (they are) |

*Sono* means both "I am" and "they are"; the context tells you which.

Use *essere* for:
- who or what someone is: *Sono Anna. Marco è medico.*
- where someone is from, with *di* + city: *Sono di Londra.*
- what something is like: *La casa è grande.*
- where someone or something is: *Siamo a casa.*

**Watch out:** *è* with an accent means "is"; *e* without one means "and". And age, hunger, thirst and cold use *avere* (to have), not *essere*: "I am twenty" is *Ho vent'anni*.

Examples:
- *Sono di Londra.* (I'm from London.)
- *Mario è molto simpatico.* (Mario is very nice.)
- *Siamo a casa.* (We are at home.)
- *Signora, Lei è di Roma?* (Madam, are you from Rome?)`,
    drills: [
      { it: 'Io [sono] di Londra.', en: "I'm from London.", hint: 'essere (io)' },
      { it: 'Tu [sei] italiano?', en: 'Are you Italian?', hint: 'essere (tu)' },
      { it: 'Mario [è] molto simpatico.', en: 'Mario is very nice.', hint: 'essere (lui)' },
      { it: 'Noi [siamo] a casa.', en: 'We are at home.', hint: 'essere (noi)' },
      { it: 'Voi [siete] di Roma?', en: 'Are you (all) from Rome?', hint: 'essere (voi)' },
      { it: 'Loro [sono] stanchi.', en: 'They are tired.', hint: 'essere (loro)' },
      { it: 'Anna [è] insegnante.', en: 'Anna is a teacher.', hint: 'essere (lei)' },
      {
        it: 'Signora, Lei [è] di Milano?',
        en: 'Madam, are you from Milan?',
        hint: 'essere (formal you)',
      },
      { it: 'Il caffè [è] caldo.', en: 'The coffee is hot.', hint: 'essere' },
      { it: 'Marco e io [siamo] amici.', en: 'Marco and I are friends.', hint: 'essere' },
      { it: 'Dove [sei]?', en: 'Where are you?', hint: 'essere (tu)' },
      { it: 'Le ragazze [sono] in classe.', en: 'The girls are in class.', hint: 'essere' },
    ],
  },
  {
    id: 6,
    slug: 'avere-present',
    title: 'Avere (to have) in the present',
    cefr: 'A1',
    prerequisites: ['subject-pronouns'],
    noteMd: `**In short:** *Avere* means "to have". It is irregular, and it is also used in many everyday phrases where English uses "to be".

| | singular | plural |
|---|---|---|
| 1st | *io* **ho** | *noi* **abbiamo** |
| 2nd | *tu* **hai** | *voi* **avete** |
| 3rd | *lui, lei, Lei* **ha** | *loro* **hanno** |

The **h** is silent. It is only there to tell *ho* (I have) from *o* (or), *ha* (has) from *a* (to), and *hanno* (they have) from *anno* (year).

Phrases with *avere*:
- *avere fame* (to be hungry), *avere sete* (to be thirsty)
- *avere caldo* (to be hot), *avere freddo* (to be cold), *avere sonno* (to be sleepy)
- *avere ragione* (to be right), *avere torto* (to be wrong)
- *avere vent'anni* (to be twenty years old)

**Watch out:** don't translate "I am hungry" or "I am twenty" word for word with *essere*. Say *Ho fame* and *Ho vent'anni*. To ask someone's age: *Quanti anni hai?* (literally "How many years do you have?").

Examples:
- *Ho una macchina rossa.* (I have a red car.)
- *Hai fame?* (Are you hungry?)
- *Quanti anni hai?* (How old are you?)`,
    drills: [
      { it: 'Io [ho] una macchina rossa.', en: 'I have a red car.', hint: 'avere (io)' },
      { it: '[Hai] fame?', en: 'Are you hungry?', hint: 'avere (tu)' },
      { it: 'Marco [ha] un cane.', en: 'Marco has a dog.', hint: 'avere (lui)' },
      { it: 'Noi [abbiamo] due figli.', en: 'We have two children.', hint: 'avere (noi)' },
      {
        it: '[Avete] tempo stasera?',
        en: 'Do you (all) have time this evening?',
        hint: 'avere (voi)',
      },
      { it: 'Loro [hanno] una casa grande.', en: 'They have a big house.', hint: 'avere (loro)' },
      { it: 'Quanti anni [hai]?', en: 'How old are you?', hint: 'avere (tu)' },
      { it: '[Ho] sete.', en: "I'm thirsty.", hint: 'avere (io)' },
      { it: "Lucia [ha] vent'anni.", en: 'Lucia is twenty.', hint: 'avere (lei)' },
      { it: 'Signore, Lei [ha] ragione.', en: "Sir, you're right.", hint: 'avere (formal you)' },
      { it: 'I bambini [hanno] sonno.', en: 'The children are sleepy.', hint: 'avere' },
      { it: '[Abbiamo] freddo.', en: "We're cold.", hint: 'avere (noi)' },
    ],
  },
  {
    id: 7,
    slug: 'adjective-agreement',
    title: 'Adjectives agree with the noun',
    cefr: 'A1',
    prerequisites: ['definite-articles', 'indefinite-articles'],
    noteMd: `**In short:** An adjective (a describing word, like "black" or "nice") changes its ending to match the noun's gender and number. It usually comes **after** the noun.

Adjectives in **-o** have four forms:

| | masculine | feminine |
|---|---|---|
| singular | *un gatto nero* | *una gatta nera* |
| plural | *due gatti neri* | *due gatte nere* |

Adjectives in **-e** have only two forms, one for the singular and one for the plural:
- *un libro interessante, una storia interessante*
- *libri interessanti, storie interessanti*

Adjectives in **-co** and **-ca** follow the noun rules: *bianca → bianche*, *simpatico → simpatici*, *simpatica → simpatiche*.

A few very common adjectives often go **before** the noun: *bello, buono, brutto, grande, piccolo, nuovo, vecchio*: *una piccola casa*, *un nuovo lavoro*.

**Watch out:** an **-e** adjective doesn't change for a feminine noun: *una ragazza intelligente*, never *intelligenta*. And the adjective follows the noun, not the English order: *una macchina rossa* (a red car).

Examples:
- *Ho una casa piccola.* (I have a small house.)
- *Sono ragazze simpatiche.* (They are nice girls.)
- *Marco ha gli occhi verdi.* (Marco has green eyes.)`,
    drills: [
      { it: 'Ho una gatta [nera].', en: 'I have a black cat.', hint: 'nero (feminine singular)' },
      { it: 'Ho due gatti [neri].', en: 'I have two black cats.', hint: 'nero (masculine plural)' },
      {
        it: 'Abito in una casa [piccola].',
        en: 'I live in a small house.',
        hint: 'piccolo (feminine singular)',
      },
      {
        it: 'Ho due camicie [bianche].',
        en: 'I have two white shirts.',
        hint: 'bianco (feminine plural)',
      },
      {
        it: 'È una storia [interessante].',
        en: "It's an interesting story.",
        hint: 'interessante (feminine singular)',
      },
      {
        it: 'Sono libri [interessanti].',
        en: 'They are interesting books.',
        hint: 'interessante (masculine plural)',
      },
      {
        it: 'Lucia è una ragazza [intelligente].',
        en: 'Lucia is an intelligent girl.',
        hint: 'intelligente (feminine singular)',
      },
      {
        it: 'Ho due amiche [simpatiche].',
        en: 'I have two nice female friends.',
        hint: 'simpatico (feminine plural)',
      },
      {
        it: 'Sono ragazzi [simpatici].',
        en: 'They are nice boys.',
        hint: 'simpatico (masculine plural)',
      },
      {
        it: 'Marco ha gli occhi [verdi].',
        en: 'Marco has green eyes.',
        hint: 'verde (masculine plural)',
      },
      {
        it: 'Roma è una città [antica].',
        en: 'Rome is an ancient city.',
        hint: 'antico (feminine singular)',
      },
      {
        it: 'Ho una macchina [rossa].',
        en: 'I have a red car.',
        hint: 'rosso (feminine singular)',
      },
    ],
  },
  {
    id: 8,
    slug: 'ce-ci-sono',
    title: "C'è and ci sono (there is, there are)",
    cefr: 'A1',
    prerequisites: ['essere-present'],
    noteMd: `**In short:** Use **c'è** for "there is" (one thing) and **ci sono** for "there are" (more than one). They say that something exists or is present somewhere.

- **c'è** + singular: *C'è un bar.* (There's a café.)
- **ci sono** + plural: *Ci sono due bar.* (There are two cafés.)

Questions use the same words, with your voice rising at the end: *C'è un bagno?* (Is there a toilet?). For a negative, put *non* in front: *Non c'è tempo.* (There's no time.)

*C'è* also means "is in" or "is there" for a person: *C'è Marco?* (Is Marco in?)

**Watch out:** don't confuse *c'è* (there is) with *è* (it is): *C'è un problema* (There's a problem) but *È un problema* (It's a problem). Also, *ecco* means "here is" or "there is" when you point at something you can see: *Ecco il treno!* (Here's the train!)

Examples:
- *C'è un bar vicino alla stazione.* (There's a café near the station.)
- *Ci sono molte persone qui.* (There are lots of people here.)
- *Non c'è problema.* (No problem.)`,
    drills: [
      {
        it: "[C'è] un bar vicino alla stazione.",
        en: "There's a café near the station.",
        hint: 'there is / there are',
      },
      {
        it: '[Ci sono] molte persone qui.',
        en: 'There are lots of people here.',
        hint: 'there is / there are',
      },
      { it: "Non [c'è] problema.", en: 'No problem.', hint: 'there is / there are' },
      { it: "[C'è] un bagno?", en: 'Is there a toilet?', hint: 'there is / there are' },
      {
        it: 'In classe [ci sono] venti studenti.',
        en: 'There are twenty students in the class.',
        hint: 'there is / there are',
      },
      { it: "Oggi [c'è] il sole.", en: "It's sunny today.", hint: 'there is / there are' },
      {
        it: 'Nel frigo [ci sono] due birre.',
        en: 'There are two beers in the fridge.',
        hint: 'there is / there are',
      },
      {
        it: "Scusi, [c'è] una farmacia qui vicino?",
        en: "Excuse me, is there a chemist's near here?",
        hint: 'there is / there are',
      },
      {
        it: 'Non [ci sono] posti liberi.',
        en: 'There are no free seats.',
        hint: 'there is / there are',
      },
      {
        it: 'Quanti studenti [ci sono]?',
        en: 'How many students are there?',
        hint: 'there is / there are',
      },
      { it: "[C'è] Marco?", en: 'Is Marco in?', hint: 'there is / there are' },
      {
        it: 'A Roma [ci sono] molti musei.',
        en: 'There are many museums in Rome.',
        hint: 'there is / there are',
      },
    ],
  },
  {
    id: 9,
    slug: 'negation',
    title: 'Negation with non',
    cefr: 'A1',
    prerequisites: ['essere-present'],
    noteMd: `**In short:** To make a sentence negative, put **non** directly before the verb. There is no helper word like English "don't" or "doesn't".

- *Sono italiano.* → *Non sono italiano.* (I'm not Italian.)
- *Ho tempo.* → *Non ho tempo.* (I don't have time.)

*Non* also goes before small words that are attached to the verb, like *lo* (it) or *c'è*: *Non lo so* (I don't know), *Non c'è* (It isn't there).

Italian uses a **double negative**: keep *non* before the verb and add a second negative word after it.
- *non ... niente* (nothing, not anything)
- *non ... nessuno* (nobody, not anyone)
- *non ... mai* (never)
- *non ... più* (not any more)
- *non ... ancora* (not yet)

If *niente* or *nessuno* comes first, before the verb, drop *non*: *Nessuno è perfetto.*

**Watch out:** in English two negatives cancel out, but in Italian they don't: *Non ho niente* is correct and means "I have nothing". Leaving out *non* (*Ho niente*) is wrong. And *non* never goes after the verb: *Non sono*, not *Sono non*.

Examples:
- *Non parlo tedesco.* (I don't speak German.)
- *Non ho niente.* (I don't have anything.)
- *Non sono mai a casa.* (I'm never at home.)
- *Non lo so.* (I don't know.)`,
    drills: [
      { it: 'Io [non sono] italiano.', en: "I'm not Italian.", hint: 'essere (negative, io)' },
      { it: 'Marco [non ha] fame.', en: "Marco isn't hungry.", hint: 'avere (negative)' },
      { it: '[Non siamo] stanchi.', en: "We aren't tired.", hint: 'essere (negative, noi)' },
      { it: 'Lucia [non è] a casa.', en: "Lucia isn't at home.", hint: 'essere (negative)' },
      { it: '[Non hai] tempo?', en: "Don't you have time?", hint: 'avere (negative, tu)' },
      { it: 'Il bar [non è] aperto.', en: "The café isn't open.", hint: 'essere (negative)' },
      { it: '[Non ho] niente.', en: "I don't have anything.", hint: 'avere (negative, io)' },
      { it: "[Non c'è] nessuno.", en: "There's nobody there.", hint: "c'è (negative)" },
      {
        it: 'Loro [non sono] mai a casa.',
        en: "They're never at home.",
        hint: 'essere (negative)',
      },
      { it: '[Non ho] più fame.', en: "I'm not hungry any more.", hint: 'avere (negative, io)' },
      {
        it: '[Non avete] figli?',
        en: "Don't you (all) have children?",
        hint: 'avere (negative, voi)',
      },
      {
        it: 'Voi [non siete] ancora pronti?',
        en: "Aren't you (all) ready yet?",
        hint: 'essere (negative)',
      },
    ],
  },
  {
    id: 10,
    slug: 'questions',
    title: 'Questions and question words',
    cefr: 'A1',
    prerequisites: ['essere-present'],
    noteMd: `**In short:** A yes/no question uses the same words as a statement; only your voice rises at the end. Other questions start with a question word like *dove* (where) or *perché* (why).

*Sei italiano.* (You're Italian.) → *Sei italiano?* (Are you Italian?)

| word | meaning |
|---|---|
| **chi** | who |
| **che cosa**, **cosa**, **che** | what |
| **dove** | where |
| **di dove** | where ... from |
| **quando** | when |
| **come** | how |
| **perché** | why |
| **quanto**, **quanta**, **quanti**, **quante** | how much, how many |
| **quale** (plural **quali**) | which, what |

- *Quanto* agrees with the noun after it: *Quanti anni hai? Quante sorelle hai?* Alone it means "how much": *Quanto costa?*
- *Quale* becomes **qual** before *è*, with no apostrophe: *Qual è il tuo nome?*
- The subject often goes after the verb: *Dove abita Luca?*
- *Perché* also means "because" in the answer: *Perché? Perché sono stanco.*

**Watch out:** write *qual è* without an apostrophe. And for "what is ...?" asking for a piece of information, use *qual è*, not *che cosa è*: *Qual è il tuo numero?* (What's your number?)

Examples:
- *Come ti chiami?* (What's your name?)
- *Di dove sei?* (Where are you from?)
- *Perché ridi?* (Why are you laughing?)`,
    drills: [
      { it: '[Come] ti chiami?', en: "What's your name?", hint: 'how' },
      { it: '[Dove] sei?', en: 'Where are you?', hint: 'where' },
      { it: '[Chi] è Marco?', en: 'Who is Marco?', hint: 'who' },
      { it: '[Quando] arriva il treno?', en: 'When does the train arrive?', hint: 'when' },
      { it: '[Perché] sei triste?', en: 'Why are you sad?', hint: 'why' },
      {
        it: '[Cosa] fai stasera?',
        en: 'What are you doing this evening?',
        hint: 'what',
        also: ['Che cosa', 'Che'],
      },
      { it: '[Quanto] costa?', en: 'How much does it cost?', hint: 'how much' },
      { it: '[Quanti] anni hai?', en: 'How old are you?', hint: 'how many' },
      { it: '[Quante] sorelle hai?', en: 'How many sisters do you have?', hint: 'how many' },
      { it: '[Di dove] sei?', en: 'Where are you from?', hint: 'where ... from' },
      {
        it: '[Quale] borsa preferisci?',
        en: 'Which bag do you prefer?',
        hint: 'which',
        also: ['Che'],
      },
      {
        it: '[Qual] è il tuo numero di telefono?',
        en: "What's your phone number?",
        hint: 'what / which (before è)',
      },
    ],
  },
  {
    id: 39,
    slug: 'numbers-time',
    title: 'Numbers, telling the time and dates',
    cefr: 'A1',
    prerequisites: ['essere-present'],
    noteMd: `**In short:** Learn the numbers 1 to 20 by heart; after that they are built from parts. Telling the time uses *sono le* + the hour, and dates use *il* + the number + the month.

| 1-10 | 11-20 | tens |
|---|---|---|
| uno, due, tre, quattro, cinque | undici, dodici, tredici, quattordici, quindici | venti, trenta, quaranta, cinquanta |
| sei, sette, otto, nove, dieci | sedici, diciassette, diciotto, diciannove, venti | sessanta, settanta, ottanta, novanta |

- From 21, join the ten and the unit: *ventidue, trentacinque*. Before *uno* and *otto* the ten drops its last vowel: *ventuno, ventotto*. With *tre*, add an accent: *ventitré*.
- *cento* (100), *duecento* (200), *mille* (1,000), but *duemila* (2,000).

**The time.** Ask *Che ore sono?* or *Che ora è?* Answer with *sono le*, because "the hours" is plural: *Sono le tre.* But for one o'clock, noon and midnight use *è*: *È l'una, è mezzogiorno, è mezzanotte.*
- *e un quarto* (quarter past), *e mezza* or *e mezzo* (half past), *meno un quarto* (quarter to), *meno dieci* (ten to).
- "At" a time: *alle otto*, *all'una*, *a mezzogiorno*.

**Dates.** Say *il* + number + month, with no "of" and no capital letter: *il tre maggio*. Only the first of the month uses "first": *il primo maggio*.

**Watch out:** "It's three o'clock" is *Sono le tre*, not *È tre*. And for dates use plain numbers, not "second, third": *il due giugno*, not *il secondo giugno*.

Examples:
- *Ho ventotto anni.* (I'm twenty-eight.)
- *Sono le otto e mezza.* (It's half past eight.)
- *Il treno parte all'una.* (The train leaves at one.)
- *Il mio compleanno è il tre maggio.* (My birthday is on the third of May.)`,
    drills: [
      { it: 'Ho [venti] euro.', en: 'I have twenty euros.', hint: '20' },
      { it: 'Il caffè costa [due] euro.', en: 'The coffee costs two euros.', hint: '2' },
      {
        it: 'In classe ci sono [diciassette] studenti.',
        en: 'There are seventeen students in the class.',
        hint: '17',
      },
      { it: 'Ho [ventitré] anni.', en: "I'm twenty-three.", hint: '23' },
      { it: 'Mia nonna ha [ottantotto] anni.', en: 'My grandmother is eighty-eight.', hint: '88' },
      {
        it: 'Il biglietto costa [cento] euro.',
        en: 'The ticket costs a hundred euros.',
        hint: '100',
      },
      {
        it: 'Il viaggio costa [duemila] euro.',
        en: 'The trip costs two thousand euros.',
        hint: '2,000',
      },
      {
        it: 'Che ore sono? [Sono le tre].',
        en: "What time is it? It's three o'clock.",
        hint: "3 o'clock",
        also: ['Sono le quindici'],
      },
      { it: "[È l'una].", en: "It's one o'clock.", hint: "1 o'clock", also: ['Sono le tredici'] },
      {
        it: 'Sono le otto [e mezza].',
        en: "It's half past eight.",
        hint: 'half past',
        also: ['e mezzo', 'e trenta'],
      },
      {
        it: 'Sono le sei [meno un quarto].',
        en: "It's a quarter to six.",
        hint: 'quarter to',
        also: ['meno quindici'],
      },
      { it: 'Il treno parte [alle nove].', en: 'The train leaves at nine.', hint: 'at 9:00' },
      {
        it: "La lezione comincia [all'una].",
        en: 'The lesson starts at one.',
        hint: "at 1 o'clock",
        also: ['alle tredici'],
      },
      {
        it: 'Il mio compleanno è [il tre] maggio.',
        en: 'My birthday is on the third of May.',
        hint: '3rd (date)',
      },
      { it: 'Oggi è [il primo] marzo.', en: 'Today is the first of March.', hint: '1st (date)' },
    ],
  },
  {
    id: 11,
    slug: 'present-are',
    title: 'Present tense: regular -are verbs',
    cefr: 'A1',
    prerequisites: ['subject-pronouns'],
    noteMd: `**In short:** Most Italian verbs end in **-are** in the infinitive (the dictionary form, like *parlare*, "to speak"). To make the present tense, drop **-are** and add an ending that shows who does the action.

| person | ending | *parlare* (speak) |
|---|---|---|
| io | -o | *parlo* |
| tu | -i | *parli* |
| lui, lei, Lei | -a | *parla* |
| noi | -iamo | *parliamo* |
| voi | -ate | *parlate* |
| loro | -ano | *parlano* |

Spelling details:
- Verbs in **-care** and **-gare** add **h** before *i* to keep the hard sound: *cercare → cerchi, cerchiamo*; *pagare → paghi, paghiamo*.
- Verbs in **-iare** keep only one *i*: *mangiare → mangi, mangiamo*; *studiare → studi, studiamo*.
- In the *loro* form the stress stays where it is in the *io* form: *PARlano*, *ABitano*.

One present tense covers "I speak", "I am speaking" and often the near future: *Domani lavoro* (I'm working tomorrow).

**Watch out:** "I am speaking" is just *parlo*, never *sono parlo*. "Do you speak...?" is just *Parli...?*, with no word for "do".

Examples:
- *Abito a Roma.* (I live in Rome.)
- *Parliamo italiano.* (We speak Italian.)
- *Domani lavoro.* (I'm working tomorrow.)`,
    drills: [
      { it: 'Io [abito] a Roma.', en: 'I live in Rome.', hint: 'abitare (io)' },
      { it: 'Tu [parli] italiano?', en: 'Do you speak Italian?', hint: 'parlare (tu)' },
      { it: 'Marco [lavora] a Milano.', en: 'Marco works in Milan.', hint: 'lavorare (lui)' },
      { it: 'Noi [mangiamo] a casa.', en: 'We eat at home.', hint: 'mangiare (noi)' },
      {
        it: 'Voi [ascoltate] la radio?',
        en: 'Do you (all) listen to the radio?',
        hint: 'ascoltare (voi)',
      },
      { it: 'Loro [arrivano] domani.', en: "They're arriving tomorrow.", hint: 'arrivare (loro)' },
      { it: 'Domani [lavoro].', en: "I'm working tomorrow.", hint: 'lavorare (io)' },
      { it: 'Che cosa [cerchi]?', en: 'What are you looking for?', hint: 'cercare (tu)' },
      { it: 'Oggi [paghiamo] noi.', en: "We're paying today.", hint: 'pagare (noi)' },
      { it: '[Mangi] la carne?', en: 'Do you eat meat?', hint: 'mangiare (tu)' },
      { it: "Anna [studia] l'inglese.", en: 'Anna is studying English.', hint: 'studiare (lei)' },
      {
        it: 'I bambini [giocano] in giardino.',
        en: 'The children are playing in the garden.',
        hint: 'giocare (loro)',
      },
      {
        it: 'Signora, Lei [parla] inglese?',
        en: 'Madam, do you speak English?',
        hint: 'parlare (formal you)',
      },
    ],
  },
  {
    id: 12,
    slug: 'present-ere-ire',
    title: 'Present tense: regular -ere and -ire verbs',
    cefr: 'A1',
    prerequisites: ['present-are'],
    noteMd: `**In short:** Verbs ending in **-ere** and **-ire** make the present tense the same way as *-are* verbs: drop the ending and add new ones. Their endings are almost the same as each other.

| person | -ere: *scrivere* (write) | -ire: *dormire* (sleep) |
|---|---|---|
| io | *scrivo* | *dormo* |
| tu | *scrivi* | *dormi* |
| lui, lei, Lei | *scrive* | *dorme* |
| noi | *scriviamo* | *dormiamo* |
| voi | *scrivete* | *dormite* |
| loro | *scrivono* | *dormono* |

The only difference is the *voi* form: **-ete** for *-ere* verbs, **-ite** for *-ire* verbs.

Other common verbs like these: *leggere* (read), *prendere* (take), *vedere* (see), *vivere* (live), *correre* (run); *partire* (leave), *sentire* (hear, feel), *aprire* (open), *offrire* (offer).

Some *-ire* verbs, like *capire* (understand), add **-isc-**: *capisco*. You will learn them in the next point.

**Watch out:** the *lui/lei* form ends in **-e**, not *-a*: *Marco scrive*, not *scriva*. And the stress in the *loro* form is early, like the *io* form: *SCRIvono*, *DORmono*, not *scriVOno*.

Examples:
- *Leggo il giornale.* (I read the newspaper.)
- *Dormono fino a tardi.* (They sleep late.)
- *Partite domani?* (Are you leaving tomorrow?)`,
    drills: [
      { it: 'Io [leggo] il giornale.', en: 'I read the newspaper.', hint: 'leggere (io)' },
      { it: 'Tu [scrivi] una lettera?', en: 'Are you writing a letter?', hint: 'scrivere (tu)' },
      { it: 'Marco [prende] il treno.', en: 'Marco takes the train.', hint: 'prendere (lui)' },
      {
        it: 'Noi [vediamo] un film stasera.',
        en: "We're seeing a film this evening.",
        hint: 'vedere (noi)',
      },
      { it: 'Voi [vivete] a Milano?', en: 'Do you (all) live in Milan?', hint: 'vivere (voi)' },
      { it: 'Loro [dormono] fino a tardi.', en: 'They sleep late.', hint: 'dormire (loro)' },
      { it: 'Io [parto] domani.', en: "I'm leaving tomorrow.", hint: 'partire (io)' },
      { it: 'Tu [senti] la musica?', en: 'Can you hear the music?', hint: 'sentire (tu)' },
      { it: 'Anna [apre] la finestra.', en: 'Anna opens the window.', hint: 'aprire (lei)' },
      { it: 'Noi [dormiamo] poco.', en: "We don't sleep much.", hint: 'dormire (noi)' },
      {
        it: 'Voi [partite] stasera?',
        en: 'Are you (all) leaving this evening?',
        hint: 'partire (voi)',
      },
      { it: 'Che cosa [prendi]?', en: 'What will you have?', hint: 'prendere (tu)' },
      {
        it: 'I bambini [corrono] nel parco.',
        en: 'The children are running in the park.',
        hint: 'correre (loro)',
      },
      { it: 'Loro [offrono] il caffè.', en: "They're buying the coffee.", hint: 'offrire (loro)' },
    ],
  },
  {
    id: 40,
    slug: 'present-isc',
    title: '-ire verbs with -isc-: capisco, finisco',
    cefr: 'A1',
    prerequisites: ['present-ere-ire'],
    noteMd: `**In short:** Many *-ire* verbs add **-isc-** before the ending in the present tense, except in the *noi* and *voi* forms. The endings themselves are the normal *-ire* endings.

| person | *capire* (understand) | *finire* (finish) |
|---|---|---|
| io | *capisco* | *finisco* |
| tu | *capisci* | *finisci* |
| lui, lei, Lei | *capisce* | *finisce* |
| noi | *capiamo* | *finiamo* |
| voi | *capite* | *finite* |
| loro | *capiscono* | *finiscono* |

Common verbs like this: *capire* (understand), *finire* (finish), *preferire* (prefer), *pulire* (clean), *spedire* (send by post), *costruire* (build).

Pronunciation: *-isco* and *-iscono* sound like "isk", while *-isci* and *-isce* sound like "ish".

You can't tell from the infinitive whether a verb takes *-isc-*: *dormire, partire, sentire, aprire* don't. Learn each verb with its *io* form: *capire, capisco*; *dormire, dormo*.

**Watch out:** don't add *-isc-* to the *noi* and *voi* forms: it's *capiamo* and *capite*, not *capisciamo* or *capiscite*.

Examples:
- *Non capisco.* (I don't understand.)
- *A che ora finisci?* (What time do you finish?)
- *Preferiamo il mare.* (We prefer the seaside.)`,
    drills: [
      { it: 'Non [capisco].', en: "I don't understand.", hint: 'capire (io)' },
      { it: "[Capisci] l'italiano?", en: 'Do you understand Italian?', hint: 'capire (tu)' },
      {
        it: 'Il film [finisce] alle dieci.',
        en: 'The film finishes at ten.',
        hint: 'finire (lui)',
      },
      { it: 'Noi [capiamo] tutto.', en: 'We understand everything.', hint: 'capire (noi)' },
      {
        it: 'Voi [preferite] il tè o il caffè?',
        en: 'Do you (all) prefer tea or coffee?',
        hint: 'preferire (voi)',
      },
      {
        it: 'Loro [puliscono] la casa il sabato.',
        en: 'They clean the house on Saturdays.',
        hint: 'pulire (loro)',
      },
      { it: 'Io [preferisco] il mare.', en: 'I prefer the seaside.', hint: 'preferire (io)' },
      {
        it: 'A che ora [finisci] di lavorare?',
        en: 'What time do you finish work?',
        hint: 'finire (tu)',
      },
      { it: 'Marco [spedisce] un pacco.', en: 'Marco is sending a parcel.', hint: 'spedire (lui)' },
      {
        it: 'Le lezioni [finiscono] a giugno.',
        en: 'Classes finish in June.',
        hint: 'finire (loro)',
      },
      { it: 'Oggi [finiamo] presto.', en: "We're finishing early today.", hint: 'finire (noi)' },
      { it: 'Lei [pulisce] la cucina.', en: 'She cleans the kitchen.', hint: 'pulire (lei)' },
      {
        it: 'Signora, [preferisce] il treno?',
        en: 'Madam, do you prefer the train?',
        hint: 'preferire (formal you)',
      },
    ],
  },
  {
    id: 13,
    slug: 'irregular-present',
    title: 'Common irregular verbs in the present',
    cefr: 'A1',
    prerequisites: ['present-ere-ire'],
    noteMd: `**In short:** The most frequent verbs don't follow the regular patterns; they are irregular. Learn each one as a whole set of six forms.

- **fare** (do, make): *faccio, fai, fa, facciamo, fate, fanno*
- **andare** (go): *vado, vai, va, andiamo, andate, vanno*
- **stare** (stay, be): *sto, stai, sta, stiamo, state, stanno*
- **dare** (give): *do, dai, dà, diamo, date, danno*
- **venire** (come): *vengo, vieni, viene, veniamo, venite, vengono*
- **dire** (say, tell): *dico, dici, dice, diciamo, dite, dicono*
- **uscire** (go out): *esco, esci, esce, usciamo, uscite, escono*
- **sapere** (know): *so, sai, sa, sappiamo, sapete, sanno*
- **bere** (drink): *bevo, bevi, beve, beviamo, bevete, bevono*
- **rimanere** (stay, remain): *rimango, rimani, rimane, rimaniamo, rimanete, rimangono*

*Stare* is used for how someone is: *Come stai? Sto bene.* (How are you? I'm fine.)

Notice the patterns: the *noi* form is often regular (*andiamo, veniamo*), and *io* and *loro* often share a **g** (*vengo, vengono; rimango, rimangono*).

**Watch out:** *dà* (gives) has an accent, to tell it apart from *da* (from). And "How are you?" uses *stare*, not *essere*: *Come stai?*, not *Come sei?* (which asks what someone is like).

Examples:
- *Che cosa fai stasera?* (What are you doing tonight?)
- *Vado al lavoro in treno.* (I go to work by train.)
- *Come stai?* (How are you?)`,
    drills: [
      { it: 'Che cosa [fai] stasera?', en: 'What are you doing this evening?', hint: 'fare (tu)' },
      { it: '[Vado] al lavoro in treno.', en: 'I go to work by train.', hint: 'andare (io)' },
      { it: 'Come [stai]?', en: 'How are you?', hint: 'stare (tu)' },
      { it: "Domani [vengo] anch'io.", en: "I'm coming too tomorrow.", hint: 'venire (io)' },
      { it: 'Che cosa [dici]?', en: 'What are you saying?', hint: 'dire (tu)' },
      {
        it: 'Stasera [usciamo] con gli amici.',
        en: "We're going out with friends this evening.",
        hint: 'uscire (noi)',
      },
      {
        it: 'Loro [vanno] in vacanza ad agosto.',
        en: 'They go on holiday in August.',
        hint: 'andare (loro)',
      },
      { it: 'Noi [facciamo] una pizza.', en: "We're making a pizza.", hint: 'fare (noi)' },
      {
        it: '[Venite] alla festa?',
        en: 'Are you (all) coming to the party?',
        hint: 'venire (voi)',
      },
      { it: 'Marco [esce] alle otto.', en: 'Marco goes out at eight.', hint: 'uscire (lui)' },
      { it: 'I bambini [stanno] bene.', en: 'The children are well.', hint: 'stare (loro)' },
      { it: 'Luca [dà] un libro a Sara.', en: 'Luca gives Sara a book.', hint: 'dare (lui)' },
      { it: 'Non [so] la risposta.', en: "I don't know the answer.", hint: 'sapere (io)' },
      { it: 'Che cosa [bevi]?', en: 'What are you drinking?', hint: 'bere (tu)' },
      {
        it: 'Loro [dicono] sempre la verità.',
        en: 'They always tell the truth.',
        hint: 'dire (loro)',
      },
      {
        it: 'Stasera [rimango] a casa.',
        en: "I'm staying at home this evening.",
        hint: 'rimanere (io)',
      },
    ],
  },
  {
    id: 14,
    slug: 'modal-verbs',
    title: 'Volere, potere, dovere + infinitive',
    cefr: 'A1',
    prerequisites: ['irregular-present'],
    noteMd: `**In short:** *Volere* (want), *potere* (can, may) and *dovere* (must, have to) are followed directly by an infinitive (the dictionary form of a verb): *Voglio mangiare* (I want to eat). All three are irregular.

| person | **volere** | **potere** | **dovere** |
|---|---|---|---|
| io | *voglio* | *posso* | *devo* |
| tu | *vuoi* | *puoi* | *devi* |
| lui, lei, Lei | *vuole* | *può* | *deve* |
| noi | *vogliamo* | *possiamo* | *dobbiamo* |
| voi | *volete* | *potete* | *dovete* |
| loro | *vogliono* | *possono* | *devono* |

- *Volere* can also take a noun: *Vuoi un caffè?* (Do you want a coffee?) To ask politely for something, say *vorrei* (I would like): *Vorrei un tè.*
- *Potere* is for ability and permission: *Posso entrare?* (May I come in?)
- *Dovere* is for obligation: *Devo lavorare.* (I have to work.)
- For a negative, put *non* before the modal: *Non posso venire.*

**Watch out:** don't add a word for "to" between the two verbs: *Voglio andare*, not *Voglio di andare* or *Voglio a andare*. And *può* (he/she can) has an accent.

Examples:
- *Voglio imparare l'italiano.* (I want to learn Italian.)
- *Posso entrare?* (May I come in?)
- *Devo partire domani.* (I have to leave tomorrow.)`,
    drills: [
      { it: "[Voglio] imparare l'italiano.", en: 'I want to learn Italian.', hint: 'volere (io)' },
      { it: '[Posso] entrare?', en: 'May I come in?', hint: 'potere (io)' },
      { it: '[Devo] partire domani.', en: 'I have to leave tomorrow.', hint: 'dovere (io)' },
      { it: '[Vuoi] un caffè?', en: 'Do you want a coffee?', hint: 'volere (tu)' },
      {
        it: 'Marco non [può] venire stasera.',
        en: "Marco can't come this evening.",
        hint: 'potere (lui)',
      },
      { it: 'Noi [dobbiamo] studiare.', en: 'We have to study.', hint: 'dovere (noi)' },
      { it: '[Volete] mangiare qui?', en: 'Do you (all) want to eat here?', hint: 'volere (voi)' },
      {
        it: '[Potete] parlare più piano?',
        en: 'Can you (all) speak more slowly?',
        hint: 'potere (voi)',
      },
      {
        it: 'Loro [devono] lavorare sabato.',
        en: 'They have to work on Saturday.',
        hint: 'dovere (loro)',
      },
      {
        it: 'I bambini [vogliono] giocare.',
        en: 'The children want to play.',
        hint: 'volere (loro)',
      },
      { it: 'Non [possiamo] restare.', en: "We can't stay.", hint: 'potere (noi)' },
      { it: '[Devi] mangiare di più.', en: 'You have to eat more.', hint: 'dovere (tu)' },
      {
        it: "Signora, [vuole] un bicchiere d'acqua?",
        en: 'Madam, would you like a glass of water?',
        hint: 'volere (formal you)',
      },
      {
        it: 'Anna [deve] finire il lavoro.',
        en: 'Anna has to finish the job.',
        hint: 'dovere (lei)',
      },
    ],
  },
  {
    id: 15,
    slug: 'predicative-agreement',
    title: 'Agreement across the sentence: essere + adjective',
    cefr: 'A1',
    prerequisites: ['adjective-agreement', 'essere-present'],
    noteMd: `**In short:** An adjective after *essere* (to be) still agrees with the subject (who or what the sentence is about), even though it is further along in the sentence.

| | masculine | feminine |
|---|---|---|
| singular | *Il museo è chiuso.* | *La banca è chiusa.* |
| plural | *I negozi sono chiusi.* | *Le farmacie sono chiuse.* |

- When the subject mixes masculine and feminine, use the masculine plural: *Marco e Anna sono stanchi.*
- When the subject is *io* or *tu*, the adjective shows the speaker's or listener's gender: a man says *Sono stanco*, a woman says *Sono stanca*.
- *Noi* and *voi* take the plural: *-i* for men or a mixed group, *-e* for women only: *Siamo pronti* or *Siamo pronte*.

The verb agrees too, with the subject's person and number: *Il bambino è felice*, *I bambini sono felici*.

**Watch out:** English adjectives never change, so it is easy to forget the ending when the adjective is far from its noun. Look back at the subject before you finish the sentence: *La lezione è finita*, not *finito*. With formal *Lei*, use the real gender of the person: *Signora, Lei è stanca?*

Examples:
- *La pizza è buona.* (The pizza is good.)
- *Siamo contenti.* (We're happy.)
- *Le ragazze sono italiane.* (The girls are Italian.)`,
    drills: [
      { it: 'La banca è [chiusa].', en: 'The bank is closed.', hint: 'chiuso' },
      { it: 'I negozi sono [chiusi].', en: 'The shops are closed.', hint: 'chiuso' },
      { it: 'Le farmacie sono [chiuse].', en: 'The chemists are closed.', hint: 'chiuso' },
      { it: 'La pizza è [buona].', en: 'The pizza is good.', hint: 'buono' },
      { it: 'Marco e Anna sono [stanchi].', en: 'Marco and Anna are tired.', hint: 'stanco' },
      { it: 'Anna, sei [pronta]?', en: 'Anna, are you ready?', hint: 'pronto' },
      { it: 'Le ragazze sono [simpatiche].', en: 'The girls are nice.', hint: 'simpatico' },
      { it: 'Sono [stanca].', en: "I'm tired.", hint: 'stanco (a woman speaking)' },
      { it: 'Siamo [contenti].', en: "We're happy.", hint: 'contento (a mixed group speaking)' },
      { it: 'La minestra è [fredda].', en: 'The soup is cold.', hint: 'freddo' },
      { it: 'Gli esercizi sono [facili].', en: 'The exercises are easy.', hint: 'facile' },
      {
        it: 'Paola e Giulia sono [italiane].',
        en: 'Paola and Giulia are Italian.',
        hint: 'italiano',
      },
      { it: 'Signora, Lei è [stanca]?', en: 'Madam, are you tired?', hint: 'stanco' },
    ],
  },
  {
    id: 16,
    slug: 'simple-prepositions',
    title: 'Simple prepositions',
    cefr: 'A1',
    prerequisites: ['definite-articles'],
    noteMd: `**In short:** Prepositions are small words like "of", "to", "with" that link a word to the rest of the sentence. Italian has nine basic ones, and they don't match English one to one.

| Italian | main meanings |
|---|---|
| **di** | of, from (a city of origin), 's |
| **a** | to, at, in (a city) |
| **da** | from, at or to someone's place |
| **in** | in, to (a country), by (transport) |
| **con** | with |
| **su** | on |
| **per** | for |
| **tra** / **fra** | between, in (time from now) |

Useful patterns:
- Origin: *Sono di Napoli.* (I'm from Naples.)
- *a* + city, *in* + country: *Vivo a Milano, in Italia.*
- *da* + person: *Vado da Marco.* (I'm going to Marco's.)
- *in* + transport: *in treno, in macchina*; but *a piedi* (on foot).
- *tra* + time: *tra un'ora* (in an hour). *Tra* and *fra* mean the same.
- Belonging: *il libro di Luca* (Luca's book). Italian has no "'s".

**Watch out:** "in" for a city is *a*, not *in*: *Abito a Roma*. And "from" for where you were born is *di* (*Sono di Roma*), but "from" for where you are coming from is *da* (*Il treno arriva da Roma*).

Examples:
- *Sono di Napoli.* (I'm from Naples.)
- *Esco con gli amici.* (I'm going out with friends.)
- *Il film comincia tra dieci minuti.* (The film starts in ten minutes.)`,
    drills: [
      { it: 'Sono [di] Napoli.', en: "I'm from Naples.", hint: 'from (origin)' },
      { it: 'Vivo [a] Milano.', en: 'I live in Milan.', hint: 'in (a city)' },
      { it: 'Abito [in] Italia.', en: 'I live in Italy.', hint: 'in (a country)' },
      { it: 'Esco [con] gli amici.', en: "I'm going out with friends.", hint: 'with' },
      { it: 'Il regalo è [per] Marco.', en: 'The present is for Marco.', hint: 'for' },
      {
        it: 'Stasera vado [da] Marco.',
        en: "I'm going to Marco's this evening.",
        hint: "to (someone's place)",
      },
      { it: 'Andiamo [in] treno.', en: "We're going by train.", hint: 'by (transport)' },
      { it: 'Vengo [a] piedi.', en: "I'm coming on foot.", hint: 'on (foot)' },
      {
        it: 'Il film comincia [tra] dieci minuti.',
        en: 'The film starts in ten minutes.',
        hint: 'in (time from now)',
        also: ['fra'],
      },
      { it: 'Il libro [di] Luca è nuovo.', en: "Luca's book is new.", hint: "'s (belonging)" },
      {
        it: 'Il treno arriva [da] Roma.',
        en: 'The train is coming from Rome.',
        hint: 'from (coming from)',
      },
      {
        it: 'La banca è [tra] il bar e la farmacia.',
        en: "The bank is between the café and the chemist's.",
        hint: 'between',
        also: ['fra'],
      },
      { it: 'Studio italiano [per] lavoro.', en: "I'm studying Italian for work.", hint: 'for' },
    ],
  },
  {
    id: 17,
    slug: 'articulated-prepositions',
    title: 'Prepositions + article: nel, della, al...',
    cefr: 'A1',
    prerequisites: ['simple-prepositions'],
    noteMd: `**In short:** When **di, a, da, in** or **su** comes before "the" (*il, la, i* and so on), the two words join into one: *a + il = al*, *in + la = nella*.

| | + il | + la | + i |
|---|---|---|---|
| **di** | *del* | *della* | *dei* |
| **a** | *al* | *alla* | *ai* |
| **da** | *dal* | *dalla* | *dai* |
| **in** | *nel* | *nella* | *nei* |
| **su** | *sul* | *sulla* | *sui* |

The other articles join the same way. Notice that *di* becomes **de-** and *in* becomes **ne-**:
- *lo*: *dello, allo, dallo, nello, sullo*
- *l'*: *dell', all', dall', nell', sull'*
- *gli*: *degli, agli, dagli, negli, sugli*
- *le*: *delle, alle, dalle, nelle, sulle*

Forms with *la, lo, le, l'* double the **l**: *alla, nello, delle*.

*Con* and *per* normally stay separate: *con il, per la*. (You may also hear *col*.)

**Watch out:** don't write the two words apart: *nel parco*, not *in il parco*. And choose the article first, then join: *lo zaino → nello zaino*, *gli amici → agli amici*.

Examples:
- *Il libro è nella borsa.* (The book is in the bag.)
- *Vado al mare.* (I'm going to the seaside.)
- *La casa dei nonni è grande.* (Our grandparents' house is big.)`,
    drills: [
      { it: 'Il libro è [nella] borsa.', en: 'The book is in the bag.', hint: 'in + the' },
      { it: 'Vado [al] mare.', en: "I'm going to the seaside.", hint: 'a + the' },
      {
        it: 'La casa [dei] nonni è grande.',
        en: "Our grandparents' house is big.",
        hint: 'di + the',
      },
      { it: 'Il gatto è [sul] tavolo.', en: 'The cat is on the table.', hint: 'su + the' },
      { it: 'Torno [dal] lavoro alle sei.', en: 'I get back from work at six.', hint: 'da + the' },
      { it: 'Il treno parte [alle] otto.', en: 'The train leaves at eight.', hint: 'a + the' },
      {
        it: 'Le chiavi sono [nello] zaino.',
        en: 'The keys are in the backpack.',
        hint: 'in + the',
      },
      {
        it: "Il nome [dell']albergo è strano.",
        en: 'The name of the hotel is strange.',
        hint: 'di + the',
      },
      { it: 'Telefono [agli] amici.', en: "I'm calling my friends.", hint: 'a + the' },
      {
        it: 'I bambini giocano [nel] parco.',
        en: 'The children are playing in the park.',
        hint: 'in + the',
      },
      {
        it: 'Qual è il prezzo [delle] mele?',
        en: "What's the price of the apples?",
        hint: 'di + the',
      },
      {
        it: 'I libri sono [sugli] scaffali.',
        en: 'The books are on the shelves.',
        hint: 'su + the',
      },
      {
        it: 'Parlo [con il] direttore.',
        en: "I'm speaking with the manager.",
        hint: 'con + the',
        also: ['col'],
      },
      { it: 'Metto il latte [nel] caffè.', en: 'I put milk in my coffee.', hint: 'in + the' },
    ],
  },
  {
    id: 41,
    slug: 'a-in-places',
    title: 'Going places: a, in, da with cities, countries and people',
    cefr: 'A1',
    prerequisites: ['articulated-prepositions'],
    noteMd: `**In short:** To say where you are or where you are going, Italian uses **a**, **in** or **da**. The same word covers both "in" and "to": *Sono a Roma* (I'm in Rome), *Vado a Roma* (I'm going to Rome).

- **a** + city or small island: *a Firenze, a Capri*.
- **in** + country, region, large island or continent: *in Spagna, in Toscana, in Sicilia, in Europa*. With a plural or described country, add the article: *negli Stati Uniti*.
- **da** + a person, meaning "to" or "at" their place: *da Marco* (to Marco's), *da me* (to my place), *dal medico* (to the doctor's).

Many everyday places have fixed phrases with no article:
- **in**: *in banca, in ufficio, in centro, in città, in montagna, in biblioteca, in farmacia, in vacanza*
- **a**: *a casa, a scuola, a letto, a teatro*

Others take **a** + the article: *al mare, al cinema, al bar, al ristorante, allo stadio*.

**Watch out:** "to Italy" is *in Italia*, not *a Italia*, and "to Marco's" is *da Marco*, not *a Marco*. "At home" is *a casa*, with no article.

Examples:
- *Vivo a Firenze, in Toscana.* (I live in Florence, in Tuscany.)
- *Stasera vado da Giulia.* (I'm going to Giulia's this evening.)
- *Andiamo al mare o in montagna?* (Shall we go to the seaside or the mountains?)`,
    drills: [
      { it: 'Vivo [a] Firenze.', en: 'I live in Florence.', hint: 'in (a city)' },
      { it: 'Andiamo [in] Spagna.', en: "We're going to Spain.", hint: 'to (a country)' },
      {
        it: 'Domani vado [da] Marco.',
        en: "Tomorrow I'm going to Marco's.",
        hint: "to (a person's place)",
      },
      {
        it: 'Sono [in] ufficio fino alle sei.',
        en: "I'm at the office until six.",
        hint: 'at (the office)',
      },
      { it: 'Stasera resto [a] casa.', en: "I'm staying at home this evening.", hint: 'at (home)' },
      {
        it: 'Devo andare [dal] medico.',
        en: "I have to go to the doctor's.",
        hint: "to (the doctor's)",
      },
      {
        it: 'Ad agosto andiamo [al] mare.',
        en: 'In August we go to the seaside.',
        hint: 'to (the seaside)',
      },
      { it: 'Abitano [in] Toscana.', en: 'They live in Tuscany.', hint: 'in (a region)' },
      {
        it: 'Mio fratello lavora [negli] Stati Uniti.',
        en: 'My brother works in the United States.',
        hint: 'in (the United States)',
      },
      {
        it: 'Passiamo una settimana [a] Capri.',
        en: "We're spending a week on Capri.",
        hint: 'on (a small island)',
      },
      {
        it: 'Stasera andiamo [al] cinema.',
        en: "We're going to the cinema this evening.",
        hint: 'to (the cinema)',
      },
      { it: 'Vado [in] banca.', en: "I'm going to the bank.", hint: 'to (the bank)' },
      {
        it: 'Vieni [da] me stasera?',
        en: 'Are you coming to my place this evening?',
        hint: 'to (my place)',
      },
      {
        it: "D'inverno andiamo [in] montagna.",
        en: 'In winter we go to the mountains.',
        hint: 'to (the mountains)',
      },
    ],
  },
  {
    id: 18,
    slug: 'demonstratives',
    title: 'Questo and quello',
    cefr: 'A1',
    prerequisites: ['adjective-agreement'],
    noteMd: `**In short:** *Questo* means "this" (near the speaker) and *quello* means "that" (further away). Both agree with the noun in gender and number.

**Questo** changes like an *-o* adjective: *questo libro, questa casa, questi libri, queste case*. Before a vowel, *questo* and *questa* can become *quest'*: *quest'anno*.

**Quello** before a noun changes like the definite article (*il, lo, la...*):

| article | *quello* | example |
|---|---|---|
| il / i | quel / quei | *quel libro, quei libri* |
| lo / gli | quello / quegli | *quello studente, quegli studenti* |
| l' / gli | quell' / quegli | *quell'albero, quegli alberi* |
| la / le | quella / quelle | *quella casa, quelle case* |

Used alone, without a noun (as a pronoun, meaning "this one" or "that one"), they have the simple forms *questo, questa, questi, queste* and *quello, quella, quelli, quelle*: *Preferisco quello.*

**Watch out:** don't say *quello libro* or *quelli libri*. Before a noun, match the article: *il libro → quel libro*, *i libri → quei libri*.

Examples:
- *Questa pizza è buonissima.* (This pizza is delicious.)
- *Chi è quel ragazzo?* (Who is that boy?)
- *Preferisco quella.* (I prefer that one.)`,
    drills: [
      { it: '[Questa] pizza è buonissima.', en: 'This pizza is delicious.', hint: 'this' },
      { it: '[Questo] libro è nuovo.', en: 'This book is new.', hint: 'this' },
      { it: '[Questi] ragazzi sono simpatici.', en: 'These boys are nice.', hint: 'these' },
      { it: '[Queste] scarpe sono care.', en: 'These shoes are expensive.', hint: 'these' },
      { it: 'Chi è [quel] ragazzo?', en: 'Who is that boy?', hint: 'that' },
      { it: '[Quella] casa è grande.', en: 'That house is big.', hint: 'that' },
      { it: '[Quello] studente è bravo.', en: 'That student is good.', hint: 'that' },
      { it: "[Quell']albero è molto vecchio.", en: 'That tree is very old.', hint: 'that' },
      { it: '[Quei] libri sono vecchi.', en: 'Those books are old.', hint: 'those' },
      { it: '[Quegli] amici sono di Roma.', en: 'Those friends are from Rome.', hint: 'those' },
      { it: '[Quelle] ragazze parlano inglese.', en: 'Those girls speak English.', hint: 'those' },
      { it: 'Preferisco [quella].', en: 'I prefer that one.', hint: 'that one (feminine)' },
      { it: 'Non questi, [quelli]!', en: 'Not these, those!', hint: 'those ones (masculine)' },
    ],
  },
  {
    id: 19,
    slug: 'possessives',
    title: 'Possessives: il mio, la tua...',
    cefr: 'A1',
    prerequisites: ['adjective-agreement'],
    noteMd: `**In short:** Possessives are words like "my" and "your". In Italian they agree with the **thing owned**, not the owner, and they normally come with the article: *il mio libro* (my book).

| owner | masc. sing. | fem. sing. | plural (m / f) |
|---|---|---|---|
| my | *il mio* | *la mia* | *i miei / le mie* |
| your (tu) | *il tuo* | *la tua* | *i tuoi / le tue* |
| his, her, your (Lei) | *il suo* | *la sua* | *i suoi / le sue* |
| our | *il nostro* | *la nostra* | *i nostri / le nostre* |
| your (voi) | *il vostro* | *la vostra* | *i vostri / le vostre* |
| their | *il loro* | *la loro* | *i loro / le loro* |

*Loro* never changes. *Suo* means "his" or "her": *la sua casa* is "his house" or "her house". Polite "your" is written *Suo*.

**Family words:** with a single family member, drop the article: *mia madre, tuo fratello, sua sorella*. Keep it in the plural (*i miei fratelli*) and always with *loro* (*la loro madre*).

**Watch out:** *suo/sua* agree with the thing, not the person who owns it. Marco's sister is *sua sorella* (feminine, because *sorella* is feminine), and Anna's brother is *suo fratello*.

Examples:
- *Dov'è la mia borsa?* (Where's my bag?)
- *Mio padre è medico.* (My father is a doctor.)
- *Suo marito è simpatico.* (Her husband is nice.)`,
    drills: [
      { it: "Dov'è [la mia] borsa?", en: "Where's my bag?", hint: 'my' },
      { it: '[Il mio] telefono è nuovo.', en: 'My phone is new.', hint: 'my' },
      { it: '[I miei] libri sono qui.', en: 'My books are here.', hint: 'my' },
      { it: '[Le mie] amiche sono simpatiche.', en: 'My friends are nice.', hint: 'my' },
      { it: 'È [la tua] macchina?', en: 'Is it your car?', hint: 'your (informal)' },
      { it: '[Mio] padre è medico.', en: 'My father is a doctor.', hint: 'my' },
      {
        it: '[Tua] sorella è molto alta.',
        en: 'Your sister is very tall.',
        hint: 'your (informal)',
      },
      { it: 'Marco pulisce [la sua] casa.', en: 'Marco cleans his house.', hint: 'his' },
      { it: 'Anna parla con [suo] fratello.', en: 'Anna is talking to her brother.', hint: 'her' },
      { it: '[Il nostro] appartamento è piccolo.', en: 'Our flat is small.', hint: 'our' },
      {
        it: '[La vostra] città è bellissima.',
        en: 'Your city is beautiful.',
        hint: 'your (plural)',
      },
      { it: '[La loro] madre è italiana.', en: 'Their mother is Italian.', hint: 'their' },
      {
        it: '[I tuoi] genitori abitano a Roma?',
        en: 'Do your parents live in Rome?',
        hint: 'your (informal)',
      },
      {
        it: 'Signora, è [il Suo] cappotto?',
        en: 'Madam, is this your coat?',
        hint: 'your (formal)',
      },
    ],
  },
  {
    id: 42,
    slug: 'linking-words',
    title: 'Linking words: e, ma, o, perché, quando, se',
    cefr: 'A1',
    prerequisites: [],
    noteMd: `**In short:** Linking words (conjunctions) join words or whole sentences together. With these six you can already make longer sentences.

| word | meaning | example |
|---|---|---|
| **e** | and | *pane e burro* |
| **ma** | but | *piccolo ma bello* |
| **o** | or | *tè o caffè?* |
| **perché** | because; why | *Resto a casa perché piove.* |
| **quando** | when | *Quando piove, resto a casa.* |
| **se** | if; whether | *Se piove, resto a casa.* |

- Before a word starting with **e**, *e* often becomes **ed**: *Anna ed Elena*. Before other vowels it is usually just *e*: *Marco e Anna*.
- *Oppure* is a longer word for "or": *Vieni oppure resti?*
- *Perché* is both the question "why?" and the answer "because": *Perché studi? Perché mi piace.*
- With *quando* and *se*, use the present tense for things that happen regularly or may happen: *Se ho tempo, vengo.* (If I have time, I'll come.)

**Watch out:** *perché* has an accent on the final **é**, sloping to the right. And *se* (if) has no accent; *sé* with an accent is a different word (oneself). Don't use *se* for "when" about something that will surely happen: *Quando arrivo, mangio* (When I get there, I'll eat).

Examples:
- *Sono stanco, ma sono contento.* (I'm tired but happy.)
- *Resto a casa perché sono malato.* (I'm staying home because I'm ill.)
- *Se piove, prendo l'autobus.* (If it rains, I'll take the bus.)`,
    drills: [
      { it: 'Ho un fratello [e] una sorella.', en: 'I have a brother and a sister.', hint: 'and' },
      {
        it: 'Sono stanco, [ma] sono contento.',
        en: "I'm tired, but I'm happy.",
        hint: 'but',
        also: ['però'],
      },
      {
        it: 'Vuoi un tè [o] un caffè?',
        en: 'Do you want a tea or a coffee?',
        hint: 'or',
        also: ['oppure'],
      },
      {
        it: 'Resto a casa [perché] sono malato.',
        en: "I'm staying home because I'm ill.",
        hint: 'because',
      },
      { it: '[Se] piove, resto a casa.', en: 'If it rains, I stay at home.', hint: 'if' },
      { it: '[Quando] arrivo a casa, mangio.', en: 'When I get home, I eat.', hint: 'when' },
      {
        it: 'Parlo inglese, [ma] non parlo tedesco.',
        en: "I speak English, but I don't speak German.",
        hint: 'but',
        also: ['però'],
      },
      { it: "[Perché] studi l'italiano?", en: 'Why are you studying Italian?', hint: 'why' },
      {
        it: 'Non so [se] Marco viene.',
        en: "I don't know if Marco is coming.",
        hint: 'if (whether)',
      },
      { it: 'Mangio [quando] ho fame.', en: "I eat when I'm hungry.", hint: 'when' },
      {
        it: "Bevo un'acqua [perché] ho sete.",
        en: "I'm having a water because I'm thirsty.",
        hint: 'because',
      },
      {
        it: 'Anna [ed] Elena sono sorelle.',
        en: 'Anna and Elena are sisters.',
        hint: 'and (before e-)',
        also: ['e'],
      },
      {
        it: '[Se] hai tempo, vieni alla festa.',
        en: 'If you have time, come to the party.',
        hint: 'if',
      },
    ],
  },
  {
    id: 20,
    slug: 'piacere',
    title: 'Mi piace (I like)',
    cefr: 'A1',
    prerequisites: ['present-ere-ire'],
    noteMd: `**In short:** To say you like something, Italian turns the sentence around: *Mi piace il caffè* means "Coffee is pleasing to me". The thing you like is the subject (it does the "pleasing"), and the person who likes it comes first as *mi, ti, gli...*

- **piace** + one thing or a verb: *Mi piace il caffè. Mi piace leggere.*
- **piacciono** + more than one thing: *Mi piacciono i gatti.*

The person who likes:

| who likes | Italian |
|---|---|
| I | *mi piace* |
| you (informal) | *ti piace* |
| he / she | *gli piace / le piace* |
| you (formal) | *Le piace* |
| we | *ci piace* |
| you (plural) | *vi piace* |
| they | *gli piace* (or *a loro piace*) |

With a name or a noun, use **a** + the person: *A Marco piace il calcio. Ai bambini piacciono i dolci.*

For a negative, put *non* first: *Non mi piace.*

**Watch out:** the verb agrees with the thing liked, not with the person: *Mi piacciono le mele* (plural, because of *mele*), even though "I" is singular. And never say *Io piace*: the person is *mi*, not *io*.

Examples:
- *Ti piace la musica italiana?* (Do you like Italian music?)
- *Non mi piacciono le verdure.* (I don't like vegetables.)
- *A Marco piace cucinare.* (Marco likes cooking.)`,
    drills: [
      { it: '[Mi piace] il caffè.', en: 'I like coffee.', hint: 'piacere (I like)' },
      { it: '[Mi piacciono] i gatti.', en: 'I like cats.', hint: 'piacere (I like)' },
      { it: '[Mi piace] leggere.', en: 'I like reading.', hint: 'piacere (I like)' },
      {
        it: '[Ti piace] la musica italiana?',
        en: 'Do you like Italian music?',
        hint: 'piacere (you like, informal)',
      },
      {
        it: 'Non [mi piacciono] le verdure.',
        en: "I don't like vegetables.",
        hint: 'piacere (I like)',
      },
      { it: 'A Marco [piace] il calcio.', en: 'Marco likes football.', hint: 'piacere' },
      { it: 'Ai bambini [piacciono] i dolci.', en: 'Children like sweets.', hint: 'piacere' },
      { it: '[Gli piace] cucinare.', en: 'He likes cooking.', hint: 'piacere (he likes)' },
      { it: '[Le piacciono] i fiori.', en: 'She likes flowers.', hint: 'piacere (she likes)' },
      { it: '[Ci piace] viaggiare.', en: 'We like travelling.', hint: 'piacere (we like)' },
      { it: '[Vi piace] Roma?', en: 'Do you (all) like Rome?', hint: 'piacere (you like, plural)' },
      {
        it: 'Signora, [Le piace] il vino?',
        en: 'Madam, do you like wine?',
        hint: 'piacere (you like, formal)',
      },
      {
        it: '[Gli piacciono] i film italiani.',
        en: 'They like Italian films.',
        hint: 'piacere (they like)',
        also: ['A loro piacciono'],
      },
    ],
  },
];
