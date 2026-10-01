export function normalizeName(value) {
  const trimmed = String(value ?? '').trim().toLowerCase()
  if (!trimmed) return ''
  return trimmed.endsWith('.dusk') ? trimmed : `${trimmed}.dusk`
}

export function normalizeNode(value) {
  if (!value) return ''
  const text = String(value).trim().toLowerCase()
  return /^[0-9a-f]{64}$/.test(text) ? `0x${text}` : text
}

export function numberOrNull(value) {
  if (value === null || value === undefined || value === '') return null
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

export function endpointKey(endpoint) {
  return `${endpoint.type}:${endpoint.value}`
}
