type HardwarePresetName = 'apple-m3-max' | 'default';

type HardwarePreset = {
    name: HardwarePresetName;
    description: string;
    overrides: Record<string, any>;
};

const presets: Record<HardwarePresetName, HardwarePreset> = {
    'apple-m3-max': {
        name: 'apple-m3-max',
        description: 'Apple M3 Max (128 GB) tuned for Vision Pro authoring',
        overrides: {
            camera: {
                pixelScale: 0.75,
                multisample: true,
                toneMapping: 'aces2',
                exposure: 1.15,
                overlay: true,
                xrCompatible: true,
                powerPreference: 'high-performance'
            },
            controls: {
                dampingFactor: 0.28,
                maxZoom: 25,
                orbitSensitivity: 0.4,
                zoomSensitivity: 0.3
            },
            show: {
                grid: false,
                bound: false
            },
            debug: {
                showBound: false
            }
        }
    },
    default: {
        name: 'default',
        description: 'Standard browser defaults',
        overrides: {}
    }
};

const resolvePresetName = (): HardwarePresetName => {
    if (typeof window !== 'undefined') {
        try {
            const url = new URL(window.location.href);
            const requested = url.searchParams.get('preset');
            if (requested && requested in presets) {
                return requested as HardwarePresetName;
            }
        } catch {
            // ignore malformed URLs and fall through to default
        }
    }

    return 'apple-m3-max';
};

const getHardwarePreset = () => {
    const name = resolvePresetName();
    return presets[name];
};

export { getHardwarePreset, presets, type HardwarePreset };
