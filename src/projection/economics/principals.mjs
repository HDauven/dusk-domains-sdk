export function arrayOfStrings(value) {
  return Array.isArray(value) ? value.filter((item) => typeof item === 'string') : []
}

export function referralKey(referrer) {
  if (!referrer) return ''
  if (typeof referrer === 'object') return principalKey(normalizePrincipal(referrer)) ?? ''
  return normalizePrincipalKey(String(referrer ?? '').trim().toLowerCase())
}

export function normalizePrincipalKey(value) {
  return value.replace(/^(moonlight|phoenix|contract):0x([0-9a-f]+)$/u, '$1:$2')
}

export function normalizePrincipal(value) {
  if (!value || typeof value !== 'object') return null
  const kind = value.kind
  const bytes = Array.isArray(value.bytes) ? value.bytes : null
  if (!(kind === 'Moonlight' || kind === 'Phoenix' || kind === 'Contract') || !bytes) return null
  if (!bytes.every((byte) => Number.isInteger(byte) && byte >= 0 && byte <= 255)) return null
  return { kind, bytes: [...bytes] }
}

export function legacyPhoenixPrincipal(value) {
  if (typeof value !== 'string') return null
  const normalized = value.trim().toLowerCase()
  if (!/^0x[a-f0-9]{64}$/.test(normalized)) return null
  return {
    kind: 'Phoenix',
    bytes: Array.from({ length: 32 }, (_, index) => Number.parseInt(normalized.slice(2 + index * 2, 4 + index * 2), 16)),
  }
}

export function principalKey(principal) {
  if (!principal) return null
  return `${principal.kind.toLowerCase()}:${principal.bytes.map((byte) => byte.toString(16).padStart(2, '0')).join('')}`
}
