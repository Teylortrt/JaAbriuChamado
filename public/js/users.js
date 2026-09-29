const $ = selector => document.querySelector(selector);
const dialog = $('#user-dialog');
const toast = $('#toast');
let currentUser;
let query = '';
let searchTimer;
let users = [];

async function api(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: { ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...options.headers }
  });
  const data = response.status === 204 ? {} : await response.json();
  if (!response.ok) throw new Error(data.message || 'Não foi possível concluir a solicitação.');
  return data;
}

function escapeHtml(value) {
  const span = document.createElement('span');
  span.textContent = value;
  return span.innerHTML;
}

function notify(message) {
  toast.textContent = message;
  toast.classList.add('visible');
  setTimeout(() => toast.classList.remove('visible'), 2800);
}

async function loadUsers() {
  const { users: result } = await api(`/api/users?q=${encodeURIComponent(query)}`);
  users = result;
  $('#users-count').textContent = users.length;
  const tbody = $('#users-list');
  if (!users.length) {
    tbody.innerHTML = '<tr><td colspan="5" class="table-empty">Nenhum usuário encontrado.</td></tr>';
    return;
  }

  tbody.innerHTML = users.map(user => `<tr>
    <td><div class="user-cell"><span class="user-avatar">${escapeHtml(user.name.slice(0, 1).toUpperCase())}</span><span><strong>${escapeHtml(user.name)}</strong><small>${escapeHtml(user.email)}</small></span></div></td>
    <td><span class="role-badge ${user.role === 'admin' ? 'role-admin' : ''}">${user.role === 'admin' ? 'Administrador' : 'Usuário'}</span></td>
    <td><span class="access-state ${user.active ? 'is-active' : 'is-inactive'}"><i></i>${user.active ? 'Ativo' : 'Desativado'}</span></td>
    <td>${new Date(user.created_at.replace(' ', 'T') + 'Z').toLocaleDateString('pt-BR')}</td>
    <td><div class="row-actions"><button class="table-action" type="button" data-edit="${user.id}">Editar</button>${user.id !== currentUser.id ? `<button class="table-action danger" type="button" data-delete="${user.id}">Excluir</button>` : ''}</div></td>
  </tr>`).join('');

  tbody.querySelectorAll('[data-edit]').forEach(button => {
    button.onclick = () => openEdit(users.find(user => user.id === button.dataset.edit));
  });
  tbody.querySelectorAll('[data-delete]').forEach(button => {
    button.onclick = () => deleteUser(users.find(user => user.id === button.dataset.delete));
  });
}

function openEdit(user) {
  const form = $('#user-form');
  form.reset();
  form.elements.id.value = user.id;
  form.elements.name.value = user.name;
  form.elements.email.value = user.email;
  form.elements.role.value = user.role;
  form.elements.active.checked = Boolean(user.active);
  $('#user-message').textContent = '';
  $('#user-message').className = 'form-message';
  dialog.showModal();
}

async function deleteUser(user) {
  if (!confirm(`Excluir a conta de ${user.name}? Os chamados vinculados a essa conta também serão excluídos.`)) return;
  try {
    await api(`/api/users/${user.id}`, { method: 'DELETE' });
    await loadUsers();
    notify('Usuário excluído.');
  } catch (error) { notify(error.message); }
}

async function init() {
  try {
    ({ user: currentUser } = await api('/api/me'));
    if (currentUser.role !== 'admin') {
      location.href = '/dashboard';
      return;
    }
    $('#account-name').textContent = currentUser.name;
    $('#account-email').textContent = currentUser.email;
    $('#avatar').textContent = currentUser.name.charAt(0).toUpperCase();
    await loadUsers();
  } catch (error) {
    if (error.message === 'Faça login para continuar.') location.href = '/login';
    else {
      $('#users-list').innerHTML = `<tr><td colspan="5" class="table-empty">${escapeHtml(error.message)}</td></tr>`;
      notify(error.message);
    }
  }
}

$('#user-search').oninput = () => {
  query = $('#user-search').value;
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => loadUsers().catch(error => notify(error.message)), 180);
};

$('#user-form').onsubmit = async event => {
  event.preventDefault();
  const form = event.currentTarget;
  const data = new FormData(form);
  const id = data.get('id');
  const body = { name: data.get('name'), email: data.get('email'), role: data.get('role'), active: data.has('active') };
  if (data.get('password')) body.password = data.get('password');
  const button = form.querySelector('[type="submit"]');
  button.disabled = true;
  try {
    await api(`/api/users/${id}`, { method: 'PATCH', body: JSON.stringify(body) });
    if (id === currentUser.id) {
      currentUser = { ...currentUser, name: body.name, email: body.email, role: body.role };
      $('#account-name').textContent = body.name;
      $('#account-email').textContent = body.email;
      $('#avatar').textContent = body.name.charAt(0).toUpperCase();
    }
    dialog.close();
    await loadUsers();
    notify('Usuário atualizado.');
  } catch (error) {
    $('#user-message').textContent = error.message;
    $('#user-message').className = 'form-message error';
  } finally { button.disabled = false; }
};

document.querySelectorAll('[data-close]').forEach(button => button.onclick = () => dialog.close());
$('#account-button').onclick = () => {
  const open = $('#account-menu').hidden;
  $('#account-menu').hidden = !open;
  $('#account-button').setAttribute('aria-expanded', String(open));
};
document.addEventListener('click', event => {
  if (!event.target.closest('.account')) {
    $('#account-menu').hidden = true;
    $('#account-button').setAttribute('aria-expanded', 'false');
  }
});
$('#logout-button').onclick = async () => {
  await fetch('/logout', { method: 'POST' });
  location.href = '/login';
};

init();
