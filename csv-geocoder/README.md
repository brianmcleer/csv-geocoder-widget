# CSV Geocoder Widget

An ArcGIS Experience Builder custom widget that lets users upload a CSV or Excel file of addresses, map columns to address fields, geocode against a configurable locator service, add the matched points to the connected Map widget as a real map layer, and export the results.

The matched points are not a temporary graphics overlay. They are added as a client-side feature layer, so they appear in the Layer List with an attribute table, popups and a legend, and the Filter, Select, Chart and Table widgets can all consume them. Nobody has to download a GeoJSON and bring it back in through Add Data.

## Features

- Upload CSV, TSV, TXT, XLSX, XLS, or ODS files via drag-and-drop or browse
- Auto-detect address columns by header name (street, city, state/region, zip/postal, country)
- Use either one full-address column or separate address-component columns
- Geocode in configurable batches against an ArcGIS Locator service
- Add matched points to the connected map as a client-side feature layer, named after the uploaded file, with every source column carried through as an attribute and the original column heading kept as the field alias
- Remove that layer again from inside the widget, or keep stacking one layer per run
- Set a minimum match score, point symbol, and zoom-to-results behavior
- View live progress and cancel an active run
- Review matched, failed, and match-rate totals
- Open a searchable failure-review panel showing the source row, mapped address, score, failure reason, best candidate, and original field values
- Export matched points as GeoJSON, KML, or a zipped Shapefile
- Read a searchable in-widget help guide written in plain language, with a first-run hint for new users
- Use the workflow with keyboard navigation and screen-reader status announcements

## Requirements

- ArcGIS Experience Builder Developer Edition 1.21
- A Map widget on the same page as this widget
- Network access to the configured Locator service

## Install

1. Copy the `csv-geocoder` folder directly to:

   ```text
   client/your-extensions/widgets/csv-geocoder
   ```

   The widget manifest must be located at:

   ```text
   client/your-extensions/widgets/csv-geocoder/manifest.json
   ```

2. Open a terminal in the Experience Builder **`client`** folder and install the client workspace dependencies:

   ```bash
   pnpm ci
   ```

   Do not run a separate install inside this widget folder and do not copy a widget-level `node_modules` directory. Experience Builder collects dependencies declared in custom-widget `package.json` files when the client workspace is installed.

   The `xlsx` (SheetJS) dependency is vendored with the widget as a local tarball at `vendor/xlsx-0.20.3.tgz`, referenced from `package.json` as `file:vendor/xlsx-0.20.3.tgz`. This is the official, patched SheetJS 0.20.3 release. It is vendored rather than fetched from a registry because SheetJS no longer publishes to npm, and the abandoned npm copy (`xlsx@0.18.5`) has unfixed advisories. Because the tarball ships inside the widget, no external network access is required at install time, and `npm audit` reports zero vulnerabilities.

3. Start Experience Builder from the `client` folder using the command supplied by your 1.21 installation (normally `pnpm start`).

4. Add both this widget and a Map widget to a page. In the CSV Geocoder settings, connect the Map widget and configure the Locator URL or API key as needed.

## TypeScript in an editor

The widget carries a self-contained `tsconfig.json` and `src/exb-editor-shims.d.ts` so it can be opened on its own, one widget folder at a time, without the editor trying to read anything under `client/node_modules`. Both are editor-only: `noEmit` is set and the Experience Builder webpack build never reads either file.

On an Experience Builder 1.21 install (pnpm), an editor often cannot read the junctioned files under `client/node_modules` at all, which produces a long list of errors that have nothing to do with the widget:

- `Property 'div' does not exist on type 'JSX.IntrinsicElements'`
- `This JSX tag requires the module path '@emotion/react/jsx-runtime' to exist`
- `Cannot find namespace '__esri'` and `... is not a module`, reported against files under `client/jimu-core`
- `IDE1100 Access to the path ... is denied`

The configuration here avoids all of it. There is no `extends`, no `baseUrl` and no `paths`, `types` is empty, and every module the widget imports is declared ambiently in `src/exb-editor-shims.d.ts`. JSX is the classic `react` factory rather than the automatic runtime, so nothing ever resolves `@emotion/react/jsx-runtime`, and the global `JSX` namespace comes from `src/jsx-global.d.ts`. Every `.tsx` file that uses Emotion's `css` prop carries the `/** @jsx jsx */` pragma, which is what makes the webpack build independent of any editor setting.

Type check the widget from its own folder:

```powershell
npx tsc -p .
```

That should report 0 errors. It checks types only, not webpack resolution, so confirm the build with `pnpm start` in `client` afterwards.

ArcGIS Maps SDK modules are imported through Experience Builder's `esri/*` aliases rather than `@arcgis/core/*`. The alias has no real package behind it, so the editor matches the ambient declaration and never opens a `node_modules` file, and webpack maps it to `@arcgis/core` at build time.

## Configuration

- **Map widget**: Required for displaying matched points.
- **Locator URL**: Defaults to the Esri World Geocoding Service. The service must expose `geocodeAddresses`.
- **API key / token**: Optional in the widget configuration. Use a referrer-restricted credential appropriate for the deployed app.
- **Batch size**: Number of addresses sent per request.
- **Minimum match score**: Results below this 0 to 100 threshold are reported as failures.
- **Point symbol**: Fill color, size, outline color, and outline width.
- **Default address mode**: Separate columns or one full-address column.
- **Zoom to results**: Fits the connected map to matched points when geocoding completes.
- **Layer title**: Title of the layer added to the map. Leave it blank and the layer takes the name of the uploaded file, so `Hydrants.csv` becomes a layer called `Hydrants`.
- **Replace the previous layer on a new run**: On by default, so running Geocode a second time replaces the layer the previous run added instead of filling the map up. Turn it off and each run adds another layer, numbered `(2)`, `(3)` and so on.

