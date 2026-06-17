/** @jsx jsx */
import {
  React, jsx, css, type AllWidgetProps, hooks
} from 'jimu-core'
import { JimuMapViewComponent, type JimuMapView } from 'jimu-arcgis'

import Graphic from '@arcgis/core/Graphic'
import GraphicsLayer from '@arcgis/core/layers/GraphicsLayer'
import SimpleMarkerSymbol from '@arcgis/core/symbols/SimpleMarkerSymbol'
import PopupTemplate from '@arcgis/core/PopupTemplate'
import * as reactiveUtils from '@arcgis/core/core/reactiveUtils'

import type { IMConfig, AddressRole } from '../config'
import { parseAddressFile, guessAddressMapping, type ParsedTable } from './utils/parse-file'
import { geocodeBatch, type GeocodeResult, type GeocodeInput } from './utils/geocoder'

import FileUpload from './components/file-upload'
import FieldMapper, { type FieldMapping, validateMapping } from './components/field-mapper'
import Tooltip from './components/tooltip'
import ExportBar from './components/export-bar'

type Phase = 'idle' | 'parsing' | 'mapping' | 'geocoding' | 'done' | 'error'

interface State {
  phase: Phase
  table: ParsedTable | null
  mapping: FieldMapping
  progress: { completed: number, total: number }
  results: GeocodeResult[] | null
  error: string | null
  jmv: JimuMapView | null
}

const initialMapping = (): FieldMapping => ({ mode: 'multi', multi: {} })

// =============================================================================
// Step indicator (3 dots + labels)
// =============================================================================
// Communicates current phase visually AND via aria-current so screen readers
// announce the active step. Icon + label so colour is not the sole signal.
// =============================================================================
const StepIndicator: React.FC<{ phase: Phase }> = ({ phase }) => {
  const stepFor = (p: Phase): 1 | 2 | 3 | 4 => {
    if (p === 'idle' || p === 'parsing') return 1
    if (p === 'mapping') return 2
    if (p === 'geocoding') return 3
    return 4 // 'done' | 'error' after geocoding
  }
  const current = stepFor(phase)
  const steps: Array<{ n: 1 | 2 | 3 | 4, label: string }> = [
    { n: 1, label: 'Upload' },
    { n: 2, label: 'Map' },
    { n: 3, label: 'Geocode' },
    { n: 4, label: 'Export' }
  ]

  const styles = css`
    display: flex; align-items: center; gap: 0;
    padding: 4px 0 8px;

    .step {
      display: flex; align-items: center; gap: 8px;
      flex-shrink: 0;
    }
    .dot {
      width: 22px; height: 22px;
      border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
      font: 600 11px/1 system-ui, sans-serif;
      background: var(--ref-palette-neutral-400, #e8e8e8);
      color: var(--ref-palette-neutral-1000, #595959);
      border: 1.5px solid transparent;
      flex-shrink: 0;
    }
    .step.active .dot {
      background: var(--sys-color-primary-main, #0079c1);
      color: #fff;
      box-shadow: 0 0 0 3px color-mix(in srgb, var(--sys-color-primary-main, #0079c1) 22%, transparent);
    }
    .step.done .dot {
      background: var(--sys-color-success-main, #2e7d32);
      color: #fff;
    }
    .label {
      font-size: 12px; font-weight: 500;
      color: var(--ref-palette-neutral-1000, #595959);
    }
    .step.active .label, .step.done .label {
      color: var(--ref-palette-neutral-1100, #1a1a1a);
      font-weight: 600;
    }
    .bar {
      flex: 1;
      height: 2px;
      background: var(--ref-palette-neutral-400, #e8e8e8);
      margin: 0 10px;
      border-radius: 1px;
    }
    .bar.filled {
      background: var(--sys-color-success-main, #2e7d32);
    }
  `

  return (
    <ol css={styles} aria-label='Workflow progress'>
      {steps.map((s, i) => {
        const isActive = s.n === current
        const isDone = s.n < current || (phase === 'done' && s.n <= 3)
        return (
          <React.Fragment key={s.n}>
            <li
              className={`step ${isActive && !isDone ? 'active' : ''} ${isDone ? 'done' : ''}`}
              aria-current={isActive ? 'step' : undefined}
            >
              <span className='dot' aria-hidden='true'>
                {isDone
                  ? (<svg width='12' height='12' viewBox='0 0 24 24' fill='none'>
                      <path d='M5 12l5 5L20 7' stroke='currentColor' strokeWidth='3' strokeLinecap='round' strokeLinejoin='round'/>
                    </svg>)
                  : s.n}
              </span>
              <span className='label'>{s.label}</span>
            </li>
            {i < steps.length - 1 && <span className={`bar ${isDone ? 'filled' : ''}`} aria-hidden='true' />}
          </React.Fragment>
        )
      })}
    </ol>
  )
}

