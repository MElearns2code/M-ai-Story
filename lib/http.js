const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-goog-api-key',
  'Access-Control-Max-Age': '86400'
};

const JSON_HEADERS = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store'
};

function setHeaders(res, headers) {
  for (const [key, value] of Object.entries(headers)) {
    res.setHeader(key, value);
  }
}

function sendJson(res, statusCode, payload) {
  if (!res.headersSent) {
    setHeaders(res, CORS_HEADERS);
    setHeaders(res, JSON_HEADERS);
    res.statusCode = statusCode;
  }

  res.end(JSON.stringify(payload));
}

function sendOptions(res) {
  if (!res.headersSent) {
    setHeaders(res, CORS_HEADERS);
    res.statusCode = 204;
  }

  res.end();
}

function readBody(req, limit = 1_000_000) {
  return new Promise((resolve, reject) => {
    let body = '';
    let resolvedOrRejected = false;

    const rejectOnce = (error) => {
      if (!resolvedOrRejected) {
        resolvedOrRejected = true;
        reject(error);
      }
    };

    req.on('data', (chunk) => {
      if (resolvedOrRejected) {
        return;
      }

      body += chunk;
      if (body.length > limit) {
        const error = new Error('Payload too large');
        error.statusCode = 413;
        req.destroy();
        rejectOnce(error);
      }
    });

    req.on('end', () => {
      if (!resolvedOrRejected) {
        resolvedOrRejected = true;
        resolve(body);
      }
    });

    req.on('error', (error) => {
      rejectOnce(error);
    });
  });
}

module.exports = {
  CORS_HEADERS,
  sendJson,
  sendOptions,
  readBody
};
