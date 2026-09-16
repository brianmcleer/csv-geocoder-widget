import { React } from 'jimu-core'
import { Button } from 'jimu-ui'
import { CalciteIcon } from 'calcite-components'
import { useTokens } from '../theme'

/**
 * The tinted banner that points a first-time user at the guide. Shown until
 * dismissed once, per browser and per widget id. Opening the guide counts as
 * answering it, so the widget dismisses it there too.
 *
 * Markup follows the banner recipe in the playbook, Section 10.5 and 11.2:
 * tinted background, a 3px accent bar on the left, a lightbulb, a bold lead-in
 * on its own line, the sentence, an inline underlined link into the guide, and
 * an icon-only dismiss on the right. Every color is a tokens read.
 */
export interface FirstRunHintProps {
  title: string
  body: string
  linkLabel: string
  dismissLabel: string
  onOpenHelp: () => void
  onDismiss: () => void
}

const FirstRunHint: React.FC<FirstRunHintProps> = ({
  title, body, linkLabel, dismissLabel, onOpenHelp, onDismiss
}) => {
  const tokens = useTokens()

  return (
    <div
      role="note"
      style={{
        padding: '10px 12px',
        display: 'flex',
        alignItems: 'flex-start',
        gap: '10px',
        background: tokens.infoBg,
        color: tokens.text,
        border: `1px solid ${tokens.divider}`,
        borderLeft: `3px solid ${tokens.primary}`,
        borderRadius: tokens.radius,
        fontSize: '12px',
        lineHeight: 1.5
      }}
    >
      <span style={{ color: tokens.primary, marginTop: '1px' }} aria-hidden="true">
        <CalciteIcon icon="lightbulb" scale="s" />
      </span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <strong style={{ display: 'block', marginBottom: '2px' }}>{title}</strong>
        {body}
        {' '}
        <button
          type="button"
          onClick={onOpenHelp}
          style={{
            border: 'none',
            background: 'transparent',
            padding: 0,
            color: tokens.primary,
            cursor: 'pointer',
            textDecoration: 'underline',
            font: 'inherit'
          }}
        >{linkLabel}</button>
      </span>
      <Button size="sm" type="tertiary" icon onClick={onDismiss} title={dismissLabel} aria-label={dismissLabel}>
        <CalciteIcon icon="x" scale="s" />
      </Button>
    </div>
  )
}

export default FirstRunHint
