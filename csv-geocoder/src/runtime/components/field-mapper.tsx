/** @jsx jsx */
import { React, jsx, css } from 'jimu-core'
import { type AddressMode, type AddressRole } from '../../config'
import Tooltip from './tooltip'

export interface FieldMapping {
  mode: AddressMode
  singleField?: string
  multi: { [K in AddressRole]?: string }
}

interface Props {
  fields: string[]
  value: FieldMapping
  onChange: (next: FieldMapping) => void
}

interface RoleDef {
  key: AddressRole
  label: string
  help: string
  required?: boolean
}

const MULTI_ROLES: RoleDef[] = [
  { key: 'Address', label: 'Street', help: 'Number and street name. Example: "100 Main Street".', required: true },
  { key: 'Address2', label: 'Line 2', help: 'Unit, suite, apartment, or floor.' },
  { key: 'City', label: 'City', help: 'City, town, or locality.' },
  { key: 'Region', label: 'State / Region', help: 'State, province, or administrative region.' },
  { key: 'Postal', label: 'Postal code', help: 'ZIP, postcode, or equivalent.' },
  { key: 'Country', label: 'Country', help: 'Country name or ISO code (e.g. "US", "USA").' }
]

/**
 * Field-to-role mapper.
 *
 * WCAG notes:
 *   - The mode toggle is a true radiogroup: arrow keys move between options,
 *     each option has role='radio' and aria-checked.
 *   - On mode change, focus is moved to the first relevant select so users
 *     don't lose their place.
 *   - Each select has a proper <label htmlFor>, aria-describedby pointing at
 *     its tooltip help text, and aria-required when appropriate.
 *   - Required indicator uses both a visible asterisk AND aria-hidden text
 *     'required' on a sr-only span so screen readers announce it once.
 */
