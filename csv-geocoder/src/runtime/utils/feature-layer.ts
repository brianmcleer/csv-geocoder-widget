/**
 * Turns geocode results into a real client-side FeatureLayer on the connected map.
 *
 * Why a FeatureLayer and not a GraphicsLayer. A GraphicsLayer draws dots and
 * nothing else: no attribute table, no query, no filter, no data source for
 * other widgets, and it disappears when the widget unmounts. That is what
 * forced people to download a GeoJSON and bring it back in through Add Data.
 * A client-side FeatureLayer (one built from a `source` array of graphics
 * rather than a service URL) behaves like any other layer in the app: it lists
 * in the Layer List, opens in the attribute table, answers queries, and can be
 * consumed by the Filter, Select, Chart and Table widgets.
 *
 * It lives for the browser session. Nothing is written to the portal and
 * nothing leaves the app, so no sign-in and no publisher privilege is needed.
 * Closing the app loses it, which is what the export buttons are still for.
 *
 * Everything here is loaded through loadArcGISJSAPIModules with esri/* paths,
 * the house convention. See the playbook, Section 12 items 2 and 3.
 */
import { loadArcGISJSAPIModules } from 'jimu-arcgis'
import type { ParsedTable } from './parse-file'
import type { GeocodeResult } from './geocoder'
import type { SymbolConfig } from '../../config'

/** Attribute the match score lands in. */
export const SCORE_FIELD = 'MATCH_SCORE'
/** Attribute the locator's own address string lands in. */
export const MATCH_FIELD = 'MATCH_ADDR'
/** Object id field. Client-side layers still need one. */
export const OID_FIELD = 'OBJECTID'

/** Field names we add ourselves, which a source column must never collide with. */
const RESERVED = [OID_FIELD, SCORE_FIELD, MATCH_FIELD]

/** One source column mapped to a field name the Maps SDK will accept. */
export interface FieldPlanEntry {
  /** Column header exactly as it appeared in the uploaded file. */
  source: string
  /** Sanitized field name used in the layer. */
  name: string
  /** Field alias, which is the original header, so the table reads normally. */
  alias: string
  /** Longest value seen in this column, used for the field length. */
  length: number
}

/**
 * Map source column headers onto field names a feature layer will accept.
 *
 * Headers out of a spreadsheet are arbitrary: spaces, punctuation, accents,
 * leading digits, duplicates once case is folded. Field names cannot be. The
 * original header is kept as the alias so nothing the user recognizes is lost.
 */
