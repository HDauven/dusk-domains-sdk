/**
 * The read lens's v1 ABI: its exports and strict schemas for its arguments and replies, transcribed
 * from the lens crate's `abi.rs` and `driver.rs`. Data only, so `wire.ts` can resolve it. Internal: no
 * package entrypoint exports it.
 * @module
 */
/** The lens's exports, as its driver's `get_schema` lists them. */
export const lensCatalog = [
  { name: 'init', input: 'InitLens', output: '()', mode: 'internal' },
  { name: 'binding', input: '()', output: 'Binding', mode: 'read' },
  { name: 'lens_interface', input: '()', output: 'LensInterface', mode: 'read' },
  { name: 'resolve', input: 'ResolveArgs', output: 'LensReply<Resolution>', mode: 'read' },
  { name: 'reverse', input: 'ReverseArgs', output: 'LensReply<Reverse>', mode: 'read' },
  { name: 'name_page', input: 'NamePageArgs', output: 'LensReply<NamePage>', mode: 'read' },
  { name: 'availability', input: 'AvailabilityArgs', output: 'LensReply<Availability>', mode: 'read' },
  { name: 'bootstrap', input: '()', output: 'LensReply<Bootstrap>', mode: 'read' },
  { name: 'pricing', input: '()', output: 'LensReply<Pricing>', mode: 'read' },
] as const
export type LensMethod = Exclude<(typeof lensCatalog)[number]['name'], 'init'>
/** What `lens_interface` must answer: lens ABI v1 and the frozen pool's bounds. */
export const LENS_INTERFACE = { version: 1, max_stores: 64, max_hops: 63, max_record_keys: 16 }

const ref = (name: string) => ({ $ref: `#/$defs/${name}` })
const struct = (properties: Record<string, unknown>) => ({
  type: 'object',
  additionalProperties: false,
  required: Object.keys(properties),
  properties,
})
const list = (items: unknown, maxItems: number) => ({ type: 'array', maxItems, items })
const text = (bytes: number) => ({ type: 'string', maxLength: bytes, 'x-max-utf8-bytes': bytes })
const option = (name: string) => ({ anyOf: [{ type: 'null' }, ref(name)] })
const units = (...names: string[]) => ({ oneOf: names.map((name) => ({ const: name })) })
const tagged = (tag: string, schema: unknown) => ({
  type: 'object',
  required: [tag],
  additionalProperties: false,
  properties: { [tag]: schema },
})
const reply = (name: string) => ({ oneOf: [tagged('Ok', ref(name)), tagged('Refused', ref('Refusal'))] })
const height = ref('Height'),
  consulted = ref('Evidence'),
  forwards = list(ref('Forward'), 63)
/**
 * Lens v1 wire types, transcribed from the lens crate's `abi.rs` with the frozen JSON rules (decimal
 * Lux, explicit nulls, no unknown fields). Frozen types are referenced, never redefined.
 */
export const lensDefinitions: Record<string, unknown> = {
  InitLens: struct({ directory: ref('Contract') }),
  LensInterface: struct({
    version: ref('u16'), max_stores: ref('u16'), max_hops: ref('u16'), max_record_keys: ref('u16'),
  }),
  ResolveArgs: struct({ name: text(260), record_keys: list(text(64), 16), hint: option('Contract') }),
  ReverseArgs: struct({ endpoint: ref('Endpoint'), hint: option('Contract') }),
  NamePageArgs: struct({ name: text(260), hint: option('Contract') }),
  AvailabilityArgs: struct({ label: text(63), years: ref('u8'), actor: ref('Authority') }),
  NameStatus: units('Absent', 'Active', 'Grace', 'Released', 'Expired'),
  Evidence: struct({ stores: list(ref('Admission'), 64), resolvers: list(ref('Admission'), 64) }),
  PolicyEvidence: struct({
    policy: ref('Contract'), policy_version: ref('u64'), binding: ref('Binding'), config: ref('PolicyConfig'),
  }),
  Resolution: struct({
    height, key: ref('NameKey'), store: ref('Contract'), forwards, name: ref('Located<NameView>'),
    status: ref('NameStatus'), records: list(option('RecordValue'), 16), consulted,
  }),
  VerifiedPrimary: struct({ store: ref('Contract'), primary: ref('PrimaryView'), record: ref('RecordValue') }),
  Reverse: struct({ height, endpoint: ref('Endpoint'), primary: option('VerifiedPrimary'), consulted }),
  PrimaryStatus: struct({
    endpoint: option('Endpoint'), verified: option('VerifiedPrimary'), is_primary: ref('bool'), refused: option('Refusal'),
  }),
  RenewalInputs: struct({
    schedule: ref('RenewalSchedule'), annual_lux: ref('Lux'), referral: ref('bool'), max_years: ref('u8'),
  }),
  NamePage: struct({
    height, key: ref('NameKey'), store: ref('Contract'), forwards, name: ref('Located<NameView>'),
    status: ref('NameStatus'), records: option('RecordsView'), primary: ref('PrimaryStatus'),
    renewal: option('RenewalInputs'), consulted,
  }),
  Placement: struct({
    store: ref('Contract'), canonical_store: option('Contract'), released_root: option('ReleasedRoot'),
  }),
  Registrable: struct({ placement: ref('Placement'), request: ref('QuoteRequest'), quote: ref('RegistrationQuote') }),
  AvailabilityStatus: {
    oneOf: [
      tagged('Registered', struct({ store: ref('Contract'), name: ref('NameView') })),
      tagged('Registrable', ref('Registrable')),
    ],
  },
  Availability: struct({
    height, node: ref('Node'), context: ref('RegistrationContext'), status: ref('AvailabilityStatus'),
    consulted, policy: option('PolicyEvidence'),
  }),
  Pricing: struct({ height, context: ref('RegistrationContext'), policy: ref('PolicyEvidence') }),
  MarketView: struct({ market: ref('Market'), order_api_version: ref('u16') }),
  Bootstrap: struct({
    height, config: ref('DirectoryConfig'), allocation: ref('DirectoryAllocationReturn'),
    stores: list(ref('Admission'), 64), resolvers: list(ref('Admission'), 64), market: option('MarketView'),
  }),
  LensError: units(
    'InvalidName', 'InvalidArgument', 'ReadFailed', 'InvalidMembership', 'UnadmittedStore', 'InvalidForward',
    'HopLimit', 'ContractMismatch', 'InconsistentStore', 'StagedImport', 'MultipleHomes',
    'ForwardNotTerminating', 'NoSuccessor', 'NewestUnavailable', 'NewestSealed', 'LineageChanged',
    'MultiplePrimaries', 'PrimarySpellingMismatch', 'UnadmittedMarket', 'UnadmittedResolver', 'QuoteRefused',
    'GasBudget',
  ),
  Refusal: struct({ code: ref('LensError'), contract: option('Contract'), cause: option('ErrorCode'), height }),
  'LensReply<Resolution>': reply('Resolution'),
  'LensReply<Reverse>': reply('Reverse'),
  'LensReply<NamePage>': reply('NamePage'),
  'LensReply<Availability>': reply('Availability'),
  'LensReply<Bootstrap>': reply('Bootstrap'),
  'LensReply<Pricing>': reply('Pricing'),
}
