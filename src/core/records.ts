/** Frozen record bounds plus optional conventions for familiar resolver keys. @module */
import {
  checksumEthereumAddress,
  normalizeBitcoinAddress,
  validateBitcoinAddress,
  validateEthereumAddress,
  validateSolanaAddress,
} from '../chain-addresses.ts'
import { contractId, fromHex } from '../frozen/bytes.ts'
import { u64 } from '../frozen/json.ts'
import { wireValue } from '../frozen/wire.ts'
import type {
  RecordInput,
  RecordValue,
  RecordMutation,
} from '../frozen/types.ts'
import { decodeBase58, isMoonlightEndpoint } from './principal.ts'
export const MAX_RECORDS_PER_NAME = 16
export const MAX_RECORD_MUTATIONS_PER_BATCH = 8
export const MAX_RECORD_BATCH_PAYLOAD_BYTES = 4096
export const MAX_RECORD_SET_PAYLOAD_BYTES = 9216
export const MAX_RECORD_KEY_BYTES = 64
export const MAX_RECORD_VALUE_BYTES = 512
export const MAX_RECORD_TTL_SECONDS = 86400n
export type StaticRecordKey =
  | 'moonlight_address'
  | 'phoenix_payment_endpoint'
  | 'dusk_contract'
  | 'dusk_asset'
  | 'evm_address'
  | 'address.btc'
  | 'address.eth'
  | 'address.sol'
  | 'address.evm'
  | 'website'
  | 'avatar'
  | 'content_pointer'
  | 'attestation_ref'
  | 'compliance_ref'
export type ResolverRecordKey = string
export type ResolverRecord = RecordValue
export type RecordIssue =
  | 'key_bytes'
  | 'value_bytes'
  | 'ttl'
  | 'invalid_address'
  | 'invalid_url'
  | 'invalid_reference'
  | 'invalid_text'
  | 'invalid_identifier'
export interface RecordDefinition {
  key: string
  maxBytes: number
  defaultTtlSeconds: bigint
  encoding: 'utf8' | 'moonlight' | 'contract'
  eligibleForPrimaryName: boolean
}
const keys: readonly StaticRecordKey[] = [
  'moonlight_address',
  'phoenix_payment_endpoint',
  'dusk_contract',
  'dusk_asset',
  'evm_address',
  'address.btc',
  'address.eth',
  'address.sol',
  'address.evm',
  'website',
  'avatar',
  'content_pointer',
  'attestation_ref',
  'compliance_ref',
]
const utf8 = new TextEncoder()
function definition(key: string): RecordDefinition {
  return {
    key,
    maxBytes: MAX_RECORD_VALUE_BYTES,
    defaultTtlSeconds:
      key.startsWith('address.') ||
      [
        'moonlight_address',
        'phoenix_payment_endpoint',
        'dusk_contract',
        'dusk_asset',
        'evm_address',
      ].includes(key)
        ? 300n
        : 3600n,
    encoding:
      key === 'moonlight_address'
        ? 'moonlight'
        : key === 'dusk_contract'
          ? 'contract'
          : 'utf8',
    eligibleForPrimaryName: key === 'moonlight_address',
  }
}
export const STATIC_RECORD_DEFINITIONS: readonly RecordDefinition[] =
  Object.freeze(keys.map((k) => Object.freeze(definition(k))))
