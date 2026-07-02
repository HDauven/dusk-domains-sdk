import { isRecord } from './indexerClientGuards'
import { namehashHex } from './namehash'

export function primaryNameFromPayload(payload: unknown) {
  if (payload === null) return null
  if (typeof payload === 'string') return payload || null
  if (!isRecord(payload)) return null

  const primaryName = typeof payload.name === 'string'
    ? payload.name
    : typeof payload.primaryName === 'string'
      ? payload.primaryName
      : ''

  if (!primaryName) return null
  if (typeof payload.node === 'string' && payload.node.trim() && !reverseNodeMatchesName(payload.node, primaryName)) {
    return null
  }

  return primaryName
}

function reverseNodeMatchesName(node: string, primaryName: string) {
  try {
    return normalizeNode(node) === namehashHex(primaryName)
  } catch {
    return false
  }
}

function normalizeNode(node: string) {
  const trimmed = node.trim().toLowerCase()
  return trimmed.startsWith('0x') ? trimmed : `0x${trimmed}`
}
