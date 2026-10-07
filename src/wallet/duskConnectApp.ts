/** Dusk Connect public-wallet integration with exact deposits and explicit action gas. @module */
import { type FrozenCall, buildCall } from '../frozen/calls.ts'
import type { LoadedRelease } from '../frozen/manifest.ts'
import { MAX_AUTO_GAS_PRICE, MAX_GAS_LIMIT } from '../frozen/gas.ts'
import { stringifyJson, u64 } from '../frozen/json.ts'
import { hex } from '../frozen/bytes.ts'
import {
  checkPublicBalanceForWrite,
  WriteBalanceError,
} from '../writes/balance.ts'
export interface ConnectWallet {
  request(method: string, params?: unknown): Promise<unknown>
}
export interface PreparedCall {
  chainId: string
  contractId: string
  fnName: string
  fnArgs: string
  deposit: string
  gas: { limit: string; price: string }
  display: {
    action: string
    arguments: string
    depositLux: string
    maximumGasCostLux: string
  }
}
export interface ConnectOptions {
  gasPrice?: bigint
  estimateTimeoutMs?: number
}
export interface ConnectApp {
  prepare(call: FrozenCall): Promise<PreparedCall>
  submit(call: FrozenCall): Promise<unknown>
}
/** Pass app.wallet from @dusk/connect. Encoded bytes go directly to dusk_sendTransaction. */
export function createDuskDomainsConnectApp(
  wallet: ConnectWallet,
  release: LoadedRelease,
  options: ConnectOptions = {},
): ConnectApp {
  const chain = release.manifest.chainId
  async function assertChain(): Promise<void> {
    if ((await wallet.request('dusk_chainId')) !== chain)
      throw new Error(`Wallet must be connected to ${chain}`)
  }
  async function price(): Promise<bigint> {
    if (options.gasPrice !== undefined) {
      const p = u64(options.gasPrice)
      if (p === 0n) throw new Error('Gas price must be positive')
      return p
    }
    let timeout: ReturnType<typeof setTimeout> | undefined
    try {
      const result = await Promise.race([
        wallet.request('dusk_estimateGas', {}),
        new Promise<null>((resolve) => {
          timeout = setTimeout(
            () => resolve(null),
            options.estimateTimeoutMs ?? 1000,
          )
        }),
      ])
      const candidate = (result as { median?: unknown } | null)?.median
      const p = u64(
        typeof candidate === 'string' && /^\d+$/u.test(candidate)
          ? BigInt(candidate)
          : candidate,
      )
      return p < 1n ? 1n : p > MAX_AUTO_GAS_PRICE ? MAX_AUTO_GAS_PRICE : p
    } catch {
      return 1n
    } finally {
      clearTimeout(timeout)
    }
  }
  async function prepare(call: FrozenCall): Promise<PreparedCall> {
    // Rebuild prevents a fabricated or modified call from substituting a deposit/gas class.
    const checked = buildCall(
      call.role,
      call.contractId,
      call.functionName as never,
      call.args as never,
    )
    if (
      call.deposit !== checked.deposit ||
      call.gasLimit !== checked.gasLimit ||
      checked.gasLimit > MAX_GAS_LIMIT
    )
      throw new Error('Call deposit or gas policy was modified')
    const descriptor = release.contracts.get(checked.contractId),
      driver = release.drivers.get(checked.contractId)
    if (!descriptor || descriptor.role !== checked.role || !driver)
      throw new Error('Target is absent from verified release')
    await assertChain()
    const encoded = driver.encodeInput(
        checked.functionName,
        stringifyJson(checked.args),
      ),
      gasPrice = await price()
    await assertChain()
    const args = checked.args as { valid_until?: bigint }
    // Chain height/deadline and current order/home should be rechecked by the UI before approval.
    if (args.valid_until !== undefined) u64(args.valid_until)
    return {
      chainId: chain,
      contractId: checked.contractId,
      fnName: checked.functionName,
      fnArgs: `0x${hex(encoded)}`,
      deposit: checked.deposit,
      gas: { limit: checked.gasLimit.toString(), price: gasPrice.toString() },
      display: {
        action: `${checked.role}.${checked.functionName}`,
        arguments: stringifyJson(checked.args),
        depositLux: checked.deposit,
        maximumGasCostLux: (checked.gasLimit * gasPrice).toString(),
      },
    }
  }
  return {
    prepare,
    async submit(call) {
      const prepared = await prepare(call)
      await assertChain()
      let balance: unknown
      try {
        balance = await wallet.request('dusk_getPublicBalance')
      } catch {
        balance = null
      }
      const funds = checkPublicBalanceForWrite({
        balanceLux: (balance as { value?: unknown } | null)?.value,
        depositLux: prepared.deposit,
        gasLimit: BigInt(prepared.gas.limit),
        gasPrice: BigInt(prepared.gas.price),
      })
      if (!funds.ok) throw new WriteBalanceError(funds)
      await assertChain()
      const { chainId: _, ...payload } = prepared
      // No prepared payload is accepted back from a caller; submission always re-encodes.
      return wallet.request('dusk_sendTransaction', {
        kind: 'contract_call',
        privacy: 'public',
        amount: '0',
        ...payload,
      })
    },
  }
}
