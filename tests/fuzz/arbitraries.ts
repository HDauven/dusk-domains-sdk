import fc from 'fast-check'
import { definitions } from '../../src/frozen/schema.ts'
import { U64_MAX } from '../../src/frozen/json.ts'

// Generators are compiled from the SDK's own frozen schema snapshot, so every
// catalog type is covered without a hand-written list. Valid values are biased
// towards edges: u64 max and 2^53 neighbours, empty and maximum-length vectors,
// maximum UTF-8 byte strings, every enum variant and both Option branches.
type Schema = any
type Key = string | number
export { U64_MAX }
const U64_EDGES = [0n, 1n, 255n, 256n, 65535n, 65536n, (1n << 32n) - 1n, 1n << 32n,
  (1n << 53n) - 1n, 1n << 53n, (1n << 53n) + 1n, U64_MAX - 1n, U64_MAX]
export const u64Arbitrary = fc.oneof(fc.constantFrom(...U64_EDGES), fc.bigInt({ min: 0n, max: U64_MAX }))
export const resolve = (s: Schema): Schema => (s?.$ref ? resolve((definitions as any)[s.$ref.slice(8)]) : s)
const isU64 = (s: Schema) => s.type === 'integer' && typeof s.maximum === 'string'
const isU8 = (s: Schema) => { s = resolve(s); return s.type === 'integer' && s.maximum === 255 }
export const utf8 = (s: string) => Buffer.byteLength(s, 'utf8')
const toHex = (b: Uint8Array) => Buffer.from(b).toString('hex')

const SPECIAL = ['a', 'z', '0', '-', '.', '_', ' ', '\0', '\t', '\n', '"', '\\', '/', '\u007f', '\u0080',
  'é', '߿', 'ࠀ', '界', '﻿', '�', '￿', '😀', '\u{10000}', '\u{10ffff}']
const codePoint = fc.oneof(
  { weight: 3, arbitrary: fc.constantFrom(...SPECIAL) },
  { weight: 2, arbitrary: fc.integer({ min: 0x20, max: 0x7e }).map(n => String.fromCharCode(n)) },
  { weight: 1, arbitrary: fc.integer({ min: 0, max: 0x10ffff }).filter(n => n < 0xd800 || n > 0xdfff).map(n => String.fromCodePoint(n)) },
)
function fit(chars: string[], maxChars: number, maxBytes: number) {
  let out = '', bytes = 0, n = 0
  for (const c of chars) {
    const b = utf8(c)
    if (n + 1 > maxChars || bytes + b > maxBytes) break
    out += c; bytes += b; n++
  }
  return out
}
function stringArbitrary(maxChars: number, maxBytes: number) {
  const fill = (unit: string) => unit.repeat(Math.floor(Math.min(maxChars, maxBytes / utf8(unit))))
  return fc.oneof(
    fc.array(codePoint, { maxLength: Math.min(maxChars, 16) }).map(a => fit(a, maxChars, maxBytes)),
    fc.array(codePoint, { maxLength: maxChars, size: 'max' }).map(a => fit(a, maxChars, maxBytes)),
    fc.constantFrom('', fill('x'), fill('é'), fill('界'), fill('😀')),
  )
}
function sized<T>(min: number, max: number, make: (min: number, max: number, size?: fc.SizeForArbitrary) => fc.Arbitrary<T>) {
  if (min === max) return make(min, max)
  return fc.oneof(make(min, Math.min(max, min + 8)), make(max, max), make(min, max, 'max'))
}
const bytesArbitrary = (min: number, max: number) =>
  sized(min, max, (minLength, maxLength, size) => fc.uint8Array({ minLength, maxLength, ...(size ? { size } : {}) }))
const smallInt = (min: number, max: number) =>
  fc.oneof(fc.constantFrom(min, Math.min(min + 1, max), Math.max(max - 1, min), max), fc.integer({ min, max }))

