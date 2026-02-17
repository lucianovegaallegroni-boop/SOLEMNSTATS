const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');
// Load root .env first, then frontend/.env (which has the Supabase credentials)
require('dotenv').config();
require('dotenv').config({ path: path.join(__dirname, 'frontend', '.env'), override: true });

const app = express();
app.use(cors());
app.use(express.json());

// Helper to run a Vercel handler locally
const runHandler = async (handlerPath, req, res, extraQuery = {}) => {
    try {
        console.log(`Calling handler: ${handlerPath}`);

        const { default: handler } = await import(`file://${path.resolve(handlerPath)}?update=${Date.now()}`);

        // Build a Vercel-like request object with merged query params
        const vercelReq = {
            method: req.method,
            headers: req.headers,
            body: req.body || {},
            query: { ...req.query, ...extraQuery },
        };

        // Mock Vercel response object
        const vercelRes = {
            status: (code) => {
                res.status(code);
                return vercelRes;
            },
            json: (data) => {
                res.json(data);
                return vercelRes;
            },
            send: (data) => {
                res.send(data);
                return vercelRes;
            },
            end: () => {
                res.end();
                return vercelRes;
            },
            setHeader: (name, value) => {
                res.setHeader(name, value);
                return vercelRes;
            },
        };

        await handler(vercelReq, vercelRes);
    } catch (error) {
        console.error(`Error in handler ${handlerPath}:`, error);
        res.status(500).json({ error: error.message, stack: error.stack });
    }
};

// Route mapping based on file structure
app.all('/api/:fn', (req, res) => {
    const { fn } = req.params;
    const tsFile = path.join(__dirname, 'api', `${fn}.ts`);
    if (fs.existsSync(tsFile)) {
        runHandler(tsFile, req, res);
    } else {
        res.status(404).json({ error: `Function ${fn} not found at ${tsFile}` });
    }
});

app.all('/api/:sub/:id', (req, res) => {
    // Basic support for dynamic routes like /api/deck/[id]
    const { sub, id } = req.params;

    // Check for [id].ts patterns
    const dynamicFile = path.join(__dirname, 'api', sub, '[id].ts');
    if (fs.existsSync(dynamicFile)) {
        runHandler(dynamicFile, req, res, { id }); // Pass id via extraQuery
    } else {
        res.status(404).json({ error: `Function ${sub}/${id} not found` });
    }
});

app.all('/api/:sub/:id/:action', (req, res) => {
    const { sub, id, action } = req.params;

    // Check for api/sub/[id]/action.ts
    // e.g. api/deck/[id]/combos.ts
    const actionFile = path.join(__dirname, 'api', sub, '[id]', `${action}.ts`);

    if (fs.existsSync(actionFile)) {
        return runHandler(actionFile, req, res, { id });
    }

    res.status(404).json({ error: `Function ${sub}/${id}/${action} not found` });
});

const PORT = process.env.PORT || 3010;
const server = app.listen(PORT, () => {
    console.log(`Local API Runner listening on http://localhost:${PORT}`);
});

// Keep process alive and better error handling
process.on('uncaughtException', (err) => {
    console.error('UNCAUGHT EXCEPTION:', err);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('UNHANDLED REJECTION at:', promise, 'reason:', reason);
});

// Heartbeat to prevent premature exit and confirm it's alive
setInterval(() => {
    // just keep the event loop busy
}, 10000);

console.log('API Runner initialized. Event loop should be active.');
