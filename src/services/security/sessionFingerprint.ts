/**
 * Stable SHA-256 hex fingerprint for auth tokens.
 * Must match PocketBase `$security.sha256(token)` in kvartiraSecurity.js.
 */
export async function fingerprintAuthToken(token: string): Promise<string> {
  const value = token.trim();
  if (!value) return '';

  const data = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}
