import { DUSK_NAME_CONTRACTS } from './callContracts'
import { decodedDuskNameContext } from './callContext'
import type {
  DuskConnectAppLike,
  DuskDataDriverLike,
  DuskNameCallMetadata,
  DuskNameContractMap,
} from './callTypes'
import { toDuskNameWireArgs } from './callWireArgs'

export * from './callBuilders'
export { decodedDuskNameContext } from './callContext'
export { DUSK_NAME_CONTRACTS, DUSK_NAME_PLACEHOLDER_CONTRACT_ID } from './callContracts'
export * from './callTypes'
export { toDuskNameWireArgs } from './callWireArgs'

export function encodeDuskNameCall(driver: DuskDataDriverLike, call: DuskNameCallMetadata): Uint8Array {
  const wireArgs = toDuskNameWireArgs(call)
  return driver.encodeInputFn(call.functionName, JSON.stringify(wireArgs === undefined ? null : wireArgs))
}

export function decodeDuskNameOutput<T>(driver: DuskDataDriverLike, call: DuskNameCallMetadata, bytes: Uint8Array): T {
  return driver.decodeOutputFn(call.functionName, bytes) as T
}

export async function readDuskNameContract(
  app: DuskConnectAppLike,
  call: DuskNameCallMetadata,
  contracts: DuskNameContractMap = DUSK_NAME_CONTRACTS,
) : Promise<unknown> {
  return await app.readContract({
    contract: contracts[call.contract],
    functionName: call.functionName,
    args: toDuskNameWireArgs(call),
    decodedContext: decodedDuskNameContext(call, contracts),
  })
}

export async function prepareDuskNameContractCall(
  app: DuskConnectAppLike,
  call: DuskNameCallMetadata,
  contracts: DuskNameContractMap = DUSK_NAME_CONTRACTS,
) : Promise<unknown> {
  const deposit = duskNameCallDepositLux(call)
  return await app.prepareContractCall({
    contract: contracts[call.contract],
    functionName: call.functionName,
    args: toDuskNameWireArgs(call),
    ...(deposit ? { deposit } : {}),
    decodedContext: decodedDuskNameContext(call, contracts),
  })
}

export async function writeDuskNameContract(
  app: DuskConnectAppLike,
  call: DuskNameCallMetadata,
  preparedCall?: unknown,
  contracts: DuskNameContractMap = DUSK_NAME_CONTRACTS,
) : Promise<unknown> {
  const deposit = duskNameCallDepositLux(call)
  return await app.writeContract({
    contract: contracts[call.contract],
    functionName: call.functionName,
    args: toDuskNameWireArgs(call),
    ...(deposit ? { deposit } : {}),
    decodedContext: decodedDuskNameContext(call, contracts),
    preparedCall,
  })
}

export function isRuntimeBoundDuskNameWrite(call: DuskNameCallMetadata): boolean {
  return call.kind === 'write' && runtimeBoundBrowserWriteCalls.has(`${call.contract}.${call.functionName}`)
}

export function duskNameCallDepositLux(call: DuskNameCallMetadata): string | undefined {
  if (!isPaidDuskNameCall(call)) return undefined
  const feeLux = (call.args as { feeLux?: unknown }).feeLux
  if (typeof feeLux !== 'number' || feeLux <= 0) return undefined
  if (!Number.isSafeInteger(feeLux)) {
    throw new Error('Dusk Domains paid contract calls require a safe integer Lux fee.')
  }
  return String(feeLux)
}

function isPaidDuskNameCall(call: DuskNameCallMetadata): boolean {
  return call.contract === 'core'
    && (
      call.functionName === 'complete_registration_runtime'
      || call.functionName === 'renew_runtime'
    )
}

const runtimeBoundBrowserWriteCalls = new Set([
  'core.set_referral_config_runtime',
  'core.set_fee_config_runtime',
  'core.commit_runtime',
  'core.complete_registration_runtime',
  'core.renew_runtime',
  'core.update_authorities_runtime',
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
])
