import { createActivityEntry, type ActivityEntry } from './activity'
import { getRecordDefinition } from './records'
import type {
  FeeConfigEvent,
  IndexedEndpoint,
  IndexedFeeConfig,
  IndexedLifecycleName,
  IndexedReferralState,
  IndexedRegistrationCommitment,
  IndexedResolverRecordSet,
  IndexedReversePrimaryName,
  IndexedSubname,
  IndexedTreasuryState,
  IndexerEventMeta,
  LifecycleEventProjector,
  NameLifecycleEvent,
  ReferralEvent,
  RegistrationControllerEvent,
  ResolverRecordEvent,
  ReverseRegistryEvent,
  SubnameRegistryEvent,
  TreasuryEvent,
} from './indexerTypes'
import {
  emptyFeeConfig,
  emptyReferralState,
  emptyTreasuryState,
  reduceFeeConfig,
  reduceReferralState,
  reduceTreasuryReferralClaim,
  reduceTreasuryReferralReserve,
  reduceTreasuryState,
  referralKey,
} from './economicProjectorReducers'
import {
  activityTargetFromLifecycleEvent,
  activityTypeFromLifecycleEvent,
  canonicalNameFromLifecycleEvent,
  endpointKey,
  lifecycleAllowsActiveNamespace,
  reduceLifecycleName,
  reduceRegistrationCommitment,
  reduceResolverRecords,
  reduceReversePrimaryName,
  reduceSubname,
} from './lifecycleProjectorReducers'

