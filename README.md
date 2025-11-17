# SuperSplat - 3D Gaussian Splat Editor

[![Github Release](https://img.shields.io/github/v/release/playcanvas/supersplat)](https://github.com/playcanvas/supersplat/releases)
[![License](https://img.shields.io/github/license/playcanvas/supersplat)](https://github.com/playcanvas/supersplat/blob/main/LICENSE)
[![Discord](https://img.shields.io/badge/Discord-5865F2?style=flat&logo=discord&logoColor=white&color=black)](https://discord.gg/RSaMRzg)
[![Reddit](https://img.shields.io/badge/Reddit-FF4500?style=flat&logo=reddit&logoColor=white&color=black)](https://www.reddit.com/r/PlayCanvas)
[![X](https://img.shields.io/badge/X-000000?style=flat&logo=x&logoColor=white&color=black)](https://x.com/intent/follow?screen_name=playcanvas)

| [SuperSplat Editor](https://superspl.at/editor) | [User Guide](https://developer.playcanvas.com/user-manual/gaussian-splatting/editing/supersplat/) | [Blog](https://blog.playcanvas.com) | [Forum](https://forum.playcanvas.com) |

SuperSplat is a free and open source tool for inspecting, editing, optimizing and publishing 3D Gaussian Splats. This fork focuses exclusively on high‑end Apple Silicon workstations (M3 Max/Ultra class) so we can prototype on-device generative splats and MPS-accelerated workflows before handing scenes off to a Vision Pro running visionOS 2.6.

A live version of the upstream tool is available at: https://superspl.at/editor

![image](https://github.com/user-attachments/assets/b6cbb5cc-d3cc-4385-8c71-ab2807fd4fba)

To learn more about using SuperSplat, please refer to the [User Guide](https://developer.playcanvas.com/user-manual/gaussian-splatting/editing/supersplat/).

## Local Development

To initialize a local development environment for SuperSplat, ensure you have [Node.js](https://nodejs.org/) 18 or later installed. Follow these steps:

1. Clone the repository:

   ```sh
   git clone https://github.com/playcanvas/supersplat.git
   cd supersplat
   ```

2. Install dependencies:

   ```sh
   npm install
   ```

3. Build SuperSplat and start a local web server:

   ```sh
   npm run develop
   ```

4. Open a web browser tab and make sure network caching is disabled on the network tab and the other application caches are clear:

   - On Safari you can use `Cmd+Option+e` or Develop->Empty Caches.
   - On Chrome ensure the options "Update on reload" and "Bypass for network" are enabled in the Application->Service workers tab:

   <img width="846" alt="Screenshot 2025-04-25 at 16 53 37" src="https://github.com/user-attachments/assets/888bac6c-25c1-4813-b5b6-4beecf437ac9" />

5. Navigate to `http://localhost:3000`

When changes to the source are detected, SuperSplat is rebuilt automatically. Simply refresh your browser to see your changes.

### Apple M3 Max + Vision Pro workflow

This fork assumes an Apple Silicon M3 Max (128 GB) workstation and a Vision Pro (visionOS 2.6) for on-device validation while we experiment with future generative/MPS pipelines. Use the dedicated scripts when working in this branch:

- `npm run build:m3-max` – release build with additional memory headroom and tuned render defaults.
- `npm run serve:m3-max` – rebuild and serve the high-performance build locally. The editor autoloads the bundled dragon sample so you can validate tweaks instantly (override via the usual `?load=` query if you need different scenes).
- `npm run vision-pro:pipeline` – package the current build into `vision-pro/out/` for AirDrop or HTTPS hosting on the headset.

The end-to-end workflow (hardware preset details, pipeline output, and sideload steps) is documented in [`docs/m3-max-vision-pro.md`](docs/m3-max-vision-pro.md).

### macOS Electron build

Prefer a desktop app shell for tight iteration on M3 Max hardware? Use the bundled Electron tooling:

1. `npm run electron:start` – builds `dist/` with the M3 preset and launches Electron pointing at the local files (unset `ELECTRON_RUN_AS_NODE` so Electron can render windows). Export `ELECTRON_DEVTOOLS=true` if you always want DevTools docked.
2. `npm run electron:pack` – rebuilds and creates a signed (but not notarized) `.dmg` under `release/mac/` targeting Apple Silicon. Drag the resulting `SuperSplat Vision Pro.app` into `/Applications` on your Mac.

The Electron wrapper automatically appends `preset=apple-m3-max`, exposes `docs/` and `samples/` in the menu bar, and shares the same optimized `dist/` output you’d push to a Vision Pro build. It also launches the bundled Copilot proxy server so the AI assistant works out of the box. A guided onboarding overlay highlights the M3/visionOS workflow on first launch and can be skipped or dismissed permanently.

### AI Copilot (Ollama or OpenAI)

Spin up a local assistant (Ollama) or connect to OpenAI’s GPT-4o / GPT-5 codex models to drive SuperSplat hands-free:

1. [Install Ollama](https://ollama.com/download) and start the daemon (`ollama serve`) **or** grab an OpenAI API key (sk-…).
2. Pull at least one local model (`ollama pull qwen2.5-coder:7b`, `llama3.1:8b`, etc.).
3. Start the proxy server: `npm run copilot:server`. Environment knobs: `OLLAMA_URL`, `COPILOT_PORT`, `OPENAI_BASE_URL`, `COPILOT_ALLOW_ORIGIN`.
4. Launch the app, click **AI Copilot**, and open the in-panel **Settings** drawer:
   - Choose provider: *Local (Ollama)* or *OpenAI*.
   - For OpenAI, paste your API key (stored only in localStorage) and pick any Responses/Chat model (e.g., `gpt-4o`, `gpt-5.1-codex`).
   - Toggle which tools the assistant may call (`fireEvent`, `explainStep`) and whether to auto-attach viewport screenshots + splat summaries for multimodal models.
5. Ask questions or give commands; the copilot can either explain the next steps or fire events such as `tool.brushSelection`, `select.all`, `camera.focus`, etc.

Validate your Ollama stack anytime with `COPILOT_TEST_MODEL="llama3.1:8b" npm run copilot:test`, which boots the proxy, pings the daemon, and performs a sample chat exchange.

The copilot never leaves your machine—requests stay between the browser, the proxy server, and the Ollama runtime.

## Contributors

SuperSplat is made possible by our amazing open source community:

<a href="https://github.com/playcanvas/supersplat/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=playcanvas/supersplat" />
</a>
