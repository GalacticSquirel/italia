# Tutor model evaluation

Held-out items: 801 tutor turns from evaluation-only scenarios.

## Parity with the reference (teacher-reference)

A system is on par on a metric when it is no worse than the reference by more than the
tolerance; on the judge when its win rate against the reference is at least 45.0%.

| Metric | Tolerance | teacher-reference | m12-k04 | round12m-q4-rb0 | round12m-q4km-rb0 | round12m-q5km-rb0 | round12m-q8-rb0 | round12m-bf16-raw |
|---|---|---|---|---|---|---|---|---|
| JSON validity | 1.0% | 100.0% | 99.9% on par | 99.8% on par | 99.1% on par | 98.8% below | 99.1% on par | 99.9% on par |
| Feedback move accuracy | 5.0% | 100.0% | 87.8% below | 82.4% below | 85.1% below | 85.6% below | 87.0% below | 87.4% below |
| Correction accuracy (due correction, right error) | 5.0% | 100.0% | 76.3% below | 64.2% below | 71.2% below | 75.5% below | 77.5% below | 75.8% below |
| Over-correction (corrected a correct turn) | 3.0% | 0.0% | 6.7% below | 3.4% below | 6.4% below | 9.0% below | 8.2% below | 6.7% below |
| Prompts that give the answer away | 3.0% | 0.0% | 1.0% on par | 3.6% below | 2.0% on par | 1.0% on par | 1.5% on par | 0.5% on par |
| Recast correctness | 5.0% | 99.0% | 68.6% below | 52.6% below | 61.9% below | 64.9% below | 67.0% below | 67.5% below |
| LanguageTool errors / 100 words | 0.30 | 0.00 | 0.00 on par | 0.00 on par | 0.00 on par | 0.00 on par | 0.00 on par | 0.00 on par |
| Tokens outside the level band | 2.0% | 2.0% | 1.9% on par | 3.4% on par | 2.0% on par | 1.6% on par | 1.7% on par | 1.9% on par |
| Italian-only replies | 2.0% | 100.0% | 100.0% on par | 100.0% on par | 100.0% on par | 100.0% on par | 100.0% on par | 100.0% on par |

- m12-k04: 5/9 on par
- round12m-q4-rb0: 4/9 on par
- round12m-q4km-rb0: 5/9 on par
- round12m-q5km-rb0: 4/9 on par
- round12m-q8-rb0: 5/9 on par
- round12m-bf16-raw: 5/9 on par

## Automatic metrics