// =============================================================================
// Inline stat card – icon + number + label so meaning is not colour-only.
// =============================================================================
const StatCard: React.FC<{
  value: React.ReactNode
  label: string
  tone: 'success' | 'error' | 'neutral'
  icon: React.ReactNode
}> = ({ value, label, tone, icon }) => {
  const styles = css`
    flex: 1 1 120px;
    min-width: 0;
    display: flex; align-items: center; gap: 10px;
    padding: 10px 12px;
    background: var(--ref-palette-neutral-100, #fff);
    border: 1px solid var(--ref-palette-neutral-600, #b5b5b5);
    border-radius: 8px;

    .icon {
      width: 28px; height: 28px;
      border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
      color: #fff;
      flex-shrink: 0;
    }
    &.success .icon { background: var(--sys-color-success-main, #2e7d32); }
    &.error   .icon { background: var(--sys-color-error-main, #d32f2f); }
    &.neutral .icon { background: var(--sys-color-primary-main, #0079c1); }

    .text { display: flex; flex-direction: column; line-height: 1.2; }
    .v    { font-size: 18px; font-weight: 700; color: var(--ref-palette-neutral-1100, #1a1a1a); }
    .l    { font-size: 11px; color: var(--ref-palette-neutral-1000, #595959); }
  `
  return (
    <div css={styles} className={tone}>
      <span className='icon' aria-hidden='true'>{icon}</span>
      <span className='text'>
        <span className='v'>{value}</span>
        <span className='l'>{label}</span>
      </span>
    </div>
  )
}

