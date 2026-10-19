// 32 symbols (no 0/O/1/I) so one random byte & 31 is unbiased. 16 symbols = 80 bits of entropy.
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function generateRecoveryCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  let out = "";
  for (const b of bytes) out += ALPHABET[b & 31];
  return out;
}

// XXXX-XXXX-XXXX-XXXX for display.
export function formatRecoveryCode(code: string): string {
  return (code.match(/.{1,4}/g) ?? []).join("-");
}
