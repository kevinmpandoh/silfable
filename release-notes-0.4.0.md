# Mirae v0.4.0 — Real-World Asset (RWA) Lending & Yield on Solana

Mirae v0.4.0 introduces institutional Real-World Asset (RWA) lending and yield on Solana mainnet powered by Kamino Finance, featuring 1-click supply, 1-click withdrawal, an active portfolio dashboard, and seamless natural-language conversational AI control.

## Highlights

- **Kamino RWA Market Integration**: Supply USDC to institutional corporate credit and commercial paper pools (*Obligate Market* backed by oTFY at ~8.24% APY) and gold-backed pools (*PAXG Market*).
- **1-Click Seamless Execution**: Direct, instant 1-click execution for both supply and withdrawal actions with automatic simulation, fee calculation, and transaction broadcast on Solana.
- **Dedicated RWA Workspace Modal**: Full-featured institutional RWA dashboard in the desktop app with dedicated tabs for **Supply USDC**, **Active Positions**, and **Withdraw USDC**.
- **Portfolio & Yield Tracking**: Live calculation of accrued yield in USD, active position balances, APY metrics, and direct links to Solscan on-chain explorers.
- **Conversational AI Control**: Execute RWA lending and redemptions seamlessly through chat commands in Indonesian and English (e.g. *"supply 10 USDC to Kamino RWA"*, *"tarik 10 USDC dari obligasi"*).
- **Security & Enforceable Limits**: Hard session supply caps (50 USDC session default), fail-closed error handling, locked input fields during execution, and full compatibility with Restricted password mode and Full Access sessions.
- **Unified Visual Design**: Harmonized toolbar launch buttons and modals adhering strictly to the warm Mirae theme and typography.

## Safety and Reliability

- Request, lending market, amount, wallet, session, and transaction digest are cryptographically bound before signing.
- Unlinkable local vault signing with strict password-protection in Restricted mode; automated 1-click execution in Full Access mode.
- Input locking prevents duplicate submissions or parameter alterations while an on-chain transaction is in-flight.
- Clear error handling with friendly diagnostics for RPC delays, insufficient balances, and slippage.

## Downloads

- Windows x64: Unsigned portable ZIP (`Mirae-0.4.0-windows-x64-unsigned-qa.zip`).
- Linux: AppImage and Debian packages for x64 and arm64.
- SHA-256 checksum manifests are provided for all build artifacts.

## Verification

This release passed workspace typechecking, deterministic test suites (105+ tests), contract validation, desktop bundle audits, and build verification.

Full changelog: https://projectmirae.com/releases
