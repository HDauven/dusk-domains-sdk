import type { FeeConfigEvent, IndexedFeeConfig, IndexerEventMeta } from '../../indexer/indexerTypes'

export function normalizeFeeConfig(value: unknown): IndexedFeeConfig
export function reduceFeeConfigEvent(event: FeeConfigEvent, current: IndexedFeeConfig, meta: IndexerEventMeta): IndexedFeeConfig
