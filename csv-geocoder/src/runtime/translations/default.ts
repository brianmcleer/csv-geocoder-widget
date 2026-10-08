export default {
  _widgetLabel: 'Address Geocoder',
  chooseFile: 'Choose a file',
  mapFields: 'Map address fields',
  geocode: 'Geocode',
  cancel: 'Cancel',
  clear: 'Clear',
  matched: 'Matched',
  failed: 'Unmatched',
  matchRate: 'Match rate',
  selectMapWidget: 'Select a Map widget in this widget’s settings to display points.',

  // ---------------------------------------------------------------------------
  // In-widget help guide. Shared keys keep the same names and the same wording
  // in every widget, so a user who learned the guide in one already knows it
  // here. See the widget playbook, Section 10.
  // ---------------------------------------------------------------------------
  helpTitle: 'Help',
  close: 'Close',
  helpIntro: 'This widget takes a list of addresses from a spreadsheet, checks each one against the address locator, and puts the matches on the map.',
  helpSearchPlaceholder: 'Search the guide (try "layer" or "unmatched")',
  helpNoMatches: 'Nothing in the guide matches that word. Try another, or open the sections above.',
  helpAnd: 'and',

  firstRunTitle: 'New here?',
  firstRunBody: 'Pick a spreadsheet of addresses, check the columns the widget guessed, and press Geocode.',
  firstRunHelpLink: 'Open the guide.',
  firstRunDismiss: 'Dismiss this tip',

  helpStartTitle: 'Start here: three steps',
  helpStart1: 'Under 1. Choose a file, press Browse for a file and pick your spreadsheet. A CSV or an Excel file both work.',
  helpStart2: 'Under 2. Map address fields, check the columns. The widget guesses them from your headings, so most of the time there is nothing to change.',
  helpStart3: 'Press Geocode and wait for the bar to fill. The points appear on the map when it finishes.',

  helpFileTitle: 'The file you bring',
  helpFileIntro: 'Almost any address list out of a spreadsheet works.',
  helpFile1: 'Accepted types: CSV, TSV, TXT, XLSX, XLS and ODS.',
  helpFile2: 'The first row has to be the column headings, one heading per column.',
  helpFile3: 'Only the first sheet of an Excel workbook is read, so put your addresses there.',
  helpFile4: 'Every other column comes along for the ride. Names, phone numbers, notes: all of it lands on the map with the point.',
  helpFile5: 'To swap files, press Choose a different file. Your previous results are cleared.',

  helpColumnsTitle: 'Matching your columns',
  helpColumnsIntro: 'The widget has to know which of your columns hold the address.',
  helpColumns1: 'Separate columns: pick a column for the street, the city, the state and the ZIP. Use this when the address is split up, which is the usual case.',
  helpColumns2: 'Single full address: pick the one column that holds the whole address on its own, like "250 N 5th St, Grand Junction, CO 81501".',
  helpColumns3: 'A guess is filled in from your headings. Look it over before pressing Geocode.',
  helpColumns4: 'Leave a box on (none) if you do not have that piece. Street and city are the two that matter most.',

  helpLayerTitle: 'The layer on the map',
  helpLayerIntro: 'Matched addresses become a real map layer, so there is nothing to download and add back.',
  helpLayer1: 'The layer is named after your file. Bring in Hydrants.csv and the layer is called Hydrants.',
  helpLayer2: 'It appears in the map’s layer list like any other layer. Turn it on and off, open its table, and click a point to see the whole row from your file.',
  helpLayer3: 'The rest of the app can use it too: filter it, select from it, put it in a chart or a table.',
  helpLayer4: 'The map moves to fit the points when geocoding finishes.',
  helpLayer5: 'Pressing Geocode again replaces the layer from your last run, so the map does not fill up while you fix a file and try again.',
  helpLayer5Keep: 'Pressing Geocode again adds another layer beside the first one, numbered (2), (3) and so on.',
  helpLayer6: 'Remove from map takes the layer off again. Clear does not: it empties the form and leaves your layers alone.',
  helpLayer7: 'The layer lasts as long as the app stays open. Close the tab and it is gone, so use 4. Export if you need to keep it.',

  helpResultsTitle: 'Reading the results',
  helpResults1: 'Matched: rows the geocoder found a place for.',
  helpResults2: 'Unmatched: rows it could not place, or placed with too little confidence. The small labels under the totals say why: low score, no match, blank address or service error.',
  helpResults3: 'Match rate: matched rows as a share of the whole file. Above 90 percent is a good file.',
  helpResults4: 'Review unmatched opens the full list of rows that did not make it, with the reason for each one. Filter it by reason or search it, then download what is on screen as a CSV. Download unmatched saves the whole list in one click.',

  helpCheckTitle: 'Checking a list of addresses',
  helpCheckIntro: 'The widget doubles as an address checker: it tells you which rows are in the address locator and which are not.',
  helpCheck1: 'Upload the list and press Geocode. Matched means the locator found the address.',
  helpCheck2: 'Under 4. Export, pick Unmatched, then CSV or Excel. You get only the rows that need a look, each with its reason in the FAIL_REASON column.',
  helpCheck3: 'Low score: the locator found something close but not close enough. MATCH_ADDR shows what it found, which usually points to a typo, a wrong suffix or a missing unit.',
  helpCheck4: 'No match: the locator found nothing. Blank address: the row has no address in the mapped columns. Service error: the request failed, so run the file again.',
  helpCheck5: 'Matched (tied) means two candidates scored the same. It counts as matched, but it is worth a second look.',
  helpCheck6: 'Pick All rows instead to get the whole file back with MATCH_STATUS on every row. Excel then adds Unmatched and Matched sheets and a Summary sheet with the totals.',

  helpExportTitle: 'Downloading a copy',
  helpExportIntro: 'Two kinds of download: a table of your rows, or a map file of the matched points.',
  helpExport1: 'Address check table: CSV or Excel, for all rows, only the unmatched ones, or only the matched ones. Every original column is kept, with the match result added on the right.',
  helpExport2: 'Map file: GeoJSON for web maps and ArcGIS Online, KML for Google Earth, or a Shapefile ZIP for ArcGIS Pro. Matched points only, since an unmatched row has no place to draw.',
  helpExport3: 'Excel opens the CSV with accented letters intact, and a value that starts with = or + is kept as text, never run as a formula.',
  helpExport4: 'The file lands in your downloads folder, named after your file with the date and time.',

  helpTroubleTitle: 'If something looks wrong',
  helpTrouble1: 'No points appear: no map is connected to this widget. Checking and the table export still work. Ask the GIS Division to connect a map if you need the points drawn.',
  helpTrouble2: 'Nothing happened after you picked a file: the file had no readable rows. Check that row one is the column headings and that there is at least one row under it.',
  helpTrouble3: 'Everything is unmatched: the columns are matched to the wrong things. Go back to 2. Map address fields and check each box.',
  helpTrouble4: 'Many rows say low score: the addresses are close but not close enough. Spelling, a missing city or a missing ZIP are the usual reasons.',
  helpTrouble5: 'The points landed in the wrong part of the country: the city or state column is empty, so the geocoder guessed. Fill those columns in and run it again.',
  helpTrouble6: 'The layer is gone: the browser tab was closed or reloaded. Run the file again, or bring back the copy you exported.',
  helpTroubleContact: 'Still stuck? Contact the GIS Division and mention the CSV Geocoder name and this app.',

  helpTipsTitle: 'Good to know',
  helpTips1: 'Clean addresses win. Take out apartment numbers and notes like "behind the school" before you start.',
  helpTips2: 'A big file is fine. The bar shows how far along it is, and Cancel stops it.',
  helpTips3: 'Clear empties the form so you can start on another file.',
  helpTips5: 'Rows with a blank address are never sent to the locator, so they cost nothing and show up as Blank address.',
  helpTips4: 'This app uses Esri’s worldwide address finder, which spends credits on large runs. Check with the GIS Division before running tens of thousands of rows.'
}
