/** Explicit provisional budgets. §12.1 finalization requires a full reserve. @module */
export const MAX_GAS_LIMIT: bigint = 3_000_000_000n
export const MAX_AUTO_GAS_PRICE: bigint = 10n
// Ordinary actions retain the 0.2 gas classes with additional frozen call headroom.
// These are wallet limits, not measurements or a deployment-conformance claim.
export const GAS_LIMITS: Readonly<Record<string, bigint>> = Object.freeze({
  'directory.propose': 150_000_000n,
  'directory.execute': 300_000_000n,
  'directory.accept_operator': 150_000_000n,
  'directory.accept_guardian': 150_000_000n,
  'directory.cancel': 100_000_000n,
  'directory.set_registration_pause': 100_000_000n,
  'directory.set_policy_suspension': 100_000_000n,
  'directory.increase_delays': 100_000_000n,
  'directory.prune_proposals': 150_000_000n,
  'store.commit': 100_000_000n,
  'store.prune_commitments': 150_000_000n,
  'store.register': 500_000_000n,
  'store.renew': 500_000_000n,
  'store.issue_reserved': 500_000_000n,
  'store.update_authorities': 150_000_000n,
  'store.mutate_records': 300_000_000n,
  'store.replace_records': 300_000_000n,
  'store.move_records': 500_000_000n,
  'store.set_primary': 300_000_000n,
  'store.clear_primary': 150_000_000n,
  'store.create_subname': 200_000_000n,
  'store.remove_subname': 1_000_000_000n,
  'store.prune_subname': 1_000_000_000n,
  'store.take_back_subnames': 1_000_000_000n,
  'store.transfer_and_call': 1_000_000_000n,
  'store.return_custody': 300_000_000n,
  'store.begin_move': 3_000_000_000n,
  'store.stage_move_row': 3_000_000_000n,
  'store.finalize_move': 3_000_000_000n,
  'store.cancel_move': 150_000_000n,
  'store.prune_import': 3_000_000_000n,
  'store.prune_forwarded': 3_000_000_000n,
  'resolver.prune_stale': 300_000_000n,
  'vault.claim_referral': 200_000_000n,
  'vault.claim_protocol': 200_000_000n,
  'marketplace.set_pause': 100_000_000n,
  'marketplace.set_fee': 150_000_000n,
  'marketplace.buy_fixed': 1_000_000_000n,
  'marketplace.place_bid': 500_000_000n,
  'marketplace.place_offer': 500_000_000n,
  'marketplace.renew_escrow': 1_000_000_000n,
  'marketplace.settle_auction': 1_000_000_000n,
  'marketplace.cancel_order': 1_000_000_000n,
  'marketplace.expire_order': 1_000_000_000n,
  'marketplace.retry_return': 1_000_000_000n,
  'marketplace.claim_refund': 200_000_000n,
})
export function gasLimit(role: string, method: string): bigint {
  const value = GAS_LIMITS[`${role}.${method}`]
  if (value === undefined)
    throw new Error(`No wallet gas policy for ${role}.${method}`)
  return value
}
