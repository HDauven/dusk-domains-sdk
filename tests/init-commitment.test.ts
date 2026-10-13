import { it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { loadDataDriver } from '../src/frozen/driver.ts'
import { parseJson } from '../src/frozen/json.ts'
import { wireValue } from '../src/frozen/wire.ts'
import { initCommitment } from '../src/frozen/trust.ts'
import { driverBytes } from './helpers.ts'
import type { ContractRole } from '../src/frozen/manifest.ts'

const deployment = parseJson(
  readFileSync(new URL('fixtures/deployment-init.json', import.meta.url), 'utf8'),
) as { contracts: Record<string, { initHash: string; init: unknown }> }

it.each(['policy', 'store', 'resolver', 'marketplace'] as const)(
  'derives a real deployment\'s %s init commitment from its live initialization with the reviewed driver',
  async (role: ContractRole) => {
    const row = deployment.contracts[role],
      driver = await loadDataDriver(driverBytes(role))
    const type = ({ policy: 'InitPolicy', store: 'InitStore', resolver: 'InitResolver', marketplace: 'InitMarketplace' } as const)[role as 'policy']
    expect(initCommitment(driver, wireValue(type, row.init))).toBe(row.initHash)
  },
)
