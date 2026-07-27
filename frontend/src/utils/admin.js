export const ADMIN_WALLET =
  process.env.REACT_APP_ADMIN_WALLET || "";

export function isAdminWallet(wallet) {
  return Boolean(
    wallet &&
      ADMIN_WALLET &&
      wallet.toLowerCase() === ADMIN_WALLET.toLowerCase()
  );
}
