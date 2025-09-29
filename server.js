const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { URL } = require('node:url');
const { sendJson, sendOptions } = require('./lib/http');

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

if (!process.env.GOOGLE_GENAI_API_KEY) {
  console.warn('Warning: GOOGLE_GENAI_API_KEY is not set. Image generation requests will fail.');
}

const PORT = Number(process.env.PORT) || 4000;
const HOST = process.env.HOST || '127.0.0.1';

const generateImageHandler = require('./api/generate-image');

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

const normalizePath = (unsafePath) => {
  const safePath = path.normalize(unsafePath).replace(/^\/+/, '');
  if (safePath.includes('..')) {
    return '';
  }
  return safePath;
};

const server = http.createServer((req, res) => {
  // Enhanced CORS / preflight support
  if (req.method === 'OPTIONS') {
    sendOptions(res);
    return;
  }

  const url = new URL(req.url, `http://${req.headers.host}`);

  if (url.pathname === '/api/generate-image') {
    Promise.resolve(generateImageHandler(req, res)).catch((error) => {
      console.error('Image generation error:', error);
      if (!res.headersSent) {
        sendJson(res, 500, { error: 'Unexpected server error: ' + error.message });
      }
    });
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
