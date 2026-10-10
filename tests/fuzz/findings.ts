import { definitions } from '../../src/frozen/schema.ts'
import { utf8, resolve } from './arbitraries.ts'

// Open findings, each pinned by a failing `finding_*` test. Generic properties
// confirm that the driver still rejects such a value, then repair only that
// aspect and keep checking the rest, so a known finding cannot mask a new one.
// Set FUZZ_REPORT_KNOWN=1 to let the generic properties fail (and shrink) on them.
export interface KnownFinding {
  id: string
  test: string
  applies(role: string, method: string, value: any): boolean
  repair(value: any): any
}
export const reportKnown = process.env.FUZZ_REPORT_KNOWN === '1'

const lone = /[\ud800-\udbff](?![\udc00-\udfff])|(?<![\ud800-\udbff])[\udc00-\udfff]/u
function strings(v: any, visit: (s: string) => boolean): boolean {
  if (typeof v === 'string') return visit(v)
  if (v && typeof v === 'object') return Object.values(v).some(x => strings(x, visit))
  return false
}
function mapStrings(v: any, f: (s: string) => string): any {
  if (typeof v === 'string') return f(v)
  if (Array.isArray(v)) return v.map(x => mapStrings(x, f))
  if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, mapStrings(x, f)]))
  return v
}
const recordPayload = (v: any) => (Array.isArray(v?.mutations) ? v.mutations : [])
  .reduce((n: number, m: any) => n + utf8(String(m?.key ?? '')) + (Array.isArray(m?.value) ? m.value.length : 0), 0)
// MutateRecords and ApplyMutations, also when nested (DelegatedOp::MutateRecords in store.delegated).
function overPayload(v: any): boolean {
  if (!v || typeof v !== 'object') return false
  return (Array.isArray(v.mutations) && recordPayload(v) > 4096) || Object.values(v).some(overPayload)
}
function trimPayload(v: any): any {
  if (!v || typeof v !== 'object') return v
  if (Array.isArray(v)) return v.map(trimPayload)
  const out: any = Object.fromEntries(Object.entries(v).map(([k, x]) => [k, trimPayload(x)]))
  if (!Array.isArray(out.mutations) || recordPayload(out) <= 4096) return out
  let excess = recordPayload(out) - 4096
  out.mutations = [...out.mutations].reverse().map((m: any) => {
    const cut = Math.min(excess, m.value.length)
    excess -= cut
    return { ...m, value: m.value.slice(0, m.value.length - cut) }
  }).reverse()
  return out
}

export const knownFindings: KnownFinding[] = [
  {
    id: 'quote_request_version', test: 'finding_quote_request_version',
    applies: (role, method, v) => role === 'policy' && method === 'quote' && v?.version !== 1,
    repair: v => ({ ...v, version: 1 }),
  },
  {
    id: 'custody_notice_version', test: 'finding_custody_notice_version',
    applies: (role, method, v) => role === 'marketplace' && method === 'on_name_received' && v?.version !== 1,
    repair: v => ({ ...v, version: 1 }),
  },
  {
    id: 'vault_fee_metadata_bound', test: 'finding_vault_fee_metadata_bound',
    applies: (role, method, v) => role === 'vault' && method === 'receive_fee' && typeof v?.data === 'string' && v.data.length > 1024,
    repair: v => ({ ...v, data: v.data.slice(0, 1024) }),
  },
  {
    id: 'record_mutation_payload', test: 'finding_record_mutation_payload',
    applies: (_role, _method, v) => overPayload(v),
    repair: trimPayload,
  },
  {
    id: 'lone_surrogate_strings', test: 'finding_lone_surrogate_strings',
    applies: (_role, _method, v) => strings(v, s => lone.test(s)),
    repair: v => mapStrings(v, s => s.toWellFormed()),
  },
]

/** Apply every matching repair; returns the repaired value and the finding IDs it hit. */
export function repairKnown(role: string, method: string, value: any): { value: any; hits: string[] } {
  const hits: string[] = []
  for (const finding of knownFindings) {
    if (finding.applies(role, method, value)) {
      hits.push(finding.id)
      value = finding.repair(value)
    }
  }
  return { value, hits }
}

/**
 * Reverse direction (finding_driver_serde_spellings): serde also accepts a unit
 * enum variant written as {"Variant": null} and a struct written as a
 * positional array. Rewrite those spellings to the SDK's canonical form; null
 * when the value contains neither.
 */
export function serdeCanonical(type: string, value: unknown): unknown | null {
  let changed = false
  function walk(s: any, v: any): any {
    s = resolve(s)
    if (s.enum && v && typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length === 1) {
      const [key] = Object.keys(v)
      if (v[key] === null && s.enum.includes(key)) { changed = true; return key }
    }
    if (s.oneOf || s.anyOf) {
      const flat = (list: any[]): any[] => list.map(resolve).flatMap((r: any) => (r.oneOf || r.anyOf ? flat(r.oneOf ?? r.anyOf) : [r]))
      const variants = flat(s.oneOf ?? s.anyOf), objects = variants.filter((r: any) => r.type === 'object')
      if (v && typeof v === 'object' && !Array.isArray(v)) {
        const keys = Object.keys(v)
        if (keys.length === 1 && v[keys[0]] === null && variants.some((r: any) => r.const === keys[0] || r.enum?.includes(keys[0]))) {
          changed = true
          return keys[0]
        }
        const match = objects.find((r: any) => Object.keys(r.properties ?? {}).join() === keys.join())
        return match ? walk(match, v) : v
      }
      const match = Array.isArray(v) && objects.find((r: any) => v.length === Object.keys(r.properties ?? {}).length)
      return match ? walk(match, v) : v
    }
    if (s.type === 'object') {
      const keys = Object.keys(s.properties ?? {})
      if (Array.isArray(v) && v.length === keys.length) { changed = true; v = Object.fromEntries(keys.map((k, i) => [k, v[i]])) }
      if (!v || typeof v !== 'object' || Array.isArray(v)) return v
      return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, k in (s.properties ?? {}) ? walk(s.properties[k], x) : x]))
    }
    if (s.type === 'array' && Array.isArray(v)) return v.map(x => walk(s.items, x))
    return v
  }
  const result = walk((definitions as any)[type], value)
  return changed ? result : null
}
