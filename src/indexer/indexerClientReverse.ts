import { isRecord } from './indexerClientGuards'
import type { DuskEndpoint } from '../client/sdk'
import { assertRequestMatch } from './indexerRequestBinding'
import { namehashHex } from '../core/namehash'

export function primaryNameFromPayload(payload: unknown, endpoint?: DuskEndpoint) {
  if (payload === null) return null
  if (typeof payload === 'string') return payload || null
  if (!isRecord(payload)) return null

  if (endpoint && 'endpoint' in payload) {
    assertRequestMatch(isRecord(payload.endpoint) && payload.endpoint.type === endpoint.type && payload.endpoint.value === endpoint.value, 'reverse')
  }

  const primaryName = typeof payload.name === 'string'
    ? payload.name
    : typeof payload.primaryName === 'string'
      ? payload.primaryName
      : ''

  if (!primaryName) return null
  if (typeof payload.node === 'string' && payload.node.trim() && !reverseNodeMatchesName(payload.node, primaryName)) {
    assertRequestMatch(false, 'reverse name')
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
