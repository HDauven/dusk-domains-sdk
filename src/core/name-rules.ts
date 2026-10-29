/**
 * `.dusk` names as people type them, without hashing: the label rule and the rules an app applies to
 * typed input. `./names` loads this module and `core/names.ts`, neither of which hashes. @module
 */
/** A canonical label: 1 to 63 lowercase ASCII letters, digits and inner hyphens. */
const LABEL = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/u
/** Throw unless `label` is canonical: 1 to 63 lowercase ASCII letters, digits and inner hyphens. */
export function validateLabel(label: string): void {
  if (!LABEL.test(label)) throw new Error('Expected a canonical 1–63 byte ASCII label')
}
/** `value` trimmed, with ASCII capitals in lower case and every other character as it is. */
export const lowered = (value: string): string =>
  value.trim().replace(/[A-Z]/gu, (c) => c.toLowerCase())
/**
 * Whether typed input is meant as a `.dusk` name rather than an address: once trimmed, it ends in
 * `.dusk`, in any case, and is not a `dusk:` payment link. An address never holds a dot. The name may
 * still be invalid; `nameProblem` says why.
 */
export function isDuskName(input: string): boolean {
  const text = String(input ?? '').trim()
  return /\.dusk$/iu.test(text) && !/^dusk:/iu.test(text)
}
/**
 * What is wrong with a typed `.dusk` name, the first that applies: `empty` (nothing typed), `suffix`
 * (no `.dusk` at the end), `characters` (a label holds something other than a–z, 0–9 and hyphens),
 * `hyphen` (a label starts or ends with one), `length` (a label is empty or over 63 characters) or
 * `depth` (more than three subname labels).
 */
export type NameProblem = 'empty' | 'suffix' | 'characters' | 'hyphen' | 'length' | 'depth'
const isLabel = (label: string): boolean => LABEL.test(label)
/**
 * What is wrong with typed input as a `.dusk` name, or null when it is one: trimmed and with ASCII
 * capitals in lower case, it ends in `.dusk` and `validateName` accepts it.
 */
export function nameProblem(input: string): NameProblem | null {
  const name = lowered(String(input ?? ''))
  if (!name) return 'empty'
  const labels = name.split('.')
  if (labels.length < 2 || labels.at(-1) !== 'dusk') return 'suffix'
  const invalid = labels.filter((label) => !isLabel(label))
  if (invalid.some((label) => /[^a-z0-9-]/u.test(label))) return 'characters'
  if (invalid.some((label) => /^-|-$/u.test(label))) return 'hyphen'
  if (invalid.length) return 'length'
  return labels.length > 5 ? 'depth' : null
}
/**
 * The name typed input means, in canonical form, such as `alice.dusk` for ` Alice.DUSK `: null unless
 * `nameProblem` finds nothing wrong with it.
 */
export function toDuskName(input: string): string | null {
  const name = lowered(String(input ?? ''))
  return nameProblem(name) === null ? name : null
}
/**
 * The `.dusk` name that input typed without its ending, or with dots after it, likely means: `alice`,
 * `alice.` and `alice.dusk.` mean `alice.dusk`. Nothing is looked up. Null for anything that cannot be
 * a name, and for what reads as an address: a capital after the first character, or `0x` and hex.
 */
export function asDuskName(input: string): string | null {
  const typed = String(input ?? '').trim().replace(/\.+$/u, '')
  if (!typed || /[A-Z]/u.test(typed.slice(1)) || /^0x[0-9a-f]*$/iu.test(typed)) return null
  const labels = lowered(typed).split('.')
  const named = labels.at(-1) === 'dusk' ? labels.slice(0, -1) : labels
  const name = `${named.join('.')}.dusk`
  return named.length && nameProblem(name) === null ? name : null
}
/**
 * Edits between two strings, a letter added, removed or changed, or two neighbours swapped, each one
 * edit.
 */
function editDistance(a: string, b: string): number {
  const rows: number[][] = Array.from({ length: a.length + 1 }, (_, i) => [i])
  for (let j = 1; j <= b.length; j++) rows[0][j] = j
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++) {
      const swapped =
        i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]
          ? rows[i - 2][j - 2] + 1
          : Infinity
      rows[i][j] = Math.min(
        rows[i - 1][j] + 1,
        rows[i][j - 1] + 1,
        rows[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
        swapped,
      )
    }
  return rows[a.length][b.length]
}
/**
 * The known name closest to a typed `.dusk` name, to suggest when the typed one is not registered:
 * one or two edits away (one for a name of four characters or fewer before `.dusk`), the first of the
 * closest in `known`'s order, and never the typed name itself or one that is not a valid name.
 * Nothing is looked up.
 */
export function closeDuskName(typed: string, known: Iterable<string>): string | null {
  const label = (name: string) => lowered(String(name ?? '')).replace(/\.dusk$/u, '')
  const want = label(typed)
  if (!want) return null
  let best: string | null = null,
    bestEdits = (want.length <= 4 ? 1 : 2) + 1
  for (const name of known) {
    const have = label(name)
    if (!have || have === want || nameProblem(`${have}.dusk`) !== null) continue
    const edits = editDistance(want, have)
    if (edits < bestEdits) {
      best = have
      bestEdits = edits
    }
  }
  return best ? `${best}.dusk` : null
}
/**
 * A label that reads as key material rather than a name: `0x` and hex, as a contract ID, or 16 or
 * more letters and digits with both among them, as the start of an account or address.
 */
const keyLike = (label: string): boolean =>
  /^0x[0-9a-f]*$/u.test(label) ||
  (label.length >= 16 && /^[a-z0-9]+$/u.test(label) && /[0-9]/u.test(label) && /[a-z]/u.test(label))
/**
 * A verified name as it may be shown beside an account: `name` when it is a canonical `.dusk` name of
 * at most `maxLength` characters (24 by default) none of whose labels reads like an account, address or
 * contract ID; null otherwise. A longer name is left out rather than cut short, as the part cut off
 * could be what tells it apart.
 */
export function nameToShow(name: unknown, maxLength = 24): string | null {
  if (typeof name !== 'string' || name.length > maxLength || toDuskName(name) !== name) return null
  return name.split('.').some(keyLike) ? null : name
}
