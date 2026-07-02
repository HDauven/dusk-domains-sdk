import { namehashHex } from './namehash'
import { validateName } from './namePolicy'
import { getRecordDefinition, validateRecordValue, type ResolverRecordKey } from './records'
import type { DuskEndpoint } from './sdk'

export type ReverseRecord = {
  key: string
  endpoint: DuskEndpoint
  primaryName: string
  node: string
  updatedAt: string
}

export type ReverseRecordEvent = {
  type: 'reverse_record_set' | 'reverse_record_cleared'
  endpointType: ResolverRecordKey
  endpointValue: string
  node: string
  name: string | null
  previousName: string | null
  updatedAt: string
}

export function isPrimaryNameEndpointType(endpointType: ResolverRecordKey) {
  return getRecordDefinition(endpointType)?.eligibleForPrimaryName === true
}

export function reverseRecordKey(endpoint: DuskEndpoint) {
  assertPrimaryNameEndpoint(endpoint)
  return `${endpoint.type}:${endpoint.value}`
}

export function createReverseRecord(endpoint: DuskEndpoint, primaryName: string, updatedAt = new Date().toISOString()) {
  assertPrimaryNameEndpoint(endpoint)

  const validation = validateName(primaryName)

  if (!validation.ok) {
    throw new Error(validation.issues.map((issue) => issue.text).join(' '))
  }

  return {
    key: reverseRecordKey(endpoint),
    endpoint,
    primaryName: validation.name.canonical,
    node: namehashHex(validation.name.canonical),
    updatedAt,
  } satisfies ReverseRecord
}

export function createReverseRecordSetEvent(record: ReverseRecord, previousName: string | null): ReverseRecordEvent {
  return {
    type: 'reverse_record_set',
    endpointType: record.endpoint.type,
    endpointValue: record.endpoint.value,
    node: record.node,
    name: record.primaryName,
    previousName,
    updatedAt: record.updatedAt,
  }
}

export function createReverseRecordClearEvent(
  endpoint: DuskEndpoint,
  previousName: string | null,
  updatedAt = new Date().toISOString(),
): ReverseRecordEvent {
  assertPrimaryNameEndpoint(endpoint)

  return {
    type: 'reverse_record_cleared',
    endpointType: endpoint.type,
    endpointValue: endpoint.value,
    node: '0x',
    name: null,
    previousName,
    updatedAt,
  }
}

function assertPrimaryNameEndpoint(endpoint: DuskEndpoint) {
  const definition = getRecordDefinition(endpoint.type)

  if (!definition?.eligibleForPrimaryName) {
    throw new Error(`${endpoint.type} is not eligible for v1 primary-name display.`)
  }

  const errors = validateRecordValue(endpoint.type, endpoint.value)

  if (errors.length > 0) {
    throw new Error(errors.join(' '))
  }
}
