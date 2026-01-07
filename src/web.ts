import HTTP from 'node:http';
import { updateConfig, restartBot, getStatus } from './bot.ts';

const PORT = process.env.PORT || 10000;
const API_KEY = process.env.API_KEY || 'changeme';

const parseBody = (req: HTTP.IncomingMessage): Promise<string> => {
        return new Promise((resolve) => {
                let body = '';
                req.on('data', chunk => body += chunk);
                req.on('end', () => resolve(body));
        });
};

const checkAuth = (key: string): boolean => key === API_KEY;

// Minimal black & white dashboard (Vercel-style)
const getDashboard = () => `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>AlterBot</title>
    <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: #000;
            min-height: 100vh;
            color: #fff;
            padding: 40px 20px;
            display: flex;
            flex-direction: column;
        }
        .container { max-width: 420px; margin: 0 auto; flex: 1; }
        h1 {
            font-size: 1.5rem;
            font-weight: 600;
            margin-bottom: 32px;
            letter-spacing: -0.02em;
        }
        .card {
            background: #111;
            border: 1px solid #222;
            border-radius: 8px;
            padding: 20px;
            margin-bottom: 16px;
        }
        .status-card { display: flex; align-items: center; gap: 12px; }
        .status-dot {
            width: 8px; height: 8px; border-radius: 50%;
            background: #f00;
        }
        .status-dot.connected { background: #0f0; }
        .status-text { font-size: 0.875rem; color: #888; }
        .status-info { font-size: 0.75rem; color: #555; margin-top: 4px; }
        
        label {
            display: block;
            font-size: 0.75rem;
            color: #666;
            margin-bottom: 6px;
            margin-top: 16px;
            text-transform: uppercase;
            letter-spacing: 0.05em;
        }
        label:first-child { margin-top: 0; }
        input {
            width: 100%;
            padding: 10px 12px;
            background: #000;
            border: 1px solid #333;
            border-radius: 6px;
            color: #fff;
            font-size: 0.875rem;
            transition: border-color 0.15s;
        }
        input:focus {
            outline: none;
            border-color: #fff;
        }
        input::placeholder { color: #444; }
        
        .btn {
            width: 100%;
            padding: 10px 16px;
            border: none;
            border-radius: 6px;
            font-size: 0.875rem;
            font-weight: 500;
            cursor: pointer;
            transition: all 0.15s;
            margin-top: 20px;
        }
        .btn-primary {
            background: #fff;
            color: #000;
        }
        .btn-primary:hover { opacity: 0.9; }
        .btn-primary:disabled { opacity: 0.4; cursor: not-allowed; }
        .btn-secondary {
            background: transparent;
            color: #666;
            border: 1px solid #333;
            margin-top: 8px;
        }
        .btn-secondary:hover { border-color: #555; color: #888; }
        
        .message {
            padding: 10px 12px;
            border-radius: 6px;
            margin-top: 16px;
            font-size: 0.875rem;
            display: none;
        }
        .message.success { background: #0a1a0a; border: 1px solid #0f0; color: #0f0; }
        .message.error { background: #1a0a0a; border: 1px solid #f00; color: #f00; }
        
        .row { display: flex; gap: 12px; }
        .row > div { flex: 1; }
        
        footer {
            text-align: center;
            padding: 20px;
            font-size: 0.75rem;
            color: #444;
            border-top: 1px solid #222;
            margin-top: 40px;
        }
        footer a { color: #666; text-decoration: none; }
        footer a:hover { color: #888; }
    </style>
</head>
<body>
    <div class="container">
        <h1>AlterBot</h1>
        
        <div class="card status-card">
            <div class="status-dot" id="statusDot"></div>
            <div>
                <div class="status-text" id="statusText">Checking status...</div>
                <div class="status-info" id="statusInfo"></div>
            </div>
        </div>
        
        <div class="card">
            <label>API Key</label>
            <input type="password" id="apiKey" placeholder="Enter API key" autocomplete="off">
            
            <label>Server Host</label>
            <input type="text" id="host" placeholder="server.aternos.me">
            
            <div class="row">
                <div>
                    <label>Port</label>
                    <input type="text" id="port" placeholder="25565">
                </div>
                <div>
                    <label>Username</label>
                    <input type="text" id="username" placeholder="BotName">
                </div>
            </div>
            
            <button class="btn btn-primary" id="applyBtn" onclick="applyConfig()">
                Apply & Restart
            </button>
            <button class="btn btn-secondary" onclick="clearCache()">
                Clear Saved Data
            </button>
            
            <div class="message" id="message"></div>
        </div>
    </div>
    
    <footer>
        <p>&copy; ${new Date().getFullYear()} AlterBot. <a href="https://github.com/vthiep2412" target="_blank">vthiep2412</a></p>
    </footer>
    
    <script>
        const $ = id => document.getElementById(id);
        const STORAGE_KEY = 'alterbot_config';
        
        function loadCache() {
            try {
                const cached = localStorage.getItem(STORAGE_KEY);
                if (cached) {
                    const data = JSON.parse(cached);
                    if (data.apiKey) $('apiKey').value = data.apiKey;
                    if (data.host) $('host').value = data.host;
                    if (data.port) $('port').value = data.port;
                    if (data.username) $('username').value = data.username;
                    if (data.apiKey) setTimeout(checkStatus, 100);
                }
            } catch (e) {}
        }
        
        function saveCache() {
            try {
                localStorage.setItem(STORAGE_KEY, JSON.stringify({
                    apiKey: $('apiKey').value,
                    host: $('host').value,
                    port: $('port').value,
                    username: $('username').value
                }));
            } catch (e) {}
        }
        
        function clearCache() {
            localStorage.removeItem(STORAGE_KEY);
            $('apiKey').value = '';
            $('host').value = '';
            $('port').value = '';
            $('username').value = '';
            showMessage('Cache cleared', 'success');
        }
        
        ['apiKey', 'host', 'port', 'username'].forEach(id => {
            $(id).addEventListener('input', saveCache);
        });
        
        async function checkStatus() {
            const key = $('apiKey').value;
            if (!key) {
                $('statusText').textContent = 'Enter API key';
                $('statusDot').classList.remove('connected');
                return;
            }
            
            try {
                const res = await fetch('/status?key=' + encodeURIComponent(key));
                if (res.status === 401) {
                    $('statusText').textContent = 'Invalid API key';
                    $('statusDot').classList.remove('connected');
                    return;
                }
                const data = await res.json();
                
                if (data.connected) {
                    $('statusDot').classList.add('connected');
                    $('statusText').textContent = 'Connected as ' + data.username;
                } else {
                    $('statusDot').classList.remove('connected');
                    $('statusText').textContent = 'Disconnected';
                }
                $('statusInfo').textContent = data.config.host + ':' + data.config.port;
            } catch (e) {
                $('statusText').textContent = 'Connection error';
            }
        }
        
        async function applyConfig() {
            const key = $('apiKey').value;
            const host = $('host').value;
            const port = $('port').value;
            const username = $('username').value;
            
            if (!key) { showMessage('API key required', 'error'); return; }
            
            $('applyBtn').disabled = true;
            $('applyBtn').textContent = 'Applying...';
            
            try {
                const res = await fetch('/apply?key=' + encodeURIComponent(key), {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ host, port, username })
                });
                
                if (res.status === 401) { showMessage('Invalid API key', 'error'); return; }
                
                const data = await res.json();
                showMessage(data.message || 'Bot restarting', 'success');
                saveCache();
                setTimeout(checkStatus, 3000);
            } catch (e) {
                showMessage('Failed to apply', 'error');
            } finally {
                $('applyBtn').disabled = false;
                $('applyBtn').textContent = 'Apply & Restart';
            }
        }
        
        function showMessage(text, type) {
            const msg = $('message');
            msg.textContent = text;
            msg.className = 'message ' + type;
            msg.style.display = 'block';
            setTimeout(() => msg.style.display = 'none', 4000);
        }
        
        loadCache();
        $('apiKey').addEventListener('change', checkStatus);
        $('apiKey').addEventListener('blur', checkStatus);
    </script>
</body>
</html>
`;

