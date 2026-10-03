type ChainIdentity = { readonly chainId?: string }

type BoundPreparedCall = {
  chainId: string
  contractId: string
  preparedCall: unknown
}

export async function prepareBoundCall(
  app: ChainIdentity,
  contractId: string,
  prepare: () => Promise<unknown>,
): Promise<BoundPreparedCall> {
  const chainId = app.chainId
  if (!chainId) throw new Error('Dusk Domains preparation requires the current wallet chain.')
  const preparedCall = await prepare()
  if (app.chainId !== chainId) throw new Error('Dusk Domains chain changed during preparation. Prepare the call again.')
  return Object.freeze({ chainId, contractId, preparedCall })
}

export function preparedCallForTarget(app: ChainIdentity, contractId: string, value: unknown): unknown {
  if (!value || typeof value !== 'object' || !('chainId' in value) || !('contractId' in value) || !('preparedCall' in value)) {
    throw new Error('Dusk Domains prepared call is not bound to a chain and contract. Prepare the call again.')
  }
  if (!app.chainId || value.chainId !== app.chainId || typeof value.contractId !== 'string' || value.contractId.toLowerCase() !== contractId.toLowerCase()) {
    throw new Error('Dusk Domains chain or contract changed after preparation. Prepare the call again.')
  }
  return value.preparedCall
}
