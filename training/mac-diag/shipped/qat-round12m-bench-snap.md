# Tutor model evaluation

Held-out items: 801 tutor turns from evaluation-only scenarios.

## Parity with the reference (teacher-reference)

A system is on par on a metric when it is no worse than the reference by more than the
tolerance; on the judge when its win rate against the reference is at least 45.0%.

| Metric | Tolerance | teacher-reference | m12-k04 | round12m-qat | round12m-qat-q4 | round12m-qat-q4i |
|---|---|---|---|---|---|---|
| JSON validity | 1.0% | 100.0% | 100.0% on par | 100.0% on par | 99.9% on par | 100.0% on par |
| Feedback move accuracy | 5.0% | 100.0% | 87.9% below | 87.9% below | 84.1% below | 83.4% below |
| Correction accuracy (due correction, right error) | 5.0% | 100.0% | 76.3% below | 79.7% below | 72.6% below | 70.2% below |
| Over-correction (corrected a correct turn) | 3.0% | 0.0% | 6.2% below | 9.8% below | 9.0% below | 6.2% below |
| Prompts that give the answer away | 3.0% | 0.0% | 1.0% on par | 2.1% on par | 1.0% on par | 4.0% below |
| Recast correctness | 5.0% | 99.0% | 68.6% below | 72.2% below | 63.4% below | 56.7% below |
| LanguageTool errors / 100 words | 0.30 | 0.00 | 0.00 on par | 0.00 on par | 0.00 on par | 0.00 on par |
| Tokens outside the level band | 2.0% | 2.0% | 1.9% on par | 1.7% on par | 2.1% on par | 2.6% on par |
| Italian-only replies | 2.0% | 100.0% | 100.0% on par | 99.9% on par | 100.0% on par | 99.9% on par |

- m12-k04: 5/9 on par
- round12m-qat: 5/9 on par
- round12m-qat-q4: 5/9 on par
- round12m-qat-q4i: 4/9 on par

## Automatic metrics

| Metric | teacher-reference | m12-k04 | round12m-qat | round12m-qat-q4 | round12m-qat-q4i |
|---|---|---|---|---|---|
| JSON validity (higher is better) | **100.0%** | **100.0%** | **100.0%** | 99.9% | **100.0%** |
| LanguageTool errors / 100 words (lower is better) | **0.00** | **0.00** | **0.00** | **0.00** | **0.00** |
| Replies with a LanguageTool error (lower is better) | **0.0%** | **0.0%** | **0.0%** | **0.0%** | **0.0%** |
| Tokens outside the level band (lower is better) | 2.0% | 1.9% | **1.7%** | 2.1% | 2.6% |
| Replies over the band limit (lower is better) | **0.7%** | 4.9% | 4.5% | 5.2% | 6.9% |
| Replies with an over-long sentence (lower is better) | **0.1%** | 0.5% | 2.7% | 0.9% | 1.1% |
| Italian-only replies (higher is better) | **100.0%** | **100.0%** | 99.9% | **100.0%** | 99.9% |
| Feedback move accuracy (higher is better) | **100.0%** | 87.9% | 87.9% | 84.1% | 83.4% |
| Over-correction (corrected a correct turn) (lower is better) | **0.0%** | 6.2% | 9.8% | 9.0% | 6.2% |
| Under-correction (missed a due correction) (lower is better) | **0.0%** | 13.8% | 8.7% | 14.3% | 18.9% |
| Correction accuracy (due correction, right error) (higher is better) | **100.0%** | 76.3% | 79.7% | 72.6% | 70.2% |
| Prompts that give the answer away (lower is better) | **0.0%** | 1.0% | 2.1% | 1.0% | 4.0% |
| Recast correctness (higher is better) | **99.0%** | 68.6% | 72.2% | 63.4% | 56.7% |
| Error-tag F1 (micro) (higher is better) | **1.00** | 0.77 | 0.78 | 0.73 | 0.73 |
| Error-tag F1 (macro) (higher is better) | **1.00** | 0.74 | 0.74 | 0.70 | 0.72 |
| Annotation consistency (higher is better) | **100.0%** | 99.6% | 99.6% | 99.5% | 99.6% |

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
| round12m-qat | A1 | 134 | 100.0% | 96.3% | 3.3% |
| round12m-qat | A2 | 122 | 100.0% | 90.2% | 0.7% |
| round12m-qat | B1 | 132 | 100.0% | 84.1% | 1.8% |
| round12m-qat | B2 | 136 | 100.0% | 88.2% | 1.0% |
| round12m-qat | C1 | 141 | 100.0% | 88.7% | 2.0% |
| round12m-qat | C2 | 136 | 100.0% | 80.1% | 1.8% |
| round12m-qat-q4 | A1 | 134 | 100.0% | 93.3% | 2.4% |
| round12m-qat-q4 | A2 | 122 | 99.2% | 87.6% | 1.4% |
| round12m-qat-q4 | B1 | 132 | 100.0% | 85.6% | 1.5% |
| round12m-qat-q4 | B2 | 136 | 100.0% | 86.8% | 2.7% |
| round12m-qat-q4 | C1 | 141 | 100.0% | 78.7% | 2.3% |
| round12m-qat-q4 | C2 | 136 | 100.0% | 74.3% | 2.1% |
| round12m-qat-q4i | A1 | 134 | 100.0% | 92.5% | 2.6% |
| round12m-qat-q4i | A2 | 122 | 100.0% | 87.7% | 3.1% |
| round12m-qat-q4i | B1 | 132 | 100.0% | 81.8% | 2.2% |
| round12m-qat-q4i | B2 | 136 | 100.0% | 83.8% | 2.8% |
| round12m-qat-q4i | C1 | 141 | 100.0% | 80.9% | 2.6% |
| round12m-qat-q4i | C2 | 136 | 100.0% | 74.3% | 2.5% |

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

**round12m-qat**

| gold \ predicted | none | prompt | recast | invalid |
|---|---|---|---|---|
| none | 350 | 21 | 17 | 0 |
| prompt | 24 | 182 | 13 | 0 |
| recast | 12 | 10 | 172 | 0 |

**round12m-qat-q4**

| gold \ predicted | none | prompt | recast | invalid |
|---|---|---|---|---|
| none | 353 | 25 | 9 | 1 |
| prompt | 32 | 180 | 7 | 0 |
| recast | 27 | 26 | 141 | 0 |

**round12m-qat-q4i**

| gold \ predicted | none | prompt | recast | invalid |
|---|---|---|---|---|
| none | 364 | 21 | 3 | 0 |
| prompt | 37 | 176 | 6 | 0 |
| recast | 41 | 25 | 128 | 0 |

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
