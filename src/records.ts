export const RECORD_VISIBILITIES = ['public', 'sensitive_public'] as const

export type RecordVisibility = (typeof RECORD_VISIBILITIES)[number]

export type StaticRecordKey =
  | 'moonlight_address'
  | 'phoenix_payment_endpoint'
  | 'dusk_contract'
  | 'dusk_asset'
  | 'evm_address'
  | 'website'
  | 'avatar'
  | 'content_pointer'
  | 'attestation_ref'
  | 'compliance_ref'

export type DynamicRecordKey = `text.${string}` | `service_endpoint.${string}`
export type ResolverRecordKey = StaticRecordKey | DynamicRecordKey

export type ResolverRecord = {
  key: ResolverRecordKey
  value: string
  visibility: RecordVisibility
  updatedAt: string
  ttlSeconds: number
}

export type RecordDefinition = {
  key: ResolverRecordKey
  label: string
  visibility: RecordVisibility
  maxBytes: number
  defaultTtlSeconds: number
  eligibleForPrimaryName: boolean
  eligibleForDefaultDuskRecipient: boolean
  validate: (value: string) => string[]
}

export type EncodedResolverRecord = {
  version: 1
  key: ResolverRecordKey
  value: string
  visibility: RecordVisibility
  updatedAt: string
  ttlSeconds: number
}

const utf8 = new TextEncoder()
const HTTPS_URL_MAX_BYTES = 2048
const OPAQUE_REF_MAX_BYTES = 512
const TEXT_MAX_BYTES = 512

const staticDefinitions: Record<StaticRecordKey, RecordDefinition> = {
  moonlight_address: {
    key: 'moonlight_address',
    label: 'Dusk Public Address',
    visibility: 'public',
    maxBytes: 160,
    defaultTtlSeconds: 300,
    eligibleForPrimaryName: true,
    eligibleForDefaultDuskRecipient: true,
    validate: validateMoonlightAddress,
  },
  phoenix_payment_endpoint: {
    key: 'phoenix_payment_endpoint',
    label: 'Dusk Shielded Address',
    visibility: 'sensitive_public',
    maxBytes: 256,
    defaultTtlSeconds: 300,
    eligibleForPrimaryName: false,
    eligibleForDefaultDuskRecipient: false,
    validate: validatePhoenixPaymentEndpoint,
  },
  dusk_contract: {
    key: 'dusk_contract',
    label: 'Dusk contract',
    visibility: 'public',
    maxBytes: 66,
    defaultTtlSeconds: 300,
    eligibleForPrimaryName: false,
    eligibleForDefaultDuskRecipient: false,
    validate: validateDuskContract,
  },
  dusk_asset: {
    key: 'dusk_asset',
    label: 'Dusk asset',
    visibility: 'public',
    maxBytes: 128,
    defaultTtlSeconds: 300,
    eligibleForPrimaryName: false,
    eligibleForDefaultDuskRecipient: false,
    validate: validateOpaqueIdentifier,
  },
  evm_address: {
    key: 'evm_address',
    label: 'DuskEVM Address',
    visibility: 'public',
    maxBytes: 42,
    defaultTtlSeconds: 300,
    eligibleForPrimaryName: false,
    eligibleForDefaultDuskRecipient: false,
    validate: validateEvmAddress,
  },
  website: {
    key: 'website',
    label: 'Website',
    visibility: 'public',
    maxBytes: HTTPS_URL_MAX_BYTES,
    defaultTtlSeconds: 3600,
    eligibleForPrimaryName: false,
    eligibleForDefaultDuskRecipient: false,
    validate: validateHttpsUrl,
  },
  avatar: {
    key: 'avatar',
    label: 'Avatar',
    visibility: 'public',
    maxBytes: HTTPS_URL_MAX_BYTES,
    defaultTtlSeconds: 3600,
    eligibleForPrimaryName: false,
    eligibleForDefaultDuskRecipient: false,
    validate: validateDisplayUri,
  },
  content_pointer: {
    key: 'content_pointer',
    label: 'Content pointer',
    visibility: 'public',
    maxBytes: HTTPS_URL_MAX_BYTES,
    defaultTtlSeconds: 3600,
    eligibleForPrimaryName: false,
    eligibleForDefaultDuskRecipient: false,
    validate: validateContentPointer,
  },
  attestation_ref: {
    key: 'attestation_ref',
    label: 'Attestation reference',
    visibility: 'public',
    maxBytes: OPAQUE_REF_MAX_BYTES,
    defaultTtlSeconds: 3600,
    eligibleForPrimaryName: false,
    eligibleForDefaultDuskRecipient: false,
    validate: validateOpaqueReference,
  },
  compliance_ref: {
    key: 'compliance_ref',
    label: 'Compliance reference',
    visibility: 'public',
    maxBytes: OPAQUE_REF_MAX_BYTES,
    defaultTtlSeconds: 3600,
    eligibleForPrimaryName: false,
    eligibleForDefaultDuskRecipient: false,
    validate: validateComplianceReference,
  },
}

