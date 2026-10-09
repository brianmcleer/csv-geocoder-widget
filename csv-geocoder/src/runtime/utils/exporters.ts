/**
 * Export utilities for geocoded results.
 *
 * Two families:
 *
 *  1. Map files (GeoJSON, KML, zipped Shapefile). Matched points only, since a
 *     row without a point has nothing to draw. Shapefile generation uses
 *     @mapbox/shp-write (the same library used by the draw-advanced widget's
 *     export pipeline) which packages the .shp / .shx / .dbf / .prj files into
 *     a ZIP. GeoJSON and KML are generated inline. Geocoded points are always
 *     already in WGS84 (the geocoder asks for outSR=4326) so no reprojection
 *     is needed.
 *
 *  2. Address-check tables (CSV, Excel). EVERY row of the source file, in
 *     source order, with its match result appended: status, score, the
 *     locator's candidate, address type, the reason a row did not match, and
 *     coordinates when it did. This is what makes the widget usable as an
 *     address checker: run a list against the City locator, then hand the
 *     Unmatched rows to whoever has to investigate them.
 */
import shpwrite from '@mapbox/shp-write'
import * as XLSX from 'xlsx'
import type { ParsedTable } from './parse-file'
import type { GeocodeResult, MatchStatus } from './geocoder'
import type { FieldMapping } from '../components/field-mapper'
import { submittedAddress } from './address-text'
import { __locale, __t } from '../i18n-t'

// =============================================================================
// Status vocabulary (one place, so the UI, the table and the help agree)
// =============================================================================
export const STATUS_LABEL: { [K in MatchStatus]: string } = {
  matched: 'Matched',
  'low-score': 'Low score',
  'no-match': 'No match',
  blank: 'Blank address',
  error: 'Service error'
}

/** Display order for breakdowns: matched first, then the ways a row can fail. */
export const STATUS_ORDER: MatchStatus[] = ['matched', 'low-score', 'no-match', 'blank', 'error']

/** Label for one result, flagging a tied match (locator Status T) so it can be checked. */
export function statusLabel (r: GeocodeResult): string {
  if (r.status === 'matched' && r.locatorStatus === 'T') return __t("matchedTied")
  return STATUS_LABEL[r.status] ?? __t("noMatch")
}

/** Plain-language reason a row did not match. Empty for matched rows. */
export function failReason (r: GeocodeResult, minScore?: number): string {
  switch (r.status) {
    case 'matched': return ''
    case 'low-score':
      return typeof minScore === 'number'
        ? `Closest candidate scored ${Math.round(r.score)}, below the minimum of ${minScore}`
        : (r.error ?? 'Closest candidate scored below the minimum')
    case 'no-match': return 'The locator found no candidate for this address'
    case 'blank': return 'The mapped address columns are empty'
    case 'error': return r.error ? `The locator request failed: ${r.error}` : 'The locator request failed'
    default: return r.error ?? ''
  }
}

export type StatusCounts = { [K in MatchStatus]: number } & { total: number, unmatched: number, tied: number }

export function countByStatus (results: GeocodeResult[]): StatusCounts {
  const c: StatusCounts = {
    matched: 0, 'low-score': 0, 'no-match': 0, blank: 0, error: 0, total: results.length, unmatched: 0, tied: 0
  }
  for (const r of results) {
    c[r.status] = (c[r.status] ?? 0) + 1
    if (r.status !== 'matched') c.unmatched++
    else if (r.locatorStatus === 'T') c.tied++
  }
  return c
}

// =============================================================================
// Scope
// =============================================================================
export type TableScope = 'all' | 'matched' | 'unmatched'

export function filterByScope (results: GeocodeResult[], scope: TableScope): GeocodeResult[] {
  if (scope === 'matched') return results.filter(r => r.status === 'matched')
  if (scope === 'unmatched') return results.filter(r => r.status !== 'matched')
  return results.slice()
}