const FieldMapper = (props: Props): React.ReactElement => {
  const { fields, value, onChange } = props
  const multiBtnRef = React.useRef<HTMLButtonElement>(null)
  const singleBtnRef = React.useRef<HTMLButtonElement>(null)
  const firstSelectRef = React.useRef<HTMLSelectElement>(null)
  const previousModeRef = React.useRef<AddressMode>(value.mode)

  // Move focus into the appropriate first input whenever mode changes.
  React.useEffect(() => {
    if (previousModeRef.current !== value.mode) {
      previousModeRef.current = value.mode
      // Defer so the new select is mounted.
      setTimeout(() => { firstSelectRef.current?.focus() }, 0)
    }
  }, [value.mode])

  const setMode = (mode: AddressMode): void => { onChange({ ...value, mode }) }
  const setSingle = (f: string): void => { onChange({ ...value, singleField: f }) }
  const setMulti = (role: AddressRole, f: string): void => {
    onChange({ ...value, multi: { ...value.multi, [role]: f || undefined } })
  }

  // Arrow-key navigation across the radiogroup (WCAG/WAI-ARIA radio pattern).
  const onModeKey = (e: React.KeyboardEvent<HTMLButtonElement>): void => {
    if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault()
      setMode('multi')
      multiBtnRef.current?.focus()
    } else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault()
      setMode('single')
      singleBtnRef.current?.focus()
    } else if (e.key === 'Home') {
      e.preventDefault()
      setMode('multi')
      multiBtnRef.current?.focus()
    } else if (e.key === 'End') {
      e.preventDefault()
      setMode('single')
      singleBtnRef.current?.focus()
    }
  }

  const styles = css`
    display: flex; flex-direction: column; gap: 14px;

    .sr-only {
      position: absolute; width: 1px; height: 1px;
      padding: 0; margin: -1px; overflow: hidden;
      clip: rect(0,0,0,0); white-space: nowrap; border: 0;
    }

    .seg {
      display: flex; gap: 4px;
      padding: 3px;
      background: var(--ref-palette-neutral-300, #f0f0f0);
      border-radius: 8px;
    }
    .seg-btn {
      flex: 1;
      min-height: 36px;
      padding: 7px 10px;
      font: 500 12px/1.2 inherit;
      background: transparent;
      border: 1px solid transparent;
      border-radius: 5px;
      color: var(--ref-palette-neutral-1100, #1a1a1a);
      cursor: pointer;
      transition: background .12s ease, color .12s ease, box-shadow .12s ease;
    }
    .seg-btn:hover { background: rgba(0,0,0,0.04); }
    .seg-btn:focus-visible {
      outline: 2px solid var(--sys-color-primary-main, #0079c1);
      outline-offset: 1px;
    }
    .seg-btn[aria-checked='true'] {
      background: var(--ref-palette-neutral-100, #fff);
      box-shadow: 0 1px 2px rgba(0,0,0,0.08);
      font-weight: 600;
    }
    @media (prefers-reduced-motion: reduce) {
      .seg-btn { transition: none; }
    }
    @media (forced-colors: active) {
      .seg-btn { border-color: CanvasText; }
      .seg-btn[aria-checked='true'] { background: Highlight; color: HighlightText; }
      .seg-btn:focus-visible { outline-color: Highlight; }
    }

    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
      gap: 10px 12px;
    }

    .field { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
    .field-head {
      display: flex; align-items: center; gap: 6px;
      font-size: 12px; font-weight: 500; line-height: 1.2;
      color: var(--ref-palette-neutral-1100, #1a1a1a);
    }
    .req {
      color: var(--sys-color-error-main, #b00020); /* darker red for AA contrast */
      font-weight: 700;
    }

    select {
      width: 100%; box-sizing: border-box;
      min-height: 36px;
      padding: 6px 8px;
      font-size: 13px; font-family: inherit;
      background: var(--ref-palette-neutral-100, #fff);
      color: var(--ref-palette-neutral-1100, #1a1a1a);
      border: 1px solid var(--ref-palette-neutral-700, #a0a0a0);
      border-radius: 5px;
      transition: border-color .12s ease, box-shadow .12s ease;
    }
    select:hover { border-color: var(--ref-palette-neutral-1000, #595959); }
    select:focus-visible {
      outline: none;
      border-color: var(--sys-color-primary-main, #0079c1);
      box-shadow: 0 0 0 3px color-mix(in srgb, var(--sys-color-primary-main, #0079c1) 25%, transparent);
    }
    @media (prefers-reduced-motion: reduce) {
      select { transition: none; }
    }
    @media (forced-colors: active) {
      select { border-color: CanvasText; }
      select:focus-visible { outline: 2px solid Highlight; outline-offset: 2px; }
    }
  `

  return (
    <div css={styles} role='group' aria-label='Address field mapping'>
      <div className='seg' role='radiogroup' aria-label='Address mapping mode'>
        <button
          ref={multiBtnRef}
          type='button'
          role='radio'
          aria-checked={value.mode === 'multi'}
          tabIndex={value.mode === 'multi' ? 0 : -1}
          className='seg-btn'
          onClick={() => { setMode('multi') }}
          onKeyDown={onModeKey}
        >Separate columns</button>
        <button
          ref={singleBtnRef}
          type='button'
          role='radio'
          aria-checked={value.mode === 'single'}
          tabIndex={value.mode === 'single' ? 0 : -1}
          className='seg-btn'
          onClick={() => { setMode('single') }}
          onKeyDown={onModeKey}
        >Single full address</button>
      </div>

      {value.mode === 'single' && (
        <div className='field'>
          <div className='field-head'>
            <label htmlFor='csvg-single'>
              Address column
              <span className='req' aria-hidden='true'> *</span>
              <span className='sr-only'> required</span>
            </label>
            <Tooltip
              text='The column containing the complete address as one string, e.g. "100 Main St, Springfield, IL 62701".'
              describedById='csvg-single-help'
            />
          </div>
          <select
            ref={firstSelectRef}
            id='csvg-single'
            aria-required='true'
            aria-describedby='csvg-single-help'
            value={value.singleField ?? ''}
            onChange={e => { setSingle(e.currentTarget.value) }}
          >
            <option value=''>— select column —</option>
            {fields.map(f => <option key={f} value={f}>{f}</option>)}
          </select>
        </div>
      )}

      {value.mode === 'multi' && (
        <div className='grid'>
          {MULTI_ROLES.map((r, idx) => {
            const fieldId = `csvg-m-${r.key.toLowerCase()}`
            const helpId = `${fieldId}-help`
            return (
              <div className='field' key={r.key}>
                <div className='field-head'>
                  <label htmlFor={fieldId}>
                    {r.label}
                    {r.required && (
                      <React.Fragment>
                        <span className='req' aria-hidden='true'> *</span>
                        <span className='sr-only'> required</span>
                      </React.Fragment>
                    )}
                  </label>
                  <Tooltip text={r.help} describedById={helpId} />
                </div>
                <select
                  ref={idx === 0 ? firstSelectRef : undefined}
                  id={fieldId}
                  aria-required={r.required ?? false}
                  aria-describedby={helpId}
                  value={value.multi[r.key] ?? ''}
                  onChange={e => { setMulti(r.key, e.currentTarget.value) }}
                >
                  <option value=''>— none —</option>
                  {fields.map(f => <option key={f} value={f}>{f}</option>)}
                </select>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default FieldMapper

export function validateMapping (m: FieldMapping): string | null {
  if (m.mode === 'single') {
    if (!m.singleField) return 'Choose the column that contains the full address.'
    return null
  }
  if (!m.multi.Address) return 'Map a column to "Street" — it is required.'
  return null
}
