import { React, jsx, Immutable } from 'jimu-core'
import { MapWidgetSelector } from 'jimu-ui/advanced/setting-components'

import { type IMConfig, type Config, type SymbolConfig, DEFAULT_CONFIG } from '../config'

/**
 * Minimal settings panel. Uses only MapWidgetSelector from jimu-ui;
 * everything else is a native HTML element to avoid any risk of a
 * jimu-ui sub-component resolving to a non-component value in this
 * particular ExB build.
 *
 * If this version loads and the previous one did not, the issue was
 * one of: Switch / NumericInput / Select / SettingSection / SettingRow.
 */
/**
 * Local structural type rather than AllWidgetSettingProps<IMConfig>.
 *
 * Under the mode B editor setup (playbook Section 12 item 3) jimu-for-builder
 * is declared as a shorthand ambient module, and a shorthand module cannot be
 * used as a type: Visual Studio reports TS2709 "Cannot use namespace as a
 * type". The master shim is shared by every widget and must not be edited, so
 * the props are spelled out here instead. The shape is the same at runtime.
 *
 * Nothing under src/setting may import esri/*, directly or through a shared
 * module: the settings bundle loads in the builder, which has no map, and a
 * static esri import fails the whole bundle silently (Section 12 item 1).
 */
type SettingProps = {
    id: string
    config: IMConfig
    onSettingChange: (settings: any, ...rest: any[]) => void
    useMapWidgetIds?: string[]
    useDataSources?: any
    intl?: any
    theme?: any
    portalUrl?: string
    [key: string]: any
}

