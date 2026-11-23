# Tutor model evaluation

Held-out items: 801 tutor turns from evaluation-only scenarios.

## Parity with the reference (teacher-reference)

A system is on par on a metric when it is no worse than the reference by more than the
tolerance; on the judge when its win rate against the reference is at least 45.0%.

| Metric | Tolerance | teacher-reference | round8-sft | round9c-dpo | m-a04-b07 | m-a04-b10 | m-a05-b07 | m-a05-b10 | m-a06-b07 | m-a06-b10 | m-a07-b07 | m-a07-b10 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| JSON validity | 1.0% | 100.0% | 100.0% on par | 100.0% on par | 100.0% on par | 100.0% on par | 100.0% on par | 100.0% on par | 100.0% on par | 100.0% on par | 100.0% on par | 100.0% on par |
| Feedback move accuracy | 5.0% | 100.0% | 85.3% below | 85.3% below | 85.8% below | 85.8% below | 86.6% below | 86.8% below | 86.0% below | 85.8% below | 85.6% below | 85.8% below |
| Correction accuracy (due correction, right error) | 5.0% | 100.0% | 74.8% below | 75.5% below | 74.6% below | 74.1% below | 74.8% below | 74.3% below | 71.4% below | 71.2% below | 70.9% below | 71.9% below |
| Over-correction (corrected a correct turn) | 3.0% | 0.0% | 10.3% below | 11.3% below | 9.3% below | 9.0% below | 7.5% below | 7.2% below | 5.2% below | 5.2% below | 5.2% below | 5.4% below |
| Prompts that give the answer away | 3.0% | 0.0% | 1.0% on par | 0.5% on par | 0.5% on par | 0.5% on par | 1.0% on par | 0.5% on par | 0.6% on par | 1.1% on par | 1.1% on par | 0.6% on par |
| Recast correctness | 5.0% | 99.0% | 65.5% below | 67.0% below | 67.0% below | 67.5% below | 67.0% below | 68.0% below | 66.0% below | 65.5% below | 65.5% below | 67.5% below |
| LanguageTool errors / 100 words | 0.30 | 0.00 | 0.00 on par | 0.00 on par | 0.00 on par | 0.00 on par | 0.00 on par | 0.00 on par | 0.00 on par | 0.00 on par | 0.00 on par | 0.00 on par |
| Tokens outside the level band | 2.0% | 2.0% | 1.9% on par | 1.9% on par | 1.9% on par | 1.8% on par | 1.9% on par | 2.0% on par | 1.9% on par | 1.9% on par | 2.0% on par | 2.1% on par |
| Italian-only replies | 2.0% | 100.0% | 100.0% on par | 99.9% on par | 99.9% on par | 99.9% on par | 99.9% on par | 99.9% on par | 99.9% on par | 99.9% on par | 99.9% on par | 99.9% on par |

- round8-sft: 5/9 on par
- round9c-dpo: 5/9 on par
- m-a04-b07: 5/9 on par
- m-a04-b10: 5/9 on par
- m-a05-b07: 5/9 on par
- m-a05-b10: 5/9 on par
- m-a06-b07: 5/9 on par
- m-a06-b10: 5/9 on par
- m-a07-b07: 5/9 on par
- m-a07-b10: 5/9 on par

## Automatic metrics

