# Real-learner check (MERLIN)

| System | Errors detected | False flags | Recast matches native | Invalid JSON |
|---|---|---|---|---|
| m12-k04 | 83.6% (265/317) | 39.9% (111/278) | 62.5% (10/16) | 3 |
| round12m-q4-rb0 | 70.3% (223/317) | 30.2% (84/278) | 60.0% (6/10) | 1 |
| round12m-q4-raw | 69.1% (219/317) | 26.6% (74/278) | 69.2% (9/13) | 1 |
| round12m-bf16-raw | 83.0% (263/317) | 38.1% (106/278) | 56.2% (9/16) | 3 |

## m12-k04 by level

| System | Errors detected | False flags | Recast matches native | Invalid JSON |
|---|---|---|---|---|
| A1 | 94.1% (16/17) | 100.0% (2/2) | 100.0% (1/1) | 0 |
| A2 | 87.3% (131/150) | 39.7% (50/126) | 100.0% (5/5) | 3 |
| B1 | 78.7% (118/150) | 39.3% (59/150) | 40.0% (4/10) | 0 |

## round12m-q4-rb0 by level

| System | Errors detected | False flags | Recast matches native | Invalid JSON |
|---|---|---|---|---|
| A1 | 100.0% (17/17) | 50.0% (1/2) | - | 0 |
| A2 | 75.3% (113/150) | 31.7% (40/126) | 50.0% (1/2) | 1 |
| B1 | 62.0% (93/150) | 28.7% (43/150) | 62.5% (5/8) | 0 |

## round12m-q4-raw by level

| System | Errors detected | False flags | Recast matches native | Invalid JSON |
|---|---|---|---|---|
| A1 | 82.4% (14/17) | 50.0% (1/2) | - | 0 |
| A2 | 73.3% (110/150) | 24.6% (31/126) | 80.0% (4/5) | 1 |
| B1 | 63.3% (95/150) | 28.0% (42/150) | 62.5% (5/8) | 0 |

## round12m-bf16-raw by level

| System | Errors detected | False flags | Recast matches native | Invalid JSON |
|---|---|---|---|---|
| A1 | 94.1% (16/17) | 100.0% (2/2) | 100.0% (1/1) | 0 |
| A2 | 86.0% (129/150) | 36.5% (46/126) | 80.0% (4/5) | 3 |
| B1 | 78.7% (118/150) | 38.7% (58/150) | 40.0% (4/10) | 0 |
