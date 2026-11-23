# Tutor model evaluation

Held-out items: 801 tutor turns from evaluation-only scenarios.

## Parity with the reference (teacher-reference)

A system is on par on a metric when it is no worse than the reference by more than the
tolerance; on the judge when its win rate against the reference is at least 45.0%.

| Metric | Tolerance | teacher-reference | m12-k04 | round12m-qat-q4 | round12m-qat2-e1-q4 | round12m-qat2-e2-q4 |
|---|---|---|---|---|---|---|
| JSON validity | 1.0% | 100.0% | 99.9% on par | 99.6% on par | 99.8% on par | 99.8% on par |
| Feedback move accuracy | 5.0% | 100.0% | 87.8% below | 84.0% below | 84.8% below | 85.4% below |
| Correction accuracy (due correction, right error) | 5.0% | 100.0% | 76.3% below | 72.6% below | 74.1% below | 73.8% below |
| Over-correction (corrected a correct turn) | 3.0% | 0.0% | 6.7% below | 9.5% below | 8.8% below | 8.5% below |
| Prompts that give the answer away | 3.0% | 0.0% | 1.0% on par | 1.0% on par | 2.0% on par | 2.4% on par |
| Recast correctness | 5.0% | 99.0% | 68.6% below | 63.4% below | 61.9% below | 62.4% below |
| LanguageTool errors / 100 words | 0.30 | 0.00 | 0.00 on par | 0.00 on par | 0.00 on par | 0.00 on par |
| Tokens outside the level band | 2.0% | 2.0% | 1.9% on par | 2.1% on par | 2.0% on par | 2.3% on par |
| Italian-only replies | 2.0% | 100.0% | 100.0% on par | 100.0% on par | 99.9% on par | 99.9% on par |

- m12-k04: 5/9 on par
- round12m-qat-q4: 5/9 on par
- round12m-qat2-e1-q4: 5/9 on par
- round12m-qat2-e2-q4: 5/9 on par

## Automatic metrics

| Metric | teacher-reference | m12-k04 | round12m-qat-q4 | round12m-qat2-e1-q4 | round12m-qat2-e2-q4 |
|---|---|---|---|---|---|
| JSON validity (higher is better) | **100.0%** | 99.9% | 99.6% | 99.8% | 99.8% |
| LanguageTool errors / 100 words (lower is better) | **0.00** | **0.00** | **0.00** | **0.00** | **0.00** |
| Replies with a LanguageTool error (lower is better) | **0.0%** | **0.0%** | **0.0%** | **0.0%** | **0.0%** |
| Tokens outside the level band (lower is better) | 2.0% | **1.9%** | 2.1% | 2.0% | 2.3% |
| Replies over the band limit (lower is better) | **0.7%** | 4.9% | 5.3% | 4.6% | 5.9% |
| Replies with an over-long sentence (lower is better) | **0.1%** | 0.5% | 0.9% | 0.9% | 0.5% |
| Italian-only replies (higher is better) | **100.0%** | **100.0%** | **100.0%** | 99.9% | 99.9% |
| Feedback move accuracy (higher is better) | **100.0%** | 87.8% | 84.0% | 84.8% | 85.4% |
| Over-correction (corrected a correct turn) (lower is better) | **0.0%** | 6.7% | 9.5% | 8.8% | 8.5% |
| Under-correction (missed a due correction) (lower is better) | **0.0%** | 13.6% | 13.8% | 14.0% | 14.3% |
| Correction accuracy (due correction, right error) (higher is better) | **100.0%** | 76.3% | 72.6% | 74.1% | 73.8% |
| Prompts that give the answer away (lower is better) | **0.0%** | 1.0% | 1.0% | 2.0% | 2.4% |
| Recast correctness (higher is better) | **99.0%** | 68.6% | 63.4% | 61.9% | 62.4% |
| Error-tag F1 (micro) (higher is better) | **1.00** | 0.77 | 0.73 | 0.75 | 0.75 |
| Error-tag F1 (macro) (higher is better) | **1.00** | 0.74 | 0.70 | 0.72 | 0.72 |
| Annotation consistency (higher is better) | **100.0%** | 99.1% | 99.0% | 99.4% | 99.6% |

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
| m12-k04 | B2 | 136 | 99.3% | 88.9% | 1.7% |
| m12-k04 | C1 | 141 | 100.0% | 85.8% | 2.4% |
| m12-k04 | C2 | 136 | 100.0% | 78.7% | 1.8% |
| round12m-qat-q4 | A1 | 134 | 100.0% | 93.3% | 2.4% |
| round12m-qat-q4 | A2 | 122 | 99.2% | 87.6% | 1.4% |
| round12m-qat-q4 | B1 | 132 | 100.0% | 85.6% | 1.5% |
| round12m-qat-q4 | B2 | 136 | 100.0% | 86.8% | 2.7% |
| round12m-qat-q4 | C1 | 141 | 100.0% | 78.0% | 2.3% |
| round12m-qat-q4 | C2 | 136 | 98.5% | 75.4% | 2.1% |
| round12m-qat2-e1-q4 | A1 | 134 | 100.0% | 93.3% | 1.7% |
| round12m-qat2-e1-q4 | A2 | 122 | 100.0% | 86.1% | 0.9% |
| round12m-qat2-e1-q4 | B1 | 132 | 100.0% | 85.6% | 2.2% |
| round12m-qat2-e1-q4 | B2 | 136 | 99.3% | 86.7% | 1.8% |
| round12m-qat2-e1-q4 | C1 | 141 | 100.0% | 80.9% | 2.3% |
| round12m-qat2-e1-q4 | C2 | 136 | 99.3% | 77.8% | 2.2% |
| round12m-qat2-e2-q4 | A1 | 134 | 100.0% | 93.3% | 2.1% |
| round12m-qat2-e2-q4 | A2 | 122 | 100.0% | 86.9% | 1.1% |
| round12m-qat2-e2-q4 | B1 | 132 | 100.0% | 86.4% | 2.0% |
| round12m-qat2-e2-q4 | B2 | 136 | 100.0% | 86.0% | 2.4% |
| round12m-qat2-e2-q4 | C1 | 141 | 100.0% | 85.8% | 2.8% |
| round12m-qat2-e2-q4 | C2 | 136 | 98.5% | 75.4% | 2.3% |

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
| none | 362 | 17 | 8 | 1 |
| prompt | 28 | 186 | 5 | 0 |
| recast | 28 | 11 | 155 | 0 |

**round12m-qat-q4**

| gold \ predicted | none | prompt | recast | invalid |
|---|---|---|---|---|
| none | 351 | 25 | 10 | 2 |
| prompt | 31 | 181 | 7 | 0 |
| recast | 26 | 26 | 141 | 1 |

**round12m-qat2-e1-q4**

| gold \ predicted | none | prompt | recast | invalid |
|---|---|---|---|---|
| none | 354 | 24 | 10 | 0 |
| prompt | 28 | 184 | 7 | 0 |
| recast | 30 | 21 | 141 | 2 |

**round12m-qat2-e2-q4**

| gold \ predicted | none | prompt | recast | invalid |
|---|---|---|---|---|
| none | 355 | 23 | 9 | 1 |
| prompt | 30 | 185 | 4 | 0 |
| recast | 29 | 20 | 144 | 1 |

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
