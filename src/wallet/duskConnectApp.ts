/** Dusk Connect public-wallet integration with exact deposits and explicit action gas. @module */
import { type FrozenCall, buildCall } from '../frozen/calls.ts'
import type { LoadedRelease } from '../frozen/manifest.ts'
import { MAX_AUTO_GAS_PRICE, MAX_GAS_LIMIT } from '../frozen/gas.ts'
import { stringifyJson, u64 } from '../frozen/json.ts'
import { contractId, equalBytes, hex } from '../frozen/bytes.ts'
import {
  confirmContract,
  refusedContract,
  registrationProof,
  selectedPolicy,
  signableContract,
  UnverifiedContractError,
  verifiedContract,
  verifiedSelection,
  type VerifiedContract,
} from '../frozen/trust.ts'
import { wireValue } from '../frozen/wire.ts'
import type { CustodyIntent, IssueReserved, Register, TransferAndCall } from '../frozen/types.ts'
import {
  checkPublicBalanceForWrite,
  WriteBalanceError,
} from '../writes/balance.ts'
export { UnverifiedContractError } from '../frozen/trust.ts'
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
/**
 * Pass app.wallet from @dusk/connect and a client's `client.release`: calls are prepared and
 * signed only for contracts that client verified against release commitments, and a reveal
 * only for terms it quoted. `submit` checks again immediately before dusk_sendTransaction,
 * which receives the encoded bytes directly. Other arguments are the caller's: the app checks
 * contracts and quotes, not where a value came from, so read one copied from a lens reply again
 * directly before signing it.
 */
