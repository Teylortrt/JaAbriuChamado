const $ = selector => document.querySelector(selector);
const toast = $('#toast');
const ticketDialog = $('#ticket-dialog');
const assignmentDialog = $('#assignment-dialog');
let currentUser;
let ticketQuery = '';
let ticketTimer;
let assignees = [];
let pendingAssignment;

async function api(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: { ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...options.headers }
  });
  const data = response.status === 204 ? {} : await response.json();
  if (!response.ok) throw new Error(data.message || 'Ocorreu um erro.');
  return data;
}

function notify(message) {
  toast.textContent = message;
  toast.classList.add('visible');
  setTimeout(() => toast.classList.remove('visible'), 2600);
}

function escapeHtml(value) {
  const span = document.createElement('span');
  span.textContent = value;
  return span.innerHTML;
}

async function loadTickets() {
  const { tickets } = await api(`/api/tickets?q=${encodeURIComponent(ticketQuery)}`);
  $('#ticket-count').textContent = `${tickets.length} ${tickets.length === 1 ? 'chamado encontrado' : 'chamados encontrados'}`;
  const list = $('#tickets-list');
  if (!tickets.length) {
    list.innerHTML = '<div class="empty-panel"><div class="empty-icon">▤</div><h2>Nenhum chamado encontrado</h2><p>Tente outra busca ou abra uma solicitação.</p></div>';
    return;
  }

  list.innerHTML = tickets.map(ticket => {
    const canEdit = currentUser.role === 'admin' || (ticket.user_id === currentUser.id && ticket.status === 'Aberto');
    return `<article class="ticket-row">
      <div class="ticket-copy">
        <span class="status-pill ${ticket.status === 'Resolvido' || ticket.status === 'Fechado' ? 'done' : ''}">${escapeHtml(ticket.status)}</span>
        <h3>${escapeHtml(ticket.title)}</h3>
        <p>${escapeHtml(ticket.category)} · ${new Date(ticket.created_at.replace(' ', 'T') + 'Z').toLocaleString('pt-BR')} ${currentUser.role === 'admin' ? `· Solicitante: ${escapeHtml(ticket.requester)}` : ''}</p>
        ${ticket.assigned_to_name ? `<p class="assigned-label">Responsável: ${escapeHtml(ticket.assigned_to_name)}</p>` : ''}
        <p class="ticket-description">${escapeHtml(ticket.description)}</p>
      </div>
      <div class="ticket-meta">
        <span class="priority ${ticket.priority === 'Urgente' || ticket.priority === 'Alta' ? 'high' : ''}">${escapeHtml(ticket.priority)}</span>
        ${currentUser.role === 'admin' ? `<select class="status-select" data-ticket-status="${ticket.id}" data-current-status="${ticket.status}" data-assigned-to="${ticket.assigned_to || ''}" aria-label="Status do chamado">${['Aberto', 'Em andamento', 'Resolvido', 'Fechado'].map(status => `<option ${status === ticket.status ? 'selected' : ''}>${status}</option>`).join('')}</select>${ticket.status === 'Em andamento' ? `<button class="table-action" type="button" data-assign-ticket="${ticket.id}">${ticket.assigned_to ? 'Alterar responsável' : 'Definir responsável'}</button>` : ''}` : ''}
        ${canEdit ? `<div class="row-actions"><button class="table-action" type="button" data-ticket-edit="${ticket.id}">Editar</button><button class="table-action danger" type="button" data-ticket-delete="${ticket.id}">Excluir</button></div>` : ''}
      </div>
    </article>`;
  }).join('');

  list.querySelectorAll('[data-ticket-edit]').forEach(button => {
    button.onclick = () => {
      const ticket = tickets.find(item => item.id === button.dataset.ticketEdit);
      const form = $('#ticket-form');
      form.elements.id.value = ticket.id;
      form.elements.title.value = ticket.title;
      form.elements.category.value = ticket.category;
      form.elements.priority.value = ticket.priority;
      form.elements.description.value = ticket.description;
      $('#ticket-dialog-title').textContent = 'Editar chamado';
      $('#ticket-save').textContent = 'Salvar alterações';
      $('#ticket-message').textContent = '';
      ticketDialog.showModal();
    };
  });

  list.querySelectorAll('[data-ticket-delete]').forEach(button => {
    button.onclick = async () => {
      const ticket = tickets.find(item => item.id === button.dataset.ticketDelete);
      if (!confirm(`Excluir o chamado “${ticket.title}”?`)) return;
      try {
        await api(`/api/tickets/${ticket.id}`, { method: 'DELETE' });
        await loadTickets();
        notify('Chamado excluído.');
      } catch (error) { notify(error.message); }
    };
  });

  list.querySelectorAll('[data-ticket-status]').forEach(select => {
    select.onchange = async () => {
      const previousStatus = select.dataset.currentStatus;
      if (select.value === 'Em andamento' && previousStatus !== 'Em andamento') {
        openAssignment(select);
        return;
      }
      try {
        await api(`/api/tickets/${select.dataset.ticketStatus}`, { method: 'PATCH', body: JSON.stringify({ status: select.value }) });
        select.dataset.currentStatus = select.value;
        if (select.value === 'Aberto') await loadTickets();
        notify('Status atualizado.');
      } catch (error) {
        notify(error.message);
        await loadTickets();
      }
    };
  });

  list.querySelectorAll('[data-assign-ticket]').forEach(button => {
    button.onclick = () => openAssignment(list.querySelector(`[data-ticket-status="${button.dataset.assignTicket}"]`));
  });
}

