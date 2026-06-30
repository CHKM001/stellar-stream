import { createHmac, timingSafeEqual } from "crypto";

/**
 * Computes an HMAC-SHA256 signature for a webhook payload.
 * @param payload - The JSON payload string to sign
 * @param secret - The signing secret
 * @returns A hex-encoded HMAC-SHA256 signature
 */
export function computeWebhookSignature(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("hex");
}

/**
 * Verifies a webhook signature using HMAC-SHA256 with timing-safe comparison.
 * @param payload - The raw request body (string or Buffer)
 * @param signatureHeader - The X-Webhook-Signature header value (format: "sha256=<hex>")
 * @param secret - The signing secret
 * @returns True if the signature is valid, false otherwise
 */
export function verifyWebhookSignature(
  payload: string | Buffer,
  signatureHeader: string,
  secret: string,
): boolean {
  const payloadString = typeof payload === "string" ? payload : payload.toString("utf8");

  if (!payloadString.length) {
    return false;
  }

  const [algorithm, signature] = signatureHeader.split("=");
  if (algorithm !== "sha256" || !signature) {
    return false;
  }

  const expectedSignature = computeWebhookSignature(payloadString, secret);

  const providedSignature = Buffer.from(signature, "hex");
  const expectedSignatureBuffer = Buffer.from(expectedSignature, "hex");

  if (providedSignature.length !== expectedSignatureBuffer.length) {
    return false;
  }

  return timingSafeEqual(providedSignature, expectedSignatureBuffer);
}

/**
 * Builds the HTTP headers for a webhook delivery, including the optional signature header.
 * @param payload - The JSON payload string
 * @param secret - Optional signing secret; if provided, adds X-Webhook-Signature header
 * @returns An object containing Content-Type and optional X-Webhook-Signature headers
 */
export function getWebhookHeaders(
  payload: string,
  secret?: string,
): Record<string, string> {
  return {
    "Content-Type": "application/json",
    ...(secret && {
      "X-Webhook-Signature": `sha256=${computeWebhookSignature(payload, secret)}`,
    }),
  };
}