export function createDuskDomainsConnectApp(
  wallet: ConnectWallet,
  release: LoadedRelease,
  options: ConnectOptions = {},
): ConnectApp {
  const chain = release.manifest.chainId,
    directory = release.manifest.contracts.find((c) => c.role === 'directory')!.contractId,
    absent = 'Target is absent from verified release',
    custodyAbsent = 'Custody target is not a marketplace verified for this release'
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
  async function prepare(
    call: FrozenCall,
  ): Promise<{ checked: FrozenCall; prepared: PreparedCall }> {
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
    await confirm(checked)
    const target = authorize(checked)
    await assertChain()
    const encoded = target.driver.encodeInput(
        checked.functionName,
        stringifyJson(checked.args),
      ),
      gasPrice = await price()
    await assertChain()
    const args = checked.args as { valid_until?: bigint }
    // Chain height/deadline and current order/home should be rechecked by the UI before approval.
    if (args.valid_until !== undefined) u64(args.valid_until)
    authorize(checked)
    return {
      checked,
      prepared: {
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
      },
    }
  }
  /**
   * Verify from the chain, once, each contract `authorize` checks that the client verified from its
   * verification cache only: the directory, the target, the policy a registration selects, and the
   * custody market. One that fails throws its `ContractRefusedError`.
   */
  async function confirm(checked: FrozenCall): Promise<void> {
    // The directory's binding and records vouch for the rest, so it is confirmed first.
    await confirmContract(release, directory, 'directory', absent)
    await confirmContract(release, checked.contractId, checked.role, absent)
    if (checked.role !== 'store') return
    if (checked.functionName === 'register' || checked.functionName === 'issue_reserved') {
      const version = (checked.args as Register | IssueReserved).expected_policy_version,
        policy = selectedPolicy(release, version)
      if (policy)
        await confirmContract(release, policy, 'policy', `Registration policy selection ${version} is not verified against this release`)
    }
    if (checked.functionName === 'transfer_and_call')
      await confirmContract(release, hex((checked.args as TransferAndCall).target), 'marketplace', custodyAbsent)
  }
  /**
   * What this client verified decides what can be signed, not the release maps. Synchronous, so
   * a check right before sending sees the ledger as the transaction leaves.
   */
  function authorize(checked: FrozenCall): VerifiedContract {
    const target = signable(checked.contractId, checked.role)
    if (!target) throw unverified(checked.contractId, checked.role, absent)
    // A reveal runs under the policy its expected version selects, at the price its quote showed:
    // sign only terms this client quoted itself, under the policy it read as that selection.
    if (checked.role === 'store' && checked.functionName === 'register') {
      const args = checked.args as Register
      const policy = selectedPolicy(release, args.expected_policy_version)
      if (policy) signable(policy, 'policy')
      if (!registrationProof(release, checked.contractId, args))
        throw new Error(
          `Registration at policy selection ${args.expected_policy_version} is not verified against this release: sign only a reveal built from a quote this client returned (FrozenClient.quoteRegistration or prepareRegistration)`,
        )
    }
    // A reserved issuance is free, under the selection and config version the client read.
    if (checked.role === 'store' && checked.functionName === 'issue_reserved') {
      const args = checked.args as IssueReserved,
        policy = selectedPolicy(release, args.expected_policy_version)
      if (policy) signable(policy, 'policy')
      const selection = verifiedSelection(release, args.expected_policy_version)
      if (selection?.configVersion !== u64(args.expected_policy_config_version).toString())
        throw new Error(
          `Registration policy selection ${args.expected_policy_version} is not verified against this release; quote it with FrozenClient.quoteRegistration first`,
        )
    }
    // A custody hand-off gives the name to its target: only a marketplace the client verified,
    // with that market's encoding of terms for this store and name.
    if (checked.role === 'store' && checked.functionName === 'transfer_and_call') {
      const args = checked.args as TransferAndCall
      const market = signable(hex(args.target), 'marketplace')
      if (!market) throw unverified(hex(args.target), 'marketplace', custodyAbsent)
      let intent: CustodyIntent
      try {
        intent = wireValue(
          'CustodyIntent',
          market.driver.decodeInput('custody_intent', Uint8Array.from(args.data)),
        ) as CustodyIntent
      } catch {
        throw new Error(
          'Custody intent does not decode with the verified marketplace driver',
        )
      }
      const name = intent.terms.name
      if (
        contractId(intent.terms.store) !== checked.contractId ||
        !equalBytes(name.key.root, args.name.key.root) ||
        !equalBytes(name.key.node, args.name.key.node) ||
        name.incarnation.generation !== args.name.incarnation.generation ||
        name.incarnation.serial !== args.name.incarnation.serial
      )
        throw new Error('Custody intent does not match the call')
    }
    return target
  }
  /**
   * A contract this client cannot sign for: unverified, or refused, or vouched for by a directory it
   * refused. The refusal is the error's cause.
   */
  function unverified(id: string, role: FrozenCall['role'], message: string): UnverifiedContractError {
    return new UnverifiedContractError(
      contractId(id),
      role,
      message,
      refusedContract(release, id) ?? refusedContract(release, directory),
    )
  }
  /**
   * A verified contract the release committed to that this client may sign for, or undefined. A
   * verified one without both commitments throws: it is readable, never signable.
   */
  function signable(id: string, role: FrozenCall['role']): VerifiedContract | undefined {
    const row = signableContract(release, id, role)
    if (row) return row
    if (verifiedContract(release, id, role)?.signable === false)
      throw new Error(
        `${role[0].toUpperCase()}${role.slice(1)} ${contractId(id)} has no reviewed code and init commitments in this release: it can be read, not signed for`,
      )
    return undefined
  }
  return {
    prepare: async (call) => (await prepare(call)).prepared,
    async submit(call) {
      const { checked, prepared } = await prepare(call)
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
      // Verification can change while the wallet answers: a refused target or an evicted quote
      // stops here. No prepared payload is accepted back from a caller; submission re-encodes.
      authorize(checked)
      return wallet.request('dusk_sendTransaction', {
        kind: 'contract_call',
        privacy: 'public',
        amount: '0',
        ...payload,
      })
    },
  }
}
