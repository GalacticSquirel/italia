# Tutor model evaluation

Held-out items: 801 tutor turns from evaluation-only scenarios.

## Parity with the reference (teacher-reference)

A system is on par on a metric when it is no worse than the reference by more than the
tolerance; on the judge when its win rate against the reference is at least 45.0%.

| Metric | Tolerance | teacher-reference | round8-sft |
|---|---|---|---|
| JSON validity | 1.0% | 100.0% | 100.0% on par |
| Feedback move accuracy | 5.0% | 100.0% | 85.3% below |
| Correction accuracy (due correction, right error) | 5.0% | 100.0% | 74.8% below |
| Over-correction (corrected a correct turn) | 3.0% | 0.0% | 10.3% below |
| Prompts that give the answer away | 3.0% | 0.0% | 1.0% on par |
| Recast correctness | 5.0% | 99.0% | 65.5% below |
| LanguageTool errors / 100 words | 0.30 | 0.02 | 0.03 on par |
| Tokens outside the level band | 2.0% | 2.0% | 1.9% on par |
| Italian-only replies | 2.0% | 100.0% | 100.0% on par |

- round8-sft: 5/9 on par

## Automatic metrics

| Metric | teacher-reference | round8-sft |
|---|---|---|
| JSON validity (higher is better) | **100.0%** | **100.0%** |
| LanguageTool errors / 100 words (lower is better) | **0.02** | 0.03 |
| Replies with a LanguageTool error (lower is better) | **0.2%** | 0.4% |
| Tokens outside the level band (lower is better) | 2.0% | **1.9%** |
| Replies over the band limit (lower is better) | **0.7%** | 4.2% |
| Replies with an over-long sentence (lower is better) | **0.1%** | 0.7% |
| Italian-only replies (higher is better) | **100.0%** | **100.0%** |
| Feedback move accuracy (higher is better) | **100.0%** | 85.3% |
| Over-correction (corrected a correct turn) (lower is better) | **0.0%** | 10.3% |
| Under-correction (missed a due correction) (lower is better) | **0.0%** | 13.1% |
| Correction accuracy (due correction, right error) (higher is better) | **100.0%** | 74.8% |
| Prompts that give the answer away (lower is better) | **0.0%** | 1.0% |
| Recast correctness (higher is better) | **99.0%** | 65.5% |
| Error-tag F1 (micro) (higher is better) | **1.00** | 0.74 |
| Error-tag F1 (macro) (higher is better) | **1.00** | 0.69 |
| Annotation consistency (higher is better) | **100.0%** | 99.8% |

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

## LanguageTool rules in replies (top 10 per system)

- teacher-reference: MORFOLOGIK_RULE_IT_IT 2
- round8-sft: MORFOLOGIK_RULE_IT_IT 2, ER_01_001 1

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
