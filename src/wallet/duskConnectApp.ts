import type {
  DuskConnectAppLike,
  DuskDomainContractPreset,
  DuskDomainDecodedContext,
} from '../contracts/calls'

export type DuskDomainsContractCallParams = {
  contract: DuskDomainContractPreset
  functionName: string
  args?: unknown
  deposit?: string
  decodedContext?: DuskDomainDecodedContext
}

export type DuskDomainsWriteContractCallParams = DuskDomainsContractCallParams & {
  preparedCall?: unknown
}

export type DuskDomainsConnectAppTransport = {
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

export function createDuskDomainsConnectApp(
  transport: DuskDomainsConnectAppTransport,
  options: DuskDomainsConnectAppOptions = {},
): DuskConnectAppLike {
  const requestMethods = {
    ...defaultRequestMethods,
    ...options.requestMethods,
  }

  return {
    async readContract(params) {
      if (transport.readContract) return await transport.readContract(connectReadContractParams(params))
      return await requestTransport(transport, requestMethods.readContract, connectReadContractParams(params))
    },
    async prepareContractCall(params) {
      if (transport.prepareContractCall) return await transport.prepareContractCall(connectContractParams(params))
      return await requestTransport(transport, requestMethods.prepareContractCall, connectContractParams(params))
    },
    async writeContract(params) {
      if (transport.writeContract) return await transport.writeContract(connectWriteContractParams(params))
      const requestParams = requestMethods.writeContract === defaultRequestMethods.writeContract
        ? connectSendTransactionParams(params)
        : connectContractParams(params)
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

  return {
    kind: 'contract_call',
    ...params.preparedCall,
    deposit: params.preparedCall.deposit ?? params.deposit,
    display: params.preparedCall.display ?? params.decodedContext,
  }
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
