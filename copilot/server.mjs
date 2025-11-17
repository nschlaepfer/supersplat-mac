import express from 'express';
import cors from 'cors';

const PORT = process.env.COPILOT_PORT || 4545;
const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
const OPENAI_BASE_URL = process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1';
const ALLOW_ORIGIN = process.env.COPILOT_ALLOW_ORIGIN || '*';
const SYSTEM_PROMPT = process.env.COPILOT_SYSTEM_PROMPT || 'You are SuperSplat Copilot, an assistant that helps manage the SuperSplat Gaussian Splat editor. You may call functions to fire editor events or explain next steps. Prefer function calls when users ask you to perform actions.';

const TOOL_LIBRARY = {
    fireEvent: {
        type: 'function',
        function: {
            name: 'fireEvent',
            description: 'Trigger a SuperSplat event inside the client. Use this to run commands like select.all, camera.focus, tool.move, etc.',
            parameters: {
                type: 'object',
                properties: {
                    event: {
                        type: 'string',
                        description: 'Event name to fire (e.g. select.all, tool.rectSelection)'
                    },
                    payload: {
                        type: 'object',
                        description: 'Optional payload sent along with the event'
                    }
                },
                required: ['event']
            }
        }
    },
    explainStep: {
        type: 'function',
        function: {
            name: 'explainStep',
            description: 'Provide textual instructions back to the user when no direct editor action is required.',
            parameters: {
                type: 'object',
                properties: {
                    message: {
                        type: 'string'
                    }
                },
                required: ['message']
            }
        }
    },
    saveMacro: {
        type: 'function',
        function: {
            name: 'saveMacro',
            description: 'Store a reusable macro composed of editor events.',
            parameters: {
                type: 'object',
                properties: {
                    name: { type: 'string' },
                    steps: {
                        type: 'array',
                        items: {
                            type: 'object',
                            properties: {
                                event: { type: 'string' },
                                payload: { type: 'object' },
                                delayMs: { type: 'number' }
                            },
                            required: ['event']
                        }
                    }
                },
                required: ['name', 'steps']
            }
        }
    },
    runMacro: {
        type: 'function',
        function: {
            name: 'runMacro',
            description: 'Execute a previously saved macro on the user\'s scene.',
            parameters: {
                type: 'object',
                properties: {
                    name: { type: 'string' }
                },
                required: ['name']
            }
        }
    }
};

const app = express();
app.use(cors({ origin: ALLOW_ORIGIN }));
app.use(express.json({ limit: '25mb' }));

const upstream = async (path, options = {}) => {
    const response = await fetch(`${OLLAMA_URL}${path}`, options);
    if (!response.ok) {
        const text = await response.text();
        throw new Error(`Ollama request failed (${response.status}): ${text}`);
    }
    return response.json();
};

const callOpenAi = async (path, apiKey, body, method = 'POST') => {
    const response = await fetch(`${OPENAI_BASE_URL}${path}`, {
        method,
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
        },
        body: body ? JSON.stringify(body) : undefined
    });

    if (!response.ok) {
        const text = await response.text();
        throw new Error(`OpenAI request failed (${response.status}): ${text}`);
    }

    return response.json();
};

const buildTools = (toolset) => {
    const keys = Array.isArray(toolset) && toolset.length ? toolset : Object.keys(TOOL_LIBRARY);
    return keys.map(key => TOOL_LIBRARY[key]).filter(Boolean);
};

const buildContextBlocks = (context = {}) => {
    const blocks = [];
    if (context.sceneSummary) {
        blocks.push({ label: 'Scene summary', body: context.sceneSummary });
    }
    if (context.macros?.length) {
        const macroText = context.macros.map((macro, index) => `${index + 1}. ${macro.name} (${macro.steps} steps)`).join('\n');
        blocks.push({ label: 'Saved macros', body: macroText });
    }
    if (context.recentActions?.length) {
        blocks.push({ label: 'Recent actions', body: context.recentActions.join('\n') });
    }
    return blocks;
};

const convertMessagesForOpenAi = (messages, context) => {
    const converted = messages.map(msg => {
        if (Array.isArray(msg.content)) {
            return msg;
        }
        return {
            role: msg.role,
            content: [{ type: 'text', text: msg.content ?? '' }]
        };
    });

    if (context?.screenshot) {
        for (let i = converted.length - 1; i >= 0; i--) {
            if (converted[i].role === 'user') {
                converted[i].content.push({
                    type: 'image_url',
                    image_url: {
                        url: context.screenshot
                    }
                });
                break;
            }
        }
    }

    const blocks = buildContextBlocks(context);
    blocks.forEach((block) => {
        converted.push({
            role: 'user',
            content: [{ type: 'text', text: `${block.label}:\n${block.body}` }]
        });
    });

    return converted;
};

app.get('/copilot/health', async (req, res) => {
    try {
        await upstream('/api/version');
        res.json({ ok: true });
    } catch (err) {
        res.status(500).json({ ok: false, error: err.message });
    }
});

app.get('/copilot/models', async (req, res) => {
    const provider = (req.query.provider || 'ollama').toString();
    try {
        if (provider === 'openai') {
            const apiKey = req.headers['x-openai-key'] || process.env.OPENAI_API_KEY;
            if (!apiKey) {
                res.status(400).json({ error: 'OpenAI API key missing. Provide x-openai-key header or set OPENAI_API_KEY.' });
                return;
            }
            const result = await callOpenAi('/models', apiKey, null, 'GET');
            const models = result.data?.map(m => ({ id: m.id, owned_by: m.owned_by })) || [];
            res.json(models);
        } else {
            const models = await upstream('/api/tags');
            res.json(models.models || models);
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/copilot/chat', async (req, res) => {
    const { model, messages = [], options = {}, toolset = [], context = {}, provider = 'ollama' } = req.body;

    if (!model) {
        res.status(400).json({ error: 'model is required' });
        return;
    }

    const tools = buildTools(toolset);

    try {
        const contextBlocks = buildContextBlocks(context);

        if (provider === 'openai') {
            const apiKey = req.headers['x-openai-key'] || req.body.openaiKey || process.env.OPENAI_API_KEY;
            if (!apiKey) {
                res.status(400).json({ error: 'OpenAI API key missing. Provide x-openai-key header, include openaiKey in body, or set OPENAI_API_KEY.' });
                return;
            }

            const response = await callOpenAi('/chat/completions', apiKey, {
                model,
                temperature: options.temperature ?? 0.2,
                parallel_tool_calls: true,
                tools,
                messages: [
                    { role: 'system', content: SYSTEM_PROMPT },
                    ...convertMessagesForOpenAi(messages, context)
                ]
            });

            const choice = response?.choices?.[0];
            res.json({ provider: 'openai', message: choice?.message, raw: response });
        } else {
            const payload = {
                model,
                stream: false,
                options,
                tools,
                messages: [
                    { role: 'system', content: SYSTEM_PROMPT },
                    ...messages,
                    ...contextBlocks.map((block) => ({ role: 'system', content: `${block.label}:\n${block.body}` }))
                ]
            };

            const response = await upstream('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            res.json({ provider: 'ollama', ...response });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.listen(PORT, () => {
    console.log(`SuperSplat Copilot server listening on http://localhost:${PORT}`);
    console.log(`Proxying requests to Ollama at ${OLLAMA_URL}`);
});
