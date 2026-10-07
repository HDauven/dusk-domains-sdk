import { it, expect } from 'vitest'
import * as builders from '../src/frozen/builders.ts'
import { methodCatalog } from '../src/frozen/catalog.ts'
import { wireValue } from '../src/frozen/wire.ts'
import { stringifyJson } from '../src/frozen/json.ts'
import { buildCall, type FrozenCall } from '../src/frozen/calls.ts'
import { GAS_LIMITS } from '../src/frozen/gas.ts'
import { fixtures, release, id, bytes } from './helpers.ts'
import {
  createMarketplaceCalls,
  registrationCalls,
  transferCall,
} from '../src/frozen/actions.ts'
import { createDuskDomainsConnectApp } from '../src/wallet/duskConnectApp.ts'
import type { ContractRole } from '../src/frozen/manifest.ts'
import type {
  Order,
  CustodyIntent,
  RegistrationQuote,
  NameRef,
  CreateSubname,
} from '../src/frozen/types.ts'
const rows = { ...fixtures(), ...fixtures('market-v1') }
function input(type: string): unknown {
  const row = Object.values(rows).find((r) => r.type === type)
  if (!row) throw new Error(type)
  return wireValue(type, row.json)
}
for (const [role, methods] of Object.entries(methodCatalog))
  for (const m of methods.filter((m) => m.mode === 'write')) {
    it(`${role}.${m.name}: builder, real driver, exact deposit and gas`, async () => {
      const r = await release(),
        target = r.manifest.contracts.find((c) => c.role === role)!.contractId
      const name = role + '_' + m.name
      const fn =
        name.replace(/_([a-z])/gu, (_, x: string) => x.toUpperCase()) + 'Call'
      const args = input(m.input),
        call = (
          builders as unknown as Record<
            string,
            (target: string, args: unknown) => FrozenCall
          >
        )[fn](target, args)
      const driver = r.drivers.get(target)!,
        encoded = driver.encodeInput(m.name, stringifyJson(call.args))
      expect(wireValue(m.input, driver.decodeInput(m.name, encoded))).toEqual(
        args,
      )
      expect(call.gasLimit).toBeLessThanOrEqual(GAS_LIMITS[`${role}.${m.name}`])
      expect(call.gasLimit).toBeGreaterThan(0n)
      expect(call.gasLimit).toBeLessThanOrEqual(3_000_000_000n)
      let deposit = '0'
      const a = args as any
      if (role === 'store' && ['register', 'renew'].includes(m.name))
        deposit = a.expected_fee_lux
      if (m.name === 'buy_fixed') deposit = a.order.terms.amount_lux
      if (m.name === 'place_bid') deposit = a.amount_lux
      if (m.name === 'place_offer') deposit = a.terms.amount_lux
      if (m.name === 'renew_escrow') deposit = a.renewal.expected_fee_lux
      expect(call.deposit).toBe(deposit)
      expect(Object.isFrozen(call.args)).toBe(true)
    })
  }
