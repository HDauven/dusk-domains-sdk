import { createActivityEntry, type ActivityEntry } from './activity'
import { getRecordDefinition } from '../core/records'
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
  PoolEvent,
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
import { createMarketplaceProjector } from './marketplaceProjector'
import { emptyPoolState, reducePoolState } from './poolProjectorReducers'

export function createLifecycleEventProjector(): LifecycleEventProjector {
  const names = new Map<string, IndexedLifecycleName>()
  // Keyed by controller and hash, as the core contract keys pending commitments.
  const commitments = new Map<string, IndexedRegistrationCommitment>()
  const latestCommitments = new Map<string, IndexedRegistrationCommitment>()
  const resolverRecords = new Map<string, IndexedResolverRecordSet>()
  const primaryNames = new Map<string, IndexedReversePrimaryName>()
  const subnames = new Map<string, IndexedSubname>()
  const childNodesByParent = new Map<string, Set<string>>()
  const primaryKeysByNode = new Map<string, Set<string>>()
  const referrals = new Map<string, IndexedReferralState>()
  const activity = new Map<string, ActivityEntry[]>()
  let treasuryState: IndexedTreasuryState = emptyTreasuryState()
  let feeConfig: IndexedFeeConfig = emptyFeeConfig()
  let poolState = emptyPoolState()
  let referralRewardsSupported = false
  const marketplace = createMarketplaceProjector({
    getName: (node) => names.get(node),
    addActivity: (node, entry) => activity.set(node, [entry, ...(activity.get(node) ?? [])]),
  })

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

    // The contract clears a lapsed name it registers again without emitting name_released.
    if (event.type === 'name_registered' && current) clearNodeTreeDerivedState(event.node)
    const reduced = reduceLifecycleName(event, current, canonicalName)
    // An authority change gives a subname a name row, which starts with the subname's grace end.
    const subname = current ? undefined : subnames.get(event.node)
    const next = subname
      ? { ...reduced, graceEndsAt: subname.graceEndsAt ?? null, graceEndsAtBlockHeight: subname.graceEndsAtBlockHeight ?? null }
      : reduced
    names.set(event.node, next)
    if (event.type === 'name_renewed') renewInheritingSubnames(event.node, next)
    if (event.type === 'name_released') clearNodeTreeDerivedState(event.node)
    activity.set(event.node, [entry, ...(activity.get(event.node) ?? [])])
    return entry
  }

  function applyController(event: RegistrationControllerEvent, meta: IndexerEventMeta = {}) {
    const key = commitmentKey(event.controller, event.commitment)
    const next = reduceRegistrationCommitment(event, commitments.get(key), meta)

    commitments.set(key, next)
    latestCommitments.set(event.commitment, next)
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

    const previous = primaryNames.get(next.key)
    if (previous) removeIndexEntry(primaryKeysByNode, previous.node, next.key)
    if (next.status === 'set') {
      primaryNames.set(next.key, next)
      addIndexEntry(primaryKeysByNode, next.node, next.key)
    } else {
      primaryNames.delete(next.key)
    }
    activity.set(event.node, [entry, ...(activity.get(event.node) ?? [])])
    return next
  }

  function applySubname(event: SubnameRegistryEvent, meta: IndexerEventMeta = {}) {
    if (event.type === 'subname_pruned' || subnames.has(event.node) || names.has(event.node)) {
      clearNodeTreeDerivedState(event.node)
      names.delete(event.node)
    }
    const next = event.type === 'subname_created'
      ? reduceSubname(event, meta, subnames.get(event.parentNode) ?? names.get(event.parentNode))
      : null
    const entry = createActivityEntry({
      eventType: event.type,
      node: event.node,
      name: event.name,
      actor: event.actor,
      target: event.type === 'subname_created' ? event.manager : 'pruned',
      timestamp: event.type === 'subname_created' ? event.createdAt : event.prunedAt,
      txId: meta.txId,
      blockHeight: meta.blockHeight ?? null,
    })

    if (next) {
      subnames.set(event.node, next)
      addIndexEntry(childNodesByParent, event.parentNode, event.node)
    }
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

  const applyMarketplace = marketplace.apply

  function getNameByNode(node: string) {
    return names.get(node) ?? null
  }

  function getCommitment(commitment: string, controller?: string) {
    if (controller) return commitments.get(commitmentKey(controller, commitment)) ?? null
    return latestCommitments.get(commitment) ?? null
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
    return [...(childNodesByParent.get(parentNode) ?? [])]
      .map((node) => subnames.get(node)!)
      .filter((subname) => subnameIsLive(subname, now))
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

  function applyPool(event: PoolEvent, meta: IndexerEventMeta = {}) {
    poolState = reducePoolState(event, poolState, meta)
    // Moved records keep their content; the name now resolves through the resolver holding them.
    // A subname whose authorities changed has a name row too, and both follow the move.
    if (event.type === 'records_moved') {
      const subname = subnames.get(event.node)
      if (names.has(event.node)) {
        apply({ type: 'resolver_changed', node: event.node, actor: event.controller, resolver: event.toResolver }, meta)
      }
      if (subname) {
        subnames.set(event.node, { ...subname, resolver: event.toResolver })
      }
    }
    // The router starts with a fee config; later changes arrive as fee_config_updated.
    if (event.type === 'router_initialized') {
      feeConfig = reduceFeeConfig(
        { type: 'fee_config_updated', operator: event.operator, config: event.feeConfig },
        feeConfig,
        meta,
      )
    }
    return getPoolState()
  }

  function getPoolState() {
    return { ...poolState, registries: [...poolState.registries], resolvers: [...poolState.resolvers] }
  }

  function getActivity(node: string) {
    return [...(activity.get(node) ?? [])]
  }

  function clearNodeTreeDerivedState(node: string) {
    const staleNodes = collectNodeTree(node)
    for (const staleNode of staleNodes) {
      resolverRecords.delete(staleNode)
      const subname = subnames.get(staleNode)
      if (subname) removeIndexEntry(childNodesByParent, subname.parentNode, staleNode)
      childNodesByParent.delete(staleNode)
      subnames.delete(staleNode)
      if (staleNode !== node) names.delete(staleNode)
      for (const key of primaryKeysByNode.get(staleNode) ?? []) primaryNames.delete(key)
      primaryKeysByNode.delete(staleNode)
    }
  }

  // Renewing a root renews each subname that inherits its expiry. A fixed subname keeps its own,
  // and so do the subnames below it.
  function renewInheritingSubnames(rootNode: string, root: IndexedLifecycleName) {
    const parents = new Set([rootNode])
    for (const parentNode of parents) {
      for (const childNode of childNodesByParent.get(parentNode) ?? []) {
        const subname = subnames.get(childNode)!
        const parentExpiry = {
          parentExpiresAt: root.expiresAt ?? subname.parentExpiresAt,
          parentExpiresAtBlockHeight: root.expiresAtBlockHeight,
        }
        subnames.set(subname.node, { ...subname, ...parentExpiry })
        if (subname.expiryPolicy !== 'inherits_parent') continue
        const lifecycle = {
          expiresAt: root.expiresAt ?? subname.expiresAt,
          graceEndsAt: root.graceEndsAt,
          expiresAtBlockHeight: root.expiresAtBlockHeight,
          graceEndsAtBlockHeight: root.graceEndsAtBlockHeight,
        }
        subnames.set(subname.node, { ...subname, ...parentExpiry, ...lifecycle })
        // An authority change gives a subname a name row too, which renews with it.
        const row = names.get(subname.node)
        if (row) names.set(subname.node, { ...row, ...lifecycle })
        parents.add(subname.node)
      }
    }
  }

  function collectNodeTree(rootNode: string) {
    const staleNodes = new Set([rootNode])
    for (const node of staleNodes) {
      for (const child of childNodesByParent.get(node) ?? []) staleNodes.add(child)
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
    applyMarketplace,
    applyPool,
    getNameByNode,
    getCommitment,
    getResolverRecords,
    getPrimaryNameByEndpoint,
    getSubnameByNode,
    getSubnamesByParent,
    getTreasuryState,
    getReferralState,
    getFeeConfig,
    getPoolState,
    getMarketplaceConfig: marketplace.getConfig,
    getMarketplaceFixedSaleByNode: marketplace.getFixedSaleByNode,
    getMarketplaceFixedSales: marketplace.getFixedSales,
    getMarketplaceAuctionByNode: marketplace.getAuctionByNode,
    getMarketplaceAuctions: marketplace.getAuctions,
    getMarketplaceOffer: marketplace.getOffer,
    getMarketplaceOffers: marketplace.getOffers,
    getMarketplaceRefund: marketplace.getRefund,
    getActivity,
  }
}

function subnameExpiresAfter(expiresAt: string, now: Date) {
  const timestamp = new Date(expiresAt).getTime()
  if (!Number.isFinite(timestamp)) return false
  return timestamp > now.getTime()
}

function commitmentKey(controller: string, commitment: string) {
  return `${hexKey(controller)}:${hexKey(commitment)}`
}

function hexKey(value: string) {
  return value.trim().toLowerCase().replace(/^0x/, '')
}

function addIndexEntry(index: Map<string, Set<string>>, node: string, key: string) {
  const keys = index.get(node) ?? new Set<string>()
  keys.add(key)
  index.set(node, keys)
}

function removeIndexEntry(index: Map<string, Set<string>>, node: string, key: string) {
  const keys = index.get(node)
  if (!keys) return
  keys.delete(key)
  if (keys.size === 0) index.delete(node)
}
