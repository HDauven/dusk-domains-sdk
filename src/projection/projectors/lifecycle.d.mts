import type { IndexerEventMeta, NameLifecycleEvent, PoolEvent } from '../../indexer/indexerTypes'
import type { ProjectionState } from '../state.mjs'

export function applyLifecycleEvent(store: ProjectionState, event: NameLifecycleEvent, meta: IndexerEventMeta, fallbackTimestamp: string | null): void
export function applyRecordsMoved(store: ProjectionState, event: Extract<PoolEvent, { type: 'records_moved' }>, meta: IndexerEventMeta, fallbackTimestamp: string | null): void
export function clearReleasedName(store: ProjectionState, node: string): void
export function clearNodeDerivedState(input: Pick<ProjectionState,
  'recordsByNode' | 'recordsByNodeKey' | 'reverseByEndpoint' | 'reverseKeysByNode' |
  'controllersByNode' | 'subnamesByNode' | 'subnamesByParent' | 'subnamesByCanonical'
> & { node: string }): Set<string>
