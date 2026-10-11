/** Lossless JSON at driver and node boundaries. @module */
export type JsonValue =
  | null
  | boolean
  | string
  | number
  | bigint
  | JsonValue[]
  | { [key: string]: JsonValue }
export const U64_MAX: bigint = 18_446_744_073_709_551_615n

/** Parse integer tokens without passing unsafe values through Number. Duplicate keys reject. */
export function parseJson(
  text: string,
  options: { canonicalIntegers?: boolean } = {},
): unknown {
  let at = 0
  const fail = (): never => {
    throw new Error(`Invalid JSON at offset ${at}`)
  }
  const space = (): void => {
    while (/[ \t\r\n]/u.test(text[at] ?? '') && at < text.length) at++
  }
  function value(depth: number): unknown {
    if (depth > 64) return fail()
    space()
    if (text[at] === '"') {
      const start = at++
      while (at < text.length) {
        if (text[at++] === '"')
          return JSON.parse(text.slice(start, at)) as string
        if (text[at - 1] === '\\') at++
      }
      return fail()
    }
    if (text[at] === '[') {
      at++
      space()
      const rows: unknown[] = []
      if (text[at] === ']') {
        at++
        return rows
      }
      while (true) {
        rows.push(value(depth + 1))
        space()
        const ch = text[at++]
        if (ch === ']') return rows
        if (ch !== ',') return fail()
      }
    }
    if (text[at] === '{') {
      at++
      space()
      const object: Record<string, unknown> = Object.create(null)
      if (text[at] === '}') {
        at++
        return object
      }
      while (true) {
        space()
        if (text[at] !== '"') return fail()
        const key = value(depth + 1) as string
        if (Object.hasOwn(object, key)) return fail()
        space()
        if (text[at++] !== ':') return fail()
        object[key] = value(depth + 1)
        space()
        const ch = text[at++]
        if (ch === '}') return object
        if (ch !== ',') return fail()
      }
    }
    for (const [word, result] of [
      ['null', null],
      ['true', true],
      ['false', false],
    ] as const) {
      if (text.startsWith(word, at)) {
        at += word.length
        return result
      }
    }
    const token = /^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/u.exec(
      text.slice(at),
    )?.[0]
    if (!token) return fail()
    at += token.length
    if (
      options.canonicalIntegers &&
      (token === '-0' || /[.eE]/u.test(token))
    )
      return fail()
    if (/^-?\d+$/u.test(token)) {
      const n = BigInt(token)
      return n >= BigInt(Number.MIN_SAFE_INTEGER) &&
        n <= BigInt(Number.MAX_SAFE_INTEGER)
        ? Number(n)
        : n
    }
    const n = Number(token)
    if (!Number.isFinite(n)) return fail()
    return n
  }
  const result = value(0)
  space()
  if (at !== text.length) fail()
  return result
}

/** Serialize bigint as an integer token; Lux strings remain strings. */
export function stringifyJson(value: unknown): string {
  const stack = new Set<object>()
  function encode(v: unknown): string {
    if (v === null) return 'null'
    if (typeof v === 'bigint') return v.toString()
    if (typeof v === 'string' || typeof v === 'boolean')
      return JSON.stringify(v)
    if (typeof v === 'number' && Number.isSafeInteger(v)) return String(v)
    if (typeof v !== 'object' || stack.has(v))
      throw new Error('Expected acyclic lossless JSON')
    stack.add(v)
    const out = Array.isArray(v)
      ? `[${v.map(encode).join(',')}]`
      : `{${Object.entries(v)
          .map(([k, x]) => `${JSON.stringify(k)}:${encode(x)}`)
          .join(',')}}`
    stack.delete(v)
    return out
  }
  return encode(value)
}

export function u64(value: unknown): bigint {
  const n =
    typeof value === 'bigint'
      ? value
      : typeof value === 'number' && Number.isSafeInteger(value)
        ? BigInt(value)
        : null
  if (n === null || n < 0n || n > U64_MAX)
    throw new Error('Expected a lossless u64 integer')
  return n
}
export function lux(value: unknown): string {
  if (
    typeof value !== 'string' ||
    !/^\d+$/u.test(value) ||
    BigInt(value) > U64_MAX
  )
    throw new Error('Expected decimal u64 Lux text')
  return BigInt(value).toString()
}
