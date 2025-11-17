type CopilotMessage = {
    role: string;
    content?: string | any;
    tool_calls?: any[];
};

type ChatRequest = {
    provider: 'ollama' | 'openai';
    model: string;
    messages: CopilotMessage[];
    toolset?: string[];
    context?: Record<string, any>;
    options?: Record<string, any>;
};

const getBaseUrl = () => {
    const configured = (window as any).__SUPERSPLAT_COPILOT_URL as string | undefined;
    if (configured) {
        return configured;
    }
    const hostname = window.location.hostname || 'localhost';
    return `${window.location.protocol}//${hostname}:4545`;
};

const request = async <T>(path: string, init: RequestInit = {}): Promise<T> => {
    const response = await fetch(`${getBaseUrl()}${path}`, init);
    if (!response.ok) {
        throw new Error(await response.text());
    }
    return response.json();
};

const fetchModels = (provider: 'ollama' | 'openai', opts: { openaiKey?: string } = {}) => request<any[]>(`/copilot/models?provider=${provider}`, {
    headers: opts.openaiKey ? { 'x-openai-key': opts.openaiKey } : undefined
});

const sendChat = (payload: ChatRequest, opts: { openaiKey?: string } = {}) => request<any>('/copilot/chat', {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        ...(opts.openaiKey ? { 'x-openai-key': opts.openaiKey } : {})
    },
    body: JSON.stringify(payload)
});

export { fetchModels, sendChat, type CopilotMessage };
