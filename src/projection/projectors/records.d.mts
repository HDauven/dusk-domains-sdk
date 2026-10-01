import type { ResolverRecord } from '../../core/records'
import type { IndexedResolverRecordHistoryEntry, IndexedReversePrimaryName, IndexerEventMeta, ResolverRecordEvent, ReverseRegistryEvent } from '../../indexer/indexerTypes'
import type { ProjectionState } from '../state.mjs'

export function applyResolverEvent(store: ProjectionState, event: ResolverRecordEvent, meta: IndexerEventMeta, fallbackTimestamp: string | null): void
export function applyReverseEvent(store: ProjectionState, event: ReverseRegistryEvent, meta: IndexerEventMeta): (IndexedReversePrimaryName & { primaryName: string | null }) | null
export function collectSnapshotControllers(name: {
  controllers?: unknown[]
  activity?: Array<{ eventType?: string, actor?: unknown }>
}): Set<string>
export function recordIndexKey(node: string, key: string): string
export function rebuildCurrentRecordIndexes(recordsByNode: Map<string, ResolverRecord[]>): Map<string, ResolverRecord>
export function appendRecordHistory(store: ProjectionState, historyEvent: IndexedResolverRecordHistoryEntry): void
