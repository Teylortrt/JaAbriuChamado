const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const {
  createHmac,
  timingSafeEqual,
  scryptSync,
  randomBytes,
  randomUUID
} = require('node:crypto');
const { DatabaseSync } = require('node:sqlite');

const root = __dirname;

function loadEnvironment() {
  const envFile = path.join(root, '.env');
  if (!fs.existsSync(envFile)) return;

  for (const line of fs.readFileSync(envFile, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (!match || line.trimStart().startsWith('#')) continue;

    const [, key, rawValue] = match;
    const value = rawValue.replace(/^(["'])(.*)\1$/, '$2');
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

loadEnvironment();

const port = Number(process.env.PORT || 3000);
const sessionSecret = process.env.SESSION_SECRET;
const sessionMaxAge = 60 * 60 * 8;

if (!sessionSecret) {
  throw new Error('Configure SESSION_SECRET no arquivo .env.');
}

const databaseFile = path.join(root, 'database', 'database.sqlite');
const db = new DatabaseSync(databaseFile);

// Mantém a estrutura do banco pronta, inclusive ao atualizar uma instalação existente.
db.exec(`
  PRAGMA foreign_keys = ON;

  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE COLLATE NOCASE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'user' CHECK(role IN ('admin', 'user')),
    active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS tickets (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    category TEXT NOT NULL,
    priority TEXT NOT NULL DEFAULT 'Normal'
      CHECK(priority IN ('Baixa', 'Normal', 'Alta', 'Urgente')),
    status TEXT NOT NULL DEFAULT 'Aberto'
      CHECK(status IN ('Aberto', 'Em andamento', 'Resolvido', 'Fechado')),
    assigned_to TEXT REFERENCES users(id) ON DELETE SET NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_tickets_user_created
    ON tickets(user_id, created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets(status);
`);

const ticketColumns = db.prepare('PRAGMA table_info(tickets)').all();
if (!ticketColumns.some(column => column.name === 'assigned_to')) {
  db.exec('ALTER TABLE tickets ADD COLUMN assigned_to TEXT REFERENCES users(id) ON DELETE SET NULL');
}
db.exec('CREATE INDEX IF NOT EXISTS idx_tickets_assigned_to ON tickets(assigned_to)');

if (process.env.LOGIN_EMAIL && process.env.LOGIN_PASSWORD) {
  const existingAdmin = db.prepare('SELECT id FROM users WHERE email = ?').get(process.env.LOGIN_EMAIL);
  if (!existingAdmin) {
    db.prepare(`
      INSERT INTO users (id, name, email, password_hash, role)
      VALUES (?, ?, ?, ?, 'admin')
    `).run(
      randomUUID(),
      process.env.ADMIN_NAME || 'Suporte Admin',
      process.env.LOGIN_EMAIL.trim().toLowerCase(),
      hashPassword(process.env.LOGIN_PASSWORD)
    );
  }
}

function hashPassword(password, salt = randomBytes(16).toString('hex')) {
  const hash = scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

function checkPassword(password, savedHash) {
  const [salt, hash] = savedHash.split(':');
  const expected = Buffer.from(hash, 'hex');
  const actual = scryptSync(password, salt, 64);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

function sign(value) {
  return createHmac('sha256', sessionSecret).update(value).digest('base64url');
}

function createSession(user) {
  const payload = Buffer.from(JSON.stringify({
    id: user.id,
    expiresAt: Date.now() + sessionMaxAge * 1000
  })).toString('base64url');
  return `${payload}.${sign(payload)}`;
}

function getCookie(request, name) {
  const cookie = (request.headers.cookie || '')
    .split(';')
    .map(value => value.trim())
    .find(value => value.startsWith(`${name}=`));
  return cookie ? cookie.slice(name.length + 1) : null;
}

function getUser(request) {
  const token = getCookie(request, 'auth_token');
  if (!token) return null;

  const [payload, signature] = token.split('.');
  if (!payload || !signature) return null;

  const expected = Buffer.from(sign(payload));
  const received = Buffer.from(signature);
  if (expected.length !== received.length || !timingSafeEqual(expected, received)) return null;

  try {
    const session = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (!Number.isFinite(session.expiresAt) || session.expiresAt <= Date.now()) return null;
    return db.prepare(`
      SELECT id, name, email, role, active
      FROM users
      WHERE id = ? AND active = 1
    `).get(session.id) || null;
  } catch {
    return null;
  }
}

const contentTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8'
};

function send(response, status, body, type = 'application/json; charset=utf-8', headers = {}) {
  response.writeHead(status, {
    'Content-Type': type,
    'Cache-Control': 'no-store',
    ...headers
  });
  response.end(Buffer.isBuffer(body) || typeof body === 'string' ? body : JSON.stringify(body));
}

function fail(response, status, message) {
  return send(response, status, { message });
}

function redirect(response, location) {
  response.writeHead(302, { Location: location, 'Cache-Control': 'no-store' });
  response.end();
}

function sessionCookie(token) {
  return `auth_token=${encodeURIComponent(token)}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${sessionMaxAge}`;
}

function readBody(request) {
  return new Promise((resolve, reject) => {
    let body = '';

    request.on('data', chunk => {
      body += chunk;
      if (body.length > 100_000) {
        reject(new Error('O tamanho máximo da solicitação foi excedido.'));
        request.destroy();
      }
    });

    request.on('end', () => {
      try {
        resolve(JSON.parse(body || '{}'));
      } catch {
        reject(new Error('O conteúdo enviado não é um JSON válido.'));
      }
    });

    request.on('error', reject);
  });
}

const validEmail = email => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

function requireAuth(user, response) {
  if (user) return true;
  fail(response, 401, 'Faça login para continuar.');
  return false;
}

function requireAdmin(user, response) {
  if (!requireAuth(user, response)) return false;
  if (user.role === 'admin') return true;
  fail(response, 403, 'Apenas administradores podem executar esta ação.');
  return false;
}

function serveFile(response, relativePath) {
  const filePath = path.resolve(root, relativePath);
  if (!filePath.startsWith(root + path.sep)) return fail(response, 403, 'Acesso negado.');

  fs.readFile(filePath, (error, data) => {
    if (error) return fail(response, error.code === 'ENOENT' ? 404 : 500, 'Arquivo não encontrado.');
    const type = contentTypes[path.extname(filePath)] || 'application/octet-stream';
    send(response, 200, data, type);
  });
}

function findAssignableUser(id) {
  if (!id) return null;
  return db.prepare(`
    SELECT id, name
    FROM users
    WHERE id = ? AND active = 1
  `).get(id) || null;
}

function ticketSelect(whereClause) {
  return `
    SELECT tickets.*, requester.name AS requester, assignee.name AS assigned_to_name
    FROM tickets
    JOIN users AS requester ON requester.id = tickets.user_id
    LEFT JOIN users AS assignee ON assignee.id = tickets.assigned_to
    ${whereClause}
  `;
}

const server = http.createServer(async (request, response) => {
  const url = new URL(request.url, `http://${request.headers.host || 'localhost'}`);
  const user = getUser(request);
  const route = url.pathname;

  try {
    if (request.method === 'GET' && (route === '/' || route === '/login')) {
      return serveFile(response, 'templates/login.html');
    }
    if (request.method === 'GET' && route === '/register') {
      return serveFile(response, 'templates/register.html');
    }
    if (request.method === 'GET' && route === '/dashboard') {
      if (!requireAuth(user, response)) return;
      return serveFile(response, 'templates/dashboard.html');
    }
    if (request.method === 'GET' && route === '/users') {
      if (!user) return redirect(response, '/login');
      if (user.role !== 'admin') return redirect(response, '/dashboard');
      return serveFile(response, 'templates/users.html');
    }
    if (request.method === 'GET' && route.startsWith('/public/')) {
      return serveFile(response, route.slice(1));
    }

    if (request.method === 'POST' && route === '/register') {
      const body = await readBody(request);
      const name = String(body.name || '').trim();
      const email = String(body.email || '').trim().toLowerCase();
      const password = String(body.password || '');
      if (name.length < 2 || name.length > 100 || !validEmail(email) || password.length < 8) {
        return fail(response, 400, 'Informe nome, email válido e senha com pelo menos 8 caracteres.');
      }

      const id = randomUUID();
      try {
        db.prepare(`
          INSERT INTO users (id, name, email, password_hash, role)
          VALUES (?, ?, ?, ?, 'user')
        `).run(id, name, email, hashPassword(password));
      } catch (error) {
        if (String(error.message).includes('UNIQUE')) return fail(response, 409, 'Este email já está cadastrado.');
        throw error;
      }

      const created = db.prepare('SELECT id, name, email, role FROM users WHERE id = ?').get(id);
      return send(response, 201, { message: 'Cadastro realizado.', user: created });
    }

    if (request.method === 'POST' && route === '/login') {
      const body = await readBody(request);
      const email = String(body.email || '').trim();
      const password = String(body.password || '');
      const found = db.prepare(`
        SELECT * FROM users
        WHERE email = ? COLLATE NOCASE AND active = 1
      `).get(email);

      if (!found || !checkPassword(password, found.password_hash)) {
        return fail(response, 401, 'Email ou senha inválidos.');
      }

      return send(response, 200, {
        message: 'Login realizado.',
        user: { id: found.id, name: found.name, email: found.email, role: found.role }
      }, undefined, { 'Set-Cookie': sessionCookie(createSession(found)) });
    }

    if (request.method === 'POST' && route === '/logout') {
      return send(response, 204, '', 'text/plain; charset=utf-8', {
        'Set-Cookie': 'auth_token=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0'
      });
    }

    if (request.method === 'GET' && route === '/api/me') {
      if (!requireAuth(user, response)) return;
      return send(response, 200, { user });
    }

    if (request.method === 'GET' && route === '/api/users') {
      if (!requireAdmin(user, response)) return;
      const query = `%${(url.searchParams.get('q') || '').trim()}%`;
      const users = db.prepare(`
        SELECT id, name, email, role, active, created_at
        FROM users
        WHERE name LIKE ? OR email LIKE ?
        ORDER BY name
      `).all(query, query);
      return send(response, 200, { users });
    }

    if (request.method === 'GET' && route === '/api/assignees') {
      if (!requireAdmin(user, response)) return;
      const assignees = db.prepare(`
        SELECT id, name
        FROM users
        WHERE active = 1
        ORDER BY name
      `).all();
      return send(response, 200, { assignees });
    }

    if (route.startsWith('/api/users/') && request.method === 'PATCH') {
      if (!requireAdmin(user, response)) return;
      const id = route.slice('/api/users/'.length);
      const body = await readBody(request);
      const target = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
      if (!target) return fail(response, 404, 'Usuário não encontrado.');

      const name = String(body.name ?? target.name).trim();
      const email = String(body.email ?? target.email).trim().toLowerCase();
      const role = body.role ?? target.role;
      const active = body.active === undefined ? target.active : (body.active ? 1 : 0);
      if (name.length < 2 || name.length > 100 || !validEmail(email) || !['admin', 'user'].includes(role)) {
        return fail(response, 400, 'Dados do usuário inválidos.');
      }
      if (body.password && String(body.password).length < 8) {
        return fail(response, 400, 'A senha deve ter pelo menos 8 caracteres.');
      }
      if (target.id === user.id && (role !== 'admin' || !active)) {
        return fail(response, 400, 'Não é possível remover seu próprio acesso administrativo.');
      }
      if (target.role === 'admin' && (role !== 'admin' || !active)) {
        const activeAdmins = db.prepare("SELECT COUNT(*) AS count FROM users WHERE role = 'admin' AND active = 1").get().count;
        if (activeAdmins <= 1) return fail(response, 400, 'O sistema precisa manter ao menos um administrador ativo.');
      }

      try {
        db.prepare('UPDATE users SET name = ?, email = ?, role = ?, active = ? WHERE id = ?')
          .run(name, email, role, active, id);
      } catch (error) {
        if (String(error.message).includes('UNIQUE')) return fail(response, 409, 'Este email já está cadastrado.');
        throw error;
      }
      if (body.password) {
        db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hashPassword(String(body.password)), id);
      }
      return send(response, 200, { message: 'Usuário atualizado.' });
    }

    if (route.startsWith('/api/users/') && request.method === 'DELETE') {
      if (!requireAdmin(user, response)) return;
      const id = route.slice('/api/users/'.length);
      const target = db.prepare('SELECT id, role, active FROM users WHERE id = ?').get(id);
      if (!target) return fail(response, 404, 'Usuário não encontrado.');
      if (id === user.id) return fail(response, 400, 'Não é possível excluir sua própria conta.');
      if (target.role === 'admin' && target.active) {
        const activeAdmins = db.prepare("SELECT COUNT(*) AS count FROM users WHERE role = 'admin' AND active = 1").get().count;
        if (activeAdmins <= 1) return fail(response, 400, 'O sistema precisa manter ao menos um administrador ativo.');
      }

      db.exec('BEGIN');
      try {
        db.prepare('DELETE FROM tickets WHERE user_id = ?').run(id);
        db.prepare('DELETE FROM users WHERE id = ?').run(id);
        db.exec('COMMIT');
      } catch (error) {
        db.exec('ROLLBACK');
        throw error;
      }
      return send(response, 200, { message: 'Usuário e seus chamados foram excluídos.' });
    }

    if (request.method === 'GET' && route === '/api/tickets') {
      if (!requireAuth(user, response)) return;
      const query = `%${(url.searchParams.get('q') || '').trim()}%`;
      const tickets = user.role === 'admin'
        ? db.prepare(ticketSelect(`
            WHERE tickets.title LIKE ? OR tickets.description LIKE ?
              OR tickets.category LIKE ? OR requester.name LIKE ?
              OR tickets.status LIKE ? OR assignee.name LIKE ?
            ORDER BY tickets.created_at DESC
          `)).all(query, query, query, query, query, query)
        : db.prepare(ticketSelect(`
            WHERE tickets.user_id = ? AND (
              tickets.title LIKE ? OR tickets.description LIKE ?
              OR tickets.category LIKE ? OR tickets.status LIKE ?
              OR assignee.name LIKE ?
            )
            ORDER BY tickets.created_at DESC
          `)).all(user.id, query, query, query, query, query);
      return send(response, 200, { tickets });
    }

    if (request.method === 'POST' && route === '/api/tickets') {
      if (!requireAuth(user, response)) return;
      const body = await readBody(request);
      const title = String(body.title || '').trim();
      const description = String(body.description || '').trim();
      const category = String(body.category || '').trim();
      const priority = String(body.priority || 'Normal');
      if (title.length < 4 || title.length > 140 || description.length < 10 || description.length > 5000
        || category.length < 2 || !['Baixa', 'Normal', 'Alta', 'Urgente'].includes(priority)) {
        return fail(response, 400, 'Preencha assunto, descrição e categoria corretamente.');
      }

      const id = randomUUID();
      db.prepare(`
        INSERT INTO tickets (id, user_id, title, description, category, priority)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(id, user.id, title, description, category, priority);
      const ticket = db.prepare('SELECT * FROM tickets WHERE id = ?').get(id);
      return send(response, 201, { message: 'Chamado aberto com sucesso.', ticket });
    }

    if (route.startsWith('/api/tickets/') && request.method === 'PATCH') {
      if (!requireAuth(user, response)) return;
      const id = route.slice('/api/tickets/'.length);
      const body = await readBody(request);
      const ticket = db.prepare('SELECT * FROM tickets WHERE id = ?').get(id);
      if (!ticket) return fail(response, 404, 'Chamado não encontrado.');

      const isAdmin = user.role === 'admin';
      if (!isAdmin && (ticket.user_id !== user.id || ticket.status !== 'Aberto')) {
        return fail(response, 403, 'Você só pode editar seus chamados que ainda estão abertos.');
      }

      const title = String(body.title ?? ticket.title).trim();
      const description = String(body.description ?? ticket.description).trim();
      const category = String(body.category ?? ticket.category).trim();
      const priority = body.priority ?? ticket.priority;
      const status = body.status ?? ticket.status;
      if (title.length < 4 || title.length > 140 || description.length < 10 || description.length > 5000
        || category.length < 2 || !['Baixa', 'Normal', 'Alta', 'Urgente'].includes(priority)
        || !['Aberto', 'Em andamento', 'Resolvido', 'Fechado'].includes(status)) {
        return fail(response, 400, 'Dados do chamado inválidos.');
      }
      if (!isAdmin && status !== ticket.status) {
        return fail(response, 403, 'Somente um administrador pode alterar o status.');
      }

      let assignedTo = ticket.assigned_to || null;
      if (isAdmin && body.assignedTo !== undefined) {
        assignedTo = body.assignedTo ? String(body.assignedTo) : null;
      }
      if (status === 'Em andamento') {
        if (!assignedTo) return fail(response, 400, 'Escolha o usuário responsável pelo chamado.');
        if (!findAssignableUser(assignedTo)) return fail(response, 400, 'O responsável escolhido não existe ou está desativado.');
      }
      if (status === 'Aberto') assignedTo = null;

      db.prepare(`
        UPDATE tickets
        SET title = ?, description = ?, category = ?, priority = ?, status = ?,
            assigned_to = ?, updated_at = datetime('now')
        WHERE id = ?
      `).run(title, description, category, priority, status, assignedTo, id);
      return send(response, 200, { message: 'Chamado atualizado.' });
    }

    if (route.startsWith('/api/tickets/') && request.method === 'DELETE') {
      if (!requireAuth(user, response)) return;
      const id = route.slice('/api/tickets/'.length);
      const ticket = db.prepare('SELECT user_id, status FROM tickets WHERE id = ?').get(id);
      if (!ticket) return fail(response, 404, 'Chamado não encontrado.');
      if (user.role !== 'admin' && (ticket.user_id !== user.id || ticket.status !== 'Aberto')) {
        return fail(response, 403, 'Você só pode excluir seus chamados que ainda estão abertos.');
      }
      db.prepare('DELETE FROM tickets WHERE id = ?').run(id);
      return send(response, 200, { message: 'Chamado excluído.' });
    }

    return fail(response, 404, 'Página não encontrada.');
  } catch (error) {
    return fail(response, 400, error.message || 'Não foi possível processar a solicitação.');
  }
});

server.listen(port, () => {
  console.log(`Aplicação disponível em http://localhost:${port}`);
});
