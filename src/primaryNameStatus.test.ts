import { describe, expect, it } from 'vitest'
import { primaryNameStatus } from './primaryNameStatus'

describe('primaryNameStatus', () => {
  it('does not show a false invalid-endpoint error for matching local proof endpoints', () => {
    const status = primaryNameStatus({
      displayName: 'aurora.dusk',
      endpointValue: 'dusk1localresolverproof',
      endpointErrors: ['Dusk addresses must use a dusk1-prefixed lowercase address form.'],
      forwardRecordValue: 'dusk1localresolverproof',
      primaryName: 'aurora.dusk',
    })

    expect(status).toMatchObject({
      verified: true,
      tone: 'success',
      title: 'Primary domain verified',
    })
  })

  it('keeps arbitrary invalid endpoints blocked for display', () => {
    const status = primaryNameStatus({
      displayName: 'aurora.dusk',
      endpointValue: 'not-a-dusk-address',
      endpointErrors: ['Dusk addresses must use a dusk1-prefixed lowercase address form.'],
      forwardRecordValue: 'not-a-dusk-address',
      primaryName: 'aurora.dusk',
    })

    expect(status).toMatchObject({
      verified: false,
      tone: 'danger',
      title: 'Invalid endpoint',
    })
  })

  it('still rejects local proof endpoints when forward and reverse records do not match', () => {
    const status = primaryNameStatus({
      displayName: 'aurora.dusk',
      endpointValue: 'dusk1localresolverproof',
      endpointErrors: ['Dusk addresses must use a dusk1-prefixed lowercase address form.'],
      forwardRecordValue: 'dusk1localdifferent',
      primaryName: 'aurora.dusk',
    })

    expect(status).toMatchObject({
      verified: false,
      tone: 'danger',
      title: 'Invalid endpoint',
    })
  })
})
