import {
  createResolverRecord,
  getRecordDefinition,
  validateRecordValue,
  type ResolverRecord,
  type ResolverRecordKey,
} from '../core/records'
import type { ForwardResolutionResponse } from '../indexer/indexer'
import { failure, success } from './sdkResults'
import {
  normalizeSdkName,
  validateRecordMutations,
} from './sdkValidation'
import type {
  DuskEndpoint,
  DuskDomainsReadWriteClient,
  DuskDomainsReadWriteClientOptions,
  DuskDomainsRecordMutationInput,
  DuskDomainsResult,
  DuskDomainsTxIntent,
  EndpointDisplayName,
  PrimaryNameVerification,
  ResolvedName,
} from './sdkTypes'

export type {
  DuskEndpoint,
  DuskDomainsError,
  DuskDomainsErrorCode,
  DuskDomainsReadWriteClient,
  DuskDomainsReadWriteClientOptions,
  DuskDomainsReadTransport,
  DuskDomainsRecordMutation,
  DuskDomainsRecordMutationInput,
  DuskDomainsResult,
  DuskDomainsTxIntent,
  DuskDomainsWriteTransport,
  EndpointDisplayName,
  PrimaryNameVerification,
  ResolvedName,
} from './sdkTypes'

export function createDuskDomainsReadWriteClient(
  options: DuskDomainsReadWriteClientOptions,
): DuskDomainsReadWriteClient {
  async function getRecords(name: string): Promise<DuskDomainsResult<ResolverRecord[]>> {
    const normalized = normalizeSdkName(name)

    if (!normalized.ok) {
      return normalized
    }

    const forward = await getForwardResolution(normalized.value)

    if (!forward.ok) {
      return forward
    }

    return success(forward.value.records)
  }

  async function resolveName(
    name: string,
    endpointType: ResolverRecordKey = 'moonlight_address',
  ): Promise<DuskDomainsResult<ResolvedName>> {
    const normalized = normalizeSdkName(name)

    if (!normalized.ok) {
      return normalized
    }

    const canonicalName = normalized.value
    const forward = await getForwardResolution(canonicalName)

    if (!forward.ok) return forward

    const records = forward.value.records
    const record = records.find((candidate) => candidate.key === endpointType)

    if (!record) {
      return failure('record_missing', `${canonicalName} does not define ${endpointType}.`)
    }

    return success({
      canonicalName,
      endpoint: {
        type: endpointType,
        value: record.value,
      },
      record,
      forward: forward.value,
    })
  }

  async function resolveEndpoint(endpoint: DuskEndpoint): Promise<DuskDomainsResult<string>> {
    const primaryName = await options.read.getPrimaryName(endpoint)

    if (!primaryName) {
      return failure('reverse_missing', `${endpoint.type} does not define a primary .dusk domain.`)
    }

    return success(primaryName)
  }

  async function getPrimaryName(endpoint: DuskEndpoint): Promise<DuskDomainsResult<string>> {
    return resolveEndpoint(endpoint)
  }

  async function verifyPrimaryName(
    endpoint: DuskEndpoint,
    expectedName?: string,
  ): Promise<DuskDomainsResult<PrimaryNameVerification>> {
    const definition = getRecordDefinition(endpoint.type)

    if (!definition?.eligibleForPrimaryName) {
      return failure('not_primary_eligible', `${endpoint.type} is not eligible for v1 primary-name display.`)
    }

    const reverseName = await options.read.getPrimaryName(endpoint)
    const expectedNameResult = expectedName ? normalizeSdkName(expectedName) : success(reverseName)

    if (!expectedNameResult.ok) {
      return expectedNameResult
    }

    if (!reverseName) {
      return failure('reverse_missing', `${endpoint.type} does not define a primary .dusk domain.`)
    }

    if (expectedNameResult.value && reverseName !== expectedNameResult.value) {
      return failure(
        'forward_reverse_mismatch',
        `${endpoint.type} reverse-resolves to ${reverseName}, not ${expectedNameResult.value}.`,
      )
    }

    const forward = await resolveName(reverseName, endpoint.type)

    if (!forward.ok) return forward

    if (forward.value.endpoint.value !== endpoint.value) {
      return failure(
        'forward_reverse_mismatch',
        `${reverseName} does not forward-resolve to the requested ${endpoint.type}.`,
      )
    }

    return success({
      endpoint,
      primaryName: reverseName,
      forwardRecord: forward.value.record,
      verified: true,
    })
  }

  async function setRecord(
    name: string,
    key: ResolverRecordKey,
    value: string,
  ): Promise<DuskDomainsResult<DuskDomainsTxIntent>> {
    if (!options.write) {
      return failure('write_transport_missing', 'No Dusk Domains write transport is configured.')
    }

    const normalized = normalizeSdkName(name)

    if (!normalized.ok) {
      return normalized
    }

    const errors = validateRecordValue(key, value)

    if (errors.length > 0) {
      return failure('invalid_record', errors.join(' '))
    }

    return success(await options.write.setRecord(normalized.value, createResolverRecord(key, value)))
  }

  async function clearRecord(name: string, key: ResolverRecordKey): Promise<DuskDomainsResult<DuskDomainsTxIntent>> {
    if (!options.write?.clearRecord) {
      return failure('write_transport_missing', 'No Dusk Domains clear-record transport is configured.')
    }

    const normalized = normalizeSdkName(name)

    if (!normalized.ok) {
      return normalized
    }

    if (!getRecordDefinition(key)) {
      return failure('invalid_record', `Unsupported resolver record key: ${key}`)
    }

    return success(await options.write.clearRecord(normalized.value, key))
  }

  async function mutateRecords(
    name: string,
    mutations: DuskDomainsRecordMutationInput[],
  ): Promise<DuskDomainsResult<DuskDomainsTxIntent>> {
    if (!options.write?.mutateRecords) {
      return failure('write_transport_missing', 'No Dusk Domains batch-record transport is configured.')
    }

    const normalized = normalizeSdkName(name)

    if (!normalized.ok) {
      return normalized
    }

    const normalizedMutations = validateRecordMutations(mutations)

    if (!normalizedMutations.ok) {
      return normalizedMutations
    }

    return success(await options.write.mutateRecords(normalized.value, normalizedMutations.value))
  }

  async function setPrimaryName(
    endpoint: DuskEndpoint,
    name: string,
  ): Promise<DuskDomainsResult<DuskDomainsTxIntent>> {
    if (!options.write) {
      return failure('write_transport_missing', 'No Dusk Domains write transport is configured.')
    }

    const normalized = normalizeSdkName(name)

    if (!normalized.ok) {
      return normalized
    }

    const definition = getRecordDefinition(endpoint.type)

    if (!definition?.eligibleForPrimaryName) {
      return failure('not_primary_eligible', `${endpoint.type} is not eligible for v1 primary-name display.`)
    }

    return success(await options.write.setPrimaryName(endpoint, normalized.value))
  }

  async function getDisplayName(endpoint: DuskEndpoint): Promise<EndpointDisplayName> {
    const verification = await verifyPrimaryName(endpoint)

    if (!verification.ok) {
      return {
        endpoint,
        display: endpoint.value,
        raw: endpoint.value,
        verified: false,
        reason: verification.error,
      }
    }

    return {
      endpoint,
      display: verification.value.primaryName,
      raw: endpoint.value,
      verified: true,
      reason: null,
    }
  }

  async function getForwardResolution(canonicalName: string): Promise<DuskDomainsResult<ForwardResolutionResponse>> {
    if (options.read.resolveForward) {
      const response = await options.read.resolveForward(canonicalName)
      const blockingError = response.errors.find((error) => error.code !== 'invalid_record') ?? response.errors[0]

      if (blockingError) {
        return failure(blockingError.code, blockingError.message)
      }

      return success(response)
    }

    if (!options.read.getRecords) {
      return failure('missing_resolver', 'No Dusk Domains read transport is configured for resolver records.')
    }

    const now = new Date().toISOString()

    return success({
      canonicalName,
      node: '0x',
      records: await options.read.getRecords(canonicalName),
      resolver: {
        resolverId: null,
        health: 'missing',
      },
      expiry: {
        status: 'active',
        expiresAt: null,
      },
      cache: {
        asOf: now,
        ttlSeconds: 0,
        staleAt: now,
      },
      warnings: [],
      verificationStatus: 'unverified',
      errors: [],
    })
  }

  return {
    resolveName,
    resolveEndpoint,
    resolveAddress: resolveEndpoint,
    getRecords,
    getPrimaryName,
    verifyPrimaryName,
    getDisplayName,
    setRecord,
    clearRecord,
    mutateRecords,
    setPrimaryName,
  }
}
