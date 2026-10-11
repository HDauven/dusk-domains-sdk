/** Strict frozen data-driver JSON validation and normalization. @module */
import { definitions } from './schema.ts'
import { parseJson, stringifyJson, u64, lux } from './json.ts'
import type { WireTypes } from './types.ts'

interface Schema {
  $ref?: string
  const?: unknown
  enum?: unknown[]
  oneOf?: Schema[]
  anyOf?: Schema[]
  type?: string
  properties?: Record<string, Schema>
  required?: string[]
  items?: Schema
  minimum?: number
  maximum?: number | string
  minItems?: number
  maxItems?: number
  maxLength?: number
  'x-max-utf8-bytes'?: number
  pattern?: string
  format?: string
}
const transferContract = [1, ...Array<number>(31).fill(0)]
const isTransfer = (value: unknown): boolean =>
  Array.isArray(value) &&
  value.length === transferContract.length &&
  value.every((byte, index) => byte === transferContract[index])
const utf8 = new TextEncoder()
function isWellFormed(value: string): boolean {
  for (let index = 0; index < value.length; index++) {
    const unit = value.charCodeAt(index)
    if (unit >= 0xd800 && unit <= 0xdbff) {
      const low = value.charCodeAt(++index)
      if (!(low >= 0xdc00 && low <= 0xdfff)) return false
    } else if (unit >= 0xdc00 && unit <= 0xdfff) return false
  }
  return true
}
function validateMutationPayload(value: unknown): void {
  if (!value || typeof value !== 'object') return
  if (Array.isArray(value)) {
    for (const child of value) validateMutationPayload(child)
    return
  }
  const object = value as Record<string, unknown>
  if (Array.isArray(object.mutations)) {
    const bytes = object.mutations.reduce((total, row) => {
      const mutation = row as { key: string; value: number[] }
      return total + utf8.encode(mutation.key).length + mutation.value.length
    }, 0)
    if (bytes > 4096) throw new Error('Record mutations exceed 4096 bytes')
  }
  for (const child of Object.values(object)) validateMutationPayload(child)
}
/** Validate exact wire fields and bounds, producing bigint u64s and canonical Lux text. */
export function wireValue<T extends keyof WireTypes>(
  type: T,
  value: unknown,
): WireTypes[T]
export function wireValue(type: string, value: unknown): unknown
export function wireValue(type: string, value: unknown): unknown {
  const root = definitions[type] as Schema | undefined
  if (!root) throw new Error(`Unknown wire type: ${type}`)
  function check(
    s: Schema,
    v: unknown,
    path: string,
    definition?: string,
    allowTransferPrincipal = false,
  ): unknown {
    const bad = (): never => {
      throw new Error(`Invalid ${type} at ${path}`)
    }
    if (s.$ref) {
      const name = s.$ref.slice(8)
      const checked = check(
        definitions[name] as Schema,
        v,
        path,
        name,
        allowTransferPrincipal,
      )
      if (name === 'Authority' && isTransfer(checked)) return bad()
      if (
        name === 'TypedPrincipal' &&
        !allowTransferPrincipal &&
        (checked as { kind?: unknown }).kind === 'Contract' &&
        isTransfer((checked as { bytes?: unknown }).bytes)
      )
        return bad()
      return checked
    }
    if (s.enum) return s.enum.includes(v) ? v : bad()
    if ('const' in s) return v === s.const ? v : bad()
    if (s.oneOf || s.anyOf) {
      for (const variant of s.oneOf ?? s.anyOf ?? []) {
        try {
          return check(variant, v, path, definition, allowTransferPrincipal)
        } catch {
          /* try next variant */
        }
      }
      return bad()
    }
    if (s.type === 'null') return v === null ? null : bad()
    if (s.type === 'boolean') return typeof v === 'boolean' ? v : bad()
    if (s.type === 'integer') {
      const n = u64(v)
      if (n < BigInt(s.minimum ?? 0) || n > BigInt(s.maximum ?? 0)) return bad()
      return typeof s.maximum === 'string' ? n : Number(n)
    }
    if (s.type === 'string') {
      if (typeof v !== 'string') return bad()
      if (!isWellFormed(v)) return bad()
      if (s.format === 'uint64-lux') {
        const canonical = lux(v)
        if (canonical !== v) return bad()
        return canonical
      }
      if (s.pattern && !new RegExp(s.pattern, 'u').test(v)) return bad()
      if (s.maxLength !== undefined && [...v].length > s.maxLength) return bad()
      const bytes = s['x-max-utf8-bytes']
      if (bytes !== undefined && new TextEncoder().encode(v).length > bytes)
        return bad()
      return v
    }
    if (s.type === 'array') {
      if (
        !Array.isArray(v) ||
        v.length < (s.minItems ?? 0) ||
        v.length > (s.maxItems ?? 32768)
      )
        return bad()
      return v.map((x, i) =>
        check(s.items!, x, `${path}[${i}]`, definition, allowTransferPrincipal),
      )
    }
    if (s.type === 'object') {
      if (v === null || typeof v !== 'object' || Array.isArray(v)) return bad()
      const obj = v as Record<string, unknown>,
        props = s.properties ?? {}
      if (
        Object.keys(obj).some((k) => !Object.hasOwn(props, k)) ||
        (s.required ?? []).some((k) => !Object.hasOwn(obj, k))
      )
        return bad()
      return Object.fromEntries(
        Object.entries(props).map(([k, t]) => [
          k,
          check(
            t,
            obj[k],
            `${path}.${k}`,
            definition,
            allowTransferPrincipal || (definition === 'Register' && k === 'referrer'),
          ),
        ]),
      )
    }
    return bad()
  }
  const checked = check(root, value, '$', type)
  if (type === 'Authority' && isTransfer(checked))
    throw new Error('Transfer contract is not an authority')
  if (
    type === 'TypedPrincipal' &&
    (checked as { kind?: unknown }).kind === 'Contract' &&
    isTransfer((checked as { bytes?: unknown }).bytes)
  )
    throw new Error('Transfer contract is not a principal')
  validateMutationPayload(checked)
  return checked
}
/** Validate a value in its entrypoint context, including boundary-specific limits. */
export function wireInput(
  role: string,
  method: string,
  type: string,
  value: unknown,
): unknown {
  const checked = wireValue(type, value)
  if (
    role === 'vault' &&
    method === 'receive_fee' &&
    typeof (checked as { data?: unknown }).data === 'string' &&
    (checked as { data: string }).data.length > 1024
  )
    throw new Error('Vault fee metadata exceeds 512 bytes')
  return checked
}
export function encodeJson<T extends keyof WireTypes>(
  type: T,
  value: WireTypes[T],
): string {
  return stringifyJson(wireValue(type, value))
}
export function decodeJson<T extends keyof WireTypes>(
  type: T,
  text: string,
): WireTypes[T] {
  return wireValue(type, parseJson(text, { canonicalIntegers: true }))
}
/** Decode and validate canonical JSON in its entrypoint context. */
export function decodeInputJson(
  role: string,
  method: string,
  type: string,
  text: string,
): unknown {
  return wireInput(
    role,
    method,
    type,
    parseJson(text, { canonicalIntegers: true }),
  )
}
