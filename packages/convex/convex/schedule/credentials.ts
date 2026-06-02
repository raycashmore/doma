// Service-account private keys frequently arrive with ESCAPED newlines ("\\n")
// rather than real ones when they travel through an env var (Convex env, .env,
// CI secrets) — the JSON string can get double-escaped on the way in. OpenSSL 3
// (Node 18+) cannot decode such a key and fails JWT signing with
// `ERR_OSSL_UNSUPPORTED` (error:1E08010C DECODER routines::unsupported).
// Normalize the PEM before handing it to the signer so the action is robust to
// however the key was stored.
export function normalizePrivateKey(privateKey: string): string {
  const normalized = privateKey.includes('\\n') ? privateKey.replace(/\\n/g, '\n') : privateKey;
  return normalized.trim();
}
