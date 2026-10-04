import { afterEach, describe, expect, it, vi } from 'vitest'
import { createDuskDomainsConnectApp } from '@duskdomains/sdk/connect-app'
import {
  coreRenewRuntimeCall,
  DUSK_DOMAIN_MAX_AUTO_GAS_PRICE,
  DUSK_DOMAINS_CONTRACTS,
  prepareDuskDomainContractCall,
  submitDuskDomainWrite,
  writeDuskDomainContract,
  type DuskDomainGas,
} from '../writes'

const contracts = { ...DUSK_DOMAINS_CONTRACTS, core: { ...DUSK_DOMAINS_CONTRACTS.core, contractId: `0x${'11'.repeat(32)}` } }
const call = coreRenewRuntimeCall({ node: `0x${'12'.repeat(32)}`, durationYears: 1, feeLux: 50_000_000_000 })

afterEach(() => vi.useRealTimers())

function fixture(path: 'direct' | 'request', estimate: () => Promise<unknown> = async () => ({ average: '8', max: '20', median: '7', min: '2' })) {
  const prepared = { contractId: contracts.core.contractId, fnName: call.functionName, fnArgs: '0x1234', gas: { limit: '500000000', price: '99' } }
  const send = vi.fn(async (_params: unknown) => ({ status: 'executed' }))
  const request = vi.fn(async ({ method, params }: { method: string; params?: unknown }) => {
    if (method === 'dusk_estimateGas') return await estimate()
    if (method === 'dusk_prepareContractCall') return prepared
    if (method === 'dusk_sendTransaction') return await send(params)
    throw new Error(`Unexpected method ${method}`)
  })
  const transport = {
    chainId: 'dusk:3', request,
    ...(path === 'direct' ? { prepareContractCall: async () => prepared, writeContract: send } : {}),
  }
  const app = createDuskDomainsConnectApp(transport)
  return { app, send, request, transport }
}

