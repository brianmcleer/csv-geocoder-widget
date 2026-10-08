# Changelog

All notable changes to the CSV Geocoder widget. Newest first.

## 1.2.0 (2026-10-08)

### Added

- **Address check table** export under **4. Export**: CSV or Excel, for **All rows**, **Unmatched** only, or **Matched** only. Every source column is kept in source order, with `MATCH_STATUS`, `MATCH_SCORE`, `SUBMITTED_ADDRESS`, `MATCH_ADDR`, `ADDR_TYPE`, `FAIL_REASON`, `LONGITUDE`, `LATITUDE` and `SOURCE_ROW` added on the right. Added column names that collide with a source column get a numeric suffix.
- Excel workbook has a **Summary** sheet (file, run time, locator URL without query string, minimum score, counts and shares by status, and a key to the statuses) and, for All rows, separate **All results**, **Unmatched** and **Matched** sheets with filter arrows on the header row.
- Match status is now explicit on every record: matched, low score, no match, blank address, or service error. A locator Status `T` match is labelled **Matched (tied)**.
- Results card: unmatched rows broken down by reason, and a one-click **Download unmatched** CSV.
- Review panel: **Reason** filter, status chip and address type on each record, and **Download as CSV** for exactly the records on screen (reason filter and search both apply).
- Help guide: new **Checking a list of addresses** section; results, export and troubleshooting text updated.
- Telemetry: `export` action with `format:scope` detail, and `export-<format>` errors.

### Changed

- **Failed** is now **Unmatched** throughout the widget.
- Geocode runs without a connected Map widget. The results and the table export work; only the layer step is skipped. The banner says so instead of blocking the run.
- Rows whose mapped address columns are all blank are not sent to the locator. They are reported as **Blank address**, which saves requests and credits.
- Download names are built from the uploaded file and include the time, for example `Hydrants_unmatched_2026-10-08_1430.csv`. GeoJSON features carry `addr_type`.

### Fixed

- A locator record with Status `U` or a NaN location is treated as no match. Before, a minimum match score of 0 accepted it and tried to draw a point at NaN.
- Cancel during a run no longer records the in-flight batch as a service error before stopping.
- Settings panel: the **Help** section referenced undefined `sect` and `head` styles (1.1.6), which threw when the settings panel opened. It now uses `section` and `h` like the other sections.
- CSV export neutralizes formula-leading text (`=`, `+`, `-`, `@`) to prevent CSV injection.

## 1.1.6 (2026-09-18)

- Settings: a **Show help guide** option. Turn it off and the question-mark button and the first-run hint both disappear; the guide itself is untouched. Undefined means on, so apps configured before this release keep their help button.

## 1.1.5 (2026-09-18)

- Security: the beacon's session id now falls back to `crypto.getRandomValues` and then to a clock value instead of `Math.random`, which CodeQL flags as insecure randomness (shared beacon 1.1.1). The id only groups one page load's events; it is never a secret or a credential.
- Build: `tsconfig.json` is `jsx: react-jsx` with `jsxImportSource: @emotion/react`, matching the Experience Builder client. ts-loader reads the widget tsconfig, and the previous classic `jsx: react` setting made the settings panel and runtime fail with "Cannot convert undefined or null to object" after a full rebuild. No functional change.

## 1.1.4 (2026-09-18)

- Added: anonymous usage and error telemetry (shared beacon module; off unless the portal publishes an exb-beacon-sink table; telemetry: false in config disables it).

## 1.1.3 (2026-09-17)

- Security: the world-locator check in `widget.tsx` now parses the geocoder URL and compares the hostname exactly instead of a substring match. Resolves CodeQL `js/incomplete-url-substring-sanitization`. The check only decides whether the help guide mentions credits; no behavior change for real configs.

## 1.1.2 (2026-09-17)

- Packaging: `src/xlsx.d.ts` and `src/shp-write.d.ts` folded into the editor-only `src/vendor-shims.d.ts`, which the release zip leaves out, because ambient declarations of real packages (`xlsx`, `@mapbox/shp-write`) shadow the `@types` of neighbouring widgets.

## 1.1.1 (2026-09-17)

- Packaging: the Visual Studio editor shims are no longer in the release zip. `publish.ps1` strips them from a staging copy (`$ReleaseOnlyExclude`) and refuses to zip if any ambient `declare module` of react, jimu or esri survives. The shims stay in the GitHub repo; clone users delete them before building.

## 1.1.0 - 2026-09-16

### Added

- Matched points are now added to the connected map as a client-side **feature layer** instead of a
  temporary graphics overlay. The layer appears in the Layer List with an attribute table, popups,
  a legend and a title taken from the uploaded file, and the Filter, Select, Chart and Table widgets
  can consume it. This removes the download-a-GeoJSON-and-Add-Data round trip that people were doing
  to get a usable layer.
- Every source column travels with the point as an attribute. Field names are sanitized for the
  Maps SDK and the original column heading is kept as the field alias, so the attribute table reads
  like the source file. Two fields are added: `MATCH_ADDR` and `MATCH_SCORE`.
- **Remove from map** in the Results card takes the layer off again. **Clear** no longer touches
  layers, so a second file can be geocoded without losing the first one.
- Two builder settings under **Map layer**: **Layer title** (blank means use the file name) and
  **Replace the previous layer on a new run** (on by default).
- In-widget **Help** guide following the shared widget pattern: `theme.ts` and `HelpPopup.tsx` copied
  unchanged from the reference widget, a new `helpSections.ts`, and a first-run hint stored per
  browser under `csvGeocoder.helpHintDismissed.<widgetId>`. Eight sections, gated on four feature
  flags computed from the same checks the UI uses.

### Changed

- The layer is no longer removed when the widget unmounts. It is the deliverable: people close the
  panel and keep working with the layer elsewhere in the app.
- The **4. Export** tooltip now says the points are already on the map, so exporting is for keeping
  a file rather than for getting the data onto the map.
- Field mapper placeholders read `(select column)` and `(none)` instead of em-dashed versions.

### Fixed

- Visual Studio error list. `tsconfig.json` is now self-contained (no `extends`, no `baseUrl`, no
  `paths`, empty `types`, classic `jsx: "react"`), and `src/exb-editor-shims.d.ts` is a byte copy of
  the shared master. This clears the several hundred `TS2339 JSX.IntrinsicElements`,
  `TS2875 @emotion/react/jsx-runtime`, `TS2503 __esri`, `TS2306 is not a module` and `IDE1100`
  errors that came from the editor trying to read `client/node_modules` and `client/jimu-core`.
- Every `.tsx` file that uses Emotion's `css` prop carries the `/** @jsx jsx */` pragma again, so the
  webpack build no longer depends on a JSX setting in any `tsconfig.json`.
- `src/papaparse-min.d.ts` no longer references the real `@types/papaparse`, which the editor could
  not read through the pnpm junction.
- `src/setting/setting.tsx` uses a local structural props type instead of
  `AllWidgetSettingProps<IMConfig>`, which reports TS2709 against the shared shim.

## 1.0.2

- Initial public release line. See the repository history for detail.