export function buildFieldPlan (table: ParsedTable): FieldPlanEntry[] {
  const used = new Set<string>(RESERVED.map(r => r.toUpperCase()))
  const plan: FieldPlanEntry[] = []

  for (const source of table.fields) {
    let base = source
      .normalize('NFKD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^A-Za-z0-9_]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_+|_+$/g, '')
    if (base.length === 0) base = 'FIELD'
    if (/^[0-9]/.test(base)) base = `F_${base}`
    if (base.length > 28) base = base.slice(0, 28)

    let name = base
    let n = 1
    while (used.has(name.toUpperCase())) {
      n += 1
      const suffix = `_${n}`
      name = `${base.slice(0, 28 - suffix.length)}${suffix}`
    }
    used.add(name.toUpperCase())

    let length = 1
    for (const row of table.rows) {
      const v = row[source]
      if (v && v.length > length) length = v.length
    }
    if (length > 8000) length = 8000

    plan.push({ source, name, alias: source, length })
  }

  return plan
}

/**
 * Strip the extension off the uploaded file name and make it presentable as a
 * layer title. "Council Districts 2026.xlsx" becomes "Council Districts 2026".
 */
export function titleFromFileName (fileName: string): string {
  const stem = fileName.replace(/\.[^./\\]+$/, '').trim()
  return stem.length > 0 ? stem : 'Geocoded addresses'
}

export interface CreateLayerOptions {
  table: ParsedTable
  results: GeocodeResult[]
  symbol: SymbolConfig
  /** Layer title shown in the Layer List. */
  title: string
  /** Stable layer id, so a re-run can find and replace the previous layer. */
  id: string
}

export interface CreatedLayer {
  layer: any
  /** Number of points actually added. */
  count: number
  /** The title the layer ended up with. */
  title: string
}

/**
 * Build the layer. The caller adds it to the map, which keeps this function
 * free of any view or map state and easy to reason about.
 */
export async function createResultsLayer (opts: CreateLayerOptions): Promise<CreatedLayer | null> {
  const { table, results, symbol, title, id } = opts

  const matched = results.filter(r => r.point)
  if (matched.length === 0) return null

  const [FeatureLayer, Graphic, Point, SimpleMarkerSymbol, SimpleRenderer, PopupTemplate] =
    await loadArcGISJSAPIModules([
      'esri/layers/FeatureLayer',
      'esri/Graphic',
      'esri/geometry/Point',
      'esri/symbols/SimpleMarkerSymbol',
      'esri/renderers/SimpleRenderer',
      'esri/PopupTemplate'
    ])

  const plan = buildFieldPlan(table)

  const fields: any[] = [
    { name: OID_FIELD, alias: 'OBJECTID', type: 'oid' },
    { name: MATCH_FIELD, alias: 'Match address', type: 'string', length: 512 },
    { name: SCORE_FIELD, alias: 'Match score', type: 'double' }
  ]
  for (const f of plan) {
    fields.push({ name: f.name, alias: f.alias, type: 'string', length: f.length })
  }

  const graphics: any[] = []
  let oid = 0
  for (const r of matched) {
    const row = table.rows[r.objectId]
    if (!row) continue
    oid += 1

    const attributes: { [key: string]: any } = {
      [OID_FIELD]: oid,
      [MATCH_FIELD]: r.matchAddress ?? '',
      [SCORE_FIELD]: r.score
    }
    for (const f of plan) attributes[f.name] = row[f.source] ?? ''

    graphics.push(new Graphic({
      geometry: new Point({
        longitude: r.point.longitude,
        latitude: r.point.latitude,
        spatialReference: { wkid: 4326 }
      }),
      attributes
    }))
  }

  if (graphics.length === 0) return null

  const renderer = new SimpleRenderer({
    symbol: new SimpleMarkerSymbol({
      color: symbol.color,
      size: symbol.size,
      outline: { color: symbol.outlineColor, width: symbol.outlineWidth }
    })
  })

  const popupTemplate = new PopupTemplate({
    title: `{${MATCH_FIELD}}`,
    content: [{
      type: 'fields',
      fieldInfos: [
        ...plan.map(f => ({ fieldName: f.name, label: f.alias })),
        { fieldName: SCORE_FIELD, label: 'Match score' },
        { fieldName: MATCH_FIELD, label: 'Match address' }
      ]
    }]
  })

  const layer = new FeatureLayer({
    id,
    title,
    source: graphics,
    fields,
    objectIdField: OID_FIELD,
    geometryType: 'point',
    spatialReference: { wkid: 4326 },
    renderer,
    popupTemplate,
    outFields: ['*'],
    listMode: 'show',
    legendEnabled: true,
    // Without this the table widget and the Layer List show the raw field names.
    displayField: MATCH_FIELD
  })

  return { layer, count: graphics.length, title }
}

/**
 * Remove a layer this widget added, by id. Safe to call when the layer is
 * already gone, which happens when somebody removes it from the Layer List.
 */
export function removeLayerById (map: any, id: string): void {
  if (!map || !id) return
  try {
    const existing = map.findLayerById ? map.findLayerById(id) : null
    if (existing) {
      map.remove(existing)
      if (typeof existing.destroy === 'function') existing.destroy()
    }
  } catch {
    /* view or map already torn down */
  }
}

/**
 * Remove every layer this widget put on the map, found by its id prefix.
 *
 * The prefix carries the widget id, so two copies of the widget in one app
 * never clear each other's work. Sweeping by prefix rather than by a kept
 * reference is what makes this correct after the widget is closed and opened
 * again, which throws the reference away but leaves the layer on the map.
 */
export function removeOwnLayers (map: any, idPrefix: string): number {
  if (!map?.layers || !idPrefix) return 0
  let removed = 0
  try {
    const doomed: any[] = []
    map.layers.forEach((l: any) => {
      if (l?.id && String(l.id).indexOf(idPrefix) === 0) doomed.push(l)
    })
    for (const l of doomed) {
      map.remove(l)
      if (typeof l.destroy === 'function') l.destroy()
      removed += 1
    }
  } catch {
    /* view or map already torn down */
  }
  return removed
}

/**
 * Pick a title that is not already taken on this map, so stacking runs read as
 * "Addresses", "Addresses (2)", "Addresses (3)" rather than three identical
 * entries in the Layer List.
 */
export function uniqueTitle (map: any, wanted: string): string {
  if (!map?.layers) return wanted
  const taken = new Set<string>()
  try {
    map.layers.forEach((l: any) => { if (l?.title) taken.add(String(l.title)) })
  } catch {
    return wanted
  }
  if (!taken.has(wanted)) return wanted
  let n = 2
  while (taken.has(`${wanted} (${n})`)) n += 1
  return `${wanted} (${n})`
}

/**
 * Zoom so every point is visible. A single point has no usable extent, so it
 * gets a fixed scale instead of an extent the view would reject.
 */
export async function zoomToLayer (view: any, layer: any, count: number): Promise<void> {
  if (!view || !layer) return
  try {
    await view.when()
    await layer.when()
    if (count === 1) {
      const query = layer.createQuery()
      query.returnGeometry = true
      query.where = '1=1'
      const res = await layer.queryFeatures(query)
      const first = res?.features?.[0]
      if (first?.geometry) await view.goTo({ target: first.geometry, scale: 4000 })
      return
    }
    if (layer.fullExtent) await view.goTo(layer.fullExtent.clone().expand(1.15))
  } catch {
    /* goTo rejects on rapid view changes; not worth surfacing */
  }
}