| Metric | teacher-reference | m12-k04 | round12m-q4-rb0 | round12m-q4km-rb0 | round12m-q5km-rb0 | round12m-q8-rb0 | round12m-bf16-raw |
|---|---|---|---|---|---|---|---|
| JSON validity (higher is better) | **100.0%** | 99.9% | 99.8% | 99.1% | 98.8% | 99.1% | 99.9% |
| LanguageTool errors / 100 words (lower is better) | **0.00** | **0.00** | **0.00** | **0.00** | **0.00** | **0.00** | **0.00** |
| Replies with a LanguageTool error (lower is better) | **0.0%** | **0.0%** | **0.0%** | **0.0%** | **0.0%** | **0.0%** | **0.0%** |
| Tokens outside the level band (lower is better) | 2.0% | 1.9% | 3.4% | 2.0% | **1.6%** | 1.7% | 1.9% |
| Replies over the band limit (lower is better) | **0.7%** | 4.9% | 8.5% | 4.5% | 3.3% | 3.3% | 4.2% |
| Replies with an over-long sentence (lower is better) | **0.1%** | 0.5% | 1.0% | 1.4% | 0.8% | 0.5% | 0.5% |
| Italian-only replies (higher is better) | **100.0%** | **100.0%** | **100.0%** | **100.0%** | **100.0%** | **100.0%** | **100.0%** |
| Feedback move accuracy (higher is better) | **100.0%** | 87.8% | 82.4% | 85.1% | 85.6% | 87.0% | 87.4% |
| Over-correction (corrected a correct turn) (lower is better) | **0.0%** | 6.7% | 3.4% | 6.4% | 9.0% | 8.2% | 6.7% |
| Under-correction (missed a due correction) (lower is better) | **0.0%** | 13.6% | 24.9% | 16.0% | 13.1% | 12.3% | 14.5% |
| Correction accuracy (due correction, right error) (higher is better) | **100.0%** | 76.3% | 64.2% | 71.2% | 75.5% | 77.5% | 75.8% |
| Prompts that give the answer away (lower is better) | **0.0%** | 1.0% | 3.6% | 2.0% | 1.0% | 1.5% | 0.5% |
| Recast correctness (higher is better) | **99.0%** | 68.6% | 52.6% | 61.9% | 64.9% | 67.0% | 67.5% |
| Error-tag F1 (micro) (higher is better) | **1.00** | 0.77 | 0.71 | 0.74 | 0.77 | 0.78 | 0.77 |
| Error-tag F1 (macro) (higher is better) | **1.00** | 0.74 | 0.69 | 0.71 | 0.72 | 0.73 | 0.76 |
| Annotation consistency (higher is better) | **100.0%** | 99.1% | 99.5% | 99.4% | 99.7% | 99.5% | 99.2% |

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
| round12m-q4-rb0 | A1 | 134 | 100.0% | 92.5% | 3.6% |
| round12m-q4-rb0 | A2 | 122 | 100.0% | 87.7% | 3.2% |
| round12m-q4-rb0 | B1 | 132 | 99.2% | 77.1% | 3.4% |
| round12m-q4-rb0 | B2 | 136 | 100.0% | 83.8% | 3.7% |
| round12m-q4-rb0 | C1 | 141 | 100.0% | 80.9% | 3.8% |
| round12m-q4-rb0 | C2 | 136 | 99.3% | 74.1% | 2.8% |
| round12m-q4km-rb0 | A1 | 134 | 100.0% | 94.0% | 1.7% |
| round12m-q4km-rb0 | A2 | 122 | 97.5% | 89.9% | 0.5% |
| round12m-q4km-rb0 | B1 | 132 | 98.5% | 84.6% | 1.6% |
| round12m-q4km-rb0 | B2 | 136 | 99.3% | 87.4% | 2.4% |
| round12m-q4km-rb0 | C1 | 141 | 100.0% | 83.7% | 2.3% |
| round12m-q4km-rb0 | C2 | 136 | 99.3% | 76.3% | 2.2% |
| round12m-q5km-rb0 | A1 | 134 | 100.0% | 95.5% | 1.8% |
| round12m-q5km-rb0 | A2 | 122 | 97.5% | 89.1% | 0.5% |
| round12m-q5km-rb0 | B1 | 132 | 97.7% | 84.5% | 1.0% |
| round12m-q5km-rb0 | B2 | 136 | 98.5% | 88.1% | 1.7% |
| round12m-q5km-rb0 | C1 | 141 | 100.0% | 86.5% | 2.2% |
| round12m-q5km-rb0 | C2 | 136 | 98.5% | 76.9% | 1.8% |
| round12m-q8-rb0 | A1 | 134 | 100.0% | 95.5% | 2.3% |
| round12m-q8-rb0 | A2 | 122 | 98.4% | 90.8% | 0.4% |
| round12m-q8-rb0 | B1 | 132 | 100.0% | 84.8% | 1.1% |
| round12m-q8-rb0 | B2 | 136 | 98.5% | 88.8% | 1.4% |
| round12m-q8-rb0 | C1 | 141 | 100.0% | 88.7% | 2.2% |
| round12m-q8-rb0 | C2 | 136 | 97.8% | 78.2% | 1.9% |
| round12m-bf16-raw | A1 | 134 | 100.0% | 96.3% | 2.3% |
| round12m-bf16-raw | A2 | 122 | 99.2% | 92.6% | 0.6% |
| round12m-bf16-raw | B1 | 132 | 100.0% | 84.1% | 1.3% |
| round12m-bf16-raw | B2 | 136 | 100.0% | 87.5% | 1.9% |
| round12m-bf16-raw | C1 | 141 | 100.0% | 85.8% | 2.6% |
| round12m-bf16-raw | C2 | 136 | 100.0% | 79.4% | 1.8% |

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

**round12m-q4-rb0**

| gold \ predicted | none | prompt | recast | invalid |
|---|---|---|---|---|
| none | 375 | 12 | 0 | 1 |
| prompt | 47 | 172 | 0 | 0 |
| recast | 56 | 24 | 113 | 1 |

**round12m-q4km-rb0**

| gold \ predicted | none | prompt | recast | invalid |
|---|---|---|---|---|
| none | 363 | 15 | 7 | 3 |
| prompt | 33 | 183 | 3 | 0 |
| recast | 33 | 21 | 136 | 4 |

**round12m-q5km-rb0**

| gold \ predicted | none | prompt | recast | invalid |
|---|---|---|---|---|
| none | 353 | 21 | 7 | 7 |
| prompt | 27 | 186 | 6 | 0 |
| recast | 27 | 17 | 147 | 3 |

**round12m-q8-rb0**

| gold \ predicted | none | prompt | recast | invalid |
|---|---|---|---|---|
| none | 356 | 19 | 9 | 4 |
| prompt | 27 | 188 | 4 | 0 |
| recast | 24 | 14 | 153 | 3 |

**round12m-bf16-raw**

| gold \ predicted | none | prompt | recast | invalid |
|---|---|---|---|---|
| none | 362 | 16 | 10 | 0 |
| prompt | 31 | 184 | 4 | 0 |
| recast | 29 | 10 | 154 | 1 |

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
