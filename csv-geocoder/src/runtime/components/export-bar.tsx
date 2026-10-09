import { React, jsx, css } from 'jimu-core'
import type { ParsedTable } from '../utils/parse-file'
import type { GeocodeResult } from '../utils/geocoder'
import type { FieldMapping } from './field-mapper'
import {
    exportGeoJSON, exportKML, exportShapefile, exportCSV, exportXLSX,
    downloadBlob, exportFileName, countByStatus, filterByScope,
    type TableScope
} from '../utils/exporters'
import Tooltip from './tooltip'
import { hooks as __exbI18nHooks } from 'jimu-core';
import __exbI18nMessages from '../translations/default';
import { __setIntl, __t } from '../i18n-t'


interface Props {
    table: ParsedTable
    results: GeocodeResult[]
    /** Column mapping the run used, for the SUBMITTED_ADDRESS column. */
    mapping: FieldMapping
    symbolColor: string
    locatorUrl: string
    minScore: number
    /** Called after a file downloads, for telemetry. */
    onExported?: (format: FormatId, scope: TableScope | 'matched-points') => void
    /** Called when an export throws, for telemetry. */
    onExportError?: (error: unknown, format: FormatId) => void
}

export type FormatId = 'csv' | 'xlsx' | 'geojson' | 'kml' | 'shp'
type Busy = FormatId | null

interface FormatDef {
    id: FormatId
    label: string
    ext: string
    iconKey: 'file' | 'zip' | 'table'
}

const TABLE_FORMATS: FormatDef[] = [
    { id: 'csv', label: 'CSV', ext: '.csv', iconKey: 'table' },
    { id: 'xlsx', label: __t("excel"), ext: '.xlsx', iconKey: 'table' }
]

const MAP_FORMATS: FormatDef[] = [
    { id: 'geojson', label: __t("geoJSON"), ext: '.geojson', iconKey: 'file' },
    { id: 'kml', label: 'KML', ext: '.kml', iconKey: 'file' },
    { id: 'shp', label: __t("shapefile"), ext: '.zip', iconKey: 'zip' }
]

const FORMAT_LABEL: { [K in FormatId]: string } = {
    csv: 'CSV', xlsx: 'Excel', geojson: 'GeoJSON', kml: 'KML', shp: 'Shapefile'
}

const SCOPES: Array<{ id: TableScope, label: string }> = [
    { id: 'all', label: __t("allRows") },
    { id: 'unmatched', label: __t("failed") },
    { id: 'matched', label: __t("matched") }
]

const SCOPE_FILE_LABEL: { [K in TableScope]: string } = {
    all: 'address_check',
    unmatched: 'unmatched',
    matched: 'matched'
}

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
const tableSvg = (
    <svg width='16' height='16' viewBox='0 0 24 24' fill='none' aria-hidden='true' focusable='false'>
        <rect x='3' y='4' width='18' height='16' rx='2' stroke='currentColor' strokeWidth='2' />
        <path d='M3 9h18M3 14h18M9 9v11M15 9v11' stroke='currentColor' strokeWidth='1.5' />
    </svg>
)
const iconFor = (k: FormatDef['iconKey']): React.ReactElement =>
    k === 'zip' ? zipSvg : k === 'table' ? tableSvg : fileSvg

