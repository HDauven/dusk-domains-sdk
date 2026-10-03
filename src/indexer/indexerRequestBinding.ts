import { namehash } from '../core/namehash'

export function assertRequestMatch(matches: boolean, label: string) {
  if (!matches) throw new Error(`Dusk Domains indexer ${label} response does not match the request.`)
}

export function normalizeIndexerKey(value: string): string {
  const hex = value.trim().toLowerCase().replace(/^0x/u, '')
  if (!/^[0-9a-f]{64}$/u.test(hex)) throw new Error('Dusk Domains indexer key must be 32-byte hex.')
  return `0x${hex}`
}

export function matchesIndexerKey(actual: string | null, expected: string): boolean {
  try {
    return actual !== null && normalizeIndexerKey(actual) === normalizeIndexerKey(expected)
  } catch {
    return false
  }
}

export function matchesIndexedName(name: string, node: string, expectedName?: string): boolean {
  try {
    const expected = namehash(expectedName ?? name)
    return name === expected.canonicalName && matchesIndexerKey(node, expected.hex)
  } catch {
    return false
  }
}
