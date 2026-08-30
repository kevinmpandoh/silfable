# Mirae v0.4.1 — RWA UI/UX Refinements, State Deduplication & Stability

Mirae v0.4.1 is a minor release delivering a complete UI/UX overhaul for Kamino Real-World Asset (RWA) lending, refined minimalist aesthetics matching the Mirae design system, robust active position tracking on withdrawal, and transaction deduplication across session switches.

## What's Changed

- **Clean Minimalist RWA Design**: Completely overhauled `KaminoRwaWorkspaceModal`, `KaminoRwaCard`, and `KaminoRwaWithdrawCard` with a sleek, high-contrast palette, zero decorative AI slop icons, and clean Lucide iconography (`ArrowUpRight`, `ArrowDownLeft`, `TrendingUp`, `ShieldCheck`).
- **Quick Amount Presets**: Added responsive quick-select amount chips (5, 10, 25, 50, and MAX) for instant USDC allocation and withdrawal.
- **Active Position State Resolution**: Fixed position tracking so withdrawing funds immediately deducts the balance from local encrypted SQLite storage and marks fully withdrawn positions as closed, keeping the Active Positions counter accurate.
- **Transaction Signature Schema Fix**: Expanded `KaminoRwaPositionSchema` and `KaminoRwaWithdrawReceiptSchema` signature validation to accept full 64–128 character Solana transaction signatures.
- **Session Switch Deduplication**: Implemented global proposal tracking and session message persistence so navigating between sessions in Full Access mode never re-triggers completed on-chain transactions.

## Verification & Compatibility

- 105 automated unit and regression tests passing with 0 failures.
- Non-custodial, encrypted local storage (AES-256-GCM) with fail-closed security guarantees.