// =============================================================================
// Widget
// =============================================================================
const Widget = (props: AllWidgetProps<IMConfig>): React.ReactElement => {
  const { useMapWidgetIds, config } = props

  const [state, setState] = React.useState<State>({
    phase: 'idle',
    table: null,
    mapping: { ...initialMapping(), mode: config?.defaultAddressMode ?? 'multi' },
    progress: { completed: 0, total: 0 },
    results: null,
    error: null,
    jmv: null
  })

  const layerRef = React.useRef<GraphicsLayer | null>(null)
  const abortRef = React.useRef<AbortController | null>(null)

  const ensureLayer = React.useCallback((jmv: JimuMapView): GraphicsLayer => {
    if (layerRef.current) return layerRef.current
    const layer = new GraphicsLayer({ title: 'Geocoded addresses', listMode: 'show' })
    jmv.view.map.add(layer)
    layerRef.current = layer
    return layer
  }, [])

  hooks.useUnmount(() => {
    abortRef.current?.abort()
    const layer = layerRef.current
    const jmv = state.jmv
    if (layer && jmv) {
      try { jmv.view.map.remove(layer) } catch { /* view already gone */ }
    }
  })

  // -- File handling ---------------------------------------------------------
  const onFile = async (file: File): Promise<void> => {
    setState(s => ({ ...s, phase: 'parsing', error: null, results: null }))
    try {
      const table = await parseAddressFile(file)
      if (table.rows.length === 0) {
        setState(s => ({ ...s, phase: 'error', error: 'File is empty or has no readable rows.' }))
        return
      }
      const guess = guessAddressMapping(table.fields)
      const mapping: FieldMapping = {
        mode: config?.defaultAddressMode ?? 'multi',
        singleField: guess.single,
        multi: guess.multi
      }
      setState(s => ({ ...s, phase: 'mapping', table, mapping }))
    } catch (e) {
      setState(s => ({
        ...s,
        phase: 'error',
        error: `Could not read file: ${e instanceof Error ? e.message : String(e)}`
      }))
    }
  }

  const buildInputs = (table: ParsedTable, m: FieldMapping): GeocodeInput[] => {
    return table.rows.map((row, idx) => {
      if (m.mode === 'single') {
        const col = m.singleField ?? ''
        return { objectId: idx, address: row[col] ?? '' }
      }
      const out: { [K in AddressRole]?: string } = {}
      for (const role of Object.keys(m.multi) as AddressRole[]) {
        const col = m.multi[role]
        if (col) out[role] = row[col] ?? ''
      }
      return { objectId: idx, address: out }
    })
  }

  const onRunGeocode = async (): Promise<void> => {
    if (!state.table) return
    const validationError = validateMapping(state.mapping)
    if (validationError) {
      setState(s => ({ ...s, error: validationError }))
      return
    }
    if (!state.jmv) {
      setState(s => ({ ...s, error: 'Select a map widget in the widget settings.' }))
      return
    }

    const inputs = buildInputs(state.table, state.mapping)
    const ac = new AbortController()
    abortRef.current = ac

    setState(s => ({
      ...s,
      phase: 'geocoding',
      progress: { completed: 0, total: inputs.length },
      error: null
    }))

    try {
      const results = await geocodeBatch(inputs, {
        url: config.geocoderUrl,
        apiKey: config.apiKey || undefined,
        batchSize: config.batchSize,
        minScore: config.minScore,
        signal: ac.signal,
        onProgress: (completed, total) => {
          setState(s => ({ ...s, progress: { completed, total } }))
        }
      })
      renderResultsOnMap(results)
      setState(s => ({ ...s, phase: 'done', results }))
    } catch (e) {
      if ((e as Error).name === 'AbortError') {
        setState(s => ({ ...s, phase: 'mapping', error: 'Geocoding cancelled.' }))
        return
      }
      setState(s => ({
        ...s,
        phase: 'error',
        error: `Geocoding failed: ${e instanceof Error ? e.message : String(e)}`
      }))
    }
  }

  const renderResultsOnMap = (results: GeocodeResult[]): void => {
    const jmv = state.jmv
    const table = state.table
    if (!jmv || !table) return

    const layer = ensureLayer(jmv)
    layer.removeAll()

    const symbol = new SimpleMarkerSymbol({
      color: config.symbol.color,
      size: config.symbol.size,
      outline: { color: config.symbol.outlineColor, width: config.symbol.outlineWidth }
    })

    const fieldInfos = table.fields.map(f => ({ fieldName: f, label: f }))
    fieldInfos.push({ fieldName: '__score', label: 'Match score' })
    fieldInfos.push({ fieldName: '__match', label: 'Match address' })
    const popupTemplate = new PopupTemplate({
      title: '{__match}',
      content: [{ type: 'fields', fieldInfos }]
    })

    const graphics: Graphic[] = []
    for (const r of results) {
      if (!r.point) continue
      const row = table.rows[r.objectId]
      graphics.push(new Graphic({
        geometry: r.point,
        symbol,
        attributes: { ...row, __score: r.score, __match: r.matchAddress },
        popupTemplate
      }))
    }
    layer.addMany(graphics)

    if (config.zoomToResults && graphics.length > 0) {
      void reactiveUtils.whenOnce(() => jmv.view.ready)
        .then(async () => { await jmv.view.goTo(graphics, { animate: true }) })
        .catch(() => { /* ignore goTo edge cases */ })
    }
  }

  const onClear = (): void => {
    layerRef.current?.removeAll()
    setState(s => ({
      ...s,
      phase: 'idle',
      table: null,
      results: null,
      error: null,
      progress: { completed: 0, total: 0 },
      mapping: { ...initialMapping(), mode: config?.defaultAddressMode ?? 'multi' }
    }))
  }
  const onCancel = (): void => { abortRef.current?.abort() }

  // -- Derived ---------------------------------------------------------------
  const successCount = (state.results ?? []).filter(r => r.point).length
  const failureCount = (state.results?.length ?? 0) - successCount
  const matchRate = state.results && state.results.length > 0
    ? Math.round(100 * successCount / state.results.length)
    : 0
  const progressPct = state.progress.total > 0
    ? Math.round((state.progress.completed / state.progress.total) * 100)
    : 0
  const isBusy = state.phase === 'parsing' || state.phase === 'geocoding'

  // -- Styles ---------------------------------------------------------------
  const wrap = css`
    height: 100%; width: 100%; box-sizing: border-box;
    display: flex; flex-direction: column;
    padding: 14px; gap: 12px; overflow: auto;
    font-family: inherit;
    color: var(--ref-palette-neutral-1100, #1a1a1a);
    background: var(--ref-palette-neutral-100, #fff);

    .card {
      background: var(--ref-palette-neutral-200, #fafafa);
      border: 1px solid var(--ref-palette-neutral-500, #d0d0d0);
      border-radius: 10px;
      padding: 14px;
      display: flex; flex-direction: column; gap: 10px;
    }
    .card-head {
      display: flex; align-items: center; gap: 6px;
    }
    .card-title {
      margin: 0;
      font-size: 13px; font-weight: 600; line-height: 1.2;
      color: var(--ref-palette-neutral-1100, #1a1a1a);
    }
    .meta {
      font-size: 11px;
      color: var(--ref-palette-neutral-1100, #1a1a1a);
      opacity: 0.75;
    }

    .progress-track {
      width: 100%; height: 10px;
      background: var(--ref-palette-neutral-400, #e8e8e8);
      border: 1px solid var(--ref-palette-neutral-600, #b5b5b5);
      border-radius: 5px;
      overflow: hidden;
    }
    .progress-fill {
      height: 100%;
      background: var(--sys-color-primary-main, #0079c1);
      transition: width .2s ease;
    }
    .progress-text {
      display: flex; justify-content: space-between;
      font-size: 12px;
      color: var(--ref-palette-neutral-1100, #1a1a1a);
    }

    .stats { display: flex; gap: 10px; flex-wrap: wrap; }

    .actions {
      display: flex; gap: 8px; justify-content: flex-end;
      padding-top: 4px;
      flex-wrap: wrap;
    }

    .btn {
      display: inline-flex; align-items: center; justify-content: center; gap: 6px;
      min-height: 36px;
      padding: 7px 14px;
      font: 600 13px/1.2 inherit;
      border-radius: 6px;
      cursor: pointer;
      transition: background .12s ease, box-shadow .12s ease, border-color .12s ease;
      border: 1px solid transparent;
    }
    .btn:focus-visible {
      outline: 2px solid var(--sys-color-primary-main, #0079c1);
      outline-offset: 2px;
    }
    .btn[disabled] { opacity: 0.45; cursor: not-allowed; }

    .btn.primary {
      background: var(--sys-color-primary-main, #0079c1);
      color: #fff;
    }
    .btn.primary:hover:not([disabled]) {
      background: color-mix(in srgb, var(--sys-color-primary-main, #0079c1) 88%, #000);
    }
    .btn.secondary {
      background: var(--ref-palette-neutral-100, #fff);
      color: var(--ref-palette-neutral-1100, #1a1a1a);
      border-color: var(--ref-palette-neutral-600, #b5b5b5);
    }
    .btn.secondary:hover:not([disabled]) {
      background: var(--ref-palette-neutral-300, #f0f0f0);
    }
    .btn.danger {
      background: var(--sys-color-error-main, #d32f2f);
      color: #fff;
    }

    .banner {
      display: flex; align-items: flex-start; gap: 10px;
      padding: 10px 12px;
      border-radius: 8px;
      font-size: 12px; line-height: 1.4;
    }
    .banner.error {
      background: color-mix(in srgb, var(--sys-color-error-main, #d32f2f) 10%, var(--ref-palette-neutral-100, #fff));
      border: 1px solid var(--sys-color-error-main, #d32f2f);
      color: var(--sys-color-error-main, #d32f2f);
    }
    .banner.warn {
      background: color-mix(in srgb, var(--sys-color-warning-main, #ed6c02) 10%, var(--ref-palette-neutral-100, #fff));
      border: 1px solid var(--sys-color-warning-main, #ed6c02);
      color: var(--ref-palette-neutral-1100, #1a1a1a);
    }
    .banner-icon { flex-shrink: 0; margin-top: 1px; }
    .banner button.close {
      margin-left: auto;
      width: 28px; height: 28px;
      display: inline-flex; align-items: center; justify-content: center;
      background: transparent; border: 1px solid transparent;
      border-radius: 4px;
      color: inherit; cursor: pointer; padding: 0;
      flex-shrink: 0;
    }
    .banner button.close:hover {
      background: rgba(0,0,0,0.06);
    }
    .banner button.close:focus-visible {
      outline: 2px solid currentColor;
      outline-offset: 2px;
    }

    /* Reduced motion */
    @media (prefers-reduced-motion: reduce) {
      .progress-fill, .btn, .banner button.close {
        transition: none;
      }
    }
    /* Forced colors / Windows high-contrast */
    @media (forced-colors: active) {
      .card { border-color: CanvasText; }
      .btn { border-color: CanvasText; }
      .btn:focus-visible { outline-color: Highlight; }
      .progress-track { border: 1px solid CanvasText; }
      .progress-fill { background: Highlight; }
      .banner { border-color: CanvasText; }
    }
  `

  // Human-readable phase summary for screen readers via a polite live region.
  // Updates whenever phase changes so AT users hear "Reading file…",
  // "Geocoding…", "Geocoding complete — 32 of 40 matched." etc.
  const phaseAnnouncement = React.useMemo((): string => {
    switch (state.phase) {
      case 'parsing': return 'Reading file.'
      case 'mapping':
        return state.table
          ? `File loaded. ${state.table.rows.length.toLocaleString()} rows ready to map.`
          : ''
      case 'geocoding':
        return `Geocoding ${state.progress.completed.toLocaleString()} of ${state.progress.total.toLocaleString()}.`
      case 'done':
        return state.results
          ? `Geocoding complete. ${successCount.toLocaleString()} of ${state.results.length.toLocaleString()} matched.`
          : ''
      case 'error': return state.error ?? 'An error occurred.'
      default: return ''
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.phase, state.results, state.progress.completed, state.progress.total])

  // Focus the error banner when one appears so AT and keyboard users notice it.
  const errorRef = React.useRef<HTMLDivElement>(null)
  React.useEffect(() => {
    if (state.error) errorRef.current?.focus()
  }, [state.error])

  // -- Render ----------------------------------------------------------------
  return (
    <main css={wrap} aria-label='Address geocoder'>
      {/* Polite live region — invisible, announces phase transitions. */}
      <span
        role='status'
        aria-live='polite'
        aria-atomic='true'
        style={{
          position: 'absolute', width: 1, height: 1, padding: 0, margin: -1,
          overflow: 'hidden', clip: 'rect(0,0,0,0)', whiteSpace: 'nowrap', border: 0
        }}
      >{phaseAnnouncement}</span>

      {/* Map widget binding (renders nothing visible). */}
      {useMapWidgetIds && useMapWidgetIds.length > 0 && (
        <JimuMapViewComponent
          useMapWidgetId={useMapWidgetIds[0]}
          onActiveViewChange={jmv => {
            setState(s => ({ ...s, jmv: jmv ?? null }))
          }}
        />
      )}

      <StepIndicator phase={state.phase} />

      {/* ------- 1. Upload --------------------------------------------- */}
      <section className='card' aria-labelledby='csvg-card-upload'>
        <div className='card-head'>
          <h3 id='csvg-card-upload' className='card-title'>1. Choose a file</h3>
          <Tooltip text='Supported formats: CSV, TSV, TXT, XLSX, XLS, ODS. The first row is used as column headers.' />
        </div>
        <FileUpload
          onFile={onFile}
          disabled={isBusy}
          fileName={state.table?.fileName}
        />
      </section>

      {/* ------- 2. Map fields ----------------------------------------- */}
      {state.table && (
        <section className='card' aria-labelledby='csvg-card-map'>
          <div className='card-head'>
            <h3 id='csvg-card-map' className='card-title'>2. Map address fields</h3>
            <Tooltip text='Pick which column(s) hold the address. Use "Single full address" if one column has the entire address, or "Separate columns" to map individual parts.' />
          </div>
          <div className='meta'>
            {state.table.rows.length.toLocaleString()} rows · {state.table.fields.length} columns
          </div>
          <FieldMapper
            fields={state.table.fields}
            value={state.mapping}
            onChange={m => {
              setState(s => ({ ...s, mapping: m, error: null }))
            }}
          />
        </section>
      )}

      {/* ------- Error / warning banner --------------------------------- */}
      {state.error && (
        <div
          ref={errorRef}
          className='banner error'
          role='alert'
          tabIndex={-1}
        >
          <svg className='banner-icon' width='16' height='16' viewBox='0 0 24 24' fill='none' aria-hidden='true' focusable='false'>
            <path d='M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z' stroke='currentColor' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round'/>
          </svg>
          <span>{state.error}</span>
          <button
            type='button'
            className='close'
            aria-label='Dismiss error message'
            onClick={() => { setState(s => ({ ...s, error: null })) }}
          >
            <svg width='14' height='14' viewBox='0 0 24 24' fill='none' aria-hidden='true' focusable='false'>
              <path d='M6 6l12 12M18 6L6 18' stroke='currentColor' strokeWidth='2' strokeLinecap='round'/>
            </svg>
          </button>
        </div>
      )}

      {!useMapWidgetIds?.length && (
        <div className='banner warn' role='status'>
          <svg className='banner-icon' width='16' height='16' viewBox='0 0 24 24' fill='none' aria-hidden='true'>
            <circle cx='12' cy='12' r='10' stroke='currentColor' strokeWidth='2'/>
            <path d='M12 8v4m0 4h.01' stroke='currentColor' strokeWidth='2' strokeLinecap='round'/>
          </svg>
          <span>Open this widget’s settings and connect it to a Map widget to display geocoded points.</span>
        </div>
      )}

      {/* ------- Geocoding progress ------------------------------------ */}
      {state.phase === 'geocoding' && (
        <section className='card' aria-labelledby='csvg-card-progress'>
          <div className='card-head'>
            <h3 id='csvg-card-progress' className='card-title'>Geocoding…</h3>
          </div>
          <div
            className='progress-track'
            role='progressbar'
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={progressPct}
            aria-label='Geocoding progress'
          >
            <div className='progress-fill' style={{ width: `${progressPct}%` }} />
          </div>
          <div className='progress-text' aria-live='polite'>
            <span>{state.progress.completed.toLocaleString()} of {state.progress.total.toLocaleString()}</span>
            <span>{progressPct}%</span>
          </div>
        </section>
      )}

      {/* ------- Results ------------------------------------------------ */}
      {state.phase === 'done' && state.results && (
        <section className='card' aria-labelledby='csvg-card-results'>
          <div className='card-head'>
            <h3 id='csvg-card-results' className='card-title'>3. Results</h3>
          </div>
          <div className='stats' role='group' aria-label='Geocoding results summary'>
            <StatCard
              tone='success'
              value={successCount.toLocaleString()}
              label='Matched'
              icon={
                <svg width='14' height='14' viewBox='0 0 24 24' fill='none'>
                  <path d='M5 12l5 5L20 7' stroke='currentColor' strokeWidth='3' strokeLinecap='round' strokeLinejoin='round'/>
                </svg>
              }
            />
            <StatCard
              tone='error'
              value={failureCount.toLocaleString()}
              label='Failed'
              icon={
                <svg width='12' height='12' viewBox='0 0 24 24' fill='none'>
                  <path d='M6 6l12 12M18 6L6 18' stroke='currentColor' strokeWidth='3' strokeLinecap='round'/>
                </svg>
              }
            />
            <StatCard
              tone='neutral'
              value={`${matchRate}%`}
              label='Match rate'
              icon={
                <svg width='14' height='14' viewBox='0 0 24 24' fill='none'>
                  <path d='M3 17l6-6 4 4 8-8M14 7h7v7' stroke='currentColor' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round'/>
                </svg>
              }
            />
          </div>
        </section>
      )}

      {/* ------- 4. Export ---------------------------------------------- */}
      {state.phase === 'done' && state.results && state.table && (
        <section className='card' aria-labelledby='csvg-card-export'>
          <div className='card-head'>
            <h3 id='csvg-card-export' className='card-title'>4. Export</h3>
            <Tooltip text='Download matched points as GeoJSON (web-friendly), KML (Google Earth / web maps), or a zipped Shapefile (GIS desktop tools).' />
          </div>
          <ExportBar
            table={state.table}
            results={state.results}
            symbolColor={config.symbol.color}
          />
        </section>
      )}

      {/* ------- Actions ------------------------------------------------ */}
      <div className='actions'>
        {state.phase === 'geocoding'
          ? (
            <button type='button' className='btn danger' onClick={onCancel}>
              Cancel
            </button>
            )
          : (
            <React.Fragment>
              <button
                type='button'
                className='btn secondary'
                onClick={onClear}
                disabled={!state.table}
              >Clear</button>
              <button
                type='button'
                className='btn primary'
                onClick={() => { void onRunGeocode() }}
                disabled={!state.table || isBusy || !state.jmv}
                aria-describedby={!state.jmv ? 'csvg-no-map-hint' : undefined}
              >
                <svg width='14' height='14' viewBox='0 0 24 24' fill='none' aria-hidden='true'>
                  <path d='M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z' stroke='currentColor' strokeWidth='2'/>
                  <circle cx='12' cy='10' r='3' stroke='currentColor' strokeWidth='2'/>
                </svg>
                Geocode
              </button>
            </React.Fragment>
            )}
      </div>

      {/* sr-only hint for the disabled state of Geocode */}
      <span
        id='csvg-no-map-hint'
        style={{
          position: 'absolute', width: 1, height: 1, padding: 0, margin: -1,
          overflow: 'hidden', clip: 'rect(0,0,0,0)', whiteSpace: 'nowrap', border: 0
        }}
      >Connect a map widget in settings to enable geocoding.</span>
    </main>
  )
}

export default Widget