| Metric | teacher-reference | round8-sft | round9c-dpo | m-a04-b07 | m-a04-b10 | m-a05-b07 | m-a05-b10 | m-a06-b07 | m-a06-b10 | m-a07-b07 | m-a07-b10 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| JSON validity (higher is better) | **100.0%** | **100.0%** | **100.0%** | **100.0%** | **100.0%** | **100.0%** | **100.0%** | **100.0%** | **100.0%** | **100.0%** | **100.0%** |
| LanguageTool errors / 100 words (lower is better) | **0.00** | **0.00** | **0.00** | **0.00** | **0.00** | **0.00** | **0.00** | **0.00** | **0.00** | **0.00** | **0.00** |
| Replies with a LanguageTool error (lower is better) | **0.0%** | **0.0%** | **0.0%** | **0.0%** | **0.0%** | **0.0%** | **0.0%** | **0.0%** | **0.0%** | **0.0%** | **0.0%** |
| Tokens outside the level band (lower is better) | 2.0% | 1.9% | 1.9% | 1.9% | **1.8%** | 1.9% | 2.0% | 1.9% | 1.9% | 2.0% | 2.1% |
| Replies over the band limit (lower is better) | **0.7%** | 4.2% | 4.5% | 4.2% | 3.7% | 4.0% | 4.2% | 4.5% | 4.5% | 4.4% | 4.6% |
| Replies with an over-long sentence (lower is better) | **0.1%** | 0.7% | 0.5% | 0.7% | 0.7% | 0.7% | 0.6% | 0.9% | 1.1% | 1.0% | 1.0% |
| Italian-only replies (higher is better) | **100.0%** | **100.0%** | 99.9% | 99.9% | 99.9% | 99.9% | 99.9% | 99.9% | 99.9% | 99.9% | 99.9% |
| Feedback move accuracy (higher is better) | **100.0%** | 85.3% | 85.3% | 85.8% | 85.8% | 86.6% | 86.8% | 86.0% | 85.8% | 85.6% | 85.8% |
| Over-correction (corrected a correct turn) (lower is better) | **0.0%** | 10.3% | 11.3% | 9.3% | 9.0% | 7.5% | 7.2% | 5.2% | 5.2% | 5.2% | 5.4% |
| Under-correction (missed a due correction) (lower is better) | **0.0%** | 13.1% | 11.4% | 13.1% | 12.6% | 14.0% | 14.3% | 17.9% | 18.2% | 18.2% | 17.7% |
| Correction accuracy (due correction, right error) (higher is better) | **100.0%** | 74.8% | 75.5% | 74.6% | 74.1% | 74.8% | 74.3% | 71.4% | 71.2% | 70.9% | 71.9% |
| Prompts that give the answer away (lower is better) | **0.0%** | 1.0% | 0.5% | 0.5% | 0.5% | 1.0% | 0.5% | 0.6% | 1.1% | 1.1% | 0.6% |
| Recast correctness (higher is better) | **99.0%** | 65.5% | 67.0% | 67.0% | 67.5% | 67.0% | 68.0% | 66.0% | 65.5% | 65.5% | 67.5% |
| Error-tag F1 (micro) (higher is better) | **1.00** | 0.74 | 0.74 | 0.75 | 0.74 | 0.76 | 0.75 | 0.75 | 0.74 | 0.74 | 0.75 |
| Error-tag F1 (macro) (higher is better) | **1.00** | 0.69 | 0.70 | 0.70 | 0.70 | 0.72 | 0.71 | 0.70 | 0.70 | 0.70 | 0.71 |
| Annotation consistency (higher is better) | **100.0%** | 99.8% | 99.8% | 99.6% | 99.5% | 99.1% | 99.1% | 99.5% | 99.4% | 99.3% | 99.4% |

## By level