export function createLifecycleEventProjector(): LifecycleEventProjector {
  const names = new Map<string, IndexedLifecycleName>()
  const commitments = new Map<string, IndexedRegistrationCommitment>()
  const resolverRecords = new Map<string, IndexedResolverRecordSet>()
  const primaryNames = new Map<string, IndexedReversePrimaryName>()
  const subnames = new Map<string, IndexedSubname>()
  const referrals = new Map<string, IndexedReferralState>()
  const activity = new Map<string, ActivityEntry[]>()
  let treasuryState: IndexedTreasuryState = emptyTreasuryState()
  let feeConfig: IndexedFeeConfig = emptyFeeConfig()
  let referralRewardsSupported = false

  function apply(event: NameLifecycleEvent, meta: IndexerEventMeta = {}) {
    const current = names.get(event.node)
    const canonicalName = canonicalNameFromLifecycleEvent(event, current)
    const entry = createActivityEntry({
      eventType: activityTypeFromLifecycleEvent(event),
      node: event.node,
      name: canonicalName,
      actor: event.actor,
      target: activityTargetFromLifecycleEvent(event),
      txId: meta.txId,
      blockHeight: meta.blockHeight ?? null,
    })

    names.set(event.node, reduceLifecycleName(event, current, canonicalName))
    if (event.type === 'name_released') clearNodeTreeDerivedState(event.node)
    activity.set(event.node, [entry, ...(activity.get(event.node) ?? [])])
    return entry
  }

  function applyController(event: RegistrationControllerEvent, meta: IndexerEventMeta = {}) {
    const current = commitments.get(event.commitment)
    const next = reduceRegistrationCommitment(event, current, meta)

    commitments.set(event.commitment, next)
    return next
  }

  function applyResolver(event: ResolverRecordEvent, meta: IndexerEventMeta = {}) {
    const current = resolverRecords.get(event.node)
    const next = reduceResolverRecords(event, current)
    const canonicalName = names.get(event.node)?.canonicalName ?? event.node
    const entry = createActivityEntry({
      eventType: 'record_update',
      node: event.node,
      name: canonicalName,
      actor: event.controller,
      target: event.type === 'record_changed' ? event.record.key : event.key,
      timestamp: event.type === 'record_changed' ? event.record.updatedAt : undefined,
      txId: meta.txId,
      blockHeight: meta.blockHeight ?? null,
    })

    resolverRecords.set(event.node, next)
    activity.set(event.node, [entry, ...(activity.get(event.node) ?? [])])
    return entry
  }

  function applyReverse(event: ReverseRegistryEvent, meta: IndexerEventMeta = {}) {
    if (!getRecordDefinition(event.endpoint.type)?.eligibleForPrimaryName) return null

    const next = reduceReversePrimaryName(event, meta)
    const canonicalName = event.name || names.get(event.node)?.canonicalName || event.node
    const entry = createActivityEntry({
      eventType: 'primary_name',
      node: event.node,
      name: canonicalName,
      actor: event.controller,
      target: endpointKey(event.endpoint),
      timestamp: event.updatedAt,
      txId: meta.txId,
      blockHeight: meta.blockHeight ?? null,
    })

    if (next.status === 'set') {
      primaryNames.set(next.key, next)
    } else {
      primaryNames.delete(next.key)
    }
    activity.set(event.node, [entry, ...(activity.get(event.node) ?? [])])
    return next
  }

  function applySubname(event: SubnameRegistryEvent, meta: IndexerEventMeta = {}) {
    const current = subnames.get(event.node)
    const next = reduceSubname(event, current, meta)
    const entry = createActivityEntry({
      eventType: event.type,
      node: event.node,
      name: event.name,
      actor: event.actor,
      target: event.type === 'subname_created'
        ? event.manager
        : event.type === 'subname_delegated'
          ? event.manager
          : 'revoked',
      timestamp: event.type === 'subname_created'
        ? event.createdAt
        : event.type === 'subname_delegated'
          ? event.delegatedAt
          : event.revokedAt,
      txId: meta.txId,
      blockHeight: meta.blockHeight ?? null,
    })

    subnames.set(event.node, next)
    activity.set(event.node, [entry, ...(activity.get(event.node) ?? [])])
    activity.set(event.parentNode, [entry, ...(activity.get(event.parentNode) ?? [])])
    return next
  }

  function applyTreasury(event: TreasuryEvent, meta: IndexerEventMeta = {}) {
    treasuryState = reduceTreasuryState(event, treasuryState, meta)
    if (event.type === 'treasury_initialized') referralRewardsSupported = true
    return treasuryState
  }

  function applyReferral(event: ReferralEvent, meta: IndexerEventMeta = {}) {
    referralRewardsSupported = true
    treasuryState = reduceTreasuryReferralReserve(event, treasuryState)
    treasuryState = reduceTreasuryReferralClaim(event, treasuryState)
    const key = referralKey(event.referrer)
    const current = referrals.get(key) ?? emptyReferralState(key, true)
    const next = reduceReferralState(event, current, meta)

    referrals.set(key, next)
    return next
  }

  function applyFeeConfig(event: FeeConfigEvent, meta: IndexerEventMeta = {}) {
    feeConfig = reduceFeeConfig(event, feeConfig, meta)
    return { ...feeConfig }
  }

  function getNameByNode(node: string) {
    return names.get(node) ?? null
  }

  function getCommitment(commitment: string) {
    return commitments.get(commitment) ?? null
  }

  function getResolverRecords(node: string) {
    return [...(resolverRecords.get(node)?.records ?? [])]
  }

  function getPrimaryNameByEndpoint(endpoint: IndexedEndpoint) {
    return primaryNames.get(endpointKey(endpoint)) ?? null
  }

  function getSubnameByNode(node: string) {
    const subname = subnames.get(node)
    if (!subname) return null
    return subnameIsLive(subname, new Date()) ? subname : null
  }

  function getSubnamesByParent(parentNode: string) {
    const now = new Date()
    if (!namespaceNodeIsLive(parentNode, now)) return []
    return [...subnames.values()].filter((subname) => (
      subname.parentNode === parentNode
      && subnameIsLive(subname, now)
    ))
  }

  function getTreasuryState() {
    return { ...treasuryState }
  }

  function getReferralState(referrer: string) {
    return referrals.get(referralKey(referrer)) ?? emptyReferralState(referrer, referralRewardsSupported)
  }

  function getFeeConfig() {
    return { ...feeConfig }
  }

  function getActivity(node: string) {
    return [...(activity.get(node) ?? [])]
  }

  function clearNodeTreeDerivedState(node: string) {
    const staleNodes = collectNodeTree(node)
    for (const staleNode of staleNodes) {
      resolverRecords.delete(staleNode)
      subnames.delete(staleNode)
    }

    for (const [key, primaryName] of primaryNames) {
      if (staleNodes.has(primaryName.node)) primaryNames.delete(key)
    }
  }

  function collectNodeTree(rootNode: string) {
    const staleNodes = new Set([rootNode])
    let grew = true
    while (grew) {
      grew = false
      for (const subname of subnames.values()) {
        if (staleNodes.has(subname.parentNode) && !staleNodes.has(subname.node)) {
          staleNodes.add(subname.node)
          grew = true
        }
      }
    }
    return staleNodes
  }

  function namespaceNodeIsLive(node: string, now: Date, seen = new Set<string>()): boolean {
    if (seen.has(node)) return false
    seen.add(node)

    const lifecycle = names.get(node)
    if (lifecycle) return lifecycleAllowsActiveNamespace(lifecycle, now)

    const subname = subnames.get(node)
    return subname ? subnameIsLive(subname, now, seen) : false
  }

  function subnameIsLive(
    subname: IndexedSubname,
    now: Date,
    seen = new Set<string>(),
  ): boolean {
    return subname.status === 'active'
      && subnameExpiresAfter(subname.expiresAt, now)
      && namespaceNodeIsLive(subname.parentNode, now, seen)
  }

  return {
    apply,
    applyController,
    applyResolver,
    applyReverse,
    applySubname,
    applyTreasury,
    applyReferral,
    applyFeeConfig,
    getNameByNode,
    getCommitment,
    getResolverRecords,
    getPrimaryNameByEndpoint,
    getSubnameByNode,
    getSubnamesByParent,
    getTreasuryState,
    getReferralState,
    getFeeConfig,
    getActivity,
  }
}

function subnameExpiresAfter(expiresAt: string, now: Date) {
  const timestamp = new Date(expiresAt).getTime()
  if (!Number.isFinite(timestamp)) return false
  return timestamp > now.getTime()
}
