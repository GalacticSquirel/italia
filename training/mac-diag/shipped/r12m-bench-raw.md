# Tutor model evaluation

Held-out items: 801 tutor turns from evaluation-only scenarios.

## Parity with the reference (teacher-reference)

A system is on par on a metric when it is no worse than the reference by more than the
tolerance; on the judge when its win rate against the reference is at least 45.0%.

| Metric | Tolerance | teacher-reference | m10-k04 | round11-dpo | round12-dpo | m12-k03 | m12-k04 | m12-k05 |
|---|---|---|---|---|---|---|---|---|
| JSON validity | 1.0% | 100.0% | 99.8% on par | 99.6% on par | 99.8% on par | 99.8% on par | 99.9% on par | 99.8% on par |
| Feedback move accuracy | 5.0% | 100.0% | 87.1% below | 87.1% below | 87.6% below | 87.8% below | 87.8% below | 87.6% below |
| Correction accuracy (due correction, right error) | 5.0% | 100.0% | 76.3% below | 79.2% below | 75.3% below | 75.5% below | 76.3% below | 77.2% below |
| Over-correction (corrected a correct turn) | 3.0% | 0.0% | 7.5% below | 10.3% below | 5.7% below | 5.9% below | 6.7% below | 7.5% below |
| Prompts that give the answer away | 3.0% | 0.0% | 0.5% on par | 0.5% on par | 0.0% on par | 0.5% on par | 1.0% on par | 1.0% on par |
| Recast correctness | 5.0% | 99.0% | 69.1% below | 71.1% below | 67.5% below | 67.5% below | 68.6% below | 70.6% below |
| LanguageTool errors / 100 words | 0.30 | 0.00 | 0.00 on par | 0.00 on par | 0.00 on par | 0.00 on par | 0.00 on par | 0.00 on par |
| Tokens outside the level band | 2.0% | 2.0% | 2.1% on par | 2.1% on par | 1.7% on par | 1.8% on par | 1.9% on par | 2.0% on par |
| Italian-only replies | 2.0% | 100.0% | 99.9% on par | 100.0% on par | 99.9% on par | 100.0% on par | 100.0% on par | 100.0% on par |

- m10-k04: 5/9 on par
- round11-dpo: 5/9 on par
- round12-dpo: 5/9 on par
- m12-k03: 5/9 on par
- m12-k04: 5/9 on par
- m12-k05: 5/9 on par

## Automatic metrics

| Metric | teacher-reference | m10-k04 | round11-dpo | round12-dpo | m12-k03 | m12-k04 | m12-k05 |
|---|---|---|---|---|---|---|---|
| JSON validity (higher is better) | **100.0%** | 99.8% | 99.6% | 99.8% | 99.8% | 99.9% | 99.8% |
| LanguageTool errors / 100 words (lower is better) | **0.00** | **0.00** | **0.00** | **0.00** | **0.00** | **0.00** | **0.00** |
| Replies with a LanguageTool error (lower is better) | **0.0%** | **0.0%** | **0.0%** | **0.0%** | **0.0%** | **0.0%** | **0.0%** |
| Tokens outside the level band (lower is better) | 2.0% | 2.1% | 2.1% | **1.7%** | 1.8% | 1.9% | 2.0% |
| Replies over the band limit (lower is better) | **0.7%** | 4.0% | 5.0% | 4.5% | 4.8% | 4.9% | 4.4% |
| Replies with an over-long sentence (lower is better) | **0.1%** | 0.8% | 0.6% | 0.6% | 0.6% | 0.5% | 0.6% |
| Italian-only replies (higher is better) | **100.0%** | 99.9% | **100.0%** | 99.9% | **100.0%** | **100.0%** | **100.0%** |
| Feedback move accuracy (higher is better) | **100.0%** | 87.1% | 87.1% | 87.6% | 87.8% | 87.8% | 87.6% |
| Over-correction (corrected a correct turn) (lower is better) | **0.0%** | 7.5% | 10.3% | 5.7% | 5.9% | 6.7% | 7.5% |
| Under-correction (missed a due correction) (lower is better) | **0.0%** | 12.6% | 9.0% | 15.0% | 14.3% | 13.6% | 12.3% |
| Correction accuracy (due correction, right error) (higher is better) | **100.0%** | 76.3% | 79.2% | 75.3% | 75.5% | 76.3% | 77.2% |
| Prompts that give the answer away (lower is better) | **0.0%** | 0.5% | 0.5% | **0.0%** | 0.5% | 1.0% | 1.0% |
| Recast correctness (higher is better) | **99.0%** | 69.1% | 71.1% | 67.5% | 67.5% | 68.6% | 70.6% |
| Error-tag F1 (micro) (higher is better) | **1.00** | 0.77 | 0.77 | 0.77 | 0.77 | 0.77 | 0.78 |
| Error-tag F1 (macro) (higher is better) | **1.00** | 0.73 | 0.73 | 0.75 | 0.74 | 0.74 | 0.75 |
| Annotation consistency (higher is better) | **100.0%** | 98.6% | 99.0% | 99.2% | 99.2% | 99.1% | 99.1% |

## By level

