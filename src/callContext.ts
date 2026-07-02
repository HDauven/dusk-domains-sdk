import { DUSK_NAME_CONTRACTS } from './callContracts'
import { decodedCoreDuskNameContext } from './callContextCore'
import { decodedTreasuryDuskNameContext } from './callContextTreasury'
import type {
  DuskNameCallMetadata,
  DuskNameContractMap,
  DuskNameDecodedContext,
} from './callTypes'

export function decodedDuskNameContext(
  call: DuskNameCallMetadata,
  _contracts: DuskNameContractMap = DUSK_NAME_CONTRACTS,
): DuskNameDecodedContext {
  void _contracts
  return decodedCoreDuskNameContext(call)
    ?? decodedTreasuryDuskNameContext(call)
    ?? {
      title: 'Review Dusk Domains update',
      description: 'Confirm this Dusk Domains request in your wallet.',
      fields: [],
    }
}