const cache = new Map<string, fc.Arbitrary<any>>()
/** Arbitrary values the SDK schema accepts for one frozen type. */
export function arbitrary(type: string): fc.Arbitrary<any> {
  if (!cache.has(type)) {
    if (!(type in definitions)) throw new Error(`Unknown frozen type ${type}`)
    cache.set(type, compile((definitions as any)[type]))
  }
  return cache.get(type)!
}
export function compile(s: Schema): fc.Arbitrary<any> {
  if (s.$ref) return arbitrary(s.$ref.slice(8))
  if ('const' in s) return fc.constant(s.const)
  if (s.enum) return fc.constantFrom(...s.enum)
  if (s.oneOf || s.anyOf) return fc.oneof(...(s.oneOf ?? s.anyOf).map(compile))
  if (s.type === 'null') return fc.constant(null)
  if (s.type === 'boolean') return fc.boolean()
  if (s.type === 'integer') return isU64(s) ? u64Arbitrary : smallInt(s.minimum ?? 0, s.maximum)
  if (s.type === 'string') {
    if (s.format === 'uint64-lux')
      return fc.oneof({ weight: 4, arbitrary: u64Arbitrary.map(String) }, { weight: 1, arbitrary: u64Arbitrary.map(n => `00${n}`) })
    if (s.pattern === '^[0-9a-f]{64}$') return fc.uint8Array({ minLength: 32, maxLength: 32 }).map(toHex)
    if (s.pattern === '^([0-9a-f]{2})*$') return bytesArbitrary(0, Math.floor((s.maxLength ?? 128) / 2)).map(toHex)
    if (s.pattern) throw new Error(`Unimplemented pattern ${s.pattern}`)
    return stringArbitrary(s.maxLength ?? 64, s['x-max-utf8-bytes'] ?? (s.maxLength ?? 64) * 4)
  }
  if (s.type === 'array') {
    const min = s.minItems ?? 0, max = s.maxItems ?? 16
    if (isU8(s.items)) return bytesArbitrary(min, max).map(b => Array.from(b))
    const item = compile(s.items)
    return sized(min, max, (minLength, maxLength, size) => fc.array(item, { minLength, maxLength, ...(size ? { size } : {}) }))
  }
  if (s.type === 'object')
    return fc.record(Object.fromEntries(Object.entries(s.properties ?? {}).map(([key, child]) => [key, compile(child)])))
  throw new Error(`Unsupported schema: ${JSON.stringify(s)}`)
}

/** Smallest valid value: first variant, empty vectors, zero integers. */
export function minimum(s: Schema): any {
  s = resolve(s)
  if ('const' in s) return s.const
  if (s.enum) return s.enum[0]
  if (s.oneOf || s.anyOf) return minimum((s.oneOf ?? s.anyOf)[0])
  if (s.type === 'null') return null
  if (s.type === 'boolean') return false
  if (s.type === 'integer') return isU64(s) ? 0n : (s.minimum ?? 0)
  if (s.type === 'string') return s.format === 'uint64-lux' ? '0' : s.pattern === '^[0-9a-f]{64}$' ? '0'.repeat(64) : ''
  if (s.type === 'array') return Array.from({ length: s.minItems ?? 0 }, () => minimum(s.items))
  if (s.type === 'object') return Object.fromEntries(Object.entries(s.properties ?? {}).map(([k, c]) => [k, minimum(c)]))
  throw new Error(`Unsupported schema: ${JSON.stringify(s)}`)
}
/** Largest valid value: every vector and string at its bound, every Option present. */
export function maximal(s: Schema, unit = 'x'): any {
  s = resolve(s)
  if ('const' in s) return s.const
  if (s.enum) return s.enum.at(-1)
  if (s.oneOf || s.anyOf) return (s.oneOf ?? s.anyOf).map((v: Schema) => maximal(v, unit))
    .sort((a: any, b: any) => JSON.stringify(b, big).length - JSON.stringify(a, big).length)[0]
  if (s.type === 'null') return null
  if (s.type === 'boolean') return true
  if (s.type === 'integer') return isU64(s) ? U64_MAX : s.maximum
  if (s.type === 'string') {
    if (s.format === 'uint64-lux') return String(U64_MAX)
    if (s.pattern === '^[0-9a-f]{64}$') return 'f'.repeat(64)
    if (s.pattern === '^([0-9a-f]{2})*$') return 'ff'.repeat(Math.floor((s.maxLength ?? 128) / 2))
    const chars = s.maxLength ?? 64, bytes = s['x-max-utf8-bytes'] ?? chars * 4
    return unit.repeat(Math.floor(Math.min(chars, bytes / utf8(unit))))
  }
  if (s.type === 'array') return Array.from({ length: s.maxItems ?? 16 }, () => maximal(s.items, unit))
  if (s.type === 'object') return Object.fromEntries(Object.entries(s.properties ?? {}).map(([k, c]) => [k, maximal(c, unit)]))
  throw new Error(`Unsupported schema: ${JSON.stringify(s)}`)
}
const big = (_: string, v: unknown) => (typeof v === 'bigint' ? v.toString() : v)

