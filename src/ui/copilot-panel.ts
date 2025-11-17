import { BooleanInput, Button, Container, Label, SelectInput, TextAreaInput, TextInput } from '@playcanvas/pcui';
import { Events } from '../events';
import { fetchModels, sendChat, type CopilotMessage } from '../services/copilot';
import { Splat } from '../splat';

const SETTINGS_KEY = 'supersplat.copilotSettings';

const roleLabel = (role: string) => {
    switch (role) {
        case 'user': return 'You';
        case 'assistant': return 'Copilot';
        case 'tool': return 'Action';
        case 'system': return 'System';
        default: return role;
    }
};

type CopilotSettings = {
    provider: 'ollama' | 'openai';
    openaiKey: string;
    allowedTools: string[];
    includeScreenshot: boolean;
    includeSceneSummary: boolean;
    preferredModels: Record<string, string>;
};

const DEFAULT_SETTINGS: CopilotSettings = {
    provider: 'ollama',
    openaiKey: '',
    allowedTools: ['fireEvent', 'explainStep'],
    includeScreenshot: true,
    includeSceneSummary: true,
    preferredModels: {}
};

type ModelTag = { id?: string, name?: string, model?: string };

class CopilotPanel extends Container {
    private events: Events;
    private canvas: HTMLCanvasElement;
    private messages: CopilotMessage[] = [];
    private logEl: HTMLDivElement;
    private modelSelect: SelectInput;
    private providerSelect: SelectInput;
    private input: TextAreaInput;
    private sendBtn: Button;
    private statusLabel: Label;
    private launcher: HTMLButtonElement;
    private settingsContainer: Container;
    private apiKeyInput: TextInput;
    private screenshotToggle: BooleanInput;
    private sceneToggle: BooleanInput;
    private toolToggleMap: Record<string, BooleanInput> = {};
    private open = false;
    private showSettings = false;
    private settings: CopilotSettings;

    constructor(events: Events, canvas: HTMLCanvasElement) {
        super({ id: 'copilot-panel', class: 'copilot-panel hidden' });
        this.events = events;
        this.canvas = canvas;
        this.settings = this.loadSettings();

        this.statusLabel = new Label({ text: 'Connecting…', class: 'copilot-status' });

        this.providerSelect = new SelectInput({
            class: 'copilot-provider',
            options: [
                { v: 'ollama', t: 'Local (Ollama)' },
                { v: 'openai', t: 'OpenAI' }
            ],
            value: this.settings.provider
        });
        this.providerSelect.on('change', (value: string) => {
            this.settings.provider = value as 'ollama' | 'openai';
            this.persistSettings();
            this.loadModels();
            this.updateSendAvailability();
            this.updateSettingsVisibility();
        });

        this.modelSelect = new SelectInput({ options: [], class: 'copilot-model-select' });
        this.modelSelect.on('change', (value: string) => {
            this.settings.preferredModels[this.settings.provider] = value;
            this.persistSettings();
        });

        const settingsButton = new Button({ text: 'Settings', class: 'copilot-settings-button' });
        settingsButton.on('click', () => this.toggleSettings());

        const refreshButton = new Button({ text: 'Refresh Models', class: 'copilot-refresh secondary' });
        refreshButton.on('click', () => this.loadModels(true));

        const header = new Container({ class: 'copilot-header' });
        const titleRow = new Container({ class: 'copilot-title-row' });
        titleRow.append(new Label({ text: 'AI Copilot', class: 'copilot-title' }));
        titleRow.append(settingsButton);
        header.append(titleRow);
        header.append(this.providerSelect);
        header.append(this.modelSelect);
        header.append(refreshButton);
        header.append(this.statusLabel);

        this.logEl = document.createElement('div');
        this.logEl.className = 'copilot-log';

        const logContainer = new Container({ class: 'copilot-log-container' });
        logContainer.dom.appendChild(this.logEl);

        this.input = new TextAreaInput({
            class: 'copilot-input',
            placeholder: 'Ask how to clean up splats, change tools, or publish…'
        });
        this.input.dom?.setAttribute('rows', '3');

        this.input.on('change', () => {});

        this.sendBtn = new Button({ text: 'Send', class: 'copilot-send primary' });
        this.sendBtn.on('click', () => this.submit());

        const footer = new Container({ class: 'copilot-footer' });
        footer.append(this.input);
        footer.append(this.sendBtn);

        this.settingsContainer = this.createSettingsPanel();

        this.append(header);
        this.append(this.settingsContainer);
        this.append(logContainer);
        this.append(footer);

        this.launcher = document.createElement('button');
        this.launcher.className = 'copilot-launcher';
        this.launcher.textContent = 'AI Copilot';
        this.launcher.addEventListener('click', () => this.toggle());

        this.updateSettingsVisibility();
        this.loadModels();
        this.updateSendAvailability();
    }

