# Silfable Whitepaper

An early-stage, open-source, Solana-first project exploring how AI agents, human users, zero-click autonomous cloud workers, and deterministic security boundaries can coordinate through a modular execution environment.

## Contents

- [00] Important Notice
- [01] Executive Summary
- [02] Current Development Status
- [03] The Problem
- [04] Silfable's Vision
- [05] Design Principles
- [06] Proposed System Architecture
- [07] Dual-Mode Execution Framework
- [08] Ephemeral Vaults and Security
- [09] 24/7 Cloud Worker Orchestration
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
2. **Ephemeral Vault Architecture:** Zero-click autonomous trading uses strictly isolated, AES-256 encrypted keypairs that live only for the duration of a session.
3. **Transparent Execution Receipts:** Every quote, simulation, confirmation, rejection, and failure should be readable, verified on-chain, and persistently synced via MongoDB.
4. **Dual-Mode Execution:** Users can choose between Restricted Mode (traditional browser-wallet approval) or Full Access Mode (24/7 autonomous cloud execution).

---

## [02] Current Development Status

The current Silfable platform is designed to demonstrate live, production-grade Solana Mainnet execution.

### 2.1 Live Capabilities
- **Restricted Jupiter Swap:** Solana Mainnet swap preview, deterministic simulation, wallet approval, broadcast, and verified receipt generation.
- **24/7 Autonomous Cloud Worker:** Background AI trading via BullMQ/Redis with zero-click Mainnet signing within bounded risk limits.
- **Pump.fun Guarded Trading:** Autonomous and manual Pump.fun bonding-curve trading guarded by live Fee Guards, Slippage Validation, and Receipt Reconciliation.
- **Centralized State Sync:** User settings, active sessions, and trading histories synced across MongoDB Cloud for persistent cross-platform access.
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
Silfable utilizes robust Web2 infrastructure (Next.js, MongoDB, Redis) to orchestrate Web3 actions (Solana Mainnet). As the project matures, operational control may distribute toward independent modules.

---

## [06] Proposed System Architecture

### 6.1 Web Client & Desktop Application
The interface allows humans to:
- Connect a primary wallet (Phantom, Solflare).
- Submit natural-language intents to the AI.
- Review deterministic transaction quotes.
- Approve or reject execution.

### 6.2 MongoDB State Layer
A centralized NoSQL database that stores:
- User preferences and global risk parameters.
- Chat session history and AI context.
- Encrypted Ephemeral Vault keys (AES-256-GCM).
- Execution receipts and position tracking.

### 6.3 Redis & BullMQ Queue
A high-performance message queue that bridges the Web Client and the Cloud Worker. When a user requests 24/7 autonomous monitoring, the intent is placed in Redis for background processing.

### 6.4 The Cloud Worker Daemon
A persistent Node.js worker operating continuously. It pulls intents from Redis, communicates with the LLM, builds Solana transactions, decrypts the session's Ephemeral Vault in memory, signs the transaction, and broadcasts to Mainnet.

---

## [07] Dual-Mode Execution Framework

### 7.1 Restricted Mode
In Restricted Mode, Silfable acts purely as a research and transaction-building assistant. 
1. The AI drafts a transaction.
2. The user's browser wallet (e.g., Phantom) receives the unsigned payload.
3. The user manually reviews the exact output and signs the transaction.
4. Final authority never leaves the user's primary wallet.

### 7.2 Full Access 24/7 Mode
In Full Access Mode, Silfable operates entirely autonomously.
1. The user funds a temporary "Ephemeral Vault" with a strict budget (e.g., 1 SOL).
2. The Cloud Worker takes over the session.
3. The AI monitors the market and signs transactions autonomously using the Ephemeral Vault, without user intervention.
4. Execution continues even if the user goes offline.

---

## [08] Ephemeral Vaults and Security

To solve the custody dilemma of AI trading, Silfable utilizes Ephemeral Vaults.

### 8.1 Zero-Knowledge Architecture
When a 24/7 session is created, the system generates a brand-new Solana keypair on the fly. 

### 8.2 AES-256-GCM Encryption
The private key of the Ephemeral Vault is immediately encrypted using AES-256-GCM before it is stored in MongoDB. The encryption key is derived from a highly secure environment variable (`WORKER_ENCRYPTION_KEY`) known only to the production server. 

### 8.3 Bounded Liability
Because the Ephemeral Vault is entirely separate from the user's primary wallet, the maximum possible loss in the event of an AI hallucination or a theoretical systemic breach is strictly limited to the funds the user explicitly deposited into that specific session.

---

## [09] 24/7 Cloud Worker Orchestration

The Cloud Worker is the heart of Silfable's autonomous capabilities.

### 9.1 Polling and Inference
The worker continuously loops through active BullMQ jobs. It feeds live market data (prices, token velocity, news) into the AI model to determine if conditions meet the user's intent.

### 9.2 Execution Decoupling
If the AI decides to execute, it must output a standardized JSON contract. The Cloud Worker strips away the AI's natural language, takes the JSON contract, and passes it to the Deterministic Policy Engine.

### 9.3 Reconciliation
After broadcast, the worker polls the Solana RPC until the block is finalized. It then updates the MongoDB state, ensuring the Web Client reflects the new portfolio balances instantly.

---

## [10] Risk Management and Automated Kill Switches

Silfable enforces hard-coded limits that the AI cannot override.

### 10.1 Global Slippage and Fee Ceilings
All transactions must pass a slippage check (e.g., max 1%) and a network priority fee ceiling. If network congestion causes fees to spike beyond the user's limit, the execution fails safely.

### 10.2 Max Drawdown Kill Switch
Every 24/7 session tracks its starting balance. If the portfolio value drops below a user-defined threshold (e.g., -20%), the Cloud Worker triggers an automated kill switch. The session is forcibly halted, and the AI's signing privileges are revoked, preventing further loss.

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
- Execute trades using funds outside of an explicitly funded Ephemeral Vault in autonomous mode.

---

## [13] Conclusion

Silfable bridges the gap between the unpredictability of Artificial Intelligence and the strict, unforgiving nature of the blockchain. 

By utilizing intent-based prompts, AES-256 encrypted Ephemeral Vaults, strict deterministic policy engines, and a 24/7 Cloud Worker architecture, Silfable provides a modular environment where AI can trade securely.

The infrastructure exists today. The ecosystem is live. The future of guarded AI execution is here. 

*(End of Document)*
