import type { ActivityEntry } from './activity'
import type {
  IndexedEndpoint,
  IndexedLifecycleName,
  IndexedRegistrationCommitment,
  IndexedResolverRecordSet,
  IndexedReversePrimaryName,
  IndexedSubname,
  IndexerEventMeta,
  NameLifecycleEvent,
  RegistrationControllerEvent,
  ResolverRecordEvent,
  ReverseRegistryEvent,
  SubnameRegistryEvent,
} from './indexerTypes'

export function canonicalNameFromLifecycleEvent(
  event: NameLifecycleEvent,
  current: IndexedLifecycleName | undefined,
) {
  if ('label' in event) return `${event.label}.dusk`
  return current?.canonicalName ?? event.node
}

export function activityTypeFromLifecycleEvent(event: NameLifecycleEvent): ActivityEntry['eventType'] {
  if (event.type === 'name_registered') return 'registration'
  if (event.type === 'name_renewed') return 'renewal'
  if (event.type === 'name_expired') return 'expiry'
  if (event.type === 'name_released') return 'release'
  if (event.type === 'name_owner_changed') return 'transfer'
  if (event.type === 'resolver_changed') return 'resolver_change'
  return 'record_update'
}

export function activityTargetFromLifecycleEvent(event: NameLifecycleEvent) {
  if (event.type === 'name_registered') return event.owner
  if (event.type === 'name_renewed') return event.expiresAt
  if (event.type === 'name_expired') return event.observedAt
  if (event.type === 'name_released') return event.previousOwner
  if (event.type === 'name_owner_changed') return event.owner
  if (event.type === 'resolver_changed') return event.resolver
  return undefined
}

