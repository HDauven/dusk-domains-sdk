import type { IndexedEndpoint } from '../indexer/indexerTypes'

export function normalizeName(value: unknown): string
export function normalizeNode(value: unknown): string
export function numberOrNull(value: unknown): number | null
export function endpointKey(endpoint: IndexedEndpoint): string
