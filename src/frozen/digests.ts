/** Canonical digest encoding C, independent of rkyv layout. @module */
import { definitions } from './schema.ts'
import { hash, hex } from './bytes.ts'
import { wireValue } from './wire.ts'
import type { RecordValue, MoveTicket, ExportRow } from './types.ts'
interface Shape {
  $ref?: string
  type?: string
  properties?: Record<string, Shape>
  items?: Shape
  oneOf?: Shape[]
  anyOf?: Shape[]
  enum?: string[]
  const?: unknown
  maximum?: number | string
  minItems?: number
  maxItems?: number
  format?: string
}
export function canonicalBytes(type: string, value: unknown): number[] {
  const checked = wireValue(type, value)
  function integer(value: unknown, width: number): number[] {
    let n = BigInt(value as string | number | bigint)
    return Array.from({ length: width }, () => {
      const b = Number(n & 255n)
      n >>= 8n
      return b
    })
  }
  function encode(s: Shape, v: unknown, name = ''): number[] {
    if (s.$ref) {
      const ref = s.$ref.slice(8)
      return encode(definitions[ref] as Shape, v, ref)
    }
    if (name.startsWith('Option<'))
      return v === null ? [0] : [1, ...canonicalBytes(name.slice(7, -1), v)]
    if (s.type === 'integer')
      return integer(
        v,
        typeof s.maximum === 'string'
          ? 8
          : (s.maximum ?? 0) <= 255
            ? 1
            : (s.maximum ?? 0) <= 65535
              ? 2
              : 4,
      )
    if (s.type === 'boolean') return [v ? 1 : 0]
    if ('const' in s)
      return typeof s.const === 'number' ? integer(v, 2) : []
    if (s.format === 'uint64-lux') return integer(v, 8)
    if (s.type === 'string') {
      const b = Array.from(new TextEncoder().encode(v as string))
      return [...integer(b.length, 4), ...b]
    }
    if (s.type === 'array') {
      const rows = v as unknown[],
        body = rows.flatMap((x) => encode(s.items!, x))
      return s.minItems !== undefined && s.minItems === s.maxItems
        ? body
        : [...integer(rows.length, 4), ...body]
    }
    if (s.type === 'object')
      return Object.entries(s.properties!).flatMap(([k, t]) =>
        encode(t, (v as Record<string, unknown>)[k]),
      )
    if (s.enum) return [s.enum.indexOf(v as string)]
    if (s.oneOf) {
      const tag = s.oneOf.findIndex((t) =>
        'const' in t
          ? t.const === v
          : typeof v === 'object' &&
            v !== null &&
            Object.keys(t.properties ?? {})[0] in v,
      )
      if (tag < 0) throw new Error('Invalid canonical enum')
      const variant = s.oneOf[tag]
      return [tag, ...('const' in variant ? [] : encode(variant, v))]
    }
    throw new Error(`Unsupported canonical shape ${name}`)
  }
  return encode(definitions[type] as Shape, checked, type)
}
export function recordsDigest(records: RecordValue[]): number[] {
  if (records.length > 16) throw new Error('Too many records')
  const sorted = [...records].sort((a, b) => {
    const x = new TextEncoder().encode(a.key),
      y = new TextEncoder().encode(b.key)
    for (let i = 0; i < Math.min(x.length, y.length); i++)
      if (x[i] !== y[i]) return x[i] - y[i]
    return x.length - y.length
  })
  if (sorted.some((r, i) => i > 0 && r.key === sorted[i - 1].key))
    throw new Error('Duplicate record key')
  return hash(
    'duskds:records:v1',
    canonicalBytes('u32', sorted.length),
    ...sorted.map((r) => canonicalBytes('RecordValue', r)),
  )
}
/** Hash exactly the locked projection; renewal/primary clearing does not change it. */
export function moveManifestDigest(
  ticket: MoveTicket,
  rows: ExportRow[],
): number[] {
  if (rows.length !== ticket.row_count || rows.some((r, i) => r.index !== i))
    throw new Error('Incomplete or unordered move history')
  const parts: number[][] = [
    ticket.source,
    ticket.destination,
    ticket.root.key.root,
    canonicalBytes('RootCounters', ticket.counters),
    canonicalBytes('u16', ticket.row_count),
    canonicalBytes('u16', ticket.primary_count),
  ]
  for (const row of rows) {
    const n = row.name
    if (n.custody) throw new Error('Move contains custody')
    parts.push(
      canonicalBytes('u16', row.index),
      canonicalBytes('NameKey', n.key),
    )
    const label = Array.from(new TextEncoder().encode(n.label))
    parts.push(
      canonicalBytes('u32', label.length),
      label,
      canonicalBytes('Incarnation', n.incarnation),
      n.owner,
      n.manager,
      canonicalBytes('Option<TypedPrincipal>', n.referrer),
    )
    if (n.subname)
      parts.push(
        [1],
        n.subname.parent,
        canonicalBytes('u8', n.subname.depth),
        canonicalBytes('Height', n.subname.created_at),
      )
    else parts.push([0])
    parts.push(canonicalBytes('Option<SlotPointer>', n.records))
  }
  return hash('duskds:manifest:v1', ...parts)
}
export function assertRecordsDigest(
  records: RecordValue[],
  count: number,
  digest: number[],
): void {
  if (records.length !== count || hex(recordsDigest(records)) !== hex(digest))
    throw new Error('Resolver snapshot count/digest mismatch')
}