export const STATIC_RECORD_DEFINITIONS = Object.values(staticDefinitions)

export function getRecordDefinition(key: ResolverRecordKey): RecordDefinition | undefined {
  if (isStaticRecordKey(key)) return staticDefinitions[key]
  if (isTextRecordKey(key)) return createTextRecordDefinition(key)
  if (isServiceEndpointRecordKey(key)) return createServiceEndpointDefinition(key)
  return undefined
}

export function validateRecordValue(key: ResolverRecordKey, value: string) {
  const definition = getRecordDefinition(key)
  if (!definition) return [`Unsupported resolver record key: ${key}`]

  const errors = validateByteLength(value, definition.maxBytes)
  return [...errors, ...definition.validate(value)]
}

export function createResolverRecord(
  key: ResolverRecordKey,
  value: string,
  updatedAt = new Date().toISOString(),
): ResolverRecord {
  const definition = getRecordDefinition(key)

  if (!definition) {
    throw new Error(`Unsupported resolver record key: ${key}`)
  }

  const errors = validateRecordValue(key, value)

  if (errors.length > 0) {
    throw new Error(errors.join(' '))
  }

  return {
    key,
    value,
    visibility: definition.visibility,
    updatedAt,
    ttlSeconds: definition.defaultTtlSeconds,
  }
}

export function encodeResolverRecord(record: ResolverRecord): string {
  return JSON.stringify({
    version: 1,
    key: record.key,
    value: record.value,
    visibility: record.visibility,
    updatedAt: record.updatedAt,
    ttlSeconds: record.ttlSeconds,
  } satisfies EncodedResolverRecord)
}

export function decodeResolverRecord(encoded: string): ResolverRecord {
  const parsed = JSON.parse(encoded) as Partial<EncodedResolverRecord>

  if (parsed.version !== 1) {
    throw new Error('Unsupported resolver record encoding version.')
  }

  if (!parsed.key || !parsed.value || !parsed.visibility || !parsed.updatedAt || parsed.ttlSeconds === undefined) {
    throw new Error('Resolver record encoding is missing required fields.')
  }

  if (!RECORD_VISIBILITIES.includes(parsed.visibility)) {
    throw new Error('Resolver record visibility is unsupported.')
  }

  const errors = validateRecordValue(parsed.key, parsed.value)

  if (errors.length > 0) {
    throw new Error(errors.join(' '))
  }

  return {
    key: parsed.key,
    value: parsed.value,
    visibility: parsed.visibility,
    updatedAt: parsed.updatedAt,
    ttlSeconds: parsed.ttlSeconds,
  }
}

function isStaticRecordKey(key: ResolverRecordKey): key is StaticRecordKey {
  return key in staticDefinitions
}

