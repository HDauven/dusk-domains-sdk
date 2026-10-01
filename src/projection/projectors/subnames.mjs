import { clearReleasedName } from './lifecycle.mjs'
import {
  activityEntry,
  subnameTimestamp,
} from '../activity.mjs'
import {
  normalizeName,
  normalizeNode,
} from '../keys.mjs'

export function applySubnameEvent(store, event, meta) {
  const parentNode = normalizeNode(event.parentNode)
  const node = normalizeNode(event.node)
  if (event.type !== 'subname_created' || store.subnamesByNode.has(node) || store.namesByNode.has(node)) {
    clearReleasedName(store, node)
    store.namesByNode.delete(node)
  }
  const parent = store.subnamesByNode.get(parentNode) ?? store.namesByNode.get(parentNode)
  const subname = event.type === 'subname_created' ? reduceSubnameEvent(event, meta, parent) : null
  const entry = activityEntry({
    eventType: event.type,
    node,
    name: event.name,
    actor: event.actor,
    target: event.type === 'subname_removed' ? 'removed' : event.type === 'subname_pruned' ? 'pruned' : event.manager,
    timestamp: subnameTimestamp(event),
    meta,
  })

  if (subname) {
    store.subnamesByNode.set(node, subname)
    store.subnamesByCanonical?.set(normalizeName(subname.name), subname)
    store.subnamesByParent.set(parentNode, [
      subname,
      ...(store.subnamesByParent.get(parentNode) ?? []).filter((candidate) => candidate.node !== node),
    ])
  }
  store.activityByNode.set(node, [entry, ...(store.activityByNode.get(node) ?? [])])
  store.activityByNode.set(parentNode, [entry, ...(store.activityByNode.get(parentNode) ?? [])])
  return subname
}

// Renewing a root renews each subname that inherits its expiry. A fixed subname keeps its own,
// and so do the subnames below it.
export function renewInheritingSubnames(store, rootNode) {
  const root = store.namesByNode.get(rootNode)
  const parents = new Set([rootNode])
  for (const parentNode of parents) {
    const children = store.subnamesByParent.get(parentNode)
    if (!children) continue
    store.subnamesByParent.set(parentNode, children.map((subname) => {
      const parentExpiry = {
        parentExpiresAt: root.expiresAt ?? subname.parentExpiresAt,
        parentExpiresAtBlockHeight: root.expiresAtBlockHeight,
      }
      if (subname.expiryPolicy !== 'inherits_parent') {
        const updated = { ...subname, ...parentExpiry }
        store.subnamesByNode.set(subname.node, updated)
        return updated
      }
      const lifecycle = {
        expiresAt: root.expiresAt ?? subname.expiresAt,
        graceEndsAt: root.graceEndsAt,
        expiresAtBlockHeight: root.expiresAtBlockHeight,
        graceEndsAtBlockHeight: root.graceEndsAtBlockHeight,
      }
      const renewed = { ...subname, ...parentExpiry, ...lifecycle }
      store.subnamesByNode.set(subname.node, renewed)
      store.subnamesByCanonical?.set(normalizeName(subname.name), renewed)
      parents.add(subname.node)
      return renewed
    }))
  }
}

function reduceSubnameEvent(event, meta, parent) {
  return {
    parentNode: normalizeNode(event.parentNode),
    node: normalizeNode(event.node),
    parentName: event.parentName,
    name: event.name,
    canonicalName: normalizeName(event.name),
    label: event.label,
    owner: event.owner,
    manager: event.manager,
    resolver: event.resolver,
    expiresAt: event.expiresAt,
    graceEndsAt: parent?.graceEndsAt ?? null,
    parentExpiresAt: event.parentExpiresAt,
    expiresAtBlockHeight: numberOrNull(event.expiresAtBlockHeight),
    graceEndsAtBlockHeight: parent?.graceEndsAtBlockHeight ?? null,
    parentExpiresAtBlockHeight: numberOrNull(event.parentExpiresAtBlockHeight),
    expiryPolicy: event.expiryPolicy,
    status: 'active',
    createdAt: event.createdAt,
    lastEventType: event.type,
    txId: meta.txId ?? null,
    blockHeight: meta.blockHeight ?? null,
  }
}

function numberOrNull(value) {
  if (value == null) return null
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}
