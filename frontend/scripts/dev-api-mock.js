/**
 * API mock en :3010 para desarrollo manual sin Docker/Postgres.
 * Usa las mismas fixtures que Cypress (deterministas).
 */
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const PORT = 3010;
const FIXTURES = path.join(__dirname, '..', 'cypress', 'fixtures');

const cors = {
  'Access-Control-Allow-Origin': 'http://localhost:3000',
  'Access-Control-Allow-Methods': 'GET, PUT, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Credentials': 'true',
};

function readJson(name) {
  return JSON.parse(fs.readFileSync(path.join(FIXTURES, name), 'utf8'));
}

const positionsList = [
  {
    id: 1,
    title: 'Senior Full-Stack Engineer',
    contactInfo: 'Jane Recruiter',
    applicationDeadline: '2026-12-31T00:00:00.000Z',
    status: 'Open',
  },
];

function sendJson(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, { ...cors, 'Content-Type': 'application/json' });
  res.end(payload);
}

function sendText(res, status, body) {
  res.writeHead(status, { ...cors, 'Content-Type': 'text/plain' });
  res.end(body);
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://127.0.0.1:${PORT}`);
  const { pathname } = url;
  const method = req.method || 'GET';

  if (method === 'OPTIONS') {
    res.writeHead(204, cors);
    res.end();
    return;
  }

  if (method === 'GET' && pathname === '/') {
    sendText(res, 200, 'Hola LTI! (mock dev API)');
    return;
  }

  if (method === 'GET' && pathname === '/positions') {
    sendJson(res, 200, positionsList);
    return;
  }

  const interviewFlowMatch = /^\/positions\/(\d+)\/interviewflow$/i.exec(pathname);
  if (method === 'GET' && interviewFlowMatch) {
    sendJson(res, 200, readJson('interviewFlow.json'));
    return;
  }

  const candidatesByPosition = /^\/positions\/(\d+)\/candidates$/i.exec(pathname);
  if (method === 'GET' && candidatesByPosition) {
    // Pequeño delay: evita la carrera D-01 (candidates antes que interviewFlow).
    setTimeout(() => sendJson(res, 200, readJson('candidates.json')), 80);
    return;
  }

  const candidateGet = /^\/candidates\/(\d+)$/i.exec(pathname);
  if (method === 'GET' && candidateGet) {
    sendJson(res, 200, readJson('candidateDetail.json'));
    return;
  }

  const candidatePut = /^\/candidates\/(\d+)$/i.exec(pathname);
  if (method === 'PUT' && candidatePut) {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
    });
    req.on('end', () => {
      sendJson(res, 200, { message: 'Candidate stage updated successfully' });
    });
    return;
  }

  sendJson(res, 404, { error: 'Not found', path: pathname, method });
});

server.listen(PORT, () => {
  console.log(`Mock API (dev) → http://localhost:${PORT}`);
  console.log('Fixtures:', FIXTURES);
});
