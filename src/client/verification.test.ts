import { describe, expect, it } from 'vitest'
import { createDuskDomainsClient } from './client'
import { fakeOnChain, forwardResponse, indexedNameSummary, node } from './client.test-fixtures'
import { namehashHex } from '../core/namehash'

function verifier(height = 99) {
  return createDuskDomainsClient({ onChain: fakeOnChain({
    async getCurrentBlockHeight() { return { ok: true, value: height } },
    async getName() { return { ok: true, value: {
      canonicalName: 'aurora.dusk', node, marketplaceTransferable: true,
      record: { label: 'aurora', owner: 'owner', manager: 'manager', lifecycle: { expiresAtBlock: 100, graceEndsAtBlock: 110 }, referrer: null },
    } } },
    async resolveName(name) { return { ok: true, value: {
      canonicalName: name, node: namehashHex(name), endpoint: { type: 'moonlight_address', value: 'address' },
      record: { key: 'moonlight_address', value: 'address', visibility: 'public', ttlSeconds: 60, updatedAtBlock: 1 },
    } } },
  }) })
}
const indexed = () => indexedNameSummary({ owner: 'owner', manager: 'manager' })

describe('indexed verification guarantees', () => {
  it.each(['owner', 'manager'] as const)('requires %s even while the canonical name is active', async (field) => {
    for (const value of [null, '']) {
      const result = await verifier().verifyIndexedName({ ...indexed(), [field]: value })
      expect(result).toMatchObject({ ok: true, value: { verified: false, source: { kind: 'indexed' }, mismatches: [expect.objectContaining({ field })] } })
    }
  })

  it.each([[99, 'active'], [100, 'expired'], [109, 'expired'], [110, 'released']] as const)('derives lifecycle status at block %s', async (height, status) => {
    const client = verifier(height)
    await expect(client.verifyIndexedName({ ...indexed(), status })).resolves.toMatchObject({ ok: true, value: { verified: true, source: { kind: 'indexed_verified', blockHeight: height } } })
    await expect(client.verifyIndexedName({ ...indexed(), status: status === 'active' ? 'expired' : 'active' })).resolves.toMatchObject({ ok: true, value: { verified: false } })
  })

  it.each([{ node: namehashHex('another.dusk') }, { canonicalName: 'another.dusk' }])('checks indexed identity %j', async (changed) => {
    await expect(verifier().verifyIndexedName({ ...indexed(), ...changed })).resolves.toMatchObject({ ok: true, value: { verified: false } })
  })

  it('requires a current height and an existing canonical record', async () => {
    const client = verifier()
    client.onChain!.getCurrentBlockHeight = async () => ({ ok: false, error: { code: 'lifecycle_unavailable', message: 'No height' } })
    await expect(client.verifyIndexedName(indexed())).resolves.toMatchObject({ ok: false, error: { code: 'lifecycle_unavailable' } })
    client.onChain!.getName = async () => ({ ok: true, value: { canonicalName: 'aurora.dusk', node, marketplaceTransferable: false, record: null } })
    await expect(client.verifyIndexedName(indexed())).resolves.toMatchObject({ ok: true, value: { verified: false } })
  })

  it('binds direct verification to the caller name and recomputed node', async () => {
    const client = verifier()
    await expect(client.verifyIndexedResolution(' Aurora ', forwardResponse('address'))).resolves.toMatchObject({ ok: true, value: { verified: true } })
    for (const response of [
      { ...forwardResponse('address'), canonicalName: 'another.dusk', node: namehashHex('another.dusk') },
      { ...forwardResponse('address'), node: namehashHex('another.dusk') },
      forwardResponse('wrong address'),
    ]) {
      await expect(client.verifyIndexedResolution('aurora.dusk', response)).resolves.toMatchObject({ ok: true, value: { verified: false, source: { kind: 'indexed' } } })
    }
  })
})