const ExportBar = (props: Props): React.ReactElement => {
  __setIntl((props as any).intl)
  const t = __exbI18nHooks.useTranslation(__exbI18nMessages);
    const { table, results, mapping, symbolColor, locatorUrl, minScore, onExported, onExportError } = props
    const [busy, setBusy] = React.useState<Busy>(null)
    const [error, setError] = React.useState<string | null>(null)
    const [lastExport, setLastExport] = React.useState<string | null>(null)
    const [scope, setScope] = React.useState<TableScope>('all')
    const scopeRefs = React.useRef<Array<HTMLButtonElement | null>>([])
    const scopeLabelId = React.useId()
    const noMatchHintId = React.useId()
    const emptyScopeHintId = React.useId()

    const counts = React.useMemo(() => countByStatus(results), [results])
    const matched = React.useMemo(() => results.filter(r => r.point), [results])
    const scopeCount: { [K in TableScope]: number } = {
        all: counts.total,
        matched: counts.matched,
        unmatched: counts.unmatched
    }
    const canExportMap = matched.length > 0
    const canExportTable = scopeCount[scope] > 0

    const run = async (id: FormatId): Promise<void> => {
        setBusy(id)
        setError(null)
        try {
            let blob: Blob
            let fname: string
            const ctx = { table, mapping, minScore }
            if (id === 'csv') {
                blob = exportCSV(ctx, filterByScope(results, scope))
                fname = exportFileName(table.fileName, SCOPE_FILE_LABEL[scope], '.csv')
            } else if (id === 'xlsx') {
                blob = exportXLSX(ctx, results, scope, { locatorUrl, minScore })
                fname = exportFileName(table.fileName, SCOPE_FILE_LABEL[scope], '.xlsx')
            } else if (id === 'geojson') {
                blob = exportGeoJSON(table, matched)
                fname = exportFileName(table.fileName, 'geocoded', '.geojson')
            } else if (id === 'kml') {
                blob = exportKML(table, matched, symbolColor)
                fname = exportFileName(table.fileName, 'geocoded', '.kml')
            } else {
                blob = await exportShapefile(table, matched)
                fname = exportFileName(table.fileName, 'geocoded_shapefile', '.zip')
            }
            downloadBlob(blob, fname)
            setLastExport(fname)
            onExported?.(id, id === 'csv' || id === 'xlsx' ? scope : 'matched-points')
        } catch (e) {
            onExportError?.(e, id)
            setError(__t("couldNotExportValueValue2", { value: FORMAT_LABEL[id], value2: e instanceof Error ? e.message : String(e) }))
        } finally {
            setBusy(null)
        }
    }

    // Roving focus for the scope radio group: arrows move and select, the way a
    // native radio group behaves.
    const onScopeKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, index: number): void => {
        const keys = ['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp', 'Home', 'End']
        if (keys.indexOf(event.key) < 0) return
        event.preventDefault()
        let next = index
        if (event.key === 'ArrowRight' || event.key === 'ArrowDown') next = (index + 1) % SCOPES.length
        if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') next = (index - 1 + SCOPES.length) % SCOPES.length
        if (event.key === 'Home') next = 0
        if (event.key === 'End') next = SCOPES.length - 1
        setScope(SCOPES[next].id)
        scopeRefs.current[next]?.focus()
    }

    const styles = css`
    display: flex; flex-direction: column; gap: 12px;

    .group {
      display: flex; flex-direction: column; gap: 8px;
    }
    .group + .group {
      padding-top: 12px;
      border-top: 1px solid var(--ref-palette-neutral-500, #d0d0d0);
    }
    .group-head {
      display: flex; align-items: center; gap: 6px;
    }
    .group-title {
      margin: 0;
      font-size: 12px; font-weight: 700; line-height: 1.2;
      color: var(--ref-palette-neutral-1100, #1a1a1a);
    }
    .group-note {
      margin: 0;
      font-size: 12px; line-height: 1.4;
      color: var(--ref-palette-neutral-1000, #595959);
    }

    /* Scope segmented control */
    .scope {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      border: 1px solid var(--ref-palette-neutral-700, #a0a0a0);
      border-radius: 8px;
      overflow: hidden;
    }
    .scope-btn {
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      gap: 1px;
      min-height: 44px;
      min-width: 0;
      padding: 6px 4px;
      font: 600 12px/1.2 inherit;
      background: var(--ref-palette-neutral-100, #fff);
      color: var(--ref-palette-neutral-1100, #1a1a1a);
      border: 0;
      border-right: 1px solid var(--ref-palette-neutral-700, #a0a0a0);
      cursor: pointer;
      text-align: center;
    }
    .scope-btn:last-of-type { border-right: 0; }
    .scope-btn:hover:not([aria-checked='true']) {
      background: var(--ref-palette-neutral-300, #f0f0f0);
    }
    .scope-btn[aria-checked='true'] {
      background: var(--sys-color-primary-main, #0079c1);
      color: #fff;
    }
    .scope-btn:focus-visible {
      outline: 2px solid var(--sys-color-primary-main, #0079c1);
      outline-offset: -4px;
    }
    .scope-btn[aria-checked='true']:focus-visible { outline-color: #fff; }
    .scope-btn .scope-label {
      max-width: 100%;
      overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    }
    .scope-btn .scope-count {
      font-size: 11px; font-weight: 500; opacity: .9;
    }

    /* Format buttons */
    .grid {
      display: grid;
      gap: 8px;
    }
    .grid.two   { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .grid.three { grid-template-columns: repeat(3, minmax(0, 1fr)); }
    @media (max-width: 320px) {
      .grid.two, .grid.three, .scope { grid-template-columns: 1fr; }
      .scope-btn { border-right: 0; border-bottom: 1px solid var(--ref-palette-neutral-700, #a0a0a0); }
      .scope-btn:last-of-type { border-bottom: 0; }
    }

    .fmt-btn {
      display: inline-flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 4px;
      padding: 10px 6px;
      min-height: 72px;
      min-width: 0;
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
      .fmt-btn, .scope, .scope-btn { border-color: CanvasText; }
      .fmt-btn:focus-visible, .scope-btn:focus-visible { outline-color: Highlight; }
      .scope-btn[aria-checked='true'] { background: Highlight; color: HighlightText; }
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
      overflow-wrap: anywhere;
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

    const scopeNote = scope === 'unmatched'
        ? 'Only the rows that did not match, with the reason for each. Hand this list to whoever is checking the addresses.'
        : scope === 'matched'
            ? 'Only the rows that matched, with the address the locator matched them to.'
            : 'Every row from your file with its match result added. Excel also gets Unmatched and Matched sheets.'

    const renderFormat = (f: FormatDef, enabled: boolean, describedBy: string | undefined, aria: string): React.ReactElement => {
        const isBusy = busy === f.id
        return (
            <button
                key={f.id}
                type='button'
                className='fmt-btn'
                onClick={() => { void run(f.id) }}
                disabled={!enabled || busy !== null}
                aria-busy={isBusy}
                aria-label={aria}
                aria-describedby={!enabled ? describedBy : undefined}
            >
                {isBusy
                    ? <span className='spinner' role='presentation' />
                    : iconFor(f.iconKey)}
                <span className='label'>{f.label}</span>
                <span className='ext' aria-hidden='true'>{f.ext}</span>
            </button>
        )
    }

    const scopeWord = scope === 'all' ? 'all rows' : scope === 'unmatched' ? 'unmatched rows' : 'matched rows'

    return (
        <div css={styles}>
            {/* ---- Address check table -------------------------------------- */}
            <div className='group' role='group' aria-labelledby={scopeLabelId}>
                <div className='group-head'>
                    <h4 id={scopeLabelId} className='group-title'>{t('addressCheckTable')}</h4>
                    <Tooltip text={t('aSpreadsheetOfYourRowsWith')} />
                </div>

                <div className='scope' role='radiogroup' aria-label={t('rowsToInclude')}>
                    {SCOPES.map((s, i) => {
                        const checked = scope === s.id
                        return (
                            <button
                                key={s.id}
                                ref={el => { scopeRefs.current[i] = el }}
                                type='button'
                                role='radio'
                                aria-checked={checked}
                                tabIndex={checked ? 0 : -1}
                                className='scope-btn'
                                onClick={() => { setScope(s.id) }}
                                onKeyDown={e => { onScopeKeyDown(e, i) }}
                            >
                                <span className='scope-label'>{s.label}</span>
                                <span className='scope-count'>{scopeCount[s.id].toLocaleString()}</span>
                            </button>
                        )
                    })}
                </div>
                <p className='group-note' aria-live='polite'>{scopeNote}</p>

                <div className='grid two'>
                    {TABLE_FORMATS.map(f => renderFormat(
                        f,
                        canExportTable,
                        emptyScopeHintId,
                        t('exportScopeWordAsLabel', { scopeWord, label: f.label })
                    ))}
                </div>
                {!canExportTable && (
                    <span id={emptyScopeHintId} className='sr-only'>
                        {t('thereAreNoScopeWordToExport', { scopeWord })}
                    </span>
                )}
            </div>

            {/* ---- Map files -------------------------------------------------- */}
            <div className='group' role='group' aria-label={t('mapFileExport')}>
                <div className='group-head'>
                    <h4 className='group-title'>{t('mapFile')}</h4>
                    <Tooltip text={t('matchedPointsOnlySinceARow')} />
                </div>
                <p className='group-note'>
                    {(matched.length === 1 ? t('matchedCountMatchedPoint', { matchedCount: matched.length.toLocaleString() }) : t('matchedCountMatchedPoints', { matchedCount: matched.length.toLocaleString() }))}
                </p>
                <div className='grid three'>
                    {MAP_FORMATS.map(f => renderFormat(
                        f,
                        canExportMap,
                        noMatchHintId,
                        t('exportMatchedPointsAsId', { id: f.id === 'shp' ? t('aZippedShapefile') : f.label })
                    ))}
                </div>
                {!canExportMap && (
                    <span id={noMatchHintId} className='sr-only'>
                        {t('noMatchedPointsToExportRe')}
                    </span>
                )}
            </div>

            {lastExport && !error && (
                <div className='status' role='status' aria-live='polite'>
                    <svg width='14' height='14' viewBox='0 0 24 24' fill='none' aria-hidden='true' focusable='false' style={{ flexShrink: 0, marginTop: 1 }}>
                        <path d='M5 12l5 5L20 7' stroke='currentColor' strokeWidth='3' strokeLinecap='round' strokeLinejoin='round' />
                    </svg>
                    <span className='status-text'>{t('downloaded')} <strong className='status-file'>{lastExport}</strong></span>
                </div>
            )}

            {error && (
                <div className='err' role='alert'>
                    <svg width='14' height='14' viewBox='0 0 24 24' fill='none' aria-hidden='true' focusable='false' style={{ flexShrink: 0, marginTop: 1 }}>
                        <circle cx='12' cy='12' r='10' stroke='currentColor' strokeWidth='2' />
                        <path d='M12 8v4m0 4h.01' stroke='currentColor' strokeWidth='2' strokeLinecap='round' />
                    </svg>
                    <span className='err-text'>{error}</span>
                </div>
            )}
        </div>
    )
}

export default ExportBar
