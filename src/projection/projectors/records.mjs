import { activityEntry } from '../activity.mjs'
import { PUBLIC_PRIMARY_ENDPOINT_TYPES } from '../constants.mjs'
import { endpointKey, normalizeNode } from '../keys.mjs'

export function applyResolverEvent(store, event, meta, fallbackTimestamp) {
  const node = normalizeNode(event.node)
  rememberController(store.controllersByNode, node, event.controller)
  const records = store.recordsByNode.get(node) ?? []
  const target = event.type === 'record_changed' ? event.record.key : event.key
  const previousRecord = records.find((record) => record.key === target) ?? null
  const nextRecords = event.type === 'record_changed'
    ? [event.record, ...records.filter((record) => record.key !== event.record.key)]
    : records.filter((record) => record.key !== event.key)

  store.recordsByNode.set(node, nextRecords)
  updateRecordIndexes(store, {
    node,
    key: target,
    event,
    previousRecord,
    meta,
    fallbackTimestamp,
  })
  store.activityByNode.set(node, [
    activityEntry({
      eventType: 'record_update',
      node,
      name: store.namesByNode.get(node)?.canonicalName ?? node,
      actor: event.controller,
      target,
      timestamp: event.type === 'record_changed' ? event.record.updatedAt : fallbackTimestamp,
      meta,
    }),
    ...(store.activityByNode.get(node) ?? []),
  ])
  return store.activityByNode.get(node)[0]
}

export function applyReverseEvent(store, event, meta) {
  if (!PUBLIC_PRIMARY_ENDPOINT_TYPES.has(event.endpoint?.type)) return null
  const node = normalizeNode(event.node)
  rememberController(store.controllersByNode, node, event.controller)
  const name = event.name && event.name.length > 0 ? event.name : null
  const key = endpointKey(event.endpoint)

  const next = {
    key,
    endpoint: event.endpoint,
    controller: event.controller,
    node,
    primaryName: name,
    name,
    previousName: event.previousName ?? null,
    updatedAt: event.updatedAt,
    status: name ? 'set' : 'cleared',
    txId: meta.txId ?? null,
    blockHeight: meta.blockHeight ?? null,
    lastEventType: event.type,
  }

  const previous = store.reverseByEndpoint.get(key)
  if (previous) {
    const keys = store.reverseKeysByNode.get(previous.node)
    keys?.delete(key)
    if (keys?.size === 0) store.reverseKeysByNode.delete(previous.node)
  }
  if (name) {
    const keys = store.reverseKeysByNode.get(node) ?? new Set()
    keys.add(key)
    store.reverseKeysByNode.set(node, keys)
    store.reverseByEndpoint.set(key, next)
  } else {
    store.reverseByEndpoint.delete(key)
  }

  store.activityByNode.set(node, [
    activityEntry({
      eventType: name ? 'primary_name_set' : 'primary_name_cleared',
      node,
      name: name ?? event.previousName ?? store.namesByNode.get(node)?.canonicalName ?? node,
      actor: event.controller,
      target: key,
      timestamp: event.updatedAt,
      meta,
    }),
    ...(store.activityByNode.get(node) ?? []),
  ])
  return next
}

export function collectSnapshotControllers(name) {
  const controllers = new Set()
  if (Array.isArray(name.controllers)) {
    for (const controller of name.controllers) rememberControllerValue(controllers, controller)
  }
  if (Array.isArray(name.activity)) {
    for (const entry of name.activity) {
      if (['record_update', 'primary_name', 'primary_name_set', 'primary_name_cleared'].includes(entry?.eventType)) {
        rememberControllerValue(controllers, entry.actor)
      }
    }
  }
  return controllers
}

export function recordIndexKey(node, key) {
  return `${normalizeNode(node)}\u0000${String(key ?? '')}`
}

export function rebuildCurrentRecordIndexes(recordsByNode) {
  const recordsByNodeKey = new Map()

  for (const [node, records] of recordsByNode ?? []) {
    for (const record of records ?? []) {
      if (!record?.key) continue
      recordsByNodeKey.set(recordIndexKey(node, record.key), record)
    }
  }

  return recordsByNodeKey
}

export function appendRecordHistory(store, historyEvent) {
  if (!store.recordHistoryByNode || !store.recordHistoryByNodeKey) return

  const node = normalizeNode(historyEvent.node)
  const key = String(historyEvent.key ?? '')
  const normalized = {
    ...historyEvent,
    node,
    key,
  }

  store.recordHistoryByNode.set(node, [
    normalized,
    ...(store.recordHistoryByNode.get(node) ?? []),
  ])

  const nodeKey = recordIndexKey(node, key)
  store.recordHistoryByNodeKey.set(nodeKey, [
    normalized,
    ...(store.recordHistoryByNodeKey.get(nodeKey) ?? []),
  ])
}

function rememberController(controllersByNode, node, controller) {
  if (!controllersByNode) return
  const current = controllersByNode.get(node) ?? new Set()
  rememberControllerValue(current, controller)
  controllersByNode.set(node, current)
}

function rememberControllerValue(controllers, controller) {
  const value = String(controller ?? '').trim()
  if (value) controllers.add(value)
}

function updateRecordIndexes(store, input) {
  if (store.recordsByNodeKey) {
    const nodeKey = recordIndexKey(input.node, input.key)
    if (input.event.type === 'record_changed') {
      store.recordsByNodeKey.set(nodeKey, input.event.record)
    } else {
      store.recordsByNodeKey.delete(nodeKey)
    }
  }

  appendRecordHistory(store, {
    node: input.node,
    key: input.key,
    action: input.event.type === 'record_changed' ? 'set' : 'clear',
    record: input.event.type === 'record_changed' ? input.event.record : null,
    previousRecord: input.previousRecord,
    controller: input.event.controller,
    updatedAt: input.event.type === 'record_changed'
      ? input.event.record.updatedAt
      : input.fallbackTimestamp,
    txId: input.meta.txId ?? null,
    blockHeight: finiteNumberOrNull(input.meta.blockHeight),
    eventIndex: finiteNumberOrNull(input.meta.eventIndex),
    eventType: input.event.type,
  })
}

function finiteNumberOrNull(value) {
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}
