# models

On-device AI models (LLM, speech to text, text to speech, pronunciation scoring) are downloaded
by the app after install, on Wi-Fi, resumably, and verified by checksum before they are loaded.
**No weights are committed to git.**

`manifest.json` lists the models; it is empty until Phase 4/5. Its format is defined by
`manifest.schema.json` (JSON Schema):

| Field       | Type    | Meaning                                                    |
| ----------- | ------- | ---------------------------------------------------------- |
| `id`        | string  | Stable identifier, lowercase, e.g. `whisper-base-q5`       |
| `url`       | string  | HTTPS download URL                                         |
| `sha256`    | string  | Lowercase hex SHA-256 of the file, checked before loading  |
| `sizeBytes` | integer | Exact file size in bytes (for progress and storage checks) |
| `licence`   | string  | SPDX identifier of the weights' licence, e.g. `Apache-2.0` |

Example entry:

```json
{
  "id": "example-model-q4",
  "url": "https://example.com/models/example-model-q4.gguf",
  "sha256": "0000000000000000000000000000000000000000000000000000000000000000",
  "sizeBytes": 1234567890,
  "licence": "Apache-2.0"
}
```

Only add a model whose licence permits redistribution and use in the app.
