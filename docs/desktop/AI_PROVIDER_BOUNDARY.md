# AI Provider Boundary

## Purpose

The hybrid AI layer supports two untrusted proposal surfaces:

- converting a natural-language DCA brief into a reviewable `AiDcaIntentV1` draft;
- evaluating one main-owned, sanitized Jupiter shadow quote and returning a typed `AiShadowTradeProposalV1` action.

It is not trusted as a source of authorization. The shadow proposal surface is the first step toward an execution agent, but it cannot construct, sign, broadcast, or approve a transaction.

An eligible proposal may enter a one-hour restricted approval window. Approval and rejection are bound to the evaluation ID and proposal digest, require explicit acknowledgements, can be revoked, and expire automatically. This records operator intent only: `executionEnabled` is always false, and any future execution milestone must obtain a fresh quote and rerun deterministic policy.

Market observation capture is a separate main-owned path and makes zero provider calls. Observation journals, historical samples, wallet-context availability, provenance metadata, and content digests are not sent to OpenAI or Anthropic by the current provider adapter.

Scheduled market watches also hold no AI adapter reference. Their sleeping and wake-evaluation loop calls only the Jupiter quote-only service and deterministic observation gate; a triggered receipt is a local notification, not an AI prompt or trading authorization.

Restricted agent evaluation sends the selected provider only the encrypted session policy after local decryption and one sanitized market observation: opaque IDs, objective, venue, caps, normalized price, impact, fees, liquidity proxy, historical range, timestamps, quote direction, and expected USDC notional. Mint addresses, wallet-context reason, balances, keys, transaction material, full quote history, and wake history are excluded. The response is revalidated after provider latency and cannot authorize execution.

The optional Devnet exact-message proof, revocable signing-arm lifecycle, and pre-sign preparation make no AI provider call. They consume an already approved local intent, map it only to a fixed reviewed SPL fixture for pipeline verification, and expose no signer or broadcaster. No transaction message, fixture address, RPC result, proof journal, signing-arm state, or pre-sign receipt is sent to OpenAI or Anthropic.

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

Only the fixed safety instruction, selected model identifier, JSON Schema, and user-provided objective are sent. DCA drafting sends the user's DCA brief. Shadow proposal requests additionally send one sanitized quote containing its ID, direction, atomic input/output amounts, threshold, slippage, price impact, fees, router labels, timestamps, and allow/deny state. Mint addresses, wallet keys, recovery phrases, wallet addresses, balances, mission history, receipts, and unrelated database content are excluded.

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

Applying a DCA result only copies values into the local mission form. A shadow proposal is resolved against the quote ID inside the main process, checked for quote binding, freshness, transaction absence, and prior quote denial, then written to an encrypted local evaluation journal. A successful proposal can reach only `would-execute`; `signingAttempted` and `executionAttempted` are always false. Neither surface writes mission authority, starts a scheduler, creates a transaction, signs, or broadcasts.
