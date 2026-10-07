/** Rusk HTTP read transport. No wallet or caller-provided height is required. @module */
import { parseJson, u64 } from './json.ts'
import { object } from './manifest.ts'
export interface ReadTransport {
  currentBlockHeight(): Promise<bigint>
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
  return {
    async currentBlockHeight() {
      const response = await fetcher(`${base}/on/graphql/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/graphql' },
        body: 'query { block(height: -1) { header { height } } }',
      })
      if (!response.ok)
        throw new Error(`Block height read failed: HTTP ${response.status}`)
      const reply = object(parseJson(await response.text()))
      if (reply.errors) throw new Error('Block height query failed')
      const data = reply.data ? object(reply.data) : reply
      return u64(object(object(data.block).header).height)
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
