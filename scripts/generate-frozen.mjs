import { readFile, writeFile, mkdir } from 'node:fs/promises'
const root = new URL('../', import.meta.url)
const schema = JSON.parse(
  (
    await readFile(new URL('scripts/frozen/definitions.json', root), 'utf8')
  ).replace(/18446744073709551615/g, '"18446744073709551615"'),
)
const catalog = JSON.parse(
  await readFile(new URL('scripts/frozen/catalog.json', root), 'utf8'),
)
const defs = schema.$defs
// These fields are domain revisions only when named below. Every Event<T>
// envelope is also frozen at wire version 1; unrelated fields named `version`
// (governance counters and configuration revisions) remain ordinary integers.
const wireVersionOne = new Set([
  'QuoteRequest',
  'PolicyQuote',
  'CustodyNotice',
  'CustodyAck',
  'FeeMetadata',
  'Interface',
  'MarketWindDown',
])
for (const [name, definition] of Object.entries(defs)) {
  if ((name.startsWith('Event<') || wireVersionOne.has(name)) && definition.properties?.version)
    definition.properties.version = { const: 1 }
}
const basic = (name) =>
  ({
    '()': 'null',
    u8: 'number',
    u16: 'number',
    u32: 'number',
    u64: 'bigint',
    Height: 'bigint',
    bool: 'boolean',
    Lux: 'string',
  })[name]
function ref(name) {
  if (basic(name)) return basic(name)
  if (name.startsWith('Option<')) return `(${ref(name.slice(7, -1))} | null)`
  if (name.startsWith('Vec<')) return `(${ref(name.slice(4, -1))})[]`
  if (name.startsWith('Located<')) return `Located<${ref(name.slice(8, -1))}>`
  if (name.startsWith('Event<')) return `Event<${ref(name.slice(6, -1))}>`
  if (name.startsWith('['))
    return `${ref(name.slice(1, name.indexOf(';')).trim())}[]`
  return name
}
function ts(s) {
  if (s.$ref) return ref(s.$ref.slice(8))
  if (s.enum) return s.enum.map((v) => JSON.stringify(v)).join(' | ')
  if ('const' in s) return JSON.stringify(s.const)
  if (s.oneOf || s.anyOf) return (s.oneOf ?? s.anyOf).map(ts).join(' | ')
  if (s.type === 'object')
    return `{ ${Object.entries(s.properties)
      .map(([k, v]) => `${k}: ${ts(v)}`)
      .join('; ')} }`
  if (s.type === 'array') return `(${ts(s.items)})[]`
  if (s.type === 'integer')
    return typeof s.maximum === 'string' ? 'bigint' : 'number'
  return (
    { string: 'string', boolean: 'boolean', null: 'null' }[s.type] ?? 'never'
  )
}
// One-line docs from the schema and catalog: a type's bounds, then the methods
// that take or return it and the events that carry it, else the types that contain it.
const ident = (name) => /^[A-Za-z][A-Za-z0-9_]*$/.test(name)
const inner = (name) => {
  const wrapped = /^(?:Option|Vec|Located|Event)<(.*)>$/.exec(name)
  if (wrapped) return inner(wrapped[1])
  return name.startsWith('[') ? inner(name.slice(1, name.indexOf(';')).trim()) : name
}
const code = (text) => `\`${text}\``
const and = (items) =>
  items.length < 2 ? items.join('') : `${items.slice(0, -1).join(', ')} and ${items.at(-1)}`
const refsOf = (s, found = new Set()) => {
  if (s.$ref) found.add(inner(s.$ref.slice(8)))
  for (const v of Object.values(s)) if (v && typeof v === 'object') refsOf(v, found)
  return found
}
const parents = {}
for (const [k, v] of Object.entries(defs))
  if (ident(k)) for (const r of refsOf(v)) if (r !== k) (parents[r] ??= []).push(k)
