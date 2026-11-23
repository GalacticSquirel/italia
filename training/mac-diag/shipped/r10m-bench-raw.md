# Tutor model evaluation

Held-out items: 801 tutor turns from evaluation-only scenarios.

## Parity with the reference (teacher-reference)

A system is on par on a metric when it is no worse than the reference by more than the
tolerance; on the judge when its win rate against the reference is at least 45.0%.

| Metric | Tolerance | teacher-reference | round10-dpo | round10b-dpo | m10-k03 | m10-k04 | m10-k05 | m10-k06 | m10b-g03 | m10b-g05 |
|---|---|---|---|---|---|---|---|---|---|---|
| JSON validity | 1.0% | 100.0% | 99.8% on par | 98.9% below | 99.9% on par | 99.8% on par | 99.6% on par | 99.1% on par | 99.5% on par | 99.3% on par |
| Feedback move accuracy | 5.0% | 100.0% | 86.9% below | 84.6% below | 87.3% below | 87.1% below | 86.9% below | 86.0% below | 85.6% below | 86.5% below |
| Correction accuracy (due correction, right error) | 5.0% | 100.0% | 74.3% below | 78.2% below | 76.8% below | 76.3% below | 78.2% below | 77.7% below | 78.5% below | 78.5% below |
| Over-correction (corrected a correct turn) | 3.0% | 0.0% | 7.2% below | 14.9% below | 8.0% below | 7.5% below | 10.6% below | 12.1% below | 13.1% below | 10.8% below |
| Prompts that give the answer away | 3.0% | 0.0% | 0.5% on par | 1.0% on par | 0.5% on par | 0.5% on par | 1.0% on par | 0.5% on par | 0.5% on par | 0.0% on par |
| Recast correctness | 5.0% | 99.0% | 69.6% below | 69.1% below | 70.6% below | 69.1% below | 69.1% below | 68.6% below | 70.1% below | 69.6% below |
| LanguageTool errors / 100 words | 0.30 | 0.00 | 0.00 on par | 0.00 on par | 0.00 on par | 0.00 on par | 0.00 on par | 0.00 on par | 0.00 on par | 0.00 on par |
| Tokens outside the level band | 2.0% | 2.0% | 1.9% on par | 2.1% on par | 2.1% on par | 2.1% on par | 2.1% on par | 2.1% on par | 2.0% on par | 2.1% on par |
| Italian-only replies | 2.0% | 100.0% | 99.9% on par | 100.0% on par | 99.9% on par | 99.9% on par | 100.0% on par | 100.0% on par | 100.0% on par | 100.0% on par |

- round10-dpo: 5/9 on par
- round10b-dpo: 4/9 on par
- m10-k03: 5/9 on par
- m10-k04: 5/9 on par
- m10-k05: 5/9 on par
- m10-k06: 5/9 on par
- m10b-g03: 5/9 on par
- m10b-g05: 5/9 on par

## Automatic metrics

