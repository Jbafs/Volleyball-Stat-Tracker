// Password hashing via PBKDF2-SHA256 using the Web Crypto API built into
// Cloudflare Workers (no external dependencies).
// Stored format: base64(salt) + ':' + base64(hash)

const ITERATIONS = 100_000
const KEY_LENGTH = 32 // bytes

function toBase64(buf: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buf)))
}

function fromBase64(s: string): Uint8Array {
  return Uint8Array.from(atob(s), (c) => c.charCodeAt(0))
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  )
  const hashBuf = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations: ITERATIONS },
    keyMaterial,
    KEY_LENGTH * 8
  )
  return `${toBase64(salt.buffer)}:${toBase64(hashBuf)}`
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [saltB64, hashB64] = stored.split(':')
  if (!saltB64 || !hashB64) return false
  const salt = fromBase64(saltB64)
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  )
  const hashBuf = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations: ITERATIONS },
    keyMaterial,
    KEY_LENGTH * 8
  )
  const attempt = toBase64(hashBuf)
  // Constant-time comparison
  if (attempt.length !== hashB64.length) return false
  let diff = 0
  for (let i = 0; i < attempt.length; i++) {
    diff |= attempt.charCodeAt(i) ^ hashB64.charCodeAt(i)
  }
  return diff === 0
}

export function generateToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32))
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('')
}
