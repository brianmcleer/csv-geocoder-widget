/**
 * Lightweight file parser that returns a uniform {fields, rows} structure
 * regardless of whether the input is CSV, TSV or an Excel workbook.
 *
 * Dependencies (declared in package.json; installed by the Experience Builder client workspace):
 *   - papaparse    for delimited text
 *   - xlsx (SheetJS Community Edition) for .xlsx / .xls / .ods
 */
// NOTE: We deliberately import the prebuilt UMD bundle here. PapaParse's
// default entry point contains `require('stream')` for Node usage, and
// webpack 5 (which ExB uses) no longer auto-polyfills Node core modules,
// so a normal `from 'papaparse'` import fails the build. The .min.js
// bundle is browser-only and has the same public API. Types are shimmed
// in src/papaparse-min.d.ts.
import Papa from 'papaparse/papaparse.min.js'
import * as XLSX from 'xlsx'

/** Row shape used internally — index signatures keep eslint's
 *  consistent-indexed-object-style rule happy. */
type StringRow = { [key: string]: string }
type UnknownRow = { [key: string]: unknown }

export interface ParsedTable {
    /** Column names in source order. */
    fields: string[]
    /** Row objects keyed by field name. Values are coerced to strings. */
    rows: StringRow[]
    /** Original filename, kept for the UI. */
    fileName: string
}

const DELIMITED_EXTS = ['csv', 'tsv', 'txt']
const SHEET_EXTS = ['xlsx', 'xls', 'xlsm', 'ods']

function getExt(name: string): string {
    return name.toLowerCase().split('.').pop() ?? ''
}

/**
 * Convert any cell value into a clean string. Empty cells become ''.
 * The explicit object branch avoids the dreaded "[object Object]" output
 * that no-base-to-string warns about.
 */
function cellToString(v: unknown): string {
    if (v === null || v === undefined) return ''
    if (typeof v === 'string') return v.trim()
    if (typeof v === 'number' || typeof v === 'boolean') return String(v)
    if (v instanceof Date) return v.toISOString()
    if (typeof v === 'object') {
        try { return JSON.stringify(v) } catch { return '' }
    }
    // Primitives (symbol, bigint) — String() is well-defined here.
    return String(v).trim()
}

/** Parse a delimited text file (CSV/TSV) via PapaParse with header detection. */
async function parseDelimited(file: File): Promise<ParsedTable> {
    return await new Promise<ParsedTable>((resolve, reject) => {
        Papa.parse<UnknownRow>(file, {
            header: true,
            skipEmptyLines: 'greedy',
            dynamicTyping: false,
            transformHeader: h => h.trim(),
            complete: results => {
                const fields = results.meta.fields?.filter(f => f && f.length > 0) ?? []
                const rows = results.data.map(r => {
                    const clean: StringRow = {}
                    for (const f of fields) clean[f] = cellToString(r[f])
                    return clean
                })
                resolve({ fields, rows, fileName: file.name })
            },
            error: (err: Error) => {
                reject(err instanceof Error ? err : new Error(String(err)))
            }
        })
    })
}

/** Parse the first sheet of an Excel workbook using SheetJS. */
async function parseWorkbook(file: File): Promise<ParsedTable> {
    const buf = await file.arrayBuffer()
    const wb = XLSX.read(buf, { type: 'array', cellDates: true })
    const firstSheet = wb.SheetNames[0]
    if (!firstSheet) throw new Error('Workbook contains no sheets')
    const sheet = wb.Sheets[firstSheet]
    const json = XLSX.utils.sheet_to_json<UnknownRow>(sheet, {
        defval: '',
        raw: false
    })

    // Preserve column order from the sheet header rather than relying on object key order.
    const headerRange = XLSX.utils.decode_range(sheet['!ref'] ?? 'A1')
    const fields: string[] = []
    for (let c = headerRange.s.c; c <= headerRange.e.c; c++) {
        const addr = XLSX.utils.encode_cell({ r: headerRange.s.r, c })
        const cell = sheet[addr]
        if (cell && cell.v != null && String(cell.v).trim() !== '') {
            fields.push(String(cell.v).trim())
        }
    }

    const rows = json.map(r => {
        const clean: StringRow = {}
        for (const f of fields) clean[f] = cellToString(r[f])
        return clean
    })

    return { fields, rows, fileName: file.name }
}

/**
 * Public entry. Dispatches to the right parser based on the file extension.
 */
export async function parseAddressFile(file: File): Promise<ParsedTable> {
    const ext = getExt(file.name)
    if (DELIMITED_EXTS.indexOf(ext) >= 0) return await parseDelimited(file)
    if (SHEET_EXTS.indexOf(ext) >= 0) return await parseWorkbook(file)
    // Fallback: try CSV — many "address exports" use unusual extensions but are still CSV.
    return await parseDelimited(file)
}

/** Roles used by guessAddressMapping — kept local to avoid a circular import on config.ts. */
type GuessRole = 'Address' | 'Address2' | 'City' | 'Region' | 'Postal' | 'Country'

/**
 * Heuristic: scan field names and guess which roles they fill so the UI
 * can pre-populate the mapping form.
 */
export function guessAddressMapping(fields: string[]): {
    single?: string
    multi: { [K in GuessRole]?: string }
} {
    const lower = fields.map(f => ({ raw: f, key: f.toLowerCase().replace(/[\s_\-/]+/g, '') }))
    const find = (...needles: string[]): string | undefined =>
        lower.find(f => needles.some(n => f.key === n || f.key.indexOf(n) >= 0))?.raw

    const single = find('fulladdress', 'singlelineaddress', 'singleline', 'address') // weakest hit, used only if multi is empty
    return {
        single,
        multi: {
            Address: find('streetaddress', 'street', 'address1', 'addressline1', 'address'),
            Address2: find('address2', 'addressline2', 'suite', 'unit'),
            City: find('city', 'town', 'municipality', 'locality'),
            Region: find('state', 'province', 'region', 'admin'),
            Postal: find('zip', 'zipcode', 'postal', 'postcode'),
            Country: find('country', 'countrycode', 'nation')
        }
    }
}