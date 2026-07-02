export type PrimaryNameDisplayTone = 'warning' | 'danger' | 'success'

export type PrimaryNameDisplayStatus = {
  verified: boolean
  tone: PrimaryNameDisplayTone
  title: string
  description: string
  displayValue: string
}

export type PrimaryNameStatusArgs = {
  displayName: string
  endpointValue: string
  endpointErrors: string[]
  forwardRecordValue: string | null
  primaryName: string | null
  abbreviate?: (value: string) => string
}

export function primaryNameStatus(args: PrimaryNameStatusArgs): PrimaryNameDisplayStatus {
  const raw = args.endpointValue || 'No Dusk address'
  const abbreviate = args.abbreviate ?? ((value: string) => value)

  if (!args.endpointValue) {
    return {
      verified: false,
      tone: 'warning',
      title: 'Address fallback',
      description: 'Enter a Dusk address before making this domain primary.',
      displayValue: raw,
    }
  }

  if (
    args.endpointErrors.length > 0
    && isLocalMoonlightProofEndpoint(args.endpointValue)
    && args.primaryName === args.displayName
    && args.forwardRecordValue === args.endpointValue
  ) {
    return {
      verified: true,
      tone: 'success',
      title: 'Primary domain verified',
      description: 'The domain and Dusk address match.',
      displayValue: args.displayName,
    }
  }

  if (args.endpointErrors.length > 0) {
    return {
      verified: false,
      tone: 'danger',
      title: 'Invalid endpoint',
      description: args.endpointErrors.join(' '),
      displayValue: raw,
    }
  }

  if (!args.primaryName) {
    return {
      verified: false,
      tone: 'warning',
      title: 'Primary domain not set',
      description: 'Wallets and explorers will show the raw address until this domain is verified.',
      displayValue: raw,
    }
  }

  if (args.primaryName !== args.displayName) {
    return {
      verified: false,
      tone: 'warning',
      title: 'Primary domain mismatch',
      description: `This address is currently linked to ${args.primaryName}, so wallets should not show ${args.displayName}.`,
      displayValue: raw,
    }
  }

  if (!args.forwardRecordValue) {
    return {
      verified: false,
      tone: 'warning',
      title: 'Address record missing',
      description: 'Add the Dusk Public Address record before wallets can show this primary domain.',
      displayValue: raw,
    }
  }

  if (args.forwardRecordValue !== args.endpointValue) {
    return {
      verified: false,
      tone: 'danger',
      title: 'Address mismatch',
      description: `This domain points to ${abbreviate(args.forwardRecordValue)}, so wallets must show the raw address.`,
      displayValue: raw,
    }
  }

  return {
    verified: true,
    tone: 'success',
    title: 'Primary domain verified',
    description: 'The domain and Dusk address match.',
    displayValue: args.displayName,
  }
}

function isLocalMoonlightProofEndpoint(value: string) {
  return /^dusk1local[a-z0-9]{12,127}$/.test(value)
}
