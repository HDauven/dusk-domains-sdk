import { decodedCoreDuskDomainContext } from './callContextCore'
import { decodedMarketplaceDuskDomainContext } from './callContextMarketplace'
import { decodedTreasuryDuskDomainContext } from './callContextTreasury'
import type {
  DuskDomainCallMetadata,
  DuskDomainDecodedContext,
} from './callTypes'

export function decodedDuskDomainContext(
  call: DuskDomainCallMetadata,
): DuskDomainDecodedContext {
  return decodedCoreDuskDomainContext(call)
    ?? decodedTreasuryDuskDomainContext(call)
    ?? decodedMarketplaceDuskDomainContext(call)
    ?? {
      title: 'Review Dusk Domains update',
      description: 'Confirm this Dusk Domains request in your wallet.',
      fields: [],
    }
}