// =============================================================================
// Address-check table (shared by CSV and Excel)
// =============================================================================
/** Columns appended after the source columns, in this order. */
const RESULT_COLUMNS = [
  'MATCH_STATUS',
  'MATCH_SCORE',
  'SUBMITTED_ADDRESS',
  'MATCH_ADDR',
  'ADDR_TYPE',
  'FAIL_REASON',
  'LONGITUDE',
  'LATITUDE',
  'SOURCE_ROW'
] as const

type Cell = string | number | null

export interface ResultTable {
  headers: string[]
  rows: Cell[][]
}

export interface TableContext {
  table: ParsedTable
  mapping: FieldMapping
  /** The minimum score the run used, so FAIL_REASON can quote it. */
  minScore?: number
}

/**
 * Give each appended column a name that does not collide with a source
 * column: if the file already has MATCH_SCORE, ours becomes MATCH_SCORE_1.
 */
function resultHeaders (sourceFields: string[]): string[] {
  const taken = new Set(sourceFields.map(f => f.toLowerCase()))
  return RESULT_COLUMNS.map(name => {
    let candidate: string = name
    let n = 1
    while (taken.has(candidate.toLowerCase())) candidate = `${name}_${n++}`
    taken.add(candidate.toLowerCase())
    return candidate
  })
}

/**
 * Every result as a row: source columns in source order, then the result
 * columns. Rows come out in source order whatever order `results` is in.
 */
export function buildResultTable (ctx: TableContext, results: GeocodeResult[]): ResultTable {
  const { table, mapping, minScore } = ctx
  const headers = [...table.fields, ...resultHeaders(table.fields)]
  const sorted = results.slice().sort((a, b) => a.objectId - b.objectId)

  const rows: Cell[][] = sorted.map(r => {
    const src = table.rows[r.objectId] ?? {}
    const lon = r.point ? Number(((r.point.longitude ?? r.point.x) as number).toFixed(8)) : null
    const lat = r.point ? Number(((r.point.latitude ?? r.point.y) as number).toFixed(8)) : null
    return [
      ...table.fields.map(f => src[f] ?? ''),
      statusLabel(r),
      r.score > 0 ? Number(r.score.toFixed(2)) : null,
      submittedAddress(src, mapping),
      r.matchAddress || '',
      r.addrType ?? '',
      failReason(r, minScore),
      lon,
      lat,
      // Spreadsheet row number: header is row 1, so record 0 is row 2.
      r.objectId + 2
    ]
  })

  return { headers, rows }
}

// -----------------------------------------------------------------------------
// CSV
// -----------------------------------------------------------------------------
/**
 * Spreadsheet apps run a cell that starts with = + - @ (or a tab / CR) as a
 * formula, so a hostile or accidental value in an uploaded file could execute
 * when the export is opened (CSV injection). Text cells that start that way
 * get a leading apostrophe (OWASP's recommendation): the apostrophe is
 * visible in the cell, but the value can never run. Numbers we wrote ourselves (score, coordinates, row) are left alone, and a
 * text value that is a plain number such as "-108.55" is left alone too.
 */
function neutralizeFormula (s: string): string {
  if (s === '') return s
  if (!/^[=+\-@\t\r]/.test(s)) return s
  if (/^[+-]?\d+(\.\d+)?$/.test(s)) return s
  return `'${s}`
}

