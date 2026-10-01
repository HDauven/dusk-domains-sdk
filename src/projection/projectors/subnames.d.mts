import type { IndexedSubname, IndexerEventMeta, SubnameRegistryEvent } from '../../indexer/indexerTypes'
import type { ProjectionState } from '../state.mjs'

export function applySubnameEvent(store: ProjectionState, event: SubnameRegistryEvent, meta: IndexerEventMeta): (IndexedSubname & { canonicalName: string }) | null
export function renewInheritingSubnames(store: ProjectionState, rootNode: string): void
