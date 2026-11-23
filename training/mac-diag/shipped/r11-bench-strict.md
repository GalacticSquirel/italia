# Tutor model evaluation

Held-out items: 801 tutor turns from evaluation-only scenarios.

## Parity with the reference (teacher-reference)

A system is on par on a metric when it is no worse than the reference by more than the
tolerance; on the judge when its win rate against the reference is at least 45.0%.

| Metric | Tolerance | teacher-reference | round10-dpo | m10-k04 | round11-dpo |
|---|---|---|---|---|---|
| JSON validity | 1.0% | 100.0% | 100.0% on par | 100.0% on par | 100.0% on par |
| Feedback move accuracy | 5.0% | 100.0% | 86.6% below | 86.8% below | 87.1% below |
| Correction accuracy (due correction, right error) | 5.0% | 100.0% | 73.6% below | 75.5% below | 78.7% below |
| Over-correction (corrected a correct turn) | 3.0% | 0.0% | 7.0% below | 7.5% below | 9.8% below |
| Prompts that give the answer away | 3.0% | 0.0% | 0.0% on par | 0.0% on par | 0.5% on par |
| Recast correctness | 5.0% | 99.0% | 69.1% below | 68.6% below | 70.6% below |
| LanguageTool errors / 100 words | 0.30 | 0.00 | 0.00 on par | 0.00 on par | 0.00 on par |
| Tokens outside the level band | 2.0% | 2.0% | 1.9% on par | 2.1% on par | 2.1% on par |
| Italian-only replies | 2.0% | 100.0% | 99.9% on par | 99.9% on par | 100.0% on par |

- round10-dpo: 5/9 on par
- m10-k04: 5/9 on par
- round11-dpo: 5/9 on par

## Automatic metrics

| Metric | teacher-reference | round10-dpo | m10-k04 | round11-dpo |
|---|---|---|---|---|
| JSON validity (higher is better) | **100.0%** | **100.0%** | **100.0%** | **100.0%** |
| LanguageTool errors / 100 words (lower is better) | **0.00** | **0.00** | **0.00** | **0.00** |
| Replies with a LanguageTool error (lower is better) | **0.0%** | **0.0%** | **0.0%** | **0.0%** |
| Tokens outside the level band (lower is better) | 2.0% | **1.9%** | 2.1% | 2.1% |
| Replies over the band limit (lower is better) | **0.7%** | 3.9% | 4.0% | 5.0% |
| Replies with an over-long sentence (lower is better) | **0.1%** | 1.0% | 0.7% | 0.6% |
| Italian-only replies (higher is better) | **100.0%** | 99.9% | 99.9% | **100.0%** |
| Feedback move accuracy (higher is better) | **100.0%** | 86.6% | 86.8% | 87.1% |
| Over-correction (corrected a correct turn) (lower is better) | **0.0%** | 7.0% | 7.5% | 9.8% |
| Under-correction (missed a due correction) (lower is better) | **0.0%** | 15.3% | 14.0% | 9.9% |
| Correction accuracy (due correction, right error) (higher is better) | **100.0%** | 73.6% | 75.5% | 78.7% |
| Prompts that give the answer away (lower is better) | **0.0%** | **0.0%** | **0.0%** | 0.5% |
| Recast correctness (higher is better) | **99.0%** | 69.1% | 68.6% | 70.6% |
| Error-tag F1 (micro) (higher is better) | **1.00** | 0.75 | 0.76 | 0.77 |
| Error-tag F1 (macro) (higher is better) | **1.00** | 0.70 | 0.72 | 0.72 |
| Annotation consistency (higher is better) | **100.0%** | 99.1% | 99.1% | 99.4% |

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
| round10-dpo | B2 | 136 | 100.0% | 87.5% | 1.3% |
| round10-dpo | C1 | 141 | 100.0% | 81.6% | 2.6% |
| round10-dpo | C2 | 136 | 100.0% | 77.2% | 2.3% |
| m10-k04 | A1 | 134 | 100.0% | 96.3% | 2.0% |
| m10-k04 | A2 | 122 | 100.0% | 92.6% | 0.9% |
| m10-k04 | B1 | 132 | 100.0% | 85.6% | 1.2% |
| m10-k04 | B2 | 136 | 100.0% | 86.0% | 1.8% |
| m10-k04 | C1 | 141 | 100.0% | 83.7% | 2.8% |
| m10-k04 | C2 | 136 | 100.0% | 77.2% | 2.7% |
| round11-dpo | A1 | 134 | 100.0% | 97.0% | 2.9% |
| round11-dpo | A2 | 122 | 100.0% | 92.6% | 1.1% |
| round11-dpo | B1 | 132 | 100.0% | 86.4% | 1.7% |
| round11-dpo | B2 | 136 | 100.0% | 87.5% | 1.4% |
| round11-dpo | C1 | 141 | 100.0% | 82.3% | 2.7% |
| round11-dpo | C2 | 136 | 100.0% | 77.9% | 2.3% |

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
| none | 361 | 15 | 12 | 0 |
| prompt | 36 | 176 | 7 | 0 |
| recast | 27 | 10 | 157 | 0 |

**m10-k04**

| gold \ predicted | none | prompt | recast | invalid |
|---|---|---|---|---|
| none | 359 | 17 | 12 | 0 |
| prompt | 31 | 181 | 7 | 0 |
| recast | 27 | 12 | 155 | 0 |

**round11-dpo**

| gold \ predicted | none | prompt | recast | invalid |
|---|---|---|---|---|
| none | 350 | 25 | 13 | 0 |
| prompt | 24 | 186 | 9 | 0 |
| recast | 17 | 15 | 162 | 0 |

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