function csvCell (v: Cell): string {
  if (v === null || v === undefined) return ''
  const s = typeof v === 'number' ? String(v) : neutralizeFormula(String(v))
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

/**
 * RFC 4180 CSV with CRLF line ends and a UTF-8 byte order mark, so Excel opens
 * it with accented characters intact instead of guessing the code page.
 */
export function exportCSV (ctx: TableContext, results: GeocodeResult[]): Blob {
  const { headers, rows } = buildResultTable(ctx, results)
  const lines = [headers.map(csvCell).join(',')]
  for (const row of rows) lines.push(row.map(csvCell).join(','))
  return new Blob(['﻿', lines.join('\r\n'), '\r\n'], { type: 'text/csv;charset=utf-8' })
}

// -----------------------------------------------------------------------------
// Excel
// -----------------------------------------------------------------------------
export interface WorkbookMeta {
  /** Locator URL. Any query string (where a token could live) is dropped. */
  locatorUrl: string
  minScore: number
}

/** Locator URL without its query string or fragment, for the Summary sheet. */
function cleanLocatorUrl (url: string): string {
  try {
    const u = new URL(url, window.location.href)
    return `${u.origin}${u.pathname}`
  } catch {
    return (url || '').split(/[?#]/)[0]
  }
}

/** Column widths sized to the content, clamped so one long note cannot blow up a column. */
function columnWidths (headers: string[], rows: Cell[][]): Array<{ wch: number }> {
  return headers.map((h, c) => {
    let w = h.length
    const sample = Math.min(rows.length, 500)
    for (let r = 0; r < sample; r++) {
      const v = rows[r][c]
      if (v !== null && v !== undefined) w = Math.max(w, String(v).length)
    }
    return { wch: Math.min(Math.max(w + 2, 8), 60) }
  })
}

function tableSheet (t: ResultTable): XLSX.WorkSheet {
  const ws = XLSX.utils.aoa_to_sheet([t.headers, ...t.rows])
  ws['!cols'] = columnWidths(t.headers, t.rows)
  // Filter arrows on the header row so the table can be sorted and filtered
  // by status straight away.
  const lastCol = XLSX.utils.encode_cell({ r: t.rows.length, c: Math.max(0, t.headers.length - 1) })
  ws['!autofilter'] = { ref: `A1:${lastCol}` }
  return ws
}

function summarySheet (
  ctx: TableContext,
  all: GeocodeResult[],
  meta: WorkbookMeta,
  scope: TableScope
): XLSX.WorkSheet {
  const c = countByStatus(all)
  const pct = (n: number): string => (c.total > 0 ? `${(100 * n / c.total).toFixed(1)}%` : '0%')
  const scopeText = scope === 'all' ? 'All rows' : scope === 'matched' ? 'Matched rows only' : 'Unmatched rows only'

  const aoa: Cell[][] = [
    ['Address check summary', ''],
    ['', ''],
    ['Source file', ctx.table.fileName],
    ['Checked', new Date().toLocaleString(__locale())],
    ['Locator', cleanLocatorUrl(meta.locatorUrl)],
    ['Minimum match score', meta.minScore],
    ['Rows in this workbook', scopeText],
    ['', ''],
    ['Result', 'Rows', 'Share'],
    ['Total rows', c.total, '100%'],
    ['Matched', c.matched, pct(c.matched)],
    ...(c.tied > 0 ? [['  of which tied', c.tied, pct(c.tied)] as Cell[]] : []),
    ['Unmatched', c.unmatched, pct(c.unmatched)],
    ['  Low score', c['low-score'], pct(c['low-score'])],
    ['  No match', c['no-match'], pct(c['no-match'])],
    ['  Blank address', c.blank, pct(c.blank)],
    ['  Service error', c.error, pct(c.error)],
    ['', ''],
    ['What the statuses mean', ''],
    ['Matched', 'Found in the locator at or above the minimum score.'],
    ['Matched (tied)', 'Matched, but the locator found more than one equally good candidate. Worth a look.'],
    ['Low score', 'The locator found a candidate, but it scored below the minimum. MATCH_ADDR shows what it found.'],
    ['No match', 'The locator found nothing for this address.'],
    ['Blank address', 'The mapped address columns are empty. Nothing was sent to the locator.'],
    ['Service error', 'The request to the locator failed. Run the file again; if it keeps happening, contact the GIS Division.']
  ]
  const ws = XLSX.utils.aoa_to_sheet(aoa)
  ws['!cols'] = [{ wch: 26 }, { wch: 70 }, { wch: 10 }]
  return ws
}

/**
 * Excel workbook: a Summary sheet first, then one sheet per slice of the
 * results the scope asks for. "All" gives All results, Unmatched and Matched
 * sheets, so one file carries both the full check and the to-do list.
 */
export function exportXLSX (
  ctx: TableContext,
  allResults: GeocodeResult[],
  scope: TableScope,
  meta: WorkbookMeta
): Blob {
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, summarySheet(ctx, allResults, meta, scope), 'Summary')

  const add = (name: string, s: TableScope): void => {
    XLSX.utils.book_append_sheet(wb, tableSheet(buildResultTable(ctx, filterByScope(allResults, s))), name)
  }
  if (scope === 'all') {
    add('All results', 'all')
    add('Unmatched', 'unmatched')
    add('Matched', 'matched')
  } else if (scope === 'unmatched') {
    add('Unmatched', 'unmatched')
  } else {
    add('Matched', 'matched')
  }

  const out = XLSX.write(wb, { type: 'array', bookType: 'xlsx', compression: true })
  return new Blob([out], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
}

// =============================================================================
// GeoJSON
// =============================================================================
interface PointFeature {
  type: 'Feature'
  geometry: { type: 'Point', coordinates: [number, number] }
  properties: { [key: string]: string | number }
}

interface PointFeatureCollection {
  type: 'FeatureCollection'
  features: PointFeature[]
}

/**
 * Build a GeoJSON FeatureCollection from the geocoder results, merging
 * the original row attributes onto each feature plus the match metadata.
 * Only matched results (with a non-null point) are included.
 */
export function buildFeatureCollection (
  table: ParsedTable,
  results: GeocodeResult[]
): PointFeatureCollection {
  const features: PointFeature[] = []
  for (const r of results) {
    if (!r.point) continue
    const row = table.rows[r.objectId] ?? {}
    const lon = (r.point.longitude ?? r.point.x) as number
    const lat = (r.point.latitude ?? r.point.y) as number
    features.push({
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [Number(lon.toFixed(8)), Number(lat.toFixed(8))]
      },
      properties: {
        ...row,
        match_addr: r.matchAddress,
        match_score: Number(r.score.toFixed(1)),
        addr_type: r.addrType ?? ''
      }
    })
  }
  return { type: 'FeatureCollection', features }
}

export function exportGeoJSON (table: ParsedTable, results: GeocodeResult[]): Blob {
  const fc = buildFeatureCollection(table, results)
  return new Blob([JSON.stringify(fc, null, 2)], {
    type: 'application/geo+json'
  })
}

// =============================================================================
// KML
// =============================================================================
function escapeXml (s: string): string {
  return s.replace(/[<>&'"]/g, c => {
    switch (c) {
      case '<': return '&lt;'
      case '>': return '&gt;'
      case '&': return '&amp;'
      case "'": return '&apos;'
      case '"': return '&quot;'
      default: return c
    }
  })
}

/**
 * KML colour format is `AABBGGRR` (alpha, then BGR, note the reverse).
 * Input is a standard #RRGGBB hex string.
 */
function hexToKmlColor (hex: string): string {
  const h = hex.replace('#', '')
  if (h.length !== 6) return 'ffff0000' // default red, fully opaque
  return `ff${h.slice(4, 6)}${h.slice(2, 4)}${h.slice(0, 2)}`.toLowerCase()
}

export function exportKML (
  table: ParsedTable,
  results: GeocodeResult[],
  symbolColor: string
): Blob {
  const kmlColor = hexToKmlColor(symbolColor)
  const placemarks: string[] = []

  for (const r of results) {
    if (!r.point) continue
    const row = table.rows[r.objectId] ?? {}
    const lon = (r.point.longitude ?? r.point.x) as number
    const lat = (r.point.latitude ?? r.point.y) as number

    // Embed every original column as ExtendedData so attribute data round-trips.
    const extData = table.fields
      .map(f => {
        const v = row[f] ?? ''
        return `<Data name="${escapeXml(f)}"><value>${escapeXml(String(v))}</value></Data>`
      })
      .join('')

    const name = r.matchAddress || `Address ${r.objectId + 1}`
    placemarks.push(
      `    <Placemark>\n` +
      `      <name>${escapeXml(name)}</name>\n` +
      `      <description>Match score: ${r.score.toFixed(0)}</description>\n` +
      `      <styleUrl>#default</styleUrl>\n` +
      `      <ExtendedData>${extData}` +
      `<Data name="match_score"><value>${r.score.toFixed(1)}</value></Data>` +
      `</ExtendedData>\n` +
      `      <Point><coordinates>${lon.toFixed(8)},${lat.toFixed(8)},0</coordinates></Point>\n` +
      `    </Placemark>\n`
    )
  }

  // The Icon href uses a standard Google KML icon so the points render with
  // colour in Google Earth and most other KML viewers without needing a
  // custom icon resource.
  const xml =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<kml xmlns="http://www.opengis.net/kml/2.2">\n` +
    `  <Document>\n` +
    `    <name>Geocoded addresses</name>\n` +
    `    <description>Exported from the Address Geocoder widget</description>\n` +
    `    <Style id="default">\n` +
    `      <IconStyle>\n` +
    `        <color>${kmlColor}</color>\n` +
    `        <scale>1.0</scale>\n` +
    `        <Icon><href>https://maps.google.com/mapfiles/kml/shapes/placemark_circle.png</href></Icon>\n` +
    `      </IconStyle>\n` +
    `    </Style>\n` +
    placemarks.join('') +
    `  </Document>\n` +
    `</kml>\n`

  return new Blob([xml], { type: 'application/vnd.google-earth.kml+xml' })
}

// =============================================================================
// Shapefile (zipped)
// =============================================================================
export async function exportShapefile (
  table: ParsedTable,
  results: GeocodeResult[]
): Promise<Blob> {
  const fc = buildFeatureCollection(table, results)

  // Note: DBF (the .dbf attribute table inside a shapefile) limits field
  // names to 10 characters and field values to 254 characters. shp-write
  // truncates silently, so long column names will be cut. We don't pre-
  // mangle here, leaving the truncation behaviour predictable for users
  // familiar with the format.
  const out = await shpwrite.zip(fc, {
    folder: 'geocoded',
    filename: 'geocoded_addresses',
    types: { point: 'addresses' },
    outputType: 'blob',
    compression: 'DEFLATE'
  })

  if (out instanceof Blob) return out
  if (out instanceof ArrayBuffer) return new Blob([out], { type: 'application/zip' })
  if (out instanceof Uint8Array) {
    return new Blob([out.buffer as ArrayBuffer], { type: 'application/zip' })
  }
  if (typeof out === 'string') return new Blob([out], { type: 'application/zip' })
  throw new Error('Unexpected output type from shp-write.zip()')
}

// =============================================================================
// Download helper and file names
// =============================================================================
export function downloadBlob (blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.style.display = 'none'
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  // Give the browser a beat to start the download before revoking the URL.
  setTimeout(() => { URL.revokeObjectURL(url) }, 1000)
}

/** Local date and time as YYYY-MM-DD_HHMM, so two runs on one day do not collide. */
function stamp (): string {
  const d = new Date()
  const p = (n: number): string => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}`
}

/** Source file name without extension, made safe for a download name. */
function fileStem (fileName?: string): string {
  const base = (fileName ?? '').replace(/\.[^.]+$/, '')
  const safe = base.replace(/[\\/:*?"<>|]+/g, '').replace(/\s+/g, '_').replace(/_+/g, '_').trim()
  return safe.slice(0, 80) || 'addresses'
}

/**
 * Download name built from the uploaded file, e.g.
 * `Hydrants_unmatched_2026-10-08_1430.csv`.
 */
export function exportFileName (sourceFileName: string | undefined, label: string, ext: string): string {
  return `${fileStem(sourceFileName)}_${label}_${stamp()}${ext}`
}

/** Kept for anything still calling it. Prefer exportFileName. */
export function timestampedBaseName (): string {
  return `geocoded_${stamp()}`
}