| Metric | teacher-reference | round10-dpo | round10b-dpo | m10-k03 | m10-k04 | m10-k05 | m10-k06 | m10b-g03 | m10b-g05 |
|---|---|---|---|---|---|---|---|---|---|
| JSON validity (higher is better) | **100.0%** | 99.8% | 98.9% | 99.9% | 99.8% | 99.6% | 99.1% | 99.5% | 99.3% |
| LanguageTool errors / 100 words (lower is better) | **0.00** | **0.00** | **0.00** | **0.00** | **0.00** | **0.00** | **0.00** | **0.00** | **0.00** |
| Replies with a LanguageTool error (lower is better) | **0.0%** | **0.0%** | **0.0%** | **0.0%** | **0.0%** | **0.0%** | **0.0%** | **0.0%** | **0.0%** |
| Tokens outside the level band (lower is better) | 2.0% | **1.9%** | 2.1% | 2.1% | 2.1% | 2.1% | 2.1% | 2.0% | 2.1% |
| Replies over the band limit (lower is better) | **0.7%** | 3.9% | 4.5% | 4.5% | 4.0% | 4.3% | 4.7% | 4.4% | 4.4% |
| Replies with an over-long sentence (lower is better) | **0.1%** | 1.0% | 1.0% | 0.6% | 0.8% | 0.8% | 0.6% | 1.5% | 1.5% |
| Italian-only replies (higher is better) | **100.0%** | 99.9% | **100.0%** | 99.9% | 99.9% | **100.0%** | **100.0%** | **100.0%** | **100.0%** |
| Feedback move accuracy (higher is better) | **100.0%** | 86.9% | 84.6% | 87.3% | 87.1% | 86.9% | 86.0% | 85.6% | 86.5% |
| Over-correction (corrected a correct turn) (lower is better) | **0.0%** | 7.2% | 14.9% | 8.0% | 7.5% | 10.6% | 12.1% | 13.1% | 10.8% |
| Under-correction (missed a due correction) (lower is better) | **0.0%** | 14.3% | 7.7% | 13.1% | 12.6% | 10.4% | 8.7% | 8.2% | 9.9% |
| Correction accuracy (due correction, right error) (higher is better) | **100.0%** | 74.3% | 78.2% | 76.8% | 76.3% | 78.2% | 77.7% | 78.5% | 78.5% |
| Prompts that give the answer away (lower is better) | **0.0%** | 0.5% | 1.0% | 0.5% | 0.5% | 1.0% | 0.5% | 0.5% | **0.0%** |
| Recast correctness (higher is better) | **99.0%** | 69.6% | 69.1% | 70.6% | 69.1% | 69.1% | 68.6% | 70.1% | 69.6% |
| Error-tag F1 (micro) (higher is better) | **1.00** | 0.76 | 0.75 | 0.77 | 0.77 | 0.77 | 0.76 | 0.75 | 0.77 |
| Error-tag F1 (macro) (higher is better) | **1.00** | 0.72 | 0.71 | 0.74 | 0.73 | 0.72 | 0.70 | 0.71 | 0.75 |
| Annotation consistency (higher is better) | **100.0%** | 98.7% | 99.5% | 98.8% | 98.6% | 99.1% | 99.1% | 99.4% | 99.1% |

## By level

| System | Level | Items | JSON valid | Move accuracy | Tokens outside band |
|---|---|---|---|---|---|
| teacher-reference | A1 | 134 | 100.0% | 100.0% | 0.0% |
| teacher-reference | A2 | 122 | 100.0% | 100.0% | 0.0% |
| teacher-reference | B1 | 132 | 100.0% | 100.0% | 0.0% |
| teacher-reference | B2 | 136 | 100.0% | 100.0% | 1.4% |
| teacher-reference | C1 | 141 | 100.0% | 100.0% | 2.4% |
| teacher-reference | C2 | 136 | 100.0% | 100.0% | 3.6% |
| round10-dpo | A1 | 134 | 100.0% | 96.3% | 2.0% |
| round10-dpo | A2 | 122 | 100.0% | 92.6% | 1.1% |
| round10-dpo | B1 | 132 | 100.0% | 85.6% | 1.2% |
| round10-dpo | B2 | 136 | 100.0% | 88.2% | 1.3% |
| round10-dpo | C1 | 141 | 100.0% | 83.0% | 2.6% |
| round10-dpo | C2 | 136 | 98.5% | 77.6% | 2.3% |
| round10b-dpo | A1 | 134 | 100.0% | 94.8% | 2.2% |
| round10b-dpo | A2 | 122 | 98.4% | 86.7% | 0.6% |
| round10b-dpo | B1 | 132 | 99.2% | 84.0% | 1.6% |
| round10b-dpo | B2 | 136 | 97.8% | 87.2% | 1.8% |
| round10b-dpo | C1 | 141 | 99.3% | 83.6% | 2.9% |
| round10b-dpo | C2 | 136 | 98.5% | 77.6% | 2.1% |
| m10-k03 | A1 | 134 | 100.0% | 96.3% | 2.0% |
| m10-k03 | A2 | 122 | 100.0% | 93.4% | 1.3% |
| m10-k03 | B1 | 132 | 100.0% | 86.4% | 1.6% |
| m10-k03 | B2 | 136 | 99.3% | 86.7% | 1.7% |
| m10-k03 | C1 | 141 | 100.0% | 85.1% | 2.8% |
| m10-k03 | C2 | 136 | 100.0% | 77.2% | 2.3% |
| m10-k04 | A1 | 134 | 100.0% | 96.3% | 2.0% |
| m10-k04 | A2 | 122 | 99.2% | 93.4% | 0.9% |
| m10-k04 | B1 | 132 | 100.0% | 85.6% | 1.2% |
| m10-k04 | B2 | 136 | 99.3% | 87.4% | 1.8% |
| m10-k04 | C1 | 141 | 100.0% | 85.1% | 2.8% |
| m10-k04 | C2 | 136 | 100.0% | 77.2% | 2.7% |
| m10-k05 | A1 | 134 | 100.0% | 97.0% | 2.0% |
| m10-k05 | A2 | 122 | 99.2% | 91.7% | 1.1% |
| m10-k05 | B1 | 132 | 100.0% | 84.1% | 1.6% |
| m10-k05 | B2 | 136 | 99.3% | 87.4% | 1.6% |
| m10-k05 | C1 | 141 | 100.0% | 85.1% | 2.8% |
| m10-k05 | C2 | 136 | 99.3% | 78.5% | 2.3% |
| m10-k06 | A1 | 134 | 100.0% | 97.0% | 1.9% |
| m10-k06 | A2 | 122 | 98.4% | 90.8% | 1.3% |
| m10-k06 | B1 | 132 | 99.2% | 84.7% | 1.5% |
| m10-k06 | B2 | 136 | 99.3% | 87.4% | 1.7% |
| m10-k06 | C1 | 141 | 100.0% | 82.3% | 2.5% |
| m10-k06 | C2 | 136 | 97.8% | 78.9% | 2.6% |
| m10b-g03 | A1 | 134 | 100.0% | 94.8% | 2.3% |
| m10b-g03 | A2 | 122 | 99.2% | 88.4% | 0.8% |
| m10b-g03 | B1 | 132 | 100.0% | 84.1% | 1.6% |
| m10b-g03 | B2 | 136 | 98.5% | 88.1% | 1.4% |
| m10b-g03 | C1 | 141 | 100.0% | 82.3% | 2.7% |
| m10b-g03 | C2 | 136 | 99.3% | 79.3% | 2.3% |
| m10b-g05 | A1 | 134 | 100.0% | 96.3% | 1.9% |
| m10b-g05 | A2 | 122 | 98.4% | 90.0% | 1.0% |
| m10b-g05 | B1 | 132 | 100.0% | 85.6% | 1.6% |
| m10b-g05 | B2 | 136 | 99.3% | 86.7% | 1.5% |
| m10b-g05 | C1 | 141 | 100.0% | 83.7% | 3.0% |
| m10b-g05 | C2 | 136 | 97.8% | 81.2% | 2.4% |

