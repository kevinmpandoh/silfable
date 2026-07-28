# Silfable Whitepaper

An early-stage, open-source project exploring how AI reasoning, human approval, venue-specific policy, local or browser-wallet signing, and deterministic security boundaries can coordinate across guarded Mainnet workflows.

## Contents

- [00] Important Notice
- [01] Executive Summary
- [02] Current Development Status
- [03] The Problem
- [04] Silfable's Vision
- [05] Design Principles
- [06] Proposed System Architecture
- [07] Restricted Execution Framework
- [08] Transaction Authority and Security
- [09] Cloud Monitoring Roadmap
- [10] Risk Management and Automated Kill Switches
- [11] Pump.fun Token Launch and Venue Roadmap
- [12] Public Commitments
- [13] Conclusion

---

## [00] Important Notice

Silfable is an early-stage open-source project. 

This document describes its current architecture, live components, development principles, security models, and roadmap. 

Implemented code is not the same as production clearance. Guarded transaction paths exist, but every mutable venue remains subject to its own signed-build, controlled Mainnet acceptance, receipt recovery, and security gates. A preview artifact or passing simulation is not blanket production approval.

Silfable is not currently:
- A standalone blockchain.
- A custodian of real-world assets.
- A fully unconstrained AI trading platform.
- A guarantee of financial returns.

Cryptocurrency trading involves substantial risk of loss. The AI agents within Silfable act as deterministic co-pilots and researchers. They do not possess inherent legal authority, nor do they bypass strict, hard-coded drawdown and fee limits. 

---

## [01] Executive Summary

The decentralized finance (DeFi) ecosystem is becoming increasingly agentic. 

AI agents are beginning to search for information, analyze tokens, draft limit orders, and perform economic tasks for humans and businesses. However, the infrastructure required for this economy remains inherently contradictory: giving AI the freedom to trade usually means handing over permanent custody of private keys to an unpredictable black box.

Silfable is an open-source, Solana-first project designed to explore a shared coordination environment where AI intelligence is decoupled from transaction authority. 

Silfable is built around four core ideas:
1. **Intent-based research, deterministic execution:** The AI may analyze markets and draft actions, but supported transactions must pass strict, hard-coded deterministic policy checks before execution.
2. **Separated transaction authority:** Desktop keys remain in the local encrypted vault; web signing remains in the connected browser wallet.
3. **Transparent Execution Receipts:** Every quote, simulation, confirmation, rejection, and failure should be readable and independently reconciled. Desktop receipts remain encrypted locally.
4. **Restricted Execution:** Web transactions require browser-wallet approval. Desktop transactions require the local encrypted vault, deterministic policy checks, and explicit final confirmation. Full Access cloud execution is not available.
5. **Wallet-Scoped Web Authentication:** A web workspace requires an expiring, one-time Solana wallet challenge signature. Authentication signatures grant access only to that wallet's application data; they never authorize a transaction.

---

## [02] Current Development Status

The current Silfable platform contains guarded Mainnet implementations and pilots. None of these statements should be interpreted as blanket production clearance for every venue.

### 2.1 Implemented, Release-Gated Capabilities
- **Jupiter Solana Swap:** Guarded desktop quote, deterministic policy, unsigned simulation, local approval, one-attempt broadcast, and encrypted receipt recovery. Final release acceptance remains.
- **Pump.fun Token Launch:** Restricted SOL-paired, zero-initial-buy desktop `create_v2` implementation. Controlled Mainnet acceptance, metadata operations review, and external security review remain.
- **Robinhood Chain EVM Swap Pilot:** Wallet-scoped Mission chat, 0x firm quote, exact allowance, fresh preflight, local signing, one-time broadcast, and encrypted receipt recovery. It remains production-locked.

### 2.2 Preview and Unavailable Capabilities
- **Cloud Monitor:** Background monitoring and proposal infrastructure without signing or Mainnet broadcast authority.
- **Bridge:** Quote and route review only. No bridge signer or broadcast path exists.
- **Web Venue Parity:** Browser-wallet restricted execution exists, but web does not yet match every desktop venue.
- **Autonomous, Full Access, and Hyperliquid:** No unattended signer, approval bypass, or Hyperliquid execution is production-authorized.

