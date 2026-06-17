/**
 * Thin wrapper around Esri's Locator REST endpoints.
 *
 * We deliberately call the REST endpoints directly with esri/request so we can:
 *   - send batches larger than what addressToLocations() allows,
 *   - control the token and proxy behaviour from widget settings, and
 *   - report per-record failures (score < threshold, out-of-quota, etc.).
 */
import esriRequest from '@arcgis/core/request'
import Point from '@arcgis/core/geometry/Point'
import { type AddressRole } from '../../config'

export interface GeocodeInput {
  /** Index into the original row table, used to merge results back onto the row. */
  objectId: number
  /** Either a single-line address string or an object keyed by Locator field names. */
  address: string | Partial<Record<AddressRole, string>>
}

export interface GeocodeResult {
  objectId: number
  point: Point | null
  score: number
  matchAddress: string
  /** Reason the record failed, if any. */
  error?: string
}

export interface GeocodeOptions {
  url: string
  apiKey?: string
  batchSize: number
  minScore: number
  /** Called after every batch so the UI can update a progress bar. */
  onProgress?: (completed: number, total: number) => void
  /** Used to short-circuit if the user cancels. */
  signal?: AbortSignal
}

interface GeocodeAddressesResponse {
  spatialReference?: { wkid: number, latestWkid?: number }
  locations?: Array<{
    address: string
    location: { x: number, y: number }
    score: number
    attributes: { ResultID: number, [k: string]: unknown }
  }>
  error?: { code: number, message: string }
}

/**
 * Encode a batch into the records JSON the geocodeAddresses endpoint expects.
 * See https://developers.arcgis.com/rest/geocode/api-reference/geocoding-geocode-addresses.htm
 */
function encodeBatch (inputs: GeocodeInput[]): string {
  return JSON.stringify({
    records: inputs.map(i => ({
      attributes:
        typeof i.address === 'string'
          ? { OBJECTID: i.objectId, SingleLine: i.address }
          : { OBJECTID: i.objectId, ...i.address }
    }))
  })
}

/** Split an array into fixed-size chunks. */
function chunk<T> (arr: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

export async function geocodeBatch (
  inputs: GeocodeInput[],
  opts: GeocodeOptions
): Promise<GeocodeResult[]> {
  const { url, apiKey, batchSize, minScore, onProgress, signal } = opts
  const endpoint = `${url.replace(/\/+$/, '')}/geocodeAddresses`
  const out: GeocodeResult[] = []
  const batches = chunk(inputs, Math.max(1, batchSize))
  let completed = 0

  for (const batch of batches) {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')

    const query: Record<string, string> = {
      f: 'json',
      addresses: encodeBatch(batch),
      outSR: '4326'
    }
    if (apiKey) query.token = apiKey

    let resp: { data: GeocodeAddressesResponse }
    try {
      resp = await esriRequest(endpoint, {
        method: 'post',
        responseType: 'json',
        query,
        signal
      })
    } catch (e) {
      // Whole-batch failure -> mark every record in the batch as errored.
      const msg = e instanceof Error ? e.message : String(e)
      for (const i of batch) {
        out.push({
          objectId: i.objectId, point: null, score: 0, matchAddress: '', error: msg
        })
      }
      completed += batch.length
      onProgress?.(completed, inputs.length)
      continue
    }

    const data = resp.data
    if (data.error) {
      for (const i of batch) {
        out.push({
          objectId: i.objectId,
          point: null,
          score: 0,
          matchAddress: '',
          error: `${data.error.code}: ${data.error.message}`
        })
      }
      completed += batch.length
      onProgress?.(completed, inputs.length)
      continue
    }

    const byId = new Map<number, GeocodeAddressesResponse['locations'][number]>()
    for (const loc of data.locations ?? []) {
      byId.set(loc.attributes.ResultID as number, loc)
    }

    for (const i of batch) {
      const loc = byId.get(i.objectId)
      if (!loc || loc.score < minScore) {
        out.push({
          objectId: i.objectId,
          point: null,
          score: loc?.score ?? 0,
          matchAddress: loc?.address ?? '',
          error: !loc
            ? 'No candidate returned'
            : `Score ${loc.score.toFixed(0)} below threshold ${minScore}`
        })
        continue
      }
      out.push({
        objectId: i.objectId,
        point: new Point({
          x: loc.location.x,
          y: loc.location.y,
          spatialReference: { wkid: 4326 }
        }),
        score: loc.score,
        matchAddress: loc.address
      })
    }

    completed += batch.length
    onProgress?.(completed, inputs.length)
  }

  return out
}