| System | Level | Items | JSON valid | Move accuracy | Tokens outside band |
|---|---|---|---|---|---|
| teacher-reference | A1 | 134 | 100.0% | 100.0% | 0.0% |
| teacher-reference | A2 | 122 | 100.0% | 100.0% | 0.0% |
| teacher-reference | B1 | 132 | 100.0% | 100.0% | 0.0% |
| teacher-reference | B2 | 136 | 100.0% | 100.0% | 1.4% |
| teacher-reference | C1 | 141 | 100.0% | 100.0% | 2.4% |
| teacher-reference | C2 | 136 | 100.0% | 100.0% | 3.6% |
| m10-k04 | A1 | 134 | 100.0% | 96.3% | 2.0% |
| m10-k04 | A2 | 122 | 99.2% | 93.4% | 0.9% |
| m10-k04 | B1 | 132 | 100.0% | 85.6% | 1.2% |
| m10-k04 | B2 | 136 | 99.3% | 87.4% | 1.8% |
| m10-k04 | C1 | 141 | 100.0% | 85.1% | 2.8% |
| m10-k04 | C2 | 136 | 100.0% | 77.2% | 2.7% |
| round11-dpo | A1 | 134 | 100.0% | 97.0% | 2.9% |
| round11-dpo | A2 | 122 | 99.2% | 92.6% | 1.1% |
| round11-dpo | B1 | 132 | 100.0% | 86.4% | 1.7% |
| round11-dpo | B2 | 136 | 99.3% | 88.1% | 1.4% |
| round11-dpo | C1 | 141 | 100.0% | 83.0% | 2.7% |
| round11-dpo | C2 | 136 | 99.3% | 78.5% | 2.4% |
| round12-dpo | A1 | 134 | 100.0% | 96.3% | 2.2% |
| round12-dpo | A2 | 122 | 99.2% | 91.7% | 0.6% |
| round12-dpo | B1 | 132 | 100.0% | 86.4% | 1.7% |
| round12-dpo | B2 | 136 | 99.3% | 88.1% | 1.5% |
| round12-dpo | C1 | 141 | 100.0% | 85.8% | 2.2% |
| round12-dpo | C2 | 136 | 100.0% | 79.4% | 1.8% |
| m12-k03 | A1 | 134 | 100.0% | 96.3% | 2.8% |
| m12-k03 | A2 | 122 | 99.2% | 92.6% | 0.9% |
| m12-k03 | B1 | 132 | 100.0% | 86.4% | 1.5% |
| m12-k03 | B2 | 136 | 99.3% | 88.1% | 1.5% |
| m12-k03 | C1 | 141 | 100.0% | 86.5% | 2.4% |
| m12-k03 | C2 | 136 | 100.0% | 78.7% | 1.8% |
| m12-k04 | A1 | 134 | 100.0% | 96.3% | 2.5% |
| m12-k04 | A2 | 122 | 100.0% | 92.6% | 0.8% |
| m12-k04 | B1 | 132 | 100.0% | 85.6% | 1.8% |
| m12-k04 | B2 | 136 | 99.3% | 88.9% | 1.7% |
| m12-k04 | C1 | 141 | 100.0% | 85.8% | 2.4% |
| m12-k04 | C2 | 136 | 100.0% | 78.7% | 1.8% |
| m12-k05 | A1 | 134 | 100.0% | 97.0% | 2.2% |
| m12-k05 | A2 | 122 | 100.0% | 93.4% | 0.9% |
| m12-k05 | B1 | 132 | 100.0% | 85.6% | 1.5% |
| m12-k05 | B2 | 136 | 99.3% | 88.1% | 1.5% |
| m12-k05 | C1 | 141 | 100.0% | 86.5% | 2.6% |
| m12-k05 | C2 | 136 | 99.3% | 77.0% | 2.1% |

## Feedback moves (rows: gold, columns: predicted)

**teacher-reference**

| gold \ predicted | none | prompt | recast | invalid |
|---|---|---|---|---|
| none | 388 | 0 | 0 | 0 |
| prompt | 0 | 219 | 0 | 0 |
| recast | 0 | 0 | 194 | 0 |

**m10-k04**

| gold \ predicted | none | prompt | recast | invalid |
|---|---|---|---|---|
| none | 359 | 17 | 12 | 0 |
| prompt | 29 | 183 | 7 | 0 |
| recast | 23 | 13 | 156 | 2 |

**round11-dpo**

| gold \ predicted | none | prompt | recast | invalid |
|---|---|---|---|---|
| none | 348 | 25 | 13 | 2 |
| prompt | 22 | 187 | 10 | 0 |
| recast | 15 | 15 | 163 | 1 |

**round12-dpo**

| gold \ predicted | none | prompt | recast | invalid |
|---|---|---|---|---|
| none | 366 | 16 | 5 | 1 |
| prompt | 33 | 181 | 5 | 0 |
| recast | 29 | 9 | 155 | 1 |

**m12-k03**

| gold \ predicted | none | prompt | recast | invalid |
|---|---|---|---|---|
| none | 365 | 15 | 7 | 1 |
| prompt | 29 | 184 | 6 | 0 |
| recast | 30 | 9 | 154 | 1 |

**m12-k04**

| gold \ predicted | none | prompt | recast | invalid |
|---|---|---|---|---|
| none | 362 | 17 | 8 | 1 |
| prompt | 28 | 186 | 5 | 0 |
| recast | 28 | 11 | 155 | 0 |

**m12-k05**

| gold \ predicted | none | prompt | recast | invalid |
|---|---|---|---|---|
| none | 359 | 18 | 9 | 2 |
| prompt | 29 | 184 | 6 | 0 |
| recast | 22 | 13 | 159 | 0 |

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
