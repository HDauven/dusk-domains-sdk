import type { IndexedPoolState, IndexerEventMeta, PoolEvent } from './indexerTypes'

export function emptyPoolState(): IndexedPoolState {
  return {
    initialized: false,
    router: null,
    operator: null,
    treasury: null,
    marketplace: null,
    registries: [],
    resolvers: [],
    txId: null,
    blockHeight: null,
  }
}

export function reducePoolState(
  event: PoolEvent,
  current: IndexedPoolState,
  meta: IndexerEventMeta,
): IndexedPoolState {
  // Records keep their content when they move, so the pool itself does not change.
  if (event.type === 'records_moved') return current

  const stamped = {
    txId: meta.txId ?? current.txId,
    blockHeight: meta.blockHeight ?? current.blockHeight,
  }
  if (event.type === 'router_initialized') {
    return {
      ...current,
      ...stamped,
      initialized: true,
      router: meta.contractId ?? current.router,
      operator: event.operator,
      treasury: event.treasury,
      marketplace: isZeroContract(event.marketplace) ? null : event.marketplace,
    }
  }
  if (event.type === 'pool_member_added') {
    const list = event.kind === 'registry' ? 'registries' : 'resolvers'
    if (current[list].includes(event.member)) return current
    return {
      ...current,
      ...stamped,
      operator: event.operator,
      [list]: [...current[list], event.member],
    }
  }
  return { ...current, ...stamped, operator: event.operator }
}

function isZeroContract(value: string) {
  return /^(0x)?0+$/i.test(value)
}
