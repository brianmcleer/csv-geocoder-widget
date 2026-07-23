declare module 'xlsx' {
  export interface WorkSheet {
    [cell: string]: any
    '!ref'?: string
  }

  export interface WorkBook {
    SheetNames: string[]
    Sheets: Record<string, WorkSheet>
  }

  export function read(data: ArrayBuffer, options?: { type?: string, cellDates?: boolean }): WorkBook

  export namespace utils {
    function sheet_to_json<T>(sheet: WorkSheet, options?: { defval?: unknown, raw?: boolean }): T[]
    function decode_range(ref: string): { s: { r: number, c: number }, e: { r: number, c: number } }
    function encode_cell(cell: { r: number, c: number }): string
  }
}
