import {
  isCoreClearPrimaryNameRuntimeArgs,
  isCoreClearRecordSenderRuntimeArgs,
  isCoreAcceptMarketplaceOfferRuntimeArgs,
  isCoreCommitRuntimeArgs,
  isCoreCompleteRegistrationRuntimeArgs,
  isCoreCreateSubnameRuntimeArgs,
  isCoreEscrowAuctionRuntimeArgs,
  isCoreEscrowFixedSaleRuntimeArgs,
  isCoreInitArgs,
  isCoreMutateRecordsSenderRuntimeArgs,
  isCoreRenewRuntimeArgs,
  isCoreSetFeeConfigRuntimeArgs,
  isCoreSetPrimaryNameRuntimeArgs,
  isCoreSetRecordSenderRuntimeArgs,
  isCoreSetReferralConfigRuntimeArgs,
  isCoreUpdateAuthoritiesRuntimeArgs,
} from './callArgGuards'
import {
  formatLux,
  formatYears,
  principalSummary,
  recordApprovalLabel,
} from './callContextFormat'
import type { DuskDomainCallMetadata, DuskDomainDecodedContext } from './callTypes'

export function decodedCoreDuskDomainContext(call: DuskDomainCallMetadata): DuskDomainDecodedContext | null {
  if (call.contract !== 'core') return null

  if (call.functionName === 'init' && isCoreInitArgs(call.args)) {
    return {
      title: 'Initialize Dusk Domains core',
      description: 'Configure the treasury and record source for the core contract.',
      fields: [
        { label: 'Treasury', value: call.args.treasuryContract },
        { label: 'Record source', value: call.args.recordSourceContract },
        { label: 'Operator', value: principalSummary(call.args.operator) },
        { label: 'Referral share', value: `${call.args.referralRewardBps / 100}%` },
      ],
    }
  }

  if (call.functionName === 'set_referral_config_runtime' && isCoreSetReferralConfigRuntimeArgs(call.args)) {
    return {
      title: 'Update referral share',
      description: 'Change the share of future registration fees credited to referrers.',
      fields: [
        { label: 'Referral share', value: `${call.args.referralRewardBps / 100}%` },
      ],
    }
  }

  if (call.functionName === 'set_fee_config_runtime' && isCoreSetFeeConfigRuntimeArgs(call.args)) {
    return {
      title: 'Update domain pricing',
      description: 'Change future registration pricing and referral economics.',
      fields: [
        { label: '3 characters', value: `${formatLux(call.args.threeCharYearLux)} DUSK / year` },
        { label: '4 characters', value: `${formatLux(call.args.fourCharYearLux)} DUSK / year` },
        { label: '5+ characters', value: `${formatLux(call.args.fivePlusYearLux)} DUSK / year` },
        { label: 'Referral share', value: `${call.args.referralRewardBps / 100}%` },
      ],
    }
  }

  if (call.functionName === 'commit_runtime' && isCoreCommitRuntimeArgs(call.args)) {
    return {
      title: 'Reserve .dusk domain',
      description: 'Start protected registration using the connected wallet and current chain height.',
      fields: [
        { label: 'Reservation', value: call.args.commitment },
      ],
    }
  }

  if (call.functionName === 'complete_registration_runtime' && isCoreCompleteRegistrationRuntimeArgs(call.args)) {
    return {
      title: `Register ${call.args.label}.dusk`,
      description: 'Complete the reservation, activate the domain, and apply initial records.',
      fields: [
        { label: 'Reservation', value: call.args.commitment },
        { label: 'Domain', value: `${call.args.label}.dusk` },
        { label: 'Duration', value: formatYears(call.args.durationYears) },
        { label: 'Registration fee', value: `${formatLux(call.args.feeLux)} DUSK` },
        { label: 'Records', value: String(call.args.records.length) },
        { label: 'Primary domain', value: call.args.primaryEndpoint ? 'Set' : 'Not set' },
        ...(call.args.referrer ? [{ label: 'Referral', value: principalSummary(call.args.referrer) }] : []),
      ],
    }
  }

  if (call.functionName === 'renew_runtime' && isCoreRenewRuntimeArgs(call.args)) {
    return {
      title: 'Renew .dusk domain',
      description: 'Extend the registration period for an existing .dusk domain.',
      fields: [
        { label: 'Domain reference', value: call.args.node },
        { label: 'Duration', value: formatYears(call.args.durationYears) },
        { label: 'Registration fee', value: `${formatLux(call.args.feeLux)} DUSK` },
      ],
    }
  }

  if (call.functionName === 'update_authorities_runtime' && isCoreUpdateAuthoritiesRuntimeArgs(call.args)) {
    return {
      title: 'Update domain authorities',
      description: 'Transfer owner rights or replace the manager for this domain.',
      fields: [
        { label: 'Domain reference', value: call.args.node },
        { label: 'Owner authority', value: call.args.owner },
        { label: 'Manager authority', value: call.args.manager },
      ],
    }
  }

  if (call.functionName === 'escrow_fixed_sale_runtime' && isCoreEscrowFixedSaleRuntimeArgs(call.args)) {
    return {
      title: `List ${call.args.name}`,
      description: 'Move this domain into marketplace escrow and open a fixed-price sale.',
      fields: [
        { label: 'Domain', value: call.args.name },
        { label: 'Price', value: `${formatLux(call.args.priceLux)} DUSK` },
        { label: 'Buyer', value: call.args.privateBuyer ?? 'Anyone' },
        { label: 'Marketplace', value: call.args.marketplaceContract },
      ],
    }
  }

  if (call.functionName === 'escrow_auction_runtime' && isCoreEscrowAuctionRuntimeArgs(call.args)) {
    return {
      title: `Auction ${call.args.name}`,
      description: 'Move this domain into marketplace escrow and open a reserve auction.',
      fields: [
        { label: 'Domain', value: call.args.name },
        { label: 'Reserve', value: `${formatLux(call.args.reservePriceLux)} DUSK` },
        { label: 'Duration', value: `${call.args.durationBlocks} blocks after the first bid` },
        { label: 'Marketplace', value: call.args.marketplaceContract },
      ],
    }
  }

  if (call.functionName === 'accept_marketplace_offer_runtime' && isCoreAcceptMarketplaceOfferRuntimeArgs(call.args)) {
    return {
      title: 'Accept domain offer',
      description: 'Transfer this domain to the bidder and receive the sale proceeds.',
      fields: [
        { label: 'Domain reference', value: call.args.node },
        { label: 'Buyer', value: call.args.buyerAuthority },
        { label: 'Marketplace', value: call.args.marketplaceContract },
      ],
    }
  }

  if (call.functionName === 'set_record_sender_runtime' && isCoreSetRecordSenderRuntimeArgs(call.args)) {
    return {
      title: `Update ${recordApprovalLabel(call.args.record.key)}`,
      description: 'Change a public record for this .dusk domain.',
      fields: [
        { label: 'Domain reference', value: call.args.node },
        { label: 'Record', value: call.args.record.key },
        { label: 'Value', value: String(call.args.record.value) },
        { label: 'Visibility', value: call.args.record.visibility },
      ],
    }
  }

  if (call.functionName === 'clear_record_sender_runtime' && isCoreClearRecordSenderRuntimeArgs(call.args)) {
    return {
      title: `Clear ${recordApprovalLabel(call.args.key)}`,
      description: 'Remove a public record from this .dusk domain.',
      fields: [
        { label: 'Domain reference', value: call.args.node },
        { label: 'Record', value: call.args.key },
      ],
    }
  }

  if (call.functionName === 'mutate_records_sender_runtime' && isCoreMutateRecordsSenderRuntimeArgs(call.args)) {
    return {
      title: 'Update domain records',
      description: 'Apply multiple record changes for this .dusk domain.',
      fields: [
        { label: 'Domain reference', value: call.args.node },
        { label: 'Changes', value: String(call.args.mutations.length) },
        { label: 'Records', value: call.args.mutations.map((mutation) => mutation.key).join(', ') },
      ],
    }
  }

  if (call.functionName === 'set_primary_name_runtime' && isCoreSetPrimaryNameRuntimeArgs(call.args)) {
    return {
      title: `Set primary domain to ${call.args.name}`,
      description: 'Set the primary domain wallets can verify before display.',
      fields: [
        { label: 'Domain', value: call.args.name },
        { label: 'Address kind', value: call.args.endpointType },
        { label: 'Address', value: call.args.endpointValue },
      ],
    }
  }

  if (call.functionName === 'clear_primary_name_runtime' && isCoreClearPrimaryNameRuntimeArgs(call.args)) {
    return {
      title: 'Clear primary domain',
      description: 'Remove the primary domain so apps show the address instead.',
      fields: [
        { label: 'Address kind', value: call.args.endpointType },
        { label: 'Address', value: call.args.endpointValue },
      ],
    }
  }

  if (call.functionName === 'create_subname_runtime' && isCoreCreateSubnameRuntimeArgs(call.args)) {
    return {
      title: `Create ${call.args.name}`,
      description: 'Create a subdomain controlled under the selected parent domain.',
      fields: [
        { label: 'Parent', value: call.args.parentName },
        { label: 'Subdomain', value: call.args.name },
        { label: 'Owner authority', value: call.args.owner },
        { label: 'Manager authority', value: call.args.manager },
      ],
    }
  }

  return null
}