function openAssignment(select) {
  pendingAssignment = {
    select,
    previousStatus: select.dataset.currentStatus,
    ticketId: select.dataset.ticketStatus
  };
  $('#assignment-form').elements.ticketId.value = pendingAssignment.ticketId;
  $('#assignee-select').value = select.dataset.assignedTo || '';
  $('#assignment-message').textContent = '';
  assignmentDialog.showModal();
}

async function init() {
  try {
    ({ user: currentUser } = await api('/api/me'));
    $('#account-name').textContent = currentUser.name;
    $('#account-role').textContent = currentUser.role === 'admin' ? 'Administrador' : 'Usuário';
    $('#account-email').textContent = currentUser.email;
    $('#avatar').textContent = currentUser.name.charAt(0).toUpperCase();
    $('#welcome-title').textContent = `Olá, ${currentUser.name.split(' ')[0]}!`;
    if (currentUser.role === 'admin') {
      $('#people-link').hidden = false;
      $('#people-card').hidden = false;
      const result = await api('/api/assignees');
      assignees = result.assignees;
      $('#assignee-select').insertAdjacentHTML('beforeend', assignees.map(person =>
        `<option value="${person.id}">${escapeHtml(person.name)}</option>`
      ).join(''));
    } else {
      $('.quick-actions').classList.add('user-actions');
    }
    await loadTickets();
  } catch (error) {
    if (error.message === 'Faça login para continuar.') location.href = '/login';
    else notify(error.message);
  }
}

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
$('#open-ticket').onclick = () => {
  const form = $('#ticket-form');
  form.reset();
  form.elements.id.value = '';
  $('#ticket-dialog-title').textContent = 'Abrir chamado';
  $('#ticket-save').textContent = 'Enviar chamado';
  $('#ticket-message').textContent = '';
  ticketDialog.showModal();
};
document.querySelectorAll('[data-close]').forEach(button => button.onclick = () => button.closest('dialog').close());
$('#refresh-tickets').onclick = () => loadTickets().catch(error => notify(error.message));
$('#ticket-search').oninput = () => {
  ticketQuery = $('#ticket-search').value;
  clearTimeout(ticketTimer);
  ticketTimer = setTimeout(() => loadTickets().catch(error => notify(error.message)), 250);
};

$('#ticket-form').onsubmit = async event => {
  event.preventDefault();
  const form = event.currentTarget;
  const button = $('#ticket-save');
  const id = form.elements.id.value;
  const body = Object.fromEntries(new FormData(form));
  delete body.id;
  button.disabled = true;
  try {
    await api(id ? `/api/tickets/${id}` : '/api/tickets', { method: id ? 'PATCH' : 'POST', body: JSON.stringify(body) });
    ticketDialog.close();
    form.reset();
    await loadTickets();
    notify(id ? 'Chamado atualizado.' : 'Chamado aberto com sucesso.');
  } catch (error) {
    $('#ticket-message').textContent = error.message;
  } finally {
    button.disabled = false;
  }
};

function cancelAssignment() {
  if (pendingAssignment) {
    pendingAssignment.select.value = pendingAssignment.previousStatus;
  }
  pendingAssignment = null;
  assignmentDialog.close();
}

$('#assignment-cancel').onclick = cancelAssignment;
$('#assignment-close').onclick = cancelAssignment;
assignmentDialog.addEventListener('cancel', () => {
  if (pendingAssignment) pendingAssignment.select.value = pendingAssignment.previousStatus;
  pendingAssignment = null;
});
$('#assignment-form').onsubmit = async event => {
  event.preventDefault();
  if (!pendingAssignment) return;
  const button = event.currentTarget.querySelector('[type="submit"]');
  button.disabled = true;
  try {
    await api(`/api/tickets/${pendingAssignment.ticketId}`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'Em andamento', assignedTo: $('#assignee-select').value })
    });
    pendingAssignment = null;
    assignmentDialog.close();
    await loadTickets();
    notify('Chamado atribuído e iniciado.');
  } catch (error) {
    $('#assignment-message').textContent = error.message;
  } finally {
    button.disabled = false;
  }
};

init();
