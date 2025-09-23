const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

const port = process.env.PORT || 8080;
const rootDir = __dirname;
const defaultDocument = 'index.html';

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.wasm': 'application/wasm',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.map': 'application/json; charset=utf-8'
};

function applyIsolationHeaders(res) {
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
}

function sendError(res, statusCode, message) {
  if (res.headersSent) {
    res.end();
    return;
  }
  res.statusCode = statusCode;
  applyIsolationHeaders(res);
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.end(message);
}

function resolveFilePath(requestPath) {
  let relativePath = requestPath;
  if (!relativePath || relativePath === '/') {
    relativePath = defaultDocument;
  } else if (relativePath.endsWith('/')) {
    relativePath = `${relativePath}${defaultDocument}`;
  }

  const sanitizedPath = relativePath.replace(/^\/+/, '');
  return path.join(rootDir, sanitizedPath);
}

const server = http.createServer((req, res) => {
  const method = (req.method || 'GET').toUpperCase();
  if (method !== 'GET' && method !== 'HEAD') {
    res.setHeader('Allow', 'GET, HEAD');
    sendError(res, 405, 'Method Not Allowed');
    return;
  }

  let requestPath = '/';
  try {
    const requestURL = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    requestPath = decodeURIComponent(requestURL.pathname);
  } catch (error) {
    sendError(res, 400, 'Bad Request');
    return;
  }

  if (requestPath.includes('\0')) {
    sendError(res, 400, 'Bad Request');
    return;
  }

  const absolutePath = path.normalize(resolveFilePath(requestPath));
  const rootWithSeparator = rootDir.endsWith(path.sep) ? rootDir : rootDir + path.sep;
  if (absolutePath !== rootDir && !absolutePath.startsWith(rootWithSeparator)) {
    sendError(res, 404, 'Not Found');
    return;
  }

  fs.stat(absolutePath, (statError, stats) => {
    if (statError || !stats.isFile()) {
      sendError(res, 404, 'Not Found');
      return;
    }

    const extension = path.extname(absolutePath).toLowerCase();
    const contentType = mimeTypes[extension] || 'application/octet-stream';

    res.statusCode = 200;
    applyIsolationHeaders(res);
    res.setHeader('Content-Type', contentType);

    if (method === 'HEAD') {
      res.end();
      return;
    }

    const stream = fs.createReadStream(absolutePath);
    stream.on('error', () => {
      sendError(res, 500, 'Internal Server Error');
    });
    stream.pipe(res);
  });
});

server.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
  console.log('Serving files with Cross-Origin isolation headers.');
});

module.exports = server;