// Vary one boundary at a time so maximum vectors do not multiply; every
// referenced enum/Option branch is visited explicitly.
export function boundaries(s: Schema): any[] {
  s = resolve(s)
  const base = minimum(s)
  if ('const' in s) return [base]
  if (s.enum) return s.enum
  if (s.oneOf || s.anyOf) return (s.oneOf ?? s.anyOf).flatMap(boundaries)
  if (s.type === 'integer') return isU64(s) ? [0n, 1n, (1n << 53n) + 1n, U64_MAX] : [base, s.maximum]
  if (s.type === 'boolean') return [false, true]
  if (s.type === 'string') {
    if (s.format === 'uint64-lux') return ['0', '9007199254740993', String(U64_MAX)]
    if (s.pattern === '^[0-9a-f]{64}$') return [base, 'f'.repeat(64)]
    if (s.pattern === '^([0-9a-f]{2})*$') return ['', 'ff'.repeat(Math.floor((s.maxLength ?? 128) / 2))]
    const n = s['x-max-utf8-bytes'] ?? s.maxLength ?? 64
    return ['', 'x'.repeat(n), 'é'.repeat(Math.floor(n / 2)), '😀'.repeat(Math.floor(n / 4))]
  }
  if (s.type === 'array') {
    const n = s.maxItems ?? 16
    return [base, Array.from({ length: n }, () => minimum(s.items)), ...boundaries(s.items).map(value => {
      const row = Array.from({ length: Math.max(1, s.minItems ?? 0) }, () => minimum(s.items))
      row[0] = value
      return row
    })]
  }
  if (s.type === 'object') return [base, ...Object.entries(s.properties ?? {}).flatMap(([key, child]) =>
    boundaries(child).map(value => ({ ...base, [key]: value })))]
  return [base]
}
/** Explicit edge examples for a type: one-at-a-time boundaries plus all-maximum values. */
export function examples(type: string): any[][] {
  const s = (definitions as any)[type]
  return [...boundaries(s), maximal(s), maximal(s, 'é'), maximal(s, '😀')].map(value => [value])
}

