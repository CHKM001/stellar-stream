const API_BASE = import.meta.env.VITE_API_URL ?? "/api";

/**
 * Fetches a SEP-10-style authentication challenge transaction from the backend.
 * @param accountId - The Stellar account ID to generate the challenge for
 * @returns The base64-encoded XDR transaction envelope to sign
 */
export async function getAuthChallenge(accountId: string): Promise<string> {
  const response = await fetch(
    `${API_BASE}/auth/challenge?accountId=${encodeURIComponent(accountId)}`,
  );
  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    throw new Error(
      errorBody.error || "Failed to fetch authentication challenge.",
    );
  }
  const body = await response.json();
  return body.transaction;
}

/**
 * Verifies a signed challenge transaction and returns a JWT authentication token.
 * @param signedTransaction - The base64-encoded signed XDR transaction envelope
 * @returns A JWT token string for authenticated API requests
 */
export async function verifyAuthToken(
  signedTransaction: string,
): Promise<string> {
  const response = await fetch(`${API_BASE}/auth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ transaction: signedTransaction }),
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    throw new Error(
      errorBody.error || "Failed to verify authentication signature.",
    );
  }
  const body = await response.json();
  return body.token;
}
