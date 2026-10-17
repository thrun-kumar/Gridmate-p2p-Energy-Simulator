/**
 * GRIDMATE - Express-Compatible Application Server
 * Supports standard Express framework while maintaining an autonomous zero-dependency fallback.
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

// Load environment variables (.env) if present
require('./utils/envLoader');

const { SimulationManager } = require('./simulation/simulationManager');
const { setupRoutes } = require('./routes/apiRoutes');

function createApp() {
  const simManager = new SimulationManager();
  const routes = [];
  const clientDir = path.resolve(__dirname, '../../client');

  function addRoute(method, routePath, handler) {
    // Convert parameterized route like /api/households/:id to RegExp
    const paramNames = [];
    const regexPath = routePath.replace(/:([a-zA-Z0-9_]+)/g, (_, name) => {
      paramNames.push(name);
      return '([^/]+)';
    });
    const regex = new RegExp(`^${regexPath}$`);

    routes.push({
      method: method.toUpperCase(),
      routePath,
      regex,
      paramNames,
      handler
    });
  }

  const app = {
    get: (routePath, handler) => addRoute('GET', routePath, handler),
    post: (routePath, handler) => addRoute('POST', routePath, handler),
    simManager
  };

  // Attach all API routes
  setupRoutes(app, simManager);

  // Core HTTP Request Handler
  function handleRequest(req, res) {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, DELETE');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
      res.statusCode = 204;
      res.end();
      return;
    }

    const parsedUrl = url.parse(req.url, true);
    const pathname = parsedUrl.pathname;

    // Helper for JSON responses
    res.status = function(code) {
      res.statusCode = code;
      return res;
    };

    res.json = function(data) {
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify(data, null, 2));
    };

    res.send = function(data) {
      res.end(data);
    };

    // Buffer incoming body for POST requests
    let bodyData = '';
    req.on('data', chunk => {
      bodyData += chunk;
      if (bodyData.length > 10 * 1024 * 1024) {
        // Guard against massive payloads
        req.destroy();
      }
    });

    req.on('end', () => {
      req.query = parsedUrl.query || {};
      req.body = {};

      if (bodyData) {
        try {
          req.body = JSON.parse(bodyData);
        } catch (e) {
          req.body = {};
        }
      }

      // Route Matching
      const matched = routes.find(r => r.method === req.method && r.regex.test(pathname));

      if (matched) {
        const matches = pathname.match(matched.regex);
        req.params = {};
        if (matches && matched.paramNames.length > 0) {
          matched.paramNames.forEach((name, i) => {
            req.params[name] = matches[i + 1];
          });
        }

        try {
          matched.handler(req, res);
        } catch (err) {
          res.status(500).json({ error: 'Internal Server Error', message: err.message });
        }
        return;
      }

      // Static file serving for client frontend
      serveStatic(req, res, pathname, clientDir);
    });
  }

  function serveStatic(req, res, pathname, baseDir) {
    let filePath = pathname === '/' ? '/index.html' : pathname;
    let fullPath = path.join(baseDir, filePath);

    // Prevent directory traversal attacks
    if (!fullPath.startsWith(baseDir)) {
      res.statusCode = 403;
      res.end('Access Denied');
      return;
    }

    const reqExt = path.extname(pathname).toLowerCase();

    // If an asset was requested with a subpath (e.g. /seller/js/icons.js or /buyer/css/style.css), resolve to baseDir
    if (!fs.existsSync(fullPath) && reqExt) {
      const assetMatch = pathname.match(/\/(js|css|img|assets|images|favicon\.ico)\b.*$/);
      if (assetMatch) {
        const fallbackPath = path.join(baseDir, assetMatch[0]);
        if (fs.existsSync(fallbackPath) && !fs.statSync(fallbackPath).isDirectory()) {
          fullPath = fallbackPath;
        }
      }
    }

    // If still doesn't exist:
    if (!fs.existsSync(fullPath) || fs.statSync(fullPath).isDirectory()) {
      if (reqExt && reqExt !== '.html') {
        // Missing static asset -> 404, never return HTML for missing JS/CSS/image
        res.statusCode = 404;
        res.setHeader('Content-Type', 'text/plain');
        res.end('404 Not Found');
        return;
      }
      // SPA route navigation fallback -> serve index.html
      fullPath = path.join(baseDir, 'index.html');
    }

    if (!fs.existsSync(fullPath)) {
      res.statusCode = 404;
      res.setHeader('Content-Type', 'text/plain');
      res.end('404 Not Found');
      return;
    }

    const ext = path.extname(fullPath).toLowerCase();
    const mimeTypes = {
      '.html': 'text/html; charset=utf-8',
      '.css': 'text/css; charset=utf-8',
      '.js': 'application/javascript; charset=utf-8',
      '.json': 'application/json; charset=utf-8',
      '.svg': 'image/svg+xml',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.ico': 'image/x-icon'
    };

    const contentType = mimeTypes[ext] || 'application/octet-stream';
    res.statusCode = 200;
    res.setHeader('Content-Type', contentType);
    fs.createReadStream(fullPath).pipe(res);
  }

  return {
    handleRequest,
    simManager,
    routes
  };
}

module.exports = {
  createApp
};
