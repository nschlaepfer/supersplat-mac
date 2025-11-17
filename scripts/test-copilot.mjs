import { spawn } from 'node:child_process';
import process from 'node:process';

const PORT = process.env.COPILOT_TEST_PORT || '4757';
const BASE_URL = `http://127.0.0.1:${PORT}`;
const MODEL_ENV = process.env.COPILOT_TEST_MODEL;
const HEALTH_TIMEOUT_MS = 1000;
const HEALTH_RETRIES = 15;

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const fetchJson = async (path, init) => {
    const res = await fetch(`${BASE_URL}${path}`, init);
    if (!res.ok) {
        throw new Error(`${path} failed (${res.status}) ${await res.text()}`);
    }
    return res.json();
};

const main = async () => {
    console.log('Starting SuperSplat Copilot server for tests...');
    const child = spawn('node', ['copilot/server.mjs'], {
        env: {
            ...process.env,
            COPILOT_PORT: PORT,
            COPILOT_ALLOW_ORIGIN: 'http://localhost'
        },
        stdio: ['ignore', 'inherit', 'inherit']
    });

    const shutdown = () => {
        if (!child.killed) {
            child.kill();
        }
    };

    process.on('exit', shutdown);
    process.on('SIGINT', () => {
        shutdown();
        process.exit(1);
    });

    let healthy = false;
    for (let attempt = 0; attempt < HEALTH_RETRIES; attempt++) {
        try {
            await fetchJson('/copilot/health');
            healthy = true;
            break;
        } catch (err) {
            await sleep(HEALTH_TIMEOUT_MS);
        }
    }

    if (!healthy) {
        shutdown();
        throw new Error('Copilot server never became healthy. Is ollama serve running?');
    }

    console.log('✓ Copilot health endpoint reachable');

    const models = await fetchJson('/copilot/models');
    if (!Array.isArray(models) || models.length === 0) {
        shutdown();
        throw new Error('No Ollama models reported. Run `ollama pull <model>` first.');
    }

    console.log(`✓ Detected ${models.length} model(s)`);

    const modelName = MODEL_ENV || models[0].model || models[0].name;
    if (!modelName) {
        shutdown();
        throw new Error('Unable to determine model name from Ollama response.');
    }

    console.log(`Using model: ${modelName}`);

    const response = await fetchJson('/copilot/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            model: modelName,
            messages: [{ role: 'user', content: 'Say hello from the SuperSplat copilot test.' }]
        })
    });

    if (!response?.message?.content) {
        shutdown();
        throw new Error('Copilot chat test did not return assistant content.');
    }

    console.log('✓ Chat response received');
    console.log(`Copilot replied: ${response.message.content}`);

    shutdown();
    console.log('All copilot checks passed.');
};

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
