/** @jsxRuntime classic */
/** @jsx jsx */
import { React, jsx, css } from 'jimu-core'
import { type AddressRole } from '../../config'
import { type ParsedTable } from '../utils/parse-file'
import { type GeocodeResult } from '../utils/geocoder'
import { type FieldMapping } from './field-mapper'

interface Props {
  panelId: string
  table: ParsedTable
  mapping: FieldMapping
  results: GeocodeResult[]
  onClose: () => void
}

type SourceRow = ParsedTable['rows'][number]

const ADDRESS_ROLES: AddressRole[] = [
  'Address',
  'Address2',
  'City',
  'Region',
  'Postal',
  'Country'
]

function cleanValue (value: string | undefined): string {
  return value?.trim() ?? ''
}

function formatSubmittedAddress (
  row: SourceRow | undefined,
  mapping: FieldMapping
): string {
  if (!row) return '(source row unavailable)'

  if (mapping.mode === 'single') {
    const value = mapping.singleField ? cleanValue(row[mapping.singleField]) : ''
    return value || '(blank address)'
  }

  const parts: string[] = []
  for (const role of ADDRESS_ROLES) {
    const field = mapping.multi[role]
    const value = field ? cleanValue(row[field]) : ''
    if (value) parts.push(value)
  }
  return parts.join(', ') || '(blank address)'
}

function failureReason (result: GeocodeResult): string {
  if (result.error) return result.error
  if (result.score > 0) return 'The locator candidate did not meet the minimum match score.'
  return 'No locator candidate was returned.'
}

