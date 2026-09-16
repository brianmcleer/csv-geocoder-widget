import type { HelpSection } from './components/HelpPopup'

/**
 * Content for the in-widget help guide. The presentation lives in
 * components/HelpPopup.tsx, which is copied between widgets unchanged; this
 * file is the only part written per widget. See the playbook, Section 10.6.
 *
 * Every flag below is computed by widget.tsx from the same check the UI itself
 * uses, so the guide never describes a control that is not on screen.
 */
export interface HelpFeatures {
  /** A Map widget is connected, so there is a layer to talk about at all. */
  mapConnected: boolean
  /** The map moves to fit the points when geocoding finishes. */
  zoomToResults: boolean
  /** A second run replaces the previous run's layer instead of stacking. */
  replaceLayer: boolean
  /** The app is pointed at Esri's world locator, which spends credits. */
  worldLocator: boolean
}

type T = (id: string, values?: Record<string, string>) => string

export function buildHelpSections (t: T, f: HelpFeatures): HelpSection[] {
  const when = (on: boolean, ...ids: string[]): string[] => (on ? ids.map((id: string) => t(id)) : [])

  return [
    {
      key: 'start',
      icon: 'play',
      title: t('helpStartTitle'),
      ordered: true,
      body: [t('helpStart1'), t('helpStart2'), t('helpStart3')]
    },
    {
      key: 'file',
      icon: 'file',
      title: t('helpFileTitle'),
      intro: t('helpFileIntro'),
      body: [t('helpFile1'), t('helpFile2'), t('helpFile3'), t('helpFile4'), t('helpFile5')]
    },
    {
      key: 'columns',
      icon: 'grid-unit',
      title: t('helpColumnsTitle'),
      intro: t('helpColumnsIntro'),
      body: [t('helpColumns1'), t('helpColumns2'), t('helpColumns3'), t('helpColumns4')]
    },
    // Dropped entirely, not emptied, when no map is connected: a heading with
    // nothing under it reads worse than no heading at all.
    ...(f.mapConnected
      ? [{
          key: 'layer',
          icon: 'map',
          title: t('helpLayerTitle'),
          intro: t('helpLayerIntro'),
          body: [
            t('helpLayer1'),
            t('helpLayer2'),
            t('helpLayer3'),
            ...when(f.zoomToResults, 'helpLayer4'),
            t(f.replaceLayer ? 'helpLayer5' : 'helpLayer5Keep'),
            t('helpLayer6'),
            t('helpLayer7')
          ]
        }]
      : []),
    {
      key: 'results',
      icon: 'list-check',
      title: t('helpResultsTitle'),
      body: [t('helpResults1'), t('helpResults2'), t('helpResults3'), t('helpResults4')]
    },
    {
      key: 'export',
      icon: 'download',
      title: t('helpExportTitle'),
      intro: t('helpExportIntro'),
      body: [t('helpExport1'), t('helpExport2'), t('helpExport3'), t('helpExport4')]
    },
    {
      key: 'trouble',
      icon: 'exclamation-mark-triangle',
      title: t('helpTroubleTitle'),
      body: [
        ...when(!f.mapConnected, 'helpTrouble1'),
        t('helpTrouble2'),
        t('helpTrouble3'),
        t('helpTrouble4'),
        t('helpTrouble5'),
        ...when(f.mapConnected, 'helpTrouble6'),
        t('helpTroubleContact')
      ]
    },
    {
      key: 'tips',
      icon: 'lightbulb',
      title: t('helpTipsTitle'),
      body: [
        t('helpTips1'),
        t('helpTips2'),
        t('helpTips3'),
        ...when(f.worldLocator, 'helpTips4')
      ]
    }
  ]
}
