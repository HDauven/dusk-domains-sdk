import { it, vi } from 'vitest'
import fc from 'fast-check'
import { definitions } from '../../src/frozen/schema.ts'
import { wireValue } from '../../src/frozen/wire.ts'
import { arbitrary, examples } from './arbitraries.ts'
import { lossless } from './catalog.ts'
import { check, testTimeout } from './support.ts'

vi.setConfig({ testTimeout })
for (const type of Object.keys(definitions)) it(`schema ${type}: boundaries, enum and nested Option branches are lossless`, async () => {
  await check(`schema/${type}`, fc.property(arbitrary(type), value => {
    lossless(type, wireValue(type, value))
  }), { examples: examples(type) })
})
