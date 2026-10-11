import { definitions } from '../../src/frozen/schema.ts'
import { resolve } from './arbitraries.ts'

// Fixed findings leave this compatibility hook empty. Keeping it makes saved
// fuzz-campaign code and metrics stable while regressions fail immediately.
export interface KnownFinding {
  id: string
  test: string
  applies(role: string, method: string, value: any): boolean
  repair(value: any): any
}
export const reportKnown = process.env.FUZZ_REPORT_KNOWN === '1'
export const knownFindings: KnownFinding[] = []

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
 * Compatibility probe for serde-only spellings: rewrite a unit enum written as
 * {"Variant": null} or a positional struct to canonical form; return null when
 * the value contains neither. Current frozen drivers reject both spellings.
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
