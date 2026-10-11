/** Immutable calls with exact deposits and reviewed wire arguments. @module */
import { methodCatalog } from './catalog.ts'
import { contractId } from './bytes.ts'
import { wireInput } from './wire.ts'
import { walletGasLimit } from './wallet-gas.ts'
import type { Methods } from './types.ts'
import type { ContractRole } from './manifest.ts'
export type Method<R extends ContractRole> = keyof Methods[R] & string
export type Input<
  R extends ContractRole,
  M extends Method<R>,
> = Methods[R][M] extends { input: infer I } ? I : never
export type Output<
  R extends ContractRole,
  M extends Method<R>,
> = Methods[R][M] extends { output: infer O } ? O : never
export interface FrozenCall<
  R extends ContractRole = ContractRole,
  M extends string = string,
> {
  readonly role: R
  readonly contractId: string
  readonly functionName: M
  readonly args: M extends Method<R> ? Input<R, M> : unknown
  readonly deposit: string
  readonly gasLimit: bigint
}
export interface MethodDefinition {
  name: string
  input: string
  output: string
  mode: string
}
export function methodDefinition(
  role: ContractRole,
  method: string,
): MethodDefinition {
  const definition = (methodCatalog[role] as readonly MethodDefinition[]).find(
    (m) => m.name === method,
  )
  if (!definition) throw new Error(`Unknown ${role} method: ${method}`)
  return definition
}
function freeze<T>(value: T): T {
  if (value && typeof value === 'object') {
    for (const child of Object.values(value)) freeze(child)
    Object.freeze(value)
  }
  return value
}
/** Build a user-callable write. System callbacks cannot be submitted as wallet calls. */
export function buildCall<R extends ContractRole, M extends Method<R>>(
  role: R,
  target: string,
  method: M,
  args: Input<R, M>,
): FrozenCall<R, M> {
  const definition = methodDefinition(role, method)
  if (definition.mode !== 'write')
    throw new Error('Method is not a public wallet action')
  const checked = wireInput(
    role,
    method,
    definition.input,
    args,
  ) as Record<string, unknown>
  let deposit = '0'
  if (role === 'store' && (method === 'register' || method === 'renew'))
    deposit = checked.expected_fee_lux as string
  if (role === 'marketplace') {
    if (method === 'buy_fixed')
      deposit = (checked.order as { terms: { amount_lux: string } }).terms
        .amount_lux
    if (method === 'place_bid') deposit = checked.amount_lux as string
    if (method === 'place_offer')
      deposit = (checked.terms as { amount_lux: string }).amount_lux
    if (method === 'renew_escrow')
      deposit = (checked.renewal as { expected_fee_lux: string })
        .expected_fee_lux
  }
  return freeze({
    role,
    contractId: contractId(target),
    functionName: method,
    args: checked,
    deposit,
    gasLimit: walletGasLimit(role, method, checked),
  }) as FrozenCall<R, M>
}
