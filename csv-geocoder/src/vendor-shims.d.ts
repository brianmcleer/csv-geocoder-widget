/**
 * Widget-specific editor declarations.
 *
 * Editor only. Emits nothing and changes no widget behavior.
 *
 * src/exb-editor-shims.d.ts is a byte copy of the shared master at
 * widgets\_vs\exb-editor-shims.d.ts and must not be edited, so anything this
 * widget imports that the master does not cover is declared here instead. See
 * the playbook, Section 12 item 3.
 *
 * calcite-components is supplied by Experience Builder (webpack aliases it to
 * jimu-ui/calcite-components), so it is an import, not a dependency, and must
 * never appear in package.json.
 */
declare module 'calcite-components' {
    export const CalciteIcon: any
    export const CalciteChip: any
    export const CalciteButton: any
    export const CalciteSlider: any
    const mod: any
    export default mod
}
