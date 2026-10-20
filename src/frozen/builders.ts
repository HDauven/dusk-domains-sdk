// Generated from the frozen v1 protocol schemas by scripts/generate-frozen.mjs.
/**
 * Typed call builders for every frozen v1 write entrypoint.
 *
 * @module
 */
import { buildCall, type FrozenCall } from './calls.ts'
import type { Methods } from './types.ts'
/** Build a `directory.propose` call to `target` with `buildCall`. */
export function directoryProposeCall(target: string, args: Methods['directory']['propose']['input']): FrozenCall<'directory', 'propose'> { return buildCall('directory', target, 'propose', args) }
/** Build a `directory.execute` call to `target` with `buildCall`. */
export function directoryExecuteCall(target: string, args: Methods['directory']['execute']['input']): FrozenCall<'directory', 'execute'> { return buildCall('directory', target, 'execute', args) }
/** Build a `directory.accept_operator` call to `target` with `buildCall`. */
export function directoryAcceptOperatorCall(target: string, args: Methods['directory']['accept_operator']['input']): FrozenCall<'directory', 'accept_operator'> { return buildCall('directory', target, 'accept_operator', args) }
/** Build a `directory.accept_guardian` call to `target` with `buildCall`. */
export function directoryAcceptGuardianCall(target: string, args: Methods['directory']['accept_guardian']['input']): FrozenCall<'directory', 'accept_guardian'> { return buildCall('directory', target, 'accept_guardian', args) }
/** Build a `directory.cancel` call to `target` with `buildCall`. */
export function directoryCancelCall(target: string, args: Methods['directory']['cancel']['input']): FrozenCall<'directory', 'cancel'> { return buildCall('directory', target, 'cancel', args) }
/** Build a `directory.set_registration_pause` call to `target` with `buildCall`. */
export function directorySetRegistrationPauseCall(target: string, args: Methods['directory']['set_registration_pause']['input']): FrozenCall<'directory', 'set_registration_pause'> { return buildCall('directory', target, 'set_registration_pause', args) }
/** Build a `directory.set_policy_suspension` call to `target` with `buildCall`. */
export function directorySetPolicySuspensionCall(target: string, args: Methods['directory']['set_policy_suspension']['input']): FrozenCall<'directory', 'set_policy_suspension'> { return buildCall('directory', target, 'set_policy_suspension', args) }
/** Build a `directory.increase_delays` call to `target` with `buildCall`. */
export function directoryIncreaseDelaysCall(target: string, args: Methods['directory']['increase_delays']['input']): FrozenCall<'directory', 'increase_delays'> { return buildCall('directory', target, 'increase_delays', args) }
/** Build a `directory.prune_proposals` call to `target` with `buildCall`. */
export function directoryPruneProposalsCall(target: string, args: Methods['directory']['prune_proposals']['input']): FrozenCall<'directory', 'prune_proposals'> { return buildCall('directory', target, 'prune_proposals', args) }
/** Build a `directory.set_controller_suspension` call to `target` with `buildCall`. */
export function directorySetControllerSuspensionCall(target: string, args: Methods['directory']['set_controller_suspension']['input']): FrozenCall<'directory', 'set_controller_suspension'> { return buildCall('directory', target, 'set_controller_suspension', args) }
/** Build a `store.commit` call to `target` with `buildCall`. */
export function storeCommitCall(target: string, args: Methods['store']['commit']['input']): FrozenCall<'store', 'commit'> { return buildCall('store', target, 'commit', args) }
/** Build a `store.prune_commitments` call to `target` with `buildCall`. */
export function storePruneCommitmentsCall(target: string, args: Methods['store']['prune_commitments']['input']): FrozenCall<'store', 'prune_commitments'> { return buildCall('store', target, 'prune_commitments', args) }
/** Build a `store.register` call to `target` with `buildCall`. */
export function storeRegisterCall(target: string, args: Methods['store']['register']['input']): FrozenCall<'store', 'register'> { return buildCall('store', target, 'register', args) }
/** Build a `store.renew` call to `target` with `buildCall`. */
export function storeRenewCall(target: string, args: Methods['store']['renew']['input']): FrozenCall<'store', 'renew'> { return buildCall('store', target, 'renew', args) }
/** Build a `store.issue_reserved` call to `target` with `buildCall`. */
export function storeIssueReservedCall(target: string, args: Methods['store']['issue_reserved']['input']): FrozenCall<'store', 'issue_reserved'> { return buildCall('store', target, 'issue_reserved', args) }
/** Build a `store.update_authorities` call to `target` with `buildCall`. */
export function storeUpdateAuthoritiesCall(target: string, args: Methods['store']['update_authorities']['input']): FrozenCall<'store', 'update_authorities'> { return buildCall('store', target, 'update_authorities', args) }
/** Build a `store.mutate_records` call to `target` with `buildCall`. */
export function storeMutateRecordsCall(target: string, args: Methods['store']['mutate_records']['input']): FrozenCall<'store', 'mutate_records'> { return buildCall('store', target, 'mutate_records', args) }
/** Build a `store.replace_records` call to `target` with `buildCall`. */
export function storeReplaceRecordsCall(target: string, args: Methods['store']['replace_records']['input']): FrozenCall<'store', 'replace_records'> { return buildCall('store', target, 'replace_records', args) }
/** Build a `store.move_records` call to `target` with `buildCall`. */
export function storeMoveRecordsCall(target: string, args: Methods['store']['move_records']['input']): FrozenCall<'store', 'move_records'> { return buildCall('store', target, 'move_records', args) }
/** Build a `store.set_primary` call to `target` with `buildCall`. */
export function storeSetPrimaryCall(target: string, args: Methods['store']['set_primary']['input']): FrozenCall<'store', 'set_primary'> { return buildCall('store', target, 'set_primary', args) }
/** Build a `store.clear_primary` call to `target` with `buildCall`. */
export function storeClearPrimaryCall(target: string, args: Methods['store']['clear_primary']['input']): FrozenCall<'store', 'clear_primary'> { return buildCall('store', target, 'clear_primary', args) }
/** Build a `store.create_subname` call to `target` with `buildCall`. */
export function storeCreateSubnameCall(target: string, args: Methods['store']['create_subname']['input']): FrozenCall<'store', 'create_subname'> { return buildCall('store', target, 'create_subname', args) }
/** Build a `store.remove_subname` call to `target` with `buildCall`. */
export function storeRemoveSubnameCall(target: string, args: Methods['store']['remove_subname']['input']): FrozenCall<'store', 'remove_subname'> { return buildCall('store', target, 'remove_subname', args) }
/** Build a `store.prune_subname` call to `target` with `buildCall`. */
export function storePruneSubnameCall(target: string, args: Methods['store']['prune_subname']['input']): FrozenCall<'store', 'prune_subname'> { return buildCall('store', target, 'prune_subname', args) }
/** Build a `store.take_back_subnames` call to `target` with `buildCall`. */
export function storeTakeBackSubnamesCall(target: string, args: Methods['store']['take_back_subnames']['input']): FrozenCall<'store', 'take_back_subnames'> { return buildCall('store', target, 'take_back_subnames', args) }
/** Build a `store.transfer_and_call` call to `target` with `buildCall`. */
export function storeTransferAndCallCall(target: string, args: Methods['store']['transfer_and_call']['input']): FrozenCall<'store', 'transfer_and_call'> { return buildCall('store', target, 'transfer_and_call', args) }
/** Build a `store.return_custody` call to `target` with `buildCall`. */
export function storeReturnCustodyCall(target: string, args: Methods['store']['return_custody']['input']): FrozenCall<'store', 'return_custody'> { return buildCall('store', target, 'return_custody', args) }
/** Build a `store.begin_move` call to `target` with `buildCall`. */
export function storeBeginMoveCall(target: string, args: Methods['store']['begin_move']['input']): FrozenCall<'store', 'begin_move'> { return buildCall('store', target, 'begin_move', args) }
/** Build a `store.stage_move_row` call to `target` with `buildCall`. */
export function storeStageMoveRowCall(target: string, args: Methods['store']['stage_move_row']['input']): FrozenCall<'store', 'stage_move_row'> { return buildCall('store', target, 'stage_move_row', args) }
/** Build a `store.finalize_move` call to `target` with `buildCall`. */
export function storeFinalizeMoveCall(target: string, args: Methods['store']['finalize_move']['input']): FrozenCall<'store', 'finalize_move'> { return buildCall('store', target, 'finalize_move', args) }
/** Build a `store.cancel_move` call to `target` with `buildCall`. */
export function storeCancelMoveCall(target: string, args: Methods['store']['cancel_move']['input']): FrozenCall<'store', 'cancel_move'> { return buildCall('store', target, 'cancel_move', args) }
/** Build a `store.prune_import` call to `target` with `buildCall`. */
export function storePruneImportCall(target: string, args: Methods['store']['prune_import']['input']): FrozenCall<'store', 'prune_import'> { return buildCall('store', target, 'prune_import', args) }
/** Build a `store.prune_forwarded` call to `target` with `buildCall`. */
export function storePruneForwardedCall(target: string, args: Methods['store']['prune_forwarded']['input']): FrozenCall<'store', 'prune_forwarded'> { return buildCall('store', target, 'prune_forwarded', args) }
/** Build a `resolver.prune_stale` call to `target` with `buildCall`. */
export function resolverPruneStaleCall(target: string, args: Methods['resolver']['prune_stale']['input']): FrozenCall<'resolver', 'prune_stale'> { return buildCall('resolver', target, 'prune_stale', args) }
/** Build a `vault.claim_referral` call to `target` with `buildCall`. */
export function vaultClaimReferralCall(target: string, args: Methods['vault']['claim_referral']['input']): FrozenCall<'vault', 'claim_referral'> { return buildCall('vault', target, 'claim_referral', args) }
/** Build a `vault.prune_referrals` call to `target` with `buildCall`. */
export function vaultPruneReferralsCall(target: string, args: Methods['vault']['prune_referrals']['input']): FrozenCall<'vault', 'prune_referrals'> { return buildCall('vault', target, 'prune_referrals', args) }
/** Build a `vault.claim_protocol` call to `target` with `buildCall`. */
export function vaultClaimProtocolCall(target: string, args: Methods['vault']['claim_protocol']['input']): FrozenCall<'vault', 'claim_protocol'> { return buildCall('vault', target, 'claim_protocol', args) }
/** Build a `marketplace.set_pause` call to `target` with `buildCall`. */
export function marketplaceSetPauseCall(target: string, args: Methods['marketplace']['set_pause']['input']): FrozenCall<'marketplace', 'set_pause'> { return buildCall('marketplace', target, 'set_pause', args) }
/** Build a `marketplace.set_fee` call to `target` with `buildCall`. */
export function marketplaceSetFeeCall(target: string, args: Methods['marketplace']['set_fee']['input']): FrozenCall<'marketplace', 'set_fee'> { return buildCall('marketplace', target, 'set_fee', args) }
/** Build a `marketplace.buy_fixed` call to `target` with `buildCall`. */
export function marketplaceBuyFixedCall(target: string, args: Methods['marketplace']['buy_fixed']['input']): FrozenCall<'marketplace', 'buy_fixed'> { return buildCall('marketplace', target, 'buy_fixed', args) }
/** Build a `marketplace.place_bid` call to `target` with `buildCall`. */
export function marketplacePlaceBidCall(target: string, args: Methods['marketplace']['place_bid']['input']): FrozenCall<'marketplace', 'place_bid'> { return buildCall('marketplace', target, 'place_bid', args) }
/** Build a `marketplace.place_offer` call to `target` with `buildCall`. */
export function marketplacePlaceOfferCall(target: string, args: Methods['marketplace']['place_offer']['input']): FrozenCall<'marketplace', 'place_offer'> { return buildCall('marketplace', target, 'place_offer', args) }
/** Build a `marketplace.renew_escrow` call to `target` with `buildCall`. */
export function marketplaceRenewEscrowCall(target: string, args: Methods['marketplace']['renew_escrow']['input']): FrozenCall<'marketplace', 'renew_escrow'> { return buildCall('marketplace', target, 'renew_escrow', args) }
/** Build a `marketplace.settle_auction` call to `target` with `buildCall`. */
export function marketplaceSettleAuctionCall(target: string, args: Methods['marketplace']['settle_auction']['input']): FrozenCall<'marketplace', 'settle_auction'> { return buildCall('marketplace', target, 'settle_auction', args) }
/** Build a `marketplace.cancel_order` call to `target` with `buildCall`. */
export function marketplaceCancelOrderCall(target: string, args: Methods['marketplace']['cancel_order']['input']): FrozenCall<'marketplace', 'cancel_order'> { return buildCall('marketplace', target, 'cancel_order', args) }
/** Build a `marketplace.expire_order` call to `target` with `buildCall`. */
export function marketplaceExpireOrderCall(target: string, args: Methods['marketplace']['expire_order']['input']): FrozenCall<'marketplace', 'expire_order'> { return buildCall('marketplace', target, 'expire_order', args) }
/** Build a `marketplace.retry_return` call to `target` with `buildCall`. */
export function marketplaceRetryReturnCall(target: string, args: Methods['marketplace']['retry_return']['input']): FrozenCall<'marketplace', 'retry_return'> { return buildCall('marketplace', target, 'retry_return', args) }
/** Build a `marketplace.claim_refund` call to `target` with `buildCall`. */
export function marketplaceClaimRefundCall(target: string, args: Methods['marketplace']['claim_refund']['input']): FrozenCall<'marketplace', 'claim_refund'> { return buildCall('marketplace', target, 'claim_refund', args) }