## Feedback moves (rows: gold, columns: predicted)

**teacher-reference**

| gold \ predicted | none | prompt | recast | invalid |
|---|---|---|---|---|
| none | 388 | 0 | 0 | 0 |
| prompt | 0 | 219 | 0 | 0 |
| recast | 0 | 0 | 194 | 0 |

**round10-dpo**

| gold \ predicted | none | prompt | recast | invalid |
|---|---|---|---|---|
| none | 360 | 15 | 12 | 1 |
| prompt | 34 | 178 | 7 | 0 |
| recast | 25 | 10 | 158 | 1 |

**round10b-dpo**

| gold \ predicted | none | prompt | recast | invalid |
|---|---|---|---|---|
| none | 330 | 36 | 19 | 3 |
| prompt | 19 | 188 | 11 | 1 |
| recast | 13 | 16 | 160 | 5 |

**m10-k03**

| gold \ predicted | none | prompt | recast | invalid |
|---|---|---|---|---|
| none | 357 | 18 | 13 | 0 |
| prompt | 31 | 182 | 6 | 0 |
| recast | 23 | 10 | 160 | 1 |

**m10-k04**

| gold \ predicted | none | prompt | recast | invalid |
|---|---|---|---|---|
| none | 359 | 17 | 12 | 0 |
| prompt | 29 | 183 | 7 | 0 |
| recast | 23 | 13 | 156 | 2 |

**m10-k05**

| gold \ predicted | none | prompt | recast | invalid |
|---|---|---|---|---|
| none | 347 | 25 | 16 | 0 |
| prompt | 25 | 187 | 7 | 0 |
| recast | 18 | 11 | 162 | 3 |

**m10-k06**

| gold \ predicted | none | prompt | recast | invalid |
|---|---|---|---|---|
| none | 341 | 28 | 16 | 3 |
| prompt | 22 | 186 | 11 | 0 |
| recast | 14 | 14 | 162 | 4 |

**m10b-g03**

| gold \ predicted | none | prompt | recast | invalid |
|---|---|---|---|---|
| none | 337 | 32 | 18 | 1 |
| prompt | 20 | 186 | 13 | 0 |
| recast | 14 | 14 | 163 | 3 |

**m10b-g05**

| gold \ predicted | none | prompt | recast | invalid |
|---|---|---|---|---|
| none | 346 | 22 | 17 | 3 |
| prompt | 23 | 183 | 13 | 0 |
| recast | 18 | 9 | 164 | 3 |

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
