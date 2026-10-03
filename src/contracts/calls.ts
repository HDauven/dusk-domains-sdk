import { DUSK_DOMAINS_CONTRACTS } from './callContracts'
import { decodedDuskDomainContext } from './callContext'
import type {
  DuskConnectAppLike,
  DuskDataDriverLike,
  DuskDomainCallMetadata,
  DuskDomainContractMap,
  DuskDomainContractPreset,
} from './callTypes'
import { toDuskDomainWireArgs } from './callWireArgs'
import { withRoutedDuskDomainCall } from './poolRouting'
import { prepareBoundCall, preparedCallForTarget } from './preparedCalls'

export * from './callBuilders'
export { decodedDuskDomainContext } from './callContext'
export { DUSK_DOMAINS_CONTRACTS, DUSK_DOMAINS_PLACEHOLDER_CONTRACT_ID } from './callContracts'
export * from './callTypes'
export {
  clearDuskDomainRegistryCache,
  contractIdFromOutput,
  locateNameRegistry,
  registrationRegistry,
  routeDuskDomainCall,
} from './poolRouting'
export { isRuntimeBoundDuskDomainWrite, toDuskDomainWireArgs } from './callWireArgs'

export function encodeDuskDomainCall(driver: DuskDataDriverLike, call: DuskDomainCallMetadata): Uint8Array {
  const wireArgs = toDuskDomainWireArgs(call)
  return driver.encodeInputFn(call.functionName, JSON.stringify(wireArgs === undefined ? null : wireArgs))
}

export function decodeDuskDomainOutput<T>(driver: DuskDataDriverLike, call: DuskDomainCallMetadata, bytes: Uint8Array): T {
  return driver.decodeOutputFn(call.functionName, bytes) as T
}

export async function readDuskDomainContract(
  app: DuskConnectAppLike,
  call: DuskDomainCallMetadata,
  contracts: DuskDomainContractMap = DUSK_DOMAINS_CONTRACTS,
) : Promise<unknown> {
  return withRoutedDuskDomainCall(app, call, contracts, async (call) => {
    return await app.readContract({
      contract: requireDuskDomainContract(contracts, call.contract, call.contractId),
      functionName: call.functionName,
      args: toDuskDomainWireArgs(call),
      decodedContext: decodedDuskDomainContext(call),
    })
  })
}

export async function prepareDuskDomainContractCall(
  app: DuskConnectAppLike,
  call: DuskDomainCallMetadata,
  contracts: DuskDomainContractMap = DUSK_DOMAINS_CONTRACTS,
) : Promise<unknown> {
  return withRoutedDuskDomainCall(app, call, contracts, async (call) => {
    const deposit = duskDomainCallDepositLux(call)
    const contract = requireDuskDomainContract(contracts, call.contract, call.contractId)
    return await prepareBoundCall(app, contract.contractId, () => app.prepareContractCall({
      contract,
      functionName: call.functionName,
      args: toDuskDomainWireArgs(call),
      ...(deposit ? { deposit } : {}),
      decodedContext: decodedDuskDomainContext(call),
    }))
  })
}

export async function writeDuskDomainContract(
  app: DuskConnectAppLike,
  call: DuskDomainCallMetadata,
  preparedCall?: unknown,
  contracts: DuskDomainContractMap = DUSK_DOMAINS_CONTRACTS,
) : Promise<unknown> {
  return withRoutedDuskDomainCall(app, call, contracts, async (call) => {
    const deposit = duskDomainCallDepositLux(call)
    const contract = requireDuskDomainContract(contracts, call.contract, call.contractId)
    return await app.writeContract({
      contract,
      functionName: call.functionName,
      args: toDuskDomainWireArgs(call),
      ...(deposit ? { deposit } : {}),
      decodedContext: decodedDuskDomainContext(call),
      preparedCall: preparedCall === undefined ? undefined : preparedCallForTarget(app, contract.contractId, preparedCall),
    })
  })
}

export function requireDuskDomainContract(
  contracts: DuskDomainContractMap,
  key: DuskDomainCallMetadata['contract'],
  contractId?: string,
): DuskDomainContractPreset {
  const contract = contracts[key]
  if (!contract) throw new Error(`Dusk Domains ${key} contract is not configured.`)
  const id = contractId ?? contract.contractId
  if (!/^0x[0-9a-f]{64}$/iu.test(id) || /^0x0{64}$/iu.test(id)) {
    throw new Error(`Dusk Domains ${key} contract must have a non-zero 32-byte hex contract ID.`)
  }
  return contractId === undefined ? contract : { ...contract, contractId }
}

export function duskDomainCallDepositLux(call: DuskDomainCallMetadata): string | undefined {
  if (!isPaidDuskDomainCall(call)) return undefined
  const feeLux = (call.args as { feeLux?: unknown; amountLux?: unknown; priceLux?: unknown }).feeLux
    ?? (call.args as { amountLux?: unknown }).amountLux
    ?? (call.args as { priceLux?: unknown }).priceLux
  if (typeof feeLux !== 'number' || feeLux <= 0) return undefined
  if (!Number.isSafeInteger(feeLux)) {
    throw new Error('Dusk Domains paid contract calls require a safe integer Lux fee.')
  }
  return String(feeLux)
}

function isPaidDuskDomainCall(call: DuskDomainCallMetadata): boolean {
  return (
    call.contract === 'core'
    && (
      call.functionName === 'complete_registration_runtime'
      || call.functionName === 'renew_runtime'
    )
  ) || (
    call.contract === 'marketplace'
    && (
      call.functionName === 'buy_fixed_sale_runtime'
      || call.functionName === 'place_bid_runtime'
      || call.functionName === 'place_offer_runtime'
    )
  )
}