it('gas table covers exactly the public wallet actions', () => {
  expect(Object.keys(GAS_LIMITS).sort()).toEqual(
    Object.entries(methodCatalog)
      .flatMap(([r, ms]) =>
        ms.filter((m) => m.mode === 'write').map((m) => `${r}.${m.name}`),
      )
      .sort(),
  )
  expect(GAS_LIMITS['store.finalize_move']).toBe(2_000_000_000n)
})
it('reserves subtree cleanup when creating a subname without reading its old state', () => {
  const args = input('CreateSubname') as CreateSubname
  for (const expires_at of [100n, 1_000_000n]) {
    const reviewed = { ...args, expires_at }
    const call = builders.storeCreateSubnameCall(id(4), reviewed)
    // An expired child may retain 255 descendants and their primaries. Its
    // small creation input cannot distinguish that case from a fresh child.
    expect(call.gasLimit).toBe(20_000_000n)
    expect(call.args).toEqual(reviewed)
  }
})
it('reserves full stored-proposal scans even for repeated or absent pruning IDs', () => {
  const proposal = { operator_epoch: 1n, nonce: 999n }
  for (const [count, budget] of [[0, 5n], [1, 9n], [16, 69n], [64, 261n]] as const) {
    const ids = Array(count).fill(proposal)
    const call = builders.directoryPruneProposalsCall(id(1), { ids })
    expect(call.gasLimit).toBe(budget * 1_000_000n)
    expect(call.args.ids).toEqual(ids)
  }
  expect(builders.directoryAcceptOperatorCall(id(1), { id: proposal }).gasLimit).toBe(20_000_000n)
  expect(builders.directoryAcceptGuardianCall(id(1), { id: proposal }).gasLimit).toBe(16_000_000n)
  expect(builders.directoryCancelCall(id(1), { id: proposal }).gasLimit).toBe(12_000_000n)
  expect(builders.directoryExecuteCall(id(1), { id: proposal }).gasLimit).toBe(16_000_000n)
})
it('never submits callbacks or fabricated gas/deposit', async () => {
  expect(() =>
    buildCall(
      'store',
      id(4),
      'activate_import' as never,
      { id: bytes(1) } as never,
    ),
  ).toThrow()
  const r = await release(),
    app = createDuskDomainsConnectApp(
      {
        request: async (method) =>
          method === 'dusk_chainId' ? 'dusk:1' : { median: '2' },
      },
      r,
    )
  const call = buildCall('store', id(4), 'commit', { hash: bytes(1) })
  await expect(app.prepare({ ...call, deposit: '1' })).rejects.toThrow(
    'modified',
  )
  await expect(app.prepare({ ...call, gasLimit: 1n })).rejects.toThrow(
    'modified',
  )
})
it('wallet submits public calls with raw verified-driver bytes, exact deposit, zero amount and capped gas price', async () => {
  const r = await release(),
    sent: unknown[] = []
  const app = createDuskDomainsConnectApp(
    {
      request: async (method, params) => {
        if (method === 'dusk_chainId') return 'dusk:1'
        if (method === 'dusk_estimateGas') return { median: '2000' }
        if (method === 'dusk_getPublicBalance')
          return { value: '18446744073709551615' }
        sent.push(params)
        return { hash: 'abc' }
      },
    },
    r,
  )
  const call = buildCall('store', id(4), 'register', {
    ...(input('Register') as any),
    expected_fee_lux: '123',
  })
  await app.submit(call)
  expect(sent[0]).toMatchObject({
    kind: 'contract_call',
    privacy: 'public',
    amount: '0',
    deposit: call.deposit,
    gas: { limit: call.gasLimit.toString(), price: '10' },
  })
  expect((sent[0] as any).fnArgs).toMatch(/^0x[0-9a-f]+$/u)
})
it('wallet chain switch between preparation and submission rejects', async () => {
  const r = await release()
  let checks = 0
  const app = createDuskDomainsConnectApp(
    {
      request: async (method) =>
        method === 'dusk_chainId'
          ? ++checks < 3
            ? 'dusk:1'
            : 'dusk:2'
          : { median: '1' },
    },
    r,
  )
  await expect(
    app.submit(buildCall('store', id(4), 'commit', { hash: bytes(1) })),
  ).rejects.toThrow('dusk:1')
})
it('list, auction and accept use marketplace-encoded custody intent bound to the reviewed terms/nonce', async () => {
  const r = await release(),
    market = createMarketplaceCalls(id(6), id(1), r.drivers.get(id(6))!)
  const intent = input('CustodyIntent') as CustodyIntent
  intent.terms.directory = bytes(1)
  intent.terms.store = bytes(4)
  intent.terms.name.key.node = [...intent.terms.name.key.root]
  for (const kind of ['Fixed', 'Auction'] as const) {
    const reviewed = structuredClone(intent)
    reviewed.terms.kind = kind
    const call =
      kind === 'Fixed' ? market.listFixed(reviewed) : market.auction(reviewed)
    expect(call.contractId).toBe(id(4))
    expect(call.args.target).toEqual(bytes(6))
    expect(
      wireValue(
        'CustodyIntent',
        r.drivers
          .get(id(6))!
          .decodeInput('custody_intent', Uint8Array.from(call.args.data)),
      ),
    ).toEqual(reviewed)
  }
  const order = input('Order') as Order
  order.terms = structuredClone(intent.terms)
  order.terms.kind = 'Offer'
  order.status = 'Open'
  const call = market.acceptOffer(order, 22n, 999n)
  expect(
    wireValue(
      'CustodyIntent',
      r.drivers
        .get(id(6))!
        .decodeInput('custody_intent', Uint8Array.from(call.args.data)),
    ),
  ).toEqual({ terms: order.terms, nonce: 22n, valid_until: 999n })
  order.terms.directory = bytes(2)
  expect(() => market.acceptOffer(order, 22n, 999n)).toThrow('reviewed')
})
it('transfer exposes clear_records and registration preserves original commitment shard/referrer', () => {
  const ref = input('NameRef') as NameRef
  expect(
    transferCall(id(4), {
      name: ref,
      owner: bytes(1),
      manager: bytes(2),
      clear_records: true,
    }).args.clear_identity,
  ).toBe(true)
  const quote = input('RegistrationQuote') as RegistrationQuote
  quote.total_lux = (
    BigInt(quote.quote.base_lux) + BigInt(quote.quote.premium_lux)
  ).toString()
  quote.quote.base_lux = '10'
  quote.quote.premium_lux = '5'
  quote.total_lux = '15'
  quote.quote.label_status = 'Public'
  quote.quote.registration_open = true
  const calls = registrationCalls(id(8), {
    actor: bytes(1),
    label: 'example',
    years: 1,
    secret: bytes(3),
    commitmentStore: id(4),
    commitHeight: 100n,
    quote,
    referrer: { kind: 'Contract', bytes: bytes(9) },
  })
  expect(calls.commit.contractId).toBe(id(4))
  expect(calls.reveal.contractId).toBe(id(8))
  expect(calls.reveal.deposit).toBe('15')
  expect(calls.reveal.args.commitment_store).toEqual(bytes(4))
  expect(calls.reveal.args.referrer).toEqual({
    kind: 'Contract',
    bytes: bytes(9),
  })
})