const server = HTTP.createServer(async (request, response) => {
        const url = new URL(request.url || '/', `http://localhost:${PORT}`);
        const apiKey = url.searchParams.get('key') || '';

        response.setHeader("Access-Control-Allow-Origin", "*");
        response.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
        response.setHeader("Access-Control-Allow-Headers", "Content-Type");

        if (request.method === 'OPTIONS') {
                response.writeHead(200);
                response.end();
                return;
        }

        if (url.pathname === '/' && request.method === 'GET') {
                response.setHeader("Content-Type", "text/html; charset=utf-8");
                response.setHeader("Cache-Control", "public, max-age=3600");
                response.writeHead(200);
                response.end(getDashboard());
                return;
        }

        response.setHeader("Content-Type", "application/json");
        response.setHeader("Cache-Control", "no-store");
        
        if (!checkAuth(apiKey)) {
                response.writeHead(401);
                response.end(JSON.stringify({ error: 'Unauthorized' }));
                return;
        }

        if (url.pathname === '/status' && request.method === 'GET') {
                response.writeHead(200);
                response.end(JSON.stringify(getStatus()));
                return;
        }

        if (url.pathname === '/apply' && request.method === 'POST') {
                try {
                        const body = await parseBody(request);
                        const newConfig = JSON.parse(body);
                        updateConfig(newConfig);
                        restartBot();
                        response.writeHead(200);
                        response.end(JSON.stringify({ success: true, message: 'Config applied, bot restarting...' }));
                } catch (e) {
                        response.writeHead(400);
                        response.end(JSON.stringify({ success: false, error: 'Invalid request' }));
                }
                return;
        }

        response.writeHead(404);
        response.end(JSON.stringify({ error: 'Not found' }));
});

export default (): void => {
        server.listen(PORT, () => console.log(`Dashboard ready at http://localhost:${PORT}`));
};