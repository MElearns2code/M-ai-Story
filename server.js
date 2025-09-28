const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { URL } = require('node:url');

const __dirnameSafe = __dirname;
const envPath = path.join(__dirnameSafe, '.env');

if (fs.existsSync(envPath)) {
  const envLines = fs.readFileSync(envPath, 'utf-8').split(/\r?\n/);
  for (const line of envLines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }
    const [key, ...rest] = trimmed.split('=');
    if (!key) {
      continue;
    }
    if (process.env[key] !== undefined) {
      continue;
    }
    const value = rest.join('=').trim();
    process.env[key] = value;
  }
}

const API_KEY = process.env.GOOGLE_GENAI_API_KEY;
if (!API_KEY) {
  console.warn('Warning: GOOGLE_GENAI_API_KEY is not set. Image generation requests will fail.');
}

const PORT = Number(process.env.PORT) || 4000;
const HOST = process.env.HOST || '127.0.0.1';
const MODEL = 'gemini-2.5-flash-image-preview';
const GOOGLE_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp'
};

const sendJson = (res, statusCode, data) => {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Cache-Control': 'no-store'
  });
  res.end(JSON.stringify(data));
};

const normalizePath = (unsafePath) => {
  const safePath = path.normalize(unsafePath).replace(/^\/+/, '');
  if (safePath.includes('..')) {
    return '';
  }
  return safePath;
};

const handleGenerateRequest = async (req, res) => {
  if (req.method !== 'POST') {
    sendJson(res, 405, { error: 'Method Not Allowed' });
    return;
  }

  let body = '';
  req.on('data', (chunk) => {
    body += chunk;
    if (body.length > 1_000_000) {
      req.pause();
      sendJson(res, 413, { error: 'Payload too large' });
    }
  });

  req.on('end', async () => {
    let prompt = '';
    try {
      const parsed = JSON.parse(body || '{}');
      prompt = typeof parsed.prompt === 'string' ? parsed.prompt.trim() : '';
    } catch (error) {
      sendJson(res, 400, { error: 'Invalid JSON payload' });
      return;
    }

    if (!prompt) {
      sendJson(res, 422, { error: 'Prompt is required' });
      return;
    }

    if (!API_KEY) {
      sendJson(res, 500, { error: 'Server missing configuration' });
      return;
    }

    try {
      const response = await fetch(GOOGLE_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': API_KEY
        },
        body: JSON.stringify({
          contents: [
            {
              role: 'user',
              parts: [
                { text: prompt }
              ]
            }
          ]
        })
      });

      const result = await response.json();

      if (!response.ok) {
        const message = result?.error?.message || 'Generation failed';
        sendJson(res, response.status, { error: message });
        return;
      }

      const candidates = result?.candidates || [];
      let inlineData;

      for (const candidate of candidates) {
        const parts = candidate?.content?.parts || [];
        inlineData = parts.find((part) => part?.inlineData)?.inlineData;
        if (inlineData) {
          break;
        }
      }

      if (!inlineData?.data) {
        sendJson(res, 502, { error: 'No image content returned' });
        return;
      }

      sendJson(res, 200, {
        imageBase64: inlineData.data,
        mimeType: inlineData.mimeType || 'image/png',
        prompt
      });
    } catch (error) {
      console.error('Image generation error:', error);
      sendJson(res, 500, { error: 'Unexpected server error' });
    }
  });
};

const server = http.createServer((req, res) => {
  // Basic CORS / preflight support
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    });
    res.end();
    return;
  }

  const url = new URL(req.url, `http://${req.headers.host}`);

  if (url.pathname === '/api/generate-image') {
    handleGenerateRequest(req, res);
    return;
  }

  const filePathRaw = url.pathname === '/' ? '/index.html' : url.pathname;
  const filePathSafe = normalizePath(filePathRaw);

  if (!filePathSafe) {
    res.writeHead(400, { 'Content-Type': 'text/plain' });
    res.end('Bad request');
    return;
  }

  const absolutePath = path.join(__dirnameSafe, filePathSafe);

  fs.stat(absolutePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Not found');
      return;
    }

    const ext = path.extname(absolutePath).toLowerCase();
    const contentType = mimeTypes[ext] || 'application/octet-stream';

    res.writeHead(200, {
      'Content-Type': contentType,
      'Cache-Control': 'no-cache'
    });

    const stream = fs.createReadStream(absolutePath);
    stream.pipe(res);
    stream.on('error', () => {
      res.end();
    });
  });
});

server.listen(PORT, HOST, () => {
  console.log(`M-ai Story server listening on http://${HOST}:${PORT}`);
});

server.on('error', (error) => {
  console.error('Server failed to start:', error.message);
});
