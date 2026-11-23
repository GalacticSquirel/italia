# Tutor model evaluation

Held-out items: 801 tutor turns from evaluation-only scenarios.

## Parity with the reference (teacher-reference)

A system is on par on a metric when it is no worse than the reference by more than the
tolerance; on the judge when its win rate against the reference is at least 45.0%.

| Metric | Tolerance | teacher-reference | m12-k04 | round12m-q4 |
|---|---|---|---|---|
| JSON validity | 1.0% | 100.0% | 100.0% on par | 88.3% below |
| Feedback move accuracy | 5.0% | 100.0% | 87.9% below | 48.9% below |
| Correction accuracy (due correction, right error) | 5.0% | 100.0% | 76.3% below | 33.7% below |
| Over-correction (corrected a correct turn) | 3.0% | 0.0% | 6.2% below | 12.9% below |
| Prompts that give the answer away | 3.0% | 0.0% | 1.0% on par | 5.9% below |
| Recast correctness | 5.0% | 99.0% | 68.6% below | 13.9% below |
| LanguageTool errors / 100 words | 0.30 | 0.02 | 0.03 on par | 0.02 on par |
| Tokens outside the level band | 2.0% | 2.0% | 1.9% on par | 3.4% on par |
| Italian-only replies | 2.0% | 100.0% | 100.0% on par | 100.0% on par |

- m12-k04: 5/9 on par
- round12m-q4: 3/9 on par

## Automatic metrics

| Metric | teacher-reference | m12-k04 | round12m-q4 |
|---|---|---|---|
| JSON validity (higher is better) | **100.0%** | **100.0%** | 88.3% |
| LanguageTool errors / 100 words (lower is better) | **0.02** | 0.03 | 0.02 |
| Replies with a LanguageTool error (lower is better) | **0.2%** | 0.5% | 0.3% |
| Tokens outside the level band (lower is better) | 2.0% | **1.9%** | 3.4% |
| Replies over the band limit (lower is better) | **0.7%** | 4.9% | 8.1% |
| Replies with an over-long sentence (lower is better) | **0.1%** | 0.5% | 1.1% |
| Italian-only replies (higher is better) | **100.0%** | **100.0%** | **100.0%** |
| Feedback move accuracy (higher is better) | **100.0%** | 87.9% | 48.9% |
| Over-correction (corrected a correct turn) (lower is better) | **0.0%** | 6.2% | 12.9% |
| Under-correction (missed a due correction) (lower is better) | **0.0%** | 13.8% | 47.9% |
| Correction accuracy (due correction, right error) (higher is better) | **100.0%** | 76.3% | 33.7% |
| Prompts that give the answer away (lower is better) | **0.0%** | 1.0% | 5.9% |
| Recast correctness (higher is better) | **99.0%** | 68.6% | 13.9% |
| Error-tag F1 (micro) (higher is better) | **1.00** | 0.77 | 0.47 |
| Error-tag F1 (macro) (higher is better) | **1.00** | 0.74 | 0.45 |
| Annotation consistency (higher is better) | **100.0%** | 99.6% | 99.2% |

## By level

| System | Level | Items | JSON valid | Move accuracy | Tokens outside band |
|---|---|---|---|---|---|
| teacher-reference | A1 | 134 | 100.0% | 100.0% | 0.0% |
| teacher-reference | A2 | 122 | 100.0% | 100.0% | 0.0% |
| teacher-reference | B1 | 132 | 100.0% | 100.0% | 0.0% |
| teacher-reference | B2 | 136 | 100.0% | 100.0% | 1.4% |
| teacher-reference | C1 | 141 | 100.0% | 100.0% | 2.4% |
| teacher-reference | C2 | 136 | 100.0% | 100.0% | 3.6% |
| m12-k04 | A1 | 134 | 100.0% | 96.3% | 2.5% |
| m12-k04 | A2 | 122 | 100.0% | 92.6% | 0.8% |
| m12-k04 | B1 | 132 | 100.0% | 85.6% | 1.8% |
| m12-k04 | B2 | 136 | 100.0% | 89.0% | 1.7% |
| m12-k04 | C1 | 141 | 100.0% | 86.5% | 2.4% |
| m12-k04 | C2 | 136 | 100.0% | 77.9% | 1.8% |
| round12m-q4 | A1 | 134 | 88.8% | 59.7% | 2.1% |
| round12m-q4 | A2 | 122 | 91.8% | 57.1% | 4.0% |
| round12m-q4 | B1 | 132 | 89.4% | 50.0% | 1.9% |
| round12m-q4 | B2 | 136 | 88.2% | 55.8% | 3.4% |
| round12m-q4 | C1 | 141 | 87.2% | 53.7% | 4.3% |
| round12m-q4 | C2 | 136 | 84.6% | 56.5% | 3.3% |