const uses = {}
for (const [role, methods] of Object.entries(catalog.methods))
  for (const m of methods)
    for (const dir of ['input', 'output'])
      (uses[inner(m[dir])] ??= []).push({ dir, exact: ident(m[dir]), role, name: m.name })
// No method, event or other type refers to these, so the catalog cannot say where they appear.
const notes = {
  PaidOperation: 'What a contract pays for through `store.receive_payment`, encoded in its `data`.',
  ErrorCode: 'Error a frozen v1 contract call fails with.',
}
function typeDoc(k, v) {
  const facts = []
  if (v.description) facts.push(v.description)
  else if (v.type === 'integer') facts.push(`Integer from ${v.minimum} to ${v.maximum}.`)
  else if (v.type === 'array' && v.minItems === v.maxItems && v.items.$ref === '#/$defs/u8')
    facts.push(`${v.minItems} bytes.`)
  const shape = facts.length
  for (const [dir, exact] of [['input', true], ['input', false], ['output', true], ['output', false]]) {
    const methods = (uses[k] ?? []).filter((u) => u.dir === dir && u.exact === exact)
    if (methods.length)
      facts.push(`${exact ? `${dir[0].toUpperCase()}${dir.slice(1)} of` : `In the ${dir} of`} ${and(
        methods.map((u) => code(`${u.role}.${u.name}`)),
      )}.`)
  }
  for (const [topic, e] of Object.entries(catalog.events))
    if (inner(e.type) === k)
      facts.push(`${e.type === k ? 'Payload' : 'Body'} of the ${code(topic)} event from ${e.role === '*' ? 'any role' : `the ${e.role}`}.`)
  const p = parents[k] ?? []
  if (facts.length === shape)
    facts.push(notes[k] ?? (p.length
      ? `Part of ${p.length > 4 ? `${p.slice(0, 3).map(code).join(', ')} and ${p.length - 3} more types` : and(p.map(code))}.`
      : 'Not used by any method or event.'))
  return `/** ${facts.join(' ')} */\n`
}
const banner =
  '// Generated from the frozen v1 protocol schemas by scripts/generate-frozen.mjs.\n'
await mkdir(new URL('src/frozen', root), { recursive: true })
await mkdir(new URL('src/indexer/events', root), { recursive: true })
await writeFile(
  new URL('src/frozen/types.ts', root),
  banner +
    '/**\n * Frozen v1 wire types. Lux is decimal text; other u64 values are bigint.\n *\n * @module\n */\n' +
    '/** A store read\'s answer: `Absent`, `Local` with what this store holds, or `Forwarded` to the store the root moved to. */\n' +
    'export type Located<T> = "Absent" | { Local: T } | { Forwarded: Forward }\n' +
    '/** Envelope of every frozen v1 effect event: wire version 1, the `op_seq` of the operation that emitted it, and its body. */\n' +
    'export type Event<T> = { version: 1; op_seq: bigint; body: T }\n' +
    Object.entries(defs)
      .filter(([k]) => ident(k))
      .map(([k, v]) => `${typeDoc(k, v)}export type ${k} = ${basic(k) ?? ts(v)}\n`)
      .join('') +
    '/** Every schema type by its wire name, including instances such as `Option<Node>`, as `wireValue` takes them. */\n' +
    'export interface WireTypes {\n' +
    Object.keys(defs)
      .map((k) => `  ${JSON.stringify(k)}: ${ref(k)}\n`)
      .join('') +
    '}\n' +
    '/** Input and output wire types of every frozen v1 method, by contract role and method name. */\n' +
    'export interface Methods {\n' +
    Object.entries(catalog.methods)
      .map(
        ([role, methods]) =>
          `  ${role}: {\n${methods.map((m) => `    ${m.name}: { input: ${ref(m.input)}; output: ${ref(m.output)} }`).join('\n')}\n  }`,
      )
      .join('\n') +
    '\n}\n' +
    '/** Wire type of every frozen v1 event, by topic. */\n' +
    'export interface EventTypes {\n' +
    Object.entries(catalog.events)
      .map(([topic, e]) => `  ${topic}: ${ref(e.type)}`)
      .join('\n') +
    '\n}\n',
)
await writeFile(
  new URL('src/frozen/schema.ts', root),
  banner +
    `export const definitions: Record<string, unknown> = ${JSON.stringify(defs, null, 2)}\n`,
)
const reads = new Set(
  'controllers controller released_root config registration_context renewal_schedule roles operator_payout_key member members allocation market proposal proposals interface_version binding capacity quote home stats get_name children record_slot read_record read_records resolve_record read_primary resolve_primary pending_commitment commitment_raw quote_registration quote_renewal slot_liveness export_move_row move_status import_status move_cooldowns read_slot_record read_record_slot read_state read_referral referrals source read_balance wind_down_state order_api_version read_order read_refund read_listing read_offer'.split(
    ' ',
  ),
)
const internal = new Set(
  'delegated cede_released init consume_commitment receive_payment write_slot apply_mutations clear_slot set_source receive_fee on_name_received begin_import confirm_move_progress activate_import'.split(
    ' ',
  ),
)
for (const methods of Object.values(catalog.methods))
  for (const m of methods)
    m.mode = m.metadata
      ? 'metadata'
      : reads.has(m.name)
        ? 'read'
        : internal.has(m.name)
          ? 'internal'
          : 'write'
