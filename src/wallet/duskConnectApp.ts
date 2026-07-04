import type {
  DuskConnectAppLike,
  DuskNameContractPreset,
  DuskNameDecodedContext,
} from '../contracts/calls'

export type DuskNamesContractCallParams = {
  contract: DuskNameContractPreset
  functionName: string
  args?: unknown
  deposit?: string
  decodedContext?: DuskNameDecodedContext
}

export type DuskNamesWriteContractCallParams = DuskNamesContractCallParams & {
  preparedCall?: unknown
}

export type DuskNamesConnectAppTransport = {
  readContract?: (params: DuskNamesContractCallParams) => Promise<unknown>
  prepareContractCall?: (params: DuskNamesContractCallParams) => Promise<unknown>
  writeContract?: (params: DuskNamesWriteContractCallParams) => Promise<unknown>
  request?: (request: { method: string; params?: unknown }) => Promise<unknown>
}

export type DuskNamesConnectAppOptions = {
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

export function createDuskNamesConnectApp(
  transport: DuskNamesConnectAppTransport,
  options: DuskNamesConnectAppOptions = {},
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

export const createDuskDomainsConnectApp = createDuskNamesConnectApp

function connectReadContractParams(params: DuskNamesContractCallParams) {
  const callParams = { ...params }
  delete callParams.decodedContext
  return callParams
}

function connectContractParams(params: DuskNamesContractCallParams) {
  const callParams = { ...params }
  delete callParams.decodedContext

  return {
    privacy: 'public',
    ...callParams,
    display: params.decodedContext,
  }
}

function connectWriteContractParams(params: DuskNamesWriteContractCallParams) {
  const callParams = { ...params }
  delete callParams.preparedCall
  return connectContractParams(callParams)
}

function connectSendTransactionParams(params: DuskNamesWriteContractCallParams) {
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
  transport: DuskNamesConnectAppTransport,
  method: string,
  params: DuskNamesContractCallParams | DuskNamesWriteContractCallParams | Record<string, unknown>,
) {
  if (!transport.request) {
    throw new Error('Dusk Connect transport does not expose contract-call methods or request fallback.')
  }

  return await transport.request({
    method,
    params,
  })
}
