/** @jsxRuntime classic */
/** @jsx jsx */
import { React, jsx, css } from 'jimu-core'
import type { ParsedTable } from '../utils/parse-file'
import type { GeocodeResult } from '../utils/geocoder'
import {
    exportGeoJSON, exportKML, exportShapefile,
    downloadBlob, timestampedBaseName
} from '../utils/exporters'
import Tooltip from './tooltip'

interface Props {
    table: ParsedTable
    results: GeocodeResult[]
    symbolColor: string
}

type Busy = 'geojson' | 'kml' | 'shp' | null

interface FormatDef {
    id: Exclude<Busy, null>
    label: string
    ext: string
    ariaLabel: string
    iconKey: 'file' | 'zip'
}

const FORMATS: FormatDef[] = [
    { id: 'geojson', label: 'GeoJSON', ext: '.geojson', ariaLabel: 'Export matched points as GeoJSON', iconKey: 'file' },
    { id: 'kml', label: 'KML', ext: '.kml', ariaLabel: 'Export matched points as KML', iconKey: 'file' },
    { id: 'shp', label: 'Shapefile', ext: '.zip', ariaLabel: 'Export matched points as a zipped Shapefile', iconKey: 'zip' }
]

const fileSvg = (
    <svg width='16' height='16' viewBox='0 0 24 24' fill='none' aria-hidden='true' focusable='false'>
        <path d='M13 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V9z'
            stroke='currentColor' strokeWidth='2' strokeLinejoin='round' />
        <path d='M13 2v7h7' stroke='currentColor' strokeWidth='2' strokeLinejoin='round' />
    </svg>
)
const zipSvg = (
    <svg width='16' height='16' viewBox='0 0 24 24' fill='none' aria-hidden='true' focusable='false'>
        <path d='M13 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V9z'
            stroke='currentColor' strokeWidth='2' strokeLinejoin='round' />
        <path d='M13 2v7h7' stroke='currentColor' strokeWidth='2' strokeLinejoin='round' />
        <path d='M10 12h2m-2 2h2m-2 2h2m-2 2h2' stroke='currentColor' strokeWidth='1.5' strokeLinecap='round' />
    </svg>
)

