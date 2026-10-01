import type { IndexerEventMeta } from '../indexer/indexerTypes'

/** Decodes driver fields, including legacy events and nullable lifecycle estimates. */
export function normalizeObservedEvent(input: {
  contract: { key: string, contractId: string }
  eventName: string
  event: Record<string, unknown>
  observedAt: string
  observedBlockHeight?: number | null
  targetBlockSeconds?: number
}): { event: { type: string } & Record<string, unknown>, meta: IndexerEventMeta } | null
