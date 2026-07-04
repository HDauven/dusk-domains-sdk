import {
  coreFeeConfigCall,
  coreGetNameCall,
  corePendingCommitmentCall,
  coreReadPrimaryNameCall,
  coreReadRecordCall,
  readDuskNameContract,
  type DuskConnectAppLike,
  type DuskNameCallMetadata,
  type DuskNameContractMap,
} from '../contracts/calls'
import { DUSK_NAME_CONTRACTS } from '../contracts/callContracts'
import { namehash } from '../core/namehash'
import { STATIC_RECORD_DEFINITIONS, type ResolverRecordKey } from '../core/records'
import { failure, success } from '../client/sdkResults'
import {
  canonicalOnChainRecordKey,
  decodeFeeConfig,
  decodeNameResponse,
  decodePendingCommitmentResponse,
  decodePrimaryNameResponse,
  decodeRecordResponse,
  normalizeBytes32Hex,
  unwrapReadOutput,
  validateEndpoint,
} from './sdkOnChainDecoders'
import type {
  DuskNamesOnChainClient,
  DuskNamesOnChainClientOptions,
  DuskNamesOnChainNameResponse,
  DuskNamesOnChainPendingCommitment,
  DuskNamesOnChainPrimaryRecord,
  DuskNamesOnChainPrimaryNameVerification,
  DuskNamesOnChainReadTransport,
  DuskNamesOnChainRecord,
  DuskNamesOnChainRecordKey,
  DuskNamesOnChainResolvedName,
} from './sdkOnChainTypes'
import { normalizeSdkName } from '../client/sdkValidation'
import type { CoreFeeConfig } from '../core/namePolicy'
import type { DuskEndpoint, DuskNamesResult } from '../client/sdkTypes'

export type {
  DuskNamesOnChainClient,
  DuskNamesOnChainClientOptions,
  DuskNamesOnChainLifecycle,
  DuskNamesOnChainNameRecord,
  DuskNamesOnChainNameResponse,
  DuskNamesOnChainPendingCommitment,
  DuskNamesOnChainPrimaryRecord,
  DuskNamesOnChainPrimaryNameVerification,
  DuskNamesOnChainReadTransport,
  DuskNamesOnChainRecord,
  DuskNamesOnChainRecordKey,
  DuskNamesOnChainResolvedName,
  DuskNamesRecordKeyAlias,
} from './sdkOnChainTypes'

const defaultOnChainRecordKeys = STATIC_RECORD_DEFINITIONS.map((definition) => definition.key)

function safeBlockHeight(value: number): DuskNamesResult<number> {
  if (!Number.isSafeInteger(value) || value < 0) {
    return failure('lifecycle_unavailable', 'Current block height is malformed.')
  }
  return success(value)
}

export function createDuskNamesOnChainReadTransport(
  app: DuskConnectAppLike,
  contracts: DuskNameContractMap = DUSK_NAME_CONTRACTS,
): DuskNamesOnChainReadTransport {
  return {
    async read(call) {
      return await readDuskNameContract(app, call, contracts)
    },
  }
}

