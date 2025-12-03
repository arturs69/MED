const http = require('http');
const { randomUUID } = require('crypto');
const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const { URL } = require('url');

const DEFAULT_PORT = process.env.PORT || 3000;
const DEFAULT_DATA_FILE = path.join(__dirname, '..', 'data', 'appointments.json');
const DEFAULT_FRONTEND_DIR = path.join(__dirname, '..', 'frontend');

function createAppServer(options = {}) {
  const dataFile = options.dataFile || DEFAULT_DATA_FILE;
  const frontendDir = options.frontendDir || DEFAULT_FRONTEND_DIR;
  const port = options.port || DEFAULT_PORT;

  if (!fs.existsSync(dataFile)) {
    fs.mkdirSync(path.dirname(dataFile), { recursive: true });
    fs.writeFileSync(dataFile, '[]', 'utf-8');
  }

  async function ensureDataFile() {
    try {
      await fsp.access(dataFile, fs.constants.F_OK);
    } catch (err) {
      await fsp.mkdir(path.dirname(dataFile), { recursive: true });
      await fsp.writeFile(dataFile, '[]', 'utf-8');
    }
  }

  async function loadAppointments() {
    await ensureDataFile();
    const raw = await fsp.readFile(dataFile, 'utf-8');
    return JSON.parse(raw);
  }

  async function saveAppointments(appointments) {
    const payload = JSON.stringify(appointments, null, 2);
    await fsp.writeFile(dataFile, payload, 'utf-8');
  }

  function respondJson(res, statusCode, payload) {
    const body = JSON.stringify(payload);
    res.writeHead(statusCode, {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    });
    res.end(body);
  }

  async function parseRequestBody(req) {
    return new Promise((resolve, reject) => {
      let data = '';
      req.on('data', (chunk) => {
        data += chunk.toString();
        if (data.length > 1e6) {
          reject(new Error('Payload too large'));
          req.destroy();
        }
      });
      req.on('end', () => resolve(data));
      req.on('error', reject);
    });
  }

  function isValidDate(value) {
    const timestamp = Date.parse(value);
    return !Number.isNaN(timestamp);
  }

  async function handleApi(req, res, url) {
    if (req.method === 'OPTIONS') {
      res.writeHead(204, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      });
      res.end();
      return true;
    }

    if (req.method === 'GET' && url.pathname === '/api/appointments') {
      try {
        const appointments = await loadAppointments();
        respondJson(res, 200, { appointments });
      } catch (err) {
        respondJson(res, 500, { message: 'Failed to load appointments' });
      }
      return true;
    }

    if (req.method === 'POST' && url.pathname === '/api/appointments') {
      try {
        const body = await parseRequestBody(req);
        let parsed = {};
        try {
          parsed = body ? JSON.parse(body) : {};
        } catch (parseError) {
          respondJson(res, 400, { message: 'Body must be valid JSON.' });
          return true;
        }
        const patientName = (parsed.patientName || '').trim();
        const doctorName = (parsed.doctorName || '').trim();
        const dateTime = (parsed.dateTime || '').trim();
        const reason = (parsed.reason || '').trim();

        if (!patientName || !doctorName || !dateTime || !reason) {
          respondJson(res, 400, { message: 'All fields are required.' });
          return true;
        }

        if (!isValidDate(dateTime)) {
          respondJson(res, 400, { message: 'Date and time must be valid.' });
          return true;
        }

        const appointments = await loadAppointments();
        const newAppointment = {
          id: randomUUID(),
          patientName,
          doctorName,
          dateTime,
          reason,
          createdAt: new Date().toISOString(),
        };
        appointments.push(newAppointment);
        await saveAppointments(appointments);
        respondJson(res, 201, newAppointment);
      } catch (err) {
        respondJson(res, 500, { message: 'Unable to save appointment.' });
      }
      return true;
    }

    return false;
  }

  function getContentType(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    const map = {
      '.html': 'text/html; charset=utf-8',
      '.js': 'application/javascript; charset=utf-8',
      '.css': 'text/css; charset=utf-8',
      '.json': 'application/json; charset=utf-8',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.svg': 'image/svg+xml',
    };
    return map[ext] || 'application/octet-stream';
  }

  async function serveStatic(req, res, url) {
    const safePath = path.normalize(url.pathname).replace(/^\/+/, '');
    const target = safePath ? path.join(frontendDir, safePath) : path.join(frontendDir, 'index.html');
    const resolved = path.resolve(target);
    if (!resolved.startsWith(frontendDir)) {
      res.writeHead(403);
      res.end('Forbidden');
      return;
    }

    try {
      const stat = await fsp.stat(resolved);
      const filePath = stat.isDirectory() ? path.join(resolved, 'index.html') : resolved;
      const content = await fsp.readFile(filePath);
      res.writeHead(200, { 'Content-Type': getContentType(filePath) });
      res.end(content);
    } catch (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Not Found');
    }
  }

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, `http://${req.headers.host}`);

    if (url.pathname.startsWith('/api/')) {
      const handled = await handleApi(req, res, url);
      if (handled) {
        return;
      }
      respondJson(res, 404, { message: 'API route not found.' });
      return;
    }

    serveStatic(req, res, url);
  });

  return {
    server,
    listen(customPort = port) {
      return new Promise((resolve, reject) => {
        server.listen(customPort, () => resolve(server));
        server.on('error', reject);
      });
    },
    close() {
      return new Promise((resolve, reject) => {
        server.close((err) => {
          if (err) reject(err);
          else resolve();
        });
      });
    },
  };
}

if (require.main === module) {
  const app = createAppServer();
  app.listen().then(() => {
    console.log(`Server running at http://localhost:${DEFAULT_PORT}`);
  });
}

module.exports = { createAppServer };
