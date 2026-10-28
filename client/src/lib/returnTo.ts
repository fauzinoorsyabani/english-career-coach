/**
 * Only allow navigation to same-origin paths. This prevents `returnTo` from
 * being used as an open redirect after sign-in.
 */
export function safeReturnTo(value: string | null | undefined, fallback = "/") {
  if (!value) return fallback;
  if (!value.startsWith("/") || value.startsWith("//")) return fallback;
  if (value.startsWith("/login")) return fallback;
  return value;
}
