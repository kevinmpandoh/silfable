/**
 * Declining a wallet prompt is a normal user decision, not a failure to report.
 * Wallets signal it inconsistently: Phantom/EIP-1193 use code 4001, ethers uses
 * "ACTION_REJECTED", and the Solana adapters wrap the provider error inside a
 * WalletError (`error`) or a standard `cause`, so the whole chain is inspected.
 */
const USER_REJECTION_MESSAGE = /user (?:denied|rejected)|request (?:was )?(?:rejected|cancell?ed)|cancell?ed/iu;

type WalletErrorLike = { code?: unknown; message?: unknown; error?: unknown; cause?: unknown };

export function isUserRejectedWalletRequest(cause: unknown, depth = 0): boolean {
  if (!cause || typeof cause !== "object" || depth > 3) return false;
  const error = cause as WalletErrorLike;
  if (error.code === 4001 || error.code === "4001" || error.code === "ACTION_REJECTED") return true;
  if (typeof error.message === "string" && USER_REJECTION_MESSAGE.test(error.message)) return true;
  return (
    isUserRejectedWalletRequest(error.error, depth + 1) ||
    isUserRejectedWalletRequest(error.cause, depth + 1)
  );
}
