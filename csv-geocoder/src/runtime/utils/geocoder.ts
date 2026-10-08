/**
 * Thin wrapper around Esri's Locator REST endpoints.
 *
 * We deliberately call the REST endpoints directly with fetch so we can:
 *   - send batches larger than what addressToLocations() allows,
 *   - control the token and proxy behaviour from widget settings, and
 *   - report per-record failures (score < threshold, out-of-quota, etc.).
 *
 * Every record comes back with a `status` code so the address-check table
 * export and the Results breakdown can say WHY a row did not match, not just
 * that it did not.
 */
import { type AddressRole } from '../../config'

export interface GeocodeInput {
  /** Index into the original row table, used to merge results back onto the row. */
  objectId: number
  /** Either a single-line address string or an object keyed by Locator field names. */
  address: string | Partial<Record<AddressRole, string>>
}

export interface GeocodePoint {
  x: number
  y: number
  longitude: number
  latitude: number
  spatialReference: { wkid: number }
}

/**
 * Outcome of one record.
 *  - matched:   a candidate at or above the minimum score; has a point.
 *  - low-score: the locator found a candidate, but below the minimum score.
 *  - no-match:  the locator returned no usable candidate (Status U, or nothing).
 *  - blank:     the mapped address columns were empty, so nothing was sent.
 *  - error:     the request for this record's batch failed (HTTP, token, quota).
 */
export type MatchStatus = 'matched' | 'low-score' | 'no-match' | 'blank' | 'error'

export interface GeocodeResult {
  objectId: number
  point: GeocodePoint | null
  score: number
  matchAddress: string
  status: MatchStatus
  /** Locator's own Status attribute: M (matched), T (tied), U (unmatched). */
  locatorStatus?: string
  /** Locator's Addr_type, e.g. PointAddress, StreetAddress, Locality. */
  addrType?: string
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
    location: { x: number | string, y: number | string }
    score: number
    attributes: { ResultID: number, Status?: string, Addr_type?: string, [k: string]: unknown }
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

/**
 * True when there is nothing to send. A blank row would spend a locator call
 * (and on the world locator, a credit) to learn nothing, so it is reported
 * as "blank" without a request.
 */
export function isBlankInput (input: GeocodeInput): boolean {
  if (typeof input.address === 'string') return input.address.trim() === ''
  return Object.values(input.address).every(v => (v ?? '').trim() === '')
}

function toNumber (v: number | string | undefined): number {
  return typeof v === 'number' ? v : Number(v)
}

export async function geocodeBatch (
  inputs: GeocodeInput[],
  opts: GeocodeOptions
): Promise<GeocodeResult[]> {
  const { url, apiKey, batchSize, minScore, onProgress, signal } = opts
  const endpoint = `${url.replace(/\/+$/, '')}/geocodeAddresses`
  const out: GeocodeResult[] = []
  let completed = 0

  // Blank rows are settled up front and never sent.
  const toSend: GeocodeInput[] = []
  for (const i of inputs) {
    if (isBlankInput(i)) {
      out.push({
        objectId: i.objectId,
        point: null,
        score: 0,
        matchAddress: '',
        status: 'blank',
        error: 'Address columns are blank'
      })
      completed++
    } else {
      toSend.push(i)
    }
  }
  if (completed > 0) onProgress?.(completed, inputs.length)

  const batches = chunk(toSend, Math.max(1, batchSize))

  for (const batch of batches) {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')

    const query: Record<string, string> = {
      f: 'json',
      addresses: encodeBatch(batch),
      outSR: '4326'
    }
    if (apiKey) query.token = apiKey

    let data: GeocodeAddressesResponse
    try {
      const body = new URLSearchParams(query)
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
        body,
        signal
      })
      if (!response.ok) throw new Error(`Locator request failed with HTTP ${response.status}`)
      data = await response.json() as GeocodeAddressesResponse
    } catch (e) {
      // A cancel must stop the run, not be recorded as a failed batch.
      if ((e as Error)?.name === 'AbortError') throw e
      // Whole-batch failure -> mark every record in the batch as errored.
      const msg = e instanceof Error ? e.message : String(e)
      for (const i of batch) {
        out.push({
          objectId: i.objectId, point: null, score: 0, matchAddress: '', status: 'error', error: msg
        })
      }
      completed += batch.length
      onProgress?.(completed, inputs.length)
      continue
    }

    if (data.error) {
      for (const i of batch) {
        out.push({
          objectId: i.objectId,
          point: null,
          score: 0,
          matchAddress: '',
          status: 'error',
          error: `${data.error.code}: ${data.error.message}`
        })
      }
      completed += batch.length
      onProgress?.(completed, inputs.length)
      continue
    }

    type GeocodeLocation = NonNullable<GeocodeAddressesResponse['locations']>[number]
    const byId = new Map<number, GeocodeLocation>()
    for (const loc of data.locations ?? []) {
      byId.set(loc.attributes.ResultID as number, loc)
    }

    for (const i of batch) {
      const loc = byId.get(i.objectId)
      const locatorStatus = typeof loc?.attributes?.Status === 'string' ? loc.attributes.Status : undefined
      const addrType = typeof loc?.attributes?.Addr_type === 'string' ? loc.attributes.Addr_type : undefined
      const x = toNumber(loc?.location?.x)
      const y = toNumber(loc?.location?.y)

      // Status U, or a location of NaN, is the locator saying "no match". Without
      // this check a minimum score of 0 would put an unmatched row on the map at NaN.
      const usable = !!loc && locatorStatus !== 'U' && Number.isFinite(x) && Number.isFinite(y)

      if (!usable) {
        out.push({
          objectId: i.objectId,
          point: null,
          score: loc?.score ?? 0,
          matchAddress: loc?.address ?? '',
          status: 'no-match',
          locatorStatus,
          addrType,
          error: 'No candidate returned'
        })
        continue
      }

      if (loc.score < minScore) {
        out.push({
          objectId: i.objectId,
          point: null,
          score: loc.score,
          matchAddress: loc.address ?? '',
          status: 'low-score',
          locatorStatus,
          addrType,
          error: `Score ${loc.score.toFixed(0)} below threshold ${minScore}`
        })
        continue
      }

      out.push({
        objectId: i.objectId,
        point: {
          x,
          y,
          longitude: x,
          latitude: y,
          spatialReference: { wkid: 4326 }
        },
        score: loc.score,
        matchAddress: loc.address,
        status: 'matched',
        locatorStatus,
        addrType
      })
    }

    completed += batch.length
    onProgress?.(completed, inputs.length)
  }

  // Back in source order, since blank rows were settled first.
  out.sort((a, b) => a.objectId - b.objectId)
  return out
}