/** Find the oneOf branch that a value structurally belongs to. */
function branch(s: Schema, v: any): Schema | undefined {
  for (const variant of s.oneOf ?? s.anyOf) {
    const r = resolve(variant)
    if ('const' in r ? v === r.const : r.enum ? r.enum.includes(v)
      : r.type === 'null' ? v === null : r.type === 'object'
        ? v !== null && typeof v === 'object' && !Array.isArray(v) && Object.keys(v).join() === Object.keys(r.properties ?? {}).join()
        : r.type === 'array' ? Array.isArray(v) : r.type === 'string' ? typeof v === 'string'
          : r.type === 'boolean' ? typeof v === 'boolean' : r.type === 'integer' ? ['number', 'bigint'].includes(typeof v)
            : r.oneOf || r.anyOf ? branch(r, v) !== undefined : false) return r
  }
  return undefined
}
export interface Node { path: Key[]; schema: Schema; parent?: 'object' | 'array' }
/** Every node of a valid value with its schema; long vectors contribute their ends. */
export function nodes(s: Schema, v: any, path: Key[] = [], parent?: Node['parent'], out: Node[] = []): Node[] {
  let r = resolve(s)
  out.push({ path, schema: r, parent })
  while (r.oneOf || r.anyOf) {
    const next = branch(r, v)
    if (!next) return out
    r = next
  }
  if (r.type === 'object' && v && typeof v === 'object' && !Array.isArray(v))
    for (const [k, c] of Object.entries(r.properties ?? {})) nodes(c, v[k], [...path, k], 'object', out)
  if (r.type === 'array' && Array.isArray(v) && !isU8(r.items))
    for (const i of new Set([0, 1, v.length >> 1, v.length - 1].filter(i => i >= 0 && i < v.length)))
      nodes(r.items, v[i], [...path, i], 'array', out)
  return out
}
export function getAt(v: any, path: Key[]) { return path.reduce((x, k) => x?.[k], v) }
export function setAt(v: any, path: Key[], replacement: any): any {
  if (!path.length) return replacement
  const [head, ...rest] = path
  const copy: any = Array.isArray(v) ? [...v] : { ...v }
  copy[head] = setAt(v[head], rest, replacement)
  return copy
}
function removeAt(v: any, path: Key[]): any {
  if (path.length === 1) {
    if (Array.isArray(v)) return v.filter((_, i) => i !== path[0])
    const { [path[0]]: _, ...rest } = v
    return rest
  }
  const [head, ...rest] = path
  const copy: any = Array.isArray(v) ? [...v] : { ...v }
  copy[head] = removeAt(v[head], rest)
  return copy
}

export const jsonArbitrary = fc.jsonValue({ maxDepth: 3 })
/** Plausible near-misses for a schema node: off-by-one bounds and type confusions. */
function nearMisses(s: Schema, v: any): any[] {
  s = resolve(s)
  const out: any[] = [null, true, 0, -1, '', [], {}, 1.5, '1', U64_MAX + 1n]
  if (s.type === 'integer') out.push(isU64(s) ? -1n : s.maximum + 1, isU64(s) ? Number.MAX_SAFE_INTEGER : -0,
    isU64(s) ? 2 ** 53 : String(s.maximum), typeof v === 'bigint' ? Number(v) : Number.isSafeInteger(v) ? BigInt(v) : 0n)
  if (s.format === 'uint64-lux') out.push(String(U64_MAX + 1n), '-1', '1.0', ' 1', '0x1', '١', '+1', 1, 1n, `${v} `)
  if (s.pattern === '^[0-9a-f]{64}$') out.push('f'.repeat(63), 'f'.repeat(65), 'F'.repeat(64), `0x${'f'.repeat(62)}`, 'g'.repeat(64))
  if (s.pattern === '^([0-9a-f]{2})*$') out.push('f', 'FF', 'gg', `0x${v}`, 'ff'.repeat(Math.floor((s.maxLength ?? 128) / 2) + 1), `${v}0`)
  if (s.type === 'string' && !s.pattern && !s.format) {
    const n = s['x-max-utf8-bytes'] ?? s.maxLength ?? 64
    out.push('x'.repeat(n + 1), 'é'.repeat(Math.ceil((n + 1) / 2)), '😀'.repeat(Math.ceil((n + 1) / 4)),
      '\ud800', `a\udc00`, `${'x'.repeat(Math.max(0, n - 1))}\ud83d`, 'x'.repeat(n).normalize('NFD'))
  }
  if (s.type === 'array') {
    const max = s.maxItems ?? 16, min = s.minItems ?? 0, item = isU8(s.items) ? 0 : minimum(s.items)
    out.push(Array.from({ length: max + 1 }, () => item))
    if (min > 0) out.push(Array.from({ length: min - 1 }, () => item))
    if (Array.isArray(v) && v.length) out.push([...v.slice(1), 256], [...v.slice(1), -1], [...v.slice(1), '1'])
  }
  if (s.enum || s.oneOf || s.anyOf || 'const' in s) {
    const variants = (s.enum ?? (s.oneOf ?? s.anyOf ?? []).map(resolve).map((r: Schema) => 'const' in r ? r.const
      : Object.keys(r.properties ?? {})[0]).filter(Boolean)).concat('const' in s ? [s.const] : [])
    for (const x of variants) if (typeof x === 'string') out.push(x.toLowerCase(), `${x} `, { [x]: null }, [x])
    if (typeof s.const === 'number') out.push(s.const + 1, s.const - 1)
    if (v && typeof v === 'object' && !Array.isArray(v)) out.push({ ...v, Extra: null }, Object.values(v)[0])
  }
  if (s.type === 'object' && v && typeof v === 'object' && !Array.isArray(v))
    out.push(Object.values(v), Object.values(v).slice(1), [...Object.values(v), null], Object.fromEntries(Object.entries(v).reverse()))
  return out
}

