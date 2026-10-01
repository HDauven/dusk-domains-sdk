import {
  applyReferralEvent,
  emptyTreasuryState,
  reduceFeeConfigEvent,
  reduceTreasuryEvent,
  reduceTreasuryReferralClaim,
  reduceTreasuryReferralReserve,
} from './economics.mjs'
import {
  applyControllerEvent,
  applyLifecycleEvent,
  applyRecordsMoved,
  applyMarketplaceEvent,
  applyResolverEvent,
  applyReverseEvent,
  applySubnameEvent,
  clearReleasedName,
  emptyPoolState,
  isControllerEvent,
  isFeeConfigEvent,
  isLifecycleEvent,
  isMarketplaceEvent,
  isPoolEvent,
  isReferralEvent,
  isResolverEvent,
  isReverseEvent,
  isSubnameEvent,
  isTreasuryEvent,
  reducePoolEvent,
  renewInheritingSubnames,
} from './projectors.mjs'
import { eventTimestamp } from './activity.mjs'
import { DEFAULT_FEE_CONFIG } from './constants.mjs'
import { normalizeNode } from './keys.mjs'
import { assertSafeNumericTree } from './safe-numbers.mjs'

export function createProjectionState() {
  return {
    namesByNode: new Map(),
    recordsByNode: new Map(),
    recordsByNodeKey: new Map(),
    recordHistoryByNode: new Map(),
    recordHistoryByNodeKey: new Map(),
    activityByNode: new Map(),
    reverseByEndpoint: new Map(),
    reverseKeysByNode: new Map(),
    subnamesByNode: new Map(),
    subnamesByParent: new Map(),
    subnamesByCanonical: new Map(),
    commitmentsById: new Map(),
    commitmentsByKey: new Map(),
    controllersByNode: new Map(),
    marketplaceFixedSalesByNode: new Map(),
    marketplaceAuctionsByNode: new Map(),
    marketplaceOffersByKey: new Map(),
    marketplaceRefundsByAuthority: new Map(),
    marketplaceConfig: null,
    treasuryState: emptyTreasuryState(),
    feeConfig: { ...DEFAULT_FEE_CONFIG },
    poolState: emptyPoolState(),
    referralsByReferrer: new Map(),
    referralRewardsSupported: false,
  }
}

export function applyProjectionEvent(state, event, meta = {}, timestamp = eventTimestamp(event, meta)) {
  assertSafeNumericTree(event, 'event')
  assertSafeNumericTree(meta, 'event metadata')
  if (isLifecycleEvent(event.type)) {
    const node = normalizeNode(event.node)
    // The contract clears a lapsed name it registers again without emitting name_released.
    if (event.type === 'name_registered' && state.namesByNode.has(node)) clearReleasedName(state, node)
    applyLifecycleEvent(state, event, meta, timestamp)
    if (event.type === 'name_renewed') renewInheritingSubnames(state, node)
    if (event.type === 'name_released') clearReleasedName(state, node)
    return state.activityByNode.get(node)[0]
  } else if (isResolverEvent(event.type)) {
    return applyResolverEvent(state, event, meta, timestamp)
  } else if (isControllerEvent(event.type)) {
    return applyControllerEvent(state, event, meta)
  } else if (isReverseEvent(event.type)) {
    return applyReverseEvent(state, event, meta)
  } else if (isSubnameEvent(event.type)) {
    return applySubnameEvent(state, event, meta)
  } else if (isTreasuryEvent(event.type)) {
    state.treasuryState = reduceTreasuryEvent(event, state.treasuryState, meta)
    if (event.type === 'treasury_initialized') state.referralRewardsSupported = true
    return state.treasuryState
  } else if (isReferralEvent(event.type)) {
    state.referralRewardsSupported = true
    state.treasuryState = reduceTreasuryReferralReserve(event, state.treasuryState)
    state.treasuryState = reduceTreasuryReferralClaim(event, state.treasuryState)
    return applyReferralEvent(state, event, meta)
  } else if (isFeeConfigEvent(event.type)) {
    state.feeConfig = reduceFeeConfigEvent(event, state.feeConfig, meta)
    return { ...state.feeConfig }
  } else if (isMarketplaceEvent(event.type)) {
    return applyMarketplaceEvent(state, event, meta, timestamp)
  } else if (isPoolEvent(event.type)) {
    state.poolState = reducePoolEvent(event, state.poolState, meta)
    if (event.type === 'records_moved') applyRecordsMoved(state, event, meta, timestamp)
    // The router starts with a fee config; later changes arrive as fee_config_updated.
    if (event.type === 'router_initialized') state.feeConfig = reduceFeeConfigEvent(event, state.feeConfig, meta)
    return { ...state.poolState, registries: [...state.poolState.registries], resolvers: [...state.poolState.resolvers] }
  }
}
