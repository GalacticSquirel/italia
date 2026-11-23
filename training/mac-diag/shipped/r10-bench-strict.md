# Tutor model evaluation

Held-out items: 801 tutor turns from evaluation-only scenarios.

## Parity with the reference (teacher-reference)

A system is on par on a metric when it is no worse than the reference by more than the
tolerance; on the judge when its win rate against the reference is at least 45.0%.

| Metric | Tolerance | teacher-reference | round8-sft | m-a05-b10 | round10-dpo |
|---|---|---|---|---|---|
| JSON validity | 1.0% | 100.0% | 100.0% on par | 100.0% on par | 100.0% on par |
| Feedback move accuracy | 5.0% | 100.0% | 84.9% below | 86.4% below | 86.6% below |
| Correction accuracy (due correction, right error) | 5.0% | 100.0% | 74.1% below | 73.6% below | 73.6% below |
| Over-correction (corrected a correct turn) | 3.0% | 0.0% | 10.3% below | 7.2% below | 7.0% below |
| Prompts that give the answer away | 3.0% | 0.0% | 0.5% on par | 0.0% on par | 0.0% on par |
| Recast correctness | 5.0% | 99.0% | 64.9% below | 67.5% below | 69.1% below |
| LanguageTool errors / 100 words | 0.30 | 0.00 | 0.00 on par | 0.00 on par | 0.00 on par |
| Tokens outside the level band | 2.0% | 2.0% | 1.9% on par | 2.0% on par | 1.9% on par |
| Italian-only replies | 2.0% | 100.0% | 100.0% on par | 99.9% on par | 99.9% on par |

- round8-sft: 5/9 on par
- m-a05-b10: 5/9 on par
- round10-dpo: 5/9 on par

## Automatic metrics

| Metric | teacher-reference | round8-sft | m-a05-b10 | round10-dpo |
|---|---|---|---|---|
| JSON validity (higher is better) | **100.0%** | **100.0%** | **100.0%** | **100.0%** |
| LanguageTool errors / 100 words (lower is better) | **0.00** | **0.00** | **0.00** | **0.00** |
| Replies with a LanguageTool error (lower is better) | **0.0%** | **0.0%** | **0.0%** | **0.0%** |
| Tokens outside the level band (lower is better) | 2.0% | **1.9%** | 2.0% | 1.9% |
| Replies over the band limit (lower is better) | **0.7%** | 4.2% | 4.2% | 3.9% |
| Replies with an over-long sentence (lower is better) | **0.1%** | 0.7% | 0.6% | 1.0% |
| Italian-only replies (higher is better) | **100.0%** | **100.0%** | 99.9% | 99.9% |
| Feedback move accuracy (higher is better) | **100.0%** | 84.9% | 86.4% | 86.6% |
| Over-correction (corrected a correct turn) (lower is better) | **0.0%** | 10.3% | 7.2% | 7.0% |
| Under-correction (missed a due correction) (lower is better) | **0.0%** | 13.8% | 15.0% | 15.3% |
| Correction accuracy (due correction, right error) (higher is better) | **100.0%** | 74.1% | 73.6% | 73.6% |
| Prompts that give the answer away (lower is better) | **0.0%** | 0.5% | **0.0%** | **0.0%** |
| Recast correctness (higher is better) | **99.0%** | 64.9% | 67.5% | 69.1% |
| Error-tag F1 (micro) (higher is better) | **1.00** | 0.73 | 0.75 | 0.75 |
| Error-tag F1 (macro) (higher is better) | **1.00** | 0.68 | 0.70 | 0.70 |
| Annotation consistency (higher is better) | **100.0%** | 99.8% | 99.1% | 99.1% |

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
| round8-sft | B2 | 136 | 100.0% | 84.6% | 2.1% |
| round8-sft | C1 | 141 | 100.0% | 80.9% | 2.0% |
| round8-sft | C2 | 136 | 100.0% | 75.0% | 2.2% |
| m-a05-b10 | A1 | 134 | 100.0% | 96.3% | 1.8% |
| m-a05-b10 | A2 | 122 | 100.0% | 89.3% | 0.9% |
| m-a05-b10 | B1 | 132 | 100.0% | 84.8% | 1.3% |
| m-a05-b10 | B2 | 136 | 100.0% | 86.8% | 1.9% |
| m-a05-b10 | C1 | 141 | 100.0% | 84.4% | 2.4% |
| m-a05-b10 | C2 | 136 | 100.0% | 77.2% | 2.4% |
| round10-dpo | A1 | 134 | 100.0% | 96.3% | 2.0% |
| round10-dpo | A2 | 122 | 100.0% | 92.6% | 1.1% |
| round10-dpo | B1 | 132 | 100.0% | 85.6% | 1.2% |
| round10-dpo | B2 | 136 | 100.0% | 87.5% | 1.3% |
| round10-dpo | C1 | 141 | 100.0% | 81.6% | 2.6% |
| round10-dpo | C2 | 136 | 100.0% | 77.2% | 2.3% |

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
| prompt | 29 | 184 | 6 | 0 |
| recast | 28 | 18 | 148 | 0 |

**m-a05-b10**

| gold \ predicted | none | prompt | recast | invalid |
|---|---|---|---|---|
| none | 360 | 17 | 11 | 0 |
| prompt | 33 | 178 | 8 | 0 |
| recast | 29 | 11 | 154 | 0 |

**round10-dpo**

| gold \ predicted | none | prompt | recast | invalid |
|---|---|---|---|---|
| none | 361 | 15 | 12 | 0 |
| prompt | 36 | 176 | 7 | 0 |
| recast | 27 | 10 | 157 | 0 |

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
