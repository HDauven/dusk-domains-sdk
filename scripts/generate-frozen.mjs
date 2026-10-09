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
const banner =
  '// Generated from the frozen v1 protocol schemas by scripts/generate-frozen.mjs.\n'
await mkdir(new URL('src/frozen', root), { recursive: true })
await mkdir(new URL('src/indexer/events', root), { recursive: true })
await writeFile(
  new URL('src/frozen/types.ts', root),
  banner +
    '/** Frozen v1 wire types. Lux is decimal text; other u64 values are bigint. @module */\n' +
    'export type Located<T> = "Absent" | { Local: T } | { Forwarded: Forward }\nexport type Event<T> = { version: number; op_seq: bigint; body: T }\n' +
    Object.entries(defs)
      .filter(([k]) => /^[A-Za-z][A-Za-z0-9_]*$/.test(k))
      .map(([k, v]) => `export type ${k} = ${basic(k) ?? ts(v)}\n`)
      .join('') +
    'export interface WireTypes {\n' +
    Object.keys(defs)
      .map((k) => `  ${JSON.stringify(k)}: ${ref(k)}\n`)
      .join('') +
    '}\n' +
    'export interface Methods {\n' +
    Object.entries(catalog.methods)
      .map(
        ([role, methods]) =>
          `  ${role}: {\n${methods.map((m) => `    ${m.name}: { input: ${ref(m.input)}; output: ${ref(m.output)} }`).join('\n')}\n  }`,
      )
      .join('\n') +
    '\n}\n' +
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
    '/** Authoritative frozen v1 event topics, emitter roles and wire schemas. @module */\n' +
    `export const indexerEventCatalog = ${JSON.stringify(catalog.events, null, 2)} as const\nexport type EventTopic = keyof typeof indexerEventCatalog\nexport const duskDomainsIndexedEventTypes: readonly EventTopic[] = Object.keys(indexerEventCatalog) as EventTopic[]\n`,
)
const camel = (s) => s.replace(/_([a-z])/g, (_, l) => l.toUpperCase())
await writeFile(
  new URL('src/frozen/builders.ts', root),
  banner +
    `/** Typed call builders for every frozen v1 entrypoint. @module */\nimport { buildCall, type FrozenCall } from './calls.ts'\nimport type { Methods } from './types.ts'\n` +
    Object.entries(catalog.methods)
      .flatMap(([role, methods]) =>
        methods
          .filter((m) => m.mode === 'write')
          .map(
            (m) =>
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