| System | Level | Items | JSON valid | Move accuracy | Tokens outside band |
|---|---|---|---|---|---|
| teacher-reference | A1 | 134 | 100.0% | 100.0% | 0.0% |
| teacher-reference | A2 | 122 | 100.0% | 100.0% | 0.0% |
| teacher-reference | B1 | 132 | 100.0% | 100.0% | 0.0% |
| teacher-reference | B2 | 136 | 100.0% | 100.0% | 1.4% |
| teacher-reference | C1 | 141 | 100.0% | 100.0% | 2.4% |
| teacher-reference | C2 | 136 | 100.0% | 100.0% | 3.6% |
| round8-sft | A1 | 134 | 100.0% | 96.3% | 3.0% |
| round8-sft | A2 | 122 | 100.0% | 89.3% | 0.5% |
| round8-sft | B1 | 132 | 100.0% | 84.1% | 1.4% |
| round8-sft | B2 | 136 | 100.0% | 85.3% | 2.1% |
| round8-sft | C1 | 141 | 100.0% | 82.3% | 2.0% |
| round8-sft | C2 | 136 | 100.0% | 75.0% | 2.2% |
| round9c-dpo | A1 | 134 | 100.0% | 97.0% | 2.7% |
| round9c-dpo | A2 | 122 | 100.0% | 88.5% | 0.9% |
| round9c-dpo | B1 | 132 | 100.0% | 83.3% | 1.2% |
| round9c-dpo | B2 | 136 | 100.0% | 83.1% | 2.3% |
| round9c-dpo | C1 | 141 | 100.0% | 83.7% | 1.9% |
| round9c-dpo | C2 | 136 | 100.0% | 76.5% | 2.0% |
| m-a04-b07 | A1 | 134 | 100.0% | 96.3% | 2.4% |
| m-a04-b07 | A2 | 122 | 100.0% | 89.3% | 0.9% |
| m-a04-b07 | B1 | 132 | 100.0% | 85.6% | 1.3% |
| m-a04-b07 | B2 | 136 | 100.0% | 85.3% | 1.7% |
| m-a04-b07 | C1 | 141 | 100.0% | 83.0% | 2.6% |
| m-a04-b07 | C2 | 136 | 100.0% | 75.7% | 1.7% |
| m-a04-b10 | A1 | 134 | 100.0% | 96.3% | 2.7% |
| m-a04-b10 | A2 | 122 | 100.0% | 88.5% | 0.9% |
| m-a04-b10 | B1 | 132 | 100.0% | 84.8% | 0.9% |
| m-a04-b10 | B2 | 136 | 100.0% | 86.0% | 1.6% |
| m-a04-b10 | C1 | 141 | 100.0% | 83.0% | 2.6% |
| m-a04-b10 | C2 | 136 | 100.0% | 76.5% | 1.8% |
| m-a05-b07 | A1 | 134 | 100.0% | 96.3% | 2.4% |
| m-a05-b07 | A2 | 122 | 100.0% | 90.2% | 0.4% |
| m-a05-b07 | B1 | 132 | 100.0% | 85.6% | 1.6% |
| m-a05-b07 | B2 | 136 | 100.0% | 86.0% | 1.9% |
| m-a05-b07 | C1 | 141 | 100.0% | 85.1% | 2.0% |
| m-a05-b07 | C2 | 136 | 100.0% | 77.2% | 2.2% |
| m-a05-b10 | A1 | 134 | 100.0% | 96.3% | 1.8% |
| m-a05-b10 | A2 | 122 | 100.0% | 89.3% | 0.9% |
| m-a05-b10 | B1 | 132 | 100.0% | 84.8% | 1.3% |
| m-a05-b10 | B2 | 136 | 100.0% | 87.5% | 1.9% |
| m-a05-b10 | C1 | 141 | 100.0% | 85.8% | 2.4% |
| m-a05-b10 | C2 | 136 | 100.0% | 77.2% | 2.4% |
| m-a06-b07 | A1 | 134 | 100.0% | 96.3% | 2.1% |
| m-a06-b07 | A2 | 122 | 100.0% | 88.5% | 0.9% |
| m-a06-b07 | B1 | 132 | 100.0% | 86.4% | 1.4% |
| m-a06-b07 | B2 | 136 | 100.0% | 88.2% | 2.2% |
| m-a06-b07 | C1 | 141 | 100.0% | 83.7% | 2.3% |
| m-a06-b07 | C2 | 136 | 100.0% | 73.5% | 2.1% |
| m-a06-b10 | A1 | 134 | 100.0% | 96.3% | 2.1% |
| m-a06-b10 | A2 | 122 | 100.0% | 86.1% | 0.9% |
| m-a06-b10 | B1 | 132 | 100.0% | 85.6% | 1.8% |
| m-a06-b10 | B2 | 136 | 100.0% | 89.0% | 1.6% |
| m-a06-b10 | C1 | 141 | 100.0% | 84.4% | 2.2% |
| m-a06-b10 | C2 | 136 | 100.0% | 73.5% | 2.2% |
| m-a07-b07 | A1 | 134 | 100.0% | 95.5% | 1.5% |
| m-a07-b07 | A2 | 122 | 100.0% | 86.9% | 0.9% |
| m-a07-b07 | B1 | 132 | 100.0% | 85.6% | 1.7% |
| m-a07-b07 | B2 | 136 | 100.0% | 87.5% | 2.1% |
| m-a07-b07 | C1 | 141 | 100.0% | 83.7% | 2.2% |
| m-a07-b07 | C2 | 136 | 100.0% | 75.0% | 2.3% |
| m-a07-b10 | A1 | 134 | 100.0% | 95.5% | 1.8% |
| m-a07-b10 | A2 | 122 | 100.0% | 86.9% | 0.9% |
| m-a07-b10 | B1 | 132 | 100.0% | 84.8% | 1.8% |
| m-a07-b10 | B2 | 136 | 100.0% | 89.7% | 2.0% |
| m-a07-b10 | C1 | 141 | 100.0% | 85.1% | 2.4% |
| m-a07-b10 | C2 | 136 | 100.0% | 72.8% | 2.4% |

