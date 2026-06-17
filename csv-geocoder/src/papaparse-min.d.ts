/**
 * Type shim for the prebuilt PapaParse browser bundle.
 * We import that bundle in parse-file.ts to avoid pulling in Node's
 * `stream` module (which webpack 5 won't polyfill). The bundle has the
 * same runtime API as the main entry, so we just re-export its types.
 */
declare module 'papaparse/papaparse.min.js' {
  import Papa = require('papaparse')
  export = Papa
}
