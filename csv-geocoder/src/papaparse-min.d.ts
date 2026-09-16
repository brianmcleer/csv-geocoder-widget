/**
 * Type shim for the prebuilt PapaParse browser bundle.
 *
 * parse-file.ts imports that bundle rather than the package entry point,
 * because the entry point contains require('stream') for Node usage and
 * webpack 5 no longer polyfills Node core modules.
 *
 * The declaration is self-contained on purpose. An earlier version did
 * `import Papa = require('papaparse')`, which made Visual Studio resolve the
 * real @types/papaparse inside the widget's node_modules and report IDE1100
 * "Access to the path is denied" on the pnpm junction. A resolvable real
 * module beats an ambient declaration, so the only fix is to not reference
 * one. See the playbook, Section 12 item 3.
 *
 * Only the members parse-file.ts uses are declared; everything else is any.
 */
declare module 'papaparse/papaparse.min.js' {
  export interface ParseMeta {
    fields?: string[]
    delimiter?: string
    linebreak?: string
    aborted?: boolean
    truncated?: boolean
    cursor?: number
  }

  export interface ParseError {
    type?: string
    code?: string
    message: string
    row?: number
  }

  export interface ParseResult<T> {
    data: T[]
    errors: ParseError[]
    meta: ParseMeta
  }

  export interface ParseConfig<T> {
    header?: boolean
    skipEmptyLines?: boolean | 'greedy'
    dynamicTyping?: boolean
    delimiter?: string
    transformHeader?: (header: string, index?: number) => string
    complete?: (results: ParseResult<T>, file?: File) => void
    error?: (error: Error, file?: File) => void
    [key: string]: any
  }

  export function parse<T = any> (input: File | string, config?: ParseConfig<T>): ParseResult<T> | void
  export function unparse (data: any, config?: any): string

  const Papa: {
    parse: typeof parse
    unparse: typeof unparse
    [key: string]: any
  }

  export default Papa
}
