# Mirae v0.3.0 — Native Solana x402

Mirae v0.3.0 introduces policy-bounded USDC payments for external market data on Solana Mainnet across the web and desktop applications.

## Highlights

- Native Solana x402 discovery, payment preparation, settlement receipts, and provider evidence.
- Canonical Solana Mainnet USDC validation with per-resource, per-mission, and global hard caps.
- Restricted desktop sessions retain manual source selection, password confirmation, and approval.
- Full Access desktop sessions can select and purchase the smallest useful provider set within the configured x402 budget.
- Purchased evidence is treated as untrusted external data and is separated from deterministic Perpetuals qualification.
- Conditional bullish and bearish Perpetuals analysis with a separate guarded venue preflight.
- Consistent v0.3.0 download metadata across package manifests, navbar, release history, and artifacts.

## Safety and reliability

- Request, provider requirements, wallet, session, and transaction digest are bound before signing.
- Duplicate submission, stale plans, changed payment requirements, private-network URLs, oversized responses, and unsupported assets fail closed.
- Payment settlement and provider data retrieval are reported separately; Mirae does not claim success before confirmation.
- x402 payment authority does not grant withdrawal or unrelated transfer authority.
- Receipt encryption now includes a dedicated x402 record key while remaining compatible with existing vaults.

## Downloads

- Windows x64: unsigned portable ZIP. Windows may show an unknown-publisher warning.
- Linux: AppImage and Debian packages for x64 and arm64.
- SHA-256 checksum manifests are included for both platforms.

## Verification

This release passed workspace typechecking, deterministic tests, website lint/build, desktop bundle audits, Linux compatibility and runtime smoke tests, and Windows packaged-app smoke testing.

Full changelog: https://projectmirae.com/releases
