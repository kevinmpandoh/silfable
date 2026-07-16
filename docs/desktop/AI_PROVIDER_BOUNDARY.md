# AI Provider Boundary

## Purpose

The hybrid AI layer converts a natural-language DCA brief into a reviewable `AiDcaIntentV1` draft. It is not an execution agent and is not trusted as a source of authorization.

## Supported providers

| Provider | API | Default model | Structured output |
| --- | --- | --- | --- |
| OpenAI | Responses API | `gpt-5.6-luna` | `text.format` with strict JSON Schema |
| Anthropic | Messages API | `claude-haiku-4-5-20251001` | `output_config.format` with JSON Schema |

Model identifiers are editable because provider availability and lifecycle can differ by account and region. The endpoint is not editable.

## Secret handling

- The renderer sends a key once over a narrow, validated IPC request.
- The main process writes it to Electron `safeStorage` through `LocalEncryptedKeystore`.
- On Linux, the insecure `basic_text` backend is refused.
- The key is never stored in SQLite, logs, receipts, mission revisions, or renderer state after the save request completes.
- Settings responses return only `provider`, `configured`, and `model`.
- Deleting a provider removes both the keystore record and its non-secret model setting.

## Data sent externally

Only the fixed safety instruction, the selected model identifier, the JSON Schema, and the user's DCA brief are sent. Silfable does not add wallet keys, recovery phrases, wallet addresses, balances, mission history, receipts, or local database content.

The UI requires explicit acknowledgement that the prompt is processed by the selected external provider. OpenAI requests set `store: false`. Provider-side account policy and legal terms still apply.

## Output boundary

The provider can return only:

- amount per cycle;
- interval in whole hours;
- maximum cycles;
- daily spend limit;
- minimum wallet reserve;
- maximum slippage and price impact in basis points;
- a short rationale and bounded assumptions.

No tool definitions are sent to either provider. Returned JSON is parsed and independently validated in the Electron main process. Refusals, timeouts, HTTP errors, incomplete output, malformed JSON, and schema violations fail closed.

Applying an AI result only copies values into the local mission form. It does not write a mission, authorize a digest, start the scheduler, create a transaction, sign, or broadcast. Those remain separate user and Desk Rule transitions.