const Setting = (props: SettingProps): React.ReactElement => {
    const { config, onSettingChange, id, useMapWidgetIds } = props

    // For reads we treat config as a plain Config, because the runtime shape is
    // identical and this avoids "K cannot index ImmutableObject<Config>".
    const cfgRead = config as unknown as Config | undefined

    // ---- read with defaults --------------------------------------------------
    const get = <K extends keyof Config>(key: K): Config[K] => {
        if (cfgRead && cfgRead[key] !== undefined && cfgRead[key] !== null) {
            return cfgRead[key]
        }
        return DEFAULT_CONFIG[key]
    }
    const getSym = <K extends keyof SymbolConfig>(key: K): SymbolConfig[K] => {
        const s = cfgRead?.symbol
        if (s && s[key] !== undefined && s[key] !== null) {
            return s[key]
        }
        return DEFAULT_CONFIG.symbol[key]
    }

    // ---- writers -------------------------------------------------------------
    const update = <K extends keyof Config>(key: K, value: Config[K]): void => {
        const base = config ?? Immutable(DEFAULT_CONFIG)
        onSettingChange({ id, config: base.set(key as any, value) })
    }
    const updateSym = <K extends keyof SymbolConfig>(
        key: K, value: SymbolConfig[K]
    ): void => {
        let base = config ?? Immutable(DEFAULT_CONFIG)
        if (!base.symbol) base = base.set('symbol', DEFAULT_CONFIG.symbol)
        onSettingChange({ id, config: base.setIn(['symbol', key as any], value) })
    }
    const onMapWidgetSelected = (ids: string[]): void => {
        onSettingChange({ id, useMapWidgetIds: ids })
    }

    // ---- styles --------------------------------------------------------------
    const wrap: React.CSSProperties = { padding: 12, display: 'flex', flexDirection: 'column', gap: 14 }
    const section: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 6 }
    const h: React.CSSProperties = { fontSize: 12, fontWeight: 600, textTransform: 'uppercase', opacity: 0.7, margin: '8px 0 2px' }
    const row: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 2 }
    const lab: React.CSSProperties = { fontSize: 12 }
    const input: React.CSSProperties = { width: '100%', padding: '4px 6px', fontSize: 13, boxSizing: 'border-box' }
    const hint: React.CSSProperties = { display: 'block', fontSize: 11, opacity: 0.7, lineHeight: 1.4, marginTop: 2 }

    return (
        <div style={wrap}>
            <div style={section}>
                <div style={h}>Map</div>
                <div style={row}>
                    <label style={lab}>Connect to a Map widget</label>
                    <MapWidgetSelector
                        useMapWidgetIds={useMapWidgetIds}
                        onSelect={onMapWidgetSelected}
                    />
                </div>
            </div>

            <div style={section}>
                <div style={h}>Geocoding service</div>

                <div style={row}>
                    <label style={lab}>Locator URL</label>
                    <input
                        type='text'
                        style={input}
                        defaultValue={get('geocoderUrl')}
                        placeholder='https://geocode-api.arcgis.com/.../World/GeocodeServer'
                        onBlur={e => { update('geocoderUrl', e.target.value) }}
                    />
                </div>

                <div style={row}>
                    <label style={lab}>API key / token (optional)</label>
                    <input
                        type='password'
                        style={input}
                        defaultValue={get('apiKey')}
                        onBlur={e => { update('apiKey', e.target.value) }}
                    />
                </div>

                <div style={row}>
                    <label style={lab}>Batch size</label>
                    <input
                        type='number'
                        style={input}
                        min={1} max={1000} step={10}
                        defaultValue={get('batchSize')}
                        onBlur={e => { update('batchSize', Math.max(1, Math.round(Number(e.target.value) || 100))) }}
                    />
                </div>

                <div style={row}>
                    <label style={lab}>Minimum match score (0 to 100)</label>
                    <input
                        type='number'
                        style={input}
                        min={0} max={100} step={5}
                        defaultValue={get('minScore')}
                        onBlur={e => {
                            const n = Math.max(0, Math.min(100, Math.round(Number(e.target.value) || 0)))
                            update('minScore', n)
                        }}
                    />
                </div>
            </div>

            <div style={section}>
                <div style={h}>Behaviour</div>

                <div style={row}>
                    <label style={lab}>Default address mode</label>
                    <select
                        style={input}
                        value={get('defaultAddressMode')}
                        onChange={e => {
                            update('defaultAddressMode', e.target.value as IMConfig['defaultAddressMode'])
                        }}
                    >
                        <option value='multi'>Separate columns</option>
                        <option value='single'>Single full address</option>
                    </select>
                </div>

                <label style={{ ...lab, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <input
                        type='checkbox'
                        checked={get('zoomToResults')}
                        onChange={e => { update('zoomToResults', e.target.checked) }}
                    />
                    Zoom to results
                </label>
            </div>

            <div style={section}>
                <div style={h}>Map layer</div>

                <div style={row}>
                    <label style={lab}>Layer title</label>
                    <input
                        type='text'
                        style={input}
                        defaultValue={get('layerTitle')}
                        placeholder='Leave blank to use the file name'
                        onBlur={e => { update('layerTitle', e.target.value) }}
                    />
                    <span style={hint}>
                        Matched points are added to the connected map as a layer, so nobody has to
                        download a file and bring it back in. Blank means the layer takes the name
                        of the uploaded file.
                    </span>
                </div>

                <label style={{ ...lab, display: 'flex', alignItems: 'flex-start', gap: 6 }}>
                    <input
                        type='checkbox'
                        checked={get('replacePreviousLayer')}
                        onChange={e => { update('replacePreviousLayer', e.target.checked) }}
                    />
                    <span>
                        Replace the previous layer on a new run
                        <span style={hint}>
                            Off: every run adds another layer, numbered (2), (3) and so on.
                        </span>
                    </span>
                </label>
            </div>

            <div style={section}>
                <div style={h}>Point symbol</div>

                <div style={{ ...row, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <label style={lab}>Fill colour</label>
                    <input
                        type='color'
                        value={getSym('color')}
                        onChange={e => { updateSym('color', e.target.value) }}
                        style={{ width: 40, height: 26, padding: 0, border: 'none', background: 'transparent' }}
                    />
                </div>

                <div style={row}>
                    <label style={lab}>Size (px)</label>
                    <input
                        type='number'
                        style={input}
                        min={4} max={40}
                        defaultValue={getSym('size')}
                        onBlur={e => { updateSym('size', Math.max(4, Math.min(40, Number(e.target.value) || 10))) }}
                    />
                </div>

                <div style={{ ...row, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <label style={lab}>Outline colour</label>
                    <input
                        type='color'
                        value={getSym('outlineColor')}
                        onChange={e => { updateSym('outlineColor', e.target.value) }}
                        style={{ width: 40, height: 26, padding: 0, border: 'none', background: 'transparent' }}
                    />
                </div>

                <div style={row}>
                    <label style={lab}>Outline width</label>
                    <input
                        type='number'
                        style={input}
                        min={0} max={6} step={0.5}
                        defaultValue={getSym('outlineWidth')}
                        onBlur={e => { updateSym('outlineWidth', Math.max(0, Math.min(6, Number(e.target.value) || 1.5))) }}
                    />
                </div>
            </div>
        </div>
    )
}

export default Setting