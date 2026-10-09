/** Measured Moonlight wallet budgets with contract admission reserves. @module */
export const MAX_GAS_LIMIT: bigint = 3_000_000_000n
export const MAX_AUTO_GAS_PRICE: bigint = 10n
/**
 * Conservative no-input ceilings, gas units; buildCall refines these from the
 * reviewed arguments in wallet-gas.ts. Method: round up to the next million,
 * covering both twice the measured successful transaction maximum and the
 * admission floor including forwarding/wrapper overhead. Measurements use the
 * protocol 41f0f6f VM harness, Piecrust 0.32.0 and Rusk 1.7.1 Moonlight accounting.
 * Every action is exercised at its chosen limit and 1M below it in the assessment.
 * These are fixture maxima, not bounds for arbitrarily large lifetime storage.
 *
 * Admission floors (paths relative to protocol/contracts/crates):
 * - dusk-domains-types/src/frozen/mod.rs:46-47 defines 50M quote + 10M reserve;
 *   dusk-domains-store/src/entrypoints/paid.rs:47-50 checks remaining gas.
 * - dusk-domains-store/src/entrypoints/mod.rs:373-376 requires callback + 10M.
 *   The callback allowance is preserved; a wallet hop gets 93% forwarding twice.
 * - dusk-domains-store/src/entrypoints/movement.rs:145-147 requires >1.65B;
 *   activation gets 1.5B at lines 151-158. 2B also covers one wallet invoke hop.
 * Piecrust src/imports.rs:26,262-265 applies the 93% forwarding rule.
 *
 * Input models (gas units, B = UTF-8 key + value bytes):
 * register: 80M + 2500B + 60M when a referrer is present (unknown cache state).
 * replace/move records: 7M + 3500B; stage row: 12M + 3500B (one row only).
 * mutations: 30M + 2000B, reserving for the unknown existing 16-record set.
 * takeback: 7M + 270k per explicit target; cleanup: 5M + 125k per row.
 * proposal pruning: 5M + 4M per ID; each ID can scan 64 large stored proposals
 * (directory state.rs:267-270,968-988), even if no matching proposal exists.
 * commitment pruning: 5M + 60k per supplied key.
 * custody: ceil((callback + 10M) / .93^2) + 25M.
 * buy/settle: 10M without referral, 130M with possible new payout-key admission.
 * Hidden subtree size cannot be inferred from a NameRef: renewal, begin_move,
 * removal and pruning reserve for the maximum 257-name tree. Subname creation
 * also reserves for removing an expired child and its 255 descendants before
 * replacement, including stale export-index entries (names.rs:604-723).
 * Governance acceptance, cancellation and execution cover full-table scans of
 * large stored proposals, whose bodies are absent from their inputs. Execution
 * also covers a maximum external policy config (directory entrypoints.rs:171-180).
 * No extra reads are added by the builders.
 * Registration does not infer that an existing referrer key is already cached.
 * Application failures consume the submitted limit; successful calls pay spent gas.
 */
export const GAS_LIMITS: Readonly<Record<string, bigint>> = Object.freeze({
  // New controller writes use the protocol ceiling until measured wallet budgets exist.
  'directory.approve_controller': MAX_GAS_LIMIT,
  'directory.set_controller_suspension': MAX_GAS_LIMIT,
  'directory.propose': 250_000_000n,
  'directory.execute': 16_000_000n,
  'directory.accept_operator': 20_000_000n,
  'directory.accept_guardian': 16_000_000n,
  'directory.cancel': 12_000_000n,
  'directory.set_registration_pause': 5_000_000n,
  'directory.set_policy_suspension': 5_000_000n,
  'directory.increase_delays': 5_000_000n,
  'directory.prune_proposals': 261_000_000n,
  'store.commit': 5_000_000n,
  'store.prune_commitments': 9_000_000n,
  'store.register': 164_000_000n,
  'store.renew': 10_000_000n,
  'store.issue_reserved': 80_000_000n,
  'store.update_authorities': 5_000_000n,
  'store.mutate_records': 39_000_000n,
  'store.replace_records': 40_000_000n,
  'store.move_records': 40_000_000n,
  'store.set_primary': 16_000_000n,
  'store.clear_primary': 5_000_000n,
  'store.create_subname': 20_000_000n,
  'store.remove_subname': 20_000_000n,
  'store.prune_subname': 20_000_000n,
  'store.take_back_subnames': 77_000_000n,
  'store.transfer_and_call': 615_000_000n,
  'store.return_custody': 5_000_000n,
  'store.begin_move': 50_000_000n,
  'store.stage_move_row': 45_000_000n,
  'store.finalize_move': 2_000_000_000n,
  'store.cancel_move': 10_000_000n,
  'store.prune_import': 7_000_000n,
  'store.prune_forwarded': 7_000_000n,
  'resolver.prune_stale': 5_000_000n,
  'vault.claim_referral': 130_000_000n,
  'vault.claim_protocol': 5_000_000n,
  'marketplace.set_pause': 5_000_000n,
  'marketplace.set_fee': 5_000_000n,
  'marketplace.buy_fixed': 130_000_000n,
  'marketplace.place_bid': 5_000_000n,
  'marketplace.place_offer': 130_000_000n,
  'marketplace.renew_escrow': 10_000_000n,
  'marketplace.settle_auction': 130_000_000n,
  'marketplace.cancel_order': 5_000_000n,
  'marketplace.expire_order': 5_000_000n,
  'marketplace.retry_return': 5_000_000n,
  'marketplace.claim_refund': 130_000_000n,
})
export function gasLimit(role: string, method: string): bigint {
  const value = GAS_LIMITS[`${role}.${method}`]
  if (value === undefined)
    throw new Error(`No wallet gas policy for ${role}.${method}`)
  return value
}
