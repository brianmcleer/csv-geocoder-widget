/**
 * Export utilities for geocoded results.
 *
 * Shapefile generation uses @mapbox/shp-write (the same library used by
 * the draw-advanced widget's export pipeline) which packages the .shp /
 * .shx / .dbf / .prj files into a ZIP.
 *
 * GeoJSON and KML are generated inline — geocoded points are always
 * already in WGS84 (the geocoder asks for outSR=4326) so no reprojection
 * is needed.
 */
import shpwrite from '@mapbox/shp-write'
import type { ParsedTable } from './parse-file'
import type { GeocodeResult } from './geocoder'

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
        match_score: Number(r.score.toFixed(1))
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
 * KML colour format is `AABBGGRR` (alpha, then BGR — note the reverse).
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
  // mangle here — leaving the truncation behaviour predictable for users
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
// Download helper
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

/** Build a base filename like `geocoded_2026-05-14`. */
export function timestampedBaseName (): string {
  return `geocoded_${new Date().toISOString().slice(0, 10)}`
}
