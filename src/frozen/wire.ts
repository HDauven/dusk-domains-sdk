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
/** Validate exact wire fields and bounds, producing bigint u64s and canonical Lux text. */
export function wireValue<T extends keyof WireTypes>(
  type: T,
  value: unknown,
): WireTypes[T]
export function wireValue(type: string, value: unknown): unknown
export function wireValue(type: string, value: unknown): unknown {
  const root = definitions[type] as Schema | undefined
  if (!root) throw new Error(`Unknown wire type: ${type}`)
  function check(s: Schema, v: unknown, path: string): unknown {
    const bad = (): never => {
      throw new Error(`Invalid ${type} at ${path}`)
    }
    if (s.$ref) return check(definitions[s.$ref.slice(8)] as Schema, v, path)
    if (s.enum) return s.enum.includes(v) ? v : bad()
    if ('const' in s) return v === s.const ? v : bad()
    if (s.oneOf || s.anyOf) {
      for (const variant of s.oneOf ?? s.anyOf ?? []) {
        try {
          return check(variant, v, path)
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
      if (s.format === 'uint64-lux') return lux(v)
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
      return v.map((x, i) => check(s.items!, x, `${path}[${i}]`))
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
          check(t, obj[k], `${path}.${k}`),
        ]),
      )
    }
    return bad()
  }
  return check(root, value, '$')
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
  return wireValue(type, parseJson(text))
}
