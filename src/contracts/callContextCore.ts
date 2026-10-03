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
  isPoolNodeArgs,
  isCoreSetPrimaryNameRuntimeArgs,
  isCoreSetRecordSenderRuntimeArgs,
  isCoreUpdateAuthoritiesRuntimeArgs,
  isCoreTakeBackSubnamesRuntimeArgs,
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
      title: 'Initialize a Dusk Domains registry',
      description: 'Connect the registry to its router, which supplies the treasury, marketplace and fees.',
      fields: [{ label: 'Router', value: call.args.router }],
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
      description: 'Pay to extend this root name from its current expiry. Anyone can renew; ownership and records stay unchanged.',
      fields: [
        { label: 'Domain reference', value: call.args.node },
        { label: 'Duration', value: formatYears(call.args.durationYears) },
        { label: 'Registration fee', value: `${formatLux(call.args.feeLux)} DUSK` },
      ],
    }
  }

  if (call.functionName === 'move_records_runtime' && isPoolNodeArgs(call.args)) {
    return {
      title: 'Move domain records',
      description: 'Copy the records into the resolver that takes new records, so you can add more. The old copy is cleared.',
      fields: [
        { label: 'Domain reference', value: call.args.node },
      ],
    }
  }

  if (call.functionName === 'remove_subname_runtime' && isPoolNodeArgs(call.args)) {
    return { title: 'Remove subname', description: 'Remove this subname and every name below it, including their records and primary names.',
      fields: [{ label: 'Subname reference', value: call.args.node }] }
  }
  if (call.functionName === 'take_back_subnames_runtime' && isCoreTakeBackSubnamesRuntimeArgs(call.args)) {
    return { title: `Take back ${call.args.nodes.length} subnames`, description: 'Reassign these subnames. Changing an owner or manager always clears that name’s records and primary name.',
      fields: [{ label: 'Ancestor reference', value: call.args.node }, { label: 'Owner authority', value: call.args.owner }, { label: 'Manager authority', value: call.args.manager }] }
  }

  if (call.functionName === 'update_authorities_runtime' && isCoreUpdateAuthoritiesRuntimeArgs(call.args)) {
    return {
      title: 'Update domain authorities',
      description: call.args.clearRecords
        ? 'Change authorities and clear this name’s records and primary name.'
        : 'Transfer owner rights or replace the manager. An ancestor changing another holder’s owner or manager always clears the subname’s records and primary name.',
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
        { label: 'Offer', value: `${formatLux(call.args.expectedAmountLux)} DUSK` },
        { label: 'Offer ID', value: String(call.args.expectedOfferId) },
        { label: 'Fee', value: `${call.args.expectedFeeBps / 100}%` },
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

  if (call.functionName === 'prune_subname_runtime' && isPoolNodeArgs(call.args)) {
    return {
      title: 'Prune expired subdomain',
      description: 'Remove this expired subdomain and its descendants to free namespace capacity.',
      fields: [{ label: 'Node', value: call.args.node }],
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
