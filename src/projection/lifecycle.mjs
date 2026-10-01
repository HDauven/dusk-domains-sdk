import { createProjectionState, applyProjectionEvent } from './state.mjs'
import { commitmentKey } from './projectors/controller.mjs'
import { emptyMarketplaceConfig, marketplaceOfferKey, marketplaceOrderIsEscrowed } from './projectors/marketplace.mjs'
import { referralStateFor } from './economics/referrals.mjs'
import { endpointKey, normalizeNode } from './keys.mjs'

/** @returns {import('../indexer/indexerProjectorTypes').LifecycleEventProjector} */
export function createLifecycleEventProjector() {
  const state = createProjectionState()
  const apply = (event, meta = {}) => applyProjectionEvent(state, event, meta)
  const getName = (node) => state.namesByNode.get(normalizeNode(node))
  const getSubname = (node) => state.subnamesByNode.get(normalizeNode(node))
  const currentEscrow = (value) => value ? {
    ...value,
    escrowed: marketplaceOrderIsEscrowed(getName(value.node), value.marketplaceContractId),
  } : null

  function namespaceNodeIsLive(node, now, seen = new Set()) {
    if (seen.has(node)) return false
    seen.add(node)
    const lifecycle = getName(node)
    if (lifecycle) {
      return lifecycle.status !== 'released'
        && !(lifecycle.graceEndsAt && new Date(lifecycle.graceEndsAt).getTime() <= now.getTime())
    }
    const subname = getSubname(node)
    return subname ? subnameIsLive(subname, now, seen) : false
  }

  function subnameIsLive(subname, now, seen = new Set()) {
    return subname.status === 'active'
      && new Date(subname.expiresAt).getTime() > now.getTime()
      && namespaceNodeIsLive(subname.parentNode, now, seen)
  }

  return {
    apply,
    applyController: apply,
    applyResolver: apply,
    applyReverse: apply,
    applySubname: apply,
    applyTreasury: apply,
    applyReferral: apply,
    applyFeeConfig: apply,
    applyMarketplace: apply,
    applyPool: apply,
    getNameByNode: (node) => getName(node) ?? null,
    getCommitment: (commitment, controller) => (controller
      ? state.commitmentsByKey.get(commitmentKey(controller, commitment))
      : state.commitmentsById.get(normalizeNode(commitment))) ?? null,
    getResolverRecords: (node) => [...(state.recordsByNode.get(normalizeNode(node)) ?? [])],
    getPrimaryNameByEndpoint: (endpoint) => state.reverseByEndpoint.get(endpointKey(endpoint)) ?? null,
    getSubnameByNode: (node) => {
      const subname = getSubname(node)
      return subname && subnameIsLive(subname, new Date()) ? subname : null
    },
    getSubnamesByParent: (parentNode) => {
      const now = new Date()
      if (!namespaceNodeIsLive(parentNode, now)) return []
      return (state.subnamesByParent.get(normalizeNode(parentNode)) ?? []).filter((subname) => subnameIsLive(subname, now))
    },
    getTreasuryState: () => ({ ...state.treasuryState }),
    getReferralState: (referrer) => referralStateFor(state, referrer),
    getFeeConfig: () => ({ ...state.feeConfig }),
    getPoolState: () => ({ ...state.poolState, registries: [...state.poolState.registries], resolvers: [...state.poolState.resolvers] }),
    getMarketplaceConfig: () => ({ ...(state.marketplaceConfig ?? emptyMarketplaceConfig()) }),
    getMarketplaceFixedSaleByNode: (node) => currentEscrow(state.marketplaceFixedSalesByNode.get(normalizeNode(node))),
    getMarketplaceFixedSales: () => [...state.marketplaceFixedSalesByNode.values()].map(currentEscrow),
    getMarketplaceAuctionByNode: (node) => currentEscrow(state.marketplaceAuctionsByNode.get(normalizeNode(node))),
    getMarketplaceAuctions: () => [...state.marketplaceAuctionsByNode.values()].map(currentEscrow),
    getMarketplaceOffer: (node, buyerAuthority) => state.marketplaceOffersByKey.get(marketplaceOfferKey(node, buyerAuthority)) ?? null,
    getMarketplaceOffers: (filters = {}) => [...state.marketplaceOffersByKey.values()].filter((offer) => (
      (!filters.node || offer.node === normalizeNode(filters.node))
      && (!filters.buyerAuthority || normalizeNode(offer.buyerAuthority) === normalizeNode(filters.buyerAuthority))
    )),
    getMarketplaceRefund: (authority) => state.marketplaceRefundsByAuthority.get(normalizeNode(authority)) ?? null,
    getActivity: (node) => [...(state.activityByNode.get(normalizeNode(node)) ?? [])],
  }
}
