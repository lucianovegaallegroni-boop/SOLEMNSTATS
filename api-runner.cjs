const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');
require('dotenv').config();

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
            body: req.body,
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

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Local API Runner listening on http://localhost:${PORT}`);
});
