# Silfable Whitepaper

An early-stage, open-source, Solana-first project exploring how AI agents, human users, restricted wallet approvals, cloud monitoring, and deterministic security boundaries can coordinate through a modular execution environment.

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
- [11] Pump.fun and Token Discovery Roadmap
- [12] Public Commitments
- [13] Conclusion

---

## [00] Important Notice

Silfable is an early-stage open-source project. 

This document describes its current architecture, live components, development principles, security models, and roadmap. 

Some components described in this document are already represented in production-ready Solana Mainnet execution via Jupiter Swap. Other components remain planned, experimental, or dependent on future technical and security development.

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
3. **Transparent Execution Receipts:** Every quote, simulation, confirmation, rejection, and failure should be readable, verified on-chain, and persistently synced via encrypted cloud database.
4. **Restricted Execution:** Web transactions require browser-wallet approval. Desktop transactions require the local encrypted vault, deterministic policy checks, and explicit final confirmation. Full Access cloud execution is not available.
5. **Wallet-Scoped Web Authentication:** A web workspace requires an expiring, one-time Solana wallet challenge signature. Authentication signatures grant access only to that wallet's application data; they never authorize a transaction.

---

## [02] Current Development Status

The current Silfable platform is designed to demonstrate live, production-grade Solana Mainnet execution.

### 2.1 Live Capabilities
- **Restricted Jupiter Swap:** Solana Mainnet swap preview, deterministic simulation, wallet approval, broadcast, and verified receipt generation.
- **Cloud Monitor (Preview):** Background monitoring and proposal infrastructure. It has no production signing or Mainnet broadcast authority.
- **Pump.fun Guarded Research:** Read-only intelligence, bounded discovery, proposal building, simulation, fee guards, and receipt foundations. Web Pump.fun broadcast remains disabled.
- **Centralized State Sync:** User settings, active sessions, and trading histories synced across high-availability Cloud Storage for persistent cross-platform access.
- **Portfolio Snapshots:** Connected-wallet SOL balance and token activity snapshots from configured Mainnet RPC providers.

### 2.2 Planned Capabilities
- **Cross-Chain EVM:** Layer-2 EVM bridging, execution, and Hyperliquid integrations remain in the planning phase.

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
- *"Monitor the Solana mempool for trending tokens under $10M market cap and propose a $10 DCA entry."*
- *"Execute a swap from USDC to SOL, ensuring slippage does not exceed 1%."*

Silfable aims to coordinate:
- The human requester.
- The AI intelligence provider (LLM).
- The transaction builder and deterministic policy engine.
- The ephemeral wallet or browser wallet.
- The Solana program (e.g., Jupiter v6).
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
A high-availability cloud database that stores:
- User preferences and global risk parameters.
- Chat session history and AI context.
- Encrypted service credentials required for proposal and research integrations.
- Execution receipts and position tracking.

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

## [11] Pump.fun and Token Discovery Roadmap

Pump.fun introduces unique risks due to extreme volatility, frequent rug-pulls, and custom bonding-curve smart contracts.

### 11.1 Current Capability: Intelligence
Silfable can read finalized Pump.fun token intelligence, including curve completion state, mint authority, and top-ten concentration. It can build proposal-only drafts for the user to review.

### 11.2 The Roadmap to Live Execution
Pump.fun live trading will remain in Preview until the following gates are met:
1. **Fee Guard:** Implementation of strict fee ceilings tailored to Pump.fun's custom routing.
2. **Curve Validation:** Real-time verification that a token's bonding curve has not migrated during the 400ms broadcast window.
3. **Receipt Recovery:** Hardened logic to recover and parse complex Pump.fun receipts to ensure accurate PnL tracking for the kill switch.

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
