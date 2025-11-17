# M3 Max + Vision Pro Workflow

This fork is tuned for a single developer machine (Apple Silicon M3 Max, 128 GB RAM) and for viewing the resulting splats on a Vision Pro running visionOS 2.6. This document captures the defaults that ship in this branch and how to operate the new tooling.

## Hardware preset

The runtime now boots with an `apple-m3-max` hardware preset. The preset enables the following out of the box:

- Oversampled render targets (`pixelScale = 0.75`) and multi-sampling for sharper splats on the M3 Max GPU.
- ACES2 tone mapping with a slightly brighter exposure tuned for Vision Pro passthrough lighting.
- Higher damping + sensitivity defaults so orbit/zoom controls feel right when driving the Vision Pro viewer remotely.

To fall back to the vanilla experience on weaker hardware, append `?preset=default` to the editor URL or set your own overrides via query parameters as before.

## Optimized build + local serve

Use the new npm scripts whenever you build or serve this fork locally:

```sh
npm run build:m3-max     # release build with expanded memory headroom
npm run serve:m3-max     # rebuild and host at http://localhost:3000
```

The build script pins `BUILD_TYPE=release` and bumps `NODE_OPTIONS` so Rollup/TypeScript can consume as much RAM as macOS will allow.

## Vision Pro payload pipeline

Use the helper script to create a portable bundle for Vision Pro:
```sh
npm run vision-pro:pipeline
```

Outputs land under `vision-pro/out/`:

- `app/` – ready-to-host static build (serve over HTTPS for Safari on Vision Pro).
- `supersplat-vision-pro.zip` – AirDrop this archive to the Vision Pro Files app and open `index.html` in Safari.
- `vision-os-manifest.json` – quick metadata for the hand-off or transport tooling.

Pass `--skip-build` if you already ran `npm run build:m3-max` and just want to repackage:

```sh
npm run vision-pro:pipeline -- --skip-build
```

### Recommended test flow

1. Run the pipeline to refresh `vision-pro/out/`.
2. AirDrop the zip to your Vision Pro (Files app).
3. Decompress, open `index.html` in Safari, and grant the app access to Local Files.
4. For networked streaming, host `vision-pro/out/app` with HTTPS on your Mac (`npx serve app -C --ssl-cert <cert> --ssl-key <key>`) and hit the LAN URL from Safari on visionOS 2.6.

This mirrors the workflow we intend to automate later with Xcode/RealityKit; today it keeps iteration times short while still validating on the real hardware.

## macOS desktop shell

Prefer a desktop app experience for quick edits? Use the Electron wrapper included in this fork:

```sh
npm run electron:start    # build and launch the app window locally
npm run electron:pack     # produce SuperSplat Vision Pro.dmg in release/mac/
```

The pack step uses `electron-builder` (arm64 target) so you can copy the `.app` into `/Applications` on your M3 Max. Since the payload is the exact same `dist/` output, anything that looks good here will look identical once pushed to the Vision Pro pipeline.