describe.each(['direct', 'request'] as const)('gas on the %s write path', path => {
  it.each([{ limit: 10_000_000n, price: 3n }, { limit: '10000000', price: '3' }])('forwards explicit gas as decimal strings through writeDuskDomainContract: %s', async gas => {
    const { app, send, request } = fixture(path)
    const prepared = await prepareDuskDomainContractCall(app, call, contracts)
    await writeDuskDomainContract(app, call, prepared, contracts, gas)
    expect(send).toHaveBeenCalledWith(expect.objectContaining({ gas: { limit: '10000000', price: '3' }, deposit: '50000000000' }))
    expect(request).not.toHaveBeenCalledWith(expect.objectContaining({ method: 'dusk_estimateGas' }))
  })

  it.each([
    ['median', { average: '8', max: '20', median: '7', min: '2' }, '7'],
    ['numeric median', { median: 4 }, '4'],
    ['bigint median', { median: 4n }, '4'],
    ['cap boundary', { median: '10' }, '10'],
    ['above cap', { median: '11' }, '10'],
    ['deployment median', { median: '2000' }, '10'],
    ['numeric deployment median', { median: 2000 }, '10'],
    ['bigint deployment median', { median: 2000n }, '10'],
    ['maximum u64', { median: '18446744073709551615' }, '10'],
    ['maximum safe number', { median: Number.MAX_SAFE_INTEGER }, '10'],
    ['unsafe numeric median', { median: Number.MAX_SAFE_INTEGER + 1 }, '1'],
    ['out-of-u64 string', { median: '18446744073709551616' }, '1'],
    ['out-of-u64 bigint', { median: 18_446_744_073_709_551_616n }, '1'],
    ['zero median', { median: '0' }, '1'],
    ['negative median', { median: '-2' }, '1'],
    ['fraction below one', { median: 0.5 }, '1'],
    ['fraction above one', { median: 2.5 }, '1'],
    ['fraction string', { median: '2.5' }, '1'],
    ['nonfinite median', { median: Infinity }, '1'],
    ['NaN median', { median: NaN }, '1'],
    ['hex string', { median: '0x10' }, '1'],
    ['boolean median', { median: true }, '1'],
    ['missing median', {}, '1'],
    ['invalid median', { median: 'invalid' }, '1'],
  ])('resolves the %s through submitDuskDomainWrite', async (_label, stats, price) => {
    const { app, send, request } = fixture(path, async () => stats)
    expect(await submitDuskDomainWrite(app, call, { contracts, gas: { limit: 10_000_000n } })).toMatchObject({ status: 'executed' })
    expect(send).toHaveBeenCalledWith(expect.objectContaining({ gas: { limit: '10000000', price } }))
    expect(request).toHaveBeenCalledWith({ method: 'dusk_estimateGas', params: {} })
  })

  it.each([0n, 2000n, '2000', 18_446_744_073_709_551_615n, '18446744073709551615'])('keeps an explicit u64 price uncapped: %s', async price => {
    const { app, send, request } = fixture(path)
    expect(await submitDuskDomainWrite(app, call, { contracts, gas: { limit: 10_000_000n, price } })).toMatchObject({ status: 'executed' })
    expect(send).toHaveBeenCalledWith(expect.objectContaining({ gas: { limit: '10000000', price: String(price) } }))
    expect(request).not.toHaveBeenCalledWith(expect.objectContaining({ method: 'dusk_estimateGas' }))
  })

  it.each([-1n, '-1', '18446744073709551616', 18_446_744_073_709_551_616n, '2.5', '', '0x10', true, null, Number.MAX_SAFE_INTEGER + 1, 2.5, Infinity])('rejects an invalid explicit price before sending: %s', async price => {
    const { app, send, request } = fixture(path)
    expect(await submitDuskDomainWrite(app, call, { contracts, gas: { limit: 10_000_000n, price: price as DuskDomainGas['price'] } })).toMatchObject({ status: 'failed', message: 'Gas price must be a u64 integer.' })
    expect(send).not.toHaveBeenCalled()
    expect(request).not.toHaveBeenCalledWith(expect.objectContaining({ method: 'dusk_estimateGas' }))
  })

  it('falls back when the price request fails', async () => {
    const { app, send } = fixture(path, async () => { throw new Error('Unavailable') })
    expect(await submitDuskDomainWrite(app, call, { contracts, gas: { limit: 10_000_000n } })).toMatchObject({ status: 'executed' })
    expect(send).toHaveBeenCalledWith(expect.objectContaining({ gas: { limit: '10000000', price: '1' } }))
  })

  it('sends after a one-second price timeout and ignores late prices', async () => {
    vi.useFakeTimers()
    let resolve!: (value: unknown) => void
    const { app, send } = fixture(path, () => new Promise(done => { resolve = done }))
    const pending = submitDuskDomainWrite(app, call, { contracts, gas: { limit: 10_000_000n } })
    await vi.advanceTimersByTimeAsync(999)
    expect(send).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(1)
    expect(await pending).toMatchObject({ status: 'executed' })
    expect(send).toHaveBeenCalledWith(expect.objectContaining({ gas: { limit: '10000000', price: '1' } }))
    resolve({ median: '9' })
    await vi.advanceTimersByTimeAsync(0)
    expect(send).toHaveBeenCalledOnce()
    expect(vi.getTimerCount()).toBe(0)
  })

  it('checks the prepared chain after the price lookup', async () => {
    const { app, send, transport } = fixture(path, async () => { transport.chainId = 'dusk:2'; return { median: '3' } })
    expect(await submitDuskDomainWrite(app, call, { contracts, gas: { limit: 10_000_000n } })).toMatchObject({ status: 'failed', message: expect.stringContaining('changed after preparation') })
    expect(send).not.toHaveBeenCalled()
  })
})

it('exports the automatic gas price cap', () => {
  expect(DUSK_DOMAIN_MAX_AUTO_GAS_PRICE).toBe(10n)
})

it('uses the Dusk Connect app wallet for gas price requests', async () => {
  const request = vi.fn(async () => ({ average: '8', max: '20', median: '7', min: '2' }))
  const writeContract = vi.fn(async () => ({}))
  const app = createDuskDomainsConnectApp({ wallet: { request }, writeContract })
  await app.writeContract({ contract: contracts.core, functionName: 'renew_runtime', gas: { limit: 10_000_000n } })
  expect(request).toHaveBeenCalledWith('dusk_estimateGas', {})
  expect(writeContract).toHaveBeenCalledWith(expect.objectContaining({ gas: { limit: '10000000', price: '7' } }))
})

it.each([undefined, { limit: 10_000_000n }] satisfies Array<DuskDomainGas | undefined>)('keeps direct writes working without a price request transport: %s', async gas => {
  const writeContract = vi.fn(async () => ({}))
  const app = createDuskDomainsConnectApp({ writeContract })
  await app.writeContract({ contract: contracts.core, functionName: 'renew_runtime', ...(gas ? { gas } : {}) })
  const params = writeContract.mock.calls[0][0]
  if (gas) expect(params).toMatchObject({ gas: { limit: '10000000', price: '1' } })
  else expect(params).not.toHaveProperty('gas')
})
