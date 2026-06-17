import { type ImmutableObject } from 'jimu-core'

/**
 * Address field mapping modes.
 *  - 'single': one column contains the full address string.
 *  - 'multi':  several columns are concatenated (street, city, region, postal, country).
 */
export type AddressMode = 'single' | 'multi'

/** Multi-field role keys. Keep aligned with Esri Locator address fields. */
export type AddressRole =
  | 'Address'
  | 'Address2'
  | 'City'
  | 'Region'
  | 'Postal'
  | 'Country'

export interface SymbolConfig {
  color: string         // hex
  size: number          // px
  outlineColor: string  // hex
  outlineWidth: number  // px
}

export interface Config {
  /** Locator service URL (e.g. https://geocode-api.arcgis.com/.../World/GeocodeServer). */
  geocoderUrl: string
  /** Optional API key / token used when calling the locator. Stored in app JSON. */
  apiKey: string
  /** Maximum addresses sent per geocodeAddresses request. */
  batchSize: number
  /** Minimum score (0–100) to accept a match. Lower scores are reported as failures. */
  minScore: number
  /** When true, run requests through the proxy configured for the app. */
  useProxy: boolean
  /** Default symbol drawn on the map for each geocoded point. */
  symbol: SymbolConfig
  /** Auto-zoom to the extent of geocoded points when geocoding finishes. */
  zoomToResults: boolean
  /** Default address mode users see when they open the widget. */
  defaultAddressMode: AddressMode
}

export type IMConfig = ImmutableObject<Config>

export const DEFAULT_CONFIG: Config = {
  geocoderUrl:
    'https://geocode-api.arcgis.com/arcgis/rest/services/World/GeocodeServer',
  apiKey: '',
  batchSize: 100,
  minScore: 80,
  useProxy: false,
  symbol: {
    color: '#e84c4c',
    size: 10,
    outlineColor: '#ffffff',
    outlineWidth: 1.5
  },
  zoomToResults: true,
  defaultAddressMode: 'multi'
}