/** Custom keys are accepted by the resolver. They receive the raw UTF-8 convention. */
export function getRecordDefinition(key: string): RecordDefinition | undefined {
  return validKey(key) ? definition(key) : undefined
}
function validKey(key: string): boolean {
  const length = utf8.encode(key).length
  return (
    new TextDecoder().decode(utf8.encode(key)) === key &&
    length >= 1 &&
    length <= MAX_RECORD_KEY_BYTES
  )
}
function https(value: string): boolean {
  if (/\s/u.test(value)) return false
  try {
    const u = new URL(value)
    return u.protocol === 'https:' && !!u.hostname && !u.username && !u.password
  } catch {
    return false
  }
}
function content(value: string): boolean {
  return https(value) || /^(?:ipfs|ar):\/\/[^\s]+$/u.test(value)
}
function encodeValue(key: string, value: string): number[] {
  if (key === 'moonlight_address') {
    const bytes = decodeBase58(value)
    if (!bytes || !isMoonlightEndpoint(bytes))
      throw new Error('invalid_address')
    return Array.from(bytes)
  }
  if (key === 'dusk_contract') return fromHex(contractId(value), 32)
  const normalized =
    key === 'address.btc'
      ? normalizeBitcoinAddress(value)
      : key === 'address.eth' || key === 'address.evm'
        ? checksumEthereumAddress(value)
        : value
  return Array.from(utf8.encode(normalized))
}
/** Convention validation; raw contract validation is validateRecordInput. Returns codes, never UI copy. */
export function validateRecordValue(key: string, value: string): RecordIssue[] {
  const issues: RecordIssue[] = []
  if (!validKey(key)) issues.push('key_bytes')
  let bytes: number[] = []
  try {
    bytes = encodeValue(key, value)
  } catch {
    issues.push('invalid_address')
  }
  if (
    (!bytes.length || bytes.length > 512) &&
    !issues.includes('invalid_address')
  )
    issues.push('value_bytes')
  const invalid = (code: RecordIssue): void => {
    if (!issues.includes(code)) issues.push(code)
  }
  if (new TextDecoder().decode(utf8.encode(value)) !== value)
    invalid('invalid_text')
  if (key === 'address.btc' && validateBitcoinAddress(value).length)
    invalid('invalid_address')
  if (
    (key === 'address.eth' || key === 'address.evm') &&
    validateEthereumAddress(value).length
  )
    invalid('invalid_address')
  if (key === 'address.sol' && validateSolanaAddress(value).length)
    invalid('invalid_address')
  if (key === 'evm_address' && !/^0x[a-fA-F0-9]{40}$/u.test(value))
    invalid('invalid_address')
  if (
    key === 'phoenix_payment_endpoint' &&
    !/^[A-Za-z0-9:_-]{32,256}$/u.test(value)
  )
    invalid('invalid_address')
  if (key === 'dusk_asset' && !/^[A-Za-z0-9:._-]{3,128}$/u.test(value))
    invalid('invalid_identifier')
  if (
    (key === 'website' || key.startsWith('service_endpoint.')) &&
    !https(value)
  )
    invalid('invalid_url')
  if (key === 'avatar' && !content(value)) invalid('invalid_url')
  if (
    key === 'content_pointer' &&
    !content(value) &&
    !/^bafy[a-zA-Z0-9]+$/u.test(value)
  )
    invalid('invalid_reference')
  if (
    ['attestation_ref', 'compliance_ref'].includes(key) &&
    !(https(value) || /^(?:urn:|dusk:)[^\s]{3,}$/u.test(value))
  )
    invalid('invalid_reference')
  if (
    key.startsWith('text.') &&
    (!value.trim() || /[\u0000-\u001f\u007f]/u.test(value))
  )
    invalid('invalid_text')
  return issues
}
/** Raw validation mirrors store validation.rs and resolver state.rs, including arbitrary keys/bytes. */
export function validateRecordInput(input: RecordInput): RecordInput {
  const record = wireValue('RecordInput', input)
  if (!validKey(record.key)) throw new RangeError('key_bytes')
  if (!record.value.length || record.value.length > 512)
    throw new RangeError('value_bytes')
  if (record.ttl_seconds < 1n || record.ttl_seconds > 86400n)
    throw new RangeError('ttl')
  return record
}
/** Registration/replacement input. Store stamps updated_at from its current block. */
export function createRecordInput(
  key: string,
  value: string,
  ttlSeconds?: bigint,
): RecordInput {
  const issues = validateRecordValue(key, value)
  if (issues.length) throw new RangeError(issues.join(','))
  return validateRecordInput({
    key,
    value: encodeValue(key, value),
    ttl_seconds: ttlSeconds ?? definition(key).defaultTtlSeconds,
  })
}
/** Observed/projected record. updatedAt is explicitly a block height. */
export function createResolverRecord(
  key: string,
  value: string,
  updatedAt: bigint,
  ttlSeconds?: bigint,
): RecordValue {
  return {
    ...createRecordInput(key, value, ttlSeconds),
    updated_at: u64(updatedAt),
  }
}
export function validateRecordSet(
  input: readonly RecordValue[],
  height: bigint,
): RecordValue[] {
  u64(height)
  if (input.length > 16) throw new RangeError('record_count')
  let payload = 0
  const seen = new Set<string>()
  const rows = input.map((raw) => {
    const r = wireValue('RecordValue', raw)
    validateRecordInput({
      key: r.key,
      value: r.value,
      ttl_seconds: r.ttl_seconds,
    })
    if (r.updated_at > height) throw new RangeError('future_timestamp')
    if (seen.has(r.key)) throw new RangeError('duplicate_key')
    seen.add(r.key)
    payload += utf8.encode(r.key).length + r.value.length
    return r
  })
  if (payload > 9216) throw new RangeError('record_payload')
  return rows.sort((a, b) => compareUtf8(a.key, b.key))
}
function compareUtf8(a: string, b: string): number {
  const x = utf8.encode(a),
    y = utf8.encode(b)
  for (let i = 0; i < Math.min(x.length, y.length); i++)
    if (x[i] !== y[i]) return x[i] - y[i]
  return x.length - y.length
}
/** Atomic local simulation; Clear is idempotent, Set stamps height, TTL does not expire storage. */
export function applyRecordMutations(
  records: readonly RecordValue[],
  mutations: readonly RecordMutation[],
  height: bigint,
): RecordValue[] {
  const current = validateRecordSet(records, height)
  if (mutations.length < 1 || mutations.length > 8)
    throw new RangeError('mutation_count')
  const checked = mutations.map((m) => wireValue('RecordMutation', m)),
    seen = new Set<string>()
  let payload = 0
  for (const m of checked) {
    if (!validKey(m.key)) throw new RangeError('key_bytes')
    if (seen.has(m.key)) throw new RangeError('duplicate_key')
    seen.add(m.key)
    payload += utf8.encode(m.key).length + m.value.length
    if (m.action === 'Clear') {
      if (m.value.length || m.ttl_seconds !== 0n)
        throw new RangeError('clear_payload')
    } else
      validateRecordInput({
        key: m.key,
        value: m.value,
        ttl_seconds: m.ttl_seconds,
      })
  }
  if (payload > 4096) throw new RangeError('mutation_payload')
  const next = new Map(current.map((r) => [r.key, r]))
  for (const m of checked) {
    if (m.action === 'Clear') next.delete(m.key)
    else
      next.set(m.key, {
        key: m.key,
        value: [...m.value],
        ttl_seconds: m.ttl_seconds,
        updated_at: height,
      })
  }
  return validateRecordSet([...next.values()], height)
}
