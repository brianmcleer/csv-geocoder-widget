/**
 * Turns a source row back into the address the widget sent to the locator,
 * using the column mapping from that run. Shared by the Review unmatched
 * panel (which shows it) and the table export (which writes it as a column),
 * so both always agree on what "the submitted address" was.
 */
import { type AddressRole } from '../../config'
import { type ParsedTable } from './parse-file'
import { type FieldMapping } from '../components/field-mapper'

type SourceRow = ParsedTable['rows'][number]

/** Order the parts are joined in, matching how an address is written. */
export const ADDRESS_ROLES: AddressRole[] = [
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

/**
 * The submitted address as one line. Returns '' when nothing was mapped or
 * every mapped column was empty; callers that display it supply their own
 * placeholder.
 */
export function submittedAddress (row: SourceRow | undefined, mapping: FieldMapping): string {
  if (!row) return ''

  if (mapping.mode === 'single') {
    return mapping.singleField ? cleanValue(row[mapping.singleField]) : ''
  }

  const parts: string[] = []
  for (const role of ADDRESS_ROLES) {
    const field = mapping.multi[role]
    const value = field ? cleanValue(row[field]) : ''
    if (value) parts.push(value)
  }
  return parts.join(', ')
}
