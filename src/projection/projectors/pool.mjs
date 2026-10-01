import { normalizeNode } from '../keys.mjs'

// The contract pool (ADR 0002 in dusk-domains-protocol): one router, and registries and resolvers
// in the order they joined. The newest registry creates new names; names never move.
export function emptyPoolState() {
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

export function reducePoolEvent(event, current, meta = {}) {
  // Records keep their content when they move, so the pool itself does not change. The name's
  // resolver does: see applyRecordsMoved.
  if (event.type === 'records_moved') return current

  const stamped = {
    txId: meta.txId ?? current.txId,
    blockHeight: meta.blockHeight ?? current.blockHeight,
  }
  if (event.type === 'router_initialized') {
    const marketplace = normalizeNode(event.marketplace)
    return {
      ...current,
      ...stamped,
      registrationsPaused: false,
      initialized: true,
      router: meta.contractId ? normalizeNode(meta.contractId) : current.router,
      operator: event.operator ?? null,
      pendingOperator: null,
      treasury: normalizeNode(event.treasury),
      marketplace: /^0x0+$/u.test(marketplace) ? null : marketplace,
    }
  }
  if (event.type === 'pool_member_added') {
    const list = event.kind === 'registry' ? 'registries' : 'resolvers'
    const member = normalizeNode(event.member)
    if (current[list].includes(member)) return current
    return {
      ...current,
      ...stamped,
      operator: event.operator ?? current.operator,
      [list]: [...current[list], member],
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
  if (event.type === 'router_operator_changed') {
    return { ...current, ...stamped, operator: event.operator ?? current.operator, pendingOperator: null }
  }
  return current
}
