# Devnet Canary Execution

## Scope

The canary is the first real signing boundary in Silfable. It is deliberately separate from Auto DCA and creates a zero-lamport System Program transfer from the dedicated Devnet wallet back to itself. No economic value leaves the wallet, although the transaction pays the normal Devnet network fee.

Every attempt requires a fresh UI acknowledgement. There is no scheduler entry point and no automatic retry.

## State machine

```text
Proposed -> Simulated -> Signed -> Broadcast -> Confirmed
    |           |          |          |
    +-----------+----------+----------+--> Failed
                                      `--> Ambiguous
```

- The transaction is simulated unsigned with signature verification disabled.
- The simulated fee must not exceed 20,000 lamports.
- Network health and keystore state are revalidated immediately before signing and before broadcast.
- Network loss after simulation prevents signing. Network loss after signing preserves the encrypted journal but prevents broadcast.
- Network loss after a broadcast attempt becomes `Ambiguous / network-lost-after-broadcast`; reconciliation may query status later but never rebroadcasts.
- The signed wire transaction and signature are encrypted before the broadcast attempt is journaled.
- RPC submission uses preflight and zero RPC-managed retries.
- Confirmation is polled at `confirmed` commitment until confirmation, transaction error, blockhash expiry, or timeout.
- Any error after the broadcast-attempt journal transition is `Ambiguous`, never a definite failure.

## Restart reconciliation

- `Signed` without a broadcast attempt becomes `Failed / restart-before-broadcast`; it is never sent automatically.
- `Broadcast` and `Ambiguous` records query signature history.
- A confirmed signature becomes `Confirmed`.
- An on-chain error becomes `Failed`.
- Missing status after blockhash expiry becomes `Failed / blockhash-expired-unconfirmed`.
- Missing status before expiry remains `Ambiguous` and requires later review.

This phase validates the signing boundary only. Auto DCA receipts retain `signingAttempted: false` until the Jupiter shadow pipeline and production Desk Rule execution path are separately completed and reviewed.
