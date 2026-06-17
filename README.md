# csv-geocoder-widget

GitHub home of the **CSV Geocoder** custom widget for ArcGIS Experience Builder.

The widget lets users upload a CSV or Excel file of addresses, map columns to address fields, geocode against a configurable Esri Locator service, display matched points on a connected Map widget, and export the results as GeoJSON, KML, or Shapefile.

For full feature, install, and configuration documentation, see [`csv-geocoder/README.md`](csv-geocoder/README.md).

## Download

Grab the latest release from the [Releases](https://github.com/brianmcleer/csv-geocoder-widget/releases) page, or clone this repository and use the `csv-geocoder/` subfolder.

The same `.zip` is also attached to the Esri Community post linked below.

## Repository layout

```
csv-geocoder-widget/
├── README.md                <- this file (GitHub landing page)
├── LICENSE                  <- Apache-2.0
├── .gitignore
├── publish.ps1              <- automation: sync from EB, push, cut release
└── csv-geocoder/            <- the widget; drop this folder into your-extensions/widgets
    ├── package.json
    ├── package-lock.json    <- generated in the real EB environment
    ├── manifest.json
    ├── config.json
    ├── icon.svg
    ├── README.md            <- widget-level install + usage docs
    ├── LICENSE
    ├── .gitignore
    ├── .npmignore
    └── src/ ...
```

## Install (downstream users)

1. Place the `csv-geocoder/` folder directly inside your EB install at `client/your-extensions/widgets/csv-geocoder/` so `manifest.json` sits directly inside that folder, not nested.
2. From the `client` folder, run `npm install`. EB picks up the widget's dependencies from its `package.json` automatically.
3. Run `npm start`, then add the widget to a page that has a Map widget.

Full steps are in [`csv-geocoder/README.md`](csv-geocoder/README.md), including settings, usage, and troubleshooting.

## Publishing (maintainer)

This repo follows the City of Grand Junction widget-publishing convention (see the GIS team handoff playbook). The `publish.ps1` script automates the workflow:

1. Edit the three variables at the top of `publish.ps1`:
   - `$WidgetName` — the widget folder name (default `csv-geocoder`)
   - `$RepoName` — the GitHub repo name (default `csv-geocoder-widget`)
   - `$EBClient` — the local path to the EB `client` folder
2. From the repo root, run:

   ```
   powershell -ExecutionPolicy Bypass -File .\publish.ps1
   ```

   The script pulls the widget folder from EB, strips `node_modules` and `.vs`, commits, and pushes. On the first run it initializes git and creates the GitHub repo via the `gh` CLI.

3. To cut a downloadable release, add the `-Release` flag with a version tag:

   ```
   powershell -ExecutionPolicy Bypass -File .\publish.ps1 -Release v1.0.0
   ```

   This creates the git tag, builds a zip of the `csv-geocoder/` subfolder, and uploads it as the release asset.

### Version tag rules

- Bug fix: `v1.0.1`, `v1.0.2`
- New feature: `v1.1.0`, `v1.2.0`
- Major change: `v2.0.0`

## Esri Community

Discussion, screenshots, and downloadable zip attachments live on the Esri Community thread:

https://community.esri.com/t5/experience-builder-custom-widgets/csv-geocoder-widget/ba-p/1708724

## License

Apache-2.0. Copyright 2026 City of Grand Junction, CO. See [LICENSE](LICENSE).
