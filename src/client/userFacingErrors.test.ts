import { describe, expect, it } from 'vitest'
import {
  isRevealTooEarlyMessage,
  isRejectedWalletMessage,
  isWalletLockedMessage,
  userFacingErrorMessage,
  userFacingMessageFromText,
} from './userFacingErrors'

describe('user-facing error copy', () => {
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
