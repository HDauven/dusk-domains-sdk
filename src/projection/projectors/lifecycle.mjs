import { sumAccountingLux } from '../accounting.mjs'
import {
  activityEntry,
  lifecycleActivityTarget,
  lifecycleActivityType,
  lifecycleTimestamp,
} from '../activity.mjs'
import {
  normalizeName,
  normalizeNode,
  numberOrNull,
} from '../keys.mjs'

export function applyLifecycleEvent(store, event, meta, fallbackTimestamp) {
  const node = normalizeNode(event.node)
  const current = store.namesByNode.get(node)
  const subname = store.subnamesByNode.get(node)
  const canonicalName = 'label' in event ? `${event.label}.dusk` : subname?.canonicalName ?? current?.canonicalName ?? node

  if (subname && (event.type === 'name_owner_changed' || event.type === 'resolver_changed')) {
    const updated = { ...subname, resolver: event.resolver, lastEventType: event.type,
      ...(event.type === 'name_owner_changed' ? { owner: event.owner, manager: event.manager } : {}) }
    store.subnamesByNode.set(node, updated)
    store.subnamesByCanonical?.set(canonicalName, updated)
    store.subnamesByParent.set(subname.parentNode, (store.subnamesByParent.get(subname.parentNode) ?? [])
      .map(candidate => candidate.node === node ? updated : candidate))
    store.namesByNode.delete(node)
  } else {
    store.namesByNode.set(node, reduceLifecycleEvent(event, current, canonicalName))
  }
  if (event.type === 'name_owner_changed' && event.dataCleared) clearNodeIdentity(store, node)
  store.activityByNode.set(node, [
    activityEntry({
      eventType: lifecycleActivityType(event.type),
      node,
      name: canonicalName,
      actor: event.actor,
      target: lifecycleActivityTarget(event),
      timestamp: lifecycleTimestamp(event) ?? fallbackTimestamp,
      meta,
    }),
    ...(store.activityByNode.get(node) ?? []),
  ])
  if (event.type === 'name_registered') {
    // Statistics must never discard an otherwise valid lifecycle update.
    try {
      store.treasuryState.premiumReceivedLux = sumAccountingLux(store.treasuryState.premiumReceivedLux ?? 0, event.premiumLux ?? 0)
    } catch (error) {
      store.treasuryState.premiumAccountingError = error.message
    }
  }
}

// Moved records keep their content; the name now resolves through the resolver holding them.
// Keep the subname indexes aligned with its resolver.
export function applyRecordsMoved(store, event, meta, fallbackTimestamp) {
  const node = normalizeNode(event.node)
  if (store.namesByNode.has(node)) {
    const resolverChanged = { type: 'resolver_changed', node, actor: event.controller, resolver: event.toResolver }
    applyLifecycleEvent(store, resolverChanged, meta, fallbackTimestamp)
  }
  const subname = store.subnamesByNode.get(node)
  if (!subname) return
  const moved = { ...subname, resolver: event.toResolver }
  const parentNode = normalizeNode(subname.parentNode)
  store.subnamesByNode.set(node, moved)
  store.subnamesByCanonical?.set(normalizeName(subname.name), moved)
  const siblings = store.subnamesByParent.get(parentNode) ?? []
  store.subnamesByParent.set(parentNode, siblings.map((candidate) => (candidate.node === node ? moved : candidate)))
}

// Clear descendants and any legacy lifecycle rows when a namespace is released.
export function clearReleasedName(store, node) {
  for (const staleNode of clearNodeDerivedState({ ...store, node })) {
    if (staleNode !== node) store.namesByNode.delete(staleNode)
  }
}

