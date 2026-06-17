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
