const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function cleanText(value: unknown, maxLength: number, required = false) {
  const text = typeof value === "string" ? value.trim() : "";
  if (required && !text) throw new Error("required");
  if (text.length > maxLength) throw new Error("too_long");
  return text;
}

export function cleanEmail(value: unknown) {
  const email = cleanText(value, 254, true).toLowerCase();
  if (!EMAIL_RE.test(email)) throw new Error("invalid_email");
  return email;
}

export function cleanEnum<T extends string>(value: unknown, allowed: readonly T[], fallback?: T): T {
  const candidate = String(value || "").toUpperCase() as T;
  if (allowed.includes(candidate)) return candidate;
  if (fallback !== undefined) return fallback;
  throw new Error("invalid_enum");
}

export function cleanDate(value: unknown) {
  if (value === undefined || value === null || value === "") return "";
  const text = String(value);
  if (!DATE_RE.test(text) || Number.isNaN(Date.parse(`${text}T00:00:00Z`))) throw new Error("invalid_date");
  return text;
}

export function cleanProtocol(value: unknown) {
  const protocol = String(value || "").trim().toUpperCase();
  if (!/^AM-\d{8}-[A-F0-9]{6,32}$/.test(protocol)) throw new Error("invalid_protocol");
  return protocol;
}
