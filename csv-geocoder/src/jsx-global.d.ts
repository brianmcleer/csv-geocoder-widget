/**
 * Intentionally empty.
 *
 * This widget compiles with jsx "react-jsx" and jsxImportSource "@emotion/react",
 * matching client\tsconfig.json, so every JSX tag takes its types from
 * @emotion/react/jsx-runtime. That module is declared in the shared master shim
 * src/exb-editor-shims.d.ts, which re-exports the JSX namespace from its own
 * `react` declaration.
 *
 * A global `declare namespace JSX` here would only be needed under the classic
 * factory (jsx "react"). Do not add one back without also adding the
 * `/** @jsx jsx *\/` pragma to every .tsx file that uses the Emotion css prop,
 * and do not do either on this install: ts-loader reads this widget's
 * tsconfig.json, so a classic jsx setting changes what webpack emits.
 *
 * The file is kept rather than deleted so the name is not recreated by habit.
 */
export {}