/** Explicit mutation choices, so fast-check can shrink them like any other input. */
export interface Choice { node: number; op: number; pick: number; json: unknown }
export const choices = fc.array(fc.record({ node: fc.nat(), op: fc.nat(), pick: fc.nat(), json: jsonArbitrary }), { minLength: 1, maxLength: 3 })
const sampleOf = (arb: fc.Arbitrary<any>, seed: number) => fc.sample(arb, { seed, numRuns: 1 })[0]
const OPS = ['valid', 'valid', 'near', 'near', 'json', 'delete', 'extra'] as const
/**
 * Mutate a valid value at any depth. Mixes schema-valid replacements (to reach
 * driver-only rules such as version tags and aggregate payload limits),
 * near-miss bounds, deletions, unknown fields and arbitrary JSON.
 */
export function mutate(type: string, value: any, steps: Choice[]): any {
  let v = value
  for (const c of steps) {
    const all = nodes((definitions as any)[type], v)
    const node = all[c.node % all.length], op = OPS[c.op % OPS.length]
    if (op === 'valid') v = setAt(v, node.path, sampleOf(compile(node.schema), c.pick))
    else if (op === 'near') {
      const options = nearMisses(node.schema, getAt(v, node.path))
      v = setAt(v, node.path, options[c.pick % options.length])
    } else if (op === 'json') v = setAt(v, node.path, c.json)
    else if (op === 'delete' && node.path.length) v = removeAt(v, node.path)
    else if (op === 'extra') {
      const target = getAt(v, node.path)
      if (target && typeof target === 'object' && !Array.isArray(target))
        v = setAt(v, node.path, { ...target, [['extra', '__proto__', 'Version', ''][c.pick % 4]]: c.json })
      else v = setAt(v, node.path, c.json)
    }
  }
  return v
}