export function createDuskNamesOnChainClient(
  options: DuskNamesOnChainClientOptions,
): DuskNamesOnChainClient {
  const defaultRecordKeys = options.defaultRecordKeys ?? defaultOnChainRecordKeys

  async function readCall<T>(call: DuskNameCallMetadata): Promise<DuskNamesResult<T>> {
    try {
      return success(unwrapReadOutput(await options.read.read(call)) as T)
    } catch (error) {
      return failure('contract_read_failed', error instanceof Error ? error.message : String(error))
    }
  }

  async function currentBlockHeight(): Promise<DuskNamesResult<number>> {
    const source = options.currentBlockHeight
    if (typeof source === 'number') {
      return safeBlockHeight(source)
    }
    if (!source) {
      return failure(
        'lifecycle_unavailable',
        'Current block height is required for direct on-chain routing reads.',
      )
    }

    try {
      const value = await source()
      if (value == null) {
        return failure(
          'lifecycle_unavailable',
          'Current block height is required for direct on-chain routing reads.',
        )
      }
      return safeBlockHeight(value)
    } catch (error) {
      return failure(
        'lifecycle_unavailable',
        error instanceof Error ? error.message : String(error),
      )
    }
  }

  async function assertActiveRoutingName(
    response: DuskNamesOnChainNameResponse,
    displayName: string,
  ): Promise<DuskNamesResult<null>> {
    if (!response.record) {
      return failure('missing_name', `${displayName} is not registered.`)
    }

    const height = await currentBlockHeight()
    if (!height.ok) return height
    if (height.value >= response.record.lifecycle.expiresAtBlock) {
      return failure('expired_name', `${displayName} is expired.`)
    }

    return success(null)
  }

  async function getName(name: string) {
    const normalized = normalizeSdkName(name)
    if (!normalized.ok) return normalized

    const hashed = namehash(normalized.value)
    const response = await getNameByNode(hashed.hex)
    if (!response.ok) return response

    return success({
      ...response.value,
      canonicalName: hashed.canonicalName,
    })
  }

  async function getNameByNode(node: string) {
    const normalizedNode = normalizeBytes32Hex(node, 'node')
    if (!normalizedNode.ok) return normalizedNode

    const response = await readCall<unknown>(coreGetNameCall({ node: normalizedNode.value }))
    if (!response.ok) return response

    return decodeNameResponse(response.value, null)
  }

  async function getNameOwner(name: string): Promise<DuskNamesResult<string>> {
    const response = await getName(name)
    if (!response.ok) return response
    if (!response.value.record) {
      return failure('missing_name', `${response.value.canonicalName ?? name} is not registered.`)
    }
    return success(response.value.record.owner)
  }

  async function getRecords(
    name: string,
    keys: DuskNamesOnChainRecordKey[] = defaultRecordKeys,
  ): Promise<DuskNamesResult<DuskNamesOnChainRecord[]>> {
    const normalized = normalizeSdkName(name)
    if (!normalized.ok) return normalized

    const hashed = namehash(normalized.value)
    const nameResponse = await getNameByNode(hashed.hex)
    if (!nameResponse.ok) return nameResponse
    const active = await assertActiveRoutingName(nameResponse.value, hashed.canonicalName)
    if (!active.ok) return active

    const records: DuskNamesOnChainRecord[] = []
    for (const requestedKey of keys) {
      const key = canonicalOnChainRecordKey(requestedKey)
      if (!key.ok) return key

      const record = await readRecordByNode(hashed.hex, key.value)
      if (!record.ok) {
        if (record.error.code === 'record_missing') continue
        return record
      }
      records.push(record.value)
    }
    return success(records)
  }

  async function getRecord(
    name: string,
    requestedKey: DuskNamesOnChainRecordKey,
  ): Promise<DuskNamesResult<DuskNamesOnChainRecord>> {
    const normalized = normalizeSdkName(name)
    if (!normalized.ok) return normalized

    const key = canonicalOnChainRecordKey(requestedKey)
    if (!key.ok) return key

    const hashed = namehash(normalized.value)
    const nameResponse = await getNameByNode(hashed.hex)
    if (!nameResponse.ok) return nameResponse
    const active = await assertActiveRoutingName(nameResponse.value, hashed.canonicalName)
    if (!active.ok) return active

    return await readRecordByNode(hashed.hex, key.value)
  }

  async function resolveName(
    name: string,
    requestedKey: DuskNamesOnChainRecordKey = 'moonlight_address',
  ): Promise<DuskNamesResult<DuskNamesOnChainResolvedName>> {
    const normalized = normalizeSdkName(name)
    if (!normalized.ok) return normalized

    const key = canonicalOnChainRecordKey(requestedKey)
    if (!key.ok) return key

    const record = await getRecord(normalized.value, key.value)
    if (!record.ok) return record

    return success({
      canonicalName: normalized.value,
      node: namehash(normalized.value).hex,
      endpoint: {
        type: key.value,
        value: record.value.value,
      },
      record: record.value,
    })
  }

  async function getPrimaryName(endpoint: DuskEndpoint): Promise<DuskNamesResult<string>> {
    const primary = await readPrimaryName(endpoint)
    if (!primary.ok) return primary
    if (!primary.value) {
      return failure('reverse_missing', `${endpoint.type} does not define a primary .dusk domain.`)
    }
    const nameResponse = await getNameByNode(primary.value.node)
    if (!nameResponse.ok) return nameResponse
    const active = await assertActiveRoutingName(nameResponse.value, primary.value.name)
    if (!active.ok) return active
    return success(primary.value.name)
  }

  async function verifyPrimaryName(
    endpoint: DuskEndpoint,
    expectedName?: string,
  ): Promise<DuskNamesResult<DuskNamesOnChainPrimaryNameVerification>> {
    const endpointValidation = validateEndpoint(endpoint, true)
    if (!endpointValidation.ok) return endpointValidation

    const primary = await readPrimaryName(endpoint)
    if (!primary.ok) return primary
    if (!primary.value) {
      return failure('reverse_missing', `${endpoint.type} does not define a primary .dusk domain.`)
    }

    const canonicalPrimaryNode = namehash(primary.value.name).hex
    if (canonicalPrimaryNode !== primary.value.node) {
      return failure(
        'forward_reverse_mismatch',
        `${primary.value.name} reverse record does not match its canonical node.`,
      )
    }

    const expected = expectedName ? normalizeSdkName(expectedName) : success(primary.value.name)
    if (!expected.ok) return expected

    if (primary.value.name !== expected.value) {
      return failure(
        'forward_reverse_mismatch',
        `${endpoint.type} reverse-resolves to ${primary.value.name}, not ${expected.value}.`,
      )
    }

    const nameResponse = await getNameByNode(primary.value.node)
    if (!nameResponse.ok) return nameResponse
    const active = await assertActiveRoutingName(nameResponse.value, primary.value.name)
    if (!active.ok) return active

    const forward = await readRecordByNode(primary.value.node, endpoint.type)
    if (!forward.ok) return forward

    if (forward.value.value !== endpoint.value) {
      return failure(
        'forward_reverse_mismatch',
        `${primary.value.name} does not forward-resolve to the requested ${endpoint.type}.`,
      )
    }

    return success({
      endpoint,
      primaryName: primary.value.name,
      node: primary.value.node,
      forwardRecord: forward.value,
      verified: true,
    })
  }

  async function getPendingCommitment(
    commitment: string,
  ): Promise<DuskNamesResult<DuskNamesOnChainPendingCommitment>> {
    const normalizedCommitment = normalizeBytes32Hex(commitment, 'commitment')
    if (!normalizedCommitment.ok) return normalizedCommitment

    const response = await readCall<unknown>(corePendingCommitmentCall({ commitment: normalizedCommitment.value }))
    if (!response.ok) return response

    return decodePendingCommitmentResponse(response.value)
  }

  async function getFeeConfig(): Promise<DuskNamesResult<CoreFeeConfig>> {
    const response = await readCall<unknown>(coreFeeConfigCall())
    if (!response.ok) return response
    return decodeFeeConfig(response.value)
  }

  async function readRecordByNode(
    node: string,
    key: ResolverRecordKey,
  ): Promise<DuskNamesResult<DuskNamesOnChainRecord>> {
    const response = await readCall<unknown>(coreReadRecordCall({ node, key }))
    if (!response.ok) return response
    return decodeRecordResponse(response.value, key)
  }

  async function readPrimaryName(
    endpoint: DuskEndpoint,
  ): Promise<DuskNamesResult<DuskNamesOnChainPrimaryRecord | null>> {
    const endpointValidation = validateEndpoint(endpoint, true)
    if (!endpointValidation.ok) return endpointValidation

    const response = await readCall<unknown>(coreReadPrimaryNameCall({
      endpointType: endpoint.type,
      endpointValue: endpoint.value,
    }))
    if (!response.ok) return response

    return decodePrimaryNameResponse(response.value)
  }

  return {
    getName,
    getNameByNode,
    getNameOwner,
    getRecords,
    getRecord,
    resolveName,
    getPrimaryName,
    verifyPrimaryName,
    getPendingCommitment,
    getFeeConfig,
  }
}
