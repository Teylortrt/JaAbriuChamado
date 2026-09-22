const accountButton = document.getElementById('account-button');
const accountMenu = document.getElementById('account-menu');
const toast = document.getElementById('toast');

accountButton.addEventListener('click', () => {
  const isOpen = !accountMenu.hidden;
  accountMenu.hidden = isOpen;
  accountButton.setAttribute('aria-expanded', String(!isOpen));
});

document.addEventListener('click', event => {
  if (!event.target.closest('.account')) {
    accountMenu.hidden = true;
    accountButton.setAttribute('aria-expanded', 'false');
  }
});

document.getElementById('logout-button').addEventListener('click', async () => {
  await fetch('/logout', { method: 'POST' });
  window.location.href = '/login';
});

