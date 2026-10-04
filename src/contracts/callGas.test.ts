import { describe, expect, it } from 'vitest'
import { claimableAccount } from '../core/claimableReferrer.test-fixtures'
import { encodeBase58 } from '../core/principal'
import {
  coreAcceptMarketplaceOfferRuntimeCall,
  coreEscrowAuctionRuntimeCall,
  coreEscrowFixedSaleRuntimeCall,
  DUSK_DOMAIN_KEY_CHECK_GAS_LIMIT,
  duskDomainCallGasLimit,
  treasuryAcceptOperatorRuntimeCall,
  treasuryClaimAllReferralRewardsRuntimeCall,
  treasuryClaimReferralRewardRuntimeCall,
  treasuryInitCall,
  treasuryProposeOperatorRuntimeCall,
} from '../writes'

const node = `0x${'11'.repeat(32)}`
const operator = { kind: 'Contract', bytes: Array(32).fill(1) } as const

describe('Dusk Domains call gas limits', () => {
  it.each([
    ['core', 'complete_registration_runtime', 10_000_000n],
    ['core', 'renew_runtime', 10_000_000n],
    ['core', 'mutate_records_sender_runtime', 10_000_000n],
    ['core', 'set_primary_name_runtime', 10_000_000n],
    ['core', 'update_authorities_runtime', 10_000_000n],
    ['core', 'create_subname_runtime', 10_000_000n],
    ['core', 'prune_subname_runtime', 10_000_000n],
    ['core', 'prune_commitment_runtime', 10_000_000n],
    ['core', 'move_records_runtime', 10_000_000n],
    ['core', 'take_back_subnames_runtime', 20_000_000n],
    ['core', 'remove_subname_runtime', 20_000_000n],
    ['marketplace', 'buy_fixed_sale_runtime', 10_000_000n],
    ['marketplace', 'settle_auction_runtime', 10_000_000n],
    ['marketplace', 'claim_refund_runtime', 10_000_000n],
    ['treasury', 'claim_runtime', 10_000_000n],
    ['treasury', 'claim_all_runtime', 10_000_000n],
    ['router', 'issue_reserved_name_runtime', 10_000_000n],
    ['router', 'propose_operator_runtime', 10_000_000n],
    ['router', 'accept_operator_runtime', 10_000_000n],
    ['router', 'init', 10_000_000n],
    ['marketplace', 'propose_operator_runtime', 10_000_000n],
    ['marketplace', 'accept_operator_runtime', 10_000_000n],
    ['marketplace', 'init', 10_000_000n],
    ['treasury', 'cancel_operator_runtime', 10_000_000n],
    ['core', 'future_action_runtime', 10_000_000n],
  ] as const)('uses the policy for %s.%s', (contract, functionName, expected) => {
    expect(duskDomainCallGasLimit({ contract, functionName, kind: 'write', args: {} })).toBe(expected)
  })

  describe.each([
    [coreEscrowFixedSaleRuntimeCall({ node, marketplaceContract: node, name: 'alpha.dusk', priceLux: 10, expiresAt: 100, sellerRecipient: claimableAccount }), 'sellerRecipient'],
    [coreEscrowAuctionRuntimeCall({ node, marketplaceContract: node, name: 'alpha.dusk', reservePriceLux: 10, durationBlocks: 100, sellerRecipient: claimableAccount }), 'sellerRecipient'],
    [coreAcceptMarketplaceOfferRuntimeCall({ node, marketplaceContract: node, buyerAuthority: node, expectedOfferId: 1, expectedFeeBps: 250, expectedAmountLux: 10, sellerRecipient: claimableAccount }), 'sellerRecipient'],
    [treasuryInitCall({ operator, operatorRecipient: claimableAccount, allowedFeeSources: [], router: node }), 'operatorRecipient'],
    [treasuryProposeOperatorRuntimeCall({ operator, operatorRecipient: claimableAccount }), 'operatorRecipient'],
    [treasuryClaimReferralRewardRuntimeCall({ amountLux: 10, recipient: claimableAccount }), 'recipient'],
    [treasuryClaimAllReferralRewardsRuntimeCall({ recipient: claimableAccount }), 'recipient'],
  ] as const)('%s', (call, recipientField) => {

    it.each([claimableAccount, ` ${claimableAccount}\n`])('recognizes the sender by decoded Moonlight key', senderAddress => {
      expect(duskDomainCallGasLimit(call, { senderAddress })).toBe(10_000_000n)
    })

    it.each([undefined, null, '', 'unknown', encodeBase58(Array(96).fill(8)), `0x${'11'.repeat(32)}`])('allows for a different or unknown sender: %s', senderAddress => {
      expect(duskDomainCallGasLimit(call, { senderAddress })).toBe(70_000_000n)
    })

    it('treats an omitted sender as different', () => {
      expect(duskDomainCallGasLimit(call)).toBe(70_000_000n)
    })

    it.each([undefined, '', 'invalid', `0x${'11'.repeat(32)}`, encodeBase58(Array(193).fill(8))])('does not equate invalid Moonlight addresses: %s', recipient => {
      expect(duskDomainCallGasLimit({ ...call, args: { ...call.args, [recipientField]: recipient } }, { senderAddress: recipient })).toBe(70_000_000n)
    })
  })

  it.each([undefined, null, claimableAccount, encodeBase58(Array(96).fill(8))])('always allows a key check for treasury acceptance: %s', senderAddress => {
    expect(duskDomainCallGasLimit(treasuryAcceptOperatorRuntimeCall(), { senderAddress })).toBe(70_000_000n)
  })

  it('exports the Moonlight key check limit', () => {
    expect(DUSK_DOMAIN_KEY_CHECK_GAS_LIMIT).toBe(70_000_000n)
  })
})