// JSON text tokens, so number spellings, escapes and layout can be varied
// without changing the value that the text denotes.
interface Token { kind: 'string' | 'number' | 'literal' | 'punct'; text: string }
export function tokens(text: string): Token[] | null {
  const out: Token[] = []
  const re = /\s+|"(?:[^"\\]|\\.)*"|-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?|true|false|null|[{}[\],:]/gy
  let m: RegExpExecArray | null, at = 0
  while (at < text.length) {
    re.lastIndex = at
    if (!(m = re.exec(text))) return null
    const t = m[0]
    if (!/^\s+$/.test(t)) out.push({ kind: t[0] === '"' ? 'string' : /^[-\d]/.test(t) ? 'number' : /^[a-z]/.test(t) ? 'literal' : 'punct', text: t })
    at += t.length
  }
  return out
}
export const join = (t: Token[]) => t.map(x => x.text).join('')
/** Integral JSON numbers spelled other than as a canonical integer token. */
export function nonCanonicalNumbers(text: string): boolean {
  return (tokens(text) ?? []).some(t => t.kind === 'number' && (/[.eE]/.test(t.text) || t.text === '-0'))
}
export function canonicalNumbers(text: string): string {
  const t = tokens(text)
  if (!t) return text
  return join(t.map(x => {
    if (x.kind !== 'number' || !(/[.eE]/.test(x.text) || x.text === '-0')) return x
    const n = Number(x.text)
    return Number.isSafeInteger(n) ? { ...x, text: String(Object.is(n, -0) ? 0 : n) } : x
  }))
}
export interface TextChoice { token: number; op: number; form: number; at: number }
export const textChoice = fc.record({ token: fc.nat(), op: fc.nat(), form: fc.nat(), at: fc.nat() })
const TEXT_OPS = ['number', 'number', 'escape', 'space', 'duplicate', 'truncate', 'trailing'] as const
/** Re-spell JSON text: number forms, string escapes, whitespace, duplicates and truncation. */
export function mutateText(text: string, c: TextChoice): string {
  const out = respell(text, c)
  // JSON text reaches either side as UTF-8 bytes, which cannot carry lone surrogates.
  return out.isWellFormed() ? out : text
}
function respell(text: string, c: TextChoice): string {
  const t = tokens(text)
  if (!t || !t.length) return text
  const i = c.token % t.length, x = t[i], op = TEXT_OPS[c.op % TEXT_OPS.length]
  if (op === 'number' && x.kind === 'number') {
    const n = x.text
    const forms = [`${n}.0`, `${n}e0`, `${n}E+0`, `${n}0e-1`, `${n}.00`, `0${n}`, `+${n}`, `${n}.`, `${n}e`,
      ...(n === '0' ? ['-0', '-0.0', '0e5'] : [`-${n}`])]
    t[i] = { ...x, text: forms[c.form % forms.length] }
  } else if (op === 'escape' && x.kind === 'string' && x.text.length > 2) {
    const body = JSON.parse(x.text) as string, at = c.at % body.length
    const unit = body.charCodeAt(at), esc = `\\u${unit.toString(16).padStart(4, '0')}`
    const forms = [esc, esc.toUpperCase().replace('\\U', '\\u'), '\\ud800', '\\udfff', '\\ud83d\\ude00', '\\/', '\\u0000']
    const escaped = JSON.stringify(body.slice(0, at)).slice(1, -1) + forms[c.form % forms.length] + JSON.stringify(body.slice(at + 1)).slice(1, -1)
    t[i] = { ...x, text: `"${escaped}"` }
  } else if (op === 'space') {
    t[i] = { ...x, text: x.text + [' ', '\n', '\t', '\r\n', '\u00a0', '\ufeff'][c.form % 6] }
  } else if (op === 'duplicate' && x.kind === 'string' && t[i + 1]?.text === ':') {
    let depth = 0, end = i + 2
    for (; end < t.length; end++) {
      if ('{['.includes(t[end].text)) depth++
      else if ('}]'.includes(t[end].text)) { if (depth === 0) break; depth-- } else if (t[end].text === ',' && depth === 0) break
    }
    return join([...t.slice(0, end), { kind: 'punct', text: ',' }, ...t.slice(i, end), ...t.slice(end)])
  } else if (op === 'truncate') return join(t).slice(0, c.at % Math.max(1, join(t).length))
  else if (op === 'trailing') return join(t) + [',', ' ', '\n', '}', 'null', '\u0000'][c.form % 6]
  return join(t)
}
