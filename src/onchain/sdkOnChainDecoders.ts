import { bytesToHex } from '@noble/hashes/utils.js'
import type { CoreFeeConfig } from '../core/namePolicy'
import { encodeBase58, type DuskPrincipal, type DuskPrincipalKind } from '../core/principal'
import {
  getRecordDefinition,
  validateRecordValue,
  type ResolverRecordKey,
} from '../core/records'
import { failure, success } from '../client/sdkResults'
import { normalizeSdkName } from '../client/sdkValidation'
import type { DuskEndpoint, DuskDomainsResult } from '../client/sdkTypes'
import type {
  DuskDomainsOnChainNameResponse,
  DuskDomainsOnChainPendingCommitment,
  DuskDomainsOnChainPrimaryRecord,
  DuskDomainsOnChainRecord,
  DuskDomainsOnChainRecordKey,
} from './sdkOnChainTypes'

const textDecoder = new TextDecoder()

export function decodeNameResponse(
  payload: unknown,
  canonicalName: string | null,
): DuskDomainsResult<DuskDomainsOnChainNameResponse> {
  const response = objectRecord(payload)
  if (!response) return failure('contract_read_failed', 'Core get_name returned a malformed response.')

  const node = hexFromBytesField(response.node, 'node', 32)
  if (!node.ok) return node
  const marketplaceTransferable = response.marketplace_transferable === true

  if (response.record == null) {
    return success({ canonicalName, marketplaceTransferable, node: node.value, record: null })
  }

  const record = objectRecord(response.record)
  if (!record) return failure('contract_read_failed', 'Core get_name returned a malformed name record.')

  const label = stringField(record.label)
  const owner = hexFromBytesField(record.owner, 'owner', 32)
  const manager = hexFromBytesField(record.manager, 'manager', 32)
  const lifecycle = objectRecord(record.lifecycle)

  if (!label) return failure('contract_read_failed', 'Core name record label is malformed.')
  if (!owner.ok) return owner
  if (!manager.ok) return manager
  if (!lifecycle) return failure('contract_read_failed', 'Core name record lifecycle is malformed.')

  const expiresAtBlock = numberField(lifecycle.expires_at)
  const graceEndsAtBlock = numberField(lifecycle.grace_ends_at)
  if (expiresAtBlock == null || graceEndsAtBlock == null) {
    return failure('contract_read_failed', 'Core name record lifecycle heights are malformed.')
  }

  const referrer = record.referrer == null ? success<DuskPrincipal | null>(null) : decodePrincipal(record.referrer)
  if (!referrer.ok) return referrer

  return success({
    canonicalName,
    marketplaceTransferable,
    node: node.value,
    record: {
      label,
      owner: owner.value,
      manager: manager.value,
      lifecycle: {
        expiresAtBlock,
        graceEndsAtBlock,
      },
      referrer: referrer.value,
    },
  })
}

export function decodeRecordResponse(
  payload: unknown,
  expectedKey: ResolverRecordKey,
): DuskDomainsResult<DuskDomainsOnChainRecord> {
  const response = objectRecord(payload)
  if (!response) return failure('contract_read_failed', 'Core read_record returned a malformed response.')

  if (response.record == null) {
    return failure('record_missing', `${expectedKey} is not set for this domain.`)
  }

  const record = objectRecord(response.record)
  if (!record) return failure('contract_read_failed', 'Core read_record returned a malformed record.')

  const key = stringField(record.key) as ResolverRecordKey | null
  if (!key || key !== expectedKey) {
    return failure('invalid_record', `Core read_record returned unexpected record key: ${String(key)}.`)
  }

  const definition = getRecordDefinition(key)
  if (!definition) return failure('invalid_record', `Unsupported resolver record key: ${key}`)

  const value = valueFromRecordBytes(key, record.value)
  if (value == null) return failure('invalid_record', `${key} value is malformed.`)

  const ttlSeconds = numberField(record.ttl_seconds)
  const updatedAtBlock = numberField(record.updated_at)
  if (ttlSeconds == null || updatedAtBlock == null) {
    return failure('invalid_record', `${key} metadata is malformed.`)
  }

  const errors = validateRecordValue(key, value)
  if (errors.length > 0) return failure('invalid_record', errors.join(' '))

  return success({
    key,
    value,
    visibility: definition.visibility,
    ttlSeconds,
    updatedAtBlock,
  })
}

