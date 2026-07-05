import { blake2b } from '@noble/hashes/blake2.js'
import { bytesToHex, utf8ToBytes } from '@noble/hashes/utils.js'

export type DuskNameActionEnvelope = {
  chainId: string
  targetContract: string
  nonceDomain: string
  actionId: string
  payloadHash: string
}

export type DuskNameSignedActionAuthorization = {
  envelope: DuskNameActionEnvelope
  signer: string
  nonce: number
  expiresAt: number
  signature: string
}

export const DUSK_NAME_ACTION_IDS: Readonly<{ setRecord: string }> = {
  setRecord: `0x${'14'.repeat(32)}`,
} as const

export function createPayloadHash(payload: unknown): string {
  return `0x${bytesToHex(blake2b(utf8ToBytes(stableStringify(payload)), { dkLen: 32 }))}`
}

export function createPreviewSignedActionAuthorization(args: {
  chainId: string
  targetContract: string
  nonceDomain: string
  actionId: string
  payload: unknown
  signer: string
  nonce?: number
  expiresAt: number
}): DuskNameSignedActionAuthorization {
  const payloadHash = createPayloadHash(args.payload)

  return {
    envelope: {
      chainId: args.chainId,
      targetContract: args.targetContract,
      nonceDomain: args.nonceDomain,
      actionId: args.actionId,
      payloadHash,
    },
    signer: args.signer,
    nonce: args.nonce ?? 1,
    expiresAt: args.expiresAt,
    signature: `preview-signature:${args.signer}:${payloadHash}`,
  }
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`
  if (!value || typeof value !== 'object') return JSON.stringify(value)

  const record = value as Record<string, unknown>
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`)
    .join(',')}}`
}