---

## [03] The Problem

Blockchain has made it easy to create digital tokens and permissionless markets. It has not automatically solved the friction of human-agent coordination.

### 3.1 Unconstrained Agent Risk
When AI agents are given raw private keys to execute trades, they are prone to hallucinations. They may incorrectly format a transaction, bypass slippage guards, or execute a mathematically disastrous trade due to a misunderstood prompt.

### 3.2 Fragmented Custody
Providing an AI agent with access to a primary hardware wallet or primary software wallet violates fundamental security practices. Users must manually juggle "burner" wallets and seed phrases to interact with AI applications safely.

### 3.3 The "Always-On" Dilemma
Crypto markets operate 24/7. Browser-based AI agents sleep when the user closes their laptop. True algorithmic trading requires persistent, secure server-side execution without exposing plaintext keys to cloud providers.

---

## [04] Silfable's Vision

Silfable aims to become an open environment where humans and software agents can express an intended outcome, research the market, and securely execute that outcome without compromising custody.

A request may be expressed as:
- *"Prepare a USDC-to-SOL swap proposal with slippage capped at 1%."*
- *"Draft the exact immutable metadata and bounded fee plan for a Pump.fun Token Launch."*

Silfable aims to coordinate:
- The human requester.
- The AI intelligence provider (LLM).
- The transaction builder and deterministic policy engine.
- The encrypted desktop vault or connected browser wallet.
- The pinned venue program, router, or route provider.
- The resulting receipt and persistent state.

---

## [05] Design Principles

### 5.1 Reasoning is not Authority
The AI may draft an action, but it does not execute it. The deterministic engine forces the drafted action through strict policy checks (balance validation, route validation, slippage enforcement) before it ever touches a signer.

### 5.2 Fail Closed
Unknown RPC state, fee spikes, missing route evidence, stale quote data, or policy ambiguity blocks execution entirely. Silfable prioritizes the preservation of capital over the speed of execution.

### 5.3 Receipts Matter
Execution is not considered successful just because a transaction was broadcast. Silfable verifies the finalized on-chain signature, calculates exact slippage and network fees, and produces an immutable receipt.

### 5.4 Progressive Decentralization
Silfable utilizes robust Web2 cloud infrastructure (modern web app, enterprise database, high-throughput queues) to orchestrate Web3 actions (Solana Mainnet). As the project matures, operational control may distribute toward independent modules.

---

## [06] Proposed System Architecture

### 6.1 Web Client & Desktop Application
The interface allows humans to:
- Connect a primary wallet (Phantom, Solflare).
- Submit natural-language intents to the AI.
- Review deterministic transaction quotes.
- Approve or reject execution.

### 6.2 Encrypted Cloud State Layer
A cloud-backed web state layer may store:
- User preferences and global risk parameters.
- Chat session history and AI context.
- Server-side provider configuration required for proposal and research integrations.
- Web session and proposal state. It does not become a production signer.

### 6.3 High-Throughput Task Queue
An in-memory event and task queue intended to bridge the Web Client and the Cloud Monitor. Execution jobs are frozen; the queue must not grant signing or broadcast authority.

### 6.4 The Cloud Worker Daemon
A persistent cloud monitor with a health endpoint. Production signing, transaction construction with a server-held signer, and Mainnet broadcast are disabled.

---

## [07] Restricted Execution Framework

### 7.1 Restricted Mode
In Restricted Mode, Silfable acts purely as a research and transaction-building assistant. 
1. The AI drafts a transaction.
2. The user's browser wallet (e.g., Phantom) receives the unsigned payload.
3. The user manually reviews the exact output and signs the transaction.
4. Final authority never leaves the user's primary wallet.

### 7.2 Cloud Monitoring Preview
The cloud layer may monitor schedules, evaluate trigger conditions, and prepare expiring proposals only after the wallet signs an exact, bounded `monitor-propose` policy. The grant includes explicit capabilities, value and fee ceilings, token scope, start time, and expiry. It always fixes signing, broadcast, and execution authority to false. The wallet can revoke grants or engage an emergency stop. The cloud layer cannot hold transaction authority, request a deposit into an agent wallet, sign a transaction, or broadcast to Mainnet.

