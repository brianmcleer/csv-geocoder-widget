/**
 * Widget-specific editor declarations.
 *
 * Editor only. Emits nothing and changes no widget behavior.
 *
 * src/exb-editor-shims.d.ts is a byte copy of the shared master at
 * widgets\_vs\exb-editor-shims.d.ts and must not be edited, so anything this
 * widget imports that the master does not cover is declared here instead. See
 * the playbook, Section 12 item 3.
 *
 * calcite-components is supplied by Experience Builder (webpack aliases it to
 * jimu-ui/calcite-components), so it is an import, not a dependency, and must
 * never appear in package.json.
 */
declare module 'calcite-components' {
    export const CalciteIcon: any
    export const CalciteChip: any
    export const CalciteButton: any
    export const CalciteSlider: any
    const mod: any
    export default mod
}

// Moved here from src/xlsx.d.ts on 17 September 2026 so it stays out of the release zip
// (an ambient declaration of a real package shadows the neighbours' @types).
declare module 'xlsx' {
  export interface WorkSheet {
    [cell: string]: any
    '!ref'?: string
  }

  export interface WorkBook {
    SheetNames: string[]
    Sheets: Record<string, WorkSheet>
  }

  export function read(data: ArrayBuffer, options?: { type?: string, cellDates?: boolean }): WorkBook

  export namespace utils {
    function sheet_to_json<T>(sheet: WorkSheet, options?: { defval?: unknown, raw?: boolean }): T[]
    function decode_range(ref: string): { s: { r: number, c: number }, e: { r: number, c: number } }
    function encode_cell(cell: { r: number, c: number }): string
  }
}

// Moved here from src/shp-write.d.ts on 17 September 2026 so it stays out of the release zip
// (an ambient declaration of a real package shadows the neighbours' @types).
/**
 * Minimal type shim for @mapbox/shp-write.
 * The package doesn't ship its own .d.ts at the time of writing.
 */
declare module '@mapbox/shp-write' {
  export interface ZipOptions {
    folder?: string
    filename?: string
    types?: {
      point?: string
      polygon?: string
      line?: string
      polyline?: string
      multipoint?: string
    }
    outputType?: 'blob' | 'arraybuffer' | 'uint8array' | 'binary' | 'base64' | 'string'
    compression?: 'DEFLATE' | 'STORE'
    prj?: string
  }

  /** Generate a ZIP containing .shp/.shx/.dbf/.prj from a GeoJSON FeatureCollection. */
  export function zip (
    geojson: unknown,
    options?: ZipOptions
  ): Promise<Blob | ArrayBuffer | Uint8Array | string>

  const _default: { zip: typeof zip }
  export default _default
}