function isTextRecordKey(key: ResolverRecordKey): key is `text.${string}` {
  return /^text\.[a-z0-9_:-]{1,40}$/.test(key)
}

function isServiceEndpointRecordKey(key: ResolverRecordKey): key is `service_endpoint.${string}` {
  return /^service_endpoint\.[a-z0-9_-]{1,40}$/.test(key)
}

function createTextRecordDefinition(key: `text.${string}`): RecordDefinition {
  return {
    key,
    label: key,
    visibility: 'public',
    maxBytes: TEXT_MAX_BYTES,
    defaultTtlSeconds: 3600,
    eligibleForPrimaryName: false,
    eligibleForDefaultDuskRecipient: false,
    validate: validatePublicText,
  }
}

function createServiceEndpointDefinition(key: `service_endpoint.${string}`): RecordDefinition {
  return {
    key,
    label: key,
    visibility: 'public',
    maxBytes: HTTPS_URL_MAX_BYTES,
    defaultTtlSeconds: 3600,
    eligibleForPrimaryName: false,
    eligibleForDefaultDuskRecipient: false,
    validate: validateHttpsUrl,
  }
}

function validateByteLength(value: string, maxBytes: number) {
  if (utf8.encode(value).byteLength > maxBytes) return [`Value exceeds ${maxBytes} bytes.`]
  return []
}

function validateMoonlightAddress(value: string) {
  if (/^dusk1[a-z0-9]{20,127}$/.test(value)) return []
  if (/^[1-9A-HJ-NP-Za-km-z]{32,160}$/.test(value)) return []
  return ['Dusk addresses must use a dusk1-prefixed address or Dusk account address form.']
}

function validatePhoenixPaymentEndpoint(value: string) {
  if (/^[A-Za-z0-9:_-]{32,256}$/.test(value)) return []
  return ['Dusk Shielded Addresses must be explicit wallet-approved receive addresses, not profile identity fields.']
}

function validateDuskContract(value: string) {
  if (/^0x[a-fA-F0-9]{64}$/.test(value)) return []
  return ['Dusk contract IDs must be 32-byte hex strings formatted as 0x + 64 hex characters.']
}

function validateEvmAddress(value: string) {
  if (/^0x[a-fA-F0-9]{40}$/.test(value)) return []
  return ['DuskEVM Addresses must be 20-byte hex strings formatted as 0x + 40 hex characters.']
}

function validateHttpsUrl(value: string) {
  try {
    const url = new URL(value)
    return url.protocol === 'https:' ? [] : ['URLs must use HTTPS.']
  } catch {
    return ['Value must be a valid HTTPS URL.']
  }
}

function validateDisplayUri(value: string) {
  if (value.startsWith('ipfs://') || value.startsWith('ar://')) return []
  return validateHttpsUrl(value)
}

function validateContentPointer(value: string) {
  if (/^ipfs:\/\/[a-zA-Z0-9]+/.test(value) || /^bafy[a-zA-Z0-9]+$/.test(value)) return []
  return validateDisplayUri(value)
}

function validateOpaqueIdentifier(value: string) {
  if (/^[A-Za-z0-9:._-]{3,128}$/.test(value)) return []
  return ['Identifier must be 3-128 visible characters using letters, numbers, colon, dot, underscore, or hyphen.']
}

function validateOpaqueReference(value: string) {
  if (/^(https:\/\/|urn:|dusk:)[^\s]{3,512}$/.test(value)) return []
  return ['Reference must be an HTTPS URL, URN, or dusk: reference without whitespace.']
}

function validateComplianceReference(value: string) {
  return validateOpaqueReference(value)
}

function validatePublicText(value: string) {
  if (value.trim().length === 0) return ['Text records cannot be empty.']
  if ([...value].some((character) => {
    const codePoint = character.codePointAt(0) ?? 0
    return codePoint < 32 || codePoint === 127
  })) {
    return ['Text records cannot contain control characters.']
  }
  return []
}
