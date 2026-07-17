# Crash Reporting Privacy Boundary

## Current behavior

Crash reporting is disabled by default. Silfable does not create a local report until the user explicitly opts in. This build has no telemetry server, upload URL, generic HTTP telemetry client, background sender, or IPC method that can transmit a report.

Opt-in enables only an encrypted local crash journal. It does not imply future consent to network transmission. Adding a transport requires a separate consent screen, destination disclosure, preview, retention policy, threat-model review, and dedicated release milestone.

## Data minimization by construction

Silfable does not accept arbitrary log lines and then attempt to clean them. Electron process events are reduced before persistence to these schema fields:

- process category: renderer, GPU, utility, or other child;
- allowlisted termination reason;
- numeric exit code;
- Silfable application version;
- operating-system category;
- local timestamp and random report identifier;
- the invariant `transmitted: false`.

Unknown process names and reasons collapse to generic categories. Service names, localized names, error messages, stack traces, memory dumps, environment variables, filesystem paths, wallet addresses, balances, transaction data, mission configuration, private keys, mnemonic phrases, and provider API keys have no field in the schema.

## Storage lifecycle

Validated reports are encrypted with AES-256-GCM through the local data-key boundary before insertion into `crash_reports`. If the keystore is locked or encryption fails, collection fails closed and no plaintext fallback is written.

The user can preview the bounded fields only while the keystore is unlocked, delete reports while keeping consent enabled, or revoke consent. Revocation synchronously purges all stored reports and prevents future capture.

## Captured Electron events

- unexpected renderer termination through `render-process-gone`;
- non-clean Electron child-process termination through `child-process-gone`.

Clean child exits are ignored. Renderer code cannot submit a synthetic crash report through IPC.
