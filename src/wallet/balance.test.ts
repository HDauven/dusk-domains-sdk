import { describe, expect, it } from 'vitest'
import {
  DEFAULT_WRITE_NETWORK_FEE_LUX,
  checkPublicBalanceForWrite,
  formatLuxAsDusk,
  parseLuxString,
} from '../core/balance'

describe('Dusk public balance helpers', () => {
  it('parses wallet Lux balance strings conservatively', () => {
    expect(parseLuxString('0')).toBe(0n)
    expect(parseLuxString('01')).toBe(1n)
    expect(parseLuxString('200000000')).toBe(200_000_000n)
    expect(parseLuxString('1.2')).toBeNull()
    expect(parseLuxString('-1')).toBeNull()
  })

  it('formats Lux balances as DUSK without padded noise', () => {
    expect(formatLuxAsDusk(0n)).toBe('0 DUSK')
    expect(formatLuxAsDusk(DEFAULT_WRITE_NETWORK_FEE_LUX)).toBe('0.2 DUSK')
    expect(formatLuxAsDusk(1_234_567_890n)).toBe('1.23456789 DUSK')
  })

  it('fails preflight when the wallet cannot cover estimated live write fees', () => {
    expect(checkPublicBalanceForWrite({
      balanceLux: '199999999',
      action: 'reserving this name',
    })).toMatchObject({
      ok: false,
      availableLux: 199_999_999n,
      requiredLux: 200_000_000n,
      message: 'Insufficient public DUSK for reserving this name. Available: 0.199999999 DUSK. Required: 0.2 DUSK.',
    })
  })

  it('scales the estimate for multi-transaction flows', () => {
    expect(checkPublicBalanceForWrite({
      balanceLux: '399999999',
      action: 'saving a record',
      transactionCount: 2,
    })).toMatchObject({
      ok: false,
      requiredLux: 400_000_000n,
    })
  })

  it('includes domain fees in the required balance', () => {
    expect(checkPublicBalanceForWrite({
      balanceLux: '34999999999',
      action: 'registering aurora.dusk',
      extraRequiredLux: 35_000_000_000n,
    })).toMatchObject({
      ok: false,
      availableLux: 34_999_999_999n,
      requiredLux: 35_200_000_000n,
    })
  })

  it('passes preflight when the wallet can cover the estimate', () => {
    expect(checkPublicBalanceForWrite({
      balanceLux: '400000000',
      action: 'saving a record',
      transactionCount: 2,
    })).toMatchObject({
      ok: true,
      availableLux: 400_000_000n,
      requiredLux: 400_000_000n,
    })
  })
})
