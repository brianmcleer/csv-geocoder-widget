/** @jsx jsx */
import { React, jsx, css } from 'jimu-core'

const ACCEPT = '.csv,.tsv,.txt,.xlsx,.xls,.xlsm,.ods'

interface Props {
  onFile: (file: File) => void
  disabled?: boolean
  fileName?: string
}

/**
 * Accessible drag-drop / browse zone.
 *
 *  WCAG notes:
 *    - Drop zone is role='button', keyboard-activatable with Enter/Space,
 *      focusable when enabled, removed from tab order when disabled.
 *    - A separate visible 'Browse' button gives keyboard and screen-reader
 *      users a clear, traditional path even if drag-drop doesn't make sense
 *      for them.
 *    - File-name announcements use aria-live='polite'.
 *    - Drag state is announced via a polite live region so AT users hear
 *      "Drop file to upload" while a file is being dragged over the zone.
 *    - High-contrast / forced-colors mode uses system tokens.
 *    - prefers-reduced-motion disables the lift animation.
 */
const FileUpload = (props: Props): React.ReactElement => {
  const { onFile, disabled, fileName } = props
  const [hover, setHover] = React.useState(false)
  const inputRef = React.useRef<HTMLInputElement>(null)

  const handleFiles = (files: FileList | null): void => {
    if (!files || files.length === 0 || disabled) return
    onFile(files[0])
  }
  const openPicker = (): void => {
    if (!disabled) inputRef.current?.click()
  }

  const styles = css`
    .wrap { position: relative; display: flex; flex-direction: column; gap: 8px; }

    .zone {
      position: relative;
      display: flex; flex-direction: column;
      align-items: center; gap: 10px;
      padding: 24px 16px;
      border: 2px dashed var(--ref-palette-neutral-800, #707070);
      border-radius: 10px;
      background: var(--ref-palette-neutral-200, #fafafa);
      cursor: pointer;
      transition: border-color .15s ease, background .15s ease, transform .15s ease;
      text-align: center;
      width: 100%; box-sizing: border-box;
    }
    .zone:hover:not([aria-disabled='true']) {
      border-color: var(--sys-color-primary-main, #0079c1);
      background: var(--ref-palette-neutral-300, #f0f0f0);
    }
    .zone:focus-visible {
      outline: 2px solid var(--sys-color-primary-main, #0079c1);
      outline-offset: 2px;
    }
    .zone.dragging {
      border-color: var(--sys-color-primary-main, #0079c1);
      background: color-mix(in srgb, var(--sys-color-primary-main, #0079c1) 8%, var(--ref-palette-neutral-200, #fafafa));
      transform: scale(1.01);
    }
    .zone[aria-disabled='true'] {
      opacity: 0.55; cursor: not-allowed;
    }
    @media (prefers-reduced-motion: reduce) {
      .zone, .zone.dragging { transition: none; transform: none; }
    }
    @media (forced-colors: active) {
      .zone { border-color: CanvasText; background: Canvas; }
      .zone.dragging { border-color: Highlight; }
      .zone:focus-visible { outline-color: Highlight; }
    }

    .icon {
      width: 40px; height: 40px;
      display: flex; align-items: center; justify-content: center;
      border-radius: 50%;
      background: var(--sys-color-primary-main, #0079c1);
      color: #fff;
      flex-shrink: 0;
    }
    .title {
      font-size: 14px; font-weight: 600; line-height: 1.3;
      color: var(--ref-palette-neutral-1100, #1a1a1a);
    }
    .hint {
      font-size: 11px; line-height: 1.4;
      color: var(--ref-palette-neutral-1000, #595959);
    }
    .file {
      display: inline-flex; align-items: center; gap: 6px;
      margin-top: 4px;
      padding: 4px 10px;
      background: var(--ref-palette-neutral-100, #fff);
      border: 1px solid var(--ref-palette-neutral-600, #b5b5b5);
      border-radius: 16px;
      font-size: 12px; font-weight: 500;
      max-width: 100%;
      color: var(--ref-palette-neutral-1100, #1a1a1a);
    }
    .file .name {
      overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
      max-width: 220px;
    }

    /* Visible Browse button (keyboard-friendly alternative to drag-drop) */
    .browse-row { display: flex; justify-content: center; }
    .browse-btn {
      min-height: 36px;
      padding: 7px 14px;
      font: 500 12px/1.2 inherit;
      background: var(--ref-palette-neutral-100, #fff);
      color: var(--sys-color-primary-main, #0079c1);
      border: 1px solid var(--sys-color-primary-main, #0079c1);
      border-radius: 6px;
      cursor: pointer;
      transition: background .12s ease;
    }
    .browse-btn:hover:not([disabled]) {
      background: color-mix(in srgb, var(--sys-color-primary-main, #0079c1) 10%, #fff);
    }
    .browse-btn:focus-visible {
      outline: 2px solid var(--sys-color-primary-main, #0079c1);
      outline-offset: 2px;
    }
    .browse-btn[disabled] { opacity: 0.5; cursor: not-allowed; }

    .sr-only {
      position: absolute; width: 1px; height: 1px;
      padding: 0; margin: -1px; overflow: hidden;
      clip: rect(0,0,0,0); white-space: nowrap; border: 0;
    }
  `

  const label = fileName
    ? `Replace file. Current: ${fileName}. Press Enter or Space to choose a different file.`
    : 'Drop a file here, or press Enter or Space to open the file picker.'

  return (
    <div css={styles}>
      <div className='wrap'>
        <div
          className={`zone ${hover ? 'dragging' : ''}`}
          role='button'
          tabIndex={disabled ? -1 : 0}
          aria-disabled={disabled}
          aria-label={label}
          onClick={openPicker}
          onKeyDown={e => {
            if (disabled) return
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              openPicker()
            }
          }}
          onDragOver={e => {
            e.preventDefault()
            if (!disabled) setHover(true)
          }}
          onDragLeave={() => { setHover(false) }}
          onDrop={e => {
            e.preventDefault()
            setHover(false)
            handleFiles(e.dataTransfer.files)
          }}
        >
          <div className='icon' aria-hidden='true'>
            <svg width='20' height='20' viewBox='0 0 24 24' fill='none' focusable='false'>
              <path d='M12 4v12m0 0l-4-4m4 4l4-4M5 20h14'
                stroke='currentColor' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round'/>
            </svg>
          </div>
          <div className='title'>
            {fileName ? 'Replace file' : 'Drop a file here'}
          </div>
          <div className='hint'>CSV · TSV · TXT · XLSX · XLS · ODS</div>
          {fileName && (
            <div className='file' aria-live='polite'>
              <svg width='12' height='12' viewBox='0 0 24 24' fill='none' aria-hidden='true' focusable='false'>
                <path d='M13 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V9z'
                  stroke='currentColor' strokeWidth='2' strokeLinejoin='round'/>
                <path d='M13 2v7h7' stroke='currentColor' strokeWidth='2' strokeLinejoin='round'/>
              </svg>
              <span className='name'>{fileName}</span>
            </div>
          )}
        </div>

        {/* Visible, focusable Browse button so keyboard/AT users don't have
            to rely on the drop-zone gesture metaphor. */}
        <div className='browse-row'>
          <button
            type='button'
            className='browse-btn'
            onClick={openPicker}
            disabled={disabled}
          >
            {fileName ? 'Choose a different file' : 'Browse for a file'}
          </button>
        </div>

        {/* Polite drag-state announcement (silent unless dragging) */}
        <span className='sr-only' role='status' aria-live='polite'>
          {hover ? 'File detected — drop to upload.' : ''}
        </span>

        <input
          ref={inputRef}
          type='file'
          accept={ACCEPT}
          className='sr-only'
          tabIndex={-1}
          aria-hidden='true'
          onChange={e => { handleFiles(e.target.files) }}
          onClick={e => { (e.target as HTMLInputElement).value = '' }}
        />
      </div>
    </div>
  )
}

export default FileUpload
