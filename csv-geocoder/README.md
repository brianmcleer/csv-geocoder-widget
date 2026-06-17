# CSV Geocoder Widget

An ArcGIS Experience Builder custom widget that lets users upload a CSV or Excel file of addresses, map columns to address fields, geocode against a configurable locator service, display matched points on a connected Map widget, and export the results.

## Features

- Upload CSV, TSV, TXT, XLSX, XLS, or ODS files via drag-and-drop or browse
- Auto-detect address columns by header name (street, city, state/region, zip/postal, country)
- Two address modes: single full-address column, or separate columns mapped to Esri Locator fields
- Batched geocoding against any ArcGIS Locator service (defaults to the public Esri World Geocoding Service)
- Configurable minimum match score, batch size, point symbol, and zoom-to-results behavior
- Live progress bar with cancel support
- Results summary showing matched, failed, and match rate
- Export matched points as GeoJSON, KML, or zipped Shapefile
- Full WCAG 2.1 AA accessibility: keyboard navigation, screen-reader live regions, accessible tooltips, focus management, forced-colors and reduced-motion support

## Requirements

- ArcGIS Experience Builder Developer Edition 1.19 or 1.20 (React 19)
- A Map widget on the same page as this widget

## Install

1. Place the `csv-geocoder` folder directly inside `client/your-extensions/widgets/` so that `manifest.json` sits at:

   ```
   client/your-extensions/widgets/csv-geocoder/manifest.json
   ```

   Do not nest it a second level deep. A nested folder is the most common cause of the widget not registering.

2. From the `client` folder, run:

   ```
   npm install
   ```

   Experience Builder installs all of this widget's dependencies (`papaparse`, `xlsx`, `@mapbox/shp-write`, `@types/papaparse`) automatically from its `package.json`. No per-dependency commands are needed.

   > **Network note**: this widget installs `xlsx` (SheetJS) directly from `https://cdn.sheetjs.com/` rather than the npm registry. SheetJS no longer publishes to npm, and the most recent npm copy (0.18.5) has two open security advisories with no available fix. The CDN tarball pinned in `package.json` is the official, patched 0.20.x release. If your network blocks `cdn.sheetjs.com`, see the [SheetJS installation docs](https://docs.sheetjs.com/docs/getting-started/installation/nodejs) for offline-install options.

3. Start the dev server from the `client` folder:

   ```
   npm start
   ```

4. In Experience Builder, drop the widget into a page that also has a Map widget. Open the widget's settings, connect it to the Map widget, and optionally provide a Locator URL and API key.

## Configuration

All settings live in the widget's setting panel:

- **Map widget**: required. Points are added to the selected Map widget.
- **Locator URL**: defaults to the public Esri World Geocoding Service. Any service that exposes the `geocodeAddresses` REST endpoint will work.
- **API key**: optional. Required for batch use of the public Esri service. Stored in the app configuration, so use a referrer-restricted key.
- **Batch size**: addresses per `geocodeAddresses` request. Default 100.
- **Minimum match score**: 0 to 100. Records below this score are reported as failures and not added to the map or exports. Default 80.
- **Point symbol**: fill color, size, outline color, outline width.
- **Default address mode**: separate columns, or single full address.
- **Zoom to results**: auto-fit the map to matched points when geocoding completes.

## Usage

1. Drop a CSV or Excel file onto the widget, or click Browse.
2. Confirm the auto-detected column mapping, or pick the columns manually.
3. Click Geocode. A progress bar shows batch-by-batch progress; cancel anytime.
4. Review the results summary.
5. Optionally export matched points as GeoJSON, KML, or Shapefile.

## Security

This widget runs entirely in the browser. The file you upload is never sent anywhere except to the Esri Locator service you configure in settings, and only the address fields are sent (as part of a standard `geocodeAddresses` REST request). The locator returns coordinates; your original attribute data stays in the browser unless you click an export button.

`xlsx` (SheetJS) is pinned to the patched 0.20.x release via the SheetJS CDN. The two CVEs reported against the abandoned `xlsx@0.18.5` on npm (prototype pollution, ReDoS) do not affect this widget. `npm audit` reports zero vulnerabilities after `npm install`.

## Feedback

Open an issue on this repository, or reply on the Esri Community thread:

https://community.esri.com/t5/experience-builder-custom-widgets/csv-geocoder-widget/ba-p/1708724

## Troubleshooting: `<name> is duplicated`

If `npm start` fails with `csv-geocoder is duplicated`, a second copy of the widget exists in the install. Check, in this order:

1. A nested folder: `widgets/csv-geocoder/csv-geocoder`. The manifest must sit directly inside the widget folder, not a second level deep.
2. A leftover folder from an earlier build or version, including any `-copy` folder or a folder under a previous name if the widget was renamed.
3. A stale compiled build in `client/dist/widgets`. Stop the client server, delete the matching folder under `dist/widgets`, then start again. This is the common cause after moving the widget between EB versions, because the build can see both the new source and the old compiled output.

If removing one copy makes the widget disappear from the Entrypoint list entirely, the copy that remains is nested too deep. Move it so the manifest is directly inside the widget folder.

## License

Apache-2.0. Copyright 2026 City of Grand Junction, CO. See [LICENSE](LICENSE).
