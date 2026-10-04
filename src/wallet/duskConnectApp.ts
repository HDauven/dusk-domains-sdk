import type {
  DuskConnectAppLike,
  DuskDomainContractPreset,
  DuskDomainDecodedContext,
  DuskDomainGas,
} from '../contracts/calls'
import { prepareBoundCall, preparedCallForTarget } from '../contracts/preparedCalls'
import { DUSK_DOMAIN_MAX_AUTO_GAS_PRICE } from '../contracts/callGas'

export type DuskDomainsContractCallParams = {
  contract: DuskDomainContractPreset
  functionName: string
  args?: unknown
  deposit?: string
  decodedContext?: DuskDomainDecodedContext
}

export type DuskDomainsWriteContractCallParams = DuskDomainsContractCallParams & {
  preparedCall?: unknown
  gas?: { limit: string; price: string }
}

export type DuskDomainsConnectAppTransport = {
  readonly chainId?: string
  readonly state?: { readonly chainId: string | null }
  wallet?: { request: (method: string, params?: unknown) => Promise<unknown> }
  readContract?: (params: DuskDomainsContractCallParams) => Promise<unknown>
  prepareContractCall?: (params: DuskDomainsContractCallParams) => Promise<unknown>
  writeContract?: (params: DuskDomainsWriteContractCallParams) => Promise<unknown>
  request?: (request: { method: string; params?: unknown }) => Promise<unknown>
}

export type DuskDomainsConnectAppOptions = {
  requestMethods?: {
    readContract?: string
    prepareContractCall?: string
    writeContract?: string
  }
}

const defaultRequestMethods = {
  readContract: 'dusk_readContract',
  prepareContractCall: 'dusk_prepareContractCall',
  writeContract: 'dusk_sendTransaction',
} as const

const GAS_PRICE_TIMEOUT_MS = 1_000

export function createDuskDomainsConnectApp(
  transport: DuskDomainsConnectAppTransport,
  options: DuskDomainsConnectAppOptions = {},
): DuskConnectAppLike {
  const requestMethods = {
    ...defaultRequestMethods,
    ...options.requestMethods,
  }
  const chain = { get chainId() { return transport.state ? transport.state.chainId ?? undefined : transport.chainId } }

  return {
    get chainId() { return chain.chainId },
    async readContract(params) {
      if (transport.readContract) return await transport.readContract(connectReadContractParams(params))
      return await requestTransport(transport, requestMethods.readContract, connectReadContractParams(params))
    },
    async prepareContractCall(params) {
      return await prepareBoundCall(chain, params.contract.contractId, async () => {
        if (transport.prepareContractCall) return await transport.prepareContractCall(connectContractParams(params))
        return await requestTransport(transport, requestMethods.prepareContractCall, connectContractParams(params))
      })
    },
    async writeContract(params) {
      const { gas, ...callParams } = params
      const writeParams: DuskDomainsWriteContractCallParams = {
        ...callParams,
        ...(gas ? { gas: await resolveGas(transport, gas) } : {}),
      }
      if (writeParams.preparedCall !== undefined) {
        writeParams.preparedCall = preparedCallForTarget(chain, writeParams.contract.contractId, writeParams.preparedCall)
      }
      if (transport.writeContract) return await transport.writeContract(connectWriteContractParams(writeParams))
      const requestParams = requestMethods.writeContract === defaultRequestMethods.writeContract
        ? connectSendTransactionParams(writeParams)
        : connectContractParams(writeParams)
      return await requestTransport(transport, requestMethods.writeContract, requestParams)
    },
  }
}

function connectReadContractParams(params: DuskDomainsContractCallParams) {
  const callParams = { ...params }
  delete callParams.decodedContext
  return callParams
}

function connectContractParams(params: DuskDomainsContractCallParams) {
  const callParams = { ...params }
  delete callParams.decodedContext

  return {
    privacy: 'public',
    ...callParams,
    display: params.decodedContext,
  }
}

function connectWriteContractParams(params: DuskDomainsWriteContractCallParams) {
  const callParams = { ...params }
  delete callParams.preparedCall
  return connectContractParams(callParams)
}

function connectSendTransactionParams(params: DuskDomainsWriteContractCallParams) {
  if (!isObjectRecord(params.preparedCall)) {
    throw new Error('Prepared contract-call payload is required for dusk_sendTransaction.')
  }
  if (typeof params.preparedCall.contractId !== 'string' || params.preparedCall.contractId.toLowerCase() !== params.contract.contractId.toLowerCase()) {
    throw new Error('Prepared contract-call payload does not match the target contract.')
  }

  return {
    kind: 'contract_call',
    ...params.preparedCall,
    deposit: params.preparedCall.deposit ?? params.deposit,
    display: params.preparedCall.display ?? params.decodedContext,
    ...(params.gas ? { gas: params.gas } : {}),
  }
}

async function resolveGas(transport: DuskDomainsConnectAppTransport, gas: DuskDomainGas) {
  const limit = BigInt(gas.limit).toString()
  const price = gas.price === undefined ? await estimateGasPrice(transport) : gasPriceU64(gas.price).toString()
  return { limit, price }
}

async function estimateGasPrice(transport: DuskDomainsConnectAppTransport): Promise<string> {
  if (!transport.request && !transport.wallet) return '1'
  let timeout: ReturnType<typeof globalThis.setTimeout> | undefined
  try {
    const stats = await Promise.race([
      transport.request
        ? transport.request({ method: 'dusk_estimateGas', params: {} })
        : transport.wallet!.request('dusk_estimateGas', {}),
      new Promise<undefined>(resolve => { timeout = globalThis.setTimeout(() => resolve(undefined), GAS_PRICE_TIMEOUT_MS) }),
    ])
    const median = isObjectRecord(stats) ? stats.median : undefined
    const price = gasPriceU64(median)
    return price < 1n ? '1' : (price > DUSK_DOMAIN_MAX_AUTO_GAS_PRICE ? DUSK_DOMAIN_MAX_AUTO_GAS_PRICE : price).toString()
  } catch {
    return '1'
  } finally {
    globalThis.clearTimeout(timeout)
  }
}

function gasPriceU64(value: unknown): bigint {
  const price = typeof value === 'bigint'
    ? value
    : typeof value === 'number' && Number.isSafeInteger(value)
      ? BigInt(value)
      : typeof value === 'string' && /^\d+$/u.test(value)
        ? BigInt(value)
        : null
  if (price === null || price < 0n || price > 18_446_744_073_709_551_615n) {
    throw new Error('Gas price must be a u64 integer.')
  }
  return price
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value))
}

async function requestTransport(
  transport: DuskDomainsConnectAppTransport,
  method: string,
  params: DuskDomainsContractCallParams | DuskDomainsWriteContractCallParams | Record<string, unknown>,
) {
  if (!transport.request) {
    throw new Error('Dusk Connect transport does not expose contract-call methods or request fallback.')
  }

  return await transport.request({
    method,
    params,
  })
}
