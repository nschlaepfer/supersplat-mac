#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');
const distDir = path.join(repoRoot, 'dist');
const visionDir = path.join(repoRoot, 'vision-pro');
const outDir = path.join(visionDir, 'out');
const appDir = path.join(outDir, 'app');
const manifestPath = path.join(outDir, 'vision-os-manifest.json');
const zipPath = path.join(outDir, 'supersplat-vision-pro.zip');

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

const zipPayload = () => {
    const zipDir = path.dirname(zipPath);
    mkdirSync(zipDir, { recursive: true });
    // remove older archive to avoid appending
    rmSync(zipPath, { force: true });
    run('zip', ['-qr', zipPath, '.'], { cwd: appDir });
};

const logSummary = () => {
    console.log('\nVision Pro payload ready.');
    console.log(`App bundle: ${appDir}`);
    console.log(`Manifest:   ${manifestPath}`);
    console.log(`Archive:    ${zipPath}`);
    console.log('\nTransfer the zip via AirDrop or host app/ over HTTPS to test on device.');
};

ensureDist();
stageFiles();
writeManifest();
zipPayload();
logSummary();