    attachLauncher(parent: HTMLElement) {
        parent.appendChild(this.launcher);
    }

    private loadSettings(): CopilotSettings {
        try {
            const raw = localStorage.getItem(SETTINGS_KEY);
            if (!raw) {
                return { ...DEFAULT_SETTINGS };
            }
            const parsed = JSON.parse(raw);
            return {
                ...DEFAULT_SETTINGS,
                ...parsed,
                preferredModels: parsed?.preferredModels ?? {}
            };
        } catch (err) {
            console.warn('Failed to parse copilot settings', err);
            return { ...DEFAULT_SETTINGS };
        }
    }

    private persistSettings() {
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(this.settings));
    }

    private toggle() {
        this.open = !this.open;
        if (this.open) {
            this.dom.classList.remove('hidden');
            this.launcher.classList.add('active');
        } else {
            this.dom.classList.add('hidden');
            this.launcher.classList.remove('active');
        }
    }

    private toggleSettings() {
        this.showSettings = !this.showSettings;
        this.updateSettingsVisibility();
    }

    private updateSettingsVisibility() {
        if (this.showSettings) {
            this.settingsContainer.dom.classList.remove('hidden');
        } else {
            this.settingsContainer.dom.classList.add('hidden');
        }

        if (this.settings.provider === 'openai') {
            this.settingsContainer.dom.classList.add('provider-openai');
        } else {
            this.settingsContainer.dom.classList.remove('provider-openai');
        }

        if (this.settings.provider === 'openai' && !this.settings.openaiKey) {
            this.setStatus('Add your OpenAI API key', false);
        }
    }

    private createSettingsPanel() {
        const panel = new Container({ class: 'copilot-settings hidden' });

        const apiRow = new Container({ class: 'copilot-settings-row copilot-api-row' });
        apiRow.append(new Label({ text: 'OpenAI API key' }));
        this.apiKeyInput = new TextInput({ class: 'copilot-input-key', value: this.settings.openaiKey });
        this.apiKeyInput.dom?.setAttribute('type', 'password');
        this.apiKeyInput.on('change', (value: string) => {
            this.settings.openaiKey = value.trim();
            this.persistSettings();
            this.loadModels();
            this.updateSendAvailability();
        });
        apiRow.append(this.apiKeyInput);
        panel.append(apiRow);

        this.screenshotToggle = new BooleanInput({ label: 'Attach viewport screenshot automatically (OpenAI only)', value: this.settings.includeScreenshot });
        this.screenshotToggle.on('change', (value: boolean) => {
            this.settings.includeScreenshot = value;
            this.persistSettings();
        });
        panel.append(this.screenshotToggle);

        this.sceneToggle = new BooleanInput({ label: 'Include current splat summary in prompts', value: this.settings.includeSceneSummary });
        this.sceneToggle.on('change', (value: boolean) => {
            this.settings.includeSceneSummary = value;
            this.persistSettings();
        });
        panel.append(this.sceneToggle);

        const toolset = new Container({ class: 'copilot-settings-row copilot-tool-row' });
        toolset.append(new Label({ text: 'Allowed tools' }));

        const toolOptions: Record<string, string> = {
            fireEvent: 'Fire SuperSplat events',
            explainStep: 'Explain instructions'
        };

        Object.entries(toolOptions).forEach(([key, label]) => {
            const toggle = new BooleanInput({ label, value: this.settings.allowedTools.includes(key) });
            toggle.on('change', (value: boolean) => {
                this.setToolAllowed(key, value);
            });
            this.toolToggleMap[key] = toggle;
            toolset.append(toggle);
        });

        panel.append(toolset);

        return panel;
    }

    private setToolAllowed(toolName: string, enabled: boolean) {
        const current = new Set(this.settings.allowedTools);
        if (enabled) {
            current.add(toolName);
        } else {
            current.delete(toolName);
        }
        this.settings.allowedTools = Array.from(current);
        this.persistSettings();
    }

    private updateSendAvailability() {
        const requiresKey = this.settings.provider === 'openai';
        this.sendBtn.enabled = !(requiresKey && !this.settings.openaiKey);
    }

    private async loadModels(force = false) {
        if (this.settings.provider === 'openai' && !this.settings.openaiKey) {
            this.modelSelect.options = [];
            this.setStatus('Add OpenAI key to load models', false);
            return;
        }

        try {
            const models: ModelTag[] = await fetchModels(this.settings.provider, { openaiKey: this.settings.openaiKey });
            const opts = models.map(m => ({
                v: m.model || m.name || m.id,
                t: m.model || m.name || m.id
            })).filter(opt => !!opt.v);
            if (opts.length === 0) {
                this.modelSelect.options = [];
                this.setStatus('No models found', false);
                return;
            }
            this.modelSelect.options = opts;
            const preferred = this.settings.preferredModels[this.settings.provider];
            const firstValue = preferred && opts.find(opt => opt.v === preferred) ? preferred : opts[0].v;
            if (force || !this.modelSelect.value) {
                this.modelSelect.value = firstValue;
            }
            this.setStatus(`${this.settings.provider === 'openai' ? 'OpenAI' : 'Ollama'} ready`);
        } catch (err) {
            this.modelSelect.options = [];
            this.setStatus(`Copilot offline: ${err}`, false);
        }
    }

    private getSelectedModel() {
        return this.modelSelect.value as string;
    }

    private log(role: string, content: string) {
        this.messages.push({ role, content });
        const row = document.createElement('div');
        row.className = `copilot-row copilot-${role}`;
        const label = document.createElement('strong');
        label.textContent = roleLabel(role);
        const body = document.createElement('p');
        body.textContent = content;
        row.appendChild(label);
        row.appendChild(body);
        this.logEl.appendChild(row);
        this.logEl.scrollTop = this.logEl.scrollHeight;
    }

    private logAssistantMessage(rawContent: any) {
        if (typeof rawContent === 'string') {
            this.log('assistant', rawContent);
        } else if (Array.isArray(rawContent)) {
            const text = rawContent.map(part => part.text || part.type || part.image_url?.url).filter(Boolean).join('\n');
            if (text) {
                this.log('assistant', text);
            }
        } else if (rawContent?.text) {
            this.log('assistant', rawContent.text);
        }
    }

    private shouldAttachScreenshot() {
        return this.settings.provider === 'openai' && this.settings.includeScreenshot;
    }

    private captureScreenshot() {
        if (!this.canvas) {
            return null;
        }
        try {
            return this.canvas.toDataURL('image/png');
        } catch (err) {
            console.warn('Unable to capture screenshot', err);
            return null;
        }
    }

    private shouldAttachSceneSummary() {
        return this.settings.includeSceneSummary;
    }

    private buildSceneSummary() {
        try {
            const splats = (this.events.invoke('scene.allSplats') as Splat[]) || [];
            if (!splats.length) {
                return 'No splats loaded.';
            }
            return splats.map((splat, index) => {
                const name = splat.name || `Splat ${index + 1}`;
                return `${name} | gaussians=${splat.numSplats} | visible=${splat.visible ? 'yes' : 'no'}`;
            }).join('\n');
        } catch (err) {
            console.warn('Unable to summarize scene', err);
            return null;
        }
    }

    private getEnabledTools() {
        const enabled = Object.entries(this.toolToggleMap)
        .filter(([, input]) => input.value)
        .map(([name]) => name);
        return enabled.length ? enabled : ['explainStep'];
    }

    private async submit() {
        const message = this.input.value.trim();
        if (!message || !this.getSelectedModel()) {
            return;
        }
        if (this.settings.provider === 'openai' && !this.settings.openaiKey) {
            this.setStatus('Add your OpenAI API key first', false);
            return;
        }

        this.log('user', message);
        this.input.value = '';
        this.sendBtn.enabled = false;

        try {
            const screenshot = this.shouldAttachScreenshot() ? this.captureScreenshot() : null;
            const summary = this.shouldAttachSceneSummary() ? this.buildSceneSummary() : null;
            const context: Record<string, any> = {};
            if (screenshot) {
                context.screenshot = screenshot;
            }
            if (summary) {
                context.sceneSummary = summary;
            }

            const response = await sendChat({
                provider: this.settings.provider,
                model: this.getSelectedModel(),
                messages: this.messages,
                toolset: this.getEnabledTools(),
                context
            }, this.settings.provider === 'openai' ? { openaiKey: this.settings.openaiKey } : undefined);
            const assistantMessage = response?.message;
            if (assistantMessage?.content) {
                this.logAssistantMessage(assistantMessage.content);
            }
            if (assistantMessage?.tool_calls) {
                this.handleToolCalls(assistantMessage.tool_calls);
            }
        } catch (err) {
            this.log('system', `Copilot error: ${err}`);
        } finally {
            this.sendBtn.enabled = true;
        }
    }

    private handleToolCalls(toolCalls: any[]) {
        toolCalls.forEach((call) => {
            const name = call?.function?.name;
            const rawArgs = call?.function?.arguments;
            let args: any = rawArgs;
            if (typeof rawArgs === 'string') {
                try {
                    args = JSON.parse(rawArgs);
                } catch (e) {
                    args = {};
                }
            }
            if (name === 'fireEvent' && args?.event) {
                this.events.fire(args.event, args.payload);
                this.log('tool', `Fired event ${args.event}`);
            } else if (name === 'explainStep' && args?.message) {
                this.log('assistant', args.message);
            }
        });
    }

    private setStatus(text: string, ok = true) {
        this.statusLabel.text = text;
        this.statusLabel.dom.setAttribute('data-status', ok ? 'ok' : 'error');
    }
}

export { CopilotPanel };
