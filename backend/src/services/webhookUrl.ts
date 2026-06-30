import { isIP } from "net";

type WebhookUrlValidationResult = {
  valid: boolean;
  reason?: string;
};

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

function isPrivateIpv6(hostname: string): boolean {
  const normalized = hostname.toLowerCase();
  return (
    normalized === "::1" ||
    normalized.startsWith("fc") ||
    normalized.startsWith("fd") ||
    normalized.startsWith("fe80:")
  );
}

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
