import {
  normalizeNode,
  numberOrNull,
} from '../keys.mjs'

// Pending commitments are keyed by controller and hash, as the core contract keys them, so two
// controllers committing the same hash each keep their own record. commitmentsById keeps the
// latest record per hash for callers that do not name a controller.
export function applyControllerEvent(store, event, meta) {
  const commitment = normalizeNode(event.commitment)
  const key = commitmentKey(event.controller, commitment)
  const current = store.commitmentsByKey.get(key)
  const next = reduceControllerEvent(event, current, meta)
  store.commitmentsByKey.set(key, next)
  store.commitmentsById.set(commitment, next)
  return next
}

export function commitmentKey(controller, commitment) {
  return `${normalizeNode(controller)}:${normalizeNode(commitment)}`
}

function reduceControllerEvent(event, current, meta) {
  const commitment = normalizeNode(event.commitment)

  if (event.type === 'registration_committed') {
    return {
      commitment,
      controller: event.controller,
      createdAt: event.createdAt ?? null,
      node: current?.node ?? null,
      status: current?.status === 'revealed' ? 'revealed' : 'committed',
      committedTxId: meta.txId ?? current?.committedTxId ?? null,
      committedBlockHeight: numberOrNull(meta.blockHeight ?? current?.committedBlockHeight),
      revealedTxId: current?.revealedTxId ?? null,
      revealedBlockHeight: current?.revealedBlockHeight ?? null,
      lastEventType: event.type,
    }
  }

  return {
    commitment,
    controller: event.controller,
    createdAt: current?.createdAt ?? null,
    node: normalizeNode(event.node),
    status: 'revealed',
    committedTxId: current?.committedTxId ?? null,
    committedBlockHeight: current?.committedBlockHeight ?? null,
    revealedTxId: meta.txId ?? current?.revealedTxId ?? null,
    revealedBlockHeight: numberOrNull(meta.blockHeight ?? current?.revealedBlockHeight),
    lastEventType: event.type,
  }
}
