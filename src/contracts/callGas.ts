import { decodeBase58 } from '../core/principal'
import type { DuskDomainCallMetadata } from './callTypes'

// Covers calls that do not decode a new Moonlight payout key.
export const DUSK_DOMAIN_DEFAULT_GAS_LIMIT = 10_000_000n
// Covers taking back or removing a subtree of up to 256 names.
export const DUSK_DOMAIN_SUBTREE_GAS_LIMIT = 20_000_000n
// Covers the full BLS check for a Moonlight recipient other than the sender.
export const DUSK_DOMAIN_KEY_CHECK_GAS_LIMIT = 70_000_000n
// Rusk samples deployments (at least 2,000 Lux/gas); cap automatic call prices.
export const DUSK_DOMAIN_MAX_AUTO_GAS_PRICE = 10n

const keyCheckRecipientFields: Record<string, string> = {
  'core.escrow_fixed_sale_runtime': 'sellerRecipient',
  'core.escrow_auction_runtime': 'sellerRecipient',
  'core.accept_marketplace_offer_runtime': 'sellerRecipient',
  'treasury.init': 'operatorRecipient',
  'treasury.propose_operator_runtime': 'operatorRecipient',
  'treasury.claim_referral_reward_runtime': 'recipient',
  'treasury.claim_all_referral_rewards_runtime': 'recipient',
}

export function duskDomainCallGasLimit(
  call: DuskDomainCallMetadata,
  { senderAddress }: { senderAddress?: string | null } = {},
): bigint {
  if (call.functionName === 'take_back_subnames_runtime' || call.functionName === 'remove_subname_runtime') {
    return DUSK_DOMAIN_SUBTREE_GAS_LIMIT
  }
  // Acceptance decodes the stored recipient, which is absent from the call.
  if (call.contract === 'treasury' && call.functionName === 'accept_operator_runtime') {
    return DUSK_DOMAIN_KEY_CHECK_GAS_LIMIT
  }
  const recipientField = keyCheckRecipientFields[`${call.contract}.${call.functionName}`]
  if (recipientField) {
    const recipient = (call.args as Record<string, unknown> | null)?.[recipientField]
    const recipientBytes = typeof recipient === 'string' ? decodeBase58(recipient.trim()) : null
    const senderBytes = senderAddress ? decodeBase58(senderAddress.trim()) : null
    if (!recipientBytes || recipientBytes.length !== 96 || !senderBytes || senderBytes.length !== 96
      || !recipientBytes.every((byte, index) => byte === senderBytes[index])) {
      return DUSK_DOMAIN_KEY_CHECK_GAS_LIMIT
    }
  }
  return DUSK_DOMAIN_DEFAULT_GAS_LIMIT
}