const FailureReviewPanel = (props: Props): React.ReactElement => {
  const { panelId, table, mapping, results, onClose } = props
  const [query, setQuery] = React.useState('')
  const headingRef = React.useRef<HTMLHeadingElement>(null)
  const titleId = React.useId()
  const searchId = React.useId()

  React.useEffect(() => {
    headingRef.current?.focus()
  }, [])

  const failures = React.useMemo(
    () => results.filter(result => !result.point),
    [results]
  )

  const filteredFailures = React.useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    if (!normalizedQuery) return failures

    return failures.filter(result => {
      const row = table.rows[result.objectId]
      const rowValues = table.fields.map(field => row?.[field] ?? '')
      const searchableText = [
        String(result.objectId + 1),
        String(result.objectId + 2),
        formatSubmittedAddress(row, mapping),
        failureReason(result),
        result.matchAddress,
        ...rowValues
      ].join(' ').toLowerCase()

      return searchableText.indexOf(normalizedQuery) >= 0
    })
  }, [failures, mapping, query, table.fields, table.rows])

  const styles = css`
    position: absolute;
    inset: 0;
    z-index: 10;
    min-height: 0;
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 14px;
    overflow: auto;
    color: var(--ref-palette-neutral-1100, #1a1a1a);
    background: var(--ref-palette-neutral-100, #fff);

    .panel-header {
      display: grid;
      grid-template-columns: auto minmax(0, 1fr);
      align-items: start;
      gap: 10px;
      padding-bottom: 2px;
    }
    .back-button {
      width: 36px;
      height: 36px;
      padding: 0;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      border: 1px solid var(--ref-palette-neutral-600, #b5b5b5);
      border-radius: 6px;
      background: var(--ref-palette-neutral-100, #fff);
      color: var(--ref-palette-neutral-1100, #1a1a1a);
      cursor: pointer;
      flex-shrink: 0;
    }
    .back-button:hover {
      background: var(--ref-palette-neutral-300, #f0f0f0);
    }
    .back-button:focus-visible,
    .search-input:focus-visible,
    .clear-search:focus-visible,
    .footer-button:focus-visible,
    summary:focus-visible {
      outline: 2px solid var(--sys-color-primary-main, #0079c1);
      outline-offset: 2px;
    }
    .panel-title {
      margin: 0;
      font-size: 18px;
      font-weight: 700;
      line-height: 1.25;
      color: var(--ref-palette-neutral-1100, #1a1a1a);
    }
    .panel-subtitle {
      margin: 3px 0 0;
      font-size: 12px;
      line-height: 1.4;
      color: var(--ref-palette-neutral-1000, #595959);
    }

    .search-section {
      display: flex;
      flex-direction: column;
      gap: 5px;
    }
    .search-label {
      font-size: 12px;
      font-weight: 600;
      color: var(--ref-palette-neutral-1100, #1a1a1a);
    }
    .search-box {
      position: relative;
      display: flex;
      align-items: center;
    }
    .search-icon {
      position: absolute;
      left: 10px;
      pointer-events: none;
      color: var(--ref-palette-neutral-1000, #595959);
    }
    .search-input {
      width: 100%;
      min-height: 38px;
      box-sizing: border-box;
      padding: 8px 38px 8px 34px;
      font: 400 13px/1.3 inherit;
      color: var(--ref-palette-neutral-1100, #1a1a1a);
      background: var(--ref-palette-neutral-100, #fff);
      border: 1px solid var(--ref-palette-neutral-700, #a0a0a0);
      border-radius: 6px;
    }
    .clear-search {
      position: absolute;
      right: 5px;
      width: 28px;
      height: 28px;
      padding: 0;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      background: transparent;
      color: var(--ref-palette-neutral-1000, #595959);
      border: 1px solid transparent;
      border-radius: 4px;
      cursor: pointer;
    }
    .clear-search:hover {
      background: var(--ref-palette-neutral-300, #f0f0f0);
    }

    .filter-summary {
      margin: 0;
      font-size: 11px;
      color: var(--ref-palette-neutral-1000, #595959);
    }

    .failure-list {
      list-style: none;
      display: flex;
      flex-direction: column;
      gap: 10px;
      margin: 0;
      padding: 0;
    }
    .failure-card {
      display: flex;
      flex-direction: column;
      gap: 9px;
      padding: 12px;
      background: var(--ref-palette-neutral-100, #fff);
      border: 1px solid var(--ref-palette-neutral-600, #b5b5b5);
      border-left: 4px solid var(--sys-color-error-main, #d32f2f);
      border-radius: 8px;
      min-width: 0;
    }
    .failure-meta {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      flex-wrap: wrap;
    }
    .row-number {
      font-size: 12px;
      font-weight: 700;
      color: var(--ref-palette-neutral-1100, #1a1a1a);
    }
    .score {
      display: inline-flex;
      align-items: center;
      min-height: 22px;
      padding: 2px 7px;
      font-size: 11px;
      font-weight: 600;
      border-radius: 999px;
      background: var(--ref-palette-neutral-300, #f0f0f0);
      color: var(--ref-palette-neutral-1100, #1a1a1a);
    }
    .field-label {
      display: block;
      margin-bottom: 2px;
      font-size: 10px;
      font-weight: 700;
      letter-spacing: .02em;
      text-transform: uppercase;
      color: var(--ref-palette-neutral-1000, #595959);
    }
    .submitted-address,
    .candidate-address {
      overflow-wrap: anywhere;
      font-size: 13px;
      line-height: 1.4;
      color: var(--ref-palette-neutral-1100, #1a1a1a);
    }
    .reason {
      display: flex;
      align-items: flex-start;
      gap: 7px;
      padding: 8px 9px;
      font-size: 12px;
      line-height: 1.4;
      color: var(--sys-color-error-main, #b00020);
      background: color-mix(in srgb, var(--sys-color-error-main, #d32f2f) 8%, var(--ref-palette-neutral-100, #fff));
      border-radius: 6px;
    }
    .reason svg {
      flex-shrink: 0;
      margin-top: 1px;
    }
    .candidate-address {
      padding-top: 1px;
    }

    details {
      border-top: 1px solid var(--ref-palette-neutral-400, #e8e8e8);
      padding-top: 8px;
    }
    summary {
      width: fit-content;
      font-size: 12px;
      font-weight: 600;
      color: var(--sys-color-primary-main, #00619b);
      cursor: pointer;
      border-radius: 3px;
    }
    .row-fields {
      display: grid;
      grid-template-columns: minmax(90px, .7fr) minmax(0, 1.3fr);
      gap: 0;
      margin: 9px 0 0;
      border: 1px solid var(--ref-palette-neutral-400, #e8e8e8);
      border-radius: 6px;
      overflow: hidden;
    }
    .row-fields dt,
    .row-fields dd {
      margin: 0;
      padding: 7px 8px;
      font-size: 11px;
      line-height: 1.35;
      overflow-wrap: anywhere;
      border-bottom: 1px solid var(--ref-palette-neutral-400, #e8e8e8);
    }
    .row-fields dt {
      font-weight: 600;
      color: var(--ref-palette-neutral-1100, #1a1a1a);
      background: var(--ref-palette-neutral-200, #fafafa);
      border-right: 1px solid var(--ref-palette-neutral-400, #e8e8e8);
    }
    .row-fields dd {
      color: var(--ref-palette-neutral-1100, #1a1a1a);
      background: var(--ref-palette-neutral-100, #fff);
    }
    .row-fields dt:nth-last-of-type(1),
    .row-fields dd:nth-last-of-type(1) {
      border-bottom: 0;
    }
    .empty-value {
      color: var(--ref-palette-neutral-900, #737373);
      font-style: italic;
    }

    .empty-state {
      padding: 22px 16px;
      text-align: center;
      font-size: 13px;
      line-height: 1.45;
      color: var(--ref-palette-neutral-1000, #595959);
      background: var(--ref-palette-neutral-200, #fafafa);
      border: 1px dashed var(--ref-palette-neutral-600, #b5b5b5);
      border-radius: 8px;
    }

    .panel-footer {
      display: flex;
      justify-content: flex-end;
      margin-top: auto;
      padding-top: 2px;
    }
    .footer-button {
      min-height: 36px;
      padding: 7px 14px;
      font: 600 13px/1.2 inherit;
      border: 1px solid var(--ref-palette-neutral-600, #b5b5b5);
      border-radius: 6px;
      background: var(--ref-palette-neutral-100, #fff);
      color: var(--ref-palette-neutral-1100, #1a1a1a);
      cursor: pointer;
    }
    .footer-button:hover {
      background: var(--ref-palette-neutral-300, #f0f0f0);
    }

    @media (max-width: 360px) {
      .row-fields {
        grid-template-columns: minmax(74px, .65fr) minmax(0, 1.35fr);
      }
    }
    @media (prefers-reduced-motion: reduce) {
      .back-button,
      .clear-search,
      .footer-button {
        transition: none;
      }
    }
    @media (forced-colors: active) {
      .back-button,
      .search-input,
      .failure-card,
      .row-fields,
      .footer-button {
        border-color: CanvasText;
      }
      .failure-card {
        border-left-color: CanvasText;
      }
      .reason {
        border: 1px solid CanvasText;
      }
      .back-button:focus-visible,
      .search-input:focus-visible,
      .clear-search:focus-visible,
      .footer-button:focus-visible,
      summary:focus-visible {
        outline-color: Highlight;
      }
    }
  `

  const onPanelKeyDown = (event: React.KeyboardEvent<HTMLElement>): void => {
    if (event.key === 'Escape') {
      event.preventDefault()
      onClose()
    }
  }

  return (
    <section
      id={panelId}
      css={styles}
      role='region'
      aria-labelledby={titleId}
      onKeyDown={onPanelKeyDown}
    >
      <header className='panel-header'>
        <button
          type='button'
          className='back-button'
          aria-label='Back to geocoding results'
          onClick={onClose}
        >
          <svg width='18' height='18' viewBox='0 0 24 24' fill='none' aria-hidden='true'>
            <path d='M19 12H5m7-7l-7 7 7 7' stroke='currentColor' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round'/>
          </svg>
        </button>
        <div>
          <h2
            ref={headingRef}
            id={titleId}
            className='panel-title'
            tabIndex={-1}
          >Review failures</h2>
          <p className='panel-subtitle'>
            {failures.length.toLocaleString()} {failures.length === 1 ? 'record did' : 'records did'} not produce an accepted match.
          </p>
        </div>
      </header>

      <div className='search-section'>
        <label className='search-label' htmlFor={searchId}>Search failed records</label>
        <div className='search-box'>
          <svg className='search-icon' width='15' height='15' viewBox='0 0 24 24' fill='none' aria-hidden='true'>
            <circle cx='11' cy='11' r='7' stroke='currentColor' strokeWidth='2'/>
            <path d='M20 20l-4-4' stroke='currentColor' strokeWidth='2' strokeLinecap='round'/>
          </svg>
          <input
            id={searchId}
            className='search-input'
            type='search'
            value={query}
            placeholder='Address, row number, reason, or field value'
            onChange={event => { setQuery(event.currentTarget.value) }}
          />
          {query && (
            <button
              type='button'
              className='clear-search'
              aria-label='Clear failure search'
              onClick={() => { setQuery('') }}
            >
              <svg width='14' height='14' viewBox='0 0 24 24' fill='none' aria-hidden='true'>
                <path d='M6 6l12 12M18 6L6 18' stroke='currentColor' strokeWidth='2' strokeLinecap='round'/>
              </svg>
            </button>
          )}
        </div>
      </div>

      <p className='filter-summary' role='status' aria-live='polite'>
        Showing {filteredFailures.length.toLocaleString()} of {failures.length.toLocaleString()} failed {failures.length === 1 ? 'record' : 'records'}.
      </p>

      {filteredFailures.length > 0
        ? (
          <ol className='failure-list'>
            {filteredFailures.map(result => {
              const row = table.rows[result.objectId]
              const submittedAddress = formatSubmittedAddress(row, mapping)
              const hasCandidate = cleanValue(result.matchAddress).length > 0

              return (
                <li className='failure-card' key={result.objectId}>
                  <div className='failure-meta'>
                    <span className='row-number'>
                      Record {(result.objectId + 1).toLocaleString()} · source row {(result.objectId + 2).toLocaleString()}
                    </span>
                    <span className='score'>
                      {result.score > 0 ? `Score ${Math.round(result.score)}` : 'No score'}
                    </span>
                  </div>

                  <div className='submitted-address'>
                    <span className='field-label'>Submitted address</span>
                    {submittedAddress}
                  </div>

                  <div className='reason'>
                    <svg width='15' height='15' viewBox='0 0 24 24' fill='none' aria-hidden='true'>
                      <circle cx='12' cy='12' r='9' stroke='currentColor' strokeWidth='2'/>
                      <path d='M12 7v6m0 4h.01' stroke='currentColor' strokeWidth='2' strokeLinecap='round'/>
                    </svg>
                    <span>{failureReason(result)}</span>
                  </div>

                  {hasCandidate && (
                    <div className='candidate-address'>
                      <span className='field-label'>Closest locator candidate</span>
                      {result.matchAddress}
                    </div>
                  )}

                  <details>
                    <summary>Original row fields</summary>
                    <dl className='row-fields'>
                      {table.fields.map(field => {
                        const value = cleanValue(row?.[field])
                        return (
                          <React.Fragment key={field}>
                            <dt>{field}</dt>
                            <dd>{value || <span className='empty-value'>blank</span>}</dd>
                          </React.Fragment>
                        )
                      })}
                    </dl>
                  </details>
                </li>
              )
            })}
          </ol>
          )
        : (
          <div className='empty-state' role='status'>
            No failed records match “{query}”. Clear the search to show all failures.
          </div>
          )}

      <footer className='panel-footer'>
        <button type='button' className='footer-button' onClick={onClose}>Back to results</button>
      </footer>
    </section>
  )
}

export default FailureReviewPanel
