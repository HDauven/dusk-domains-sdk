/** Rusk HTTP read transport. No wallet or caller-provided height is required. @module */
import { parseJson, u64 } from './json.ts'
import { object } from './manifest.ts'
/** The chain tip a read answers at: its height and, when the transport reads it, its block hash. */
export interface ChainTip {
  height: bigint
  /** With a hash, a block replaced at the same height is a new tip; by height alone, it is not. */
  hash?: string
}
export interface ReadTransport {
  currentBlockHeight(): Promise<bigint>
  /**
   * The tip's height and block hash, read together. Optional: a client reads a transport without
   * it by height alone, and then shares a reply between operations only briefly.
   */
  currentBlock?(): Promise<ChainTip>
  /**
   * A stable name for the chain state this transport reads, such as its node URL. Verification
   * cache entries are keyed by it; a client gets no persistent verification cache from a transport
   * without one unless `ClientOptions.transportNamespace` names it.
   */
  readonly namespace?: string
  read(
    contractId: string,
    functionName: string,
    bytes: Uint8Array,
  ): Promise<Uint8Array>
}
export function createHttpTransport(
  nodeUrl: string,
  fetcher: typeof fetch = fetch,
): ReadTransport {
  const base = nodeUrl.replace(/\/$/u, '')
  // One request answers both, so the hash is of the block at that height.
  const tip = async (): Promise<Record<string, unknown>> => {
    const response = await fetcher(`${base}/on/graphql/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/graphql' },
      body: 'query { block(height: -1) { header { height hash } } }',
    })
    if (!response.ok)
      throw new Error(`Block height read failed: HTTP ${response.status}`)
    const reply = object(parseJson(await response.text()))
    if (reply.errors) throw new Error('Block height query failed')
    const data = reply.data ? object(reply.data) : reply
    return object(object(data.block).header)
  }
  return {
    namespace: base,
    async currentBlock() {
      const header = await tip()
      if (typeof header.hash !== 'string' || !/^[\da-f]{64}$/iu.test(header.hash))
        throw new Error('Block hash query failed')
      return { height: u64(header.height), hash: header.hash.toLowerCase() }
    },
    async currentBlockHeight() {
      return u64((await tip()).height)
    },
    async read(id, name, bytes) {
      const response = await fetcher(`${base}/on/contracts:${id}/${name}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/octet-stream',
          Accept: 'application/octet-stream',
        },
        body: new Uint8Array(bytes),
      })
      if (!response.ok)
        throw new Error(
          `Contract read failed (${id}.${name}): ${await response.text()}`,
        )
      const result = new Uint8Array(await response.arrayBuffer())
      if (result.length > 32768)
        throw new Error('Contract reply exceeds wire envelope')
      return result
    },
  }
}