export function decodePrimaryNameResponse(payload: unknown): DuskDomainsResult<DuskDomainsOnChainPrimaryRecord | null> {
  const response = objectRecord(payload)
  if (!response) return failure('contract_read_failed', 'Core read_primary_name returned a malformed response.')

  const endpoint = decodeEndpoint(response.endpoint)
  if (!endpoint.ok) return endpoint

  if (response.record == null) return success(null)

  const record = objectRecord(response.record)
  if (!record) return failure('contract_read_failed', 'Core read_primary_name returned a malformed record.')

  const node = hexFromBytesField(record.node, 'node', 32)
  const name = stringField(record.name)
  const updatedAtBlock = numberField(record.updated_at)
  if (!node.ok) return node
  if (!name) return failure('contract_read_failed', 'Primary name record name is malformed.')
  if (updatedAtBlock == null) return failure('contract_read_failed', 'Primary name updated_at is malformed.')

  const normalized = normalizeSdkName(name)
  if (!normalized.ok) return normalized

  return success({
    endpoint: endpoint.value,
    node: node.value,
    name: normalized.value,
    updatedAtBlock,
  })
}

export function decodePendingCommitmentResponse(payload: unknown): DuskDomainsResult<DuskDomainsOnChainPendingCommitment> {
  const response = objectRecord(payload)
  if (!response) return failure('contract_read_failed', 'Core pending_commitment returned a malformed response.')

  const commitment = hexFromBytesField(response.commitment, 'commitment', 32)
  if (!commitment.ok) return commitment

  if (response.pending == null) return success({ commitment: commitment.value, pending: null })

  const pending = objectRecord(response.pending)
  if (!pending) return failure('contract_read_failed', 'Core pending commitment payload is malformed.')

  const controller = hexFromBytesField(pending.controller, 'controller', 32)
  const createdAtBlock = numberField(pending.created_at)
  if (!controller.ok) return controller
  if (createdAtBlock == null) return failure('contract_read_failed', 'Pending commitment created_at is malformed.')

  return success({
    commitment: commitment.value,
    pending: {
      controller: controller.value,
      createdAtBlock,
    },
  })
}

export function decodeFeeConfig(payload: unknown): DuskDomainsResult<CoreFeeConfig> {
  const config = objectRecord(payload)
  if (!config) return failure('contract_read_failed', 'Core fee_config returned a malformed response.')

  const fields = {
    threeCharYearLux: numberField(config.three_char_year_lux),
    fourCharYearLux: numberField(config.four_char_year_lux),
    fivePlusYearLux: numberField(config.five_plus_year_lux),
    referralRewardBps: numberField(config.referral_reward_bps),
    renewalReferralRewardBps: numberField(config.renewal_referral_reward_bps),
    premiumReferralRewardBps: numberField(config.premium_referral_reward_bps),
    version: numberField(config.version),
    updatedAt: numberField(config.updated_at),
  }

  if (Object.values(fields).some((value) => value == null)) {
    return failure('contract_read_failed', 'Core fee_config contains malformed numeric fields.')
  }

  return success(fields as CoreFeeConfig)
}

export function validateEndpoint(endpoint: DuskEndpoint, requirePrimaryEligible: boolean): DuskDomainsResult<DuskEndpoint> {
  const definition = getRecordDefinition(endpoint.type)
  if (!definition) return failure('invalid_record', `Unsupported resolver record key: ${endpoint.type}`)
  if (requirePrimaryEligible && !definition.eligibleForPrimaryName) {
    return failure('not_primary_eligible', `${endpoint.type} is not eligible for v1 primary-name display.`)
  }
  const errors = validateRecordValue(endpoint.type, endpoint.value)
  if (errors.length > 0) return failure('invalid_record', errors.join(' '))
  return success(endpoint)
}

export function canonicalOnChainRecordKey(key: DuskDomainsOnChainRecordKey): DuskDomainsResult<ResolverRecordKey> {
  if (key === 'dusk_public_address') return success('moonlight_address')
  if (key === 'dusk_shielded_address') return success('phoenix_payment_endpoint')
  if (!getRecordDefinition(key)) return failure('invalid_record', `Unsupported resolver record key: ${key}`)
  return success(key)
}