const ExportBar = (props: Props): React.ReactElement => {
    const { table, results, symbolColor } = props
    const [busy, setBusy] = React.useState<Busy>(null)
    const [error, setError] = React.useState<string | null>(null)
    const [lastExport, setLastExport] = React.useState<string | null>(null)

    const matched = React.useMemo(() => results.filter(r => r.point), [results])
    const canExport = matched.length > 0

    const run = async (id: Exclude<Busy, null>): Promise<void> => {
        setBusy(id)
        setError(null)
        try {
            let blob: Blob
            let fname: string
            if (id === 'geojson') {
                blob = exportGeoJSON(table, matched)
                fname = `${timestampedBaseName()}.geojson`
            } else if (id === 'kml') {
                blob = exportKML(table, matched, symbolColor)
                fname = `${timestampedBaseName()}.kml`
            } else {
                blob = await exportShapefile(table, matched)
                fname = `${timestampedBaseName()}_shapefile.zip`
            }
            downloadBlob(blob, fname)
            setLastExport(fname)
        } catch (e) {
            const label = id === 'geojson' ? 'GeoJSON' : id === 'kml' ? 'KML' : 'Shapefile'
            setError(`Could not export ${label}: ${e instanceof Error ? e.message : String(e)}`)
        } finally {
            setBusy(null)
        }
    }

    const styles = css`
    display: flex; flex-direction: column; gap: 10px;

    .summary {
      display: flex; align-items: center; gap: 6px;
      font-size: 12px;
      color: var(--ref-palette-neutral-1100, #1a1a1a);
    }

    /* Three equal columns. minmax(0, 1fr) lets columns shrink below
       intrinsic content width so all three are exactly the same width. */
    .grid {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 8px;
    }
    /* Stack to one column on very narrow widgets so labels stay readable. */
    @media (max-width: 320px) {
      .grid { grid-template-columns: 1fr; }
    }

    .fmt-btn {
      display: inline-flex;
      flex-direction: column;       /* stack icon → label → chip vertically */
      align-items: center;
      justify-content: center;
      gap: 4px;
      padding: 10px 6px;
      min-height: 72px;             /* uniform height across all three */
      min-width: 0;                 /* allow shrinking inside the grid track */
      font: 600 13px/1.2 inherit;
      background: var(--ref-palette-neutral-100, #fff);
      color: var(--ref-palette-neutral-1100, #1a1a1a);
      border: 1px solid var(--ref-palette-neutral-700, #a0a0a0);
      border-radius: 8px;
      cursor: pointer;
      transition: background .12s ease, border-color .12s ease, transform .08s ease;
      text-align: center;
    }
    .fmt-btn:hover:not([disabled]) {
      background: var(--ref-palette-neutral-300, #f0f0f0);
      border-color: var(--sys-color-primary-main, #0079c1);
    }
    .fmt-btn:active:not([disabled]) { transform: translateY(1px); }
    .fmt-btn:focus-visible {
      outline: 2px solid var(--sys-color-primary-main, #0079c1);
      outline-offset: 2px;
    }
    .fmt-btn[disabled] { opacity: 0.5; cursor: not-allowed; }
    .fmt-btn[aria-busy='true'] { cursor: progress; }

    .fmt-btn .label {
      max-width: 100%;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .fmt-btn .ext {
      font-size: 10px;
      padding: 1px 6px;
      border-radius: 10px;
      background: var(--ref-palette-neutral-400, #e8e8e8);
      color: var(--ref-palette-neutral-1100, #1a1a1a);
      font-weight: 600;
      letter-spacing: 0.04em;
      white-space: nowrap;
    }
    @media (forced-colors: active) {
      .fmt-btn { border-color: CanvasText; }
      .fmt-btn:focus-visible { outline-color: Highlight; }
    }

    .spinner {
      width: 14px; height: 14px;
      border: 2px solid currentColor;
      border-top-color: transparent;
      border-radius: 50%;
      animation: csvg-spin 0.7s linear infinite;
    }
    @keyframes csvg-spin { to { transform: rotate(360deg); } }
    @media (prefers-reduced-motion: reduce) {
      .spinner { animation-duration: 0s; border-top-color: currentColor; }
      .fmt-btn { transition: none; }
    }

    .status, .err {
      font-size: 12px; line-height: 1.4;
      padding: 8px 10px;
      border-radius: 6px;
      display: flex; align-items: flex-start; gap: 8px;
    }
    .status {
      background: color-mix(in srgb, var(--sys-color-success-main, #2e7d32) 8%, var(--ref-palette-neutral-100, #fff));
      color: var(--sys-color-success-main, #2e7d32);
      border: 1px solid var(--sys-color-success-main, #2e7d32);
    }
    .err {
      background: color-mix(in srgb, var(--sys-color-error-main, #d32f2f) 8%, var(--ref-palette-neutral-100, #fff));
      color: var(--sys-color-error-main, #d32f2f);
      border: 1px solid var(--sys-color-error-main, #d32f2f);
    }

    .sr-only {
      position: absolute; width: 1px; height: 1px;
      padding: 0; margin: -1px; overflow: hidden;
      clip: rect(0,0,0,0); white-space: nowrap; border: 0;
    }
  `

    const noMatchHintId = 'csvg-no-match-hint'

    return (
        <div css={styles}>
            <div className='summary'>
                <span>
                    <strong>{matched.length.toLocaleString()}</strong> matched point{matched.length === 1 ? '' : 's'} ready to export
                </span>
                <Tooltip text='Only matched points are included. Failed records (no candidate or below the score threshold) are skipped.' />
            </div>

            <div className='grid' role='group' aria-label='Export format options'>
                {FORMATS.map(f => {
                    const isBusy = busy === f.id
                    return (
                        <button
                            key={f.id}
                            type='button'
                            className='fmt-btn'
                            onClick={() => { void run(f.id) }}
                            disabled={!canExport || busy !== null}
                            aria-busy={isBusy}
                            aria-label={f.ariaLabel}
                            aria-describedby={!canExport ? noMatchHintId : undefined}
                        >
                            {isBusy
                                ? <span className='spinner' role='presentation' />
                                : (f.iconKey === 'file' ? fileSvg : zipSvg)}
                            <span className='label'>{f.label}</span>
                            <span className='ext' aria-hidden='true'>{f.ext}</span>
                        </button>
                    )
                })}
            </div>

            {!canExport && (
                <span id={noMatchHintId} className='sr-only'>
                    No matched points to export. Re-run geocoding with a lower minimum match score, or check that the address fields are mapped correctly.
                </span>
            )}

            {lastExport && !error && (
                <div className='status' role='status' aria-live='polite'>
                    <svg width='14' height='14' viewBox='0 0 24 24' fill='none' aria-hidden='true' focusable='false'>
                        <path d='M5 12l5 5L20 7' stroke='currentColor' strokeWidth='3' strokeLinecap='round' strokeLinejoin='round' />
                    </svg>
                    <span>Downloaded <strong>{lastExport}</strong></span>
                </div>
            )}

            {error && (
                <div className='err' role='alert'>
                    <svg width='14' height='14' viewBox='0 0 24 24' fill='none' aria-hidden='true' focusable='false' style={{ flexShrink: 0, marginTop: 1 }}>
                        <circle cx='12' cy='12' r='10' stroke='currentColor' strokeWidth='2' />
                        <path d='M12 8v4m0 4h.01' stroke='currentColor' strokeWidth='2' strokeLinecap='round' />
                    </svg>
                    <span>{error}</span>
                </div>
            )}
        </div>
    )
}

export default ExportBar