export function clearNodeDerivedState({
  node,
  recordsByNode,
  recordsByNodeKey,
  reverseByEndpoint,
  reverseKeysByNode,
  controllersByNode,
  subnamesByNode,
  subnamesByParent,
  subnamesByCanonical,
}) {
  const normalizedNode = normalizeNode(node)
  const staleNodes = collectNodeTree(normalizedNode, subnamesByParent)

  for (const staleNode of staleNodes) {
    const records = recordsByNode.get(staleNode) ?? []
    recordsByNode.delete(staleNode)
    controllersByNode.delete(staleNode)
    if (recordsByNodeKey) {
      for (const record of records) {
        if (record?.key) recordsByNodeKey.delete(`${staleNode}\u0000${record.key}`)
      }
    }

    const subname = subnamesByNode?.get(staleNode)
    if (subname?.name) subnamesByCanonical?.delete(normalizeName(subname.name))
    if (subname && !staleNodes.has(subname.parentNode)) {
      const siblings = subnamesByParent.get(subname.parentNode) ?? []
      const remaining = siblings.filter((sibling) => sibling.node !== staleNode)
      if (remaining.length > 0) subnamesByParent.set(subname.parentNode, remaining)
      else subnamesByParent.delete(subname.parentNode)
    }
    subnamesByParent?.delete(staleNode)
    subnamesByNode?.delete(staleNode)
    for (const key of reverseKeysByNode.get(staleNode) ?? []) reverseByEndpoint.delete(key)
    reverseKeysByNode.delete(staleNode)
  }
  return staleNodes
}

function collectNodeTree(rootNode, subnamesByParent) {
  const staleNodes = new Set([rootNode])
  for (const node of staleNodes) {
    for (const child of subnamesByParent?.get(node) ?? []) staleNodes.add(child.node)
  }
  return staleNodes
}

function reduceLifecycleEvent(event, current, canonicalName) {
  const base = current ?? {
    node: normalizeNode(event.node),
    canonicalName,
    owner: null,
    manager: null,
    resolverId: null,
    expiresAt: null,
    graceEndsAt: null,
    expiresAtBlockHeight: null,
    graceEndsAtBlockHeight: null,
    status: 'active',
    lastEventType: event.type,
  }

  if (event.type === 'reserved_name_issued') {
    return {
      ...base,
      issuedAsReserved: true,
      reservedIssuance: {
        operator: event.operator,
        registry: event.registry,
        issuedAt: event.issuedAt,
        issuedAtBlockHeight: event.issuedAtBlockHeight,
      },
      lastEventType: event.type,
    }
  }

  if (event.type === 'name_registered' || event.type === 'name_renewed' || event.type === 'name_expired') {
    const retained = event.type === 'name_registered' ? null : base
    return {
      ...base,
      ...(event.type === 'name_registered' ? { issuedAsReserved: false, reservedIssuance: null, namespacePurchase: null, registrationPremiumLux: event.premiumLux ?? 0 } : {}),
      ...(event.type === 'name_renewed' ? {} : { canonicalName, owner: event.owner }),
      expiresAt: event.expiresAt,
      graceEndsAt: event.graceEndsAt,
      expiresAtBlockHeight: numberOrNull(event.expiresAtBlockHeight ?? retained?.expiresAtBlockHeight),
      graceEndsAtBlockHeight: numberOrNull(event.graceEndsAtBlockHeight ?? retained?.graceEndsAtBlockHeight),
      status: event.type === 'name_expired' ? 'expired' : 'active',
      lastEventType: event.type,
    }
  }

  if (event.type === 'name_released') {
    return {
      ...base,
      canonicalName,
      owner: null,
      manager: null,
      resolverId: null,
      expiresAtBlockHeight: null,
      graceEndsAtBlockHeight: null,
      status: 'released',
      lastEventType: event.type,
    }
  }

  if (event.type === 'name_owner_changed') {
    return {
      ...base,
      namespacePurchase: base.owner === event.owner || base.namespacePurchase?.buyer === event.owner ? base.namespacePurchase : null,
      owner: event.owner,
      manager: event.manager,
      resolverId: event.resolver,
      expiresAt: event.expiresAt ?? base.expiresAt ?? null,
      expiresAtBlockHeight: numberOrNull(event.expiresAtBlockHeight ?? base.expiresAtBlockHeight),
      status: 'active',
      lastEventType: event.type,
    }
  }

  return {
    ...base,
    resolverId: event.resolver,
    lastEventType: event.type,
  }
}

function clearNodeIdentity(store, node) {
  for (const record of store.recordsByNode.get(node) ?? []) store.recordsByNodeKey?.delete(`${node}\u0000${record.key}`)
  store.recordsByNode.delete(node)
  store.controllersByNode.delete(node)
  for (const key of store.reverseKeysByNode.get(node) ?? []) store.reverseByEndpoint.delete(key)
  store.reverseKeysByNode.delete(node)
}