export function reduceLifecycleName(
  event: NameLifecycleEvent,
  current: IndexedLifecycleName | undefined,
  canonicalName: string,
): IndexedLifecycleName {
  const base = current ?? {
    node: event.node,
    canonicalName,
    owner: null,
    manager: null,
    resolverId: null,
    expiresAt: null,
    graceEndsAt: null,
    expiresAtBlockHeight: null,
    graceEndsAtBlockHeight: null,
    status: 'active' as const,
    lastEventType: event.type,
  }

  if (event.type === 'name_registered') {
    return {
      ...base,
      canonicalName,
      owner: event.owner,
      expiresAt: event.expiresAt,
      graceEndsAt: event.graceEndsAt,
      expiresAtBlockHeight: event.expiresAtBlockHeight ?? null,
      graceEndsAtBlockHeight: event.graceEndsAtBlockHeight ?? null,
      status: 'active',
      lastEventType: event.type,
    }
  }

  if (event.type === 'name_renewed') {
    return {
      ...base,
      expiresAt: event.expiresAt,
      graceEndsAt: event.graceEndsAt,
      expiresAtBlockHeight: event.expiresAtBlockHeight ?? base.expiresAtBlockHeight ?? null,
      graceEndsAtBlockHeight: event.graceEndsAtBlockHeight ?? base.graceEndsAtBlockHeight ?? null,
      status: 'active',
      lastEventType: event.type,
    }
  }

  if (event.type === 'name_expired') {
    return {
      ...base,
      canonicalName,
      owner: event.owner,
      expiresAt: event.expiresAt,
      graceEndsAt: event.graceEndsAt,
      expiresAtBlockHeight: event.expiresAtBlockHeight ?? base.expiresAtBlockHeight ?? null,
      graceEndsAtBlockHeight: event.graceEndsAtBlockHeight ?? base.graceEndsAtBlockHeight ?? null,
      status: 'expired',
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
      owner: event.owner,
      manager: event.manager,
      resolverId: event.resolver,
      expiresAt: event.expiresAt ?? base.expiresAt ?? null,
      expiresAtBlockHeight: event.expiresAtBlockHeight ?? base.expiresAtBlockHeight ?? null,
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

export function lifecycleAllowsActiveNamespace(lifecycle: IndexedLifecycleName | undefined, now: Date) {
  if (!lifecycle) return false
  if (lifecycle.status === 'released') return false
  if (lifecycle.graceEndsAt && new Date(lifecycle.graceEndsAt).getTime() <= now.getTime()) return false
  return true
}

export function reduceRegistrationCommitment(
  event: RegistrationControllerEvent,
  current: IndexedRegistrationCommitment | undefined,
  meta: IndexerEventMeta,
): IndexedRegistrationCommitment {
  if (event.type === 'registration_committed') {
    return {
      commitment: event.commitment,
      controller: event.controller,
      createdAt: event.createdAt,
      node: current?.node ?? null,
      status: current?.status === 'revealed' ? 'revealed' : 'committed',
      committedTxId: meta.txId ?? current?.committedTxId ?? null,
      committedBlockHeight: meta.blockHeight ?? current?.committedBlockHeight ?? null,
      revealedTxId: current?.revealedTxId ?? null,
      revealedBlockHeight: current?.revealedBlockHeight ?? null,
      lastEventType: event.type,
    }
  }

  return {
    commitment: event.commitment,
    controller: event.controller,
    createdAt: current?.createdAt ?? null,
    node: event.node,
    status: 'revealed',
    committedTxId: current?.committedTxId ?? null,
    committedBlockHeight: current?.committedBlockHeight ?? null,
    revealedTxId: meta.txId ?? current?.revealedTxId ?? null,
    revealedBlockHeight: meta.blockHeight ?? current?.revealedBlockHeight ?? null,
    lastEventType: event.type,
  }
}

export function reduceResolverRecords(
  event: ResolverRecordEvent,
  current: IndexedResolverRecordSet | undefined,
): IndexedResolverRecordSet {
  const records = current?.records ?? []

  if (event.type === 'record_changed') {
    return {
      node: event.node,
      records: [
        event.record,
        ...records.filter((record) => record.key !== event.record.key),
      ],
      lastController: event.controller,
      lastUpdatedAt: event.record.updatedAt,
      lastEventType: event.type,
    }
  }

  return {
    node: event.node,
    records: records.filter((record) => record.key !== event.key),
    lastController: event.controller,
    lastUpdatedAt: null,
    lastEventType: event.type,
  }
}

export function reduceReversePrimaryName(
  event: ReverseRegistryEvent,
  meta: IndexerEventMeta,
): IndexedReversePrimaryName {
  const name = event.name && event.name.length > 0 ? event.name : null

  return {
    key: endpointKey(event.endpoint),
    endpoint: event.endpoint,
    controller: event.controller,
    node: event.node,
    name,
    previousName: event.previousName,
    updatedAt: event.updatedAt,
    status: name ? 'set' : 'cleared',
    txId: meta.txId ?? null,
    blockHeight: meta.blockHeight ?? null,
    lastEventType: event.type,
  }
}

export function reduceSubname(
  event: SubnameRegistryEvent,
  current: IndexedSubname | undefined,
  meta: IndexerEventMeta,
): IndexedSubname {
  if (event.type === 'subname_created') {
    return {
      parentNode: event.parentNode,
      node: event.node,
      parentName: event.parentName,
      name: event.name,
      label: event.label,
      owner: event.owner,
      manager: event.manager,
      resolver: event.resolver,
      expiresAt: event.expiresAt,
      parentExpiresAt: event.parentExpiresAt,
      expiresAtBlockHeight: event.expiresAtBlockHeight ?? null,
      parentExpiresAtBlockHeight: event.parentExpiresAtBlockHeight ?? null,
      expiryPolicy: event.expiryPolicy,
      revocationPolicy: event.revocationPolicy,
      status: 'active',
      createdAt: event.createdAt,
      revokedAt: null,
      lastEventType: event.type,
      txId: meta.txId ?? null,
      blockHeight: meta.blockHeight ?? null,
    }
  }

  const base = current ?? {
    parentNode: event.parentNode,
    node: event.node,
    parentName: event.name.split('.').slice(1).join('.'),
    name: event.name,
    label: event.name.split('.')[0] ?? event.name,
    owner: '',
    manager: '',
    resolver: '',
    expiresAt: '',
    parentExpiresAt: '',
    expiresAtBlockHeight: null,
    parentExpiresAtBlockHeight: null,
    expiryPolicy: 'inherits_parent' as const,
    revocationPolicy: 'parent_revocable' as const,
    status: 'active' as const,
    createdAt: '',
    revokedAt: null,
    lastEventType: event.type,
    txId: null,
    blockHeight: null,
  }

  if (event.type === 'subname_delegated') {
    return {
      ...base,
      manager: event.manager,
      status: base.status === 'revoked' ? 'revoked' : 'active',
      lastEventType: event.type,
      txId: meta.txId ?? base.txId,
      blockHeight: meta.blockHeight ?? base.blockHeight,
    }
  }

  return {
    ...base,
    status: 'revoked',
    revokedAt: event.revokedAt,
    lastEventType: event.type,
    txId: meta.txId ?? base.txId,
    blockHeight: meta.blockHeight ?? base.blockHeight,
  }
}

export function endpointKey(endpoint: IndexedEndpoint) {
  return `${endpoint.type}:${endpoint.value}`
}
