// The QR code holds only the account number, in a small wrapper so we can tell our codes from others.
const PREFIX = "konarktrust:";

export const makeQrText = (accountNumber) => `${PREFIX}${accountNumber}`;

/** Gets the account number out of a scanned text. Returns "" when it is not an account number. */
export function parseQrText(text) {
  const value = String(text || "").trim();
  const number = value.toLowerCase().startsWith(PREFIX) ? value.slice(PREFIX.length) : value;
  return /^\d{6,16}$/.test(number) ? number : "";
}