---

## [08] Transaction Authority and Security

Silfable currently separates transaction authority by surface.

### 8.1 Desktop
Desktop signing keys remain in the encrypted local vault and require the configured restricted execution gates.

### 8.2 Web
The connected Phantom or Solflare wallet retains signing authority. The server does not create a production agent signer.

### 8.3 Cloud
Cloud credentials must use deployment secrets without source-code fallbacks. Cloud execution remains frozen until custody, ownership authentication, policy enforcement, reconciliation, and independent security review are complete.

---

## [09] Cloud Monitoring Roadmap

The cloud service is currently a monitor-only foundation.

### 9.1 Polling and Inference
Future monitor jobs may evaluate bounded price, schedule, and research conditions without moving funds.

### 9.2 Execution Decoupling
If a condition is met, the target design produces an expiring proposal that must return to the appropriate restricted signing surface.

### 9.3 Reconciliation
Receipt reconciliation is performed only after a user-approved transaction has been broadcast by an authorized restricted surface.

---

## [10] Risk Management and Automated Kill Switches

Silfable enforces hard-coded limits that the AI cannot override.

### 10.1 Global Slippage and Fee Ceilings
All transactions must pass a slippage check (e.g., max 1%) and a network priority fee ceiling. If network congestion causes fees to spike beyond the user's limit, the execution fails safely.

### 10.2 Max Drawdown Kill Switch
The target monitor may pause proposal generation when configured drawdown limits are reached. It has no current AI signing privilege to revoke.

---

## [11] Pump.fun Token Launch and Venue Roadmap

The target product treats Pump.fun as a **Token Launch** lane, not as a generic AI auto-trading venue. Solana asset swaps belong to Jupiter; EVM swaps belong to a verified Uniswap-compatible deployment; cross-chain transfers belong to Bridge. The authoritative architecture is [Venue Product Architecture](VENUE_PRODUCT_ARCHITECTURE.md).

Pump.fun introduces unique risks due to irreversible public metadata, custom bonding-curve contracts, rent/creation costs, and extreme volatility after launch.

### 11.1 Current Capability: Legacy Intelligence
Silfable can read finalized Pump.fun token intelligence, including curve completion state, mint authority, and top-ten concentration. This legacy exact-mint research does not create tokens and does not authorize a transaction.

### 11.2 Restricted Token Launch Implementation
The conservative desktop Token Launch path is implemented in code, but production clearance remains blocked until these release gates are satisfied:
1. **Launch Contract:** typed exact metadata, creator wallet, initial-purchase choice, creation-cost cap, priority-fee cap, and deadline.
2. **Program and Metadata Validation:** current official Pump.fun program/IDL/account review, metadata URI integrity, content-policy boundary, and immutable final user review.
3. **Simulation and Fee Guard:** strict creation/initial-buy cost, rent, priority-fee, account, and instruction allowlist checks on an unsigned transaction.
4. **Receipt Recovery:** hardened launch receipt parsing and on-chain verification without automatic rebroadcast.

Token launch does not include AI-selected token creation, sniping, front-running, bundled execution, or autonomous post-launch trading.

---

## [12] Public Commitments

Silfable is committed to transparency and user safety. 

Silfable will not intentionally:
- Hide the source code of its execution pathways.
- Obfuscate the network fees or slippage incurred during a trade.
- Claim an AI model is infallible or inherently profitable.
- Request the seed phrase or private key of a user's primary wallet.
- Claim cloud autonomous signing or Full Access is available.

---

## [13] Conclusion

Silfable bridges the gap between the unpredictability of Artificial Intelligence and the strict, unforgiving nature of the blockchain. 

By combining intent-based prompts, restricted wallet authority, deterministic policy engines, transparent receipts, and a monitor-only cloud roadmap, Silfable provides a modular environment for guarded AI-assisted trading.

Restricted components exist today; autonomous execution remains a roadmap item subject to explicit security and production gates.

*(End of Document)*
