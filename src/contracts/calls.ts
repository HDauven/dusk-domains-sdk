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

export * from './callBuilders'
export { decodedDuskDomainContext } from './callContext'
export { DUSK_DOMAINS_CONTRACTS, DUSK_DOMAINS_PLACEHOLDER_CONTRACT_ID } from './callContracts'
export * from './callTypes'
export { toDuskDomainWireArgs } from './callWireArgs'

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
  return await app.readContract({
    contract: requireDuskDomainContract(contracts, call.contract),
    functionName: call.functionName,
    args: toDuskDomainWireArgs(call),
    decodedContext: decodedDuskDomainContext(call, contracts),
  })
}

export async function prepareDuskDomainContractCall(
  app: DuskConnectAppLike,
  call: DuskDomainCallMetadata,
  contracts: DuskDomainContractMap = DUSK_DOMAINS_CONTRACTS,
) : Promise<unknown> {
  const deposit = duskDomainCallDepositLux(call)
  return await app.prepareContractCall({
    contract: requireDuskDomainContract(contracts, call.contract),
    functionName: call.functionName,
    args: toDuskDomainWireArgs(call),
    ...(deposit ? { deposit } : {}),
    decodedContext: decodedDuskDomainContext(call, contracts),
  })
}

export async function writeDuskDomainContract(
  app: DuskConnectAppLike,
  call: DuskDomainCallMetadata,
  preparedCall?: unknown,
  contracts: DuskDomainContractMap = DUSK_DOMAINS_CONTRACTS,
) : Promise<unknown> {
  const deposit = duskDomainCallDepositLux(call)
  return await app.writeContract({
    contract: requireDuskDomainContract(contracts, call.contract),
    functionName: call.functionName,
    args: toDuskDomainWireArgs(call),
    ...(deposit ? { deposit } : {}),
    decodedContext: decodedDuskDomainContext(call, contracts),
    preparedCall,
  })
}

export function requireDuskDomainContract(
  contracts: DuskDomainContractMap,
  key: DuskDomainCallMetadata['contract'],
): DuskDomainContractPreset {
  const contract = contracts[key]
  if (!contract) throw new Error(`Dusk Domains ${key} contract is not configured.`)
  return contract
}

export function isRuntimeBoundDuskDomainWrite(call: DuskDomainCallMetadata): boolean {
  return call.kind === 'write' && runtimeBoundBrowserWriteCalls.has(`${call.contract}.${call.functionName}`)
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

const runtimeBoundBrowserWriteCalls = new Set([
  'core.set_referral_config_runtime',
  'core.set_fee_config_runtime',
  'core.commit_runtime',
  'core.complete_registration_runtime',
  'core.renew_runtime',
  'core.update_authorities_runtime',
  'core.escrow_fixed_sale_runtime',
  'core.escrow_auction_runtime',
  'core.accept_marketplace_offer_runtime',
  'core.set_record_sender_runtime',
  'core.clear_record_sender_runtime',
  'core.mutate_records_sender_runtime',
  'core.set_primary_name_runtime',
  'core.clear_primary_name_runtime',
  'core.create_subname_runtime',
  'treasury.update_operator_runtime',
  'treasury.claim_runtime',
  'treasury.claim_all_runtime',
  'treasury.claim_referral_reward_runtime',
  'treasury.claim_all_referral_rewards_runtime',
  'marketplace.set_fee_runtime',
  'marketplace.update_operator_runtime',
  'marketplace.buy_fixed_sale_runtime',
  'marketplace.cancel_fixed_sale_runtime',
  'marketplace.expire_fixed_sale_runtime',
  'marketplace.place_bid_runtime',
  'marketplace.cancel_auction_runtime',
  'marketplace.expire_auction_runtime',
  'marketplace.settle_auction_runtime',
  'marketplace.place_offer_runtime',
  'marketplace.cancel_offer_runtime',
  'marketplace.expire_offer_runtime',
  'marketplace.claim_refund_runtime',
])
