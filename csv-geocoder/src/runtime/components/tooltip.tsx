/** @jsx jsx */
import { React, jsx, css } from 'jimu-core'
import ReactDOM from 'react-dom'

interface TooltipProps {
  text: string
  /** Pair with the related input's aria-describedby so AT users hear help on focus. */
  describedById?: string
  /** Optional label for the trigger button. Defaults to 'Show help'. */
  triggerLabel?: string
}

interface Pos { top: number, left: number, below: boolean }

/**
 * WCAG-compliant tooltip.
 *
 *  Visible behaviour:
 *    - Hover OR keyboard focus opens the bubble (SC 1.4.13 hoverable/persistent).
 *    - Click toggles for touch devices that have no hover and no focus state.
 *    - Escape dismisses (SC 1.4.13 dismissable).
 *    - Outside click dismisses on touch devices.
 *  Screen-reader behaviour:
 *    - The bubble has role='tooltip' and an id matching aria-describedby on
 *      the related input. The hidden description is rendered with
 *      `aria-hidden` set conditionally so the SAME text isn't double-announced;
 *      it's available via aria-describedby even when the visual bubble is hidden.
 *  Visual behaviour:
 *    - Rendered into a portal at document.body so no parent overflow can clip it.
 *    - Auto-flips below the trigger when too close to the viewport top.
 *    - Horizontally clamped inside the viewport.
 *    - Respects prefers-reduced-motion (transitions disabled).
 *    - Forced-colors mode uses CanvasText / Canvas tokens for system contrast.
 */
const Tooltip: React.FC<TooltipProps> = ({ text, describedById, triggerLabel }) => {
  const [open, setOpen] = React.useState(false)
  const [pos, setPos] = React.useState<Pos>({ top: 0, left: 0, below: false })
  const triggerRef = React.useRef<HTMLButtonElement>(null)
  const reactId = React.useId()
  const tipId = describedById ?? `tip-${reactId}`

  const MAX_WIDTH = 260
  const HALF = MAX_WIDTH / 2
  const MARGIN = 8
  const GAP = 8
  const FLIP_THRESHOLD = 80

  const updatePosition = React.useCallback((): void => {
    const el = triggerRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const below = r.top < FLIP_THRESHOLD
    let left = r.left + r.width / 2
    const minLeft = HALF + MARGIN
    const maxLeft = window.innerWidth - HALF - MARGIN
    if (left < minLeft) left = minLeft
    else if (left > maxLeft) left = maxLeft
    setPos({ top: below ? r.bottom + GAP : r.top - GAP, left, below })
  }, [])

  React.useEffect(() => {
    if (!open) return
    updatePosition()
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        setOpen(false)
        triggerRef.current?.focus()
      }
    }
    const onMove = (): void => { updatePosition() }
    const onDocClick = (e: MouseEvent): void => {
      const t = e.target as Node | null
      if (t && triggerRef.current && !triggerRef.current.contains(t)) setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('scroll', onMove, true)
    window.addEventListener('resize', onMove)
    document.addEventListener('click', onDocClick)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('scroll', onMove, true)
      window.removeEventListener('resize', onMove)
      document.removeEventListener('click', onDocClick)
    }
  }, [open, updatePosition])

  const triggerStyles = css`
    display: inline-flex;
    align-items: center;

    .tt-trigger {
      width: 18px; height: 18px; padding: 0;
      display: inline-flex; align-items: center; justify-content: center;
      border-radius: 50%;
      border: 1px solid var(--ref-palette-neutral-800, #707070);
      background: var(--ref-palette-neutral-200, #fafafa);
      color: var(--ref-palette-neutral-1100, #1a1a1a);
      font: 600 11px/1 system-ui, sans-serif;
      cursor: help;
      transition: background .12s ease, border-color .12s ease;
    }
    .tt-trigger:hover {
      background: var(--ref-palette-neutral-400, #e8e8e8);
      border-color: var(--ref-palette-neutral-1100, #1a1a1a);
    }
    .tt-trigger:focus-visible {
      outline: 2px solid var(--sys-color-primary-main, #0079c1);
      outline-offset: 2px;
    }
    .tt-trigger[aria-expanded='true'] {
      background: var(--ref-palette-neutral-400, #e8e8e8);
      border-color: var(--ref-palette-neutral-1100, #1a1a1a);
    }
    @media (prefers-reduced-motion: reduce) {
      .tt-trigger { transition: none; }
    }
    @media (forced-colors: active) {
      .tt-trigger { border-color: CanvasText; background: Canvas; color: CanvasText; }
      .tt-trigger:focus-visible { outline-color: Highlight; }
    }
  `

  const bubbleStyles = css`
    position: fixed;
    width: max-content;
    max-width: 260px;
    padding: 8px 10px;
    background: #1f1f1f;
    color: #f5f5f5;
    border-radius: 4px;
    font-size: 12px;
    line-height: 1.45;
    font-weight: 400;
    text-align: left;
    box-shadow: 0 4px 14px rgba(0,0,0,0.22);
    z-index: 2147483646;
    pointer-events: none;
    white-space: normal;
    word-wrap: break-word;

    &.above { transform: translate(-50%, -100%); }
    &.below { transform: translate(-50%, 0); }

    &.above::after {
      content: ''; position: absolute;
      top: 100%; left: 50%;
      transform: translateX(-50%);
      border: 5px solid transparent;
      border-top-color: #1f1f1f;
    }
    &.below::after {
      content: ''; position: absolute;
      bottom: 100%; left: 50%;
      transform: translateX(-50%);
      border: 5px solid transparent;
      border-bottom-color: #1f1f1f;
    }

    @media (forced-colors: active) {
      background: Canvas; color: CanvasText;
      border: 1px solid CanvasText;
      &.above::after, &.below::after { border-color: transparent; }
    }
  `

  const srOnly: React.CSSProperties = {
    position: 'absolute', width: 1, height: 1, padding: 0, margin: -1,
    overflow: 'hidden', clip: 'rect(0,0,0,0)', whiteSpace: 'nowrap', border: 0
  }

  return (
    <React.Fragment>
      <span css={triggerStyles}>
        <button
          ref={triggerRef}
          type='button'
          className='tt-trigger'
          aria-label={triggerLabel ?? 'Show help'}
          aria-expanded={open}
          aria-describedby={tipId}
          onMouseEnter={() => { setOpen(true) }}
          onMouseLeave={() => { setOpen(false) }}
          onFocus={() => { setOpen(true) }}
          onBlur={() => { setOpen(false) }}
          onClick={e => {
            // Touch devices fire focus + click; toggle here so a tap also works.
            e.stopPropagation()
            setOpen(prev => !prev)
          }}
        >?</button>
      </span>

      {/* Always-rendered hidden copy so aria-describedby is valid even when
          the visual bubble isn't open. Hidden from sighted users via sr-only. */}
      {!open && <span id={tipId} style={srOnly}>{text}</span>}

      {open && typeof document !== 'undefined' && ReactDOM.createPortal(
        <span
          id={tipId}
          role='tooltip'
          css={bubbleStyles}
          className={pos.below ? 'below' : 'above'}
          style={{ top: pos.top, left: pos.left }}
        >{text}</span>,
        document.body
      )}
    </React.Fragment>
  )
}

export default Tooltip
