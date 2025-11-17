import { Vec3 } from 'playcanvas';

import { Scene } from './scene';
import { Events } from './events';
import { ElementType } from './element';
import { Splat } from './splat';

const captureDataUrl = (canvas: HTMLCanvasElement) => {
    try {
        return canvas.toDataURL('image/png');
    } catch (err) {
        console.warn('Failed to capture preview frame', err);
        return null;
    }
};

const buildSplatMetadata = (splats: Splat[]) => {
    return splats.map((splat, index) => {
        const bound = splat.worldBound;
        const dims = bound ? bound.halfExtents.clone().scale(2) : null;
        return {
            index,
            name: splat.name,
            gaussians: splat.numSplats,
            selected: splat.numSelected,
            locked: splat.numLocked,
            deleted: splat.numDeleted,
            shBands: (splat.entity.gsplat?.instance?.resource as any)?.shBands ?? 3,
            bounds: bound ? {
                center: {
                    x: bound.center.x,
                    y: bound.center.y,
                    z: bound.center.z
                },
                size: {
                    x: dims.x,
                    y: dims.y,
                    z: dims.z
                }
            } : null
        };
    });
};

const initPreviewBridge = (scene: Scene, canvas: HTMLCanvasElement, events: Events) => {
    const existing = (window as any).__supersplatPreview;
    if (existing?.initialized) {
        return;
    }

    const bridge = existing || {};
    bridge.initialized = true;
    bridge.isReady = false;

    const setCameraPose = (azim = scene.camera.azim, elev = scene.camera.elevation, distance = scene.camera.distance) => {
        scene.camera.setAzimElev(azim, elev, 0);
        scene.camera.setDistance(distance, 0);
    };

    bridge.setReady = () => {
        bridge.isReady = true;
    };

    bridge.captureFrame = () => captureDataUrl(canvas);
    bridge.setCameraPose = setCameraPose;
    bridge.orbit = (azimDelta: number, elevDelta = 0) => {
        setCameraPose(scene.camera.azim + azimDelta, scene.camera.elevation + elevDelta, scene.camera.distance);
    };
    bridge.getSceneMetadata = () => {
        const splats = scene.getElementsByType(ElementType.splat) as Splat[];
        return {
            count: splats.length,
            splats: buildSplatMetadata(splats),
            camera: {
                azim: scene.camera.azim,
                elev: scene.camera.elevation,
                distance: scene.camera.distance
            }
        };
    };
    bridge.focusOrigin = () => {
        scene.camera.setFocalPoint(new Vec3(0, 0, 0), 0);
    };

    (window as any).__supersplatPreview = bridge;

    events.on('scene.clear', () => {
        bridge.isReady = false;
    });
};

const markPreviewReady = () => {
    (window as any).__supersplatPreview?.setReady?.();
};

export { initPreviewBridge, markPreviewReady };