## Feedback moves (rows: gold, columns: predicted)

**teacher-reference**

| gold \ predicted | none | prompt | recast | invalid |
|---|---|---|---|---|
| none | 388 | 0 | 0 | 0 |
| prompt | 0 | 219 | 0 | 0 |
| recast | 0 | 0 | 194 | 0 |

**round8-sft**

| gold \ predicted | none | prompt | recast | invalid |
|---|---|---|---|---|
| none | 348 | 30 | 10 | 0 |
| prompt | 27 | 186 | 6 | 0 |
| recast | 27 | 18 | 149 | 0 |

**round9c-dpo**

| gold \ predicted | none | prompt | recast | invalid |
|---|---|---|---|---|
| none | 344 | 30 | 14 | 0 |
| prompt | 24 | 187 | 8 | 0 |
| recast | 23 | 19 | 152 | 0 |

**m-a04-b07**

| gold \ predicted | none | prompt | recast | invalid |
|---|---|---|---|---|
| none | 352 | 24 | 12 | 0 |
| prompt | 28 | 183 | 8 | 0 |
| recast | 26 | 16 | 152 | 0 |

**m-a04-b10**

| gold \ predicted | none | prompt | recast | invalid |
|---|---|---|---|---|
| none | 353 | 22 | 13 | 0 |
| prompt | 27 | 182 | 10 | 0 |
| recast | 25 | 17 | 152 | 0 |

**m-a05-b07**

| gold \ predicted | none | prompt | recast | invalid |
|---|---|---|---|---|
| none | 359 | 17 | 12 | 0 |
| prompt | 30 | 181 | 8 | 0 |
| recast | 28 | 12 | 154 | 0 |

**m-a05-b10**

| gold \ predicted | none | prompt | recast | invalid |
|---|---|---|---|---|
| none | 360 | 17 | 11 | 0 |
| prompt | 31 | 180 | 8 | 0 |
| recast | 28 | 11 | 155 | 0 |

**m-a06-b07**

| gold \ predicted | none | prompt | recast | invalid |
|---|---|---|---|---|
| none | 368 | 12 | 8 | 0 |
| prompt | 41 | 170 | 8 | 0 |
| recast | 33 | 10 | 151 | 0 |

**m-a06-b10**

| gold \ predicted | none | prompt | recast | invalid |
|---|---|---|---|---|
| none | 368 | 11 | 9 | 0 |
| prompt | 41 | 170 | 8 | 0 |
| recast | 34 | 11 | 149 | 0 |

**m-a07-b07**

| gold \ predicted | none | prompt | recast | invalid |
|---|---|---|---|---|
| none | 368 | 11 | 9 | 0 |
| prompt | 43 | 168 | 8 | 0 |
| recast | 32 | 12 | 150 | 0 |

**m-a07-b10**

| gold \ predicted | none | prompt | recast | invalid |
|---|---|---|---|---|
| none | 367 | 11 | 10 | 0 |
| prompt | 43 | 168 | 8 | 0 |
| recast | 30 | 12 | 152 | 0 |

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
