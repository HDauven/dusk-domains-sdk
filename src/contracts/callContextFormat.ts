import type { DuskPrincipal } from '../core/principal'

export function recordApprovalLabel(key: string): string {
  if (key === 'moonlight_address') return 'Dusk Public Address'
  if (key === 'phoenix_payment_endpoint') return 'Dusk Shielded Address'
  if (key === 'dusk_contract') return 'contract address'
  if (key === 'dusk_asset') return 'asset record'
  if (key === 'evm_address') return 'DuskEVM Address'
  if (key === 'website') return 'website'
  if (key === 'avatar') return 'avatar'
  if (key === 'content_pointer') return 'content pointer'
  if (key === 'attestation_ref') return 'attestation reference'
  if (key === 'compliance_ref') return 'compliance reference'
  if (key.startsWith('text.')) return key.slice('text.'.length).replaceAll('_', ' ')
  if (key.startsWith('service_endpoint.')) return `${key.slice('service_endpoint.'.length).replaceAll('_', ' ')} endpoint`
  return key.replaceAll('_', ' ')
}

export function formatLux(value: number): string {
  if (!Number.isFinite(value)) return '0'
  return (value / 1_000_000_000).toLocaleString('en-US', {
    maximumFractionDigits: 9,
  })
}

export function formatYears(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return 'Unknown'
  return `${value} ${value === 1 ? 'year' : 'years'}`
}

export function principalSummary(value: DuskPrincipal): string {
  const bytes = value.bytes.map((byte) => byte.toString(16).padStart(2, '0')).join('')
  const prefix = value.kind === 'Moonlight' ? 'Moonlight' : value.kind
  return `${prefix} 0x${bytes.slice(0, 8)}...${bytes.slice(-6)}`
}
