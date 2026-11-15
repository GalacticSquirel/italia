# Content sources and licences

Intended sources for the content pipeline. Licences must be re-checked against each source's own
terms before its data is added to the shipped seed.

| Source                                                 | Used for                       | Licence                          |
| ------------------------------------------------------ | ------------------------------ | -------------------------------- |
| Nuovo vocabolario di base della lingua italiana (NVdB) | Core vocabulary list           | Research use only                |
| FrequencyWords (OpenSubtitles frequency lists)         | Word frequency ranks           | CC BY-SA 4.0                     |
| wordfreq                                               | Word frequency ranks           | Data CC BY-SA 4.0                |
| Tatoeba                                                | Italian-English sentence pairs | CC BY 2.0 FR                     |
| Universal Dependencies Italian ISDT                    | Lemmas, part-of-speech tags    | Non-commercial (CC BY-NC-SA 3.0) |

## Notes

- Research-only and non-commercial sources cannot be shipped in a commercial app. If the app is
  ever sold, NVdB and UD Italian ISDT data must be replaced or licensed.
- CC BY-SA 4.0 data requires attribution, and derived datasets must be shared under the same
  licence.
- CC BY 2.0 FR requires attribution.