it('preserves admission reserves and sizes bounded wallet inputs', () => {
  const records = Array.from({ length: 16 }, (_, i) => ({
    key: `key${i}`.padEnd(64, 'a'), value: bytes(1, 512), ttl_seconds: 86400n,
  }))
  const registration = input('Register') as any
  expect(buildCall('store', id(4), 'register', { ...registration, records: [], referrer: null }).gasLimit).toBe(80_000_000n)
  expect(buildCall('store', id(4), 'register', { ...registration, records }).gasLimit).toBe(164_000_000n)
  const name = input('NameRef') as NameRef
  expect(buildCall('store', id(4), 'replace_records', { name, records }).gasLimit).toBe(40_000_000n)
  const mutations = records.slice(0, 8).map(r => ({ ...r, action: 'Set' as const, value: bytes(1, 448) }))
  expect(buildCall('store', id(4), 'mutate_records', { name, mutations }).gasLimit).toBe(39_000_000n)
  const custody = buildCall('store', id(4), 'transfer_and_call', { name, target: bytes(6), callback_gas: 500_000_000n, data: [] })
  expect(custody.gasLimit).toBe(615_000_000n)
  expect(custody.args.callback_gas).toBe(500_000_000n)
  expect(custody.gasLimit * 93n * 93n / 10000n).toBeGreaterThan(510_000_000n)
  const fullTakeback = buildCall('store', id(4), 'take_back_subnames', { ancestor: name, targets: Array(256).fill(name), owner: bytes(11), manager: bytes(12) })
  expect(fullTakeback.gasLimit).toBe(77_000_000n)
  expect(buildCall('store', id(4), 'finalize_move', { id: bytes(3) }).gasLimit * 93n * 93n / 10000n).toBeGreaterThan(1_650_000_000n)
})
