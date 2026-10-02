import { describe, expect, it } from 'vitest'
import {
  isRevealTooEarlyMessage,
  isRejectedWalletMessage,
  isWalletLockedMessage,
  userFacingErrorMessage,
  userFacingMessageFromText,
} from './userFacingErrors'

describe('user-facing error copy', () => {
  it.each([
    'DuskDomains: Close the marketplace listing before renewing',
    'Transaction rejected: runtime panic: DuskDomains: Close the marketplace listing before renewing',
  ])('explains escrow renewal failures: %s', message => {
    expect(userFacingErrorMessage(new Error(message))).toBe('Close the marketplace listing before renewing this name.')
    expect(userFacingMessageFromText(message)).toBe('Close the marketplace listing before renewing this name.')
  })

  it('keeps insufficient-balance failures product-facing', () => {
    expect(userFacingMessageFromText('Invalid input: Tx abc not accepted: Value spent larger than account holds')).toBe(
      'This wallet does not have enough DUSK to complete the transaction.',
    )
  })

  it('maps reveal-too-early failures to the reservation wait state', () => {
    expect(isRevealTooEarlyMessage('DuskDomains: reveal too early')).toBe(true)
    expect(userFacingMessageFromText('DuskDomains: reveal too early')).toBe(
      'Your reservation is still settling. Try again after a few more blocks.',
    )
  })

  it('maps locked wallet failures to an actionable recovery message', () => {
    expect(isWalletLockedMessage('Dusk Wallet is locked or the site is not connected')).toBe(true)
    expect(userFacingMessageFromText('Dusk Wallet is locked or the site is not connected')).toBe(
      'Connect or unlock your wallet to continue.',
    )
  })

  it('maps rejected wallet requests without exposing provider details', () => {
    expect(isRejectedWalletMessage('Local dev wallet rejected the profile request.')).toBe(true)
    expect(userFacingMessageFromText('Local dev wallet rejected the profile request.')).toBe(
      'The wallet request was rejected.',
    )
  })

  it('does not expose low-level DuskDS or payload errors', () => {
    expect(userFacingErrorMessage(new Error('owner must be a 32-byte hex string for DuskDS contract calls.'))).toBe(
      'The request could not be completed. Refresh and try again.',
    )
    expect(userFacingMessageFromText('Invalid input: public_sender runtime payload 0x1234567890abcdef1234567890abcdef1234567890abcdef')).toBe(
      'The request could not be completed. Refresh and try again.',
    )
  })

  it('does not expose indexer connection details in app copy', () => {
    expect(userFacingMessageFromText('Dusk Domains indexer request failed with HTTP 500: upstream exploded')).toBe(
      'Domain data is not reachable right now. Refresh and try again.',
    )
    expect(userFacingMessageFromText('fetch failed: ECONNREFUSED 127.0.0.1:8787')).toBe(
      'Domain data is not reachable right now. Refresh and try again.',
    )
  })

  it('preserves already user-facing validation messages', () => {
    expect(userFacingMessageFromText('Choose a valid record target.')).toBe('Choose a valid record target.')
  })
})

it('explains the reservation cap even inside a runtime rejection', () => {
  expect(userFacingErrorMessage(new Error('Transaction rejected: runtime panic: DuskDomains: pending commitment limit reached (16)')))
    .toBe('This wallet has 16 pending reservations. Open My names to finish a reservation, or wait for one to expire before reserving another.')
})

 it.each([
  ['DuskDomains: take-back batch must contain 1 to 256 subnames', 'Choose between 1 and 256 distinct subnames to take back.'],
  ['DuskDomains: active ancestor authority required', 'Connect the owner or manager of an active ancestor.'],
  ['DuskDomains: name is outside ancestor namespace', 'Every selected subname must be below the name you control.'],
])('explains namespace error %s', (message, expected) => {
  expect(userFacingErrorMessage(new Error(message))).toBe(expected)
})
