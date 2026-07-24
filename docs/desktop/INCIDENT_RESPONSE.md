# Standard Operating Procedure: Incident Response & Emergency Recovery

This document outlines the emergency procedures for Silfable Desktop when responding to security incidents, RPC provider outages, or potential key compromises.

## 1. Remote Emergency Lock & Kill-Switch Procedure

If a vulnerability or compromise is detected in a released desktop version:

1. **API Key Revocation**:
   - Immediately revoke the Jupiter, OpenRouter, and Tavily API keys configured in the backend deployment.
   - Any active background observation loops or AI agents will receive HTTP 401/403 and immediately fail closed without making further network calls.

2. **Emergency Release Pipeline**:
   - Trigger the `desktop-windows-release.yml` workflow with an emergency patch version (e.g. `1.0.1`).
   - If an immediate halt of all active desktop instances is required, publish a signed GitHub Release containing an empty/disabled configuration payload to force client-side fallback.

## 2. Unknown Broadcast & Double-Spend Mitigation

If an RPC network disruption leaves a broadcast transaction in an "unknown" state:

1. **No Automatic Rebroadcast**:
   - The application strictly enforces `maxRetries: 0` for `sendTransaction`.
   - The application will **never** automatically rebroadcast an unconfirmed transaction upon restart.

2. **On-Chain Signature Verification**:
   - Upon restart, `ReconciliationService` will inspect the `status: "unknown"` execution receipts stored in the encrypted SQLite session database.
   - It will issue a single read-only `getSignatureStatuses` RPC call to verify if the transaction landed on-chain.
   - If confirmed, state is set to `active`/`finalized`. If failed or dropped, status is updated accordingly.

## 3. User Seed Phrase & Vault Recovery

If a user suspects local machine compromise or loses their master password:

1. **Vault Reset Procedure**:
   - The user can invoke `security:reset-vault` from the UI by entering the exact confirmation phrase `"SET UP NEW VAULT"`.
   - The encrypted keystore file (`secrets.v1.json`) is backed up to a timestamped directory before being deleted.
   - A new blank vault is generated.

2. **Key Recovery**:
   - Users can restore their wallet by importing their 12/24-word BIP39 mnemonic phrase into the newly generated vault.
   - Private key material is never exposed in plaintext logs, crash dumps, or IPC events.
