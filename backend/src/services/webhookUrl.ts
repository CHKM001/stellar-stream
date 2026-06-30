import { isIP } from "net";

type WebhookUrlValidationResult = {
  valid: boolean;
  reason?: string;
};

/** Checks whether an IPv4 address belongs to a private or reserved range (RFC 1918, loopback, link-local). */
function isPrivateIpv4(hostname: string): boolean {
  const octets = hostname.split(".").map(Number);
  if (octets.length !== 4 || octets.some((octet) => Number.isNaN(octet))) {
    return false;
  }

  const [first, second] = octets;
  return (
    first === 10 ||
    first === 127 ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 168) ||
    (first === 169 && second === 254) ||
    first === 0
  );
}

/** Checks whether an IPv6 address belongs to a private or loopback range. */
function isPrivateIpv6(hostname: string): boolean {
  const normalized = hostname.toLowerCase();
  return (
    normalized === "::1" ||
    normalized.startsWith("fc") ||
    normalized.startsWith("fd") ||
    normalized.startsWith("fe80:")
  );
}

/** Checks whether a hostname resolves to localhost or a private network address. */
function isBlockedHostname(hostname: string): boolean {
  const normalized = hostname.toLowerCase();

  if (normalized === "localhost" || normalized.endsWith(".localhost")) {
    return true;
  }

  const ipVersion = isIP(normalized);
  if (ipVersion === 4) {
    return isPrivateIpv4(normalized);
  }
  if (ipVersion === 6) {
    return isPrivateIpv6(normalized);
  }

  return false;
}

/**
 * Validates a webhook URL to ensure it uses HTTPS and does not target localhost or private networks.
 * @param url - The URL string to validate
 * @returns An object with `valid: true` or `valid: false` with a reason string
 */
export function validateWebhookUrl(url: string): WebhookUrlValidationResult {
  let parsed: URL;

  try {
    parsed = new URL(url);
  } catch {
    return { valid: false, reason: "url must be a valid URL" };
  }

  if (parsed.protocol !== "https:") {
    return { valid: false, reason: "url must use https:// protocol" };
  }

  if (isBlockedHostname(parsed.hostname)) {
    return {
      valid: false,
      reason: "url must not target localhost or private network ranges",
    };
  }

  return { valid: true };
}
