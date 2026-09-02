# CSV Geocoder Widget

An ArcGIS Experience Builder custom widget that lets users upload a CSV or Excel file of addresses, map columns to address fields, geocode against a configurable locator service, display matched points on a connected Map widget, and export the results.

## Features

- Upload CSV, TSV, TXT, XLSX, XLS, or ODS files via drag-and-drop or browse
- Auto-detect address columns by header name (street, city, state/region, zip/postal, country)
- Use either one full-address column or separate address-component columns
- Geocode in configurable batches against an ArcGIS Locator service
- Set a minimum match score, point symbol, and zoom-to-results behavior
- View live progress and cancel an active run
- Review matched, failed, and match-rate totals
- Open a searchable failure-review panel showing the source row, mapped address, score, failure reason, best candidate, and original field values
- Export matched points as GeoJSON, KML, or a zipped Shapefile
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

## TypeScript and VS Code

Open the complete Experience Builder **`client` folder** in VS Code, not the isolated `csv-geocoder` folder. The client project supplies the React, DOM, Jimu, ArcGIS Maps SDK, and path-mapping declarations used by custom widgets. Opening only the widget directory can produce misleading errors such as:

- `Property 'div' does not exist on type 'JSX.IntrinsicElements'`
- `Property 'useMapWidgetIds' does not exist ...`
- `...d.ts is not a module` for `react-dom` or ArcGIS modules

This release also removes the obsolete `/** @jsx jsx */` pragma required by older Experience Builder/Emotion builds and imports ArcGIS Maps SDK modules through Experience Builder's `esri/*` aliases.

## Configuration

- **Map widget**: Required for displaying matched points.
- **Locator URL**: Defaults to the Esri World Geocoding Service. The service must expose `geocodeAddresses`.
- **API key / token**: Optional in the widget configuration. Use a referrer-restricted credential appropriate for the deployed app.
- **Batch size**: Number of addresses sent per request.
- **Minimum match score**: Results below this 0–100 threshold are reported as failures.
- **Point symbol**: Fill color, size, outline color, and outline width.
- **Default address mode**: Separate columns or one full-address column.
- **Zoom to results**: Fits the connected map to matched points when geocoding completes.

### Choosing single vs separate address fields

Match your field mapping to how the target Locator service was built, not just to how your spreadsheet is organized. Locator services are often managed by other organizations, and each one is configured to expect input a certain way:

- Some locators expect a single full-address string (for example, `123 Main St, Grand Junction, CO 81501`). For these, use **Single full address** and map your one combined column.
- Others expect separate components (address, city, region, postal code) sent to named fields. For these, use **Separate columns** and map each one.

Sending separate components to a locator built for single-line input (or the reverse) usually still returns results, but match rates and score quality can drop noticeably. If your match rate is unexpectedly low, try switching modes before assuming the data is bad. When in doubt, check the locator's service page (the `geocodeAddresses` endpoint lists its supported input fields) or ask whoever manages it which input style it was designed for. Some trial and error against a small sample is normal when connecting to a locator you did not build.

## Usage

1. Drop a supported address file onto the widget or select it with Browse.
2. Confirm or change the detected field mapping.
3. Select **Geocode** and monitor progress.
4. Review the result totals. When failures are present, select **Review failures** to open the failure-review panel.
5. Filter failures by row, address, reason, candidate, or any original source value; expand a failure to inspect the complete source row.
6. Close the panel and export matched points as GeoJSON, KML, or Shapefile when needed.

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

### Jimu, React, DOM, or `esri/*` types are missing

Open the Experience Builder `client` folder as the VS Code workspace. For a custom web-extension repository outside `your-extensions`, add that repository folder to the client `tsconfig.json` `include` list.

## License

Apache-2.0. Copyright 2026 City of Grand Junction, CO. See [LICENSE](LICENSE).
