import type { IndexedPoolState, IndexerEventMeta, PoolEvent } from '../../indexer/indexerTypes'

export function emptyPoolState(): IndexedPoolState
export function reducePoolEvent(event: PoolEvent, current: IndexedPoolState, meta?: IndexerEventMeta): IndexedPoolState