## Feedback moves (rows: gold, columns: predicted)

**teacher-reference**

| gold \ predicted | none | prompt | recast | invalid |
|---|---|---|---|---|
| none | 388 | 0 | 0 | 0 |
| prompt | 0 | 219 | 0 | 0 |
| recast | 0 | 0 | 194 | 0 |

**m12-k04**

| gold \ predicted | none | prompt | recast | invalid |
|---|---|---|---|---|
| none | 364 | 16 | 8 | 0 |
| prompt | 29 | 185 | 5 | 0 |
| recast | 28 | 11 | 155 | 0 |

**round12m-q4**

| gold \ predicted | none | prompt | recast | invalid |
|---|---|---|---|---|
| none | 338 | 3 | 2 | 45 |
| prompt | 70 | 16 | 111 | 22 |
| recast | 128 | 1 | 38 | 27 |

## LanguageTool rules in replies (top 10 per system)

- teacher-reference: MORFOLOGIK_RULE_IT_IT 2
- m12-k04: MORFOLOGIK_RULE_IT_IT 4
- round12m-q4: MORFOLOGIK_RULE_IT_IT 2

## Error tags (per tag, best system by micro F1)

System: teacher-reference

| Tag | Support | Precision | Recall | F1 |
|---|---|---|---|---|
| false-friend | 60 | 1.00 | 1.00 | 1.00 |
| word-choice | 41 | 1.00 | 1.00 | 1.00 |
| subjunctive-use | 35 | 1.00 | 1.00 | 1.00 |
| auxiliary-choice | 23 | 1.00 | 1.00 | 1.00 |
| relative-pronoun | 22 | 1.00 | 1.00 | 1.00 |
| future-form | 16 | 1.00 | 1.00 | 1.00 |
| preposition | 14 | 1.00 | 1.00 | 1.00 |
| tense-aspect | 14 | 1.00 | 1.00 | 1.00 |
| article-use | 12 | 1.00 | 1.00 | 1.00 |
| hypothetical | 12 | 1.00 | 1.00 | 1.00 |
| noun-gender | 12 | 1.00 | 1.00 | 1.00 |
| article-form | 11 | 1.00 | 1.00 | 1.00 |
| ci-ne | 11 | 1.00 | 1.00 | 1.00 |
| modal-infinitive | 11 | 1.00 | 1.00 | 1.00 |
| comparative | 10 | 1.00 | 1.00 | 1.00 |
| combined-pronouns | 9 | 1.00 | 1.00 | 1.00 |
| question-form | 9 | 1.00 | 1.00 | 1.00 |
| register | 9 | 1.00 | 1.00 | 1.00 |
| passive | 8 | 1.00 | 1.00 | 1.00 |
| subjunctive-form | 7 | 1.00 | 1.00 | 1.00 |
| noun-number | 6 | 1.00 | 1.00 | 1.00 |
| object-pronoun | 6 | 1.00 | 1.00 | 1.00 |
| participle-agreement | 6 | 1.00 | 1.00 | 1.00 |
| pronoun-position | 6 | 1.00 | 1.00 | 1.00 |
| subject-verb-agreement | 5 | 1.00 | 1.00 | 1.00 |
| adjective-agreement | 4 | 1.00 | 1.00 | 1.00 |
| conditional-form | 4 | 1.00 | 1.00 | 1.00 |
| reflexive | 4 | 1.00 | 1.00 | 1.00 |
| imperative-form | 3 | 1.00 | 1.00 | 1.00 |
| imperfetto-form | 3 | 1.00 | 1.00 | 1.00 |
| past-participle-form | 3 | 1.00 | 1.00 | 1.00 |
| word-order | 3 | 1.00 | 1.00 | 1.00 |
| essere-avere | 2 | 1.00 | 1.00 | 1.00 |
| negation | 2 | 1.00 | 1.00 | 1.00 |
| piacere | 2 | 1.00 | 1.00 | 1.00 |
| possessive | 2 | 1.00 | 1.00 | 1.00 |
| verb-form | 2 | 1.00 | 1.00 | 1.00 |
| articulated-preposition | 1 | 1.00 | 1.00 | 1.00 |
| ce-ci-sono | 1 | 1.00 | 1.00 | 1.00 |
| demonstrative | 1 | 1.00 | 1.00 | 1.00 |
| stare-gerund | 1 | 1.00 | 1.00 | 1.00 |

## On-device speed (llama-bench)

Not measured in this run; see `eval/DEVICE_BENCH.md`.
