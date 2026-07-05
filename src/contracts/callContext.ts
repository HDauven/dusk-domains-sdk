import { DUSK_DOMAINS_CONTRACTS } from './callContracts'
import { decodedCoreDuskDomainContext } from './callContextCore'
import { decodedTreasuryDuskDomainContext } from './callContextTreasury'
import type {
  DuskDomainCallMetadata,
  DuskDomainContractMap,
  DuskDomainDecodedContext,
} from './callTypes'

export function decodedDuskDomainContext(
  call: DuskDomainCallMetadata,
  _contracts: DuskDomainContractMap = DUSK_DOMAINS_CONTRACTS,
): DuskDomainDecodedContext {
  void _contracts
  return decodedCoreDuskDomainContext(call)
    ?? decodedTreasuryDuskDomainContext(call)
    ?? {
      title: 'Review Dusk Domains update',
      description: 'Confirm this Dusk Domains request in your wallet.',
      fields: [],
    }
}
