#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { cpSync, createWriteStream, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import handler from 'serve-handler';
import puppeteer from 'puppeteer';
import GIFEncoder from 'gifencoder';
import { PNG } from 'pngjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');
const distDir = path.join(repoRoot, 'dist');
const visionDir = path.join(repoRoot, 'vision-pro');
const outDir = path.join(visionDir, 'out');
const appDir = path.join(outDir, 'app');
const manifestPath = path.join(outDir, 'vision-os-manifest.json');
const zipPath = path.join(outDir, 'supersplat-vision-pro.zip');
const previewDir = path.join(outDir, 'previews');
const previewThumbPath = path.join(previewDir, 'thumbnail.png');
const previewGifPath = path.join(previewDir, 'turntable.gif');
const previewMetaPath = path.join(previewDir, 'metadata.json');

const args = new Set(process.argv.slice(2));
const skipBuild = args.has('--skip-build');

const run = (cmd, cmdArgs, options = {}) => {
    const result = spawnSync(cmd, cmdArgs, {
        stdio: 'inherit',
        ...options
    });

    if (result.status !== 0) {
        throw new Error(`Command failed: ${cmd} ${cmdArgs.join(' ')}`);
    }
};

const ensureDist = () => {
    if (skipBuild) {
        if (!existsSync(distDir)) {
            throw new Error('dist folder missing. Re-run without --skip-build first.');
        }
        return;
    }

    run('npm', ['run', 'build:m3-max'], { cwd: repoRoot });
};

const stageFiles = () => {
    rmSync(outDir, { recursive: true, force: true });
    mkdirSync(appDir, { recursive: true });
    cpSync(distDir, appDir, { recursive: true });
};

const writeManifest = () => {
    const manifest = {
        target: 'visionOS 2.6',
        hardware: 'Apple Vision Pro',
        generatedAt: new Date().toISOString(),
        instructions: {
            sideload: 'AirDrop supersplat-vision-pro.zip to Vision Pro Files and open index.html in Safari.',
            hosting: 'Host contents of app/ folder behind HTTPS and load from Safari on Vision Pro.'
        }
    };

    writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
};

const startStaticServer = (root, port) => {
    const server = http.createServer((request, response) => handler(request, response, { public: root }));
    return new Promise((resolve) => {
        server.listen(port, () => resolve(server));
    });
};

const stopStaticServer = (server) => new Promise((resolve) => server.close(resolve));

const dataUrlToBuffer = (dataUrl) => {
    const base64 = dataUrl.split(',')[1];
    return Buffer.from(base64, 'base64');
};

const writeGif = (buffers, outputPath, delay = 120) => {
    if (!buffers.length) {
        throw new Error('No frames provided for GIF generation.');
    }
    const first = PNG.sync.read(buffers[0]);
    const encoder = new GIFEncoder(first.width, first.height);
    const gifStream = encoder.createReadStream();
    mkdirSync(path.dirname(outputPath), { recursive: true });
    const outStream = createWriteStream(outputPath);
    gifStream.pipe(outStream);
    encoder.start();
    encoder.setRepeat(0);
    encoder.setDelay(delay);
    encoder.setQuality(10);

    buffers.forEach((buffer) => {
        const png = PNG.sync.read(buffer);
        encoder.addFrame(png.data);
    });

    encoder.finish();
    return new Promise((resolve) => outStream.on('close', resolve));
};

const generatePreviews = async () => {
    console.log('Generating preview thumbnail and turntable...');
    mkdirSync(previewDir, { recursive: true });
    const port = 4173;
    const server = await startStaticServer(appDir, port);

    const browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    try {
        const page = await browser.newPage();
        await page.goto(`http://127.0.0.1:${port}/index.html?preview=1`, { waitUntil: 'networkidle2', timeout: 60000 });
        await page.waitForFunction('window.__supersplatPreview && window.__supersplatPreview.isReady === true', { timeout: 60000 });

        const metadata = await page.evaluate(() => window.__supersplatPreview.getSceneMetadata());
        writeFileSync(previewMetaPath, JSON.stringify(metadata, null, 2));

        const thumbnailBuffer = dataUrlToBuffer(await page.evaluate(() => window.__supersplatPreview.captureFrame()));
        writeFileSync(previewThumbPath, thumbnailBuffer);

        const frames = [];
        const steps = 16;
        for (let i = 0; i < steps; i++) {
            const azim = i * (360 / steps);
            await page.evaluate((pose) => {
                window.__supersplatPreview.setCameraPose(pose.azim, pose.elev, pose.distance);
            }, { azim, elev: -15, distance: 1.3 });
            await page.waitForTimeout(140);
            frames.push(dataUrlToBuffer(await page.evaluate(() => window.__supersplatPreview.captureFrame())));
        }
        await writeGif(frames, previewGifPath, 140);
    } finally {
        await browser.close();
        await stopStaticServer(server);
    }
};

const zipPayload = () => {
    const zipDir = path.dirname(zipPath);
    mkdirSync(zipDir, { recursive: true });
    rmSync(zipPath, { force: true });
    run('zip', ['-qr', zipPath, '.'], { cwd: appDir });
};

const logSummary = () => {
    console.log('\nVision Pro payload ready.');
    console.log(`App bundle: ${appDir}`);
    console.log(`Manifest:   ${manifestPath}`);
    console.log(`Archive:    ${zipPath}`);
    console.log(`Thumbnail:  ${previewThumbPath}`);
    console.log(`Turntable:  ${previewGifPath}`);
    console.log('\nTransfer the zip via AirDrop or host app/ over HTTPS to test on device.');
};

const main = async () => {
    ensureDist();
    stageFiles();
    writeManifest();
    try {
        await generatePreviews();
    } catch (err) {
        console.warn('Preview generation failed:', err.message || err);
    }
    zipPayload();
    logSummary();
};

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