### Choosing single vs separate address fields

Match your field mapping to how the target Locator service was built, not just to how your spreadsheet is organized. Locator services are often managed by other organizations, and each one is configured to expect input a certain way:

- Some locators expect a single full-address string (for example, `123 Main St, Grand Junction, CO 81501`). For these, use **Single full address** and map your one combined column.
- Others expect separate components (address, city, region, postal code) sent to named fields. For these, use **Separate columns** and map each one.

Sending separate components to a locator built for single-line input (or the reverse) usually still returns results, but match rates and score quality can drop noticeably. If your match rate is unexpectedly low, try switching modes before assuming the data is bad. When in doubt, check the locator's service page (the `geocodeAddresses` endpoint lists its supported input fields) or ask whoever manages it which input style it was designed for. Some trial and error against a small sample is normal when connecting to a locator you did not build.

## Usage

1. Drop a supported address file onto the widget or select it with Browse.
2. Confirm or change the detected field mapping.
3. Select **Geocode** and monitor progress.
4. Review the result totals. The matched points are on the map by now, and the widget names the layer it added. Open that layer from the map's Layer List to see the attribute table, or click a point for its popup.
5. When failures are present, select **Review failures** to open the failure-review panel. Filter failures by row, address, reason, candidate, or any original source value; expand a failure to inspect the complete source row.
6. Close the panel and export matched points as GeoJSON, KML, or Shapefile when a file is needed as well.
7. **Remove from map** takes the layer off again. **Clear** empties the form only and leaves any layers already on the map alone, so a second file can be geocoded without losing the first.

The layer lives in the browser. Nothing is written to the portal, so no sign-in and no publisher privilege is needed, and closing the app loses it. The export buttons are still the way to keep a copy.

### Field names in the layer

Spreadsheet headings are not valid feature-layer field names, so each column is sanitized (spaces and punctuation become underscores, a leading digit gets an `F_` prefix, collisions get a numeric suffix) and the original heading is kept as the field alias. The attribute table therefore reads exactly like the source file. Two extra fields are added: `MATCH_ADDR`, the address the locator matched, and `MATCH_SCORE`, its confidence.

### Help guide

A **Help** button sits at the top right of the widget. It opens a short searchable guide written in plain language, and it adapts to how the widget is configured: the map layer section is dropped when no Map widget is connected, and the credit warning only appears when the app points at Esri's world geocoder. A first-run hint points new users at the guide until they dismiss it once.

### Using the exported Shapefile

The Shapefile export downloads as a `.zip` named like `geocoded-YYYY-MM-DD-shapefile.zip`. That outer zip contains a **folder**, and the actual shapefile parts (`.shp`, `.shx`, `.dbf`, `.prj`) live inside that folder. Most applications that accept a "zipped shapefile" (ArcGIS Online, Portal, and many web maps) expect a zip whose shapefile parts sit at the top level, not nested inside a folder. So to use the export:

1. Unzip the downloaded `geocoded-YYYY-MM-DD-shapefile.zip`.
2. Open the folder it produced. You should see the `.shp`, `.shx`, `.dbf`, and `.prj` files together.
3. Select those files (or the folder), and create a new zip from them so the parts are at the root of the new zip.
4. Upload that new zip to ArcGIS Online, Portal, or your target application.

GeoJSON and KML have no such step; they download as a single ready-to-use file. If you have a choice and just need the points in a web map quickly, GeoJSON is the simplest path.

## Security and data handling

File parsing and export generation occur in the browser. Only mapped address values are sent to the configured Locator service during geocoding. Original non-address attributes remain in the browser unless the user exports the results. Credentials stored in widget configuration become part of the app configuration, so apply service and referrer restrictions rather than embedding an unrestricted key.

## Troubleshooting

### The widget is duplicated

Check for a second source copy, an accidentally nested `csv-geocoder/csv-geocoder` folder, or stale output under `client/dist/widgets`. Stop the client, remove the duplicate or stale compiled folder, and restart it.

### `npm install` cannot find or fetch `xlsx`

The `xlsx` dependency resolves to the vendored file `vendor/xlsx-0.20.3.tgz` inside this widget. If install fails with an `ENOENT` for that path, the `vendor` folder did not travel with the widget; restore it from the release zip or re-download it:

```bash
curl.exe -L -o vendor\xlsx-0.20.3.tgz https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz
```

If install instead fails with `EALLOWREMOTE` ("Fetching packages of type remote have been disabled"), the environment's npm policy blocks remote tarballs. The vendored `file:` reference in this widget's `package.json` is specifically what avoids that, so confirm `package.json` still points at `file:vendor/xlsx-0.20.3.tgz` rather than a URL.

### The editor reports errors the build does not have

Open one widget folder at a time, not `client` and not the Experience Builder root. Errors whose file is under `client/jimu-core`, `client/dist/widgets` or `client/node_modules` belong to Experience Builder, not this widget, and appear whenever a file under `client` is open in a tab. In Visual Studio, set the Error List scope to **Open Documents** and sort by the File column before believing a count. Visual Studio caches the analysis in the widget's `.vs` folder, so after changing `tsconfig.json`: close the editor, delete `csv-geocoder/.vs`, reopen. `npx tsc -p .` in the widget folder is the authority; webpack is the authority for the build.

## License

Apache-2.0. Copyright 2026 City of Grand Junction, CO. See [LICENSE](LICENSE).