export function normalizeBytes32Hex(value: string, label: string): DuskDomainsResult<string> {
  const normalized = value.trim().toLowerCase()
  if (!/^0x[a-f0-9]{64}$/.test(normalized)) {
    return failure('invalid_node', `${label} must be a 32-byte hex string.`)
  }
  return success(normalized)
}

export function unwrapReadOutput(value: unknown): unknown {
  const object = objectRecord(value)
  if (object && 'output' in object && typeof object.fnName === 'string') return object.output
  return value
}

function decodeEndpoint(payload: unknown): DuskDomainsResult<DuskEndpoint> {
  const endpoint = objectRecord(payload)
  if (!endpoint) return failure('contract_read_failed', 'Endpoint payload is malformed.')

  const kind = variantName(endpoint.kind)
  const type = endpointKindToRecordKey(kind)
  if (!type) return failure('invalid_record', `Unsupported endpoint kind: ${kind}`)

  const value = valueFromRecordBytes(type, endpoint.value)
  if (value == null) return failure('invalid_record', `${type} endpoint value is malformed.`)

  const validation = validateEndpoint({ type, value }, false)
  if (!validation.ok) return validation
  return success(validation.value)
}

function decodePrincipal(payload: unknown): DuskDomainsResult<DuskPrincipal> {
  const principal = objectRecord(payload)
  if (!principal) return failure('contract_read_failed', 'Principal payload is malformed.')

  const kind = variantName(principal.kind) as DuskPrincipalKind | null
  if (!kind || !['Moonlight', 'Phoenix', 'Contract'].includes(kind)) {
    return failure('contract_read_failed', `Principal kind is malformed: ${String(kind)}.`)
  }

  const bytes = bytesField(principal.bytes)
  if (!bytes) return failure('contract_read_failed', 'Principal bytes are malformed.')

  return success({
    kind,
    bytes: Array.from(bytes),
  })
}

function endpointKindToRecordKey(kind: string | null): ResolverRecordKey | null {
  if (kind === 'MoonlightAddress') return 'moonlight_address'
  if (kind === 'PhoenixPaymentEndpoint') return 'phoenix_payment_endpoint'
  if (kind === 'DuskContract') return 'dusk_contract'
  if (kind === 'DuskAsset') return 'dusk_asset'
  if (kind === 'EvmAddress') return 'evm_address'
  return null
}

function hexFromBytesField(value: unknown, label: string, expectedLength: number): DuskDomainsResult<string> {
  if (typeof value === 'string' && /^0x[a-fA-F0-9]+$/.test(value)) {
    const normalized = value.toLowerCase()
    if (normalized.length !== 2 + expectedLength * 2) {
      return failure('contract_read_failed', `${label} must be ${expectedLength} bytes.`)
    }
    return success(normalized)
  }

  const bytes = bytesField(value)
  if (!bytes || bytes.length !== expectedLength) {
    return failure('contract_read_failed', `${label} must be ${expectedLength} bytes.`)
  }
  return success(`0x${bytesToHex(bytes)}`)
}

function valueFromRecordBytes(key: ResolverRecordKey, value: unknown): string | null {
  if (typeof value === 'string') return value
  const bytes = bytesField(value)
  if (!bytes) return null
  if (key === 'moonlight_address') return encodeBase58(bytes)
  return textDecoder.decode(bytes)
}

function bytesField(value: unknown): Uint8Array | null {
  if (value instanceof Uint8Array) return value
  if (!Array.isArray(value)) return null
  if (!value.every((byte) => Number.isInteger(byte) && byte >= 0 && byte <= 255)) return null
  return Uint8Array.from(value)
}

function objectRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

function stringField(value: unknown): string | null {
  return typeof value === 'string' ? value : null
}

function numberField(value: unknown): number | null {
  if (typeof value === 'number' && Number.isSafeInteger(value) && value >= 0) return value
  if (typeof value === 'bigint' && value <= BigInt(Number.MAX_SAFE_INTEGER) && value >= 0n) return Number(value)
  return null
}

function variantName(value: unknown): string | null {
  if (typeof value === 'string') return value
  const object = objectRecord(value)
  if (!object) return null
  const keys = Object.keys(object)
  return keys.length === 1 ? keys[0] : null
}