await writeFile(
  new URL('src/frozen/catalog.ts', root),
  banner +
    `export const methodCatalog = ${JSON.stringify(catalog.methods, null, 2)} as const\n`,
)
await writeFile(
  new URL('src/indexer/events/indexerEventCatalog.ts', root),
  banner +
    '/**\n * Every frozen v1 event topic, with the role that emits it and its wire type.\n *\n' +
    ' * Import this entrypoint where only the catalog is needed, such as indexer\n' +
    ' * tooling that routes or checks raw events: it imports nothing else.\n *\n * @module\n */\n' +
    '/** Emitter role and wire type of each topic; role `*` accepts any role. */\n' +
    `export const indexerEventCatalog = ${JSON.stringify(catalog.events, null, 2)} as const\n` +
    '/** A topic name in `indexerEventCatalog`. */\nexport type EventTopic = keyof typeof indexerEventCatalog\n' +
    '/** Every topic in `indexerEventCatalog`, in catalog order. */\n' +
    'export const duskDomainsIndexedEventTypes: readonly EventTopic[] = Object.keys(indexerEventCatalog) as EventTopic[]\n',
)
const camel = (s) => s.replace(/_([a-z])/g, (_, l) => l.toUpperCase())
await writeFile(
  new URL('src/frozen/builders.ts', root),
  banner +
    `/**\n * Typed call builders for every frozen v1 write entrypoint.\n *\n * @module\n */\nimport { buildCall, type FrozenCall } from './calls.ts'\nimport type { Methods } from './types.ts'\n` +
    Object.entries(catalog.methods)
      .flatMap(([role, methods]) =>
        methods
          .filter((m) => m.mode === 'write')
          .map(
            (m) =>
              `/** Build a ${code(`${role}.${m.name}`)} call to \`target\` with \`buildCall\`. */\n` +
              `export function ${role}${camel('_' + m.name)}Call(target: string, args: Methods['${role}']['${m.name}']['input']): FrozenCall<'${role}', '${m.name}'> { return buildCall('${role}', target, '${m.name}', args) }\n`,
          ),
      )
      .join(''),
)
await writeFile(
  new URL('src/frozen/read-types.ts', root),
  banner +
    `export interface ReadMethods {\n` +
    Object.entries(catalog.methods)
      .map(
        ([role, methods]) =>
          `  ${role}: ${methods
            .filter((m) => m.mode === 'read')
            .map((m) => JSON.stringify(m.name))
            .join(' | ')}`,
      )
      .join('\n') +
    '\n}\n',
)
