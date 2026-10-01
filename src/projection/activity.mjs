export function activityEntry(input) {
  return {
    id: [
      input.eventType,
      input.node,
      input.actor,
      input.meta?.eventId ?? input.meta?.txId ?? input.timestamp,
    ].filter(Boolean).join(':'),
    eventType: input.eventType,
    node: input.node,
    name: input.name,
    actor: input.actor,
    target: input.target ?? null,
    timestamp: input.meta?.observedAt ?? input.timestamp ?? '',
    blockHeight: input.meta?.blockHeight ?? null,
    ...(input.meta?.txId ? { txId: input.meta.txId } : {}),
  }
}

export function lifecycleActivityType(type) {
  if (type === 'name_registered' || type === 'reserved_name_issued') return 'registration'
  if (type === 'name_renewed') return 'renewal'
  if (type === 'name_expired') return 'expiry'
  if (type === 'name_released') return 'release'
  if (type === 'name_owner_changed') return 'transfer'
  if (type === 'resolver_changed') return 'resolver_change'
  return 'record_update'
}

export function lifecycleActivityTarget(event) {
  if (event.type === 'name_registered' || event.type === 'reserved_name_issued') return event.owner
  if (event.type === 'name_renewed') return event.expiresAt
  if (event.type === 'name_expired') return event.observedAt
  if (event.type === 'name_released') return event.previousOwner
  if (event.type === 'name_owner_changed') return event.owner
  if (event.type === 'resolver_changed') return event.resolver
  return undefined
}

export function lifecycleTimestamp(event) {
  if (event.type === 'name_expired') return event.observedAt
  if (event.type === 'name_released') return event.releasedAt
  return undefined
}

export function subnameTimestamp(event) {
  if (event.type === 'subname_created') return event.createdAt
  return event.removedAt ?? event.prunedAt
}

export function eventTimestamp(event, meta = {}) {
  return meta.observedAt
    ?? event?.updatedAt
    ?? event?.createdAt
    ?? event?.releasedAt
    ?? event?.observedAt
    ?? event?.removedAt
    ?? event?.prunedAt
    ?? event?.record?.updatedAt
    ?? null
}
