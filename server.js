const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { createHmac, timingSafeEqual } = require('node:crypto');

const root = __dirname;

function loadEnvironment() {
  const envFile = path.join(root, '.env');
  if (!fs.existsSync(envFile)) return;
  for (const line of fs.readFileSync(envFile, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (!match || line.trimStart().startsWith('#')) continue;
    let [, key, value] = match;
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

loadEnvironment();

const port = Number(process.env.PORT || 3000);
const loginEmail = process.env.LOGIN_EMAIL;
const loginPassword = process.env.LOGIN_PASSWORD;
const sessionSecret = process.env.SESSION_SECRET;
const sessionMaxAge = 60 * 60 * 8;

if (!loginEmail || !loginPassword || !sessionSecret) {
  throw new Error('Configure LOGIN_EMAIL, LOGIN_PASSWORD e SESSION_SECRET no arquivo .env.');
}

const contentTypes = { '.css': 'text/css; charset=utf-8', '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml' };

function send(response, status, body, type = 'text/plain; charset=utf-8', headers = {}) {
  response.writeHead(status, { 'Content-Type': type, ...headers });
  response.end(body);
}

function redirect(response, location) {
  response.writeHead(302, { Location: location });
  response.end();
}

function credentialsMatch(email, password) {
  const expected = Buffer.from(`${loginEmail}\0${loginPassword}`);
  const received = Buffer.from(`${email}\0${password}`);
  return expected.length === received.length && timingSafeEqual(expected, received);
}

function sign(value) {
  return createHmac('sha256', sessionSecret).update(value).digest('base64url');
}

function createSession() {
  const payload = Buffer.from(JSON.stringify({ email: loginEmail, expiresAt: Date.now() + sessionMaxAge * 1000 })).toString('base64url');
  return `${payload}.${sign(payload)}`;
}

function getCookie(request, name) {
  const item = (request.headers.cookie || '').split(';').map(value => value.trim()).find(value => value.startsWith(`${name}=`));
  return item ? decodeURIComponent(item.slice(name.length + 1)) : null;
}

function isAuthenticated(request) {
  const token = getCookie(request, 'auth_token');
  if (!token) return false;
  const [payload, signature] = token.split('.');
  if (!payload || !signature) return false;
  const expected = Buffer.from(sign(payload));
  const received = Buffer.from(signature);
  if (received.length !== expected.length || !timingSafeEqual(received, expected)) return false;
  try {
    const session = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    return session.email === loginEmail && Number.isFinite(session.expiresAt) && session.expiresAt > Date.now();
  } catch { return false; }
}

function sessionCookie(token) {
  return `auth_token=${encodeURIComponent(token)}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${sessionMaxAge}`;
}

function serveFile(response, relativePath) {
  const filePath = path.resolve(root, relativePath);
  if (!filePath.startsWith(root + path.sep)) return send(response, 403, 'Acesso negado.');
  fs.readFile(filePath, (error, data) => {
    if (error) return send(response, error.code === 'ENOENT' ? 404 : 500, 'Arquivo não encontrado.');
    send(response, 200, data, contentTypes[path.extname(filePath)] || 'application/octet-stream');
  });
}

const server = http.createServer((request, response) => {
  const url = new URL(request.url, `http://${request.headers.host || 'localhost'}`);
  if (request.method === 'GET' && (url.pathname === '/' || url.pathname === '/login')) {
    if (isAuthenticated(request)) return redirect(response, '/dashboard');
    return serveFile(response, 'templates/login.html');
  }
  if (request.method === 'GET' && url.pathname === '/dashboard') {
    if (!isAuthenticated(request)) return redirect(response, '/login');
    return serveFile(response, 'templates/dashboard.html');
  }
  if (request.method === 'GET' && url.pathname.startsWith('/public/')) return serveFile(response, url.pathname.slice(1));
  if (request.method === 'POST' && url.pathname === '/login') {
    let body = '';
    request.on('data', chunk => { body += chunk; if (body.length > 100_000) request.destroy(); });
    request.on('end', () => {
      try {
        const { email = '', password = '' } = JSON.parse(body);
        if (!credentialsMatch(String(email).trim(), String(password))) return send(response, 401, JSON.stringify({ message: 'Email ou senha inválidos.' }), contentTypes['.json']);
        send(response, 200, JSON.stringify({ message: 'Login realizado com sucesso.' }), contentTypes['.json'], { 'Set-Cookie': sessionCookie(createSession()) });
      } catch { send(response, 400, JSON.stringify({ message: 'Dados de login inválidos.' }), contentTypes['.json']); }
    });
    return;
  }
  if (request.method === 'POST' && url.pathname === '/logout') {
    return send(response, 204, '', 'text/plain; charset=utf-8', { 'Set-Cookie': 'auth_token=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0' });
  }
  send(response, 404, 'Página não encontrada.');
});

server.listen(port, () => console.log(`Aplicação disponível em http://localhost:${port}`));
