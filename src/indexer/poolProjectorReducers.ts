import type { IndexedPoolState, IndexerEventMeta, PoolEvent } from './indexerTypes'

export function emptyPoolState(): IndexedPoolState {
  return {
    registrationsPaused: false,
    initialized: false,
    router: null,
    operator: null,
    pendingOperator: null,
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
      registrationsPaused: false,
      initialized: true,
      router: meta.contractId ?? current.router,
      operator: event.operator,
      pendingOperator: null,
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
  if (event.type === 'registrations_paused_changed') {
    return { ...current, ...stamped, registrationsPaused: event.paused }
  }
  if (event.type === 'router_operator_proposed') {
    return { ...current, ...stamped, pendingOperator: event.pendingOperator }
  }
  if (event.type === 'router_operator_cancelled') {
    return { ...current, ...stamped, pendingOperator: null }
  }
  return { ...current, ...stamped, operator: event.operator, pendingOperator: null }
}

function isZeroContract(value: string) {
  return /^(0x)?0+$/i.test(value)
}
