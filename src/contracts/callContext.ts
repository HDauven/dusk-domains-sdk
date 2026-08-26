import { decodedCoreDuskDomainContext } from './callContextCore'
import { decodedMarketplaceDuskDomainContext } from './callContextMarketplace'
import { decodedTreasuryDuskDomainContext } from './callContextTreasury'
import type {
  DuskDomainCallMetadata,
  DuskDomainContractMap,
  DuskDomainDecodedContext,
} from './callTypes'

export function decodedDuskDomainContext(
  call: DuskDomainCallMetadata,
  _contracts?: DuskDomainContractMap,
): DuskDomainDecodedContext {
  void _contracts
  return decodedCoreDuskDomainContext(call)
    ?? decodedTreasuryDuskDomainContext(call)
    ?? decodedMarketplaceDuskDomainContext(call)
    ?? {
      title: 'Review Dusk Domains update',
      description: 'Confirm this Dusk Domains request in your wallet.',
      fields: [],
    }
}
